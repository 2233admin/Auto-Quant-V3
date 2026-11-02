from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

from autoquant.studio_actions import ActionError
from autoquant.studio_data import staging_path
from autoquant.workspace import initialize_workspace
from tests import test_studio_actions as helpers
from tests.test_data_quality import small_frame


class StudioDataTests(unittest.TestCase):
    _serve = helpers.StudioActionsTests._serve
    _request = helpers.StudioActionsTests._request
    _wait = helpers.StudioActionsTests._wait

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "desk"
        self.workspace = initialize_workspace(self.root)
        self.staging = self.root / "staging" / "clean"
        self.staging.mkdir(parents=True)
        for asset in ("AAA", "BBB", "CCC", "DDD"):
            small_frame().to_csv(self.staging / f"{asset}.csv", index=False)
        self.options = {"frequency": "1d", "clock": "session", "calendar": "weekdays", "timezone": "UTC",
                        "universeStatus": "unknown", "priceAdjustment": "raw", "assetClass": "equity", "venue": "SYNTHETIC", "currency": "USD",
                        "provider": {"name": "synthetic", "terms": "test fixture", "retrievedAt": None, "sourceUri": None}}
        self.body = {"actionId": "project.intake", "project": "clean-factor", "params": {"source": "staging/clean", "options": self.options,
                     "name": "Synthetic Factor", "question": "Does momentum rank future returns?", "horizon": 1, "predictionAssets": ["AAA"]}}

    def test_discovery_inspection_and_read_only_check_without_confirmation(self):
        spawn = helpers.FakeSpawn()
        server = self._serve(self.workspace, spawn=spawn)
        status, result = self._request(server, "GET", "/api/v1/data-sources")
        self.assertEqual(status, 200)
        self.assertEqual(result["data"]["sources"], [{"path": "staging/clean", "kind": "csv-folder"}])
        status, result = self._request(server, "GET", "/api/v1/data-sources?path=staging/clean")
        self.assertEqual(result["data"]["mapping"]["timestamp"], "date")
        before = {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        status, result = self._request(server, "POST", "/api/v1/actions", {"actionId": "data.check", "params": {"source": "staging/clean", "options": self.options}})
        self.assertEqual(status, 200, result)
        self.assertEqual(len(result["data"]["assets"]), 4)
        self.assertEqual(before, {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file()})
        self.assertEqual(spawn.calls, [])

    def test_preview_does_not_write_and_requires_second_confirmation(self):
        server = self._serve(self.workspace, spawn=helpers.FakeSpawn())
        before = sorted(self.root.rglob("*"))
        status, result = self._request(server, "POST", "/api/v1/actions/preview", self.body)
        self.assertEqual(status, 200, result)
        preview = result["data"]
        self.assertTrue(preview["requiresSecondConfirm"])
        self.assertIn("--dataset", preview["argv"])
        self.assertEqual(preview["argv"][3:5], ["project", "intake"])
        self.assertEqual(sorted(self.root.rglob("*")), before)
        status, error = self._request(server, "POST", "/api/v1/actions", {**self.body, "confirm": True, "commandHash": preview["commandHash"]})
        self.assertEqual(status, 400, error)
        self.assertEqual(error["error"]["code"], "studio.second-confirm-required")

    def test_confirm_materializes_bundle_and_audits_exact_argv(self):
        spawn = helpers.FakeSpawn(out=b'{"ok":true,"data":{}}')
        server = self._serve(self.workspace, spawn=spawn)
        _, result = self._request(server, "POST", "/api/v1/actions/preview", self.body)
        preview = result["data"]
        status, launched = self._request(server, "POST", "/api/v1/actions", {**self.body, "confirm": True, "secondConfirm": True, "commandHash": preview["commandHash"]})
        self.assertEqual(status, 202, launched)
        self.assertEqual(self._wait(server, launched["data"]["jobId"])["status"], "succeeded")
        self.assertEqual(spawn.calls[0][0], preview["argv"])
        directory = Path(preview["stagingDirectory"])
        self.assertTrue((directory / "dataset-package.json").is_file())
        package = json.loads((directory / "dataset-package.json").read_text())
        self.assertIsNone(package["provider"]["retrievedAt"])
        audit = [json.loads(line) for line in (self.root / ".autoquant/studio-actions.jsonl").read_text().splitlines()]
        self.assertEqual([a["event"] for a in audit], ["started", "finished"])
        self.assertEqual(audit[0]["actionId"], "project.intake")
        self.assertEqual(audit[0]["argv"], preview["argv"])
        self.assertTrue((directory / "transformation-audit.json").is_file())

    def test_source_mutation_rejects_stale_preview(self):
        server = self._serve(self.workspace, spawn=helpers.FakeSpawn())
        _, result = self._request(server, "POST", "/api/v1/actions/preview", self.body)
        file = self.staging / "AAA.csv"
        file.write_bytes(file.read_bytes() + b"\n")
        status, result = self._request(server, "POST", "/api/v1/actions", {**self.body, "confirm": True, "secondConfirm": True, "commandHash": result["data"]["commandHash"]})
        self.assertEqual(status, 409, result)
        self.assertEqual(result["error"]["code"], "studio.stale-preview")

    def test_failures_remain_inspectable_but_block_intake(self):
        frame = small_frame(); frame.loc[2, "date"] = frame.loc[1, "date"]
        frame.to_csv(self.staging / "AAA.csv", index=False)
        server = self._serve(self.workspace, spawn=helpers.FakeSpawn())
        status, report = self._request(server, "POST", "/api/v1/actions", {"actionId": "data.check", "params": {"source": "staging/clean", "options": self.options}})
        self.assertEqual(status, 200)
        self.assertEqual(report["data"]["verdict"], "fail")
        status, error = self._request(server, "POST", "/api/v1/actions/preview", self.body)
        self.assertEqual(status, 422)
        self.assertEqual(error["error"]["code"], "studio.data-quality")

    def test_path_escape_and_links_are_rejected(self):
        server = self._serve(self.workspace, spawn=helpers.FakeSpawn())
        for source in ("../outside", "projects", str(self.root.parent)):
            status, _ = self._request(server, "POST", "/api/v1/actions", {"actionId": "data.check", "params": {"source": source}})
            self.assertEqual(status, 422)
        file = self.staging / "AAA.csv"
        with mock.patch("autoquant.data_sources.no_links", side_effect=ValueError("Symlinks and junctions are not permitted")):
            status, _ = self._request(server, "POST", "/api/v1/actions", {"actionId": "data.check", "params": {"source": "staging/clean"}})
            self.assertEqual(status, 422)
        link = self.root / "staging" / "junction"
        if os.name == "nt":
            result = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(self.staging)], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.addCleanup(link.rmdir)
        else:
            link.symlink_to(self.staging, target_is_directory=True)
            self.addCleanup(link.unlink)
        with self.assertRaises(ActionError):
            staging_path(server.actions, "staging/junction")

    def test_invalid_options_and_token_gate(self):
        server = self._serve(self.workspace, spawn=helpers.FakeSpawn())
        status, _ = self._request(server, "GET", "/api/v1/data-sources", token=False)
        self.assertEqual(status, 403)
        status, _ = self._request(server, "POST", "/api/v1/actions", {"actionId": "data.check", "params": {"source": "staging/clean", "options": {"jumpThreshold": -1}}})
        self.assertEqual(status, 422)

    def test_existing_pristine_project_retains_its_question(self):
        from autoquant.workspace import create_project
        project = create_project(self.root, "existing-factor", name="Existing Factor", description="Does volume predict returns in this universe?", template="ohlcv-factor-lab")
        research = (project.root_dir / "research.md").read_bytes()
        server = self._serve(self.workspace, spawn=helpers.FakeSpawn())
        body = {**self.body, "project": "existing-factor"}
        status, result = self._request(server, "POST", "/api/v1/actions/preview", body)
        self.assertEqual(status, 200, result)
        self.assertEqual(result["data"]["request"]["question"], project.manifest.description)
        self.assertEqual(research, (project.root_dir / "research.md").read_bytes())

    def test_package_manifest_and_referenced_file_are_confined(self):
        from tests.intake_helpers import write_intake_inputs, write_observed_intraday_inputs
        _, package = write_intake_inputs(self.staging, observations=10)
        server = self._serve(self.workspace, spawn=helpers.FakeSpawn())
        source = package.relative_to(self.root).as_posix()
        status, result = self._request(server, "POST", "/api/v1/actions", {"actionId": "data.check", "params": {"source": source}})
        self.assertEqual(status, 200, result)
        data = json.loads(package.read_text())
        data["assets"][0]["path"] = "../../outside.csv"
        package.write_text(json.dumps(data))
        status, _ = self._request(server, "POST", "/api/v1/actions", {"actionId": "data.check", "params": {"source": source}})
        self.assertEqual(status, 422)
        _, hourly = write_observed_intraday_inputs(self.staging, observations=40)
        package = json.loads(hourly.read_text())
        params = {**self.body["params"], "source": hourly.relative_to(self.root).as_posix(), "predictionAssets": [package["assets"][0]["symbol"]]}
        status, preview = self._request(server, "POST", "/api/v1/actions/preview", {**self.body, "params": params})
        self.assertEqual(status, 200, preview)
        self.assertEqual(preview["data"]["request"]["horizon"], "1 completed 1h bars")
        self.assertNotEqual(preview["data"]["request"]["assets"][0]["assetClass"], "mixed")
