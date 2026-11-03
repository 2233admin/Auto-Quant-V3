from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

from autoquant.factor_redundancy import (
    _pairs, comparable, load_factor_redundancy, pair_diagnostics, validation_pairs,
)
from autoquant.market_data_identity import market_data_identity
from autoquant.run_compare import compare_runs
from autoquant.runs import RunContext
from autoquant.studies import hash_file, hash_json
from autoquant.runs import execute_study, load_run
from autoquant.factor_explorer import load_factor_diagnostics
from autoquant.workspace import create_project, initialize_workspace
from tests.test_run_compare import example_run


def frame(values, outcome=None):
    values = np.asarray(values, dtype=float)
    index = pd.MultiIndex.from_product(
        [[f"2026-02-{i + 1:02d}" for i in range(len(values))],
         [f"A{i}" for i in range(values.shape[1])]], names=["timestamp", "asset"])
    return pd.DataFrame({"factor": values.ravel(),
                         "outcome": (values if outcome is None else outcome).ravel()}, index=index)


def run_at(root, values, *, run_id="run-target", source="source", completed="2026-03-01"):
    result = deepcopy(example_run().result)
    result.update(id=run_id, completedAt=completed)
    result["subject"]["sourceHash"] = source
    result["metrics"]["prediction_universe"] = {
        "prediction_assets": ["A0", "A1", "A2", "A3"],
        "evaluation_mode": "cross-sectional", "relative_value_pair": None}
    result["metrics"]["factor_outcome"] = {"kind": "forward-return"}
    result["metrics"]["split_protocol"]["horizons"] = {
        "1": {"validation": {"signalStart": "2026-02-01", "signalEnd": "2026-02-19"}}}
    result["artifacts"] = [{"kind": "factor-validation-pairs", "path": "pairs.json"}]
    rows = [{"timestamp": t, "asset": a, "factor": r.factor, "outcome": r.outcome}
            for (t, a), r in values.iterrows()]
    root.mkdir(parents=True, exist_ok=True)
    (root / "pairs.json").write_text(json.dumps({"schemaVersion": 1, "split": "validation",
                                                "horizon": 1, "rows": rows}), encoding="utf-8")
    return RunContext(root, {"files": {"pairs.json": "verified-by-load-run"}}, result)


SNAPSHOT = {
    "schemaVersion": 1, "kind": "autoquant-ohlcv-dataset-snapshot", "id": "shared-daily",
    "version": "v1", "assetClass": "equity", "frequency": "1d",
    "market": {"calendar": "XNYS", "clock": "session", "timezone": "America/New_York"},
    "priceAdjustment": "provider-adjusted", "packageManifestHash": "package",
    "provider": {"name": "fixture", "retrievedAt": None, "sourceUri": None, "terms": "test"},
    "requestHash": "request-a", "requestedAssets": ["A0", "A1", "A2", "A3"],
    "universe": ["A0", "A1", "A2", "A3"], "timeRange": {"start": "2026-01-01", "end": "2026-02-28"},
    "template": "ohlcv-factor-lab", "studyId": "s",
    "assets": [{"symbol": f"A{i}", "normalizedPath": f"ohlcv/A{i}.csv"} for i in range(4)],
}


def with_market_data(root, run, snapshot, csv="timestamp,close\n2026-01-01,1\n"):
    """Lay out a Project data root and bind the Run dataset to its exact bytes."""
    data = root / "data" / "ohlcv"
    data.mkdir(parents=True, exist_ok=True)
    (data / "snapshot.json").write_text(json.dumps(snapshot), encoding="utf-8")
    (data / "A0.csv").write_text(csv, encoding="utf-8")
    hashes = {f"ohlcv/{p.name}": hash_file(p) for p in sorted(data.iterdir())}
    definition = {"id": "shared-daily", "version": "v1", "paths": ["ohlcv/**"]}
    run.result["dataset"] = {**definition, "hash": hash_json({"definition": definition, "sourceHashes": hashes}),
                             "sourceHashes": hashes}
    return SimpleNamespace(root_dir=root, manifest=SimpleNamespace(
        id=root.name, name=root.name, directories={"data": "data"}))


class FactorRedundancyTests(unittest.TestCase):
    def test_real_published_run_artifacts_and_workspace_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = initialize_workspace(Path(directory) / "desk")
            target = create_project(workspace.root_dir, "target", template="ohlcv-factor-lab")
            peer = create_project(workspace.root_dir, "peer", template="ohlcv-factor-lab")
            source = peer.root_dir / "factors/candidate.py"
            source.write_text(source.read_text(encoding="utf-8") +
                              "\n_original_factor = compute_factor\n\n"
                              "def compute_factor(panel):\n    return -_original_factor(panel)\n", encoding="utf-8")
            first = execute_study(target, "ohlcv-factor-quality")
            second = execute_study(peer, "ohlcv-factor-quality")
            self.assertEqual(first.result["status"], "succeeded")
            self.assertEqual(second.result["status"], "succeeded")
            diagnostics = load_factor_diagnostics(target, first.result["id"])
            overlap = diagnostics["redundancy"]
            self.assertEqual(overlap["status"], "available", overlap)
            self.assertEqual(len(overlap["peers"]), 1)
            self.assertAlmostEqual(overlap["peers"][0]["correlation"], -1)
            self.assertEqual(overlap["peers"][0]["residualRankIc"], 0)
            pairs_path = first.root_dir / "artifacts/factor-validation-pairs.json"
            payload = json.loads(pairs_path.read_text())
            self.assertEqual({r["asset"] for r in payload["rows"]}, set(first.result["dataset"]["universe"]))
            self.assertEqual(payload["split"], "validation")
            self.assertNotIn("test", json.dumps(payload))
            # Run verification must reject tampering before the projection opens pairs.
            pairs_path.write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                load_run(target, first.result["id"])

    def test_identical_and_negative_factor_have_no_residual_signal(self):
        target = frame([[1, 2, 3, 4], [4, 3, 2, 1]])
        for sign in (1, -1):
            peer = target.copy()
            peer["factor"] *= sign
            result = pair_diagnostics(target, peer, "cross-sectional")
            self.assertAlmostEqual(result["correlation"], sign)
            self.assertEqual(result["residualRankIc"], 0)
            self.assertEqual(result["observations"], 2)
            self.assertEqual(result["pairedAssetObservations"], 8)

    def test_independent_factor_retains_predictive_information(self):
        target = frame([[1, 2, 3, 4]])
        peer = frame([[2, 4, 1, 3]], np.array([[1, 2, 3, 4]]))
        result = pair_diagnostics(target, peer, "cross-sectional")
        self.assertAlmostEqual(result["correlation"], 0)
        self.assertAlmostEqual(result["residualRankIc"], 1)

    def test_partial_overlap(self):
        target = frame([[1, 2, 3, 4, 5, 6]])
        peer = frame([[1, 3, 2, 4, 6, 5]], np.array([[1, 2, 3, 4, 5, 6]]))
        result = pair_diagnostics(target, peer, "cross-sectional")
        self.assertAlmostEqual(result["correlation"], 31 / 35)
        self.assertGreater(result["residualRankIc"], 0)
        self.assertLess(result["residualRankIc"], 1)

    def test_temporal_uses_time_series_ranks_without_cross_sectional_residual(self):
        target = frame([[1], [2], [3], [4]])
        peer = target.copy()
        peer["factor"] *= -1
        result = pair_diagnostics(target, peer, "single-asset-temporal")
        self.assertAlmostEqual(result["correlation"], -1)
        self.assertIsNone(result["residualRankIc"])
        self.assertEqual(result["observations"], 4)
        self.assertEqual(result["residualReason"], "cross-sectional-residualization-not-applicable")

    def test_sparse_and_constant_correlations_remain_null(self):
        for values in ([[1, 2, 3]], [[1, 1, 1, 1]]):
            with self.subTest(values=values):
                result = pair_diagnostics(frame(values), frame(values), "cross-sectional")
                self.assertIsNone(result["correlation"])
                self.assertEqual(result["observations"], 0)

    def test_outcome_mismatch_fails_closed(self):
        a, b = frame([[1, 2, 3, 4]]), frame([[4, 3, 2, 1]])
        with self.assertRaisesRegex(ValueError, "outcome-mismatch"):
            pair_diagnostics(a, b, "cross-sectional")

    def test_publication_contains_only_purged_validation_rows(self):
        values = pd.DataFrame([[1, 2], [3, 4], [999999, 999999]],
                              index=pd.date_range("2026-02-01", periods=3), columns=["A", "B"])
        mask = pd.Series([False, True, False], index=values.index)
        payload = validation_pairs(values, values, mask, 1)
        self.assertEqual(payload["split"], "validation")
        self.assertEqual(len(payload["rows"]), 2)
        self.assertNotIn("999999", json.dumps(payload))

    def test_no_peers_and_legacy_unavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            run = run_at(Path(directory), frame([[1, 2, 3, 4]]))
            owner = SimpleNamespace(root_dir=Path(directory), manifest=SimpleNamespace(id="p", name="P"))
            self.assertEqual(load_factor_redundancy(owner, run, peer_projects=[])["status"], "no-comparable-peers")
            run.result["artifacts"] = []
            result = load_factor_redundancy(owner, run, peer_projects=[])
            self.assertEqual(result["status"], "unavailable")
            self.assertEqual(result["reason"], "missing-validation-pairs")

    def test_latest_success_per_source_sorted_and_no_hidden_test_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = run_at(root / "target", frame([[1, 2, 3, 4]]))
            negative = frame([[-1, -2, -3, -4]], np.array([[1, 2, 3, 4]]))
            runs = [run_at(root / str(i), negative, run_id=f"run-{i}", source="peer",
                           completed=f"2026-03-0{i + 1}") for i in range(2)]
            owner = SimpleNamespace(root_dir=root / "project", manifest=SimpleNamespace(id="peer", name="Peer"))
            summaries = [SimpleNamespace(id=r.result["id"], status="succeeded", primary_metric="validation_mean_ic") for r in runs]
            with patch("autoquant.factor_redundancy.list_runs", return_value=summaries), patch(
                "autoquant.factor_redundancy.load_run", side_effect=lambda _, rid: next(r for r in runs if r.result["id"] == rid)):
                result = load_factor_redundancy(SimpleNamespace(root_dir=root, manifest=SimpleNamespace(id="target")), target, peer_projects=[owner])
            self.assertEqual(result["status"], "available")
            self.assertEqual([p["runId"] for p in result["peers"]], ["run-1"])
            self.assertNotIn("987654", json.dumps(result))
            self.assertEqual(result["peers"][0]["correlation"], -1)

    def test_exact_basis_requires_dataset_population_horizon_outcome_and_purge(self):
        with tempfile.TemporaryDirectory() as directory:
            a = run_at(Path(directory), frame([[1, 2, 3, 4]]))
            self.assertTrue(comparable(a, deepcopy(a)))
            for section, key in (("dataset", "hash"), ("dataset", "id"), ("judge", "hash"),
                                 ("metrics", "prediction_universe"), ("metrics", "research_horizon"),
                                 ("metrics", "factor_outcome"), ("metrics", "split_protocol")):
                b = deepcopy(a)
                b.result[section][key] = {} if section == "metrics" else "other"
                self.assertFalse(comparable(a, b), (section, key))
            a.result["metrics"]["prediction_universe"] = {}
            self.assertFalse(comparable(a, deepcopy(a)))

    def test_test_split_artifact_rejected_before_values_are_parsed(self):
        with tempfile.TemporaryDirectory() as directory:
            run = run_at(Path(directory), frame([[1, 2, 3, 4]]))
            path = run.root_dir / "pairs.json"
            path.write_text(json.dumps({"schemaVersion": 1, "split": "test", "horizon": 1,
                                        "rows": [{"factor": "secret-test-value"}]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "split-or-version"):
                _pairs(run)

    def test_outside_validation_and_duplicate_rows_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            run = run_at(Path(directory), frame([[1, 2, 3, 4]]))
            path = run.root_dir / "pairs.json"
            payload = json.loads(path.read_text())
            payload["rows"][0]["timestamp"] = "2026-03-01"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "population"):
                _pairs(run)


    def test_same_market_data_under_different_requests_are_peers_but_not_run_comparable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = run_at(root / "target-run", frame([[1, 2, 3, 4]]))
            peer = run_at(root / "peer-run", frame([[-1, -2, -3, -4]], np.array([[1, 2, 3, 4]])),
                          run_id="run-peer", source="peer")
            target_project = with_market_data(root / "momentum", target, SNAPSHOT)
            other = {**SNAPSHOT, "requestHash": "request-b", "requestedAssets": ["A3", "A2", "A1", "A0"]}
            peer_project = with_market_data(root / "reversal", peer, other)
            self.assertNotEqual(target.result["dataset"]["hash"], peer.result["dataset"]["hash"])
            identities = (market_data_identity(target_project, target), market_data_identity(peer_project, peer))
            self.assertIsNotNone(identities[0])
            self.assertEqual(*identities)
            self.assertFalse(comparable(target, peer))
            self.assertTrue(comparable(target, peer, identities))
            # The Run compare page keeps the request-bound dataset hash authority.
            decision = compare_runs(target, peer)
            self.assertEqual(decision["status"], "not-comparable")
            self.assertIn("datasetHash", [d["field"] for d in decision["differences"]])
            summary = [SimpleNamespace(id="run-peer", status="succeeded", primary_metric="validation_mean_ic")]
            with patch("autoquant.factor_redundancy.list_runs", return_value=summary), patch(
                    "autoquant.factor_redundancy.load_run", return_value=peer):
                result = load_factor_redundancy(target_project, target, peer_projects=[peer_project])
            self.assertEqual(result["status"], "available", result)
            self.assertEqual(result["peers"][0]["projectId"], "reversal")
            self.assertAlmostEqual(result["peers"][0]["correlation"], -1)
            self.assertEqual(result["peers"][0]["residualRankIc"], 0)

    def test_market_semantics_and_unverifiable_snapshots_are_not_peers(self):
        variants = {
            "adjustment": ({**SNAPSHOT, "priceAdjustment": "raw"}, None),
            "calendar": ({**SNAPSHOT, "market": {**SNAPSHOT["market"], "calendar": "XLON"}}, None),
            "assets": ({**SNAPSHOT, "universe": ["A0", "A1", "A2", "A4"]}, None),
            "time-range": ({**SNAPSHOT, "timeRange": {"start": "2026-01-02", "end": "2026-02-28"}}, None),
            "bytes": ({**SNAPSHOT, "requestHash": "request-b"}, "timestamp,close\n2026-01-01,2\n"),
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = run_at(root / "target-run", frame([[1, 2, 3, 4]]))
            market = market_data_identity(with_market_data(root / "target", target, SNAPSHOT), target)
            for name, (snapshot, csv) in variants.items():
                with self.subTest(name=name):
                    peer = run_at(root / f"{name}-run", frame([[1, 2, 3, 4]]), run_id=name, source=name)
                    owner = with_market_data(root / name, peer, {**snapshot, "requestHash": "request-b"},
                                             **({"csv": csv} if csv else {}))
                    peer_market = market_data_identity(owner, peer)
                    self.assertNotEqual(market, peer_market)
                    self.assertFalse(comparable(target, peer, (market, peer_market)))
            # Changed snapshot bytes no longer match the Run's content lock.
            peer = run_at(root / "tampered-run", frame([[1, 2, 3, 4]]), run_id="tampered", source="t")
            owner = with_market_data(root / "tampered", peer, {**SNAPSHOT, "requestHash": "request-b"})
            (root / "tampered/data/ohlcv/snapshot.json").write_text(json.dumps(SNAPSHOT), encoding="utf-8")
            self.assertIsNone(market_data_identity(owner, peer))


if __name__ == "__main__":
    unittest.main()
