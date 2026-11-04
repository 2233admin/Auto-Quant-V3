from __future__ import annotations

import json
import tempfile
import threading
import tomllib
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.request import urlopen

from autoquant import cli
from autoquant.studio import STUDIO_SNAPSHOT_JSON_SCHEMA, build_studio_snapshot, create_studio_server
from autoquant.studio_host import resolve_host_contract
from autoquant.workspace import AutoQuantValidationError, initialize_workspace

ROOT = Path(__file__).resolve().parent.parent
HOSTED = {
    "HARNESS_CAPABILITY": "studio",
    "HARNESS_HOST": "127.0.0.1",
    "HARNESS_PORTS": '{"http":8968}',
    "HARNESS_NO_OPEN": "1",
}


class HarnessManifestTests(unittest.TestCase):
    def test_manifest_v1_matches_package_version_and_studio_launch(self) -> None:
        manifest = json.loads((ROOT / "harness.json").read_text(encoding="utf-8"))
        package = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
        self.assertEqual(manifest["manifestVersion"], 1)
        self.assertEqual(manifest["version"], package["project"]["version"])
        studio = manifest["capabilities"]["studio"]
        self.assertEqual(studio["entryPort"], "http")
        self.assertIn(studio["entryPort"], studio["ports"])
        self.assertEqual(studio["readinessPath"], "/api/v1/health")
        self.assertIn("--no-open", studio["command"])
        self.assertEqual(studio["command"][-3:], ["serve", ".", "--no-open"])


class HostContractTests(unittest.TestCase):
    def test_standalone_without_capability_or_with_other_capability(self) -> None:
        self.assertIsNone(resolve_host_contract({}))
        self.assertIsNone(resolve_host_contract({"HARNESS_CAPABILITY": "other"}))

    def test_hosted_reads_injected_host_and_port(self) -> None:
        contract = resolve_host_contract(HOSTED)
        self.assertEqual((contract.host, contract.port), ("127.0.0.1", 8968))
        self.assertEqual(
            contract.snapshot_block(), {"kind": "openalice", "capability": "studio"}
        )
        bare = dict(HOSTED)
        del bare["HARNESS_HOST"]
        self.assertEqual(resolve_host_contract(bare).host, "127.0.0.1")

    def test_hosted_fails_fast_on_missing_or_invalid_port(self) -> None:
        for ports in (None, "", "not json", "[]", "{}", '{"other":1}', '{"http":"80"}',
                      '{"http":0}', '{"http":65536}', '{"http":true}', '{"http":1.5}'):
            env = dict(HOSTED)
            if ports is None:
                del env["HARNESS_PORTS"]
            else:
                env["HARNESS_PORTS"] = ports
            with self.subTest(ports=ports), self.assertRaises(AutoQuantValidationError):
                resolve_host_contract(env)

    def test_hosted_refuses_non_loopback_host(self) -> None:
        with self.assertRaises(AutoQuantValidationError):
            resolve_host_contract({**HOSTED, "HARNESS_HOST": "0.0.0.0"})


class HostedServeTests(unittest.TestCase):
    def _serve(self, env: dict[str, str], *extra: str) -> tuple[int, dict]:
        captured: dict = {}
        with patch.object(cli, "serve_studio", lambda *a, **k: captured.update(k)), \
                patch.dict("os.environ", env, clear=False):
            code = cli.main(["studio", "serve", ".", *extra])
        return code, captured

    def test_hosted_binds_injected_port_and_never_opens_browser(self) -> None:
        code, captured = self._serve(HOSTED)
        self.assertEqual(code, 0)
        self.assertEqual((captured["host"], captured["port"]), ("127.0.0.1", 8968))
        self.assertFalse(captured["open_browser"])
        self.assertEqual(captured["host_block"]["kind"], "openalice")

    def test_hosted_never_opens_browser_even_without_no_open_flag(self) -> None:
        env = {k: v for k, v in HOSTED.items() if k != "HARNESS_NO_OPEN"}
        code, captured = self._serve(env)
        self.assertEqual(code, 0)
        self.assertFalse(captured["open_browser"])

    def test_hosted_missing_port_fails_without_default_fallback(self) -> None:
        env = {k: v for k, v in HOSTED.items() if k != "HARNESS_PORTS"}
        with patch.dict("os.environ", env, clear=False):
            code, captured = self._serve(env)
        self.assertEqual(code, 1)
        self.assertEqual(captured, {})

    def test_hosted_conflicting_explicit_port_is_a_usage_error(self) -> None:
        code, captured = self._serve(HOSTED, "--port", "8765")
        self.assertEqual(code, 2)
        self.assertEqual(captured, {})

    def test_standalone_defaults_are_unchanged(self) -> None:
        env = {k: "" for k in HOSTED}
        code, captured = self._serve(env)
        self.assertEqual(code, 0)
        self.assertEqual((captured["host"], captured["port"]), ("127.0.0.1", 8765))
        self.assertTrue(captured["open_browser"])
        self.assertIsNone(captured["host_block"])


class HostedSnapshotTests(unittest.TestCase):
    def test_snapshot_exposes_host_only_when_hosted_and_health_answers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace = initialize_workspace(Path(directory) / "ws", name="Host Desk")
            self.assertNotIn("host", build_studio_snapshot(workspace.root_dir))
            block = {"kind": "openalice", "capability": "studio"}
            self.assertEqual(
                build_studio_snapshot(workspace.root_dir, host=block)["host"], block
            )
            self.assertIn("host", STUDIO_SNAPSHOT_JSON_SCHEMA["properties"])
            server = create_studio_server(workspace.root_dir, port=0, host_block=block)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}"
            try:
                with urlopen(f"{base}/api/v1/health", timeout=3) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(json.loads(response.read())["ok"])
                with urlopen(f"{base}/api/v1/snapshot", timeout=3) as response:
                    self.assertEqual(json.loads(response.read())["host"], block)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
