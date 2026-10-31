"""Opt-in local action layer for Studio (docs/design/studio-local-actions.md).

Studio never executes research logic itself. With ``--allow-actions`` it can
start one allowlisted ``aq`` command as a child process, count it, and log it.
Everything here is stdlib only and network free.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Protocol

from .sessions import list_sessions, load_session, session_snapshot
from .workspace import (
    SCHEMA_VERSION,
    AutoQuantValidationError,
    ProjectContext,
    ValidationIssue,
)


TOKEN_HEADER = "X-Studio-Token"
AUDIT_RELATIVE = Path(".autoquant") / "studio-actions.jsonl"
AUDIT_SCHEMA_VERSION = 1
OUTPUT_CAP_BYTES = 256 * 1024
MAX_BODY_BYTES = 64 * 1024
MAX_RECENT_JOBS = 50
LOOPBACK_NAMES = {"localhost"}
SECRET_NAME = re.compile(r"TOKEN|KEY|SECRET|PASSWORD", re.IGNORECASE)
ENV_ALLOWLIST = {
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "SYSTEMDRIVE",
    "WINDIR",
    "COMSPEC",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "PYTHONUTF8",
    "VIRTUAL_ENV",
    "LANG",
    "LC_ALL",
    "TZ",
}
ENV_ALLOW_PREFIXES = ("UV_",)
SESSION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]")
STAGES = (
    ("data-checked", "data checked"),
    ("split-frozen", "split frozen"),
    ("candidate-run", "candidate run"),
    ("selection", "selection (validation)"),
    ("test-audit", "test audit"),
)


class ActionError(Exception):
    """An action-layer refusal carrying its HTTP status and Studio code."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        issues: list[ValidationIssue] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.issues = issues or []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _issue(path: str, code: str, message: str) -> ValidationIssue:
    return ValidationIssue(path, code, message)


def is_loopback_host(host: str) -> bool:
    if host.lower() in LOOPBACK_NAMES:
        return True
    try:
        return ipaddress.ip_address(host.strip("[]")).is_loopback
    except ValueError:
        return False


def confine_workspace_path(workspace: Path, raw: str, label: str) -> Path:
    """Resolve a caller path slot and require it to stay inside the Workspace.

    S1 has no user path slot; later slices must route every one through here.
    """
    if not isinstance(raw, str) or not raw or CONTROL_CHARACTERS.search(raw):
        raise ActionError(
            422,
            "validation.failed",
            f"{label} must be a non-empty path",
            [_issue(label, "path.invalid", f"{label} must be a non-empty path")],
        )
    root = workspace.resolve()
    candidate = Path(raw)
    resolved = (candidate if candidate.is_absolute() else root / candidate).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ActionError(
            422,
            "validation.failed",
            f"{label} escapes the Workspace",
            [_issue(label, "path.escape", f"{label} escapes the Workspace")],
        ) from None
    return resolved


def scrubbed_environment(source: dict[str, str] | None = None) -> dict[str, str]:
    environment = dict(os.environ if source is None else source)
    clean: dict[str, str] = {}
    for name, value in environment.items():
        upper = name.upper()
        if SECRET_NAME.search(upper):
            continue
        if upper in ENV_ALLOWLIST or upper.startswith(ENV_ALLOW_PREFIXES):
            clean[name] = value
    clean["PYTHONUTF8"] = "1"
    return clean


# --- process seam -----------------------------------------------------------


class ProcessHandle(Protocol):
    stdout: Any
    stderr: Any
    returncode: int | None

    def wait(self, timeout: float | None = None) -> int: ...

    def kill_tree(self) -> None: ...


class _PopenHandle:
    def __init__(self, process: subprocess.Popen) -> None:
        self._process = process
        self.stdout = process.stdout
        self.stderr = process.stderr

    @property
    def returncode(self) -> int | None:
        return self._process.returncode

    def wait(self, timeout: float | None = None) -> int:
        return self._process.wait(timeout=timeout)

    def kill_tree(self) -> None:
        process = self._process
        if process.poll() is not None:
            return
        if os.name == "nt":
            try:
                subprocess.run(
                    ["taskkill", "/T", "/F", "/PID", str(process.pid)],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                    timeout=15,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            except (OSError, subprocess.SubprocessError):
                pass
        else:
            try:
                import signal

                os.killpg(process.pid, signal.SIGKILL)
            except (OSError, ProcessLookupError):
                pass
        if process.poll() is None:
            try:
                process.kill()
            except OSError:
                pass


def default_spawn(
    argv: list[str],
    env: dict[str, str],
    cwd: str,
) -> ProcessHandle:
    """Start the child: argv list, never a shell, no stdin, own process group."""
    kwargs: dict[str, Any] = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | getattr(
            subprocess, "CREATE_NO_WINDOW", 0
        )
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen(
        argv,
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        cwd=cwd,
        **kwargs,
    )
    return _PopenHandle(process)


# --- audit log --------------------------------------------------------------


class ActionAudit:
    """Append-only operational telemetry; never evidence."""

    def __init__(self, workspace_root: Path, token_id: str) -> None:
        self.path = workspace_root / AUDIT_RELATIVE
        self.token_id = token_id
        self._lock = threading.Lock()

    def append(self, record: dict[str, Any], *, fsync: bool = False) -> None:
        line = json.dumps(
            {"schemaVersion": AUDIT_SCHEMA_VERSION, **record},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fresh = not self.path.exists()
            with open(self.path, "a", encoding="utf-8", newline="\n") as handle:
                handle.write(line + "\n")
                handle.flush()
                if fsync:
                    os.fsync(handle.fileno())
            if fresh:
                try:
                    os.chmod(self.path, 0o600)
                except OSError:
                    pass


# --- jobs -------------------------------------------------------------------


@dataclass
class Job:
    id: str
    action_id: str
    project: str
    argv: list[str]
    display: str
    command_hash: str
    timeout: float
    status: str = "queued"
    started_at: str | None = None
    ended_at: str | None = None
    exit_code: int | None = None
    stdout: bytearray = field(default_factory=bytearray)
    stderr: bytearray = field(default_factory=bytearray)
    truncated: bool = False
    result: dict[str, Any] | None = None
    created_refs: dict[str, str] = field(default_factory=dict)
    cancel_requested: threading.Event = field(default_factory=threading.Event)
    done: threading.Event = field(default_factory=threading.Event)

    def to_dict(self) -> dict[str, Any]:
        state = {
            "queued": "pending",
            "running": "running",
            "succeeded": "done",
            "failed": "failed",
            "cancelled": "skipped",
            "timed-out": "skipped",
        }[self.status]
        return {
            "jobId": self.id,
            "status": self.status,
            "actionId": self.action_id,
            "project": self.project,
            "display": self.display,
            "commandHash": self.command_hash,
            "startedAt": self.started_at,
            "endedAt": self.ended_at,
            "stageMode": "whole-action",
            "stages": [
                {"id": stage_id, "label": label, "state": state}
                for stage_id, label in STAGES
            ],
            "stdoutTail": bytes(self.stdout).decode("utf-8", "replace"),
            "stderrTail": bytes(self.stderr).decode("utf-8", "replace"),
            "truncated": self.truncated,
            "exitCode": self.exit_code,
            "result": self.result,
            "createdRefs": self.created_refs,
        }


def _append_capped(buffer: bytearray, chunk: bytes, cap: int, job: Job) -> None:
    buffer.extend(chunk)
    if len(buffer) > cap:
        del buffer[: len(buffer) - cap]
        job.truncated = True


class JobRunner:
    """Lock-protected job table with one active job per Project."""

    def __init__(
        self,
        audit: ActionAudit,
        *,
        spawn: Callable[[list[str], dict[str, str], str], ProcessHandle] = default_spawn,
        output_cap: int = OUTPUT_CAP_BYTES,
        poll_interval: float = 0.05,
        environment: Callable[[], dict[str, str]] = scrubbed_environment,
    ) -> None:
        self._audit = audit
        self._spawn = spawn
        self._cap = output_cap
        self._poll = poll_interval
        self._environment = environment
        self._lock = threading.Lock()
        self._jobs: dict[str, Job] = {}
        self._order: list[str] = []
        self._active: dict[str, str] = {}

    def active_job(self, project: str) -> str | None:
        with self._lock:
            return self._active.get(project)

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def recent(self) -> list[Job]:
        with self._lock:
            return [self._jobs[item] for item in reversed(self._order)]

    def create(
        self,
        *,
        action_id: str,
        project: str,
        argv: list[str],
        display: str,
        command_hash: str,
        timeout: float,
        cwd: str,
    ) -> Job:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        job = Job(
            id=f"job-{stamp}-{secrets.token_hex(2)}",
            action_id=action_id,
            project=project,
            argv=list(argv),
            display=display,
            command_hash=command_hash,
            timeout=timeout,
        )
        with self._lock:
            active = self._active.get(project)
            if active is not None:
                raise ActionError(
                    409,
                    "studio.busy",
                    f"Project {project} already has active job {active}",
                )
            self._active[project] = job.id
            self._jobs[job.id] = job
            self._order.append(job.id)
            while len(self._order) > MAX_RECENT_JOBS:
                stale = self._order[0]
                if stale in self._active.values():
                    break
                self._order.pop(0)
                self._jobs.pop(stale, None)
        job.started_at = _now()
        try:
            self._audit.append(
                {
                    "event": "started",
                    "jobId": job.id,
                    "actionId": action_id,
                    "argv": job.argv,
                    "commandHash": command_hash,
                    "project": project,
                    "tokenId": self._audit.token_id,
                    "startedAt": job.started_at,
                }
            )
        except OSError as error:
            self._release(job)
            with self._lock:
                self._jobs.pop(job.id, None)
                if job.id in self._order:
                    self._order.remove(job.id)
            raise ActionError(
                500, "studio.audit", f"Cannot write the action audit log: {error}"
            ) from error
        job.status = "running"
        threading.Thread(
            target=self._run, args=(job, cwd), name=job.id, daemon=True
        ).start()
        return job

    def cancel(self, job_id: str) -> Job | None:
        job = self.get(job_id)
        if job is None:
            return None
        if not job.done.is_set():
            job.cancel_requested.set()
            job.done.wait(timeout=20)
        return job

    def _release(self, job: Job) -> None:
        with self._lock:
            if self._active.get(job.project) == job.id:
                del self._active[job.project]

    def _pump(self, stream: Any, buffer: bytearray, job: Job) -> None:
        try:
            while True:
                chunk = stream.read(4096)
                if not chunk:
                    return
                _append_capped(buffer, chunk, self._cap, job)
        except (OSError, ValueError):
            return

    def _run(self, job: Job, cwd: str) -> None:
        status = "failed"
        try:
            handle = self._spawn(job.argv, self._environment(), cwd)
            pumps = [
                threading.Thread(
                    target=self._pump, args=(handle.stdout, job.stdout, job), daemon=True
                ),
                threading.Thread(
                    target=self._pump, args=(handle.stderr, job.stderr, job), daemon=True
                ),
            ]
            for pump in pumps:
                pump.start()
            deadline = time.monotonic() + job.timeout
            outcome = "exited"
            while True:
                try:
                    handle.wait(timeout=self._poll)
                    break
                except subprocess.TimeoutExpired:
                    pass
                if job.cancel_requested.is_set():
                    outcome = "cancelled"
                elif time.monotonic() >= deadline:
                    outcome = "timed-out"
                if outcome != "exited":
                    handle.kill_tree()
                    try:
                        handle.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        pass
                    break
            for pump in pumps:
                pump.join(timeout=5)
            for stream in (handle.stdout, handle.stderr):
                try:
                    stream.close()
                except (OSError, ValueError, AttributeError):
                    pass
            job.exit_code = handle.returncode
            if outcome == "exited":
                status = "succeeded" if handle.returncode == 0 else "failed"
            else:
                status = outcome
            self._extract_result(job)
        except Exception as error:  # spawn failure or runner bug
            _append_capped(
                job.stderr, f"studio runner error: {error}\n".encode(), self._cap, job
            )
            status = "failed"
        finally:
            job.ended_at = _now()
            try:
                self._audit.append(
                    {
                        "event": "finished",
                        "jobId": job.id,
                        "exitCode": job.exit_code,
                        "endedAt": job.ended_at,
                        "status": status,
                        "createdRefs": job.created_refs,
                        "truncated": job.truncated,
                    },
                    fsync=True,
                )
            except OSError:
                pass
            job.status = status
            self._release(job)
            job.done.set()

    @staticmethod
    def _extract_result(job: Job) -> None:
        if job.truncated:
            return
        try:
            envelope = json.loads(bytes(job.stdout).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return
        if not isinstance(envelope, dict):
            return
        job.result = envelope
        data = envelope.get("data")
        experiment = data.get("experiment") if isinstance(data, dict) else None
        if isinstance(experiment, dict):
            refs: dict[str, str] = {}
            if isinstance(experiment.get("id"), str):
                refs["experimentId"] = experiment["id"]
            candidate = experiment.get("candidate")
            if isinstance(candidate, dict) and isinstance(candidate.get("runId"), str):
                refs["runId"] = candidate["runId"]
            job.created_refs = refs


# --- catalog ----------------------------------------------------------------


EVALUATE_ID = "experiment.evaluate"
EVALUATE_TIMEOUT_SECONDS = 15 * 60
EVALUATE_WRITES = (
    "Writes an immutable Experiment and Run into the Project; the Session "
    "verdict (KEEP, REVERT, CRASH) is applied by Core exactly as from a terminal."
)
EXPOSURE_NOTICE = (
    "this run exposes test audit values; later runs will require a fresh "
    "external holdout"
)


def _validation(path: str, code: str, message: str) -> ActionError:
    return ActionError(422, "validation.failed", message, [_issue(path, code, message)])


def validate_evaluate_params(params: Any) -> dict[str, str]:
    if not isinstance(params, dict):
        raise _validation("params", "schema.object", "params must be an object")
    unknown = sorted(set(params) - {"session", "hypothesis"})
    if unknown:
        raise _validation(
            f"params/{unknown[0]}", "schema.unknown-field", f"Unknown parameter: {unknown[0]}"
        )
    session = params.get("session")
    if not isinstance(session, str) or not SESSION_ID.match(session):
        raise _validation(
            "params/session",
            "schema.session-id",
            "session must be a Session id (letters, digits, dot, dash, underscore)",
        )
    hypothesis = params.get("hypothesis")
    if (
        not isinstance(hypothesis, str)
        or not 8 <= len(hypothesis) <= 500
        or CONTROL_CHARACTERS.search(hypothesis)
    ):
        raise _validation(
            "params/hypothesis",
            "schema.hypothesis",
            "hypothesis must be 8 to 500 characters with no control characters",
        )
    if hypothesis.startswith("-") or hypothesis != hypothesis.strip():
        raise _validation(
            "params/hypothesis",
            "schema.hypothesis",
            "hypothesis must not start with '-' or carry surrounding whitespace",
        )
    return {"session": session, "hypothesis": hypothesis}


@dataclass
class Evaluation:
    argv: list[str]
    trial: dict[str, Any]
    fingerprint: str


class ActionService:
    """Everything the HTTP handler needs for the action layer."""

    def __init__(
        self,
        root: Path,
        *,
        scope: str,
        load_projects: Callable[[], dict[str, ProjectContext]],
        fingerprint: Callable[[ProjectContext], str],
        spawn: Callable[[list[str], dict[str, str], str], ProcessHandle] = default_spawn,
        timeouts: dict[str, float] | None = None,
        output_cap: int = OUTPUT_CAP_BYTES,
        poll_interval: float = 0.05,
        environment: Callable[[], dict[str, str]] = scrubbed_environment,
    ) -> None:
        self.root = root
        self.scope = scope
        self.token = secrets.token_urlsafe(32)
        self.token_id = hashlib.sha256(self.token.encode()).hexdigest()[:6]
        self._load_projects = load_projects
        self._fingerprint = fingerprint
        self._timeouts = {EVALUATE_ID: float(EVALUATE_TIMEOUT_SECONDS), **(timeouts or {})}
        self.audit = ActionAudit(root, self.token_id)
        self.runner = JobRunner(
            self.audit,
            spawn=spawn,
            output_cap=output_cap,
            poll_interval=poll_interval,
            environment=environment,
        )
        self.allowed_hosts: set[str] = set()

    # -- request gates -------------------------------------------------------

    def bind_port(self, port: int) -> None:
        self.allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}", f"[::1]:{port}"}

    def host_allowed(self, host: str | None) -> bool:
        return host is not None and host.lower() in self.allowed_hosts

    def origin_allowed(self, origin: str | None, fetch_site: str | None) -> bool:
        if origin is not None:
            return origin.lower() in {f"http://{host}" for host in self.allowed_hosts}
        return fetch_site is None or fetch_site in {"same-origin", "none"}

    def token_valid(self, supplied: str | None) -> bool:
        return supplied is not None and hmac.compare_digest(
            supplied.encode(), self.token.encode()
        )

    def bootstrap(self) -> dict[str, Any]:
        return {
            "enabled": True,
            "token": self.token,
            "tokenHeader": TOKEN_HEADER,
            "catalog": "/api/v1/actions",
        }

    # -- catalog -------------------------------------------------------------

    def _project(self, project_id: Any) -> ProjectContext:
        if not isinstance(project_id, str):
            raise _validation("project", "schema.string", "project must be a Project id")
        projects = self._load_projects()
        project = projects.get(project_id)
        if project is None:
            raise _validation(
                "project", "project.unknown", f"Unknown Project: {project_id}"
            )
        return project

    def _evaluate(self, project: ProjectContext, session_id: str, check_only: bool = False) -> Evaluation:
        known = {item.id: item for item in list_sessions(project)}
        summary = known.get(session_id)
        if summary is None:
            raise _validation(
                "params/session", "session.missing", f"Unknown Session: {session_id}"
            )
        if summary.status != "active":
            raise ActionError(
                409,
                "studio.blocked",
                f"Blocked: Session {session_id} is {summary.status}, not active",
            )
        session = load_session(project, session_id)
        snapshot = session_snapshot(project, session)
        if not snapshot["authority"]["valid"]:
            reasons = "; ".join(
                issue.get("message", "") for issue in snapshot["authority"]["issues"]
            )
            raise ActionError(
                409,
                "studio.blocked",
                f"Blocked: Session {session_id} is stale; run aq session show to see why"
                + (f" ({reasons})" if reasons else ""),
            )
        candidate = snapshot["candidate"]
        if candidate is None or not candidate["differsFromLeader"]:
            raise ActionError(
                409,
                "studio.blocked",
                f"Blocked: Session {session_id} candidate does not differ from the leader",
            )
        integrity = snapshot["selectionIntegrity"]
        family = integrity["researchFamily"]
        adjustment = integrity.get("selectionAdjustment")
        n = integrity["candidateTrials"] + 1
        trial = {
            "n": n,
            "m": family["uniqueSourceTrials"] + 1,
            "sessionTrial": n,
            "familyId": family["id"],
            "adjustment": adjustment,
            "testExposureState": integrity["testExposureState"],
            "externalHoldoutRequired": integrity["externalHoldoutRequired"],
            "notice": EXPOSURE_NOTICE,
        }
        return Evaluation([], trial, self._fingerprint(project))

    def _argv(self, project_id: str, params: dict[str, str]) -> list[str]:
        argv = [
            sys.executable,
            "-m",
            "autoquant",
            "experiment",
            "evaluate",
            str(self.root),
        ]
        if self.scope == "workspace":
            argv += ["--project", project_id]
        argv += [
            "--session",
            params["session"],
            "--hypothesis",
            params["hypothesis"],
            "--json",
        ]
        return argv

    @staticmethod
    def command_hash(action_id: str, project: str, argv: list[str], fingerprint: str) -> str:
        canonical = json.dumps(
            {
                "actionId": action_id,
                "project": project,
                "argv": argv,
                "stateFingerprint": fingerprint,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return "sha256:" + hashlib.sha256(canonical.encode()).hexdigest()

    def catalog(self, project_id: str | None = None) -> dict[str, Any]:
        projects = self._load_projects()
        if project_id is not None and project_id not in projects:
            raise _validation("project", "project.unknown", f"Unknown Project: {project_id}")
        targets: list[dict[str, Any]] = []
        for pid, project in projects.items():
            if project_id is not None and pid != project_id:
                continue
            sessions = []
            for summary in list_sessions(project):
                if summary.status != "active":
                    continue
                entry: dict[str, Any] = {"session": summary.id, "available": True, "blockedBy": None}
                try:
                    self._evaluate(project, summary.id)
                except ActionError as error:
                    entry["available"] = False
                    entry["blockedBy"] = error.message
                except AutoQuantValidationError as error:
                    entry["available"] = False
                    entry["blockedBy"] = str(error)
                sessions.append(entry)
            targets.append(
                {
                    "project": pid,
                    "activeJob": self.runner.active_job(pid),
                    "sessions": sessions,
                }
            )
        return {
            "actions": [
                {
                    "id": EVALUATE_ID,
                    "label": "Run analysis",
                    "classification": "writes-immutable-evidence",
                    "writes": EVALUATE_WRITES,
                    "command": "aq experiment evaluate",
                    "timeoutSeconds": self._timeouts[EVALUATE_ID],
                    "requiresSecondConfirm": True,
                    "params": {
                        "session": {"type": "string", "pattern": SESSION_ID.pattern},
                        "hypothesis": {
                            "type": "string",
                            "minLength": 8,
                            "maxLength": 500,
                        },
                    },
                    "targets": targets,
                }
            ]
        }

    # -- preview / create ----------------------------------------------------

    def _prepare(self, body: Any) -> tuple[ProjectContext, str, dict[str, str], Evaluation, list[str]]:
        if not isinstance(body, dict):
            raise _validation("body", "schema.object", "Request body must be an object")
        action_id = body.get("actionId")
        if action_id != EVALUATE_ID:
            raise ActionError(404, "studio.unknown-action", f"Unknown action: {action_id!r}")
        project = self._project(body.get("project"))
        params = validate_evaluate_params(body.get("params"))
        evaluation = self._evaluate(project, params["session"])
        argv = self._argv(project.manifest.id, params)
        evaluation.argv = argv
        return project, action_id, params, evaluation, argv

    def preview(self, body: Any) -> dict[str, Any]:
        project, action_id, params, evaluation, argv = self._prepare(body)
        from shlex import join

        return {
            "actionId": action_id,
            "project": project.manifest.id,
            "params": params,
            "argv": argv,
            "display": join(argv),
            "commandHash": self.command_hash(
                action_id, project.manifest.id, argv, evaluation.fingerprint
            ),
            "writes": EVALUATE_WRITES,
            "trial": evaluation.trial,
            "requiresSecondConfirm": True,
            "timeoutSeconds": self._timeouts[action_id],
        }

    def create(self, body: Any) -> dict[str, Any]:
        project, action_id, params, evaluation, argv = self._prepare(body)
        if body.get("confirm") is not True:
            raise ActionError(400, "studio.confirm-required", "confirm must be true")
        expected = self.command_hash(
            action_id, project.manifest.id, argv, evaluation.fingerprint
        )
        supplied = body.get("commandHash")
        if not isinstance(supplied, str) or not hmac.compare_digest(
            supplied.encode(), expected.encode()
        ):
            raise ActionError(
                409,
                "studio.stale-preview",
                "The command or Project state changed since the preview; preview again",
            )
        if body.get("secondConfirm") is not True:
            raise ActionError(
                400,
                "studio.second-confirm-required",
                "secondConfirm must be true for this action",
            )
        from shlex import join

        job = self.runner.create(
            action_id=action_id,
            project=project.manifest.id,
            argv=argv,
            display=join(argv),
            command_hash=expected,
            timeout=self._timeouts[action_id],
            cwd=str(self.root),
        )
        return {"jobId": job.id, "status": job.status, "commandHash": expected}


def success(data: Any) -> dict[str, Any]:
    return {"schemaVersion": SCHEMA_VERSION, "ok": True, "data": data}


def failure(error: ActionError) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "ok": False,
        "error": {
            "code": error.code,
            "message": error.message,
            "issues": [issue.to_dict() for issue in error.issues],
        },
    }
