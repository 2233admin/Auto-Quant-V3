from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import replace

from autoquant.runs import execute_study
from autoquant.studies import StudySubject, create_study
from autoquant.studio import build_workspace_summary
from autoquant.workspace import create_project
from tests.study_helpers import make_project, study_definition


REFERENCE = {
    "id": "momentum-20",
    "name": "Momentum",
    "formula": "C[t]/C[t-20]-1",
    "direction": "higher",
    "evidence": "Development comparison only.",
    "source": "https://example.test/formula",
}
JUDGE = """\
import json
import os
from pathlib import Path

Path(os.environ["AUTOQUANT_ARTIFACTS_DIR"], "daily.csv").write_text(
    "day,first,second,cash,momentum,kit,control\\n"
    "2026-01-05,A,B,True,0.03,0.01,0.04\\n",
    encoding="utf-8",
)
Path(os.environ["AUTOQUANT_RUN_OUTPUT"]).write_text(json.dumps({
    "schema_version": 1, "status": "succeeded", "summary": "Paired decision",
    "metrics": {"dates": 1, "cash_dates": 1, "score": -200, "versus_same_exposure_bp": -300},
    "artifacts": [{"kind": "report", "path": "daily.csv", "description": "Decision evidence"}],
    "errors": [],
}), encoding="utf-8")
"""


class StudioFactorReferencesTests(unittest.TestCase):
    def test_reference_is_project_scoped_and_never_promoted_to_a_formal_factor(self):
        with tempfile.TemporaryDirectory() as tmp:
            workspace, project = make_project(tmp)
            create_project(workspace.root_dir, "other")
            path = project.root_dir / "factors" / "references.json"
            path.write_text(
                json.dumps({"schemaVersion": 1, "factors": [REFERENCE]}),
                encoding="utf-8",
            )
            summary = build_workspace_summary(workspace.root_dir)
            own, other = summary["projects"]
            self.assertEqual(
                own["library"]["factorReferences"],
                {"factors": [REFERENCE], "invalid": False},
            )
            self.assertIsNone(own["library"]["factor"])
            self.assertNotIn("factorReferences", other["library"])
            path.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "factors": [
                            {**REFERENCE, "source": "javascript:alert(1)"},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            invalid = build_workspace_summary(
                workspace.root_dir, project_id=project.manifest.id
            )["projects"][0]
            self.assertEqual(
                invalid["library"]["factorReferences"], {"factors": [], "invalid": True}
            )

    def test_paired_history_requires_the_exact_intact_research_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            workspace, project = make_project(tmp)
            (project.root_dir / "judges" / "evaluate.py").write_text(
                JUDGE, encoding="utf-8"
            )
            target = "kit-confirmation"
            for study_id in (target, "other-study"):
                create_study(
                    project,
                    replace(
                        study_definition(study_id=study_id),
                        subject=StudySubject("research", study_id, "working"),
                    ),
                )
            replay = execute_study(project, target)
            unrelated = execute_study(project, "other-study")
            self.assertEqual(replay.result["status"], "succeeded")
            self.assertEqual(unrelated.result["status"], "succeeded")
            path = project.root_dir / "factors" / "references.json"

            def observed(run_id):
                path.write_text(
                    json.dumps(
                        {
                            "schemaVersion": 1,
                            "factors": [
                                {**REFERENCE, "replayRun": run_id},
                            ],
                        }
                    ),
                    encoding="utf-8",
                )
                (project_summary,) = build_workspace_summary(workspace.root_dir)[
                    "projects"
                ]
                return project_summary["library"]["factorReferences"]["factors"][0]

            result = observed(replay.manifest["id"])["replay"]
            self.assertEqual(result["runId"], replay.manifest["id"])
            self.assertEqual(
                result["daily"],
                [
                    {
                        "day": "2026-01-05",
                        "first": "A",
                        "second": "B",
                        "cash": True,
                        "momentum": 0.03,
                        "kit": 0.01,
                        "control": 0.04,
                    },
                ],
            )
            self.assertNotIn("replay", observed(unrelated.manifest["id"]))
            self.assertNotIn("replay", observed("run-missing"))
            (replay.root_dir / "artifacts" / "daily.csv").write_text(
                "tampered", encoding="utf-8"
            )
            self.assertNotIn("replay", observed(replay.manifest["id"]))
