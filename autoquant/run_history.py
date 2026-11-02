"""Compact verified Run projections shared by Studio history and comparison."""

from __future__ import annotations

import math

from .run_compare import cost_model_id, protocol_of


def audit_visible(protocol, summary):
    """Shared two-part gate: an actual audit AND the visible-diagnostic role."""
    return bool(summary.get("testAudit")) and protocol.get("testRole") == "visible-diagnostic"


def test_audit_visible(metrics):
    integrity = metrics.get("research_integrity") or {}
    audit = metrics.get("test") or (metrics.get("portfolio") or {}).get("test")
    if not audit:
        audit = ((metrics.get("rl") or {}).get("aggregate") or {}).get("test_net_sharpe")
    return audit_visible({"testRole": integrity.get("test_role")}, {"testAudit": audit})


def finite(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def validation_headlines(metrics):
    net = ((metrics.get("portfolio") or {}).get("validation") or {}).get("net") or {}
    fields = {"netTotalReturn": "total_return", "netAnnualReturn": "annual_return",
              "maxDrawdown": "maximum_drawdown", "annualVolatility": "annual_volatility"}
    return {key: finite(net.get(field)) for key, field in fields.items()}


def history_row(run):
    result = run.result
    metric = result["objective"]["metric"]
    protocol = protocol_of(run)
    # An arbitrary custom objective is not assumed to be validation evidence.
    value = finite(result["metrics"].get(metric)) if metric.startswith("validation_") else None
    return {
        "id": result["id"], "project": result["project"],
        "studyId": result["study"]["id"], "subject": result["subject"]["name"],
        "objectKind": protocol["objectKind"], "lane": protocol["lane"],
        "verdict": result["status"], "status": result["status"],
        "primaryMetric": metric, "primaryValue": value,
        "validationHeadlines": validation_headlines(result["metrics"]),
        "startedAt": result["startedAt"], "durationMs": result["durationMs"],
        "sourceHash": result["subject"]["sourceHash"],
        "datasetId": protocol["datasetId"], "splitWindows": protocol["splitWindows"],
        "costModelId": cost_model_id(protocol),
        "testAuditVisible": test_audit_visible(result["metrics"]), "protocol": protocol,
    }


def history_page(snapshot, offset=0, limit=200):
    if offset < 0 or not 1 <= limit <= 200:
        raise ValueError("offset must be nonnegative and limit must be between 1 and 200")
    rows = []
    for project in snapshot["projects"]:
        verdicts = {e["runId"]: e["verdict"] for s in project["sessions"] for e in s["experiments"]}
        for run in project["runs"]:
            row = dict(run["history"])
            row["verdict"] = verdicts.get(row["id"], row["verdict"])
            rows.append(row)
    rows.sort(key=lambda r: (r["startedAt"], r["project"]["id"], r["id"]), reverse=True)
    return {"kind": "autoquant-run-history", "rows": rows[offset:offset + limit],
            "total": len(rows), "offset": offset, "limit": limit,
            "diagnostics": snapshot["diagnostics"] + [d for p in snapshot["projects"] for d in p["diagnostics"]]}
