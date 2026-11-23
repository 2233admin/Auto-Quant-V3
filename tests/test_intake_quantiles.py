from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from autoquant.intake import prepare_project_intake
from autoquant.studies import QUANTILE_CHOICES, load_study
from autoquant.templates import OHLCV_STUDY_ID
from autoquant.workspace import (
    AutoQuantValidationError,
    create_project,
    initialize_workspace,
)
from tests.intake_helpers import INTAKE_ASSETS, write_intake_inputs
from tests.test_cli import json_output, run_cli


class FactorLabIntakeQuantileTests(unittest.TestCase):
    def _inputs(self, root: Path, name: str, **options):
        directory = root / name
        directory.mkdir()
        return write_intake_inputs(directory, **options)

    def _study(self, root: Path, name: str, quantiles: int | None, **options):
        request, package = self._inputs(root, name, **options)
        prepared = prepare_project_intake(
            request, package, "ohlcv-factor-lab", quantiles=quantiles
        )
        project = create_project(
            initialize_workspace(root / f"{name}-workspace").root_dir,
            name,
            template=prepared.template,
            template_intake=prepared,
        )
        study = load_study(project, OHLCV_STUDY_ID)
        manifest = json.loads(study.manifest_path.read_text(encoding="utf-8"))
        return study, manifest

    def test_the_allowed_set_is_the_study_set(self) -> None:
        self.assertEqual(QUANTILE_CHOICES, (3, 5, 10))

    def test_an_explicit_count_reaches_the_frozen_judge_like_study_create(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, default = self._study(root, "default", None)
            wide = tuple(f"AST{number:02d}" for number in range(10))
            for count, options in (
                (3, {}),
                (5, {}),
                (10, {"assets": wide, "request_assets": wide[:2]}),
            ):
                study, manifest = self._study(root, f"q{count}", count, **options)
                self.assertEqual(study.definition.judge.quantiles, count)
                self.assertEqual(
                    manifest["judge"], {**default["judge"], "quantiles": count}
                )
                if not options:
                    self.assertEqual(
                        {
                            key: value
                            for key, value in manifest.items()
                            if key != "judge"
                        },
                        {
                            key: value
                            for key, value in default.items()
                            if key != "judge"
                        },
                    )

    def test_leaving_the_count_out_keeps_the_study_bytes_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            study, manifest = self._study(root, "plain", None)
            self.assertIsNone(study.definition.judge.quantiles)
            self.assertNotIn("quantiles", manifest["judge"])

    def test_ten_groups_need_ten_assets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request, package = self._inputs(root, "ten")
            with self.assertRaises(AutoQuantValidationError) as caught:
                prepare_project_intake(
                    request, package, "ohlcv-factor-lab", quantiles=10
                )
            self.assertEqual(
                [issue.code for issue in caught.exception.issues],
                ["study.quantile-population"],
            )

    def test_a_cross_sectional_population_must_fill_every_group(self) -> None:
        policy = {
            "claim": "decision-signal",
            "knownStyle": None,
            "predictionAssets": list(INTAKE_ASSETS[:4]),
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request, package = self._inputs(
                root, "pop", factor_policy=policy, request_assets=INTAKE_ASSETS
            )
            with self.assertRaises(AutoQuantValidationError) as caught:
                prepare_project_intake(
                    request, package, "ohlcv-factor-lab", quantiles=5
                )
            issue = caught.exception.issues[0]
            self.assertEqual(issue.code, "study.quantile-population")
            self.assertIn(
                "5 quantiles require at least 5 prediction assets", issue.message
            )
            prepared = prepare_project_intake(
                request, package, "ohlcv-factor-lab", quantiles=3
            )
            self.assertEqual(prepared.quantiles, 3)

    def test_other_templates_and_other_counts_are_refused(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request, package = self._inputs(root, "other")
            with self.assertRaises(AutoQuantValidationError) as caught:
                prepare_project_intake(
                    request, package, "ohlcv-research-desk", quantiles=5
                )
            self.assertEqual(
                [issue.code for issue in caught.exception.issues],
                ["intake.quantiles-template"],
            )
            for bad in (4, 0, True, "5"):
                with self.assertRaises(AutoQuantValidationError) as caught:
                    prepare_project_intake(
                        request, package, "ohlcv-factor-lab", quantiles=bad
                    )  # type: ignore[arg-type]
                self.assertEqual(
                    [issue.code for issue in caught.exception.issues],
                    ["schema.choice"],
                    bad,
                )

    def test_the_cli_accepts_only_the_study_set_and_freezes_the_count(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request, package = self._inputs(root, "cli")
            workspace = initialize_workspace(root / "cli-workspace").root_dir
            base = [
                "project",
                "intake",
                str(workspace),
                "five",
                "--request",
                str(request),
                "--dataset",
                str(package),
                "--template",
                "ohlcv-factor-lab",
            ]
            refused = run_cli(*base, "--quantiles", "4", "--json")
            self.assertEqual(refused.returncode, 2)
            self.assertEqual(json_output(refused)["error"]["code"], "cli.usage")
            self.assertIn(
                "invalid choice: 4 (choose from 3, 5, 10)",
                json_output(refused)["error"]["message"],
            )
            made = run_cli(*base, "--quantiles", "5", "--json")
            self.assertEqual(made.returncode, 0, made.stderr)
            self.assertTrue(json_output(made)["ok"])
            study = json.loads(
                (
                    workspace
                    / "projects"
                    / "five"
                    / "studies"
                    / OHLCV_STUDY_ID
                    / "study.json"
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(study["judge"]["quantiles"], 5)


if __name__ == "__main__":
    unittest.main()
