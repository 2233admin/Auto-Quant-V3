"""Confined, versioned projection of Judge-published Factor tear sheets.

The caller must first load/verify the immutable Run. No market data, candidate
execution, regrouping, or new numerical research is performed here.
"""
from __future__ import annotations

import json
import math

import pandas as pd

from .factor_tearsheet import ARTIFACT_KIND, SPLITS, published_cost_model, summary_of, summarize_path
from .workspace import AutoQuantValidationError, ValidationIssue, confined_path

MAX_BYTES = 32 * 1024 * 1024
MAX_ROWS = 100_000


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _finite(value, *, nullable=False):
    _require(value is None and nullable or type(value) in (int, float) and math.isfinite(value), "Nonfinite tear-sheet number")


def _stat(value):
    _require(set(value) >= {"value", "observations", "shortSample"}, "Invalid statistic")
    _finite(value["value"], nullable=True)
    n = value["observations"]
    _require(type(n) is int and 0 <= n <= MAX_ROWS, "Invalid observation count")
    _require(value["shortSample"] == (n < 20), "Incorrect short-sample flag")
    _require((value["value"] is None) == (n == 0), "Missing-value/count mismatch")


def _validate_path(rows, count, window, cost, is_return):
    _require(isinstance(rows, list) and len(rows) <= MAX_ROWS, "Too many tear-sheet rows")
    previous, growth = None, [1.0] * (count + 2)
    for row in rows:
        timestamp = pd.Timestamp(row["timestamp"])
        _require(pd.Timestamp(window["signalStart"]) <= timestamp <= pd.Timestamp(window["signalEnd"]), "Path outside purged split")
        _require(previous is None or timestamp > previous, "Duplicate or unordered path")
        previous = timestamp
        for key in ("groupReturns", "groupSizes", "turnover", "groupCumulative"):
            _require(isinstance(row[key], list) and len(row[key]) == count, "Incomplete quantile groups")
        for n in row["groupSizes"]:
            _require(type(n) is int and n >= 1, "Insufficient group population")
        for value in row["groupReturns"]:
            _finite(value)
        for value in row["turnover"]:
            _require(value is None or type(value) in (int, float) and 0 <= value <= 1, "Invalid turnover")
        for key in ("gross", "tradedNotional"):
            _finite(row[key])
        _require(0 <= row["tradedNotional"] <= 4 + 1e-9, "Invalid traded notional")
        gross = row["groupReturns"][-1] - row["groupReturns"][0]
        _require(math.isclose(row["gross"], gross, abs_tol=1e-12), "Gross spread mismatch")
        expected_net = gross - row["tradedNotional"] * cost["baseCostBps"] / 10000 if cost and is_return else None
        _require(row["net"] == expected_net, "Net spread/cost mismatch")
        steps = row["groupReturns"] + [gross, expected_net if expected_net is not None else 0]
        expected = row["groupCumulative"] + [row["grossCumulative"], row["netCumulative"]]
        for i, step in enumerate(steps):
            growth[i] = growth[i] * (1 + step) if growth[i] is not None and step > -1 else None
            actual = expected[i]
            target = None if i == count + 1 and expected_net is None else growth[i]
            _finite(actual, nullable=True)
            _require(actual == target, "Cumulative path mismatch")


def _validate(evidence, metrics, study):
    count = study["judge"].get("quantiles", 3)
    mandate = metrics["research_horizon"]
    maximum, primary = max(mandate["diagnosticForwardBars"]), mandate["primaryForwardBars"]
    _require(evidence["schemaVersion"] == 1 and type(evidence["quantiles"]) is int and evidence["quantiles"] == count, "Quantiles/version differ from frozen Study")
    _require(count in (3, 5, 10) and evidence["maximumLag"] == maximum and evidence["primaryHorizon"] == primary, "Horizon mismatch")
    _require(evidence["minimumGroupMembers"] == 1 and evidence["minimumSampleBars"] == 20 and evidence["authority"] == "diagnostic-only", "Protocol mismatch")
    _require(evidence["outcome"] == metrics["factor_outcome"]["kind"], "Outcome mismatch")
    if evidence["status"] == "protocol-unavailable":
        _require(not evidence["splits"] and evidence["reason"] == "cross-sectional-population-required" and metrics["prediction_universe"]["evaluation_mode"] != "cross-sectional", "Invalid unavailable declaration")
        return
    _require(evidence["status"] == "available" and set(evidence["splits"]) == set(SPLITS) and evidence["reason"] is None, "Incomplete split evidence")
    cost = evidence["costModel"]
    if cost is not None:
        _require(cost["model"] == "linear-traded-notional-v1", "Unsupported cost model")
        _finite(cost["baseCostBps"])
        _require(cost["baseCostBps"] >= 0 and cost["source"] in study.get("dependencies", {}).get("paths", []), "Unbound cost model")
    for split, data in evidence["splits"].items():
        window = metrics["split_protocol"]["horizons"][str(primary)][split]
        _validate_path(data["path"], count, window, cost, evidence["outcome"] == "forward-return")
        population = len(metrics["prediction_universe"]["prediction_assets"])
        for row in data["path"]:
            sizes = row["groupSizes"]
            _require(sum(sizes) <= population and max(sizes) - min(sizes) <= 1, "Invalid group breadth")
        summary = summarize_path(data["path"], count)
        _require(all(data[k] == v for k, v in summary.items()), "Path summary does not reconcile")
        _require(type(data["refusedBars"]) is int and data["refusedBars"] >= 0, "Invalid refused count")
        split_rows = metrics["split_protocol"]["splits"][split]["rows"]
        _require(data["refusedBars"] + len(data["path"]) == split_rows - primary, "Refused/eligible count mismatch")
        for name, field in (("icDecay", "horizon"), ("autocorrelation", "lag")):
            values = data[name]
            _require([v[field] for v in values] == list(range(1, maximum + 1)), "Incomplete decay/lag axis")
            for value in values:
                _stat(value)
                _require(value["observations"] <= split_rows - value[field], "Statistic exceeds split population")
                _require(value["value"] is None or -1.000000001 <= value["value"] <= 1.000000001, "Correlation out of bounds")


def load_tearsheet(run, *, point_limit=200):
    artifacts = [a for a in run.result["artifacts"] if a["kind"] == ARTIFACT_KIND]
    summary = run.result["metrics"].get("factor_tear_sheet")
    if not artifacts and summary is None:
        return {"schemaVersion": 1, "status": "not-published", "reason": "not-published-by-this-runs-judge"}
    try:
        _require(len(artifacts) == 1 and summary is not None, "Artifact and metric must appear together exactly once")
        relative = artifacts[0]["path"]
        path = confined_path(run.root_dir, relative, ARTIFACT_KIND)
        _require(relative in run.manifest["files"] and path.stat().st_size <= MAX_BYTES, "Invalid artifact identity/size")
        payload = json.loads(path.read_text(encoding="utf-8"))
        _require(payload["schemaVersion"] == 1 and payload["inputHash"] == run.result["inputHash"], "Artifact input/version mismatch")
        evidence = payload["evidence"]
        _require(summary_of(evidence) == summary, "Artifact metrics do not reconcile")
        study = json.loads((run.root_dir / "inputs/study.json").read_text(encoding="utf-8"))
        expected_cost = published_cost_model(study, run.root_dir / "inputs/dependency-sources")
        _require(evidence["costModel"] == expected_cost, "Cost model differs from frozen dependency")
        _validate(evidence, run.result["metrics"], study)
        evidence["artifact"] = {"path": relative, "sha256": run.manifest["files"][relative]}
        # Read every row before thinning; split reset, endpoints retained.
        for data in evidence["splits"].values():
            path_rows = data["path"]
            n = len(path_rows)
            limit = max(2, point_limit)
            indices = sorted({round(i * (n - 1) / (limit - 1)) for i in range(limit)}) if n > limit else range(n)
            data["totalRows"] = n
            data["path"] = [path_rows[i] for i in indices]
        return evidence
    except (ValueError, KeyError, TypeError, OSError, AttributeError) as error:
        raise AutoQuantValidationError([ValidationIssue(str(run.root_dir), "factor.tear-sheet", str(error))]) from error
