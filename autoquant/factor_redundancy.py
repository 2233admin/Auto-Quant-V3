"""Validation-only, artifact-backed overlap between Workspace Factor Runs.

This projection never executes a candidate/Judge and never changes a verdict.
"""

from __future__ import annotations

import json
import math

import pandas as pd

from .project_templates.ohlcv_factor_lab.factor_diagnostics import cross_sectional_rank_residual
from .run_compare import compare_protocols, protocol_of
from .runs import list_runs, load_run
from .workspace import AutoQuantValidationError, confined_path, load_project, load_workspace


ARTIFACT_KIND = "factor-validation-pairs"
MAX_BYTES = 64 * 1024 * 1024
MAX_ROWS = 1_000_000


def validation_pairs(factors, outcomes, mask, horizon):
    """Serialize the Judge's already computed primary, purge-aware panels."""
    rows = []
    for timestamp in factors.index[mask.reindex(factors.index, fill_value=False)]:
        for asset in factors.columns:
            factor, outcome = factors.at[timestamp, asset], outcomes.at[timestamp, asset]
            if pd.notna(factor) and pd.notna(outcome):
                rows.append({"timestamp": timestamp.isoformat(), "asset": asset,
                             "factor": float(factor), "outcome": float(outcome)})
    return {"schemaVersion": 1, "split": "validation", "horizon": horizon, "rows": rows}


def evaluation_basis(run):
    """Use Run comparison facts, excluding caller identity from numerical basis.

    Study/request ids, source-bound dependency hashes and provenance-bearing
    horizon ids are not numerical equivalence. Judge bytes remain mandatory.
    """
    protocol = protocol_of(run)
    metrics = run.result["metrics"]
    horizon = protocol["horizon"] or {}
    protocol["horizon"] = {k: horizon.get(k) for k in
                           ("primaryForwardBars", "diagnosticForwardBars", "targetSemantics")}
    protocol["study"] = {"judgeHash": run.result["judge"]["hash"]}
    prediction = metrics.get("prediction_universe") or {}
    protocol["predictionUniverse"] = {k: prediction.get(k) for k in
                                      ("prediction_assets", "evaluation_mode", "relative_value_pair")}
    protocol["outcome"] = metrics.get("factor_outcome")
    protocol["purge"] = metrics.get("split_protocol")
    return protocol


def comparable(a, b):
    left, right = evaluation_basis(a), evaluation_basis(b)
    if not all(_complete_basis(p) for p in (left, right)):
        return False
    if compare_protocols(left, right)["status"] != "comparable":
        return False
    return all(left.get(k) and left[k] == right.get(k)
               for k in ("predictionUniverse", "outcome", "purge"))


def _complete_basis(basis):
    population = basis["predictionUniverse"]
    return (bool(basis["study"]["judgeHash"])
            and bool(population["prediction_assets"])
            and population["evaluation_mode"] in
            {"cross-sectional", "single-asset-temporal", "two-asset-relative-value"}
            and bool((basis["outcome"] or {}).get("kind")))


def _pairs(run):
    artifacts = [a for a in run.result["artifacts"] if a["kind"] == ARTIFACT_KIND]
    if not artifacts:
        raise ValueError("missing-validation-pairs")
    if len(artifacts) != 1:
        raise ValueError("duplicate-validation-pairs")
    relative = artifacts[0]["path"]
    path = confined_path(run.root_dir, relative, ARTIFACT_KIND)
    if relative not in run.manifest["files"] or path.stat().st_size > MAX_BYTES:
        raise ValueError("invalid-validation-pairs-identity-or-size")
    payload = json.loads(path.read_text(encoding="utf-8"))
    # Reject other splits before interpreting any factor or outcome value.
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1 or payload.get("split") != "validation":
        raise ValueError("invalid-validation-pairs-split-or-version")
    metrics = run.result["metrics"]
    horizon = metrics["research_horizon"]["primaryForwardBars"]
    if payload.get("horizon") != horizon:
        raise ValueError("invalid-validation-pairs-horizon")
    rows = payload.get("rows")
    if not isinstance(rows, list) or len(rows) > MAX_ROWS:
        raise ValueError("invalid-validation-pairs-rows")
    population = metrics["prediction_universe"]["prediction_assets"]
    window = metrics["split_protocol"]["horizons"][str(horizon)]["validation"]
    start, end = pd.Timestamp(window["signalStart"]), pd.Timestamp(window["signalEnd"])
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("invalid-validation-pairs-row")
        timestamp, asset = pd.Timestamp(row["timestamp"]), row["asset"]
        key = (timestamp, asset)
        if not start <= timestamp <= end or asset not in population or key in seen:
            raise ValueError("invalid-validation-pairs-population")
        seen.add(key)
        if not all(isinstance(row[k], (int, float)) and not isinstance(row[k], bool)
                   and math.isfinite(row[k]) for k in ("factor", "outcome")):
            raise ValueError("invalid-validation-pairs-number")
    frame = pd.DataFrame(rows, columns=["timestamp", "asset", "factor", "outcome"])
    return frame.set_index(["timestamp", "asset"]).sort_index()


def pair_diagnostics(target, peer, mode):
    """Common finite validation pairs; no filling, resampling or outcome synthesis."""
    joined = target.join(peer, how="inner", lsuffix="_target", rsuffix="_peer")
    if not joined.empty and not (joined.outcome_target == joined.outcome_peer).all():
        raise ValueError("peer-outcome-mismatch")
    if mode != "cross-sectional":
        if mode != "single-asset-temporal":
            raise ValueError("unsupported-evaluation-mode")
        corr = _rank_correlation(joined.factor_target, joined.factor_peer)
        return {"correlation": _finite(corr), "residualRankIc": None,
                "observations": len(joined), "pairedAssetObservations": len(joined),
                "residualObservations": 0, "residualReason": "cross-sectional-residualization-not-applicable"}
    correlations, residual_ics = [], []
    paired = 0
    for _, rows in joined.groupby(level="timestamp", sort=True):
        if len(rows) < 4:
            continue
        x, y = rows.factor_target, rows.factor_peer
        corr = _rank_correlation(x, y)
        if corr is None:
            continue
        correlations.append(corr)
        paired += len(rows)
        # Reuse the exact component centered percentile-rank OLS implementation.
        a = pd.DataFrame([x.to_numpy()], columns=rows.index.get_level_values("asset"))
        b = pd.DataFrame([y.to_numpy()], columns=a.columns)
        residual = cross_sectional_rank_residual(a, b).iloc[0]
        if residual.isna().any():
            continue
        # Exact span duplicates have no remaining signal. Suppress rounding noise
        # before ranking, matching component zero-residual diagnostic semantics.
        if residual.abs().max() <= 1e-12:
            residual_ics.append(0.0)
        else:
            outcome = pd.Series(rows.outcome_target.to_numpy(), index=residual.index)
            ic = _rank_correlation(residual, outcome)
            if ic is not None:
                residual_ics.append(ic)
    return {"correlation": _mean(correlations), "residualRankIc": _mean(residual_ics),
            "observations": len(correlations), "pairedAssetObservations": paired,
            "residualObservations": len(residual_ics), "residualReason": None}


def _finite(value):
    return float(value) if value is not None and math.isfinite(value) else None


def _rank_correlation(a, b):
    if len(a) < 2 or a.nunique() < 2 or b.nunique() < 2:
        return None
    return _finite(a.rank(method="average").corr(b.rank(method="average")))


def _mean(values):
    return sum(values) / len(values) if values else None


def _projects(project, workspace_root):
    if workspace_root is not None:
        workspace = load_workspace(workspace_root)
    else:
        root = next((p for p in project.root_dir.parents
                     if (p / "autoquant-workspace.json").is_file()), None)
        if root is None:
            return [project]
        workspace = load_workspace(root)
    # Follow effective discovery, including local overrides; never scan Session worktrees.
    if project.root_dir.parent != workspace.projects_dir:
        raise ValueError("target-outside-effective-workspace")
    return [load_project(p) for p in sorted(workspace.projects_dir.iterdir())
            if p.is_dir() and not p.is_symlink() and not p.name.startswith(".")]


def load_factor_redundancy(project, run, *, workspace_root=None, peer_projects=None):
    result = {"schemaVersion": 1, "status": "unavailable", "reason": None,
              "split": "validation", "authority": "diagnostic-only", "peers": [], "excluded": []}
    try:
        target = _pairs(run)
        mode = run.result["metrics"]["prediction_universe"]["evaluation_mode"]
        result["evaluationMode"] = mode
        projects = peer_projects if peer_projects is not None else _projects(project, workspace_root)
    except (OSError, ValueError, KeyError, TypeError, AutoQuantValidationError) as error:
        result["reason"] = str(error)
        return result
    latest = {}
    for owner in projects:
        try:
            for summary in list_runs(owner):
                if summary.status != "succeeded" or summary.primary_metric != "validation_mean_ic":
                    continue
                peer = load_run(owner, summary.id)
                if owner.root_dir == project.root_dir and peer.result["id"] == run.result["id"]:
                    continue
                if not comparable(run, peer):
                    continue
                key = (owner.manifest.id, peer.result["study"]["id"], peer.result["subject"]["sourceHash"])
                # An identical source in the target Study is the same candidate.
                if key == (project.manifest.id, run.result["study"]["id"], run.result["subject"]["sourceHash"]):
                    continue
                order = (peer.result["completedAt"], peer.result["id"])
                if key not in latest or order > latest[key][0]:
                    latest[key] = (order, owner, peer)
        except (OSError, ValueError, KeyError, AutoQuantValidationError) as error:
            result["excluded"].append({"projectId": owner.manifest.id, "reason": str(error)})
    for _, owner, peer in latest.values():
        identity = {"projectId": owner.manifest.id, "label": owner.manifest.name,
                    "studyId": peer.result["study"]["id"], "runId": peer.result["id"],
                    "sourceHash": peer.result["subject"]["sourceHash"]}
        try:
            statistics = pair_diagnostics(target, _pairs(peer), mode)
            result["peers"].append({**identity, **statistics})
        except (OSError, ValueError, KeyError, TypeError, AutoQuantValidationError) as error:
            result["excluded"].append({**identity, "reason": str(error)})
    result["peers"].sort(key=lambda p: (-(abs(p["correlation"]) if p["correlation"] is not None else -1),
                                           p["projectId"], p["studyId"], p["sourceHash"]))
    if result["peers"]:
        result["status"] = "available"
    elif latest or result["excluded"]:
        result["reason"] = "comparable-peer-evidence-unavailable"
    else:
        result["status"] = "no-comparable-peers"
    return result
