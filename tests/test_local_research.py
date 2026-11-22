from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from autoquant.local_research import LocalResearchPlan, extract_candidates
from autoquant.research import load_campaign, run_campaign
from autoquant.sessions import load_session, start_session
from autoquant.studies import create_study
from autoquant.workspace import AutoQuantValidationError
from tests.study_helpers import SUCCESS_JUDGE, make_project, study_definition

DIGEST = "1" * 64
MODEL = "test-research:v1"
TARGET = "factors/parameters.json"


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value), encoding="utf-8")


class LocalResearchTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        _, self.project = make_project(self.root)
        self.candidate = self.project.root_dir / TARGET
        write_json(self.candidate, {"score": 1.25})
        judge = self.project.root_dir / "judges/evaluate.py"
        judge.write_text(
            SUCCESS_JUDGE.replace(
                "from factors.candidate import SCORE",
                f'SCORE = json.loads(Path("{TARGET}").read_text())["score"]',
            ),
            encoding="utf-8",
        )
        create_study(self.project, study_definition(editable=[TARGET]))
        self.session_id = start_session(self.project, "factor-quality").manifest["id"]
        self.plan_path = self.root / "local-plan.json"
        write_json(
            self.plan_path,
            {
                "schemaVersion": 1,
                "model": MODEL,
                "modelDigest": DIGEST,
                "candidatePath": TARGET,
                "options": {
                    "up": {"description": "higher parameter", "values": {"score": 2.0}},
                    "down": {
                        "description": "lower parameter",
                        "values": {"score": 0.5},
                    },
                },
            },
        )
        self.plan = LocalResearchPlan.load(self.plan_path)

    def _run(self):
        return run_campaign(
            self.project,
            self.session_id,
            self.plan,
            max_turns=2,
            max_wall_seconds=60,
            turn_timeout_seconds=15,
        )

    def test_campaign_returns_fixed_measurement_to_model_and_respects_leader(
        self,
    ) -> None:
        prompts = []

        def respond(model, digest, messages, schema, timeout):
            self.assertEqual((model, digest), (MODEL, DIGEST))
            prompt = json.loads(messages[1]["content"])
            prompts.append(prompt)
            preset = "up" if len(prompts) == 1 else "down"
            self.assertIn(preset, schema["properties"]["preset"]["enum"])
            return json.dumps(
                dict(
                    preset=preset,
                    hypothesis="Test the preset",
                    expected_effect="Change score",
                )
            ), DIGEST

        with patch("autoquant.local_research._model_json", side_effect=respond):
            campaign = self._run()
        self.assertEqual(campaign.result["status"], "budget_exhausted")
        self.assertEqual(
            campaign.result["verdicts"], {"KEEP": 1, "REVERT": 1, "CRASH": 0}
        )
        self.assertEqual(prompts[0]["measuredHistory"], [])
        (feedback,) = prompts[1]["measuredHistory"]
        self.assertEqual(
            (feedback["strategy"], feedback["candidateValue"], feedback["improvement"]),
            ("up", 2.0, 0.75),
        )
        self.assertEqual(feedback["experimentId"], campaign.result["experiments"][0])
        self.assertNotIn("up", prompts[1]["approvedPresets"])
        session = load_session(self.project, self.session_id)
        self.assertEqual(session.manifest["leader"]["value"], 2.0)
        self.assertEqual(json.loads(self.candidate.read_text()), {"score": 1.25})
        self.assertEqual(
            load_campaign(self.project, session, campaign.result["id"]).result,
            campaign.result,
        )
        actual_prompt = campaign.root_dir / "turns/turn-0002/local-model-request.json"
        actual_prompt.write_text("{}", encoding="utf-8")
        with self.assertRaisesRegex(AutoQuantValidationError, "Campaign files changed"):
            load_campaign(self.project, session, campaign.result["id"])

    def test_unapproved_model_output_does_not_evaluate_or_write(self) -> None:
        output = json.dumps(
            dict(preset="up", hypothesis="test", expected_effect="change", score=13)
        )
        with patch(
            "autoquant.local_research._model_json", return_value=(output, DIGEST)
        ):
            campaign = self._run()
        self.assertEqual(campaign.result["status"], "failed")
        self.assertEqual(
            campaign.result["errors"][0]["code"], "local-research.proposal"
        )
        self.assertEqual(campaign.result["experiments"], [])
        session = load_session(self.project, self.session_id)
        self.assertEqual(
            json.loads((session.worktree_project.root_dir / TARGET).read_text()),
            {"score": 1.25},
        )

    def test_campaign_refuses_existing_unmeasured_edit(self) -> None:
        session = load_session(self.project, self.session_id)
        candidate = session.worktree_project.root_dir / TARGET
        write_json(candidate, {"score": 3.0})
        with patch("autoquant.local_research._model_json") as model:
            with self.assertRaisesRegex(
                AutoQuantValidationError, "unchanged Session leader"
            ):
                self._run()
        model.assert_not_called()
        self.assertEqual(json.loads(candidate.read_text()), {"score": 3.0})


class FeatureExtractionTests(unittest.TestCase):
    def test_receipt_copies_the_exact_validated_source_line(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            text = Path(directory) / "source.txt"
            receipt = Path(directory) / "result.json"
            text.write_text(
                "Returns must be adjusted.\nCount only prior dates.", encoding="utf-8"
            )
            item = dict(
                id="adjusted_returns",
                name="Adjusted returns",
                kind="factor",
                grain="stock-day",
                evidenceLine=1,
                rule="Use adjusted returns",
                inputs=["close"],
                gap=None,
            )
            bad = {**item, "evidenceLine": 3}
            with patch(
                "autoquant.local_research._model_json",
                return_value=(json.dumps({"items": [bad]}), DIGEST),
            ):
                with self.assertRaisesRegex(
                    AutoQuantValidationError, "nonempty source line"
                ):
                    extract_candidates(text, MODEL, receipt)
            self.assertFalse(receipt.exists())
            with patch(
                "autoquant.local_research._model_json",
                return_value=(
                    json.dumps({"items": [item, {**item, "id": "repeat"}]}),
                    DIGEST,
                ),
            ) as model:
                result = extract_candidates(text, MODEL, receipt)
                with self.assertRaisesRegex(AutoQuantValidationError, "already exists"):
                    extract_candidates(text, MODEL, receipt)
            model.assert_called_once()
            self.assertEqual(json.loads(receipt.read_text()), result)
            expected = {
                key: value for key, value in item.items() if key != "evidenceLine"
            }
            expected["evidence"] = "Returns must be adjusted."
            expected["sourceLine"] = 1
            self.assertEqual(result["items"], [expected])
            self.assertEqual(result["model_digest"], DIGEST)
            self.assertEqual(result["duplicate_names"], ["Adjusted returns"])
