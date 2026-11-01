"""Bounded fake-provider proofs; no inference or research evaluation."""
from __future__ import annotations

import threading
import time
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from autoquant.studio_actions import ActionError
from autoquant.studio_assistant import AssistantService, clean_result
from autoquant.studio_assistant_bridge import dispatch


class FakeActions:
    token = "test-token"

    def __init__(self, root):
        self.root = root
        self.projects = {
            key: SimpleNamespace(
                manifest=SimpleNamespace(id=key, name=key),
                root_dir=root / key, sealed=key == "sealed")
            for key in ("ordinary", "sealed")
        }
        self.created = []
        self.runner = SimpleNamespace(get=lambda identity: None)
        self.fail = False

    def _load_projects(self):
        return self.projects

    def _project(self, identity):
        if identity not in self.projects:
            raise ActionError(422, "project.unknown", "Unknown Project")
        return self.projects[identity]

    def preview(self, body):
        return {"display": "aq session start ordinary",
                "argv": ["aq", "session", "start", "ordinary"],
                "commandHash": "fixed", "requiresSecondConfirm": True,
                "trial": {"n": 1, "m": 1}}

    def create(self, body):
        self.created.append(body)
        if self.fail:
            raise ActionError(500, "test.failed", "Launch failed")
        return {"created": True}


class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="aq-assistant-test-")
        self.root = Path(self.temporary.name)
        self.actions = FakeActions(self.root)
        self.guard = patch(
            "autoquant.studio_assistant.has_holdout_binding",
            side_effect=lambda project: project.sealed)
        self.guard.start()
        self.providers = lambda: [
            {"id": "claude", "label": "Claude", "available": True, "reason": None},
            {"id": "codex", "label": "Codex", "available": False,
             "reason": "Tool closure unverified"},
        ]
        self.services = []

    def tearDown(self):
        for service in self.services:
            for stop in list(service._active.values()):
                stop.set()
        deadline = time.monotonic() + 3
        while any(s._active for s in self.services) and time.monotonic() < deadline:
            time.sleep(0.01)
        self.guard.stop()
        self.temporary.cleanup()

    def service(self, run=None, **options):
        def default_run(provider, prompt, cwd, emit, tool, cancel, bridge):
            emit("assistant.delta", {"text": "Hello "})
            emit("assistant.delta", {"text": "world"})
        service = AssistantService(
            self.actions, provider_runner=run or default_run,
            provider_discovery=self.providers,
            query_runner=lambda argv, cancel, source=None: {
                "source": "old\n", "sha256": "a" * 64,
                "externalHoldout": {"secret": "sealed"}},
            **options)
        self.services.append(service)
        return service

    def chat(self, service, **options):
        return service.create({
            "provider": "claude", "project": "ordinary",
            "trialBudget": 1, **options})

    def await_state(self, service, identity, statuses):
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            state = service.view(identity)
            if state["status"] in statuses:
                return state
            time.sleep(0.01)
        self.fail("Conversation did not reach " + repr(statuses))

    def test_streaming_and_durable_reload(self):
        service = self.service()
        chat = self.chat(service)
        service.message({"sessionId": chat["id"], "content": "Explain the verdict"})
        state = self.await_state(service, chat["id"], {"idle"})
        self.assertEqual("Hello world", state["messages"][-1]["content"])
        self.assertEqual("Explain the verdict", state["title"])
        restored = self.service().view(chat["id"])
        self.assertEqual(state["messages"], restored["messages"])
        self.assertEqual(1, restored["trialBudget"])

    def test_provider_fail_closed(self):
        with self.assertRaisesRegex(ActionError, "Tool closure unverified"):
            self.chat(self.service(), provider="codex")

    def test_invalid_budget_and_identifiers(self):
        service = self.service()
        for value in (True, -1, 101, "4"):
            with self.assertRaises(ActionError):
                self.chat(service, trialBudget=value)
        with self.assertRaises(ActionError):
            service.view("../ordinary")

    def test_sealed_context_is_rejected_before_provider(self):
        with self.assertRaisesRegex(ActionError, "Sealed holdout"):
            self.chat(self.service(), project="sealed")

    def test_recursive_projection_scrubbing(self):
        self.assertEqual({"nested": [{"value": 4}]}, clean_result({
            "externalHoldout": {"secret": 1},
            "nested": [{"holdout": {"secret": 2}, "nextActions": [], "value": 4}],
        }))

    def test_cancellation_and_cross_instance_turn_lease(self):
        entered = threading.Event()

        def run(provider, prompt, cwd, emit, tool, stop, bridge):
            entered.set()
            stop.wait(3)
        service = self.service(run)
        chat = self.chat(service)
        service.message({"sessionId": chat["id"], "content": "Start"})
        self.assertTrue(entered.wait(2))
        second = self.service()
        self.assertEqual("running", second.view(chat["id"])["status"])
        with self.assertRaisesRegex(ActionError, "Another Studio"):
            second.message({"sessionId": chat["id"], "content": "Duplicate"})
        service.cancel({"sessionId": chat["id"]})
        state = self.await_state(service, chat["id"], {"cancelled"})
        self.assertEqual(0, state["usedTrials"])

    def test_only_structured_allowlisted_operations(self):
        def run(provider, prompt, cwd, emit, tool, stop, bridge):
            for arguments in (
                {"operation": "shell", "params": {"argv": ["cat", "secret"]}},
                {"operation": "run.show", "params": {"path": "../sealed"}},
                {"operation": "orient", "params": {"project": "sealed"}},
            ):
                with self.assertRaises(ActionError):
                    tool("aq", arguments)
            result = tool("aq", {"operation": "project.list", "params": {}})
            self.assertEqual([{"id": "ordinary", "name": "ordinary"}], result["projects"])
        service = self.service(run)
        chat = self.chat(service)
        service.message({"sessionId": chat["id"], "content": "List"})
        state = self.await_state(service, chat["id"], {"idle", "error"})
        self.assertEqual("idle", state["status"])

    def test_candidate_execution_denied_without_isolation(self):
        def run(provider, prompt, cwd, emit, tool, stop, bridge):
            tool("aq", {"operation": "action.run",
                        "params": {"actionId": "session.start",
                                   "params": {"study": "factor"}}})
        service = self.service(run)
        chat = self.chat(service)
        service.message({"sessionId": chat["id"], "content": "Evaluate"})
        state = self.await_state(service, chat["id"], {"error"})
        self.assertIn("isolation", state["events"][-1]["data"]["message"])
        self.assertEqual([], self.actions.created)
        self.assertEqual(0, state["usedTrials"])

    def _trial(self, fail=False):
        self.actions.fail = fail

        def run(provider, prompt, cwd, emit, tool, stop, bridge):
            tool("aq", {"operation": "action.run",
                        "params": {"actionId": "session.start",
                                   "params": {"study": "factor"}}})
        service = self.service(run, execution_check=lambda project: None)
        chat = self.chat(service)
        service.message({"sessionId": chat["id"], "content": "Evaluate"})
        state = self.await_state(service, chat["id"], {"awaiting-confirmation"})
        pending = state["pendingAction"]
        self.assertEqual([], self.actions.created)
        with self.assertRaises(ActionError):
            service.confirm({"sessionId": chat["id"], "actionId": pending["id"],
                             "accepted": True, "commandHash": "stale",
                             "secondConfirm": True})
        service.confirm({"sessionId": chat["id"], "actionId": pending["id"],
                         "accepted": True, "commandHash": "fixed",
                         "secondConfirm": True})
        state = self.await_state(service, chat["id"], {"idle", "error"})
        self.assertEqual(1, state["usedTrials"])
        self.assertEqual(1, len(self.actions.created))
        return service, chat, state

    def test_confirmation_reserves_hard_budget_and_never_restarts(self):
        service, chat, state = self._trial()
        self.assertEqual("idle", state["status"])
        service.message({"sessionId": chat["id"], "content": "Again"})
        state = self.await_state(service, chat["id"], {"error"})
        self.assertEqual(1, len(self.actions.created))
        self.assertEqual(1, state["usedTrials"])
        self.assertIn("budget", state["events"][-1]["data"]["message"].lower())

    def test_failed_launch_does_not_refund_budget(self):
        _, _, state = self._trial(fail=True)
        self.assertEqual("error", state["status"])
        self.assertEqual(1, state["usedTrials"])

    def test_private_bridge_token_is_not_recoverable_from_state(self):
        service = self.service()
        chat = self.chat(service)
        with self.assertRaises(ActionError):
            service.bridge_tool({"sessionId": chat["id"], "bridgeToken": "wrong",
                                 "arguments": {"operation": "catalog", "params": {}}})
        self.assertNotIn("bridgeToken", service.view(chat["id"]))

    def test_bridge_is_disabled_until_provider_tool_closure_passes(self):
        service = self.service()
        chat = self.chat(service)
        service._bridges[chat["id"]] = "known"
        with self.assertRaises(ActionError):
            service.bridge_tool({"sessionId": chat["id"], "bridgeToken": "known",
                                 "arguments": {"operation": "catalog", "params": {}}})

    def test_close_cancels_turn_and_refuses_new_work(self):
        entered = threading.Event()
        def run(provider, prompt, cwd, emit, tool, stop, bridge):
            entered.set()
            stop.wait(3)
        service = self.service(run)
        chat = self.chat(service)
        service.message({"sessionId": chat["id"], "content": "Start"})
        self.assertTrue(entered.wait(2))
        service.close(timeout=2)
        self.assertFalse(service._active)
        self.assertEqual("cancelled", service.view(chat["id"])["status"])
        with self.assertRaisesRegex(ActionError, "closed"):
            service.message({"sessionId": chat["id"], "content": "Again"})

    def test_stale_lock_file_is_not_an_active_lock(self):
        service = self.service()
        chat = self.chat(service)
        service._path(chat["id"]).with_suffix(".lock").write_bytes(b"0")
        self.assertEqual(chat["id"], service.view(chat["id"])["id"])

    def test_mcp_unknown_tool_cannot_call_http(self):
        result = dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                           "params": {"name": "shell", "arguments": {}}})
        self.assertTrue(result["result"]["isError"])



class AssistantHTTPTests(unittest.TestCase):
    def test_existing_http_gates_and_incremental_turn(self):
        import http.client
        import json
        from autoquant.studio import create_studio_server
        from tests.study_helpers import make_project
        with tempfile.TemporaryDirectory(prefix="aq-assistant-http-") as directory:
            workspace, project = make_project(directory)
            server = create_studio_server(workspace.root_dir, port=0, allow_actions=True)
            service = server.actions.assistant
            service._providers = lambda: [
                {"id": "claude", "label": "Claude", "available": True, "reason": None}]
            service._run_provider = lambda provider, prompt, cwd, emit, tool, cancel, bridge: emit(
                "assistant.delta", {"text": "Verified fake HTTP turn"})
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()

            def request(method, path, body=None, authorized=True):
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
                headers = {"Content-Type": "application/json"}
                if authorized:
                    headers["X-Studio-Token"] = server.actions.token
                connection.request(method, path,
                                   json.dumps(body) if body is not None else None, headers)
                response = connection.getresponse()
                payload = json.loads(response.read())
                connection.close()
                return response.status, payload

            try:
                self.assertEqual(403, request("GET", "/api/v1/assistant", authorized=False)[0])
                self.assertEqual(200, request("GET", "/api/v1/assistant")[0])
                status, payload = request("POST", "/api/v1/assistant/sessions", {
                    "provider": "claude", "project": project.manifest.id, "trialBudget": 2})
                self.assertEqual(200, status, payload)
                identity = payload["data"]["id"]
                self.assertEqual(202, request("POST", "/api/v1/assistant/message", {
                    "sessionId": identity, "content": "Explain"})[0])
                deadline = time.monotonic() + 3
                while time.monotonic() < deadline:
                    status, payload = request("GET", "/api/v1/assistant/session?id=" + identity)
                    if payload["data"]["status"] == "idle":
                        break
                    time.sleep(0.01)
                self.assertEqual("Verified fake HTTP turn",
                                 payload["data"]["messages"][-1]["content"])
                self.assertEqual(400, request("POST", "/api/v1/assistant/message", [1, 2])[0])
            finally:
                server.shutdown()
                server.server_close()


class CandidateCommandTests(unittest.TestCase):
    def test_cli_candidate_save_conflicts_with_studio_project_lease(self):
        from autoquant.candidate_commands import candidate_access
        from autoquant.studio import create_studio_server
        from autoquant.sessions import start_session
        from autoquant.studies import create_study
        from tests.study_helpers import make_project, study_definition
        with tempfile.TemporaryDirectory(prefix="aq-candidate-lock-") as directory:
            workspace, project = make_project(directory)
            create_study(project, study_definition())
            session = start_session(project, "factor-quality")
            server = create_studio_server(workspace.root_dir, port=0, allow_actions=True)
            try:
                previous = candidate_access(str(workspace.root_dir), project.manifest.id,
                                            session.manifest["id"])
                with server.actions.runner.hold(project.manifest.id):
                    with self.assertRaisesRegex(ActionError, "Another Studio"):
                        candidate_access(str(workspace.root_dir), project.manifest.id,
                                         session.manifest["id"], source=previous["source"] + "\n",
                                         base_sha256=previous["sha256"])
                saved = candidate_access(str(workspace.root_dir), project.manifest.id,
                                         session.manifest["id"], source=previous["source"] + "\n",
                                         base_sha256=previous["sha256"])
                self.assertTrue(saved["changed"])
            finally:
                server.server_close()

    def test_candidate_public_cli_uses_existing_confined_editor(self):
        import hashlib
        import io
        import json
        import sys
        from autoquant.cli import main
        from autoquant.sessions import start_session
        from autoquant.studies import create_study
        from tests.study_helpers import make_project, study_definition
        with tempfile.TemporaryDirectory(prefix="aq-candidate-cli-") as directory:
            workspace, project = make_project(directory)
            create_study(project, study_definition())
            session = start_session(project, "factor-quality")
            prefix = [str(workspace.root_dir), "--project", project.manifest.id,
                      "--session", session.manifest["id"], "--json"]
            with patch("sys.stdout", new_callable=io.StringIO) as output:
                self.assertEqual(0, main(["candidate", "show", *prefix]))
                previous = json.loads(output.getvalue())["data"]
            source = previous["source"] + "\n# Candidate CLI test\n"
            with patch("sys.stdin", SimpleNamespace(buffer=io.BytesIO(source.encode()))), \
                 patch("sys.stdout", new_callable=io.StringIO) as output:
                self.assertEqual(0, main(["candidate", "save", *prefix,
                                         "--base-sha256", previous["sha256"], "--source-stdin"]))
                saved = json.loads(output.getvalue())["data"]
            self.assertEqual(hashlib.sha256(source.encode()).hexdigest(), saved["sha256"])
            with patch("sys.stdin", SimpleNamespace(buffer=io.BytesIO(source.encode()))), \
                 patch("sys.stdout", new_callable=io.StringIO) as output:
                self.assertEqual(1, main(["candidate", "save", *prefix,
                                         "--base-sha256", previous["sha256"], "--source-stdin"]))
                self.assertFalse(json.loads(output.getvalue())["ok"])

if __name__ == "__main__":
    unittest.main()
