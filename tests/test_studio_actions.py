from __future__ import annotations

import hashlib
import http.client
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from autoquant import studio_actions
from autoquant.sessions import start_session
from autoquant.studies import create_study
from autoquant.studio import build_studio_snapshot, create_studio_server
from autoquant.studio_actions import (
    ActionError,
    confine_workspace_path,
    default_spawn,
    is_loopback_host,
    scrubbed_environment,
)
from autoquant.workspace import create_project
from tests.study_helpers import make_project, study_definition


HYPOTHESIS = "Lift the synthetic score with a slightly larger constant."
EVALUATE_JSON = json.dumps(
    {
        "ok": True,
        "data": {
            "experiment": {
                "id": "exp-0001-abc",
                "candidate": {"runId": "run-xyz"},
            }
        },
    }
).encode()


def guarded_subprocess():
    """Replace the subprocess module seen by studio_actions only."""
    return mock.patch.object(
        studio_actions,
        "subprocess",
        SimpleNamespace(
            Popen=mock.Mock(name="Popen"),
            run=mock.Mock(name="run"),
            TimeoutExpired=subprocess.TimeoutExpired,
            SubprocessError=subprocess.SubprocessError,
            DEVNULL=subprocess.DEVNULL,
            PIPE=subprocess.PIPE,
            CREATE_NEW_PROCESS_GROUP=512,
            CREATE_NO_WINDOW=0x08000000,
        ),
    )


class FakeHandle:
    def __init__(
        self,
        out: bytes = b"",
        err: bytes = b"",
        exit_code: int = 0,
        block: bool = False,
    ) -> None:
        self.stdout = io.BytesIO(out)
        self.stderr = io.BytesIO(err)
        self.returncode: int | None = None
        self._exit_code = exit_code
        self._block = block
        self.release = threading.Event()
        self.killed = False

    def wait(self, timeout: float | None = None) -> int:
        if self._block and not self.release.wait(timeout):
            raise subprocess.TimeoutExpired("fake", timeout or 0)
        if self.returncode is None:
            self.returncode = self._exit_code
        return self.returncode

    def kill_tree(self) -> None:
        self.killed = True
        self._exit_code = -9
        self.release.set()


class FakeSpawn:
    def __init__(self, **handle_args) -> None:
        self.handle_args = handle_args
        self.calls: list[tuple[list[str], dict[str, str], str]] = []
        self.handles: list[FakeHandle] = []

    def __call__(self, argv, env, cwd) -> FakeHandle:
        self.calls.append((argv, env, cwd))
        handle = FakeHandle(**self.handle_args)
        self.handles.append(handle)
        return handle


class StudioActionsTests(unittest.TestCase):
    def _setup(self, directory: str, *, change: bool = True):
        workspace, project = make_project(directory)
        create_study(project, study_definition())
        session = start_session(project, "factor-quality")
        if change:
            (session.worktree_project.root_dir / "factors/candidate.py").write_bytes(
                b"SCORE = 2.0\n"
            )
        return workspace, project, session

    def _serve(self, workspace, **options):
        server = create_studio_server(
            workspace.root_dir,
            port=0,
            allow_actions=True,
            action_options=options,
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return server

    def _request(
        self,
        server,
        method: str,
        path: str,
        body=None,
        *,
        headers: dict[str, str] | None = None,
        token: bool = True,
        json_type: bool = True,
        raw_body: bytes | None = None,
    ):
        port = server.server_port
        merged: dict[str, str] = {}
        if token and server.actions is not None:
            merged["X-Studio-Token"] = server.actions.token
        if json_type:
            merged["Content-Type"] = "application/json"
        merged.update(headers or {})
        payload = raw_body if raw_body is not None else (
            json.dumps(body).encode() if body is not None else None
        )
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        try:
            connection.request(method, path, body=payload, headers=merged)
            response = connection.getresponse()
            data = response.read()
            parsed = json.loads(data) if data[:1] == b"{" else data
            return response.status, parsed
        finally:
            connection.close()

    def _params(self, session, hypothesis: str = HYPOTHESIS) -> dict:
        return {
            "actionId": "experiment.evaluate",
            "project": "factor-project",
            "params": {
                "session": session.manifest["id"],
                "hypothesis": hypothesis,
            },
        }

    def _preview(self, server, session, hypothesis: str = HYPOTHESIS) -> dict:
        status, payload = self._request(
            server, "POST", "/api/v1/actions/preview", self._params(session, hypothesis)
        )
        self.assertEqual(status, 200, payload)
        return payload["data"]

    def _create(self, server, session, preview, **overrides):
        body = {
            **self._params(session, preview["params"]["hypothesis"]),
            "confirm": True,
            "commandHash": preview["commandHash"],
            "secondConfirm": True,
            **overrides,
        }
        return self._request(server, "POST", "/api/v1/actions", body)

    def _wait(self, server, job_id: str, *, until=("succeeded", "failed", "cancelled", "timed-out")):
        deadline = time.time() + 20
        while time.time() < deadline:
            status, payload = self._request(
                server, "GET", f"/api/v1/jobs/{job_id}", json_type=False
            )
            self.assertEqual(status, 200, payload)
            if payload["data"]["status"] in until:
                server.actions.runner.get(job_id).done.wait(10)
                return payload["data"]
            time.sleep(0.02)
        self.fail("job did not finish")

    # 3. flag off -------------------------------------------------------------

    def test_without_flag_actions_do_not_exist_and_post_stays_read_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = create_studio_server(workspace.root_dir, port=0)
            self.assertIsNone(server.actions)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
            for method, path in (
                ("GET", "/api/v1/actions"),
                ("GET", "/api/v1/jobs"),
                ("GET", "/api/v1/jobs/job-1"),
            ):
                status, _ = self._request(server, method, path, token=False)
                self.assertEqual(status, 404, path)
            for path in (
                "/api/v1/actions",
                "/api/v1/actions/preview",
                "/api/v1/jobs/job-1/cancel",
            ):
                status, payload = self._request(
                    server, "POST", path, self._params(session), token=False
                )
                self.assertEqual(status, 405, path)
                self.assertEqual(payload["error"]["code"], "studio.read-only")
            status, health = self._request(server, "GET", "/api/v1/health")
            self.assertEqual(health["mode"], "read-only")
            for path in ("/api/v1/snapshot", "/api/v1/workspace", "/api/v1/project?id=factor-project"):
                status, snapshot = self._request(server, "GET", path)
                self.assertEqual(status, 200)
                self.assertNotIn("actions", snapshot)
            self.assertFalse((workspace.root_dir / ".autoquant").exists())

    def test_cli_snapshot_never_carries_actions_or_token(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, _ = self._setup(directory)
            self.assertNotIn("actions", build_studio_snapshot(workspace.root_dir))

    def test_cli_flag_is_listed_and_refused_for_remote_hosts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, _ = self._setup(directory)
            result = subprocess.run(
                [
                    sys.executable, "-m", "autoquant", "studio", "serve",
                    str(workspace.root_dir), "--host", "0.0.0.0", "--port", "0",
                    "--no-open", "--allow-actions",
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("loopback", result.stdout + result.stderr)
            capabilities = subprocess.run(
                [sys.executable, "-m", "autoquant", "capabilities", "--json"],
                capture_output=True,
                text=True,
                timeout=60,
            )
            serve = next(
                item
                for item in json.loads(capabilities.stdout)["data"]["commands"]
                if item["id"] == "studio.serve"
            )
            names = [argument["name"] for argument in serve["arguments"]]
            self.assertIn("allow-actions", names)

    def test_non_loopback_host_is_refused_in_process(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, _ = self._setup(directory)
            for host in ("0.0.0.0", "192.168.1.5", "::", "example.com"):
                with self.assertRaisesRegex(ValueError, "loopback"):
                    create_studio_server(
                        workspace.root_dir, port=0, host=host, allow_actions=True
                    )
        for host in ("127.0.0.1", "localhost", "::1"):
            self.assertTrue(is_loopback_host(host))

    # 1/2. host, origin, csrf, token ------------------------------------------

    def test_enabled_snapshot_carries_token_and_gates_hold(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            token = server.actions.token
            for path in ("/api/v1/snapshot", "/api/v1/workspace", "/api/v1/project?id=factor-project"):
                status, payload = self._request(server, "GET", path)
                self.assertEqual(status, 200)
                self.assertEqual(payload["actions"]["enabled"], True)
                self.assertEqual(payload["actions"]["token"], token)
                self.assertEqual(payload["actions"]["tokenHeader"], "X-Studio-Token")
            self.assertEqual(self._request(server, "GET", "/api/v1/health")[1]["mode"], "local-actions")
            port = server.server_port

            # Host allowlist applies to GET and POST, including a missing Host.
            for host in ("evil.example", f"127.0.0.1:{port + 1}", f"localhost:{port + 1}", "127.0.0.1"):
                for method in ("GET", "POST"):
                    status, payload = self._request(
                        server, method, "/api/v1/snapshot",
                        {} if method == "POST" else None,
                        headers={"Host": host},
                    )
                    self.assertEqual((status, payload["error"]["code"]), (403, "studio.host"), (host, method))
            for host in (f"localhost:{port}", f"[::1]:{port}", f"127.0.0.1:{port}"):
                status, _ = self._request(
                    server, "GET", "/api/v1/health", headers={"Host": host}
                )
                self.assertEqual(status, 200, host)
            raw = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
            raw.putrequest("GET", "/api/v1/health", skip_host=True)
            raw.endheaders()
            self.assertEqual(raw.getresponse().status, 403)
            raw.close()

            body = self._params(session)
            url = "/api/v1/actions/preview"
            cases = {
                "no token": dict(token=False),
                "wrong token": dict(headers={"X-Studio-Token": "nope"}),
                "form content type": dict(headers={"Content-Type": "application/x-www-form-urlencoded"}),
                "text plain": dict(headers={"Content-Type": "text/plain"}),
                "foreign origin": dict(headers={"Origin": "http://evil.example"}),
                "other port origin": dict(headers={"Origin": f"http://127.0.0.1:{port + 1}"}),
                "cross-site": dict(headers={"Sec-Fetch-Site": "cross-site"}),
                "same-site": dict(headers={"Sec-Fetch-Site": "same-site"}),
            }
            expected = {
                "no token": "studio.token",
                "wrong token": "studio.token",
                "form content type": "studio.content-type",
                "text plain": "studio.content-type",
                "foreign origin": "studio.origin",
                "other port origin": "studio.origin",
                "cross-site": "studio.origin",
                "same-site": "studio.origin",
            }
            for name, kwargs in cases.items():
                status, payload = self._request(server, "POST", url, body, **kwargs)
                self.assertIn(status, (403, 415), name)
                self.assertEqual(payload["error"]["code"], expected[name], name)
            status, payload = self._request(server, "OPTIONS", url, json_type=False)
            self.assertEqual(status, 405)
            status, payload = self._request(server, "GET", "/api/v1/actions", token=False)
            self.assertEqual((status, payload["error"]["code"]), (403, "studio.token"))
            status, payload = self._request(server, "GET", "/api/v1/jobs/job-x", token=False)
            self.assertEqual(status, 403)
            self.assertEqual(spawn.calls, [])
            # Correct token with same origin passes.
            for headers in (
                {"Origin": f"http://127.0.0.1:{port}"},
                {"Origin": f"http://localhost:{port}"},
                {"Sec-Fetch-Site": "same-origin"},
                {"Sec-Fetch-Site": "none"},
                {"Content-Type": "application/json; charset=utf-8"},
            ):
                status, _ = self._request(server, "POST", url, body, headers=headers)
                self.assertEqual(status, 200, headers)
            # Unknown POST paths stay read-only; no CORS headers appear.
            status, payload = self._request(server, "POST", "/api/v1/snapshot", {})
            self.assertEqual((status, payload["error"]["code"]), (405, "studio.read-only"))
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
            connection.request("GET", "/api/v1/snapshot")
            response = connection.getresponse()
            response.read()
            self.assertIsNone(response.getheader("Access-Control-Allow-Origin"))
            self.assertEqual(response.getheader("Cache-Control"), "no-store")
            connection.close()

    def test_bad_bodies_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace, spawn=FakeSpawn())
            status, payload = self._request(
                server, "POST", "/api/v1/actions/preview", raw_body=b"{not json"
            )
            self.assertEqual((status, payload["error"]["code"]), (400, "studio.bad-request"))
            status, payload = self._request(
                server, "POST", "/api/v1/actions/preview", raw_body=b"x" * (70 * 1024)
            )
            self.assertEqual(status, 400)
            status, payload = self._request(
                server, "POST", "/api/v1/actions/preview", [1, 2]
            )
            self.assertEqual(status, 422)

    # 4. validation / confinement ---------------------------------------------

    def test_unknown_action_and_parameter_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            url = "/api/v1/actions/preview"
            sid = session.manifest["id"]
            status, payload = self._request(
                server, "POST", url, {**self._params(session), "actionId": "holdout.run"}
            )
            self.assertEqual((status, payload["error"]["code"]), (404, "studio.unknown-action"))
            for action_id in ("report.publish", "session.complete", "candidate.delete", "", None):
                status, payload = self._request(
                    server, "POST", url, {**self._params(session), "actionId": action_id}
                )
                self.assertEqual(status, 404, action_id)
            bad_params = [
                {"session": sid},
                {"hypothesis": HYPOTHESIS},
                {"session": sid, "hypothesis": "short"},
                {"session": sid, "hypothesis": "x" * 501},
                {"session": sid, "hypothesis": "--help me please now"},
                {"session": sid, "hypothesis": "line one\nline two is here"},
                {"session": sid, "hypothesis": "tab\tseparated hypothesis"},
                {"session": sid, "hypothesis": " padded hypothesis text "},
                {"session": sid, "hypothesis": 12345678},
                {"session": sid, "hypothesis": HYPOTHESIS, "extra": "1"},
                {"session": 5, "hypothesis": HYPOTHESIS},
                "string",
            ]
            for params in bad_params:
                status, payload = self._request(
                    server, "POST", url, {**self._params(session), "params": params}
                )
                self.assertEqual(status, 422, params)
                self.assertEqual(payload["error"]["code"], "validation.failed")
            # Path-like ids never reach Core: pattern and membership both refuse.
            outside = str(Path(directory).resolve())
            for evil in ("../x", "..\\..\\x", outside, "C:\\Windows", "/etc/passwd", "s/../..", "a b"):
                status, payload = self._request(
                    server, "POST", url,
                    {**self._params(session), "params": {"session": evil, "hypothesis": HYPOTHESIS}},
                )
                self.assertEqual(status, 422, evil)
            for evil in ("../factor-project", outside, "nope", "C:\\x", 5, None):
                status, _ = self._request(
                    server, "POST", url, {**self._params(session), "project": evil}
                )
                self.assertEqual(status, 422, evil)
            status, payload = self._request(
                server, "POST", url,
                {**self._params(session), "params": {"session": "ghost-0001", "hypothesis": HYPOTHESIS}},
            )
            self.assertEqual(status, 422)
            self.assertEqual(spawn.calls, [])

    def test_workspace_path_confinement_helper(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "ws"
            root.mkdir()
            inside = root / "staging" / "a.json"
            inside.parent.mkdir()
            inside.write_text("{}")
            self.assertEqual(confine_workspace_path(root, "staging/a.json", "p"), inside.resolve())
            outside = Path(directory).resolve() / "outside.json"
            outside.write_text("{}")
            attempts = ["../outside.json", "staging/../../outside.json", str(outside), "C:\\Windows\\win.ini", "/etc/passwd", "", "a\nb"]
            link = root / "link"
            try:
                link.symlink_to(outside.parent, target_is_directory=True)
                attempts.append("link/outside.json")
            except (OSError, NotImplementedError):
                pass
            for attempt in attempts:
                with self.assertRaises(ActionError, msg=attempt):
                    confine_workspace_path(root, attempt, "p")

    # 5/6. argv, no shell, preview and confirm --------------------------------

    def test_preview_returns_exact_argv_hash_and_trial(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            preview = self._preview(server, session)
            self.assertEqual(
                preview["argv"],
                [
                    sys.executable, "-m", "autoquant", "experiment", "evaluate",
                    str(workspace.root_dir.resolve()), "--project", "factor-project",
                    "--session", session.manifest["id"], "--hypothesis", HYPOTHESIS, "--json",
                ],
            )
            self.assertTrue(preview["commandHash"].startswith("sha256:"))
            self.assertEqual(preview["trial"]["n"], 1)
            # Candidate trial 1 of 2 family source trials (baseline counts).
            self.assertEqual(preview["trial"]["m"], 2)
            self.assertIn("fresh external holdout", preview["trial"]["notice"])
            self.assertTrue(preview["requiresSecondConfirm"])
            self.assertEqual(preview, self._preview(server, session))
            self.assertEqual(spawn.calls, [])
            status, catalog = self._request(server, "GET", "/api/v1/actions", json_type=False)
            self.assertEqual(status, 200)
            action = catalog["data"]["actions"][0]
            self.assertEqual(action["id"], "experiment.evaluate")
            self.assertEqual(action["targets"][0]["sessions"][0]["available"], True)

    def test_shell_metacharacters_are_one_inert_argv_element_and_no_shell(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn(out=EVALUATE_JSON)
            server = self._serve(workspace, spawn=spawn)
            hostile = "x; rm -rf / && $(id) `id` | tee > out 'q' \"d\" %PATH% ^&"
            with guarded_subprocess() as guard:
                preview = self._preview(server, session, hostile)
                status, payload = self._create(server, session, preview)
                self.assertEqual(status, 202, payload)
                self._wait(server, payload["data"]["jobId"])
                guard.Popen.assert_not_called()
                guard.run.assert_not_called()
            argv, _, cwd = spawn.calls[0]
            self.assertIsInstance(argv, list)
            self.assertTrue(all(isinstance(item, str) for item in argv))
            self.assertEqual(argv.count(hostile), 1)
            self.assertEqual(argv[argv.index("--hypothesis") + 1], hostile)
            self.assertEqual(cwd, str(workspace.root_dir.resolve()))

    def test_default_spawn_never_uses_a_shell(self) -> None:
        with guarded_subprocess() as guard:
            default_spawn(["python", "-V"], {"A": "1"}, ".")
        popen = guard.Popen
        _, kwargs = popen.call_args
        self.assertIs(kwargs["shell"], False)
        self.assertIsInstance(popen.call_args.args[0], list)
        self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)

    def test_create_rejects_without_confirm_hash_or_second_confirm(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            preview = self._preview(server, session)
            url = "/api/v1/actions"
            base = {
                **self._params(session),
                "confirm": True,
                "commandHash": preview["commandHash"],
                "secondConfirm": True,
            }
            cases = [
                ({"confirm": False}, 400, "studio.confirm-required"),
                ({"confirm": "true"}, 400, "studio.confirm-required"),
                ({"commandHash": "sha256:" + "0" * 64}, 409, "studio.stale-preview"),
                ({"commandHash": None}, 409, "studio.stale-preview"),
                ({"secondConfirm": False}, 400, "studio.second-confirm-required"),
                ({"secondConfirm": None}, 400, "studio.second-confirm-required"),
            ]
            for override, status, code in cases:
                got, payload = self._request(server, "POST", url, {**base, **override})
                self.assertEqual((got, payload["error"]["code"]), (status, code), override)
            missing = {k: v for k, v in base.items() if k != "confirm"}
            got, payload = self._request(server, "POST", url, missing)
            self.assertEqual(got, 400)
            # A changed hypothesis changes the argv and therefore the hash.
            changed = {**base, "params": {**base["params"], "hypothesis": HYPOTHESIS + " v2"}}
            got, payload = self._request(server, "POST", url, changed)
            self.assertEqual((got, payload["error"]["code"]), (409, "studio.stale-preview"))
            # State change between preview and create invalidates the hash.
            (session.worktree_project.root_dir / "factors/candidate.py").write_text("SCORE = 3.0\n")
            got, payload = self._request(server, "POST", url, base)
            self.assertEqual((got, payload["error"]["code"]), (409, "studio.stale-preview"))
            self.assertEqual(spawn.calls, [])

    def test_blocked_preconditions_stale_unchanged_and_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory, change=False)
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            url = "/api/v1/actions/preview"
            # Unchanged candidate.
            status, payload = self._request(server, "POST", url, self._params(session))
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.blocked"))
            self.assertIn("does not differ", payload["error"]["message"])
            catalog = self._request(server, "GET", "/api/v1/actions", json_type=False)[1]
            entry = catalog["data"]["actions"][0]["targets"][0]["sessions"][0]
            self.assertFalse(entry["available"])
            self.assertIn("does not differ", entry["blockedBy"])
            # Changed candidate becomes available.
            (session.worktree_project.root_dir / "factors/candidate.py").write_text("SCORE = 2.0\n")
            self.assertEqual(self._request(server, "POST", url, self._params(session))[0], 200)
            # Stale: a fixed file inside the Session worktree was modified.
            judge = session.worktree_project.root_dir / "judges/evaluate.py"
            judge.write_text(judge.read_text() + "\n# tampered\n")
            status, payload = self._request(server, "POST", url, self._params(session))
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.blocked"))
            self.assertIn("stale", payload["error"]["message"])
            entry = self._request(server, "GET", "/api/v1/actions", json_type=False)[1][
                "data"]["actions"][0]["targets"][0]["sessions"][0]
            self.assertFalse(entry["available"])
            judge.write_text(judge.read_text().replace("\n# tampered\n", ""))
            # Closed Session.
            closed = SimpleNamespace(id=session.manifest["id"], status="completed")
            with mock.patch.object(studio_actions, "list_sessions", return_value=[closed]):
                status, payload = self._request(server, "POST", url, self._params(session))
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.blocked"))
            self.assertIn("not active", payload["error"]["message"])
            self.assertEqual(spawn.calls, [])

    # 7. runner ---------------------------------------------------------------

    def test_second_job_in_same_project_is_busy_but_other_project_runs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, project, session = self._setup(directory)
            spawn = FakeSpawn(block=True)
            server = self._serve(workspace, spawn=spawn)
            preview = self._preview(server, session)
            status, first = self._create(server, session, preview)
            self.assertEqual(status, 202)
            job_id = first["data"]["jobId"]
            status, second = self._create(server, session, preview)
            self.assertEqual((status, second["error"]["code"]), (409, "studio.busy"))
            self.assertIn(job_id, second["error"]["message"])
            runner = server.actions.runner
            self.assertEqual(runner.active_job("factor-project"), job_id)
            # A different Project is independent.
            runner.create(
                action_id="experiment.evaluate", project="other", argv=["x"],
                display="x", command_hash="h", timeout=5, cwd=str(workspace.root_dir),
            )
            self.assertEqual(len(spawn.calls), 2)
            for handle in spawn.handles:
                handle.release.set()
            self._wait(server, job_id)
            time.sleep(0.3)
            self.assertIsNone(runner.active_job("factor-project"))
            # Slot is free again after the first job ended.
            preview = self._preview(server, session)
            status, third = self._create(server, session, preview)
            self.assertEqual(status, 202)
            spawn.handles[-1].release.set()
            self._wait(server, third["data"]["jobId"])

    def test_timeout_kills_process_and_marks_job(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn(block=True)
            server = self._serve(
                workspace, spawn=spawn, timeouts={"experiment.evaluate": 0.2}
            )
            preview = self._preview(server, session)
            self.assertEqual(preview["timeoutSeconds"], 0.2)
            status, payload = self._create(server, session, preview)
            job = self._wait(server, payload["data"]["jobId"])
            self.assertEqual(job["status"], "timed-out")
            self.assertTrue(spawn.handles[0].killed)

    def test_output_cap_truncates_and_flags(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn(out=b"A" * 5000 + b"END", err=b"e" * 3000, exit_code=3)
            server = self._serve(workspace, spawn=spawn, output_cap=1024)
            preview = self._preview(server, session)
            status, payload = self._create(server, session, preview)
            job = self._wait(server, payload["data"]["jobId"])
            self.assertEqual(job["status"], "failed")
            self.assertEqual(job["exitCode"], 3)
            self.assertTrue(job["truncated"])
            self.assertEqual(len(job["stdoutTail"]), 1024)
            self.assertTrue(job["stdoutTail"].endswith("END"))
            self.assertLessEqual(len(job["stderrTail"]), 1024)
            self.assertIsNone(job["result"])

    def test_cancel_ends_process_and_is_noop_after_finish(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn(block=True)
            server = self._serve(workspace, spawn=spawn)
            preview = self._preview(server, session)
            status, payload = self._create(server, session, preview)
            job_id = payload["data"]["jobId"]
            status, cancelled = self._request(
                server, "POST", f"/api/v1/jobs/{job_id}/cancel", {}
            )
            self.assertEqual(status, 200)
            self.assertEqual(cancelled["data"]["status"], "cancelled")
            self.assertTrue(spawn.handles[0].killed)
            status, again = self._request(server, "POST", f"/api/v1/jobs/{job_id}/cancel", {})
            self.assertEqual(again["data"]["status"], "cancelled")
            status, payload = self._request(server, "POST", "/api/v1/jobs/job-nope/cancel", {})
            self.assertEqual(status, 404)
            status, listing = self._request(server, "GET", "/api/v1/jobs", json_type=False)
            self.assertEqual(listing["data"]["jobs"][0]["jobId"], job_id)

    def test_real_cancel_kills_the_whole_process_tree(self) -> None:
        child = (
            "import subprocess, sys, time\n"
            "p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])\n"
            "print(p.pid, flush=True)\n"
            "time.sleep(60)\n"
        )

        def alive(pid: int) -> bool:
            if os.name == "nt":
                out = subprocess.run(
                    ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                    capture_output=True, text=True,
                ).stdout
                return str(pid) in out
            try:
                os.kill(pid, 0)
            except OSError:
                return False
            return True

        handle = default_spawn(
            [sys.executable, "-c", child], scrubbed_environment(), os.getcwd()
        )
        try:
            grandchild = int(handle.stdout.readline().strip())
            self.assertTrue(alive(grandchild))
            handle.kill_tree()
            handle.wait(timeout=15)
            deadline = time.time() + 15
            while alive(grandchild) and time.time() < deadline:
                time.sleep(0.1)
            self.assertFalse(alive(grandchild))
        finally:
            handle.kill_tree()
            handle.stdout.close()
            handle.stderr.close()

    # 8. environment ----------------------------------------------------------

    def test_child_environment_is_scrubbed(self) -> None:
        planted = {
            "AQ_TEST_API_TOKEN": "t",
            "AQ_TEST_SECRET": "s",
            "AQ_TEST_KEY": "k",
            "AQ_TEST_PASSWORD": "p",
            "UV_TEST_TOKEN": "u",
            "AQ_UNLISTED": "x",
            "UV_CACHE_DIR": "D:/tmp/uv",
        }
        with mock.patch.dict(os.environ, planted):
            clean = scrubbed_environment()
        for name in ("AQ_TEST_API_TOKEN", "AQ_TEST_SECRET", "AQ_TEST_KEY", "AQ_TEST_PASSWORD", "UV_TEST_TOKEN", "AQ_UNLISTED"):
            self.assertNotIn(name, clean)
        self.assertEqual(clean["UV_CACHE_DIR"], "D:/tmp/uv")
        self.assertEqual(clean["PYTHONUTF8"], "1")
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn(out=EVALUATE_JSON)
            server = self._serve(workspace, spawn=spawn)
            with mock.patch.dict(os.environ, planted):
                preview = self._preview(server, session)
                status, payload = self._create(server, session, preview)
                self._wait(server, payload["data"]["jobId"])
            env = spawn.calls[0][1]
            self.assertFalse([n for n in env if "TOKEN" in n.upper() or "SECRET" in n.upper() or "KEY" in n.upper()])
            self.assertNotIn(server.actions.token, env.values())

    # 9. audit ----------------------------------------------------------------

    def test_audit_log_is_append_only_ordered_and_token_free(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn(out=EVALUATE_JSON)
            server = self._serve(workspace, spawn=spawn)
            ids = []
            for _ in range(2):
                preview = self._preview(server, session)
                status, payload = self._create(server, session, preview)
                self.assertEqual(status, 202)
                ids.append(payload["data"]["jobId"])
                job = self._wait(server, payload["data"]["jobId"])
                self.assertEqual(job["status"], "succeeded")
                self.assertEqual(
                    job["createdRefs"], {"experimentId": "exp-0001-abc", "runId": "run-xyz"}
                )
                self.assertEqual(job["result"]["data"]["experiment"]["id"], "exp-0001-abc")
            log = workspace.root_dir.resolve() / ".autoquant" / "studio-actions.jsonl"
            text = log.read_text(encoding="utf-8")
            self.assertNotIn(server.actions.token, text)
            lines = [json.loads(line) for line in text.splitlines()]
            self.assertEqual(
                [(line["event"], line["jobId"]) for line in lines],
                [("started", ids[0]), ("finished", ids[0]), ("started", ids[1]), ("finished", ids[1])],
            )
            started, finished = lines[0], lines[1]
            self.assertEqual(started["schemaVersion"], 1)
            self.assertEqual(started["actionId"], "experiment.evaluate")
            self.assertEqual(started["project"], "factor-project")
            self.assertEqual(started["argv"], spawn.calls[0][0])
            self.assertTrue(started["commandHash"].startswith("sha256:"))
            self.assertEqual(len(started["tokenId"]), 6)
            self.assertEqual(finished["exitCode"], 0)
            self.assertEqual(finished["status"], "succeeded")
            self.assertEqual(finished["createdRefs"]["runId"], "run-xyz")
            self.assertFalse(finished["truncated"])
            # Append-only across a fresh server: earlier lines are preserved.
            server2 = self._serve(workspace, spawn=FakeSpawn())
            server2.actions.audit.append({"event": "probe"})
            self.assertEqual(log.read_text(encoding="utf-8").splitlines()[:4], text.splitlines())

    def test_rejected_requests_leave_no_audit_line(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace, spawn=FakeSpawn())
            self._request(server, "POST", "/api/v1/actions", self._params(session))
            self._preview(server, session)
            self.assertFalse((workspace.root_dir / ".autoquant" / "studio-actions.jsonl").exists())

    # 11. end to end ----------------------------------------------------------

    def test_end_to_end_real_evaluate_through_studio(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace)
            before = next(
                p for p in build_studio_snapshot(workspace.root_dir)["projects"]
            )
            preview = self._preview(server, session)
            self.assertEqual(preview["trial"]["n"], 1)
            status, payload = self._create(server, session, preview)
            self.assertEqual(status, 202, payload)
            job = self._wait(server, payload["data"]["jobId"])
            self.assertEqual(job["status"], "succeeded", job)
            refs = job["createdRefs"]
            self.assertTrue(refs["experimentId"].startswith("exp-"))
            after = next(p for p in build_studio_snapshot(workspace.root_dir)["projects"])
            self.assertEqual(after["counts"]["runs"], before["counts"]["runs"] + 1)
            self.assertIn(refs["runId"], [run["id"] for run in after["runs"]])
            integrity = after["sessions"][0]["selectionIntegrity"]
            self.assertEqual(integrity["candidateTrials"], 1)
            # The next preview counts the second trial.
            (session.worktree_project.root_dir / "factors/candidate.py").write_text("SCORE = 2.5\n")
            second = self._preview(server, session)["trial"]
            self.assertEqual((second["n"], second["m"]), (2, 3))
            log = workspace.root_dir.resolve() / ".autoquant" / "studio-actions.jsonl"
            finished = [json.loads(l) for l in log.read_text().splitlines()][-1]
            self.assertEqual(finished["createdRefs"]["runId"], refs["runId"])


    # session.start / session.check / candidate.save / GET candidate -----------

    def _post(self, server, action_id, params, *, path="/api/v1/actions/preview", **extra):
        body = {"actionId": action_id, "project": "factor-project", "params": params, **extra}
        return self._request(server, "POST", path, body)

    def _sid(self, session) -> str:
        return session.manifest["id"]

    def _candidate_path(self, session) -> Path:
        return session.worktree_project.root_dir / "factors" / "candidate.py"

    def _save(self, server, session, source, base, **extra):
        return self._post(
            server, "candidate.save",
            {"session": self._sid(session), "source": source, "baseSha256": base},
            path="/api/v1/actions", confirm=True, **extra,
        )

    def _get_candidate(self, session, server, **kw):
        return self._request(
            server, "GET",
            f"/api/v1/candidate?project=factor-project&session={self._sid(session)}",
            json_type=False, **kw,
        )

    def test_session_start_preview_second_confirm_and_trial_count(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, project = make_project(directory)
            create_study(project, study_definition())
            start_json = json.dumps(
                {"ok": True, "data": {"session": {"id": "session-x", "baseline": {"runId": "run-b"}}}}
            ).encode()
            spawn = FakeSpawn(out=start_json)
            server = self._serve(workspace, spawn=spawn)
            params = {"study": "factor-quality"}
            status, preview = self._post(server, "session.start", params)
            self.assertEqual(status, 200, preview)
            data = preview["data"]
            self.assertEqual(
                data["argv"],
                [
                    sys.executable, "-m", "autoquant", "session", "start",
                    str(workspace.root_dir.resolve()), "--project", "factor-project",
                    "--study", "factor-quality", "--json",
                ],
            )
            self.assertTrue(data["requiresSecondConfirm"])
            self.assertEqual(data["trial"]["currentFamilyTrials"], 0)
            self.assertIsNone(data["trial"]["familyId"])
            self.assertIn("opens a trial family", data["trial"]["notice"])
            catalog = self._request(server, "GET", "/api/v1/actions", json_type=False)[1]
            ids = [item["id"] for item in catalog["data"]["actions"]]
            self.assertEqual(ids, ["experiment.evaluate", "session.start", "session.check", "candidate.save", "project.create", "project.intake"])
            start = catalog["data"]["actions"][1]
            self.assertEqual(
                start["targets"][0]["studies"],
                [{"study": "factor-quality", "available": True, "blockedBy": None}],
            )
            self.assertTrue(start["requiresSecondConfirm"])
            base = {"confirm": True, "commandHash": data["commandHash"]}
            status, payload = self._post(server, "session.start", params, path="/api/v1/actions", **base)
            self.assertEqual((status, payload["error"]["code"]), (400, "studio.second-confirm-required"))
            status, payload = self._post(
                server, "session.start", params, path="/api/v1/actions", secondConfirm=True, **base
            )
            self.assertEqual(status, 202, payload)
            job = self._wait(server, payload["data"]["jobId"])
            self.assertEqual(job["createdRefs"], {"sessionId": "session-x", "runId": "run-b"})
            self.assertEqual([stage["id"] for stage in job["stages"]], ["preflight", "baseline-run", "session-created"])
            self.assertEqual(len(spawn.calls), 1)

    def test_session_start_blocked_and_trial_count_after_baseline(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, project, session = self._setup(directory, change=False)
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            status, payload = self._post(server, "session.start", {"study": "factor-quality"})
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.blocked"))
            self.assertEqual(
                payload["error"]["message"],
                f"Blocked: Study factor-quality already has active Session {self._sid(session)}",
            )
            catalog = self._request(server, "GET", "/api/v1/actions", json_type=False)[1]
            entry = catalog["data"]["actions"][1]["targets"][0]["studies"][0]
            self.assertFalse(entry["available"])
            self.assertIn("already has active Session", entry["blockedBy"])
            trial = server.actions._start_trial(project, "factor-quality")
            self.assertEqual(trial["currentFamilyTrials"], 1)
            self.assertTrue(trial["familyId"].startswith("family-"))
            self.assertEqual(spawn.calls, [])

    def test_session_start_parameter_schema_and_request_confinement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, project = make_project(directory)
            create_study(project, study_definition())
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            for params in (
                {}, {"study": ""}, {"study": 5}, {"study": "../x"}, {"study": "Factor"},
                {"study": "a" * 65}, {"study": "--help"}, {"study": "factor-quality", "extra": 1},
                {"study": "factor-quality", "request": ""},
                {"study": "factor-quality", "request": 3},
                {"study": "factor-quality", "request": "a\nb"},
                "string",
            ):
                status, payload = self._post(server, "session.start", params)
                self.assertEqual((status, payload["error"]["code"]), (422, "validation.failed"), params)
            status, payload = self._post(server, "session.start", {"study": "ghost"})
            self.assertEqual(status, 422)
            self.assertEqual(payload["error"]["issues"][0]["code"], "study.missing")
            outside = Path(directory).resolve() / "outside.json"
            outside.write_text("{}")
            for evil in ("../outside.json", str(outside), "C:\\Windows\\win.ini", "missing.json"):
                status, payload = self._post(
                    server, "session.start", {"study": "factor-quality", "request": evil}
                )
                self.assertEqual(status, 422, evil)
            inside = workspace.root_dir.resolve() / "staging" / "request.json"
            inside.parent.mkdir(exist_ok=True)
            inside.write_text("{}")
            status, payload = self._post(
                server, "session.start", {"study": "factor-quality", "request": "staging/request.json"}
            )
            self.assertEqual(status, 200, payload)
            argv = payload["data"]["argv"]
            self.assertEqual(argv[-3:], ["--request", str(inside), "--json"])
            self.assertEqual(spawn.calls, [])

    def test_session_check_preview_blocked_and_job(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory, change=False)
            check_json = json.dumps({"ok": True, "data": {"id": "check-1", "status": "passed"}}).encode()
            spawn = FakeSpawn(out=check_json)
            server = self._serve(workspace, spawn=spawn)
            params = {"session": self._sid(session)}
            status, payload = self._post(server, "session.check", params)
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.blocked"))
            self.assertIn("does not differ from the leader", payload["error"]["message"])
            for params_bad in ({}, {"session": "../x"}, {"session": self._sid(session), "extra": 1}, {"session": 5}):
                self.assertEqual(self._post(server, "session.check", params_bad)[0], 422, params_bad)
            self._candidate_path(session).write_text("SCORE = 2.0\n")
            status, preview = self._post(server, "session.check", params)
            self.assertEqual(status, 200, preview)
            data = preview["data"]
            self.assertEqual(data["argv"][3:5], ["session", "check"])
            self.assertEqual(data["argv"][-3:], ["--session", self._sid(session), "--json"])
            self.assertIsNone(data["trial"])
            self.assertFalse(data["requiresSecondConfirm"])
            status, payload = self._post(
                server, "session.check", params, path="/api/v1/actions",
                confirm=True, commandHash=data["commandHash"],
            )
            self.assertEqual(status, 202, payload)
            job = self._wait(server, payload["data"]["jobId"])
            self.assertEqual(job["createdRefs"], {"checkId": "check-1"})
            self.assertEqual(job["stages"][0]["id"], "candidate-check")

    def test_get_candidate_with_actions_off_is_read_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = create_studio_server(workspace.root_dir, port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
            status, payload = self._get_candidate(session, server, token=False)
            self.assertEqual(status, 200, payload)
            data = payload["data"]
            raw = self._candidate_path(session).read_bytes()
            self.assertEqual(data["source"], "SCORE = 2.0\n")
            self.assertEqual(data["sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(data["bytes"], len(raw))
            self.assertFalse(data["editable"])
            self.assertIn("--allow-actions", data["blockedReason"])
            self.assertTrue(data["blockedReason"].startswith("Blocked: "))
            self.assertTrue(data["path"].endswith("worktree/factor-project/factors/candidate.py"), data["path"])
            self.assertFalse(Path(data["path"]).is_absolute())
            for query in (
                "project=nope&session=" + self._sid(session),
                "project=factor-project&session=ghost-1",
                "project=factor-project&session=../x",
                "project=factor-project",
                "",
            ):
                status, payload = self._request(
                    server, "GET", "/api/v1/candidate?" + query, json_type=False, token=False
                )
                self.assertEqual((status, payload["error"]["code"]), (422, "validation.failed"), query)
            status, _ = self._request(
                server, "POST", "/api/v1/actions",
                {"actionId": "candidate.save"}, token=False,
            )
            self.assertEqual(status, 405)
            self.assertFalse((workspace.root_dir / ".autoquant").exists())

    def test_get_candidate_with_actions_on(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace, spawn=FakeSpawn(block=True))
            status, payload = self._get_candidate(session, server, token=False)
            self.assertEqual(status, 200, payload)
            self.assertTrue(payload["data"]["editable"])
            self.assertIsNone(payload["data"]["blockedReason"])
            status, payload = self._get_candidate(session, server, token=False, headers={"Host": "evil.example"})
            self.assertEqual((status, payload["error"]["code"]), (403, "studio.host"))
            closed = SimpleNamespace(id=self._sid(session), status="completed")
            with mock.patch.object(studio_actions, "list_sessions", return_value=[closed]):
                status, payload = self._get_candidate(session, server, token=False)
            self.assertEqual(status, 200)
            self.assertFalse(payload["data"]["editable"])
            self.assertEqual(
                payload["data"]["blockedReason"],
                f"Blocked: Session {self._sid(session)} is completed, not active",
            )
            self.assertEqual(payload["data"]["source"], "SCORE = 2.0\n")

    def test_candidate_save_writes_exact_bytes_and_audits_hashes_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace)
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            marker = "SECRET_MARKER_41"
            source = f"# {marker}\r\nSCORE = 3.5\r\n# caf\u00e9"
            status, preview = self._post(
                server, "candidate.save",
                {"session": self._sid(session), "source": source, "baseSha256": sha},
            )
            self.assertEqual(status, 200, preview)
            self.assertFalse(preview["data"]["requiresSecondConfirm"])
            self.assertTrue(preview["data"]["file"]["changed"])
            self.assertNotIn(marker, json.dumps(preview))
            self.assertEqual(self._candidate_path(session).read_bytes(), b"SCORE = 2.0\n")
            status, payload = self._save(server, session, source, sha)
            self.assertEqual(status, 200, payload)
            data = payload["data"]
            encoded = source.encode("utf-8")
            self.assertEqual(self._candidate_path(session).read_bytes(), encoded)
            self.assertEqual(data["sha256"], hashlib.sha256(encoded).hexdigest())
            self.assertEqual(data["bytes"], len(encoded))
            self.assertEqual(data["previousSha256"], sha)
            self.assertTrue(data["changed"])
            self.assertEqual(data["path"], self._get_candidate(session, server, token=False)[1]["data"]["path"])
            self.assertEqual(list(self._candidate_path(session).parent.glob("*.tmp")), [])
            # The saved file is still inside the editable closure: Session stays valid.
            catalog = self._request(server, "GET", "/api/v1/actions", json_type=False)[1]
            save_action = next(a for a in catalog["data"]["actions"] if a["id"] == "candidate.save")
            self.assertEqual(save_action["targets"][0]["sessions"][0]["available"], True)
            self.assertEqual(save_action["params"]["baseSha256"]["pattern"], "^[0-9a-f]{64}$")
            self.assertFalse(save_action["requiresSecondConfirm"])
            # Same bytes again: unchanged, nothing rewritten.
            status, again = self._save(server, session, source, data["sha256"])
            self.assertEqual(status, 200)
            self.assertFalse(again["data"]["changed"])
            log = (workspace.root_dir.resolve() / ".autoquant" / "studio-actions.jsonl").read_text(encoding="utf-8")
            self.assertNotIn(marker, log)
            self.assertNotIn("SCORE", log)
            records = [json.loads(line) for line in log.splitlines()]
            started = [r for r in records if r["event"] == "candidate-save-started"]
            finished = [r for r in records if r["event"] == "candidate-save-finished"]
            self.assertEqual(len(started), 2)
            self.assertEqual([r["status"] for r in finished], ["saved", "unchanged"])
            self.assertEqual(started[0]["beforeSha256"], sha)
            self.assertEqual(started[0]["afterSha256"], data["sha256"])
            self.assertEqual(started[0]["beforeBytes"], len(b"SCORE = 2.0\n"))
            self.assertEqual(started[0]["afterBytes"], len(encoded))
            self.assertEqual(started[0]["saveId"], finished[0]["saveId"])
            self.assertNotIn(server.actions.token, log)

    def test_candidate_save_conflict_on_stale_base_leaves_file_untouched(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace)
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            self._candidate_path(session).write_text("SCORE = 9.0\n")
            status, payload = self._save(server, session, "SCORE = 4.0\n", sha)
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.conflict"))
            self.assertEqual(payload["error"]["issues"][0]["code"], "candidate.conflict")
            self.assertIn("reload before saving", payload["error"]["message"])
            self.assertEqual(self._candidate_path(session).read_text(), "SCORE = 9.0\n")
            self.assertFalse((workspace.root_dir / ".autoquant" / "studio-actions.jsonl").exists())

    def test_candidate_save_parameter_schema_rejections(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace)
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            sid = self._sid(session)
            good = {"session": sid, "source": "SCORE = 1.0\n", "baseSha256": sha}
            cases = {
                "no source": {"session": sid, "baseSha256": sha},
                "no base": {"session": sid, "source": "x = 1"},
                "empty source": {**good, "source": ""},
                "non-string source": {**good, "source": 7},
                "NUL": {**good, "source": "a\x00b"},
                "surrogate": {**good, "source": "\ud800"},
                "too big": {**good, "source": "x" * 200_001},
                "too big utf8": {**good, "source": "\u00e9" * 100_001},
                "short base": {**good, "baseSha256": "abc"},
                "upper base": {**good, "baseSha256": sha.upper()},
                "extra": {**good, "extra": 1},
                "bad session": {**good, "session": "../x"},
                "string params": "x",
            }
            for label, params in cases.items():
                status, payload = self._post(server, "candidate.save", params, path="/api/v1/actions", confirm=True)
                self.assertEqual((status, payload["error"]["code"]), (422, "validation.failed"), label)
            status, payload = self._post(
                server, "candidate.save", {**good, "session": "ghost-1"}, path="/api/v1/actions", confirm=True
            )
            self.assertEqual(status, 422)
            self.assertEqual(payload["error"]["issues"][0]["code"], "session.missing")
            for body in ({}, {"confirm": False}):
                status, payload = self._post(server, "candidate.save", good, path="/api/v1/actions", **body)
                self.assertEqual((status, payload["error"]["code"]), (400, "studio.confirm-required"))
            exact = {**good, "source": "x" * 200_000}
            status, _ = self._post(server, "candidate.save", exact, path="/api/v1/actions", confirm=True)
            self.assertEqual(status, 200)
            self.assertEqual(self._candidate_path(session).read_bytes(), b"x" * 200_000)

    def test_candidate_save_blocked_reasons(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            spawn = FakeSpawn(block=True)
            server = self._serve(workspace, spawn=spawn)
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            sid = self._sid(session)
            # Stale: a fixed file in the worktree changed.
            judge = session.worktree_project.root_dir / "judges/evaluate.py"
            judge.write_text(judge.read_text() + "\n# tampered\n")
            status, payload = self._save(server, session, "x = 1\n", sha)
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.blocked"))
            self.assertIn(f"Blocked: Session {sid} is stale; run aq session show to see why", payload["error"]["message"])
            catalog = self._request(server, "GET", "/api/v1/actions", json_type=False)[1]
            save_action = next(a for a in catalog["data"]["actions"] if a["id"] == "candidate.save")
            entry = save_action["targets"][0]["sessions"][0]
            self.assertFalse(entry["available"])
            self.assertIn("is stale", entry["blockedBy"])
            self.assertFalse(self._get_candidate(session, server, token=False)[1]["data"]["editable"])
            judge.write_text(judge.read_text().replace("\n# tampered\n", ""))
            # Closed Session.
            closed = SimpleNamespace(id=sid, status="completed")
            with mock.patch.object(studio_actions, "list_sessions", return_value=[closed]):
                status, payload = self._save(server, session, "x = 1\n", sha)
            self.assertEqual((status, payload["error"]["message"]), (409, f"Blocked: Session {sid} is completed, not active"))
            # Outside the editable closure.
            real_load = studio_actions.load_session

            def narrowed(project, session_id):
                loaded = real_load(project, session_id)
                manifest = {**loaded.manifest, "editablePaths": ["strategies/**"]}
                return SimpleNamespace(
                    manifest=manifest, worktree_project=loaded.worktree_project
                )

            with mock.patch.object(studio_actions, "load_session", narrowed):
                with mock.patch.object(
                    studio_actions, "session_snapshot", return_value={"authority": {"valid": True, "issues": []}}
                ):
                    status, payload = self._save(server, session, "x = 1\n", sha)
            self.assertEqual(status, 409)
            self.assertEqual(
                payload["error"]["message"],
                f"Blocked: factors/candidate.py is not in the editable closure of Session {sid}",
            )
            # Active job for the Project.
            preview = self._preview(server, session)
            status, created = self._create(server, session, preview)
            self.assertEqual(status, 202, created)
            job_id = created["data"]["jobId"]
            status, payload = self._save(server, session, "x = 1\n", sha)
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.busy"))
            self.assertIn(job_id, payload["error"]["message"])
            view = self._get_candidate(session, server, token=False)[1]["data"]
            self.assertFalse(view["editable"])
            self.assertIn(job_id, view["blockedReason"])
            for handle in spawn.handles:
                handle.release.set()
            self._wait(server, job_id)
            time.sleep(0.3)
            self.assertEqual(self._candidate_path(session).read_text(), "SCORE = 2.0\n")

    def test_candidate_save_holds_the_project_slot_while_writing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace, spawn=FakeSpawn())
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            seen: list[str | None] = []
            real_replace = os.replace

            def spying_replace(src, dst):
                seen.append(server.actions.runner.active_job("factor-project"))
                real_replace(src, dst)

            with mock.patch.object(studio_actions.os, "replace", spying_replace):
                status, _ = self._save(server, session, "SCORE = 1.5\n", sha)
            self.assertEqual(status, 200)
            self.assertTrue(seen[0] and seen[0].startswith("hold-"))
            self.assertIsNone(server.actions.runner.active_job("factor-project"))

    def test_candidate_save_is_atomic_when_the_replace_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace)
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            with mock.patch.object(studio_actions.os, "replace", side_effect=OSError("disk full")):
                status, payload = self._save(server, session, "SCORE = 8.0\n", sha)
            self.assertEqual((status, payload["error"]["code"]), (500, "studio.write-failed"))
            self.assertEqual(self._candidate_path(session).read_bytes(), b"SCORE = 2.0\n")
            self.assertEqual(list(self._candidate_path(session).parent.glob("*.tmp")), [])
            log = (workspace.root_dir.resolve() / ".autoquant" / "studio-actions.jsonl").read_text()
            self.assertEqual(json.loads(log.splitlines()[-1])["status"], "failed")
            self.assertIsNone(server.actions.runner.active_job("factor-project"))
            # The slot is free and a retry succeeds.
            self.assertEqual(self._save(server, session, "SCORE = 8.0\n", sha)[0], 200)

    def test_candidate_save_refuses_symlink_and_junction_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace)
            path = self._candidate_path(session)
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            outside = Path(directory).resolve() / "outside.py"
            outside.write_text("SCORE = 0.0\n")
            original = path.read_bytes()
            path.unlink()
            try:
                path.symlink_to(outside)
            except (OSError, NotImplementedError):
                path.write_bytes(original)
                self.skipTest("symlinks are not available")
            status, payload = self._save(server, session, "SCORE = 7.0\n", sha)
            self.assertEqual((status, payload["error"]["code"]), (409, "studio.blocked"), payload)
            self.assertIn("symlink", payload["error"]["message"])
            self.assertEqual(outside.read_text(), "SCORE = 0.0\n")
            self.assertEqual(
                self._get_candidate(session, server, token=False)[0], 404
            )
            path.unlink()
            path.write_bytes(original)

    def test_candidate_save_refuses_a_junctioned_factors_directory(self) -> None:
        if os.name != "nt":
            self.skipTest("junctions are Windows only")
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, session = self._setup(directory)
            server = self._serve(workspace)
            factors = self._candidate_path(session).parent
            sha = self._get_candidate(session, server, token=False)[1]["data"]["sha256"]
            outside = Path(directory).resolve() / "outside-factors"
            outside.mkdir()
            (outside / "candidate.py").write_text("SCORE = 0.0\n")
            backup = factors.with_name("factors-real")
            factors.rename(backup)
            made = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(factors), str(outside)],
                capture_output=True,
            )
            try:
                if made.returncode != 0:
                    self.skipTest("cannot create a junction")
                status, payload = self._save(server, session, "SCORE = 7.0\n", sha)
                # Core rejects a junctioned directory before the candidate check.
                self.assertIn(status, (409, 422), payload)
                self.assertFalse(payload["ok"])
                self.assertEqual((outside / "candidate.py").read_text(), "SCORE = 0.0\n")
            finally:
                if factors.exists():
                    os.rmdir(factors)
                backup.rename(factors)


    def test_idea_project_create_preview_security_and_exact_argv(self) -> None:
        from autoquant.workspace import initialize_workspace
        with tempfile.TemporaryDirectory() as directory:
            workspace = initialize_workspace(Path(directory) / "workspace")
            spawn = FakeSpawn()
            server = self._serve(workspace, spawn=spawn)
            body = {"actionId": "project.create", "project": "my-idea", "params": {
                "id": "my-idea", "name": "A quote ' stays literal", "description": HYPOTHESIS,
                "template": "ohlcv-factor-lab"}}
            _, catalog = self._request(server, "GET", "/api/v1/actions")
            self.assertIn("project.create", [a["id"] for a in catalog["data"]["actions"]])
            status, _ = self._request(server, "POST", "/api/v1/actions/preview", body, token=False)
            self.assertEqual(status, 403)
            status, payload = self._request(server, "POST", "/api/v1/actions/preview", body)
            self.assertEqual(status, 200, payload)
            preview = payload["data"]
            self.assertEqual(preview["argv"][3:5], ["project", "create"])
            self.assertIn(body["params"]["name"], preview["argv"])
            self.assertFalse((workspace.root_dir / "projects/my-idea").exists())
            status, _ = self._request(server, "POST", "/api/v1/actions", {**body, "confirm": True, "commandHash": "stale"})
            self.assertEqual(status, 409)
            status, launched = self._request(server, "POST", "/api/v1/actions", {**body, "confirm": True, "commandHash": preview["commandHash"]})
            self.assertEqual(status, 202, launched)
            server.actions.runner.get(launched["data"]["jobId"]).done.wait(5)
            self.assertEqual(spawn.calls[0][0], preview["argv"])

    def test_idea_create_rejects_traversal_options_unknown_fields_and_templates(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, _ = self._setup(directory)
            server = self._serve(workspace, spawn=FakeSpawn())
            good = {"id": "new-idea", "name": "Idea", "description": HYPOTHESIS, "template": "ohlcv-factor-lab"}
            for override in ({"id": "../escape"}, {"id": "--help"}, {"name": "--help"},
                             {"template": "ohlcv-research-desk"}, {"shell": "echo bad"}, {"description": "a\nb"}):
                status, body = self._request(server, "POST", "/api/v1/actions/preview", {
                    "actionId": "project.create", "params": {**good, **override}})
                self.assertEqual(status, 422, body)

    def test_idea_dataset_discovery_and_stale_data_confirmation(self) -> None:
        from tests.intake_helpers import write_intake_inputs
        from autoquant.workspace import initialize_workspace
        with tempfile.TemporaryDirectory() as directory:
            workspace = initialize_workspace(Path(directory) / "workspace")
            create_project(workspace.root_dir, "new-idea", description=HYPOTHESIS, template="ohlcv-factor-lab")
            server = self._serve(workspace, spawn=FakeSpawn())
            status, empty = self._request(server, "GET", "/api/v1/idea-datasets")
            self.assertEqual(status, 200)
            self.assertEqual(empty["data"]["datasets"], [])
            self.assertIn("Copy-Item", empty["data"]["stagingCommand"])
            staging = workspace.root_dir / "staging"
            staging.mkdir()
            _, package = write_intake_inputs(staging, observations=180)
            status, choices = self._request(server, "GET", "/api/v1/idea-datasets")
            self.assertEqual(len(choices["data"]["datasets"]), 1, choices)
            params = {"dataset": package.relative_to(workspace.root_dir).as_posix(), "horizon": 1, "predictionAssets": ["AAPL", "MSFT"]}
            body = {"actionId": "project.intake", "project": "new-idea", "params": params}
            status, result = self._request(server, "POST", "/api/v1/actions/preview", body)
            self.assertEqual(status, 200, result)
            self.assertEqual(result["data"]["request"]["question"], HYPOTHESIS)
            self.assertEqual(result["data"]["request"]["source"]["system"], "local")
            self.assertFalse((workspace.root_dir / ".autoquant/idea-inputs/new-idea.json").exists())
            with (package.parent / "AAPL.csv").open("a") as file:
                file.write("\n")
            status, _ = self._request(server, "POST", "/api/v1/actions", {**body, "confirm": True, "commandHash": result["data"]["commandHash"]})
            self.assertEqual(status, 409)
            for path in ("../outside.json", str(Path(directory) / "outside.json")):
                status, _ = self._request(server, "POST", "/api/v1/actions/preview", {**body, "params": {**params, "dataset": path}})
                self.assertEqual(status, 422)

    def test_idea_dataset_rejects_asset_escape(self) -> None:
        from tests.intake_helpers import write_intake_inputs
        with tempfile.TemporaryDirectory() as directory:
            workspace, _, _ = self._setup(directory)
            staging = workspace.root_dir / "staging"
            staging.mkdir()
            _, package = write_intake_inputs(staging)
            data = json.loads(package.read_text())
            data["assets"][0]["path"] = "../../outside.csv"
            package.write_text(json.dumps(data))
            server = self._serve(workspace)
            status, listing = self._request(server, "GET", "/api/v1/idea-datasets")
            self.assertEqual(status, 200)
            self.assertEqual(listing["data"]["datasets"], [])
            self.assertIn("package directory", listing["data"]["unavailable"][0]["reason"])

    def test_idea_first_candidate_compare_and_swap_then_run_freeze(self) -> None:
        from autoquant.intake import prepare_project_intake
        from autoquant.workspace import initialize_workspace
        from tests.intake_helpers import write_intake_inputs
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request, package = write_intake_inputs(root, observations=180)
            prepared = prepare_project_intake(request, package, "ohlcv-factor-lab")
            workspace = initialize_workspace(root / "workspace")
            project = create_project(workspace.root_dir, "new-idea", template=prepared.template, template_intake=prepared)
            server = self._serve(workspace)
            status, result = self._request(server, "GET", "/api/v1/candidate?project=new-idea&session=initial")
            self.assertEqual(status, 200, result)
            path = project.root_dir / "factors/candidate.py"
            source = path.read_text() + "\n# Authored first candidate\n"
            body = {"actionId": "candidate.save", "project": "new-idea", "confirm": True,
                    "params": {"session": "initial", "source": source, "baseSha256": result["data"]["sha256"]}}
            status, saved = self._request(server, "POST", "/api/v1/actions", body)
            self.assertEqual(status, 200, saved)
            self.assertEqual(path.read_text(), source)
            status, _ = self._request(server, "POST", "/api/v1/actions", body)
            self.assertEqual(status, 409)
            with mock.patch("autoquant.studio_ideas.list_runs", return_value=[object()]):
                status, _ = self._request(server, "GET", "/api/v1/candidate?project=new-idea&session=initial")
                self.assertEqual(status, 409)
            records = [json.loads(line) for line in (workspace.root_dir / ".autoquant/studio-actions.jsonl").read_text().splitlines()]
            self.assertIn("hypothesisSha256", records[-1])
            self.assertEqual(records[-1]["sourceSha256"], hashlib.sha256(source.encode()).hexdigest())

    def test_idea_started_audit_binds_original_and_trial_hypotheses(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, project, session = self._setup(directory)
            spawn = FakeSpawn(out=EVALUATE_JSON)
            server = self._serve(workspace, spawn=spawn)
            preview = self._preview(server, session)
            result = self._create(server, session, preview)
            self.assertEqual(result[0], 202, result)
            self._wait(server, result[1]["data"]["jobId"])
            # Existing helper returns the HTTP envelope; audit is durable independently of UI state.
            records = [json.loads(line) for line in (workspace.root_dir / ".autoquant/studio-actions.jsonl").read_text().splitlines()]
            started = next(row for row in records if row["event"] == "started")
            self.assertEqual(started["hypothesisSha256"], hashlib.sha256(project.manifest.description.encode()).hexdigest())
            self.assertEqual(started["trialHypothesis"], HYPOTHESIS)
            self.assertEqual(started["trialHypothesisSha256"], hashlib.sha256(HYPOTHESIS.encode()).hexdigest())


if __name__ == "__main__":
    unittest.main()
