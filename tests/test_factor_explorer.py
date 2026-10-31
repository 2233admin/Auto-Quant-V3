from __future__ import annotations

import csv
import json
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import jsonschema

from autoquant.factor_explorer import (
    FACTOR_DIAGNOSTICS_JSON_SCHEMA,
    MAX_CUMULATIVE_POINTS,
    _cumulative_quantiles,
    _spread_summary,
    load_factor_diagnostics,
)
from autoquant.intake import prepare_project_intake
from autoquant.runs import execute_study
from autoquant.studio import build_studio_snapshot
from autoquant.studies import hash_file
from autoquant.templates import OHLCV_STUDY_ID, PORTFOLIO_STUDY_ID
from autoquant.workspace import (
    AutoQuantValidationError,
    create_project,
    initialize_workspace,
)
from tests.intake_helpers import write_intake_inputs


def make_lab(root: Path, *, template: str = "ohlcv-factor-lab"):
    workspace = initialize_workspace(root / "workspace")
    project = create_project(
        workspace.root_dir,
        "factor-evidence",
        template=template,
    )
    study_id = (
        OHLCV_STUDY_ID
        if template == "ohlcv-factor-lab"
        else PORTFOLIO_STUDY_ID
    )
    return workspace, project, execute_study(project, study_id)


def rehash_run(run_root: Path) -> None:
    manifest_path = run_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["files"] = {
        path.relative_to(run_root).as_posix(): hash_file(path)
        for path in sorted(run_root.rglob("*"))
        if path.is_file() and path != manifest_path
    }
    manifest["resultHash"] = manifest["files"]["result.json"]
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


class FactorEvidenceExplorerTests(unittest.TestCase):
    def test_primary_horizon_sampling_does_not_require_one_bar_diagnostics(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request_path, package_path = write_intake_inputs(
                root,
                observations=640,
                horizon_policy={
                    "primaryForwardBars": 20,
                    "diagnosticForwardBars": [5, 20, 60],
                },
            )
            prepared = prepare_project_intake(
                request_path,
                package_path,
                "ohlcv-factor-lab",
            )
            project = create_project(
                initialize_workspace(root / "workspace").root_dir,
                "custom-horizon-factor",
                template=prepared.template,
                template_intake=prepared,
            )
            run = execute_study(project, OHLCV_STUDY_ID)
            diagnostics = load_factor_diagnostics(
                project,
                run.result["id"],
                point_limit=64,
            )

            self.assertEqual(
                diagnostics["protocol"]["horizons"],
                [5, 20, 60],
            )
            self.assertEqual(
                diagnostics["protocol"]["primaryHorizon"],
                20,
            )
            causality = diagnostics["protocol"]["causality"]
            self.assertTrue(causality["available"])
            self.assertEqual(causality["audit"], "whole-panel-timestamp-prefix")
            self.assertTrue(causality["cuts"])
            daily_path = (
                run.root_dir / "artifacts" / "daily-factor-evidence.csv"
            )
            with daily_path.open(encoding="utf-8", newline="") as handle:
                daily = list(csv.DictReader(handle))
            maximum = max(
                daily,
                key=lambda row: abs(float(row["rank_ic_h20"] or 0.0)),
            )
            sampled_dates = {
                item["timestamp"]
                for item in diagnostics["icPath"]["points"]
            }
            self.assertIn(maximum["timestamp"], sampled_dates)
            jsonschema.validate(
                diagnostics,
                FACTOR_DIAGNOSTICS_JSON_SCHEMA,
            )

    def test_projection_reconciles_paths_horizons_and_stability(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, project, run = make_lab(Path(directory))
            diagnostics = load_factor_diagnostics(
                project,
                run.result["id"],
                point_limit=64,
            )

            self.assertEqual(
                diagnostics["kind"],
                "autoquant-factor-diagnostics",
            )
            self.assertEqual(diagnostics["run"]["inputHash"], run.result["inputHash"])
            self.assertEqual(diagnostics["icPath"]["sampledRows"], 64)
            self.assertGreater(diagnostics["icPath"]["totalRows"], 64)
            self.assertEqual(
                diagnostics["summary"]["validation"]["meanRankIc"],
                run.result["metrics"]["validation"]["mean_ic"],
            )
            self.assertEqual(
                diagnostics["summary"]["testAudit"]["meanRankIc"],
                run.result["metrics"]["test"]["mean_ic"],
            )
            self.assertFalse(diagnostics["protocol"]["testEntersSelection"])
            self.assertEqual(
                [item["horizon"] for item in diagnostics["horizonProfile"]],
                [1, 5, 10],
            )
            self.assertEqual(len(diagnostics["quantileSummary"]), 9)
            self.assertEqual(
                diagnostics["quantileEvidence"],
                {
                    "status": "available",
                    "evaluationMode": "cross-sectional",
                    "method": "fixed low/middle/high cross-sectional groups",
                    "artifactKind": "factor-quantiles",
                    "artifactRows": diagnostics["quantilePath"]["totalRows"],
                    "reasonCode": None,
                    "reason": None,
                    "authority": "diagnostic-only",
                },
            )
            cumulative = diagnostics["quantilePath"]["cumulative"]
            self.assertEqual(cumulative["horizon"], 1)
            self.assertGreater(cumulative["totalRows"], 0)
            self.assertEqual(
                diagnostics["spreadSummary"]["status"], "available"
            )
            self.assertEqual(
                [item["split"] for item in diagnostics["spreadSummary"]["splits"]],
                ["train", "validation", "test"],
            )
            self.assertEqual(len(diagnostics["stability"]["assets"]), 18)
            self.assertEqual(len(diagnostics["stability"]["styles"]), 12)
            self.assertEqual(len(diagnostics["coverage"]), 6)
            availability = diagnostics["inputAvailability"]
            self.assertTrue(availability["available"])
            self.assertEqual(
                availability["observationCoverage"],
                1.0,
            )
            self.assertEqual(
                availability["assetsPerTimestamp"]["input"],
                {"minimum": 6, "median": 6.0, "maximum": 6},
            )
            self.assertEqual(
                diagnostics["availabilityPath"]["sampledRows"],
                diagnostics["icPath"]["sampledRows"],
            )
            qualification = diagnostics["factorQualification"]
            self.assertTrue(qualification["available"])
            self.assertEqual(
                qualification["selection"]["split"],
                "train",
            )
            self.assertFalse(
                qualification["selection"]["validationEntersSelection"]
            )
            self.assertFalse(
                qualification["semantics"]["testEntersDiagnosis"]
            )
            self.assertEqual(
                qualification["validation"]["role"],
                "selection",
            )
            self.assertEqual(
                qualification["testAudit"]["role"],
                "visible-audit",
            )
            self.assertEqual(
                qualification["diagnosis"]["stage"],
                "raw-statistical-evidence-weak",
            )
            self.assertAlmostEqual(
                qualification["validation"]["candidate"]["meanRankIc"],
                diagnostics["summary"]["validation"]["meanRankIc"],
            )
            self.assertAlmostEqual(
                qualification["validation"]["styleNeutralCandidate"][
                    "meanRankIc"
                ]
                - qualification["validation"]["candidate"]["meanRankIc"],
                qualification["validation"]["incremental"][
                    "styleNeutralIcDelta"
                ],
            )
            self.assertEqual(
                len(
                    qualification["validation"][
                        "styleNeutralChronologicalFolds"
                    ]
                ),
                2,
            )
            components = diagnostics["factorComponents"]
            self.assertTrue(components["available"])
            self.assertEqual(
                components["trialDisclosure"],
                {
                    "materializedComponents": 1,
                    "crossSectionalScoreComponents": 1,
                    "timestampContextComponents": 0,
                    "pairwiseComparisons": 0,
                    "entersPromotionScore": False,
                },
            )
            self.assertEqual(
                components["validationDiagnosis"][
                    "strongestRawComponent"
                ],
                "base_momentum_10",
            )
            self.assertIsNone(
                components["components"][0]["nearestPeer"]["id"]
            )
            self.assertFalse(
                components["declaration"]["sourceInference"]
            )

            sampled_dates = {
                item["timestamp"] for item in diagnostics["icPath"]["points"]
            }
            daily_path = run.root_dir / "artifacts" / "daily-factor-evidence.csv"
            with daily_path.open(encoding="utf-8", newline="") as handle:
                daily = list(csv.DictReader(handle))
            self.assertIn(daily[0]["timestamp"], sampled_dates)
            self.assertIn(daily[-1]["timestamp"], sampled_dates)
            for split in ("train", "validation", "test"):
                contract = run.result["metrics"]["split_protocol"]["splits"][split]
                self.assertIn(contract["start"], sampled_dates)
            maximum = max(
                daily,
                key=lambda row: abs(float(row["rank_ic_h1"] or 0.0)),
            )
            self.assertIn(maximum["timestamp"], sampled_dates)

            validation_quantiles = [
                item
                for item in diagnostics["quantilePath"]["points"]
                if item["split"] == "validation" and item["horizon"] == 1
            ]
            self.assertTrue(validation_quantiles)
            self.assertTrue(
                all(
                    math.isclose(
                        item["high"] - item["low"],
                        item["highMinusLow"],
                        abs_tol=1e-10,
                    )
                    for item in validation_quantiles
                )
            )
            jsonschema.validate(
                diagnostics,
                FACTOR_DIAGNOSTICS_JSON_SCHEMA,
            )

            snapshot = build_studio_snapshot(workspace.root_dir)
            observed = snapshot["projects"][0]
            self.assertEqual(
                observed["factorExplorer"]["run"]["id"],
                run.result["id"],
            )
            self.assertIn(
                "run.factor",
                [item["id"] for item in observed["commands"]],
            )

            availability_path = (
                run.root_dir / "artifacts" / "factor-availability.csv"
            )
            original_availability = availability_path.read_text(
                encoding="utf-8"
            )
            availability_rows = original_availability.splitlines()
            availability_header = availability_rows[0].split(",")
            availability_cells = availability_rows[1].split(",")
            input_assets_index = availability_header.index("input_assets")
            availability_cells[input_assets_index] = str(
                int(availability_cells[input_assets_index]) - 1
            )
            availability_rows[1] = ",".join(availability_cells)
            availability_path.write_text(
                "\n".join(availability_rows) + "\n",
                encoding="utf-8",
            )
            rehash_run(run.root_dir)
            with self.assertRaisesRegex(
                AutoQuantValidationError,
                "reconcile",
            ):
                load_factor_diagnostics(project, run.result["id"])
            availability_path.write_text(
                original_availability,
                encoding="utf-8",
            )
            reordered = original_availability.splitlines()
            reordered[1], reordered[2] = reordered[2], reordered[1]
            availability_path.write_text(
                "\n".join(reordered) + "\n",
                encoding="utf-8",
            )
            rehash_run(run.root_dir)
            with self.assertRaisesRegex(
                AutoQuantValidationError,
                "unique and chronological",
            ):
                load_factor_diagnostics(project, run.result["id"])
            availability_path.write_text(
                original_availability,
                encoding="utf-8",
            )

            qualification_path = (
                run.root_dir / "artifacts" / "factor-qualification.csv"
            )
            original_qualification = qualification_path.read_text(
                encoding="utf-8"
            )
            qualification_rows = original_qualification.splitlines()
            cells = qualification_rows[1].split(",")
            header = qualification_rows[0].split(",")
            candidate_index = header.index("candidate_rank_ic_h1")
            cells[candidate_index] = "0.999"
            qualification_rows[1] = ",".join(cells)
            qualification_path.write_text(
                "\n".join(qualification_rows) + "\n",
                encoding="utf-8",
            )
            rehash_run(run.root_dir)
            with self.assertRaisesRegex(
                AutoQuantValidationError,
                "candidate daily rank IC",
            ):
                load_factor_diagnostics(project, run.result["id"])

            qualification_path.write_text(
                original_qualification,
                encoding="utf-8",
            )
            component_path = (
                run.root_dir / "artifacts" / "factor-components.json"
            )
            original_components = component_path.read_text(
                encoding="utf-8"
            )
            tampered_components = json.loads(original_components)
            tampered_components["evidence"]["components"][0][
                "mean_coverage"
            ] = 0.123
            component_path.write_text(
                json.dumps(tampered_components, indent=2, sort_keys=True)
                + "\n",
                encoding="utf-8",
            )
            rehash_run(run.root_dir)
            with self.assertRaisesRegex(
                AutoQuantValidationError,
                "does not reconcile immutable Run",
            ):
                load_factor_diagnostics(project, run.result["id"])

            component_path.write_text(
                original_components,
                encoding="utf-8",
            )
            result_path = run.root_dir / "result.json"
            report_path = run.root_dir / "artifacts" / "factor-report.json"
            legacy_result = json.loads(
                result_path.read_text(encoding="utf-8")
            )
            legacy_report = json.loads(
                report_path.read_text(encoding="utf-8")
            )
            legacy_result["metrics"].pop("factor_qualification")
            legacy_result["metrics"].pop("factor_components")
            legacy_result["metrics"].pop("input_availability")
            legacy_result["artifacts"] = [
                item
                for item in legacy_result["artifacts"]
                if item["kind"]
                not in {
                    "factor-availability",
                    "factor-qualification",
                    "factor-components",
                }
            ]
            legacy_report["metrics"].pop("factor_qualification")
            legacy_report["metrics"].pop("factor_components")
            legacy_report["metrics"].pop("input_availability")
            legacy_report.pop("inputAvailability")
            legacy_report["semantics"].pop("qualification")
            legacy_report["semantics"]["components"] = None
            result_path.write_text(
                json.dumps(legacy_result, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            report_path.write_text(
                json.dumps(legacy_report, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            availability_path.unlink()
            qualification_path.unlink()
            component_path.unlink()
            rehash_run(run.root_dir)
            legacy = load_factor_diagnostics(project, run.result["id"])
            self.assertFalse(legacy["inputAvailability"]["available"])
            self.assertFalse(legacy["factorQualification"]["available"])
            self.assertFalse(legacy["factorComponents"]["available"])
            jsonschema.validate(
                legacy,
                FACTOR_DIAGNOSTICS_JSON_SCHEMA,
            )

    def test_limits_and_non_factor_runs_fail_structurally(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            _, project, run = make_lab(Path(directory))
            with self.assertRaisesRegex(
                AutoQuantValidationError,
                "point_limit must be 40..400",
            ):
                load_factor_diagnostics(
                    project,
                    run.result["id"],
                    point_limit=39,
                )
            with patch(
                "autoquant.factor_explorer.MAX_ARTIFACT_BYTES",
                1,
            ), self.assertRaisesRegex(
                AutoQuantValidationError,
                "exceeds 1 bytes",
            ):
                load_factor_diagnostics(project, run.result["id"])

        with tempfile.TemporaryDirectory() as directory:
            _, project, run = make_lab(
                Path(directory),
                template="ohlcv-portfolio-lab",
            )
            with self.assertRaisesRegex(
                AutoQuantValidationError,
                "not a fixed Factor Lab",
            ):
                load_factor_diagnostics(project, run.result["id"])

    def test_rehashed_truncated_daily_artifact_remains_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            _, project, run = make_lab(Path(directory))
            daily_path = run.root_dir / "artifacts" / "daily-factor-evidence.csv"
            lines = daily_path.read_text(encoding="utf-8").splitlines()
            daily_path.write_text("\n".join(lines[:-1]) + "\n", encoding="utf-8")
            rehash_run(run.root_dir)

            with self.assertRaisesRegex(
                AutoQuantValidationError,
                "Daily rows do not reconcile test split size",
            ):
                load_factor_diagnostics(project, run.result["id"])

    def test_studio_drops_only_invalid_factor_explorer_claims(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace, project, run = make_lab(Path(directory))
            daily_path = run.root_dir / "artifacts" / "daily-factor-evidence.csv"
            lines = daily_path.read_text(encoding="utf-8").splitlines()
            daily_path.write_text("\n".join(lines[:-1]) + "\n", encoding="utf-8")
            rehash_run(run.root_dir)

            snapshot = build_studio_snapshot(workspace.root_dir)
            observed = snapshot["projects"][0]

            self.assertEqual(len(observed["runs"]), 1)
            self.assertIsNone(observed["factorExplorer"])
            self.assertFalse(observed["valid"])
            self.assertTrue(
                any(
                    item["category"].startswith("factor-explorer:")
                    for item in observed["diagnostics"]
                )
            )


class QuantileProjectionTests(unittest.TestCase):
    ROLES = {
        "train": "training",
        "validation": "selection",
        "test": "visible-audit",
    }

    def row(self, day, split, low, middle, high, horizon=1):
        return {
            "timestamp": day,
            "split": split,
            "role": self.ROLES[split],
            "horizon": horizon,
            "low": low,
            "middle": middle,
            "high": high,
            "highMinusLow": high - low,
        }

    def toy(self):
        # Deliberately unsorted and with a horizon-5 row that must be ignored.
        return [
            self.row("2024-01-04", "validation", 0.0, 0.0, -0.5),
            self.row("2024-01-02", "train", 0.01, 0.02, 0.10),
            self.row("2024-01-03", "train", -0.02, 0.0, 0.10),
            self.row("2024-01-05", "test", 0.0, 0.01, 0.2),
            self.row("2024-01-02", "train", 9.0, 9.0, 9.0, horizon=5),
        ]

    def test_cumulative_matches_hand_compounding(self) -> None:
        cumulative = _cumulative_quantiles(self.toy())
        self.assertEqual(cumulative["horizon"], 1)
        self.assertEqual(cumulative["totalRows"], 4)
        self.assertEqual(cumulative["sampledRows"], 4)
        points = cumulative["points"]
        self.assertEqual(
            [item["timestamp"] for item in points],
            ["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"],
        )
        self.assertAlmostEqual(points[0]["low"], 1.01)
        self.assertAlmostEqual(points[1]["low"], 1.01 * 0.98)
        self.assertAlmostEqual(points[3]["low"], 1.01 * 0.98)
        self.assertAlmostEqual(points[3]["middle"], 1.02 * 1.01)
        self.assertAlmostEqual(points[2]["high"], 1.1 * 1.1 * 0.5)
        # Spread returns are 0.09, 0.12, -0.5, 0.2.
        self.assertAlmostEqual(points[0]["spread"], 1.09)
        self.assertAlmostEqual(points[3]["spread"], 1.09 * 1.12 * 0.5 * 1.2)
        self.assertEqual(points[2]["split"], "validation")
        self.assertEqual(points[2]["role"], "selection")

    def test_empty_quantiles_emit_empty_cumulative(self) -> None:
        cumulative = _cumulative_quantiles([])
        self.assertEqual(cumulative["totalRows"], 0)
        self.assertEqual(cumulative["sampledRows"], 0)
        self.assertEqual(cumulative["points"], [])

    def test_invalid_compounding_fails_structurally(self) -> None:
        bad = [self.row("2024-01-02", "train", -1.0, 0.0, 0.0)]
        with self.assertRaises(AutoQuantValidationError) as caught:
            _cumulative_quantiles(bad)
        self.assertEqual(
            caught.exception.issues[0].code, "factor.quantile-compound"
        )

    def test_downsampling_keeps_first_last_and_split_boundaries(self) -> None:
        rows = []
        for index in range(1500):
            split = (
                "train"
                if index < 700
                else "validation"
                if index < 1100
                else "test"
            )
            rows.append(
                self.row(f"d{index:04d}", split, 0.001, 0.001, 0.002)
            )
        cumulative = _cumulative_quantiles(rows)
        points = cumulative["points"]
        self.assertEqual(cumulative["totalRows"], 1500)
        self.assertLessEqual(len(points), MAX_CUMULATIVE_POINTS)
        self.assertEqual(cumulative["sampledRows"], len(points))
        stamps = [item["timestamp"] for item in points]
        self.assertEqual(stamps[0], "d0000")
        self.assertEqual(stamps[-1], "d1499")
        for boundary in (699, 700, 1099, 1100):
            self.assertIn(f"d{boundary:04d}", stamps)
        self.assertEqual(stamps, sorted(stamps))
        # Down-sampling thins the cumulative series, not the returns.
        self.assertAlmostEqual(points[-1]["high"], 1.002**1500)
        self.assertAlmostEqual(points[-1]["spread"], 1.001**1500)
        by_stamp = {item["timestamp"]: item for item in points}
        self.assertAlmostEqual(by_stamp["d0700"]["high"], 1.002**701)

    def test_spread_summary_matches_hand_calculation(self) -> None:
        summary = _spread_summary("cross-sectional", self.toy())
        self.assertEqual(summary["status"], "available")
        self.assertEqual(summary["horizon"], 1)
        self.assertIn("gross of costs", summary["basis"])
        self.assertIn("not annualized", summary["basis"])
        by_split = {item["split"]: item for item in summary["splits"]}
        self.assertEqual(list(by_split), ["train", "validation", "test"])
        train = by_split["train"]
        self.assertEqual(train["role"], "training")
        self.assertEqual(train["observations"], 2)
        self.assertAlmostEqual(train["meanPerBar"], 0.105)
        volatility = math.sqrt(2 * 0.015**2)
        self.assertAlmostEqual(train["volatilityPerBar"], volatility)
        self.assertAlmostEqual(train["sharpePerBar"], 0.105 / volatility)
        self.assertAlmostEqual(train["totalReturn"], 1.09 * 1.12 - 1.0)
        self.assertEqual(train["maximumDrawdown"], 0.0)
        self.assertEqual(train["hitRate"], 1.0)
        validation = by_split["validation"]
        self.assertEqual(validation["role"], "selection")
        self.assertEqual(validation["observations"], 1)
        self.assertIsNone(validation["volatilityPerBar"])
        self.assertIsNone(validation["sharpePerBar"])
        self.assertAlmostEqual(validation["totalReturn"], -0.5)
        self.assertAlmostEqual(validation["maximumDrawdown"], -0.5)
        self.assertEqual(validation["hitRate"], 0.0)

    def test_spread_summary_drawdown_uses_running_peak(self) -> None:
        returns = [0.10, -0.20, -0.10, 0.50]
        rows = [
            self.row(f"2024-02-0{index + 1}", "test", 0.0, 0.0, value)
            for index, value in enumerate(returns)
        ]
        summary = _spread_summary("cross-sectional", rows)
        test = summary["splits"][2]
        trough = 1.10 * 0.8 * 0.9
        self.assertAlmostEqual(test["maximumDrawdown"], trough / 1.10 - 1.0)
        self.assertAlmostEqual(test["hitRate"], 0.5)
        self.assertAlmostEqual(
            test["totalReturn"], 1.1 * 0.8 * 0.9 * 1.5 - 1.0
        )
        empty = summary["splits"][0]
        self.assertEqual(empty["observations"], 0)
        self.assertIsNone(empty["totalReturn"])

    def test_spread_summary_unavailable_for_temporal_modes(self) -> None:
        summary = _spread_summary("single-asset-temporal", [])
        self.assertEqual(summary["status"], "protocol-unavailable")
        self.assertEqual(summary["splits"], [])
        self.assertEqual(
            summary["reasonCode"], "temporal-tertiles-not-defined"
        )


if __name__ == "__main__":
    unittest.main()
