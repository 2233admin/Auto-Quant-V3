"""Judge-owned Factor tear-sheet diagnostics, independent of selection.

Formula references: JoinQuant/jqfactor_analyzer (MIT), performance.py;
Alphalens / alphalens-reloaded (Apache-2.0), performance.py. This is an
independent implementation, not copied source. See THIRD_PARTY_NOTICES.md.
Core deliberately retains split purging, stable ordinal bins, raw (not
demeaned/annualized) outcomes and per-bar diagnostic compounding.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

from .project_templates.ohlcv_factor_lab.factor_diagnostics import factor_outcome_panels, purged_split_masks

ARTIFACT_KIND = "factor-tear-sheet"
MIN_GROUP_MEMBERS = 1
MIN_SAMPLE_BARS = 20
SPLITS = ("train", "validation", "test")


def quantile_count(study):
    """Absent fields preserve the original Study bytes and mean three groups."""
    value = study["judge"].get("quantiles", 3)
    if type(value) is not int or value not in (3, 5, 10):
        raise ValueError("Factor quantiles must be 3, 5 or 10")
    return value


def published_cost_model(study, root):
    """Only explicitly locked mandate/request costs apply; never use defaults."""
    relative = "strategies/portfolio-mandate.json"
    paths = study.get("dependencies", {}).get("paths", [])
    if relative in paths:
        policy = json.loads((Path(root) / relative).read_text(encoding="utf-8"))["implementationPolicy"]
    else:
        relative = (study.get("research_request") or {}).get("path")
        if relative not in paths:
            return None
        request = json.loads((Path(root) / relative).read_text(encoding="utf-8"))
        supplied = request.get("portfolioPolicy")
        if not isinstance(supplied, dict) or "baseCostBps" not in supplied:
            return None
        # The existing request-bound baseCostBps contract is linear notional.
        policy = {"costModel": "linear-traded-notional-v1", "baseCostBps": supplied["baseCostBps"]}
    bps = policy["baseCostBps"]
    if (policy["costModel"] != "linear-traded-notional-v1" or
            type(bps) not in (int, float) or not math.isfinite(bps) or bps < 0):
        raise ValueError("Unsupported locked Factor cost model")
    return {"model": policy["costModel"], "baseCostBps": bps, "source": relative}


def rank_correlation(left, right):
    """Per-bar Spearman on finite paired names, average ties, minimum four."""
    paired = left.notna() & right.notna()
    a, b = left.where(paired), right.where(paired)
    values = a.rank(axis=1).corrwith(b.rank(axis=1), axis=1)
    return values.where(paired.sum(axis=1) >= 4).replace([np.inf, -np.inf], np.nan)


def statistic(values):
    clean = pd.Series(values, dtype=float).dropna()
    n = len(clean)
    return {"value": float(clean.mean()) if n else None, "observations": n,
            "shortSample": n < MIN_SAMPLE_BARS}


def group_path(factors, outcomes, count, cost_model=None):
    """Equal-name groups; turnover counts entrants/current members, not trades.

    Stable factor order retains asset-column order for ties (legacy convention).
    A sparse bar is refused as a whole; the next turnover has no predecessor.
    Long/short targets are +1/-1 funded units, two units gross. Linear cost is
    sum(abs(target-current_target))*bps/10000, including opening from cash.
    This is a target-change diagnostic without drift, fills, borrow or exits.
    """
    rows, previous, growth = [], None, np.ones(count + 2)
    refused = 0
    for timestamp in factors.index:
        pair = pd.DataFrame({"factor": factors.loc[timestamp], "outcome": outcomes.loc[timestamp]}).dropna()
        if len(pair) < count * MIN_GROUP_MEMBERS or pair.factor.nunique() < count:
            refused += 1
            previous = None
            continue
        ordered = pair.sort_values("factor", kind="mergesort")
        groups = [ordered.iloc[g] for g in np.array_split(np.arange(len(pair)), count)]
        names = [set(g.index) for g in groups]
        means = [float(g.outcome.mean()) for g in groups]
        turnover = [len(now - before) / len(now) for now, before in zip(names, previous)] if previous else [None] * count
        weights = {a: (1 / len(names[-1]) if a in names[-1] else -1 / len(names[0])) for a in names[0] | names[-1]}
        old = ({a: (1 / len(previous[-1]) if a in previous[-1] else -1 / len(previous[0]))
                for a in previous[0] | previous[-1]} if previous else {})
        traded = sum(abs(weights.get(a, 0) - old.get(a, 0)) for a in weights.keys() | old.keys())
        gross = means[-1] - means[0]
        net = gross - traded * cost_model["baseCostBps"] / 10000 if cost_model is not None else None
        steps = means + [gross, net if net is not None else 0]
        # Insolvent diagnostic paths are unavailable, never clipped to zero.
        growth = np.where((growth > 0) & (np.asarray(steps) > -1), growth * (1 + np.asarray(steps)), np.nan)
        finite = lambda v: float(v) if math.isfinite(v) else None
        rows.append({"timestamp": timestamp.isoformat(), "groupReturns": means,
                     "groupSizes": [len(g) for g in groups], "turnover": turnover,
                     "gross": gross, "net": net, "tradedNotional": traded,
                     "groupCumulative": [finite(v) for v in growth[:count]],
                     "grossCumulative": finite(growth[-2]),
                     "netCumulative": finite(growth[-1]) if net is not None else None})
        previous = names
    return rows, refused


def summarize_path(rows, count):
    return {"observations": len(rows), "shortSample": len(rows) < MIN_SAMPLE_BARS,
            "quantileMeans": [statistic([r["groupReturns"][q] for r in rows]) for q in range(count)],
            "meanTurnover": [statistic([r["turnover"][q] for r in rows]) for q in range(count)],
            "longShortGross": statistic([r["gross"] for r in rows]),
            "longShortNet": statistic([r["net"] for r in rows])}


def compute_tearsheet(study, factors, closes, horizon, outcome, evaluation_mode, cost_model=None):
    count = quantile_count(study)
    maximum = max(horizon["diagnosticForwardBars"])
    primary = horizon["primaryForwardBars"]
    base = {"schemaVersion": 1, "quantiles": count, "primaryHorizon": primary,
            "maximumLag": maximum, "minimumGroupMembers": MIN_GROUP_MEMBERS,
            "minimumSampleBars": MIN_SAMPLE_BARS, "outcome": outcome,
            "authority": "diagnostic-only", "costModel": cost_model, "splits": {}}
    if evaluation_mode != "cross-sectional":
        return {**base, "status": "protocol-unavailable", "reason": "cross-sectional-population-required"}
    if len(factors.columns) < count * MIN_GROUP_MEMBERS:
        raise ValueError(f"{count} quantiles require at least {count * MIN_GROUP_MEMBERS} prediction assets")
    horizons = tuple(range(1, maximum + 1))
    outcomes = factor_outcome_panels(closes, outcome, horizons)
    masks, _, labels = purged_split_masks(pd.DatetimeIndex(factors.index), horizons)
    ic = {h: rank_correlation(factors, outcomes[h]) for h in horizons}
    # Rank once on each full bar, then correlate ranks on common names. This
    # follows Alphalens rank autocorrelation even for a changing universe.
    ranks = factors.rank(axis=1, method="average")
    for split in SPLITS:
        selected = masks[primary][split]
        path, refused = group_path(factors.loc[selected], outcomes[primary].loc[selected], count,
                                   cost_model if outcome == "forward-return" else None)
        split_ranks = ranks.loc[labels == split]
        autocorrelation = []
        for lag in horizons:
            previous = split_ranks.shift(lag)
            common = split_ranks.notna() & previous.notna()
            values = split_ranks.corrwith(previous, axis=1).where(common.sum(axis=1) >= 4)
            autocorrelation.append({"lag": lag, **statistic(values)})
        base["splits"][split] = {**summarize_path(path, count), "refusedBars": refused,
                                 "path": path,
                                 "icDecay": [{"horizon": h, **statistic(ic[h].loc[masks[h][split]])} for h in horizons],
                                 "autocorrelation": autocorrelation}
    return {**base, "status": "available", "reason": None}


def summary_of(evidence):
    """Keep full paths only in the artifact, summaries reconciled in Run metrics."""
    return {**evidence, "splits": {s: {k: v for k, v in data.items() if k != "path"}
                                    for s, data in evidence["splits"].items()}}


def publish_tearsheet(study, factors, closes, horizon, outcome, mode, input_hash, root, artifacts):
    evidence = compute_tearsheet(study, factors, closes, horizon, outcome, mode, published_cost_model(study, root))
    payload = {"schemaVersion": 1, "inputHash": input_hash, "evidence": evidence}
    (Path(artifacts) / "factor-tear-sheet.json").write_text(json.dumps(payload, allow_nan=False) + "\n", encoding="utf-8")
    return summary_of(evidence)
