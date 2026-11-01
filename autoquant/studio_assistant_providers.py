"""Local CLI transports for Studio's governed Assistant.

Provider processes own their existing login. This module never reads credential
files, accepts model-generated commands, or executes an aq operation itself.
Claude uses the single Studio MCP bridge. Codex's dynamic-tool transport is
implemented but intentionally unavailable until its native tool closure has
passed direct confinement verification on the installed CLI version.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import queue
import re
import shutil
import signal
import subprocess
import threading
import time
from typing import Any, Callable, Iterator

MAX_LINE_BYTES = 1_048_576
MAX_OUTPUT_BYTES = 16_777_216
MAX_RUN_SECONDS = 1800
CLAUDE_MIN_VERSION = (2, 1, 248)
CODEX_ISOLATION_REASON = (
    "Codex dynamic tools do not replace native tools. Native tool confinement "
    "has not been verified for this adapter; execution is disabled."
)
_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "operation": {"type": "string", "minLength": 1},
        "params": {"type": "object"},
    },
    "required": ["operation", "params"],
    "additionalProperties": False,
}
_CLAUDE_TOOLS = frozenset({"mcp__aq__aq", "EndConversation"})
Emit = Callable[[str, dict[str, Any]], None]
Tool = Callable[[str, dict[str, Any]], Any]


class ProviderError(RuntimeError):
    """A safe, stable public error; do not include raw provider stderr."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class ProviderCancelled(ProviderError):
    def __init__(self) -> None:
        super().__init__("assistant.cancelled", "Assistant turn was cancelled.")


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    label: str
    available: bool
    reason: str | None = None


def _executable(name: str) -> str | None:
    # Launch native binaries directly. Do not invoke cmd.exe or a shell shim.
    found = shutil.which(name + ".exe") if os.name == "nt" else None
    found = found or shutil.which(name)
    if found and Path(found).suffix.lower() in {".cmd", ".bat", ".ps1"}:
        return None
    return found


def _probe(executable: str, *args: str) -> str:
    try:
        result = subprocess.run(
            [executable, *args], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=5, shell=False,
            env=_process_environment(),
            **({"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}),
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return result.stdout[:100_000] if result.returncode == 0 else ""


def _claude_ready(executable: str | None) -> tuple[bool, str | None]:
    if not executable:
        return False, "A native Claude Code executable was not found."
    match = re.search(r"\b(\d+)\.(\d+)\.(\d+)\b", _probe(executable, "--version"))
    if not match or tuple(map(int, match.groups())) < CLAUDE_MIN_VERSION:
        return False, "Claude Code 2.1.248 or later is required for restricted mode."
    help_text = _probe(executable, "--help")
    required = ("--restricted", "--tools", "--strict-mcp-config", "--input-format")
    if not all(flag in help_text for flag in required):
        return False, "This Claude Code executable lacks the required confinement flags."
    return True, None


def discover_providers() -> list[dict[str, Any]]:
    """Report adapter readiness, without reading authentication secrets."""
    ready, reason = _claude_ready(_executable("claude"))
    codex = _executable("codex")
    return [
        asdict(ProviderSpec("claude", "Claude Code", ready, reason)),
        asdict(ProviderSpec(
            "codex", "Codex", False,
            CODEX_ISOLATION_REASON if codex else "A native Codex executable was not found.",
        )),
    ]


def _process_environment() -> dict[str, str]:
    # CLI-managed local login remains available through HOME/config directories.
    # Do not forward ambient API keys, bearer tokens, or nested agent state.
    allowed = {
        "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "USERPROFILE",
        "HOMEDRIVE", "HOMEPATH", "HOME", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA",
        "TEMP", "TMP", "LANG", "LC_ALL", "TZ", "CODEX_HOME", "CLAUDE_CONFIG_DIR",
        "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
        "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS",
    }
    return {key: value for key, value in os.environ.items() if key.upper() in allowed}


def _bridge_json(config: dict[str, Any] | None) -> str:
    if not isinstance(config, dict) or set(config) != {"mcpServers"}:
        raise ProviderError("assistant.bridge.invalid", "A dedicated Studio aq MCP bridge is required.")
    servers = config["mcpServers"]
    if not isinstance(servers, dict) or set(servers) != {"aq"}:
        raise ProviderError("assistant.bridge.invalid", "Only the Studio aq MCP server is permitted.")
    server = servers["aq"]
    if not isinstance(server, dict) or set(server) - {"type", "command", "args", "env"}:
        raise ProviderError("assistant.bridge.invalid", "Only a local stdio aq bridge is permitted.")
    if server.get("type", "stdio") != "stdio":
        raise ProviderError("assistant.bridge.invalid", "The aq bridge must use stdio.")
    if not isinstance(server.get("command"), str) or not server["command"]:
        raise ProviderError("assistant.bridge.invalid", "The aq bridge command is missing.")
    args = server.get("args", [])
    env = server.get("env", {})
    if (
        not isinstance(args, list) or len(args) > 64
        or any(not isinstance(value, str) for value in args)
        or not isinstance(env, dict) or len(env) > 32
        or any(not isinstance(k, str) or not isinstance(v, str) for k, v in env.items())
    ):
        raise ProviderError("assistant.bridge.invalid", "The aq bridge configuration is invalid.")
    encoded = json.dumps(config, ensure_ascii=True, separators=(",", ":"))
    if len(encoded) > 32_000:
        raise ProviderError("assistant.bridge.invalid", "The aq bridge configuration is too large.")
    return encoded


def _start_process(argv: list[str], cwd: str) -> subprocess.Popen[str]:
    options: dict[str, Any] = {}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        options["start_new_session"] = True
    try:
        return subprocess.Popen(
            argv, cwd=cwd, env=_process_environment(), shell=False,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="replace", bufsize=1, **options,
        )
    except OSError as exc:
        raise ProviderError("assistant.provider.start", "The local agent could not be started.") from exc


def _stop_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is None:
        if os.name == "nt":
            try:
                subprocess.run(
                    ["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=5, shell=False, creationflags=subprocess.CREATE_NO_WINDOW,
                )
            except (OSError, subprocess.SubprocessError):
                process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except (OSError, ProcessLookupError):
                process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            if os.name != "nt":
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except (OSError, ProcessLookupError):
                    process.kill()
            else:
                process.kill()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass
    for stream in (process.stdin, process.stdout, process.stderr):
        if stream is not None:
            try:
                stream.close()
            except OSError:
                pass


def _send(process: subprocess.Popen[str], message: dict[str, Any]) -> None:
    try:
        assert process.stdin is not None
        process.stdin.write(json.dumps(message, ensure_ascii=True, separators=(",", ":")) + "\n")
        process.stdin.flush()
    except (OSError, ValueError, AssertionError) as exc:
        raise ProviderError("assistant.provider.closed", "The local agent connection closed.") from exc


def _messages(
    process: subprocess.Popen[str], cancel_event: threading.Event,
) -> Iterator[dict[str, Any]]:
    events: queue.Queue[tuple[str, Any]] = queue.Queue(maxsize=128)
    ended = threading.Event()

    def enqueue(kind: str, data: Any) -> None:
        while not ended.is_set():
            try:
                events.put((kind, data), timeout=0.1)
                return
            except queue.Full:
                continue

    def read(stream: Any, kind: str) -> None:
        try:
            while not ended.is_set():
                line = stream.readline(MAX_LINE_BYTES + 1)
                if not line:
                    break
                if len(line.encode("utf-8")) > MAX_LINE_BYTES:
                    enqueue("limit", None)
                    return
                enqueue(kind, line)
        except (OSError, ValueError):
            pass
        finally:
            enqueue(kind + ".end", None)

    assert process.stdout is not None and process.stderr is not None
    for stream, kind in ((process.stdout, "stdout"), (process.stderr, "stderr")):
        threading.Thread(target=read, args=(stream, kind), daemon=True).start()
    deadline = time.monotonic() + MAX_RUN_SECONDS
    total = 0
    try:
        while True:
            if cancel_event.is_set():
                raise ProviderCancelled()
            if time.monotonic() >= deadline:
                raise ProviderError("assistant.provider.timeout", "The local agent exceeded its time limit.")
            try:
                kind, value = events.get(timeout=0.1)
            except queue.Empty:
                continue
            if kind == "limit":
                raise ProviderError("assistant.provider.output-limit", "The local agent exceeded its output limit.")
            if kind == "stdout.end":
                raise ProviderError("assistant.provider.closed", "The local agent ended before completing the turn.")
            if kind.endswith(".end"):
                continue
            total += len(value.encode("utf-8"))
            if total > MAX_OUTPUT_BYTES:
                raise ProviderError("assistant.provider.output-limit", "The local agent exceeded its output limit.")
            if kind == "stderr" or not value.strip():
                # Never place stderr (which may include credentials/config) in chat.
                continue
            try:
                message = json.loads(value)
            except (TypeError, ValueError) as exc:
                raise ProviderError("assistant.provider.protocol", "The local agent emitted invalid JSON.") from exc
            if not isinstance(message, dict):
                raise ProviderError("assistant.provider.protocol", "The local agent emitted an invalid message.")
            yield message
    finally:
        ended.set()


def _tool_arguments(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError as exc:
            raise ProviderError("assistant.provider.tool", "The agent supplied invalid aq arguments.") from exc
    if (
        not isinstance(value, dict) or set(value) != {"operation", "params"}
        or not isinstance(value["operation"], str) or not value["operation"].strip()
        or len(value["operation"]) > 128 or not isinstance(value["params"], dict)
    ):
        raise ProviderError("assistant.provider.tool", "Only structured aq operations are permitted.")
    return value


def _check_claude_init(message: dict[str, Any]) -> None:
    tools = message.get("tools")
    servers = message.get("mcp_servers")
    if (
        not isinstance(tools, list) or not all(isinstance(t, str) for t in tools)
        or set(tools) - _CLAUDE_TOOLS or "mcp__aq__aq" not in tools
        or not isinstance(servers, list) or len(servers) != 1
        or not isinstance(servers[0], dict) or servers[0].get("name") != "aq"
        or servers[0].get("status") != "connected"
        or message.get("mcp_server_errors")
    ):
        raise ProviderError(
            "assistant.provider.confinement",
            "The local agent did not expose the required isolated aq tool set.",
        )


def _run_claude(
    executable: str, prompt: str, cwd: str, emit: Emit,
    cancel_event: threading.Event, bridge_config: dict[str, Any] | None,
) -> None:
    config = _bridge_json(bridge_config)
    argv = [
        executable, "-p", "--restricted", "--tools", "",
        "--allowedTools", "mcp__aq__aq",
        "--strict-mcp-config", "--mcp-config", config,
        "--settings", '{"disableAllHooks":true,"autoMemoryEnabled":false}',
        "--input-format", "stream-json", "--output-format", "stream-json",
        "--verbose", "--include-partial-messages",
    ]
    process = _start_process(argv, cwd)
    initialized = False
    streamed_ids: set[str] = set()
    unlabelled_delta = False
    try:
        _send(process, {
            "type": "user",
            "message": {"role": "user", "content": prompt},
        })
        for message in _messages(process, cancel_event):
            kind = message.get("type")
            if kind == "system" and message.get("subtype") == "init":
                if initialized:
                    raise ProviderError("assistant.provider.protocol", "The agent initialized twice.")
                _check_claude_init(message)
                initialized = True
                emit("provider.session", {"provider": "claude", "sessionId": message.get("session_id")})
                continue
            if not initialized:
                raise ProviderError("assistant.provider.confinement", "The agent emitted output before confinement was checked.")
            if kind == "stream_event":
                event = message.get("event", {})
                if event.get("type") == "message_start":
                    message_id = event.get("message", {}).get("id")
                    if isinstance(message_id, str):
                        streamed_ids.add(message_id)
                delta = event.get("delta", {})
                if delta.get("type") == "text_delta" and isinstance(delta.get("text"), str):
                    unlabelled_delta = True
                    emit("assistant.delta", {"text": delta["text"]})
            elif kind == "assistant":
                body = message.get("message", {})
                already_streamed = body.get("id") in streamed_ids or (not body.get("id") and unlabelled_delta)
                for block in body.get("content", []):
                    if not isinstance(block, dict):
                        continue
                    if block.get("type") == "text" and not already_streamed:
                        if isinstance(block.get("text"), str):
                            emit("assistant.delta", {"text": block["text"]})
                    elif block.get("type") == "tool_use":
                        if block.get("name") == "EndConversation":
                            continue
                        if block.get("name") != "mcp__aq__aq":
                            raise ProviderError("assistant.provider.confinement", "The agent attempted an unsupported tool.")
                        arguments = _tool_arguments(block.get("input"))
                        emit("tool.started", {"tool": "aq", "callId": block.get("id"), "arguments": arguments})
                unlabelled_delta = False
            elif kind == "user":
                for block in message.get("message", {}).get("content", []):
                    if isinstance(block, dict) and block.get("type") == "tool_result":
                        emit("tool.completed", {
                            "tool": "aq", "callId": block.get("tool_use_id"),
                            "success": not bool(block.get("is_error")),
                        })
            elif kind == "result":
                if message.get("is_error") or message.get("subtype") != "success":
                    raise ProviderError("assistant.provider.failed", "The local agent could not complete this turn.")
                emit("provider.completed", {"provider": "claude"})
                return
    finally:
        _stop_process(process)


def _run_codex(
    executable: str, prompt: str, cwd: str, emit: Emit, tool: Tool,
    cancel_event: threading.Event,
) -> None:
    """Transport implementation only; public entry remains fail-closed."""
    argv = [
        executable, "app-server", "--listen", "stdio://",
        "-c", "features.shell_tool=false", "-c", "tools.view_image=false",
        "-c", "features.multi_agent=false", "-c", "features.apps=false",
        "-c", "features.plugins=false", "-c", "features.computer_use=false",
        "-c", "features.hooks=false", "-c", 'web_search="disabled"',
    ]
    process = _start_process(argv, cwd)
    thread_id: str | None = None
    try:
        _send(process, {"id": 1, "method": "initialize", "params": {
            "clientInfo": {"name": "autoquant_studio", "title": "AutoQuant Studio", "version": "1"},
            "capabilities": {"experimentalApi": True},
        }})
        for message in _messages(process, cancel_event):
            if "error" in message and "id" in message:
                raise ProviderError("assistant.provider.protocol", "The local agent rejected a protocol request.")
            if message.get("id") == 1 and "result" in message:
                _send(process, {"method": "initialized", "params": {}})
                _send(process, {"id": 2, "method": "thread/start", "params": {
                    "cwd": cwd, "approvalPolicy": "never", "sandbox": "readOnly",
                    "dynamicTools": [{
                        "name": "aq", "description": "Use governed AutoQuant operations through Studio.",
                        "inputSchema": _TOOL_SCHEMA,
                    }],
                }})
                continue
            if message.get("id") == 2 and "result" in message:
                thread_id = message["result"].get("thread", {}).get("id")
                if not isinstance(thread_id, str) or not thread_id:
                    raise ProviderError("assistant.provider.protocol", "The local agent did not create a thread.")
                emit("provider.session", {"provider": "codex", "sessionId": thread_id})
                _send(process, {"id": 3, "method": "turn/start", "params": {
                    "threadId": thread_id, "input": [{"type": "text", "text": prompt}],
                    "approvalPolicy": "never",
                    "sandboxPolicy": {"type": "readOnly", "access": {
                        "type": "restricted", "includePlatformDefaults": True, "readableRoots": [],
                    }},
                }})
                continue
            method, params = message.get("method"), message.get("params", {})
            if method == "item/tool/call" and "id" in message:
                if not thread_id or params.get("threadId") != thread_id or params.get("tool") != "aq":
                    raise ProviderError("assistant.provider.confinement", "The agent attempted an unsupported tool.")
                arguments = _tool_arguments(params.get("arguments"))
                call_id = params.get("callId", params.get("itemId"))
                emit("tool.started", {"tool": "aq", "callId": call_id, "arguments": arguments})
                try:
                    output = tool("aq", arguments)
                    text = json.dumps(output, ensure_ascii=True, separators=(",", ":"))
                    success = True
                except Exception:
                    text, success = "The governed aq operation failed.", False
                _send(process, {"id": message["id"], "result": {
                    "contentItems": [{"type": "inputText", "text": text}], "success": success,
                }})
                emit("tool.completed", {"tool": "aq", "callId": call_id, "success": success})
            elif "id" in message and method:
                # Unknown server requests must never obtain permissions or commands.
                _send(process, {"id": message["id"], "error": {
                    "code": -32601, "message": "This Studio provider capability is disabled.",
                }})
                raise ProviderError("assistant.provider.confinement", "The agent requested an unsupported capability.")
            elif method == "item/agentMessage/delta":
                if params.get("threadId") != thread_id or not isinstance(params.get("delta"), str):
                    raise ProviderError("assistant.provider.protocol", "The agent emitted an unrelated message.")
                emit("assistant.delta", {"text": params["delta"]})
            elif method == "turn/completed":
                turn = params.get("turn", {})
                if params.get("threadId") != thread_id or turn.get("status") != "completed":
                    raise ProviderError("assistant.provider.failed", "The local agent could not complete this turn.")
                emit("provider.completed", {"provider": "codex"})
                return
    finally:
        _stop_process(process)


def run_provider(
    provider_id: str, prompt: str, cwd: str | Path, emit: Emit, tool: Tool,
    cancel_event: threading.Event, bridge_config: dict[str, Any] | None = None,
) -> None:
    """Run one turn. The caller owns conversation persistence and aq authority."""
    if cancel_event.is_set():
        raise ProviderCancelled()
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 1_000_000:
        raise ProviderError("assistant.prompt.invalid", "The Assistant prompt is invalid.")
    if provider_id == "codex":
        raise ProviderError("assistant.provider.unavailable", CODEX_ISOLATION_REASON)
    if provider_id != "claude":
        raise ProviderError("assistant.provider.unknown", "Unknown local agent provider.")
    _bridge_json(bridge_config)
    executable = _executable("claude")
    ready, reason = _claude_ready(executable)
    if not ready or executable is None:
        raise ProviderError("assistant.provider.unavailable", reason or "Claude Code is unavailable.")
    _run_claude(executable, prompt, str(Path(cwd).resolve()), emit, cancel_event, bridge_config)
