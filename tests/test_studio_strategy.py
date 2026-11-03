"""Strategy routing and local actions; synthetic transport fixtures are not research evidence."""
from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from autoquant.studio_actions import ActionError, ActionService
from autoquant.studio_strategy import observed_strategy_route, strategy_route
from autoquant.studies import create_study
from autoquant.studio import build_studio_snapshot
from autoquant.studio_library import library_projection
from autoquant.workspace import load_project
from tests.study_helpers import make_project, study_definition
from tests.test_studio_actions import FakeSpawn


def admitted_program(project):
    # Explicitly mocked Core admission, not a fabricated market outcome.
    return {"lanes": [{"id": "portfolio", "studyId": "portfolio-quality", "phase": "not-started",
                       "currentRun": False, "latestRun": None, "latestSession": None, "commands": [
                           {"id": "session.start", "argv": ["aq", "session", "start", str(project.root_dir),
                            "--study", "portfolio-quality", "--json"], "display": "aq session start ..."}]}],
            "progression": {"gates": [{"id": "factor-to-portfolio", "status": "passed", "explanation": "Mocked Core gate."}]},
            "conflicts": []}


class StudioStrategyTests(unittest.TestCase):
    def test_risk_forecast_cannot_be_routed_to_a_return_research_desk(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace, project = make_project(directory)
            route = observed_strategy_route(project, None, workspace.root_dir, outcome="forward-realized-volatility")
            self.assertEqual(route["mode"], "blocked")
            self.assertEqual(route["reasonCode"], "risk-outcome")
            self.assertEqual(route["argv"], ["aq", "project", "templates", "--json"])
            self.assertNotIn("intake", route["argv"])

    def test_sample_uses_boolean_current_run_contract_and_exact_run_adjustment(self):
        root = Path(__file__).resolve().parents[1] / "projects/sample-research-desk"
        snapshot = build_studio_snapshot(root)["projects"][0]
        route = snapshot["library"]["factor"]["buildStrategy"]
        program = snapshot["researchProgramStatus"]
        portfolio = next(l for l in program["lanes"] if l["id"] == "portfolio")
        factor = next(l for l in program["lanes"] if l["id"] == "factor")
        self.assertIs(portfolio["currentRun"], True)
        self.assertEqual(route["mode"], "open")
        self.assertEqual(route["runId"], portfolio["latestRun"]["id"])
        self.assertEqual(route["factorRunId"], factor["latestRun"]["id"])
        summary = snapshot["library"]["strategy"]
        self.assertEqual(summary["state"], "Tuned")
        self.assertEqual(summary["evidence"]["runId"], snapshot["portfolioExplorer"]["run"]["id"])
        self.assertIsNotNone(summary["evidence"]["selectionAdjustment"])

    def test_lifecycle_needs_published_net_run_and_neighborhood_not_positive_signs(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace, project = make_project(directory)
            snapshot = {"studies": [{"id": "portfolio", "primaryMetric": "validation_net_sharpe"}],
                        "runs": [], "portfolioExplorer": None}
            self.assertEqual(library_projection(project, snapshot, workspace.root_dir)["strategy"]["state"], "Defined")
            snapshot["runs"] = [{"id": "run-base", "studyId": "portfolio", "status": "succeeded", "startedAt": "2026-01-01"},
                                {"id": "run-rejected", "studyId": "portfolio", "status": "failed", "startedAt": "2026-02-01"}]
            snapshot["portfolioExplorer"] = {"run": {"id": "run-base"}, "strategyViability": {"validation": {"net": {"sharpe": -2.0}}}}
            self.assertEqual(library_projection(project, snapshot, workspace.root_dir)["strategy"]["state"], "Backtested")
            snapshot["portfolioExplorer"]["parameterNeighborhood"] = {"available": True}
            self.assertEqual(library_projection(project, snapshot, workspace.root_dir)["strategy"]["state"], "Tuned")
            snapshot["portfolioExplorer"]["run"]["id"] = "run-rejected"
            self.assertEqual(library_projection(project, snapshot, workspace.root_dir)["strategy"]["state"], "Defined")

    def setup_service(self, directory):
        workspace, project = make_project(directory)
        create_study(project, study_definition(study_id="portfolio-quality"))
        spawn = FakeSpawn(out=b'{"ok":true,"data":{}}')
        service = ActionService(workspace.root_dir, scope="workspace", load_projects=lambda: {project.manifest.id: project},
                                fingerprint=lambda _: "fixed-test-fingerprint", spawn=spawn)
        body = {"actionId": "strategy.build", "project": project.manifest.id, "params": {}}
        return workspace, project, service, spawn, body

    def test_standalone_factor_refuses_conversion_with_research_desk_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace, project, service, spawn, body = self.setup_service(directory)
            route = strategy_route(project, None, workspace.root_dir)
            self.assertEqual(route["mode"], "blocked")
            self.assertIn("standalone Factor Lab", route["reason"])
            self.assertIn("ohlcv-research-desk", route["argv"])
            self.assertNotIn("ohlcv-portfolio-lab", route["argv"])
            with patch("autoquant.studio_strategy.load_research_program", return_value=None):
                with self.assertRaisesRegex(ActionError, "not a request-bound standalone Factor Lab"):
                    service.preview(body)
                entry = next(a for a in service.catalog()["actions"] if a["id"] == "strategy.build")
                self.assertFalse(entry["targets"][0]["available"])
            self.assertEqual(spawn.calls, [])

    def test_blocked_gate_active_session_failure_and_existing_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace, project = make_project(directory)
            program = admitted_program(project)
            program["progression"]["gates"][0].update(status="blocked", explanation="Exact Core admission reason.")
            route = strategy_route(project, program, workspace.root_dir)
            self.assertEqual(route["reason"], "Exact Core admission reason.")
            self.assertEqual(route["mode"], "blocked")
            program["progression"]["gates"][0]["status"] = "passed"
            program["lanes"].append({"id": "factor", "latestSession": {"status": "active"}})
            self.assertEqual(strategy_route(project, program, workspace.root_dir)["reasonCode"], "active-session")
            program["lanes"].pop()
            program["lanes"][0]["phase"] = "scientific-limit"
            self.assertEqual(strategy_route(project, program, workspace.root_dir)["reasonCode"], "failed-evidence")
            program["lanes"][0]["currentRun"] = True
            program["lanes"][0]["latestRun"] = {"id": "run-current", "status": "succeeded"}
            route = strategy_route(project, program, workspace.root_dir)
            self.assertEqual((route["mode"], route["runId"]), ("open", "run-current"))

    def test_preview_exact_command_second_confirm_audit_and_stale_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace, project, service, spawn, body = self.setup_service(directory)
            program = admitted_program(project)
            with patch("autoquant.studio_strategy.load_research_program", return_value=program):
                preview = service.preview(body)
                self.assertEqual(spawn.calls, [])
                self.assertEqual(preview["argv"][1:5], ["-m", "autoquant", "session", "start"])
                self.assertEqual(preview["argv"][5:], [str(project.root_dir), "--study", "portfolio-quality", "--json"])
                self.assertTrue(preview["requiresSecondConfirm"])
                self.assertIn("unless an identical successful one is reused", preview["trial"]["notice"])
                launch = {**body, "confirm": True, "commandHash": preview["commandHash"]}
                with self.assertRaisesRegex(ActionError, "confirm must be true"):
                    service.create({**launch, "confirm": False})
                with self.assertRaisesRegex(ActionError, "secondConfirm"):
                    service.create(launch)
                program["progression"]["gates"][0]["explanation"] = "Changed Core gate binding."
                with self.assertRaisesRegex(ActionError, "changed since the preview"):
                    service.create({**launch, "secondConfirm": True})
                program["progression"]["gates"][0]["status"] = "blocked"
                with self.assertRaisesRegex(ActionError, "Changed Core gate binding"):
                    service.create({**launch, "secondConfirm": True})
                program["progression"]["gates"][0]["status"] = "passed"
                refreshed = service.preview(body)
                job = service.create({**body, "confirm": True, "secondConfirm": True, "commandHash": refreshed["commandHash"]})
                deadline = time.monotonic() + 3
                while not spawn.calls and time.monotonic() < deadline:
                    time.sleep(.01)
                self.assertEqual(spawn.calls[0][0], refreshed["argv"])
                self.assertTrue(job["jobId"])
                while service.runner.active_job(project.manifest.id) and time.monotonic() < deadline:
                    time.sleep(.01)
                self.assertIsNone(service.runner.active_job(project.manifest.id))
            audit = [json.loads(line) for line in (workspace.root_dir / ".autoquant/studio-actions.jsonl").read_text().splitlines()]
            self.assertTrue(any(e.get("event") == "started" and e.get("actionId") == "strategy.build" for e in audit))
            self.assertFalse((project.root_dir / "runs").exists() and list((project.root_dir / "runs").glob("run-*")))

    def test_untyped_strategy_parameters_and_unknown_projects_are_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            _, project, service, spawn, body = self.setup_service(directory)
            with self.assertRaises(ActionError):
                service.preview({**body, "params": {"argv": ["arbitrary"]}})
            with self.assertRaises(ActionError):
                service.preview({**body, "project": "../outside"})
            self.assertEqual(spawn.calls, [])


if __name__ == "__main__":
    unittest.main()
