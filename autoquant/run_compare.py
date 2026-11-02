"""Read-only identity checks for immutable Run measurements.

Callers must obtain RunContexts through load_run. Candidate source identity is
deliberately not a comparability requirement: it is the intervention measured.
"""

from __future__ import annotations

from .runs import RunContext
from .studies import hash_json


FIELDS = ("objectKind", "lane", "study", "datasetId", "datasetHash",
          "splitWindows", "horizon", "costModel", "objective")
REQUIRED = set(FIELDS) - {"costModel"}
LANES = {
    "validation_mean_ic": ("factor", "Factor"),
    "validation_net_sharpe": ("strategy", "Portfolio"),
    "validation_mean_net_sharpe": ("strategy", "RL policy"),
    "book_risk_audit": ("analysis", "Book Risk"),
    "current_component_risk_hhi": ("analysis", "Book Risk"),
    "primary_eligible_event_count": ("analysis", "Event Study"),
    "worst_terminal_book_return": ("analysis", "Path Stress"),
    "validation_net_sharpe_advantage": ("analysis", "Allocation"),
}


def run_lane(result):
    metric = result["objective"]["metric"]
    if metric in LANES:
        return LANES[metric]
    # Analysis and custom lanes keep their exact objective, avoiding accidental
    # pooling of unrelated research/model Studies under a generic lane.
    kind = result["subject"]["kind"]
    return (kind if kind in {"factor", "strategy"} else "analysis", metric)


def protocol_of(run: RunContext):
    result = run.result
    metrics = result["metrics"]
    dataset = result["dataset"]
    kind, lane = run_lane(result)
    study = result["study"]
    implementation = (metrics.get("portfolio_mandate") or {}).get("implementationPolicy")
    cost = implementation if implementation is not None else metrics.get("cost_model")
    if cost is None and lane == "RL policy":
        cost = (metrics.get("configuration") or {}).get("costBps")
    # A strategy without a cost contract cannot establish a common baseline.
    if cost is None and kind == "strategy":
        cost = {"unknown": True}
    splits = (metrics.get("split_protocol") or {}).get("splits")
    if splits:
        splits = {name: {key: window.get(key) for key in ("start", "end")}
                  for name, window in splits.items()}
    return {
        "objectKind": kind, "lane": lane,
        "study": {"id": study["id"], "hash": study["hash"],
                  "judgeHash": result["judge"]["hash"],
                  "programHash": study["programHash"],
                  "dependenciesHash": (result.get("dependencies") or {}).get("hash")},
        "datasetId": dataset["id"], "datasetHash": dataset["hash"],
        "splitWindows": splits,
        "horizon": metrics.get("research_horizon"),
        "costModel": cost, "objective": result["objective"],
    }


def _missing_authority(field, value):
    if field not in REQUIRED:
        return False
    if not value:
        return True
    if field == "splitWindows":
        return not isinstance(value, dict) or any(
            not (value.get(split) or {}).get(key)
            for split in ("train", "validation", "test") for key in ("start", "end"))
    if field == "horizon":
        return not isinstance(value, dict) or not value.get("primaryForwardBars")
    return False


def compare_protocols(a, b):
    """Exact field reasons; absent authority never proves equivalence."""
    differences = []
    for field in FIELDS:
        left, right = a.get(field), b.get(field)
        missing = _missing_authority(field, left) or _missing_authority(field, right)
        unknown_cost = field == "costModel" and {"unknown": True} in (left, right)
        if missing or unknown_cost or left != right:
            differences.append({"field": field, "reason": "missing" if missing or unknown_cost else "different",
                                "a": left, "b": right})
    return {"status": "not-comparable" if differences else "comparable", "differences": differences}


def compare_runs(a: RunContext, b: RunContext):
    return compare_protocols(protocol_of(a), protocol_of(b))


def cost_model_id(protocol):
    cost = protocol["costModel"]
    return "sha256:" + hash_json(cost) if cost is not None else None
