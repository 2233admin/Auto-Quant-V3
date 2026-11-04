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
import stat
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator, Protocol

from .runs import list_runs, load_run
from .selection import build_research_family, family_trial_count, inheritance_projection
from .sessions import (
    SessionContext,
    list_sessions,
    load_session,
    session_snapshot,
)
from .studies import STUDY_ID, load_study, path_matches_pattern
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
MAX_BODY_BYTES = 1024 * 1024
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
START_STAGES = (
    ("preflight", "candidate preflight"),
    ("baseline-run", "baseline run"),
    ("session-created", "session created"),
)
CHECK_STAGES = (("candidate-check", "candidate preflight"),)
CANDIDATE_RELATIVE = "factors/candidate.py"
CANDIDATE_SAVE_MAX_BYTES = 200_000
CANDIDATE_READ_MAX_BYTES = 1024 * 1024
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")


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
    stages: tuple[tuple[str, str], ...] | None = None
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
                for stage_id, label in (
                    self.stages or STAGES_BY_ACTION.get(self.action_id, STAGES)
                )
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
        project_lease: Callable[[str], Any] | None = None,
    ) -> None:
        self._audit = audit
        self._spawn = spawn
        self._cap = output_cap
        self._poll = poll_interval
        self._environment = environment
        self._project_lease = project_lease
        self._leases: dict[str, Any] = {}
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
        audit_fields: dict[str, Any] | None = None,
        stages: tuple[tuple[str, str], ...] | None = None,
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
            stages=stages,
        )
        with self._lock:
            active = self._active.get(project)
            if active is not None:
                raise ActionError(
                    409,
                    "studio.busy",
                    f"Project {project} already has active job {active}",
                )
            if self._project_lease is not None:
                self._leases[project] = self._project_lease(project)
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
                    **(audit_fields or {}),
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

    @contextmanager
    def hold(self, project: str) -> Iterator[None]:
        """Reserve the Project's job slot for a short in-process write."""
        marker = f"hold-{secrets.token_hex(3)}"
        with self._lock:
            active = self._active.get(project)
            if active is not None:
                raise ActionError(
                    409,
                    "studio.busy",
                    f"Project {project} already has active job {active}",
                )
            if self._project_lease is not None:
                self._leases[project] = self._project_lease(project)
            self._active[project] = marker
        try:
            yield
        finally:
            with self._lock:
                if self._active.get(project) == marker:
                    lease = self._leases.pop(project, None)
                    if lease is not None:
                        lease.close()
                    del self._active[project]

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
                lease = self._leases.pop(job.project, None)
                if lease is not None:
                    lease.close()
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
        if isinstance(data, dict) and job.action_id == BUILD_ID and "lineage" in data:
            if isinstance(data.get("projectId"), str):
                job.created_refs = {"projectId": data["projectId"]}
            return
        if isinstance(data, dict) and job.action_id in {START_ID, BUILD_ID}:
            refs: dict[str, str] = {}
            session = data.get("session")
            if isinstance(session, dict):
                if isinstance(session.get("id"), str):
                    refs["sessionId"] = session["id"]
                baseline = session.get("baseline")
                if isinstance(baseline, dict) and isinstance(
                    baseline.get("runId"), str
                ):
                    refs["runId"] = baseline["runId"]
            job.created_refs = refs
            return
        if isinstance(data, dict) and job.action_id == CHECK_ID:
            if isinstance(data.get("id"), str):
                job.created_refs = {"checkId": data["id"]}
            return
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


START_ID = "session.start"
CHECK_ID = "session.check"
SAVE_ID = "candidate.save"
BUILD_ID = "strategy.build"
START_TIMEOUT_SECONDS = 15 * 60
CHECK_TIMEOUT_SECONDS = 10 * 60
START_WRITES = (
    "Creates a Session, its worktree and a baseline Run (immutable evidence) "
    "and opens a trial family; Core applies the same rules as from a terminal."
)
CHECK_WRITES = (
    "Writes an immutable non-selection Candidate Check record into the "
    "Session; it spends no trial and has no selection, promotion, or "
    "trading authority."
)
SAVE_WRITES = (
    "Replaces factors/candidate.py in the Session worktree. Spends no trial "
    "and creates no evidence; the next Check or Run analysis evaluates the "
    "saved bytes."
)
START_NOTICE = (
    "starting a Session opens a trial family; the baseline Run counts as one "
    "source trial unless an identical successful one is reused"
)
SAVE_CONFLICT = "The candidate on disk changed since it was loaded; reload before saving"
STAGES_BY_ACTION = {START_ID: START_STAGES, BUILD_ID: START_STAGES, CHECK_ID: CHECK_STAGES,
                    "project.create": (("project-created", "Project created"),),
                    "project.intake": (("dataset-bound", "Dataset bound"),)}
ACTION_ORDER = (EVALUATE_ID, START_ID, CHECK_ID, SAVE_ID)
ACTION_SPECS: dict[str, dict[str, Any]] = {
    BUILD_ID: {
        "label": "Build strategy",
        "classification": "writes-immutable-evidence",
        "writes": "Starts the existing research-desk Portfolio Study in a governed Session; a new baseline counts unless reused. No Project conversion or new Study.",
        "command": "aq session start",
        "second": True,
    },
    EVALUATE_ID: {
        "label": "Run analysis",
        "classification": "writes-immutable-evidence",
        "writes": EVALUATE_WRITES,
        "command": "aq experiment evaluate",
        "second": True,
    },
    START_ID: {
        "label": "Start Session",
        "classification": "writes-immutable-evidence",
        "writes": START_WRITES,
        "command": "aq session start",
        "second": True,
    },
    CHECK_ID: {
        "label": "Check candidate",
        "classification": "writes-immutable-evidence",
        "writes": CHECK_WRITES,
        "command": "aq session check",
        "second": False,
    },
    SAVE_ID: {
        "label": "Save candidate",
        "classification": "writes-working-file",
        "writes": SAVE_WRITES,
        "command": None,
        "second": False,
    },
}


def validate_session_param(params: dict[str, Any]) -> str:
    session = params.get("session")
    if not isinstance(session, str) or not SESSION_ID.match(session):
        raise _validation(
            "params/session",
            "schema.session-id",
            "session must be a Session id (letters, digits, dot, dash, underscore)",
        )
    return session


def _params_object(params: Any, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(params, dict):
        raise _validation("params", "schema.object", "params must be an object")
    unknown = sorted(set(params) - allowed)
    if unknown:
        raise _validation(
            f"params/{unknown[0]}",
            "schema.unknown-field",
            f"Unknown parameter: {unknown[0]}",
        )
    return params


def validate_check_params(params: Any) -> dict[str, str]:
    params = _params_object(params, {"session"})
    return {"session": validate_session_param(params)}


def validate_start_params(params: Any) -> dict[str, str]:
    params = _params_object(params, {"study", "request"})
    study = params.get("study")
    if not isinstance(study, str) or len(study) > 64 or not STUDY_ID.fullmatch(study):
        raise _validation(
            "params/study",
            "schema.study-id",
            "study must be a Study id (lowercase letters, digits, dashes)",
        )
    clean = {"study": study}
    if "request" in params:
        request = params["request"]
        if (
            not isinstance(request, str)
            or not request
            or len(request) > 1024
            or CONTROL_CHARACTERS.search(request)
        ):
            raise _validation(
                "params/request",
                "schema.request",
                "request must be a file path of at most 1024 characters",
            )
        clean["request"] = request
    return clean


def validate_save_params(params: Any) -> dict[str, str]:
    params = _params_object(params, {"session", "source", "baseSha256"})
    session = validate_session_param(params)
    source = params.get("source")
    if not isinstance(source, str) or not source or "\x00" in source:
        raise _validation(
            "params/source",
            "schema.source",
            "source must be non-empty text without NUL characters",
        )
    try:
        encoded = source.encode("utf-8")
    except UnicodeEncodeError:
        raise _validation(
            "params/source", "schema.source", "source must be valid UTF-8 text"
        ) from None
    if len(encoded) > CANDIDATE_SAVE_MAX_BYTES:
        raise _validation(
            "params/source",
            "schema.source-size",
            f"source must be at most {CANDIDATE_SAVE_MAX_BYTES} bytes as UTF-8",
        )
    base = params.get("baseSha256")
    if not isinstance(base, str) or not SHA256_HEX.match(base):
        raise _validation(
            "params/baseSha256",
            "schema.base-sha256",
            "baseSha256 must be 64 lowercase hex characters",
        )
    return {"session": session, "source": source, "baseSha256": base}


# --- candidate file ----------------------------------------------------------


def _is_link(path: Path) -> bool:
    """True for a symlink or a Windows junction/reparse point."""
    try:
        info = os.lstat(path)
    except OSError:
        return False
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & 0x400
    )


def locate_candidate(session: SessionContext) -> tuple[Path, str | None]:
    """Return the candidate path and a problem text when it is not a plain file."""
    root = session.worktree_project.root_dir
    target = root / "factors" / "candidate.py"
    problem = (
        f"Blocked: {CANDIDATE_RELATIVE} in the Session worktree is missing, "
        "a symlink or junction, or not a regular file"
    )
    for part in (root, root / "factors", target):
        if _is_link(part):
            return target, problem
    try:
        if not stat.S_ISREG(os.lstat(target).st_mode):
            return target, problem
    except OSError:
        return target, problem
    try:
        resolved = confine_workspace_path(root, CANDIDATE_RELATIVE, "candidate")
    except ActionError:
        raise _validation(
            "candidate", "candidate.path", "Candidate path escapes the Session worktree"
        ) from None
    if resolved != (root.resolve() / "factors" / "candidate.py"):
        raise _validation(
            "candidate", "candidate.path", "Candidate path escapes the Session worktree"
        )
    return resolved, None


def _sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _display_path(path: Path, root: Path, project: ProjectContext) -> str:
    for base in (root, project.root_dir):
        try:
            return path.resolve().relative_to(base.resolve()).as_posix()
        except ValueError:
            continue
    return path.resolve().as_posix()


def session_gate(
    project: ProjectContext, session_id: str
) -> tuple[SessionContext, dict[str, Any]]:
    """Load an active, non-stale Session or raise the shared blocked reason."""
    known = {item.id: item for item in list_sessions(project)}
    summary = known.get(session_id)
    if summary is None:
        raise _validation("params/session", "session.missing", f"Unknown Session: {session_id}")
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
    return session, snapshot


def candidate_write_block(session: SessionContext) -> str | None:
    """Blocked reason for writing the candidate, assuming an active valid Session."""
    if not any(
        path_matches_pattern(CANDIDATE_RELATIVE, pattern)
        for pattern in session.manifest["editablePaths"]
    ):
        return (
            f"Blocked: {CANDIDATE_RELATIVE} is not in the editable closure of "
            f"Session {session.manifest['id']}"
        )
    return locate_candidate(session)[1]


def candidate_view(
    project: ProjectContext,
    session_id: str,
    root: Path,
    service: "ActionService | None",
) -> dict[str, Any]:
    """Read-only candidate payload for GET /api/v1/candidate."""
    if session_id == "canonical":
        # Inspect a Project with retained Runs but no Session; this never opens a write path.
        path = confine_workspace_path(project.root_dir, CANDIDATE_RELATIVE, "candidate")
        if _is_link(project.root_dir / "factors") or _is_link(path) or not path.is_file():
            raise ActionError(404, "studio.candidate-missing", "Canonical candidate is missing or linked")
        if path.stat().st_size > CANDIDATE_READ_MAX_BYTES:
            raise ActionError(413, "candidate.too-large", "Canonical candidate exceeds the read limit")
        raw = path.read_bytes()
        try:
            source = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise ActionError(422, "candidate.not-utf8", "Canonical candidate is not valid UTF-8") from None
        return {"project": project.manifest.id, "session": None, "path": _display_path(path, root, project),
                "source": source, "sha256": _sha256(raw), "bytes": len(raw), "editable": False,
                "blockedReason": "Canonical candidate is read-only after retained Runs; start a Session to edit."}
    if not isinstance(session_id, str) or not SESSION_ID.match(session_id):
        raise _validation(
            "session",
            "schema.session-id",
            "session must be a Session id (letters, digits, dot, dash, underscore)",
        )
    known = {item.id: item for item in list_sessions(project)}
    summary = known.get(session_id)
    if summary is None:
        raise _validation("session", "session.missing", f"Unknown Session: {session_id}")
    session = load_session(project, session_id)
    path, problem = locate_candidate(session)
    if problem is not None:
        raise ActionError(404, "studio.candidate-missing", problem)
    if path.stat().st_size > CANDIDATE_READ_MAX_BYTES:
        raise ActionError(
            413,
            "candidate.too-large",
            f"{CANDIDATE_RELATIVE} is larger than {CANDIDATE_READ_MAX_BYTES} bytes",
        )
    raw = path.read_bytes()
    try:
        source = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise ActionError(
            422, "candidate.not-utf8", f"{CANDIDATE_RELATIVE} is not valid UTF-8"
        ) from None
    blocked: str | None = None
    if service is None:
        blocked = (
            "Blocked: Studio is read-only; restart with --allow-actions to "
            "edit the candidate"
        )
    else:
        try:
            session_gate(project, session_id)
            blocked = candidate_write_block(session)
        except ActionError as error:
            blocked = error.message
        except AutoQuantValidationError as error:
            blocked = f"Blocked: {error}"
        if blocked is None and len(raw) > CANDIDATE_SAVE_MAX_BYTES:
            blocked = (
                f"Blocked: candidate.py is larger than {CANDIDATE_SAVE_MAX_BYTES} bytes"
            )
        if blocked is None:
            active = service.runner.active_job(project.manifest.id)
            if active is not None:
                blocked = (
                    f"Blocked: Project {project.manifest.id} already has active job {active}"
                )
    return {
        "project": project.manifest.id,
        "session": session_id,
        "path": _display_path(path, root, project),
        "source": source,
        "sha256": _sha256(raw),
        "bytes": len(raw),
        "editable": blocked is None,
        "blockedReason": blocked,
    }


@dataclass
class Evaluation:
    argv: list[str]
    trial: dict[str, Any]
    fingerprint: str


@dataclass
class Prepared:
    project: ProjectContext
    action_id: str
    params: dict[str, Any]
    argv: list[str]
    fingerprint: str
    trial: dict[str, Any] | None


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
        self._idea_launch_lock = threading.Lock()
        self._timeouts = {
            BUILD_ID: float(START_TIMEOUT_SECONDS),
            EVALUATE_ID: float(EVALUATE_TIMEOUT_SECONDS),
            START_ID: float(START_TIMEOUT_SECONDS),
            CHECK_ID: float(CHECK_TIMEOUT_SECONDS),
            **(timeouts or {}),
        }
        self.audit = ActionAudit(root, self.token_id)
        self.runner = JobRunner(
            self.audit,
            spawn=spawn,
            output_cap=output_cap,
            poll_interval=poll_interval,
            environment=environment,
            project_lease=self._project_lease,
        )
        self.allowed_hosts: set[str] = set()

    def _project_lease(self, identity: str):
        from .project_leases import LeaseBusy, acquire_file_lease
        project = self._load_projects().get(identity)
        root = project.root_dir if project is not None else self.root
        try:
            return acquire_file_lease(root / ".autoquant" / "studio-research.lock", root)
        except LeaseBusy:
            raise ActionError(409, "studio.busy",
                              "Another Studio job or candidate writer owns this Project") from None

    @staticmethod
    def _strategy():
        # Lazy: studio_strategy imports this module at load time.
        from . import studio_strategy

        return studio_strategy

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

    def candidate(self, project_id: Any, session_id: Any) -> dict[str, Any]:
        if session_id == "initial":
            from .studio_ideas import initial_candidate
            return initial_candidate(self, self._project(project_id))
        return candidate_view(self._project(project_id), session_id, self.root, self)

    def _evaluate(self, project: ProjectContext, session_id: str, check_only: bool = False) -> Evaluation:
        session_id_ = session_id
        _, snapshot = session_gate(project, session_id_)
        return self._evaluation_from(project, session_id_, snapshot)

    def _evaluation_from(
        self, project: ProjectContext, session_id: str, snapshot: dict[str, Any]
    ) -> Evaluation:
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
            "m": family_trial_count(family) + 1,
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
            # Studio's per-trial confirmation is the human acknowledgement the
            # Core trial gate requires; Core still enforces budget/declaration.
            "--confirm-trial",
            "--json",
        ]
        return argv

    def _base_argv(self, group: str, verb: str, project_id: str) -> list[str]:
        argv = [sys.executable, "-m", "autoquant", group, verb, str(self.root)]
        if self.scope == "workspace":
            argv += ["--project", project_id]
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

    def _start_block(self, project: ProjectContext, study_id: str) -> None:
        for item in list_sessions(project):
            if item.status == "active" and item.study_id == study_id:
                # A stale Session is retained evidence, but cannot be edited again.
                # Core can start a fresh Session without rewriting or deleting it.
                prior = session_snapshot(project, load_session(project, item.id))
                if not prior["authority"]["valid"]:
                    continue
                raise ActionError(
                    409,
                    "studio.blocked",
                    f"Blocked: Study {study_id} already has active Session {item.id}",
                )
        study = load_study(project, study_id)
        if not study.definition.editable["paths"]:
            raise ActionError(
                409,
                "studio.blocked",
                f"Blocked: Study {study_id} has no editable research surface "
                "and does not support iterative Sessions",
            )

    def _study_ids(self, project: ProjectContext) -> list[str]:
        from .studies import list_studies

        return [item.id for item in list_studies(project)]

    def _start_trial(self, project: ProjectContext, study_id: str) -> dict[str, Any]:
        runs = list_runs(project, study_id)
        family_id: str | None = None
        inheritance = inheritance_projection(project)
        inherited = inheritance["inheritedSourceTrials"] if inheritance else 0
        count = inherited
        if runs:
            latest = max(runs, key=lambda item: (item.started_at, item.id))
            projection = build_research_family(
                project, load_run(project, latest.id)
            ).projection
            family_id = projection["id"]
            count = family_trial_count(projection)
        trial = {
            "studyId": study_id,
            "familyId": family_id,
            "currentFamilyTrials": count,
            "n": count + 1,
            "m": count + 1,
            "notice": START_NOTICE,
        }
        if inheritance is not None:
            trial["inheritedSourceTrials"] = inherited
            trial["inheritedFrom"] = inheritance["sourceProjectId"]
        return trial

    def catalog(self, project_id: str | None = None) -> dict[str, Any]:
        projects = self._load_projects()
        if project_id is not None and project_id not in projects:
            raise _validation("project", "project.unknown", f"Unknown Project: {project_id}")
        targets: dict[str, list[dict[str, Any]]] = {key: [] for key in ACTION_ORDER}
        for pid, project in projects.items():
            if project_id is not None and pid != project_id:
                continue
            active = self.runner.active_job(pid)
            evaluate: list[dict[str, Any]] = []
            check: list[dict[str, Any]] = []
            save: list[dict[str, Any]] = []
            for summary in list_sessions(project):
                if summary.status != "active":
                    continue
                entries = {
                    key: {"session": summary.id, "available": True, "blockedBy": None}
                    for key in (EVALUATE_ID, CHECK_ID, SAVE_ID)
                }
                try:
                    session, snapshot = session_gate(project, summary.id)
                except ActionError as error:
                    for entry in entries.values():
                        entry["available"] = False
                        entry["blockedBy"] = error.message
                except AutoQuantValidationError as error:
                    for entry in entries.values():
                        entry["available"] = False
                        entry["blockedBy"] = str(error)
                else:
                    try:
                        self._evaluation_from(project, summary.id, snapshot)
                    except ActionError as error:
                        for key in (EVALUATE_ID, CHECK_ID):
                            entries[key]["available"] = False
                            entries[key]["blockedBy"] = error.message
                    try:
                        blocked = candidate_write_block(session)
                    except ActionError as error:
                        blocked = error.message
                    if blocked is None and active is not None:
                        blocked = f"Blocked: Project {pid} already has active job {active}"
                    if blocked is not None:
                        entries[SAVE_ID]["available"] = False
                        entries[SAVE_ID]["blockedBy"] = blocked
                evaluate.append(entries[EVALUATE_ID])
                check.append(entries[CHECK_ID])
                save.append(entries[SAVE_ID])
            studies: list[dict[str, Any]] = []
            try:
                study_ids = self._study_ids(project)
            except AutoQuantValidationError:
                study_ids = []
            for study_id in study_ids:
                entry = {"study": study_id, "available": True, "blockedBy": None}
                try:
                    self._start_block(project, study_id)
                except ActionError as error:
                    entry["available"] = False
                    entry["blockedBy"] = error.message
                except AutoQuantValidationError as error:
                    entry["available"] = False
                    entry["blockedBy"] = str(error)
                studies.append(entry)
            targets[EVALUATE_ID].append({"project": pid, "activeJob": active, "sessions": evaluate})
            targets[CHECK_ID].append({"project": pid, "activeJob": active, "sessions": check})
            targets[SAVE_ID].append({"project": pid, "activeJob": active, "sessions": save})
            targets[START_ID].append({"project": pid, "activeJob": active, "studies": studies})
        schemas: dict[str, dict[str, Any]] = {
            EVALUATE_ID: {
                "session": {"type": "string", "pattern": SESSION_ID.pattern},
                "hypothesis": {"type": "string", "minLength": 8, "maxLength": 500},
            },
            START_ID: {
                "study": {"type": "string", "pattern": STUDY_ID.pattern, "maxLength": 64},
                "request": {"type": "string", "optional": True, "maxLength": 1024},
            },
            CHECK_ID: {"session": {"type": "string", "pattern": SESSION_ID.pattern}},
            SAVE_ID: {
                "session": {"type": "string", "pattern": SESSION_ID.pattern},
                "source": {
                    "type": "string",
                    "minLength": 1,
                    "maxBytes": CANDIDATE_SAVE_MAX_BYTES,
                },
                "baseSha256": {"type": "string", "pattern": SHA256_HEX.pattern},
            },
        }
        actions = []
        for action_id in ACTION_ORDER:
            spec = ACTION_SPECS[action_id]
            actions.append(
                {
                    "id": action_id,
                    "label": spec["label"],
                    "classification": spec["classification"],
                    "writes": spec["writes"],
                    "command": spec["command"],
                    "timeoutSeconds": self._timeouts.get(action_id),
                    "requiresSecondConfirm": spec["second"],
                    "params": schemas[action_id],
                    "targets": targets[action_id],
                }
            )
        actions.append(self._strategy().catalog_entry(self, {pid: project for pid, project in projects.items()
                                           if project_id is None or pid == project_id}))
        if self.scope == "workspace" and project_id is None:
            actions.extend([
                {"id": "project.create", "label": "New idea", "command": "aq project create",
                 "classification": "writes-working-file", "writes": "Creates a dedicated Project with its question.",
                 "requiresSecondConfirm": False, "timeoutSeconds": 120, "targets": [],
                 "params": {"id": {"type": "string"}, "name": {"type": "string"},
                            "description": {"type": "string", "minLength": 8, "maxLength": 500},
                            "template": {"enum": ["blank", "ohlcv-factor-lab"]}}},
                {"id": "project.intake", "label": "Bind staged dataset", "command": "aq project intake",
                 "classification": "writes-working-file", "writes": "Binds staged data through strict Core intake; raw CSV packaging is V1.",
                 "requiresSecondConfirm": True, "timeoutSeconds": 120, "targets": [],
                 "params": {"source": {"type": "string"}, "options": {"type": "object"}, "dataset": {"type": "string"}, "horizon": {"type": "integer", "minimum": 1, "maximum": 60},
                            "predictionAssets": {"type": "array"}}},
                {"id": "data.check", "label": "Check staged data", "command": "aq data check",
                 "classification": "read-only", "writes": "None", "requiresSecondConfirm": False,
                 "confirmationRequired": False, "timeoutSeconds": 120, "targets": [],
                 "params": {"source": {"type": "string"}, "options": {"type": "object"}}},
            ])
        return {"actions": actions}

    # -- preview / create ----------------------------------------------------

    def _prepare(self, body: Any) -> Prepared:
        if not isinstance(body, dict):
            raise _validation("body", "schema.object", "Request body must be an object")
        action_id = body.get("actionId")
        if action_id == BUILD_ID:
            return self._strategy().prepare_build(self, body)
        if action_id not in {EVALUATE_ID, START_ID, CHECK_ID}:
            raise ActionError(404, "studio.unknown-action", f"Unknown action: {action_id!r}")
        project = self._project(body.get("project"))
        pid = project.manifest.id
        if action_id == EVALUATE_ID:
            params = validate_evaluate_params(body.get("params"))
            evaluation = self._evaluate(project, params["session"])
            _studio_trial_gate(project, load_session(project, params["session"]).manifest["studyId"])
            return Prepared(
                project, action_id, params, self._argv(pid, params),
                evaluation.fingerprint, evaluation.trial,
            )
        if action_id == CHECK_ID:
            params = validate_check_params(body.get("params"))
            session_gate_result = session_gate(project, params["session"])
            self._evaluation_from(project, params["session"], session_gate_result[1])
            argv = self._base_argv("session", "check", pid) + [
                "--session", params["session"], "--json",
            ]
            return Prepared(project, action_id, params, argv, self._fingerprint(project), None)
        params = validate_start_params(body.get("params"))
        if params["study"] not in self._study_ids(project):
            raise _validation(
                "params/study", "study.missing", f"Unknown Study: {params['study']}"
            )
        self._start_block(project, params["study"])
        _studio_trial_gate(project, params["study"])
        argv = self._base_argv("session", "start", pid) + ["--study", params["study"], "--confirm-trial"]
        if "request" in params:
            request = confine_workspace_path(self.root, params["request"], "params/request")
            if not request.is_file():
                raise _validation(
                    "params/request", "path.missing", "request must be an existing file"
                )
            argv += ["--request", str(request)]
        argv.append("--json")
        return Prepared(
            project, action_id, params, argv, self._fingerprint(project),
            self._start_trial(project, params["study"]),
        )

    def preview(self, body: Any) -> dict[str, Any]:
        strategy = self._strategy()
        if strategy.conversion_requested(self, body):
            return strategy.preview_conversion(self, body)
        if isinstance(body, dict) and body.get("actionId") == "data.check":
            from .studio_data import check_preview
            return check_preview(self, body)
        if isinstance(body, dict) and body.get("actionId") == "project.intake" and isinstance(body.get("params"), dict) and "source" in body["params"]:
            from .studio_data import prepare_intake
            return prepare_intake(self, body)
        if isinstance(body, dict) and body.get("actionId") in {"project.create", "project.intake"}:
            from .studio_ideas import prepare
            return prepare(self, body)
        if isinstance(body, dict) and body.get("actionId") == SAVE_ID:
            return self._save_preview(body)
        prepared = self._prepare(body)
        from shlex import join

        spec = ACTION_SPECS[prepared.action_id]
        return {
            "actionId": prepared.action_id,
            "project": prepared.project.manifest.id,
            "params": prepared.params,
            "argv": prepared.argv,
            "display": join(prepared.argv),
            "commandHash": self.command_hash(
                prepared.action_id,
                prepared.project.manifest.id,
                prepared.argv,
                prepared.fingerprint,
            ),
            "writes": spec["writes"],
            "trial": prepared.trial,
            "requiresSecondConfirm": spec["second"],
            "timeoutSeconds": self._timeouts[prepared.action_id],
        }

    def create(self, body: Any) -> dict[str, Any]:
        strategy = self._strategy()
        if strategy.conversion_requested(self, body):
            with self._idea_launch_lock:
                return strategy.launch_conversion(self, body)
        if isinstance(body, dict) and body.get("actionId") == "data.check":
            from .studio_data import data_check
            return data_check(self, body)
        if isinstance(body, dict) and body.get("actionId") == "project.intake" and isinstance(body.get("params"), dict) and "source" in body["params"]:
            from .studio_data import launch_intake
            with self._idea_launch_lock:
                return launch_intake(self, body)
        if isinstance(body, dict) and body.get("actionId") in {"project.create", "project.intake"}:
            from .studio_ideas import launch
            with self._idea_launch_lock:
                return launch(self, body)
        if isinstance(body, dict) and body.get("actionId") == SAVE_ID:
            if isinstance(body.get("params"), dict) and body["params"].get("session") == "initial":
                from .studio_ideas import save_initial
                return save_initial(self, body)
            return self.save_candidate(body)
        prepared = self._prepare(body)
        project, action_id, argv = prepared.project, prepared.action_id, prepared.argv
        active = self.runner.active_job(project.manifest.id)
        if active is not None:
            raise ActionError(409, "studio.busy",
                              f"Project {project.manifest.id} already has active job {active}")
        if body.get("confirm") is not True:
            raise ActionError(400, "studio.confirm-required", "confirm must be true")
        expected = self.command_hash(
            action_id, project.manifest.id, argv, prepared.fingerprint
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
        if ACTION_SPECS[action_id]["second"] and body.get("secondConfirm") is not True:
            raise ActionError(
                400,
                "studio.second-confirm-required",
                "secondConfirm must be true for this action",
            )
        from shlex import join

        from .studio_ideas import binding
        job = self.runner.create(
            action_id=action_id,
            project=project.manifest.id,
            argv=argv,
            display=join(argv),
            command_hash=expected,
            timeout=self._timeouts[action_id],
            cwd=str(self.root),
            audit_fields=binding(self, project, prepared.params.get("hypothesis")),
        )
        return {"jobId": job.id, "status": job.status, "commandHash": expected}

    # -- candidate.save ------------------------------------------------------

    def _save_target(
        self, body: dict[str, Any], *, check_busy: bool
    ) -> tuple[ProjectContext, dict[str, str], SessionContext, Path, bytes]:
        project = self._project(body.get("project"))
        params = validate_save_params(body.get("params"))
        session, _ = session_gate(project, params["session"])
        blocked = candidate_write_block(session)
        if blocked is not None:
            raise ActionError(409, "studio.blocked", blocked)
        if check_busy:
            active = self.runner.active_job(project.manifest.id)
            if active is not None:
                raise ActionError(
                    409,
                    "studio.busy",
                    f"Project {project.manifest.id} already has active job {active}",
                )
        path, _ = locate_candidate(session)
        raw = path.read_bytes()
        if _sha256(raw) != params["baseSha256"]:
            raise ActionError(
                409,
                "studio.conflict",
                SAVE_CONFLICT,
                [_issue("params/baseSha256", "candidate.conflict", SAVE_CONFLICT)],
            )
        return project, params, session, path, raw

    def _save_preview(self, body: dict[str, Any]) -> dict[str, Any]:
        project, params, _, path, raw = self._save_target(body, check_busy=True)
        encoded = params["source"].encode("utf-8")
        display = _display_path(path, self.root, project)
        return {
            "actionId": SAVE_ID,
            "project": project.manifest.id,
            "params": {
                "session": params["session"],
                "baseSha256": params["baseSha256"],
                "sourceBytes": len(encoded),
                "sourceSha256": _sha256(encoded),
            },
            "argv": None,
            "display": f"write {display}",
            "commandHash": None,
            "writes": SAVE_WRITES,
            "requiresSecondConfirm": False,
            "file": {
                "path": display,
                "currentSha256": _sha256(raw),
                "currentBytes": len(raw),
                "newSha256": _sha256(encoded),
                "newBytes": len(encoded),
                "changed": encoded != raw,
            },
        }

    def save_candidate(self, body: dict[str, Any]) -> dict[str, Any]:
        if body.get("confirm") is not True:
            raise ActionError(400, "studio.confirm-required", "confirm must be true")
        pid = self._project(body.get("project")).manifest.id
        with self.runner.hold(pid):
            project, params, _, path, raw = self._save_target(body, check_busy=False)
            encoded = params["source"].encode("utf-8")
            changed = encoded != raw
            display = _display_path(path, self.root, project)
            save_id = f"save-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{secrets.token_hex(2)}"
            try:
                self.audit.append(
                    {
                        "event": "candidate-save-started",
                        "saveId": save_id,
                        "actionId": SAVE_ID,
                        "project": pid,
                        "session": params["session"],
                        "path": display,
                        "beforeSha256": _sha256(raw),
                        "afterSha256": _sha256(encoded),
                        "beforeBytes": len(raw),
                        "afterBytes": len(encoded),
                        "tokenId": self.token_id,
                        "startedAt": _now(),
                    },
                    fsync=True,
                )
            except OSError as error:
                raise ActionError(
                    500, "studio.audit", f"Cannot write the action audit log: {error}"
                ) from error
            status = "unchanged"
            try:
                if changed:
                    self._atomic_write(path, encoded)
                    status = "saved"
            except OSError as error:
                status = "failed"
                raise ActionError(
                    500, "studio.write-failed", f"Cannot write the candidate: {error}"
                ) from error
            finally:
                try:
                    self.audit.append(
                        {
                            "event": "candidate-save-finished",
                            "saveId": save_id,
                            "status": status,
                            "endedAt": _now(),
                        },
                        fsync=True,
                    )
                except OSError:
                    pass
            return {
                "actionId": SAVE_ID,
                "project": pid,
                "session": params["session"],
                "path": display,
                "sha256": _sha256(encoded),
                "bytes": len(encoded),
                "previousSha256": _sha256(raw),
                "previousBytes": len(raw),
                "changed": changed,
            }

    @staticmethod
    def _atomic_write(path: Path, data: bytes) -> None:
        temporary = path.with_name(f".{path.name}.{secrets.token_hex(4)}.tmp")
        try:
            with open(temporary, "xb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass
            except OSError:
                pass


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


def _studio_trial_gate(project: ProjectContext, study_id: str) -> None:
    """Apply the same Core trial gate the CLI enforces, before any confirmation."""

    from .cli_contract import CliCommandError
    from .trial_gate import gate_state

    try:
        state = gate_state(project, study_id)
    except CliCommandError as error:
        raise ActionError(409, error.code, str(error)) from error
    if state is not None and state["refusal"] is not None:
        raise ActionError(409, state["refusal"],
                          f"Core trial gate refused {study_id}: {state['refusal']} "
                          f"(family {state['familyId']}, {state['budget']['usedInWindow']}/"
                          f"{state['budget']['maxCountedTrialsPerFamily']} in {state['budget']['windowDays']} days)")
