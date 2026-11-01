"""Security and protocol tests for Studio's local CLI transports."""
from __future__ import annotations

import io
import json
import os
import threading
import unittest
from unittest.mock import Mock, call, patch

from autoquant import studio_assistant_providers as providers


BRIDGE = {"mcpServers": {"aq": {"command": "aq-python", "args": ["-m", "autoquant.studio_assistant_bridge"]}}}


def init_message(**changes):
    message = {
        "type": "system", "subtype": "init", "session_id": "test-session",
        "tools": ["mcp__aq__aq", "EndConversation"],
        "mcp_servers": [{"name": "aq", "status": "connected"}],
    }
    message.update(changes)
    return message


class FakeProcess:
    def __init__(self):
        self.stdin = io.StringIO()
        self.stdout = io.StringIO()
        self.stderr = io.StringIO()
        self.pid = 987654321

    def poll(self):
        return 0

    def wait(self, timeout=None):
        return 0


class ProviderTests(unittest.TestCase):
    def run_claude(self, messages):
        process, events = FakeProcess(), []
        with (
            patch.object(providers, "_start_process", return_value=process) as start,
            patch.object(providers, "_messages", return_value=iter(messages)),
            patch.object(providers, "_stop_process"),
        ):
            providers._run_claude(
                "claude", "Explain this factor.", ".", lambda k, d: events.append((k, d)),
                threading.Event(), BRIDGE,
            )
        return process, events, start

    def test_provider_discovery_keeps_codex_disabled(self):
        with (
            patch.object(providers, "_executable", return_value="/bin/agent"),
            patch.object(providers, "_claude_ready", return_value=(True, None)),
        ):
            result = providers.discover_providers()
        self.assertTrue(result[0]["available"])
        self.assertFalse(result[1]["available"])
        self.assertIn("confinement", result[1]["reason"])
        json.dumps(result)

    def test_old_or_missing_claude_is_unavailable(self):
        self.assertFalse(providers._claude_ready(None)[0])
        with patch.object(providers, "_probe", return_value="2.1.247 (Claude Code)"):
            self.assertFalse(providers._claude_ready("/bin/claude")[0])

    def test_claude_requires_confinement_flags(self):
        with patch.object(providers, "_probe", side_effect=[
            "2.1.309 (Claude Code)", "--tools --input-format",
        ]):
            self.assertFalse(providers._claude_ready("/bin/claude")[0])

    def test_native_shell_shims_are_refused(self):
        with patch.object(providers.shutil, "which", return_value="codex.cmd"):
            self.assertIsNone(providers._executable("codex"))

    def test_extra_or_remote_mcp_server_is_refused(self):
        invalid = [
            None, {}, {"mcpServers": {}},
            {"mcpServers": {"aq": {"command": "python"}, "filesystem": {"command": "evil"}}},
            {"mcpServers": {"aq": {"url": "http://localhost:1"}}},
            {"mcpServers": {"aq": {"command": "python", "type": "http"}}},
        ]
        for config in invalid:
            with self.subTest(config=config), self.assertRaises(providers.ProviderError):
                providers._bridge_json(config)

    def test_codex_fails_closed_before_process_spawn(self):
        with patch.object(providers, "_start_process") as start:
            with self.assertRaises(providers.ProviderError) as caught:
                providers.run_provider(
                    "codex", "hello", ".", lambda *a: None, lambda *a: None, threading.Event(),
                )
        self.assertEqual(caught.exception.code, "assistant.provider.unavailable")
        start.assert_not_called()

    def test_cancellation_before_spawn(self):
        cancel = threading.Event()
        cancel.set()
        with patch.object(providers, "_start_process") as start:
            with self.assertRaises(providers.ProviderCancelled):
                providers.run_provider("claude", "hello", ".", lambda *a: None, lambda *a: None, cancel, BRIDGE)
        start.assert_not_called()

    def test_claude_stream_and_tool_metadata(self):
        process, events, start = self.run_claude([
            init_message(),
            {"type": "stream_event", "event": {
                "type": "message_start", "message": {"id": "message-1"},
            }},
            {"type": "stream_event", "event": {"type": "content_block_delta", "delta": {
                "type": "text_delta", "text": "One factor.",
            }}},
            {"type": "assistant", "message": {"id": "message-1", "content": [
                {"type": "text", "text": "One factor."},
                {"type": "tool_use", "id": "tool-1", "name": "mcp__aq__aq",
                 "input": {"operation": "project.list", "params": {}}},
            ]}},
            {"type": "user", "message": {"content": [
                {"type": "tool_result", "tool_use_id": "tool-1", "content": "[]"},
            ]}},
            {"type": "result", "subtype": "success", "is_error": False},
        ])
        self.assertEqual([d["text"] for k, d in events if k == "assistant.delta"], ["One factor."])
        self.assertIn(("tool.completed", {"tool": "aq", "callId": "tool-1", "success": True}), events)
        self.assertEqual(events[-1][0], "provider.completed")
        argv = start.call_args.args[0]
        self.assertEqual(argv[argv.index("--tools") + 1], "")
        self.assertIn("--restricted", argv)
        self.assertIn("--strict-mcp-config", argv)
        self.assertNotIn("--bare", argv)
        self.assertNotIn("--dangerously-skip-permissions", argv)
        self.assertEqual(json.loads(process.stdin.getvalue())["message"]["content"], "Explain this factor.")

    def test_only_the_exact_aq_mcp_tool_is_autoapproved(self):
        _, _, start = self.run_claude([
            init_message(), {"type": "result", "subtype": "success", "is_error": False},
        ])
        argv = start.call_args.args[0]
        approval_index = argv.index("--allowedTools")
        self.assertEqual(argv[approval_index + 1], "mcp__aq__aq")
        self.assertTrue(argv[approval_index + 2].startswith("--"))
        self.assertEqual(argv.count("--allowedTools"), 1)
        self.assertNotIn("--permission-mode", argv)
        self.assertNotIn("--dangerously-skip-permissions", argv)
        self.assertNotIn("mcp__aq__*", argv)
        self.assertEqual(argv[argv.index("--tools") + 1], "")

    def test_claude_refuses_unverified_startup(self):
        for first in [
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "untrusted"}]}},
            init_message(tools=["mcp__aq__aq", "Read"]),
            init_message(tools=["mcp__aq__aq", "Bash"]),
            init_message(mcp_servers=[{"name": "aq", "status": "failed"}]),
            init_message(mcp_server_errors=[{"error": "failed"}]),
        ]:
            with self.subTest(first=first), self.assertRaises(providers.ProviderError) as caught:
                self.run_claude([first])
            self.assertEqual(caught.exception.code, "assistant.provider.confinement")

    def test_claude_refuses_undeclared_tool(self):
        with self.assertRaises(providers.ProviderError):
            self.run_claude([
                init_message(),
                {"type": "assistant", "message": {"content": [
                    {"type": "tool_use", "name": "Bash", "input": {"command": "read holdout"}},
                ]}},
            ])

    def test_failure_result_does_not_emit_success(self):
        with self.assertRaises(providers.ProviderError) as caught:
            self.run_claude([init_message(), {
                "type": "result", "subtype": "error_max_turns", "is_error": True,
            }])
        self.assertEqual(caught.exception.code, "assistant.provider.failed")

    def test_argument_contract_refuses_raw_commands_and_paths(self):
        for arguments in [
            ["aq", "orient"], {"command": "aq orient ."},
            {"operation": "orient", "params": {}, "cwd": "/holdout"},
            {"operation": "orient", "params": []}, {"operation": "", "params": {}},
        ]:
            with self.subTest(arguments=arguments), self.assertRaises(providers.ProviderError):
                providers._tool_arguments(arguments)
        self.assertEqual(
            providers._tool_arguments('{"operation":"orient","params":{}}'),
            {"operation": "orient", "params": {}},
        )

    def test_process_environment_excludes_credentials_and_nested_state(self):
        with patch.dict(os.environ, {
            "PATH": "bin", "HOME": "home", "CODEX_HOME": "codex-home",
            "CLAUDE_CONFIG_DIR": "claude-home", "ANTHROPIC_API_KEY": "secret",
            "OPENAI_API_KEY": "secret", "CLAUDE_CODE_OAUTH_TOKEN": "secret",
            "CLAUDECODE": "nested",
        }, clear=True):
            env = providers._process_environment()
        self.assertEqual(set(env), {"PATH", "HOME", "CODEX_HOME", "CLAUDE_CONFIG_DIR"})

    def test_stream_invalid_json_and_output_limits(self):
        for text, limit, expected in [
            ("not-json\n", 1000, "assistant.provider.protocol"),
            (json.dumps({"long": "x" * 100}) + "\n", 10, "assistant.provider.output-limit"),
        ]:
            process = FakeProcess()
            process.stdout = io.StringIO(text)
            with patch.object(providers, "MAX_LINE_BYTES", limit):
                with self.assertRaises(providers.ProviderError) as caught:
                    list(providers._messages(process, threading.Event()))
            self.assertEqual(caught.exception.code, expected)

    def test_stream_cancellation_checks_while_waiting(self):
        cancel = threading.Event()
        cancel.set()
        with self.assertRaises(providers.ProviderCancelled):
            next(providers._messages(FakeProcess(), cancel))

    def test_posix_cleanup_signals_group_after_leader_exit(self):
        process = FakeProcess()
        with (
            patch.object(providers.os, "name", "posix"),
            patch.object(providers.os, "killpg", create=True) as killpg,
            patch.object(providers.signal, "SIGKILL", 9, create=True),
        ):
            providers._stop_process(process)
        self.assertEqual(killpg.call_args_list, [
            call(process.pid, providers.signal.SIGTERM), call(process.pid, 9),
        ])

    def test_windows_cleanup_closes_job_after_leader_exit(self):
        process = FakeProcess()
        job = Mock()
        process._studio_job = job
        with patch.object(providers.os, "name", "nt"):
            providers._stop_process(process)
        job.close.assert_called_once_with()

    def test_windows_bootstrap_is_assigned_before_gate_release(self):
        process, job = FakeProcess(), Mock()
        gate_values = []
        job.assign.side_effect = lambda p: gate_values.append(p.stdin.getvalue())
        with (
            patch.object(providers.os, "name", "nt"),
            patch.object(providers, "_WindowsJob", return_value=job),
            patch.object(providers.subprocess, "Popen", return_value=process) as popen,
            patch.object(providers.subprocess, "CREATE_NO_WINDOW", 0, create=True),
            patch.object(providers.subprocess, "CREATE_NEW_PROCESS_GROUP", 0, create=True),
        ):
            result = providers._start_process(["agent.exe", "--restricted"], ".")
        self.assertIs(result, process)
        self.assertEqual(gate_values, [""])
        self.assertEqual(process.stdin.getvalue(), "\0")
        self.assertIs(process._studio_job, job)
        launched = popen.call_args.args[0]
        self.assertEqual(launched[0], providers.sys.executable)
        self.assertEqual(json.loads(launched[-1]), ["agent.exe", "--restricted"])

    def test_windows_job_assignment_failure_never_releases_gate(self):
        process, job = FakeProcess(), Mock()
        process.kill = Mock()
        process.poll = Mock(return_value=None)
        job.assign.side_effect = OSError("nested job assignment rejected")
        gate_values = []
        job.close.side_effect = lambda: gate_values.append(process.stdin.getvalue())
        with (
            patch.object(providers.os, "name", "nt"),
            patch.object(providers, "_WindowsJob", return_value=job),
            patch.object(providers.subprocess, "Popen", return_value=process),
            patch.object(providers.subprocess, "CREATE_NO_WINDOW", 0, create=True),
            patch.object(providers.subprocess, "CREATE_NEW_PROCESS_GROUP", 0, create=True),
            self.assertRaises(providers.ProviderError) as caught,
        ):
            providers._start_process(["agent.exe"], ".")
        self.assertEqual(caught.exception.code, "assistant.provider.confinement")
        self.assertEqual(gate_values, [""])
        process.kill.assert_called_once_with()

    @unittest.skipUnless(os.name == "nt", "Windows JobObject regression")
    def test_windows_job_kills_descendant_after_provider_parent_exit(self):
        import ctypes
        import queue
        from ctypes import wintypes

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel.WaitForSingleObject.restype = wintypes.DWORD
        kernel.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
        kernel.TerminateProcess.restype = wintypes.BOOL
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.CloseHandle.restype = wintypes.BOOL
        producer = (
            "import subprocess,sys; "
            "p=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],"
            "stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);"
            "print(p.pid,flush=True)"
        )
        process = providers._start_process(
            [providers.sys.executable, "-c", producer], os.getcwd(),
        )
        child_handle = None
        try:
            lines = queue.Queue()
            threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
            child_pid = int(lines.get(timeout=5))
            child_handle = kernel.OpenProcess(0x00100000 | 0x0001, False, child_pid)
            self.assertTrue(child_handle, "Cannot observe disposable child")
            process.wait(timeout=5)
            self.assertEqual(kernel.WaitForSingleObject(child_handle, 0), 258)
            providers._stop_process(process)
            self.assertEqual(kernel.WaitForSingleObject(child_handle, 3000), 0)
        finally:
            providers._stop_process(process)
            if child_handle:
                # Even a failed assertion must leave no disposable process behind.
                if kernel.WaitForSingleObject(child_handle, 0) == 258:
                    kernel.TerminateProcess(child_handle, 1)
                    kernel.WaitForSingleObject(child_handle, 3000)
                kernel.CloseHandle(child_handle)

    def test_codex_transport_routes_only_structured_aq(self):
        process, events, called = FakeProcess(), [], []
        messages = [
            {"id": 1, "result": {}},
            {"id": 2, "result": {"thread": {"id": "thread-1"}}},
            {"id": 3, "result": {"turn": {"id": "turn-1"}}},
            {"id": 7, "method": "item/tool/call", "params": {
                "threadId": "thread-1", "tool": "aq", "callId": "tool-1",
                "arguments": {"operation": "project.list", "params": {}},
            }},
            {"method": "item/agentMessage/delta", "params": {
                "threadId": "thread-1", "delta": "Done.",
            }},
            {"method": "turn/completed", "params": {
                "threadId": "thread-1", "turn": {"status": "completed"},
            }},
        ]
        with (
            patch.object(providers, "_start_process", return_value=process),
            patch.object(providers, "_messages", return_value=iter(messages)),
            patch.object(providers, "_stop_process"),
        ):
            providers._run_codex(
                "codex", "List factors", ".", lambda k, d: events.append((k, d)),
                lambda name, args: called.append((name, args)) or {"projects": []},
                threading.Event(),
            )
        sent = [json.loads(line) for line in process.stdin.getvalue().splitlines()]
        self.assertEqual(sent[0]["method"], "initialize")
        self.assertEqual(sent[2]["params"]["dynamicTools"][0]["name"], "aq")
        self.assertEqual(sent[3]["params"]["sandboxPolicy"]["access"]["readableRoots"], [])
        self.assertTrue(sent[4]["result"]["success"])
        self.assertEqual(called, [("aq", {"operation": "project.list", "params": {}})])
        self.assertEqual(events[-1][0], "provider.completed")

    def test_codex_transport_refuses_permission_and_unrelated_tools(self):
        for request in [
            {"id": 5, "method": "item/commandExecution/requestApproval", "params": {}},
            {"id": 6, "method": "item/tool/call", "params": {
                "threadId": "other-thread", "tool": "aq",
                "arguments": {"operation": "orient", "params": {}},
            }},
        ]:
            process = FakeProcess()
            with (
                patch.object(providers, "_start_process", return_value=process),
                patch.object(providers, "_messages", return_value=iter([
                    {"id": 1, "result": {}}, {"id": 2, "result": {"thread": {"id": "thread-1"}}},
                    request,
                ])),
                patch.object(providers, "_stop_process"),
                self.assertRaises(providers.ProviderError),
            ):
                providers._run_codex(
                    "codex", "hello", ".", lambda *a: None,
                    lambda *a: self.fail("Unsupported request reached aq"), threading.Event(),
                )


if __name__ == "__main__":
    unittest.main()
