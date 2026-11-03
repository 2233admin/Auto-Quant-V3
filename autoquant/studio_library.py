"""Small, Run-bound library projections; no browser diagnostic fan-out."""

from __future__ import annotations

import ast
import json
import math
import re
from pathlib import Path

from .runs import load_run
from .run_history import audit_visible
from .selection import build_research_family, build_selection_adjustment
from .studio_actions import _is_link, confine_workspace_path
from .workspace import AutoQuantValidationError


def _read(project, relative):
    try:
        path = confine_workspace_path(project.root_dir, relative, "library source")
        if any(_is_link(p) for p in [path, *path.parents] if p != project.root_dir.parent):
            return ""
        return path.read_text(encoding="utf-8") if path.is_file() and path.stat().st_size <= 512_000 else ""
    except (OSError, ValueError, AutoQuantValidationError):
        return ""


def _points(points, field, visible):
    # Gate before sampling: hidden test points cannot affect even the sample positions.
    allowed = [{"split": p.get("split"), "value": p[field]} for p in points
               if (p.get("split") in ("train", "validation") or (visible and p.get("split") == "test"))
               and isinstance(p.get(field), (int, float)) and math.isfinite(p[field])]
    if len(allowed) <= 64:
        return allowed
    return [allowed[round(i * (len(allowed) - 1) / 63)] for i in range(64)]


def library_projection(project, snapshot, workspace_root):
    studies = snapshot["studies"]
    factor_ids = {s["id"] for s in studies if s.get("primaryMetric") == "validation_mean_ic"}
    portfolio_ids = {s["id"] for s in studies if s.get("primaryMetric") == "validation_net_sharpe"}
    result = {"factor": None, "strategy": None}
    if factor_ids:
        runs = sorted((r for r in snapshot["runs"] if r["studyId"] in factor_ids), key=lambda r: (r["startedAt"], r["id"]), reverse=True)
        latest = runs[0] if runs else None
        explorer = snapshot.get("factorExplorer") or {}
        exact = latest and explorer.get("run", {}).get("id") == latest["id"]
        evidence = None
        if latest:
            try:
                run = load_run(project, latest["id"])
                family = build_research_family(project, run)
                evidence = {"runId": latest["id"], "researchFamily": family.projection,
                            "selectionAdjustment": build_selection_adjustment(run, family)}
            except (OSError, AutoQuantValidationError):
                # The snapshot already reports invalid evidence; never break the whole library or invent an adjustment.
                exact = False
        qualification = explorer.get("factorQualification") or {}
        claim = qualification.get("claim") or {}
        verdict = "Not tested"
        if latest:
            verdict = "Could not be tested"
            if (exact and latest["status"] == "succeeded" and qualification.get("available") and qualification.get("diagnosis")
                    and claim.get("claim") == "decision-signal" and claim.get("outcome") == "forward-return"):
                verdict = "Supported" if ((qualification.get("diagnosis") or {}).get("stage") == "decision-signal-positive"
                                          and (evidence.get("selectionAdjustment") or {}).get("passes") is True) else "Inconclusive"
        # Failed preflights have no Run. Preserve their operational failure state.
        audit = Path(workspace_root) / ".autoquant" / "studio-actions.jsonl"
        if not latest and audit.is_file() and not _is_link(audit) and not _is_link(audit.parent):
            started = set()
            for line in audit.read_text(encoding="utf-8").splitlines():
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                if entry.get("project") == project.manifest.id and entry.get("actionId") == "session.start" and entry.get("event") == "started":
                    started.add(entry.get("jobId"))
                if entry.get("jobId") in started and entry.get("event") == "finished" and entry.get("status") != "succeeded":
                    verdict = "Could not be tested"
        try:
            request = json.loads(_read(project, "request.json") or "null")
        except ValueError:
            request = None
        source = _read(project, "factors/candidate.py")
        expression = ""
        adapter = re.fullmatch(r'import pandas as pd\n\ndef compute_factor\(panel: pd.DataFrame\) -> pd.Series:\n    return \((.+)\).rename\("idea_factor"\)\n?', source, re.DOTALL)
        if adapter:
            expression = adapter[1]
        try:
            tree = ast.parse(source)
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "result" for t in node.targets):
                    expression = ast.get_source_segment(source, node.value) or ""
        except SyntaxError:
            pass
        protocol = explorer.get("protocol") or {}
        summary = explorer.get("summary") or {}
        visible = audit_visible(protocol, summary)
        result["factor"] = {
            "studyId": latest["studyId"] if latest else sorted(factor_ids)[0],
            "verdict": verdict, "evidence": evidence,
            "question": request.get("question") if request else project.manifest.description,
            "request": request, "bound": request is not None, "expression": expression,
            "validation": summary.get("validation") if exact else None,
            "redundancy": explorer.get("redundancy") if exact else None,
            "trials": evidence["researchFamily"]["totalExecutions"] if evidence else len(runs),
            "updatedAt": latest["startedAt"] if latest else None,
            "protocol": {"testRole": protocol.get("testRole")}, "testAudit": visible,
            "points": _points(((explorer.get("quantilePath") or {}).get("cumulative") or {}).get("points", []), "spread", visible) if exact and verdict in ("Supported", "Inconclusive") else [],
        }
        from .studio_strategy import observed_strategy_route
        result["factor"]["buildStrategy"] = observed_strategy_route(
            project, snapshot.get("researchProgramStatus"), workspace_root,
            outcome=claim.get("outcome"))
    explorer = snapshot.get("portfolioExplorer") or {}
    if portfolio_ids or explorer:
        runs = sorted((r for r in snapshot["runs"] if r["studyId"] in portfolio_ids), key=lambda r: (r["startedAt"], r["id"]), reverse=True)
        latest = next((r for r in runs if explorer.get("run", {}).get("id") == r["id"]), None)
        exact = latest and latest["status"] == "succeeded"
        validation = (explorer.get("strategyViability") or {}).get("validation") or {}
        evidence = None
        if exact:
            try:
                run = load_run(project, latest["id"])
                family = build_research_family(project, run)
                evidence = {"runId": latest["id"], "researchFamily": family.projection,
                            "selectionAdjustment": build_selection_adjustment(run, family)}
            except (OSError, AutoQuantValidationError):
                pass
        state = "Defined"
        if exact and validation.get("net"):
            state = "Tuned" if (explorer.get("parameterNeighborhood") or {}).get("available") is True else "Backtested"
        result["strategy"] = {
            "state": state, "evidence": evidence,
            "net": validation.get("net") if exact else None,
            "updatedAt": latest["startedAt"] if latest else None,
            # Validation metrics and development path only; no test audit is inferred from Portfolio presence.
            "points": _points((explorer.get("path") or {}).get("points", []), "netGrowth", False) if exact else [],
        }
    return result
