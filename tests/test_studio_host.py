"""V3 extension on top of upstream's managed Studio launch.

Launch resolution, port/host authority and response headers are covered by
upstream's tests in ``tests/test_studio.py``. This module only covers the
optional snapshot ``host`` marker that V3 adds under managed launch.
"""

from __future__ import annotations

import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.request import urlopen

from autoquant import cli
from autoquant.studio import (
    MANAGED_SNAPSHOT_HOST,
    STUDIO_SNAPSHOT_JSON_SCHEMA,
    build_studio_snapshot,
    create_studio_server,
)
from autoquant.workspace import initialize_workspace

MANAGED = {
    "HARNESS_CAPABILITY": "studio",
    "HARNESS_HOST": "127.0.0.1",
    "HARNESS_PORTS": '{"http":8968}',
    "HARNESS_NO_OPEN": "1",
}


class ManagedSnapshotHostTests(unittest.TestCase):
    def test_marker_is_vendor_neutral_and_declared_in_schema(self) -> None:
        self.assertEqual(MANAGED_SNAPSHOT_HOST, {"kind": "harness", "capability": "studio"})
        self.assertIn("host", STUDIO_SNAPSHOT_JSON_SCHEMA["properties"])
        self.assertNotIn("host", STUDIO_SNAPSHOT_JSON_SCHEMA.get("required", []))

    def test_cli_passes_managed_state_and_allow_actions_through(self) -> None:
        captured: dict = {}
        with patch.object(cli, "serve_studio", lambda *a, **k: captured.update(k)), \
                patch.dict("os.environ", MANAGED, clear=False):
            code = cli.main(["studio", "serve", ".", "--no-open"])
        self.assertEqual(code, 0)
        self.assertEqual((captured["host"], captured["port"]), ("127.0.0.1", 8968))
        self.assertTrue(captured["managed"])
        self.assertFalse(captured["open_browser"])
        self.assertFalse(captured["allow_actions"])

    def test_snapshot_carries_host_only_when_managed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace = initialize_workspace(Path(directory) / "ws", name="Host Desk")
            self.assertNotIn("host", build_studio_snapshot(workspace.root_dir))
            for managed in (False, True):
                server = create_studio_server(workspace.root_dir, port=0, managed=managed)
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                base = f"http://127.0.0.1:{server.server_port}"
                try:
                    with urlopen(f"{base}/api/v1/health", timeout=3) as response:
                        self.assertEqual(response.status, 200)
                    with urlopen(f"{base}/api/v1/snapshot", timeout=3) as response:
                        snapshot = json.loads(response.read())
                    with self.subTest(managed=managed):
                        if managed:
                            self.assertEqual(snapshot["host"], MANAGED_SNAPSHOT_HOST)
                        else:
                            self.assertNotIn("host", snapshot)
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
