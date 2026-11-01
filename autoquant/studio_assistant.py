"""Persistent local Assistant conversations and a fail-closed aq broker.

This is operational state, never research evidence. Provider credentials are
neither read nor persisted here. Research execution is disabled until a real
candidate-process isolation boundary is available.
"""
from __future__ import annotations

import difflib
import hmac
import json
import os
import re
import secrets
import stat
import subprocess
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .project_leases import LeaseBusy, acquire_file_lease
from .holdouts import has_holdout_binding
from .studio_actions import ActionError, _PopenHandle, scrubbed_environment

READS = {
    "orient": ("orient",), "project.list": ("project", "list"),
    "study.list": ("study", "list"), "study.inspect": ("study", "inspect"),
    "run.list": ("run", "list"), "run.show": ("run", "show"),
    "run.factor": ("run", "factor"), "run.portfolio": ("run", "portfolio"),
    "session.list": ("session", "list"), "session.show": ("session", "show"),
    "session.compare": ("session", "compare"),
    "candidate.show": ("candidate", "show"),
}
TRIAL_ACTIONS = {"session.start", "experiment.evaluate"}
EXECUTION_ACTIONS = TRIAL_ACTIONS | {"session.check"}
IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
MAX_STATE = 4 * 1024 * 1024
MAX_PROMPT = 16000
ISOLATION_REASON = (
    "Candidate execution is unavailable: the current aq runner imports "
    "arbitrary Python without a verified process isolation boundary. "
    "Saving source does not authorize running it."
)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def refuse(code: str, message: str, status: int = 409) -> ActionError:
    return ActionError(status, "assistant." + code, message)


def clean_result(value: Any) -> Any:
    """Do not forward holdout projections or executable next-action advice."""
    if isinstance(value, dict):
        return {key: clean_result(item) for key, item in value.items()
                if key not in {"externalHoldout", "holdout", "holdouts",
                               "nextActions", "nextAction"}}
    if isinstance(value, list):
        return [clean_result(item) for item in value]
    return value


class AssistantService:
    def __init__(self, actions, *, provider_runner=None, provider_discovery=None,
                 query_runner=None, execution_check=None):
        from .studio_assistant_providers import discover_providers, run_provider
        self.actions = actions
        self.root = actions.root
        self.directory = self.root / ".autoquant" / "assistant"
        self._run_provider = provider_runner or run_provider
        self._providers = provider_discovery or discover_providers
        self._query_runner = query_runner or self._query
        # Private injection supports boundary tests, not a user bypass switch.
        self._execution_check = execution_check or (lambda project: ISOLATION_REASON)
        self._lock = threading.RLock()
        self._active: dict[str, threading.Event] = {}
        self._leases: dict[str, Any] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._closed = False
        self._bridges: dict[str, str] = {}
        self._ready: set[str] = set()
        self.origin: str | None = None
        self._provider_cache: tuple[float, list] | None = None

    def _safe_path(self, path: Path) -> None:
        if not path.is_relative_to(self.root):
            raise refuse("path", "Conversation path escaped Workspace", 400)
        for part in [self.root, *reversed(path.relative_to(self.root).parents),
                     path.relative_to(self.root)]:
            target = part if part.is_absolute() else self.root / part
            if target.exists() or target.is_symlink():
                info = target.lstat()
                if stat.S_ISLNK(info.st_mode) or (
                    getattr(info, "st_file_attributes", 0) &
                    getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
                ):
                    raise refuse("path", "Conversation paths cannot use links", 400)

    def _path(self, session_id: Any) -> Path:
        if not isinstance(session_id, str):
            raise refuse("session", "A conversation id is required", 400)
        try:
            if str(uuid.UUID(session_id)) != session_id:
                raise ValueError()
        except ValueError:
            raise refuse("session", "Invalid conversation id", 400) from None
        path = self.directory / (session_id + ".json")
        self._safe_path(path)
        return path

    @contextmanager
    def _state(self, session_id: str):
        with self._lock:
            path = self._path(session_id)
            if not path.is_file():
                raise refuse("unknown-session", "Unknown conversation", 404)
            lock = path.with_suffix(".lock")
            self._safe_path(lock)
            try:
                lease = acquire_file_lease(lock, self.root)
            except LeaseBusy:
                raise refuse("busy", "Conversation is being updated; retry") from None
            try:
                if path.stat().st_size > MAX_STATE:
                    raise refuse("state-size", "Conversation exceeds its size limit")
                state = json.loads(path.read_text(encoding="utf-8"))
                before = json.dumps(state, sort_keys=True)
                yield state
                if json.dumps(state, sort_keys=True) != before:
                    self._save(path, state)
            finally:
                lease.close()

    def _save(self, path: Path, state: dict) -> None:
        self._safe_path(path)
        raw = json.dumps(state, ensure_ascii=False).encode("utf-8")
        if len(raw) > MAX_STATE:
            raise refuse("state-size", "Conversation is full; start a new chat")
        temporary = path.with_name(path.name + "." + secrets.token_hex(8) + ".tmp")
        try:
            with temporary.open("xb") as stream:
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)

    @staticmethod
    def _event(state: dict, kind: str, data: dict) -> None:
        state["events"].append({"id": len(state["events"]) + 1,
                                "type": kind, "at": now(), "data": data})
        state["updatedAt"] = now()

    def _guard(self, project_id: Any):
        project = self.actions._project(project_id)
        if has_holdout_binding(project):
            raise refuse("holdout", "Sealed holdout Projects are unavailable to Assistant", 403)
        return project

    def provider_specs(self):
        with self._lock:
            if self._provider_cache is None or time.monotonic() - self._provider_cache[0] > 30:
                self._provider_cache = (time.monotonic(), self._providers())
            return self._provider_cache[1]

    def catalogue(self) -> dict:
        sessions = []
        self._safe_path(self.directory)
        if self.directory.is_dir():
            candidates = []
            for path in self.directory.glob("*.json"):
                try:
                    self._safe_path(path)
                    candidates.append((path.stat().st_mtime_ns, path))
                except (ActionError, OSError):
                    continue
            for _, path in sorted(candidates, reverse=True)[:200]:
                try:
                    state = self.view(path.stem)
                    sessions.append({key: state[key] for key in (
                        "id", "title", "provider", "project", "status",
                        "trialBudget", "usedTrials", "updatedAt")})
                except (ActionError, OSError, ValueError):
                    continue
        sessions.sort(key=lambda s: s["updatedAt"], reverse=True)
        return {"providers": self.provider_specs(), "sessions": sessions,
                "executionBlockedReason": ISOLATION_REASON}

    def create(self, body: dict) -> dict:
        provider = body.get("provider")
        spec = next((p for p in self.provider_specs() if p["id"] == provider), None)
        if spec is None or not spec["available"]:
            raise refuse("provider-unavailable",
                         (spec or {}).get("reason") or "Unknown provider")
        budget = body.get("trialBudget", 0)
        if type(budget) is not int or not 0 <= budget <= 100:
            raise refuse("budget", "trialBudget must be an integer from 0 to 100", 400)
        project = body.get("project")
        if project is not None:
            self._guard(project)
        context = body.get("context") or {}
        if not isinstance(context, dict) or set(context) - {"study", "run", "page", "project"}:
            raise refuse("context", "Invalid object context", 400)
        context = {key: value for key, value in context.items()
                   if key != "project" and isinstance(value, str) and IDENTIFIER.fullmatch(value)}
        identity = str(uuid.uuid4())
        state = {"id": identity, "title": "New chat", "provider": provider,
                 "project": project, "context": context, "trialBudget": budget,
                 "usedTrials": 0, "status": "idle", "messages": [], "events": [],
                 "pendingAction": None, "createdAt": now(), "updatedAt": now()}
        with self._lock:
            path = self._path(identity)
            self.directory.mkdir(parents=True, exist_ok=True)
            self._safe_path(path)
            self._save(path, state)
        return state

    def _take_lease(self, identity):
        path = self._path(identity).with_suffix(".turn")
        self._safe_path(path)
        try:
            return acquire_file_lease(path, self.root)
        except LeaseBusy:
            raise refuse("busy", "Another Studio process owns this turn") from None

    @staticmethod
    def _release_lease(lease):
        lease.close()

    def _turn_exists(self, identity):
        try:
            stream = self._take_lease(identity)
        except ActionError:
            return True
        self._release_lease(stream)
        return False

    def view(self, session_id: str) -> dict:
        with self._state(session_id) as state:
            if state["status"] in {"running", "awaiting-confirmation"} and session_id not in self._active and not self._turn_exists(session_id):
                state["status"] = "error"
                state["pendingAction"] = None
                state["error"] = {"message": "Studio restarted. The previous turn was interrupted; no trials were refunded."}
                self._event(state, "error", state["error"])
            return json.loads(json.dumps(state))

    def message(self, body: dict) -> dict:
        identity, content = body.get("sessionId"), body.get("content")
        if not isinstance(content, str) or not content.strip() or len(content) > MAX_PROMPT:
            raise refuse("message", "Message must contain 1–16000 characters", 400)
        with self._lock:
            if self._closed:
                raise refuse("closed", "Studio Assistant is closed")
            if not self._path(identity).is_file():
                raise refuse("unknown-session", "Unknown conversation", 404)
            if identity in self._active:
                raise refuse("busy", "This conversation already has an active turn")
            lease = self._take_lease(identity)
            try:
                with self._state(identity) as state:
                    if len(state["messages"]) >= 200:
                        raise refuse("message-limit", "Start a new chat after 100 turns")
                    if state["project"]:
                        self._guard(state["project"])
                    stop = threading.Event()
                    state["status"] = "running"
                    state["pendingAction"] = None
                    state["error"] = None
                    state["messages"].append({"id": str(uuid.uuid4()), "role": "user",
                                              "content": content.strip(), "at": now()})
                    if state["title"] == "New chat":
                        state["title"] = content.strip()[:72]
                    state["messages"].append({"id": str(uuid.uuid4()), "role": "assistant",
                                              "content": "", "at": now()})
                    self._event(state, "turn.started", {"provider": state["provider"]})
                self._active[identity] = stop
                self._leases[identity] = lease
                worker = threading.Thread(target=self._turn, args=(identity, stop),
                                          daemon=True, name="aq-assistant")
                self._threads[identity] = worker
                worker.start()
            except Exception:
                self._active.pop(identity, None)
                self._leases.pop(identity, None)
                self._threads.pop(identity, None)
                self._release_lease(lease)
                raise
        return self.view(identity)

    def emit(self, identity: str, kind: str, data: dict) -> None:
        with self._state(identity) as state:
            if kind == "assistant.delta":
                text = data.get("text", "")
                if not isinstance(text, str):
                    return
                message = state["messages"][-1]
                if len(message["content"]) + len(text) > 256000:
                    raise refuse("output-limit", "Assistant response exceeds output limit")
                message["content"] += text
            self._event(state, kind, data)
        if kind == "provider.session":
            with self._lock:
                self._ready.add(identity)

    def _turn(self, identity: str, stop: threading.Event) -> None:
        try:
            state = self.view(identity)
            bridge = secrets.token_urlsafe(32)
            self._bridges[identity] = bridge
            prompt = (
                "You are the AutoQuant Studio Assistant. Use only the aq tool. "
                "Call catalog first. Never access sealed holdout, invent authority, "
                "bypass a refusal, or treat prose as verified research evidence. "
                "Ordinary supported writes are authorized by the user's request. "
                "Research trials require Studio confirmation and a fixed hard budget. "
                "Candidate execution may be unavailable; disclose the reason. "
                "Use the user's language. Context identifiers: " +
                json.dumps({"project": state["project"], **state["context"]}) +
                "\nRecent conversation (older content may be omitted):\n" + "\n".join(
                    message["role"] + ": " + message["content"]
                    for message in state["messages"][-21:-1])[-64000:])
            config = {"mcpServers": {"aq": {
                "command": sys.executable,
                "args": ["-m", "autoquant.studio_assistant_bridge"],
                "env": {"AQ_STUDIO_URL": self.origin or "",
                        "AQ_STUDIO_TOKEN": self.actions.token,
                        "AQ_ASSISTANT_SESSION": identity,
                        "AQ_ASSISTANT_BRIDGE_TOKEN": bridge}}}}
            self._run_provider(
                state["provider"], prompt, str(self.root),
                lambda kind, data: self.emit(identity, kind, data),
                lambda name, args: self.tool(identity, args),
                stop, config)
            with self._state(identity) as current:
                current["status"] = "cancelled" if stop.is_set() else "idle"
                current["pendingAction"] = None
                self._event(current, "turn.completed", {"status": current["status"]})
        except Exception as error:
            with self._state(identity) as current:
                current["status"] = "cancelled" if stop.is_set() else "error"
                current["pendingAction"] = None
                current["error"] = {"message": str(error)[:2000],
                                    "code": getattr(error, "code", "assistant.failed")}
                self._event(current, "error", current["error"])
        finally:
            with self._lock:
                self._bridges.pop(identity, None)
                self._ready.discard(identity)
                self._active.pop(identity, None)
                self._threads.pop(identity, None)
                lease = self._leases.pop(identity, None)
                if lease is not None:
                    self._release_lease(lease)

    def close(self, timeout: float = 20) -> None:
        with self._lock:
            self._closed = True
            for stop in self._active.values():
                stop.set()
            workers = list(self._threads.values())
        deadline = time.monotonic() + timeout
        for worker in workers:
            if worker is not threading.current_thread():
                worker.join(max(0, deadline - time.monotonic()))
        if any(worker.is_alive() for worker in workers):
            raise RuntimeError("Assistant did not stop before Studio shutdown")

    def cancel(self, body: dict) -> dict:
        identity = body.get("sessionId")
        self._path(identity)
        with self._lock:
            stop = self._active.get(identity)
            if stop:
                stop.set()
        return self.view(identity)

    def bridge_tool(self, body: dict) -> Any:
        identity, token = body.get("sessionId"), body.get("bridgeToken")
        expected = self._bridges.get(identity)
        if identity not in self._ready or not expected or not isinstance(token, str) or not hmac.compare_digest(token, expected):
            raise refuse("bridge-token", "Invalid or expired tool capability", 403)
        return self.tool(identity, body.get("arguments"))

    def _query(self, argv: list[str], stop: threading.Event, source=None) -> Any:
        options = ({"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP |
                    getattr(subprocess, "CREATE_NO_WINDOW", 0)}
                   if os.name == "nt" else {"start_new_session": True})
        process = subprocess.Popen(
            argv, shell=False, cwd=str(self.root), env=scrubbed_environment(),
            stdin=subprocess.PIPE if source is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, **options)
        began = time.monotonic()
        first = True
        try:
            while True:
                if stop.is_set() or time.monotonic() - began > 30:
                    raise refuse("cancelled" if stop.is_set() else "timeout",
                                 "aq query cancelled or timed out")
                try:
                    output, _ = process.communicate(
                        input=source.encode("utf-8") if first and source is not None else None,
                        timeout=0.1)
                    break
                except subprocess.TimeoutExpired:
                    first = False
            if len(output) > 1024 * 1024:
                raise refuse("output-limit", "aq response exceeds 1MB")
            result = json.loads(output)
            if process.returncode or result.get("ok") is not True:
                raise refuse("aq-failed", str(result.get("error", "aq command failed"))[:2000])
            return clean_result(result.get("data"))
        finally:
            _PopenHandle(process).kill_tree()
            process.wait()

    def tool(self, identity: str, arguments: Any) -> Any:
        state = self.view(identity)
        stop = self._active.get(identity)
        if stop is None or stop.is_set():
            raise refuse("cancelled", "Conversation is not running")
        if not isinstance(arguments, dict) or set(arguments) - {"operation", "params"}:
            raise refuse("tool", "Use a structured aq operation", 400)
        operation, params = arguments.get("operation"), arguments.get("params", {})
        if not isinstance(params, dict) or not isinstance(operation, str):
            raise refuse("tool", "Invalid operation or params", 400)
        if operation == "catalog":
            return {"queries": list(READS), "writes": ["candidate.save", "project.create"],
                    "parameters": {"queries": "project id; optional study/run/session id; bounded points/trials",
                                   "candidate.save": "project, session (or initial), source, baseSha256",
                                   "action.run": "actionId, project, params; project.create params: id (lowercase slug), name, description (8+ chars), template (blank or ohlcv-factor-lab); session.start params: study; session.check/evaluate params: session and optional hypothesis"},
                    "actions": sorted(EXECUTION_ACTIONS),
                    "trialBudget": state["trialBudget"], "usedTrials": state["usedTrials"],
                    "executionBlockedReason": ISOLATION_REASON}
        if operation == "action.run":
            return self._action(identity, state, params, stop)
        if operation not in READS and operation != "candidate.save":
            raise refuse("operation", "Operation is not allowlisted", 403)
        allowed = {"project", "study", "run", "session", "points", "trials"}
        if operation == "candidate.save":
            allowed |= {"source", "baseSha256"}
        if set(params) - allowed:
            raise refuse("params", "Unexpected operation parameter", 400)
        argv = [sys.executable, "-m", "autoquant.cli",
                *(READS.get(operation) or ("candidate", "save")), str(self.root)]
        project_id = params.get("project", state["project"])
        if operation != "project.list":
            self._guard(project_id)
            if state["project"] and state["project"] != project_id:
                raise refuse("scope", "Operation is outside this chat's Project", 403)
            argv += ["--project", project_id]
        for key in ("study", "run", "session"):
            if key in params:
                value = params[key]
                if not isinstance(value, str) or not IDENTIFIER.fullmatch(value):
                    raise refuse("params", "Invalid object identifier", 400)
                argv += ["--" + key, value]
        for key in ("points", "trials"):
            if key in params:
                value = params[key]
                if type(value) is not int or not 1 <= value <= 500:
                    raise refuse("params", "Query limit must be from 1 to 500", 400)
                argv += ["--" + key, str(value)]
        source = None
        if operation == "candidate.save":
            source, base = params.get("source"), params.get("baseSha256")
            if not isinstance(source, str) or not 1 <= len(source.encode()) <= 200000:
                raise refuse("source", "Candidate source must contain 1–200000 bytes", 400)
            if not isinstance(base, str) or not re.fullmatch("[0-9a-f]{64}", base):
                raise refuse("source", "Exact baseSha256 is required", 400)
            previous = self.tool(identity, {"operation": "candidate.show", "params": {
                key: value for key, value in params.items()
                if key in {"project", "session"}}})
            diff = "".join(difflib.unified_diff(
                previous["source"].splitlines(True), source.splitlines(True),
                fromfile="candidate.py (before)", tofile="candidate.py (proposed)"))
            self.emit(identity, "candidate.diff", {"diff": diff,
                      "baseSha256": base, "project": project_id})
            argv += ["--base-sha256", base, "--source-stdin"]
        argv += ["--json"]
        self.emit(identity, "tool.started", {"operation": operation, "argv": argv})
        result = self._query_runner(argv, stop, source)
        if operation == "project.list":
            # The CLI envelope can describe other Workspace objects. Return
            # only caller-visible unsealed Project ids and names.
            result = {"projects": [
                {"id": project.manifest.id, "name": project.manifest.name}
                for project in self.actions._load_projects().values()
                if not has_holdout_binding(project)]}
        elif project_id:
            self._guard(project_id)
        self.emit(identity, "tool.completed", {"operation": operation})
        if isinstance(params.get("run"), str):
            self.emit(identity, "artifact", {"project": project_id,
                      "createdRefs": {"runId": params["run"]}})
        return result

    def _action(self, identity, state, params, stop):
        if set(params) - {"actionId", "project", "params"}:
            raise refuse("params", "Unexpected action parameter", 400)
        action_id = params.get("actionId")
        if action_id not in EXECUTION_ACTIONS | {"project.create"}:
            raise refuse("operation", "Action is not allowlisted", 403)
        body = {"actionId": action_id, "project": params.get("project", state["project"]),
                "params": params.get("params", {})}
        if action_id != "project.create":
            project = self._guard(body["project"])
            if state["project"] and state["project"] != body["project"]:
                raise refuse("scope", "Action is outside this chat's Project", 403)
            reason = self._execution_check(project)
            if reason:
                raise refuse("candidate-isolation-required", reason)
        preview = self.actions.preview(body)
        if action_id in EXECUTION_ACTIONS:
            pending_id = str(uuid.uuid4())
            with self._state(identity) as current:
                if action_id in TRIAL_ACTIONS and current["usedTrials"] >= current["trialBudget"]:
                    raise refuse("budget-exhausted", "Trial budget exhausted")
                if current["pendingAction"] is not None:
                    raise refuse("busy", "Another action is awaiting confirmation")
                current["pendingAction"] = {"id": pending_id, "preview": preview,
                                            "accepted": None}
                current["status"] = "awaiting-confirmation"
                self._event(current, "action.pending", {
                    "id": pending_id, "preview": preview,
                    "trialNumber": current["usedTrials"] + 1,
                    "trialBudget": current["trialBudget"]})
            deadline = time.monotonic() + 900
            while not stop.wait(0.1):
                current = self.view(identity)
                pending = current["pendingAction"]
                if not pending or pending.get("accepted") is False:
                    raise refuse("declined", "The user declined the action")
                if pending.get("accepted") is True:
                    break
                if time.monotonic() > deadline:
                    raise refuse("confirmation-timeout", "Confirmation expired")
            if stop.is_set():
                raise refuse("cancelled", "Action cancelled before launch")
            with self._state(identity) as current:
                if action_id in TRIAL_ACTIONS:
                    if current["usedTrials"] >= current["trialBudget"]:
                        raise refuse("budget-exhausted", "Trial budget exhausted")
                    current["usedTrials"] += 1
                current["pendingAction"] = None
                current["status"] = "running"
                self._event(current, "trial.reserved" if action_id in TRIAL_ACTIONS else "action.confirmed", {
                    "usedTrials": current["usedTrials"], "trialBudget": current["trialBudget"]})
        body.update(confirm=True, commandHash=preview.get("commandHash"),
                    secondConfirm=True)
        self.emit(identity, "tool.started", {"operation": action_id,
                                             "argv": preview.get("argv"),
                                             "display": preview.get("display")})
        if stop.is_set():
            raise refuse("cancelled", "Action cancelled before launch")
        created = self.actions.create(body)
        job_id = created.get("jobId")
        if job_id:
            self.emit(identity, "artifact", {"jobId": job_id})
            job = self.actions.runner.get(job_id)
            while job and not job.done.wait(0.1):
                if stop.is_set():
                    self.actions.runner.cancel(job_id)
            result = job.to_dict() if job else created
        else:
            result = created
        if isinstance(result, dict) and result.get("createdRefs"):
            self.emit(identity, "artifact", {"project": body.get("project"),
                      "createdRefs": result["createdRefs"]})
        self.emit(identity, "tool.completed", {"operation": action_id, "result": result})
        return clean_result(result)

    def confirm(self, body: dict) -> dict:
        identity = body.get("sessionId")
        with self._state(identity) as state:
            pending = state["pendingAction"]
            if not pending or pending["id"] != body.get("actionId"):
                raise refuse("stale-confirmation", "This action is no longer pending")
            if type(body.get("accepted")) is not bool:
                raise refuse("confirmation", "accepted must be boolean", 400)
            if body["accepted"]:
                preview = pending["preview"]
                if body.get("commandHash") != preview.get("commandHash"):
                    raise refuse("stale-confirmation", "The command preview changed")
                if preview.get("requiresSecondConfirm") and body.get("secondConfirm") is not True:
                    raise refuse("confirmation", "Second confirmation is required", 400)
            pending["accepted"] = body["accepted"]
        return self.view(identity)
