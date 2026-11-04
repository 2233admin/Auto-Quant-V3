"""Desk trial families, the Core trial gate, OpenAlice bars and handoff.json."""

from __future__ import annotations

import contextlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import jsonschema

from autoquant.cli import main
from autoquant.handoff import HANDOFF_FILE, RESEARCH_HANDOFF_JSON_SCHEMA
from autoquant.market_data_identity import decode_openalice_source_uri, encode_openalice_source_uri
from autoquant.research_verdict import factor_development_verdict
from autoquant.trial_families import family_state, load_ledger, normalize_question
from autoquant.trial_family_ledger import register_project
from autoquant.workspace import load_project
from tests.test_selection import fake_run


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "openalice-bars"
SKILL = ROOT / "autoquant" / "workspace_skills" / "acquire-openalice-bars" / "scripts" / "package_openalice_bars.py"
STUDY = "ohlcv-factor-quality"
QUESTION = "Does five-day reversal rank next-week returns across AAPL, MSFT, NVDA and SPY?"
ASSETS = ["AAPL", "MSFT", "NVDA", "SPY"]


def aq(*arguments: str) -> tuple[int, dict]:
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(io.StringIO()):
        code = main([*arguments, "--json"])
    return code, json.loads(buffer.getvalue())


def package(output: Path, *extra: str, assets: Path = FIXTURE / "assets.json") -> tuple[int, dict]:
    arguments = ["--assets", str(assets), "--output", str(output), "--dataset-id", "openalice-us-daily",
                 "--dataset-version", "2025-v1", "--asset-class", "equity", "--interval", "1d",
                 "--panel", "aligned", "--terms", "test fixture only", *extra]
    completed = subprocess.run([sys.executable, str(SKILL), *arguments], capture_output=True, text=True)
    return completed.returncode, json.loads(completed.stdout)


FACTS = ("--adjustment", "split-adjusted", "--timezone", "America/New_York", "--calendar", "XNYS")


def request(question: str = QUESTION, primary: int = 5) -> dict:
    return {
        "schemaVersion": 1, "kind": "autoquant-research-request", "title": "Short-term reversal",
        "question": question, "decisionContext": "OpenAlice weighs a weekly rebalance signal.",
        "assets": [{"symbol": s, "assetClass": "equity", "venue": "US-COMPOSITE"} for s in ASSETS],
        "direction": "long", "horizonPolicy": {"primaryForwardBars": primary, "diagnosticForwardBars": [1]},
        "factorPolicy": {"claim": "decision-signal", "knownStyle": None, "outcome": "forward-return",
                         "predictionAssets": ASSETS},
        "horizon": "one week", "hypotheses": ["Recent losers outperform."], "constraints": ["No trading."],
        "deliverables": ["Factor evidence"],
        "source": {"system": "openalice", "workspaceId": None, "sessionId": None,
                   "artifactPath": None, "artifactRevision": None},
    }


class DeskResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory(prefix="aq-desk-")
        cls.base = Path(cls.temporary.name) / "desk"
        code, _ = aq("workspace", "init", str(cls.base))
        assert code == 0
        code, result = package(cls.base / "staging" / "openalice", *FACTS)
        assert code == 0, result
        cls.dataset = cls.base / "staging" / "openalice" / "dataset-package.json"
        cls.intake("reversal-a", request())
        code, run = aq("run", "execute", str(cls.base), "--project", "reversal-a", "--study", STUDY, "--confirm-trial")
        assert code == 0, run
        cls.run_a = run["data"]["run"]["id"] if "run" in run["data"] else run["data"]["id"]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    @classmethod
    def intake(cls, project_id: str, body: dict, workspace: Path | None = None) -> dict:
        workspace = workspace or cls.base
        path = workspace / "staging" / f"{project_id}-request.json"
        path.write_text(json.dumps(body), encoding="utf-8")
        code, result = aq("project", "intake", str(workspace), project_id, "--request", str(path),
                          "--dataset", str(workspace / "staging" / "openalice" / "dataset-package.json"),
                          "--template", "ohlcv-factor-lab")
        assert code == 0, result
        return result

    def copy(self) -> Path:
        target = Path(tempfile.mkdtemp(prefix="aq-desk-copy-")) / "desk"
        shutil.copytree(self.base, target)
        self.addCleanup(shutil.rmtree, target.parent, ignore_errors=True)
        return target

    # -- trial families -------------------------------------------------

    def test_two_projects_with_the_same_question_share_one_family_and_count(self) -> None:
        workspace = self.copy()
        created = self.intake("reversal-b", request(), workspace)
        family_b = created["data"]["trialFamilies"][0]
        project_a = load_project(workspace / "projects" / "reversal-a")
        project_b = load_project(workspace / "projects" / "reversal-b")
        state_a = family_state(project_a, STUDY)
        self.assertEqual(family_b["id"], state_a["id"])
        self.assertEqual(family_b["deskTrialCount"], 1)
        self.assertEqual(family_b["otherProjectTrials"], 1)
        self.assertEqual(family_state(project_b, STUDY)["memberProjects"], ["reversal-a", "reversal-b"])
        code, run = aq("run", "execute", str(workspace), "--project", "reversal-b", "--study", STUDY, "--confirm-trial")
        self.assertEqual(code, 0, run)
        state = family_state(project_a, STUDY)
        self.assertEqual(state["deskTrialCount"], 2)
        ledger = load_ledger(workspace)[state["id"]]
        self.assertEqual(len(ledger["trials"]), 2)
        from autoquant.runs import load_run
        from autoquant.selection import build_research_family
        projection = build_research_family(project_b, load_run(project_b, run["data"]["run"]["id"]
                                           if "run" in run["data"] else run["data"]["id"])).projection
        self.assertEqual(projection["deskInheritedTrials"], 1)
        self.assertEqual(projection["effectiveSourceTrials"], 2)
        self.assertEqual(projection["deskFamily"]["id"], state["id"])

    def test_renamed_project_and_restyled_question_join_but_another_horizon_does_not(self) -> None:
        workspace = self.copy()
        self.intake("renamed-reversal", request("  does FIVE-DAY reversal rank next-week returns across "
                                                "aapl, msft, nvda and spy  "), workspace)
        self.intake("ten-day", request(primary=10), workspace)
        a = family_state(load_project(workspace / "projects" / "reversal-a"), STUDY)
        renamed = family_state(load_project(workspace / "projects" / "renamed-reversal"), STUDY)
        other = family_state(load_project(workspace / "projects" / "ten-day"), STUDY)
        self.assertEqual(renamed["id"], a["id"])
        self.assertEqual(renamed["otherProjectTrials"], 1)
        self.assertNotEqual(other["id"], a["id"])
        self.assertEqual(other["otherProjectTrials"], 0)
        self.assertFalse(other["declarationRequired"])
        self.assertEqual(normalize_question(' "Hello   World?!" '), "hello world")

    def test_reworded_question_requires_a_caller_declaration(self) -> None:
        workspace = self.copy()
        created = self.intake("reworded", request("Do losers of the past week beat winners next week?"), workspace)
        family = created["data"]["trialFamilies"][0]
        self.assertTrue(family["declarationRequired"])
        self.assertIn("family.declare", [item["id"] for item in created["nextActions"]])
        code, refused = aq("run", "execute", str(workspace), "--project", "reworded", "--study", STUDY, "--confirm-trial")
        self.assertEqual(code, 1)
        self.assertEqual(refused["error"]["code"], "trial-gate.family-declaration-required")
        a_id = family_state(load_project(workspace / "projects" / "reversal-a"), STUDY)["id"]
        code, declared = aq("family", "declare", str(workspace), "--project", "reworded", "--study", STUDY,
                            "--same-family", a_id)
        self.assertEqual(code, 0, declared)
        self.assertEqual(declared["data"]["id"], a_id)
        self.assertEqual(declared["data"]["otherProjectTrials"], 1)
        self.assertFalse(declared["data"]["declarationRequired"])
        code, again = aq("family", "declare", str(workspace), "--project", "reworded", "--study", STUDY,
                         "--new-hypothesis")
        self.assertEqual(again["error"]["issues"][0]["code"], "trial-family.already-declared")

    def test_new_hypothesis_declaration_is_symmetric(self) -> None:
        workspace = self.copy()
        self.intake("distinct", request("Is next-week return explained by last week's volume shock?"), workspace)
        code, declared = aq("family", "declare", str(workspace), "--project", "distinct", "--study", STUDY,
                            "--new-hypothesis")
        self.assertEqual(code, 0, declared)
        self.assertEqual(declared["data"]["otherProjectTrials"], 0)
        self.assertFalse(family_state(load_project(workspace / "projects" / "reversal-a"), STUDY)["declarationRequired"])

    def test_registration_is_idempotent_and_reads_never_write(self) -> None:
        workspace = self.copy()
        project = load_project(workspace / "projects" / "reversal-a")
        files = sorted((workspace / "trial-families").glob("*.json"))
        before = {path.name: path.read_bytes() for path in files}
        self.assertEqual(register_project(project), [])
        family_state(project, STUDY)
        self.assertEqual({path.name: path.read_bytes() for path in files}, before)
        state = family_state(project, STUDY, cutoff="2000-01-01T00:00:00+00:00")
        self.assertEqual(state["deskTrialCount"], 0)

    def test_desk_inherited_trials_turn_a_supported_factor_inconclusive(self) -> None:
        # Same synthetic proof shape as #18: identical evidence, larger N.
        metrics = {"validation_mean_ic": 0.12, "validation": {"mean_ic": 0.12, "hac": {"normal_approximation_p_value": 0.02}}}
        leader = fake_run("run-a", "a" * 64, 0.12, metric="validation_mean_ic", metrics=metrics)
        qualification = {"available": True, "claim": {"claim": "decision-signal", "outcome": "forward-return"},
                         "diagnosis": {"stage": "decision-signal-positive"}}
        from autoquant.selection import build_research_family, build_selection_adjustment
        from autoquant.workspace import ProjectContext
        project = ProjectContext(Path("/desk/projects/x"), mock.Mock())
        words = []
        for desk in (None, {"otherProjectTrials": 2, "id": "tf-0000000000000000"}):
            with mock.patch("autoquant.selection.list_runs", return_value=[mock.Mock(id="run-a")]), \
                    mock.patch("autoquant.selection.load_run", return_value=leader), \
                    mock.patch("autoquant.selection.inheritance_projection", return_value=None), \
                    mock.patch("autoquant.selection.desk_inheritance", return_value=desk):
                family = build_research_family(project, leader)
            adjustment = build_selection_adjustment(leader, family)
            words.append(factor_development_verdict(tested=True, exact=True, run_status="succeeded",
                                                    qualification=qualification, adjustment=adjustment)["word"])
        self.assertEqual(words, ["Supported", "Inconclusive"])

    # -- Core trial gate -------------------------------------------------

    def test_gate_requires_confirmation_and_enforces_the_desk_budget(self) -> None:
        workspace = self.copy()
        code, refused = aq("run", "execute", str(workspace), "--project", "reversal-a", "--study", STUDY)
        self.assertEqual(code, 1)
        self.assertEqual(refused["error"]["code"], "trial-gate.confirmation-required")
        self.assertEqual(refused["context"]["trialGate"]["nextTrial"], 2)
        self.assertEqual(refused["context"]["trialGate"]["budget"]["maxCountedTrialsPerFamily"], 20)
        policy = workspace / "autoquant-research-policy.json"
        policy.write_text(json.dumps({"schemaVersion": 1, "kind": "autoquant-research-policy",
                                      "trialBudget": {"maxCountedTrialsPerFamily": 1, "windowDays": 30}}), encoding="utf-8")
        runs_before = sorted((workspace / "projects" / "reversal-a" / "runs").iterdir())
        code, refused = aq("run", "execute", str(workspace), "--project", "reversal-a", "--study", STUDY, "--confirm-trial")
        self.assertEqual(refused["error"]["code"], "trial-gate.budget-exhausted")
        self.assertEqual(sorted((workspace / "projects" / "reversal-a" / "runs").iterdir()), runs_before)
        policy.write_text("{}", encoding="utf-8")
        code, refused = aq("run", "execute", str(workspace), "--project", "reversal-a", "--study", STUDY, "--confirm-trial")
        self.assertEqual(refused["error"]["code"], "trial-gate.policy-invalid")

    def test_orient_and_capabilities_expose_family_budget_and_handoff(self) -> None:
        code, oriented = aq("orient", str(self.base), "--project", "reversal-a")
        self.assertEqual(code, 0)
        desk = oriented["data"]["deskResearch"]
        self.assertEqual(desk["trialFamilies"][0]["deskTrialCount"], 1)
        self.assertEqual(desk["trialFamilies"][0]["budget"]["remaining"], 19)
        self.assertIn("aq handoff", desk["handoff"]["command"])
        self.assertEqual(desk["trialGate"]["acknowledgement"], "--confirm-trial")
        code, summary = aq("capabilities", "--summary")
        ids = {row["id"] for row in summary["data"]["commands"]} if isinstance(summary["data"], dict) else set()
        self.assertTrue({"handoff", "family.list", "family.show", "family.declare"} <= ids, summary["data"])

    def test_studio_actions_use_the_same_core_gate(self) -> None:
        from autoquant.studio_actions import ActionError, _studio_trial_gate
        workspace = self.copy()
        (workspace / "autoquant-research-policy.json").write_text(json.dumps(
            {"schemaVersion": 1, "kind": "autoquant-research-policy",
             "trialBudget": {"maxCountedTrialsPerFamily": 1, "windowDays": 30}}), encoding="utf-8")
        with self.assertRaises(ActionError) as caught:
            _studio_trial_gate(load_project(workspace / "projects" / "reversal-a"), STUDY)
        self.assertEqual(caught.exception.code, "trial-gate.budget-exhausted")

    # -- handoff.json ------------------------------------------------------

    def test_handoff_refuses_missing_caller_validity(self) -> None:
        code, refused = aq("handoff", str(self.base), "--project", "reversal-a", "--run", self.run_a,
                           "--valid-from", "2026-11-04", "--valid-until", "2026-12-04")
        self.assertEqual(code, 1)
        self.assertEqual(refused["error"]["issues"][0]["code"], "handoff.validity-required")

    def test_inconclusive_handoff_round_trips_schema_valid_without_invented_orders(self) -> None:
        workspace = self.copy()
        code, written = aq("handoff", str(workspace), "--project", "reversal-a", "--run", self.run_a,
                           "--valid-from", "2026-11-04", "--valid-until", "2026-12-04", "--review-date", "2026-11-18",
                           "--assumption", "Synthetic OpenAlice fixture")
        self.assertEqual(code, 0, written)
        path = Path(written["data"]["handoffPath"])
        stored = json.loads(path.read_text(encoding="utf-8"))
        jsonschema.validate(stored, RESEARCH_HANDOFF_JSON_SCHEMA)
        self.assertEqual(stored, written["data"]["handoff"])
        self.assertEqual(path.name, HANDOFF_FILE)
        self.assertEqual(Path(stored["primaryDeliverableDirectory"]), path.parent)
        verdict = stored["verdicts"][0]
        self.assertIn(verdict["word"], {"Inconclusive", "Could not be tested"})
        self.assertNotIn("Refuted", json.dumps(stored))
        self.assertEqual(verdict["word"], "Inconclusive", verdict)
        self.assertTrue(verdict["reasons"])
        self.assertEqual(stored["decisions"][0]["targetWeights"], None)
        self.assertEqual(stored["decisions"][0]["orderIntents"], None)
        self.assertEqual(stored["decisions"][0]["source"], "not-in-evidence")
        self.assertEqual(stored["tradingAuthority"], "none")
        self.assertEqual({i["symbol"]: i["barId"] for i in stored["instruments"]},
                         {s: f"yfinance|{s}" for s in ASSETS})
        self.assertEqual(stored["splits"]["externalHoldout"]["heldInDesk"], False)
        self.assertFalse(stored["splits"]["lanes"][0]["visibleTest"]["metricsIncluded"])
        self.assertEqual(stored["trialFamilies"][0]["deskTrialCount"], 1)

    def test_handoff_schema_file_matches_core(self) -> None:
        checked_in = json.loads((ROOT / "docs" / "design" / "research-handoff.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(checked_in, json.loads(json.dumps(RESEARCH_HANDOFF_JSON_SCHEMA)))
        bad = {"word": "Refuted"}
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(bad, RESEARCH_HANDOFF_JSON_SCHEMA["properties"]["verdicts"]["items"]["properties"]["word"])

    # -- acquire-openalice-bars -------------------------------------------

    def test_openalice_package_is_accepted_by_strict_intake_and_validate(self) -> None:
        manifest = json.loads(self.dataset.read_text(encoding="utf-8"))
        self.assertEqual(manifest["provider"]["name"], "openalice")
        decoded = decode_openalice_source_uri(manifest["provider"]["sourceUri"])
        self.assertEqual(decoded["barIds"], {s: f"yfinance|{s}" for s in ASSETS})
        self.assertEqual((decoded["interval"], decoded["timezone"], decoded["adjustment"]),
                         ("1d", "America/New_York", "split-adjusted"))
        self.assertEqual(manifest["provider"]["sourceUri"], encode_openalice_source_uri(
            decoded["barIds"], interval="1d", timezone="America/New_York", adjustment="split-adjusted"))
        provenance = json.loads((self.dataset.parent / "openalice-provenance.json").read_text(encoding="utf-8"))
        self.assertEqual(provenance["source"]["system"], "openalice")
        code, validated = aq("validate", str(self.base), "--project", "reversal-a")
        self.assertEqual(code, 0, validated)

    def test_openalice_packaging_refuses_instead_of_defaulting(self) -> None:
        scratch = Path(tempfile.mkdtemp(prefix="aq-openalice-"))
        self.addCleanup(shutil.rmtree, scratch, ignore_errors=True)
        code, refused = package(scratch / "missing", "--calendar", "XNYS")
        self.assertEqual((code, refused["error"]["code"]), (1, "openalice.caller-fact-missing"))
        self.assertFalse((scratch / "missing").exists())
        cases = {
            "openalice.bar-id-mismatch": lambda doc: doc["meta"].update(barId="alpaca|AAPL"),
            "openalice.volume": lambda doc: doc["bars"][3].update(volume=None),
            "openalice.truncated": lambda doc: doc["meta"].update(truncatedRows=5),
            "openalice.panel-misaligned": lambda doc: doc["bars"].pop(10),
        }
        for expected, mutate in cases.items():
            source = scratch / expected
            shutil.copytree(FIXTURE, source)
            document = json.loads((source / "AAPL.json").read_text(encoding="utf-8"))
            mutate(document)
            (source / "AAPL.json").write_text(json.dumps(document), encoding="utf-8")
            code, refused = package(scratch / f"{expected}-out", *FACTS, assets=source / "assets.json")
            self.assertEqual((code, refused["error"]["code"]), (1, expected))
            self.assertFalse((scratch / f"{expected}-out").exists())
        code, refused = package(scratch / "hourly", *FACTS, "--interval", "1h")
        self.assertEqual(refused["error"]["code"], "openalice.interval")


if __name__ == "__main__":
    unittest.main()
