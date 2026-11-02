"""Bounded Studio read endpoints; the Core owns protocol decisions."""

from urllib.parse import parse_qs, urlsplit

from .run_compare import compare_protocols
from .run_history import audit_visible, history_page
from .workspace import AutoQuantValidationError, ValidationIssue


def _one(query, key):
    values = query.get(key, [])
    if len(values) != 1 or not values[0]:
        raise ValueError(f"Exactly one {key} is required")
    return values[0]


def _find(snapshot, project, run):
    for p in snapshot["projects"]:
        if p["id"] == project:
            for r in p["runs"]:
                if r["id"] == run:
                    return r["history"]
    raise ValueError(f"Unknown verified Run: {project}/{run}")


def comparison_payload(snapshot, query, directory, project_id):
    a = _find(snapshot, _one(query, "project"), _one(query, "a"))
    b = _find(snapshot, query.get("projectB", [a["project"]["id"]])[0], _one(query, "b"))
    decision = compare_protocols(a["protocol"], b["protocol"])
    if a["id"] == b["id"] and a["project"]["id"] == b["project"]["id"]:
        decision = {"status": "not-comparable", "differences": [{"field": "runId", "reason": "same-run", "a": a["id"], "b": b["id"]}]}
    payload = {"kind": "autoquant-run-comparison", **decision, "a": a, "b": b}
    if decision["status"] == "comparable" and a["lane"] == "Factor":
        from .studio import build_run_diagnostics
        payload["factors"] = [
            _gated_factor(build_run_diagnostics(directory, r["project"]["id"], r["id"], project_id=project_id)["factorExplorer"])
            for r in (a, b)
        ]
    return payload


def _gated_factor(explorer):
    # Reuse the actual published Explorer audit and role, exactly as testGate.
    visible = audit_visible(explorer["protocol"], explorer["summary"])
    # Allow-list the comparison fields; never send the full diagnostic tree.
    points = ((explorer.get("quantilePath") or {}).get("cumulative") or {}).get("points", [])
    return {"protocol": {"testRole": explorer["protocol"].get("testRole")},
            "summary": {"validation": explorer["summary"]["validation"],
                        "testAudit": explorer["summary"].get("testAudit") if visible else None},
            "points": [p for p in points if p.get("split") in ("train", "validation") or (visible and p.get("split") == "test")]}


def serve_history(handler, path, directory, project_id, snapshot, head_only):
    if path not in {"/api/v1/runs", "/api/v1/run-compare"}:
        return False
    try:
        query = parse_qs(urlsplit(handler.path).query)
        if path == "/api/v1/runs":
            payload = history_page(snapshot(), int(query.get("offset", ["0"])[0]), int(query.get("limit", ["200"])[0]))
        else:
            payload = comparison_payload(snapshot(), query, directory, project_id)
        handler._json(200, payload, head_only=head_only)
    except (ValueError, IndexError) as error:
        raise AutoQuantValidationError([ValidationIssue(path, "run-history.query", str(error))]) from error
    return True
