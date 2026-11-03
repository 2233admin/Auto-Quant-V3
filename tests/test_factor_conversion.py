"""`aq project from-factor` and the Studio strategy.build conversion path.

The fixture is deterministic synthetic OHLCV (tests.intake_helpers); its Runs
are executable test evidence, not market research.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import threading
import unittest
from pathlib import Path

from autoquant.factor_conversion import convert_factor_project
from autoquant.factor_lineage import FACTOR_LINEAGE, load_factor_lineage
from autoquant.intake import prepare_project_intake
from autoquant.runs import execute_study
from autoquant.selection import build_research_family, build_selection_adjustment
from autoquant.studies import load_study
from autoquant.studio import create_studio_server
from autoquant.workspace import AutoQuantValidationError, create_project, initialize_workspace, load_project
from tests.intake_helpers import write_intake_inputs
import tests.test_studio_actions as studio_action_tests

ASSETS = ("AAPL", "MSFT", "NVDA", "QQQ", "SPY")
CANDIDATE = 'import pandas as pd\n\ndef compute_factor(panel: pd.DataFrame) -> pd.Series:\n    return (panel.groupby("asset")["close"].pct_change({n}, fill_method=None)).rename("idea_factor")\n'
SOURCE = "momentum-factor"


def mandate(**overrides):
    value = {
        "schemaVersion": 1, "kind": "autoquant-strategy-mandate",
        "question": "Does the inherited momentum factor survive costed long-only construction?",
        "direction": "long",
        "positionRoles": {symbol: "long-only" for symbol in ASSETS},
        "benchmarkPolicy": {"kind": "fixed-weights", "weights": {symbol: 0.2 for symbol in ASSETS}},
        "portfolioPolicy": {"grossLimit": 1.0, "maxAbsWeight": 0.3, "assetMaxAbsWeights": {},
                            "annualizedVolatilityCeiling": 0.12, "baseCostBps": 15.0, "noTradeOneWay": 0.04,
                            "referenceNav": 250000.0,
                            "decisionSchedule": {"kind": "every-bars", "bars": 5, "anchor": "dataset-start"}},
        "callerConfirmed": True,
    }
    value.update(overrides)
    return value


def tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def build_source(root: Path, *, runs: int = 2) -> Path:
    workspace = initialize_workspace(root / "workspace")
    staging = workspace.root_dir / "staging" / "pkg"
    staging.mkdir(parents=True)
    request, package = write_intake_inputs(
        staging, observations=260, request_assets=ASSETS,
        factor_policy={"claim": "decision-signal", "knownStyle": None, "outcome": "forward-return"},
    )
    prepared = prepare_project_intake(request, package, "ohlcv-factor-lab")
    project = create_project(workspace.root_dir, SOURCE, template="ohlcv-factor-lab", template_intake=prepared)
    for number in range(runs):
        (project.root_dir / "factors/candidate.py").write_text(CANDIDATE.format(n=10 if number else 5), encoding="utf-8")
        execute_study(project, "ohlcv-factor-quality")
    return workspace.root_dir


class FactorConversionTests(unittest.TestCase):
    _serve = studio_action_tests.StudioActionsTests._serve
    _request = studio_action_tests.StudioActionsTests._request

    @classmethod
    def setUpClass(cls):
        cls._fixture = tempfile.TemporaryDirectory()
        cls.template = build_source(Path(cls._fixture.name))

    @classmethod
    def tearDownClass(cls):
        cls._fixture.cleanup()

    def copy(self) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        target = Path(directory.name) / "workspace"
        shutil.copytree(self.template, target)
        return target

    def write_mandate(self, workspace: Path, value) -> Path:
        path = workspace / "staging" / "mandate.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def test_references_recorded_source_untouched_and_mandate_caller_provided(self):
        workspace = self.copy()
        source_root = workspace / "projects" / SOURCE
        before = tree_hash(source_root)
        project, lineage, check = convert_factor_project(workspace, SOURCE, "momentum-strategy", self.write_mandate(workspace, mandate()))
        self.assertEqual(tree_hash(source_root), before)
        self.assertTrue(check["unchanged"])
        source = load_project(source_root)
        anchor = lineage["source"]["anchorRun"]
        self.assertEqual(lineage["source"]["projectId"], SOURCE)
        self.assertEqual(len(lineage["source"]["factorRuns"]), 2)
        run_result = json.loads((source_root / "runs" / anchor["id"] / "result.json").read_text(encoding="utf-8"))
        self.assertEqual(lineage["candidate"]["sourceHash"], run_result["subject"]["sourceHash"])
        self.assertEqual(load_study(project, "ohlcv-factor-quality").source_hash, lineage["candidate"]["sourceHash"])
        self.assertEqual(load_study(project, "ohlcv-portfolio-quality").source_hash, lineage["candidate"]["sourceHash"])
        self.assertEqual((project.root_dir / "factors/candidate.py").read_bytes(), (source.root_dir / "factors/candidate.py").read_bytes())
        market = lineage["marketData"]
        self.assertTrue(market["sameMarketData"])
        self.assertEqual(market["sourceMarketIdentity"], market["targetMarketIdentity"])
        self.assertEqual(lineage["mandate"]["defaultsApplied"], [])
        request = json.loads((project.root_dir / "request.json").read_text(encoding="utf-8"))
        expected = mandate()
        self.assertEqual({a["symbol"]: a["positionRole"] for a in request["assets"]}, expected["positionRoles"])
        self.assertEqual(request["portfolioPolicy"], expected["portfolioPolicy"])
        self.assertEqual(request["benchmarkPolicy"], expected["benchmarkPolicy"])
        self.assertEqual(request["factorPolicy"]["predictionAssets"], list(ASSETS))
        position = json.loads((project.root_dir / "strategies/portfolio-mandate.json").read_text(encoding="utf-8"))
        text = json.dumps(position)
        self.assertNotIn("reference-default", text)
        self.assertNotIn("direction-default", text)
        self.assertIn("caller-supplied", text)
        self.assertIn("momentum-factor", (project.root_dir / "research.md").read_text(encoding="utf-8"))

    def test_inherited_trial_count_is_exposed_and_counted_by_selection_adjustment(self):
        workspace = self.copy()
        project, lineage, _ = convert_factor_project(workspace, SOURCE, "momentum-strategy", self.write_mandate(workspace, mandate()))
        self.assertEqual(lineage["trials"]["inheritedSourceTrials"], 2)
        run = execute_study(project, "ohlcv-factor-quality")
        family = build_research_family(project, run).projection
        self.assertEqual(family["uniqueSourceTrials"], 1)
        self.assertEqual(family["inheritedSourceTrials"], 2)
        self.assertEqual(family["effectiveSourceTrials"], 3)
        self.assertEqual(family["inheritance"]["sourceProjectId"], SOURCE)
        adjustment = build_selection_adjustment(run, build_research_family(project, run))
        if adjustment["status"] == "available":
            self.assertEqual(adjustment["statistics"]["uniqueTrials"], 3)
        # A tampered lineage fails closed instead of resetting the count.
        path = project.root_dir / FACTOR_LINEAGE
        broken = json.loads(path.read_text(encoding="utf-8"))
        broken["trials"]["inheritedSourceTrials"] = 0
        path.write_text(json.dumps(broken), encoding="utf-8")
        with self.assertRaises(AutoQuantValidationError):
            load_factor_lineage(project)

    def test_projects_without_lineage_keep_the_exact_family_projection(self):
        workspace = self.copy()
        source = load_project(workspace / "projects" / SOURCE)
        runs = sorted((source.root_dir / "runs").iterdir())
        from autoquant.runs import load_run
        family = build_research_family(source, load_run(source, runs[-1].name)).projection
        self.assertNotIn("inheritedSourceTrials", family)
        self.assertNotIn("effectiveSourceTrials", family)

    def assertRefused(self, code, call):
        with self.assertRaises(AutoQuantValidationError) as caught:
            call()
        self.assertIn(code, [issue.code for issue in caught.exception.issues])

    def test_refusals_untested_changed_source_other_data_and_incomplete_mandate(self):
        workspace = self.copy()
        good = self.write_mandate(workspace, mandate())
        # Source changed after its latest Run.
        candidate = workspace / "projects" / SOURCE / "factors/candidate.py"
        original = candidate.read_bytes()
        candidate.write_text(CANDIDATE.format(n=20), encoding="utf-8")
        self.assertRefused("conversion.source-changed", lambda: convert_factor_project(workspace, SOURCE, "x-strategy", good))
        candidate.write_bytes(original)
        # Different market data: one byte appended to an asset file in a copied package.
        other = workspace / "staging" / "other"
        shutil.copytree(workspace / "staging" / "pkg" / "external-data", other)
        with (other / "AAPL.csv").open("a", encoding="utf-8") as handle:
            handle.write("\n")
        self.assertRefused("conversion.data-mismatch", lambda: convert_factor_project(workspace, SOURCE, "x-strategy", good, dataset=other / "dataset.json"))
        shutil.rmtree(other)
        # Package no longer findable under staging.
        shutil.move(str(workspace / "staging" / "pkg"), str(workspace.parent / "moved"))
        self.assertRefused("conversion.data-not-reusable", lambda: convert_factor_project(workspace, SOURCE, "x-strategy", good))
        shutil.move(str(workspace.parent / "moved"), str(workspace / "staging" / "pkg"))
        # Incomplete or unconfirmed mandates: nothing is defaulted.
        incomplete = mandate()
        del incomplete["benchmarkPolicy"]
        for bad in (incomplete, mandate(callerConfirmed=False), mandate(direction="long-short"),
                    mandate(positionRoles={"AAPL": "long-only"})):
            self.assertRefused("conversion.mandate", lambda bad=bad: convert_factor_project(workspace, SOURCE, "x-strategy", self.write_mandate(workspace, bad)))
        partial_policy = mandate()
        del partial_policy["portfolioPolicy"]["referenceNav"]
        with self.assertRaises(AutoQuantValidationError):
            convert_factor_project(workspace, SOURCE, "x-strategy", self.write_mandate(workspace, partial_policy))
        self.assertFalse((workspace / "projects" / "x-strategy").exists())
        # Untested standalone Factor Lab.
        untested = build_source(workspace.parent / "untested", runs=0)
        self.assertRefused("conversion.source-not-tested", lambda: convert_factor_project(untested, SOURCE, "x-strategy", self.write_mandate(untested, mandate())))

    def test_studio_action_preview_confirmations_audit_and_actions_off(self):
        workspace = self.copy()
        before = tree_hash(workspace / "projects" / SOURCE)
        spawn = studio_action_tests.FakeSpawn(out=b'{"ok":true,"data":{"projectId":"momentum-strategy","lineage":{}}}')
        server = self._serve(initialize_workspace_ctx(workspace), spawn=spawn)
        _, snapshot = self._request(server, "GET", f"/api/v1/project?id={SOURCE}")
        route = snapshot["projects"][0]["library"]["factor"]["buildStrategy"]
        self.assertEqual(route["mode"], "convert")
        self.assertEqual(route["conversion"]["inheritedSourceTrials"], 2)
        self.assertIs(route["conversion"]["defaults"]["callerConfirmed"], False)
        body = {"actionId": "strategy.build", "project": SOURCE, "params": {"newProject": "momentum-strategy", "mandate": mandate()}}
        status, refused = self._request(server, "POST", "/api/v1/actions/preview", {**body, "params": {**body["params"], "mandate": mandate(callerConfirmed=False)}})
        self.assertEqual(status, 409, refused)
        status, payload = self._request(server, "POST", "/api/v1/actions/preview", body)
        self.assertEqual(status, 200, payload)
        preview = payload["data"]
        self.assertEqual(preview["argv"][3:8], ["project", "from-factor", str(workspace), SOURCE, "momentum-strategy"])
        self.assertIn("--mandate", preview["argv"])
        self.assertTrue(preview["requiresSecondConfirm"])
        self.assertEqual(preview["trial"]["inheritedSourceTrials"], 2)
        self.assertEqual(spawn.calls, [])
        launch = {**body, "confirm": True, "commandHash": preview["commandHash"]}
        status, _ = self._request(server, "POST", "/api/v1/actions", launch)
        self.assertEqual(status, 400)
        status, _ = self._request(server, "POST", "/api/v1/actions", {**launch, "secondConfirm": True, "commandHash": "stale"})
        self.assertEqual(status, 409)
        status, launched = self._request(server, "POST", "/api/v1/actions", {**launch, "secondConfirm": True})
        self.assertEqual(status, 202, launched)
        job = server.actions.runner.get(launched["data"]["jobId"])
        job.done.wait(5)
        self.assertEqual(spawn.calls[0][0], preview["argv"])
        self.assertEqual(job.created_refs, {"projectId": "momentum-strategy"})
        written = workspace / ".autoquant/strategy-mandates/momentum-strategy.json"
        self.assertEqual(hashlib.sha256(written.read_bytes()).hexdigest(), preview["mandateSha256"])
        audit_text = (workspace / ".autoquant/studio-actions.jsonl").read_text(encoding="utf-8")
        self.assertNotIn(server.actions.token, audit_text)
        started = [json.loads(line) for line in audit_text.splitlines() if '"started"' in line][-1]
        self.assertEqual(started["conversion"]["sourceProject"], SOURCE)
        self.assertEqual(started["conversion"]["mandateSha256"], preview["mandateSha256"])
        self.assertEqual(tree_hash(workspace / "projects" / SOURCE), before)
        # Actions off: the route exists only as read-only information.
        readonly = create_studio_server(workspace, port=0)
        self.assertIsNone(readonly.actions)
        readonly.server_close()


def initialize_workspace_ctx(root: Path):
    from autoquant.workspace import load_workspace
    return load_workspace(root)


if __name__ == "__main__":
    unittest.main()
