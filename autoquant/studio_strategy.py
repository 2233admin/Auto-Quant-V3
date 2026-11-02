"""Honest Factor-to-Portfolio routing over the existing coordinated program."""

from __future__ import annotations

import json
from shlex import join

from .research_program import RESEARCH_PROGRAM_MANIFEST, load_research_program
from .templates import project_template_routes
from .workspace import AutoQuantValidationError

BUILD_ID = "strategy.build"
BUILD_WRITES = (
    "Starts a governed Portfolio Session in this research desk's existing Study; "
    "creates a worktree and, unless reused, a counted immutable baseline Run. "
    "No Project conversion, new Study, parameter search or promotion."
)


def strategy_route(project, program, workspace_root):
    """Use published program gates, never a browser verdict or metric threshold."""
    template = next(t for t in project_template_routes() if t["id"] == "ohlcv-research-desk")
    argv = ["aq", "project", "intake", str(workspace_root), "<new-strategy-id>",
            "--template", template["id"], "--request", "<caller-approved-request.json>",
            "--dataset", "<complete-package.json>", "--json"]
    route = {"mode": "blocked", "reasonCode": "no-coordinated-program",
             "reason": "This Project has no coordinated Factor-to-Portfolio program. Core cannot convert a standalone Factor Lab or bind its evidence into a new Portfolio Project.",
             "template": template["id"], "fits": template["fits"], "argv": argv,
             "display": join(argv), "studyId": None, "runId": None, "factorRunId": None}
    if not program:
        return route
    lane = next((x for x in program["lanes"] if x["id"] == "portfolio"), None)
    if not lane:
        return route
    factor = next((x for x in program["lanes"] if x["id"] == "factor"), {})
    route["factorRunId"] = (factor.get("latestRun") or {}).get("id") if factor.get("currentRun") is True else None
    route["studyId"] = lane["studyId"]
    inspect = ["aq", "project", "program", str(project.root_dir), "--json"]
    route.update(argv=inspect, display=join(inspect))
    if lane.get("currentRun") is True and (lane.get("latestRun") or {}).get("status") == "succeeded":
        route.update(mode="open", reasonCode="already-built", runId=lane["latestRun"]["id"],
                     reason="This research desk already has current Portfolio evidence. Open its Strategy workbench.")
        return route
    gate = next((g for g in program["progression"]["gates"] if g["id"] == "factor-to-portfolio"), None)
    if not gate or gate["status"] != "passed":
        route.update(reasonCode="factor-gate", reason=gate["explanation"] if gate else "Core has not published Factor-to-Portfolio admission.")
        return route
    active = [x for x in program["lanes"] if (x.get("latestSession") or {}).get("status") == "active"]
    if active or program["conflicts"]:
        route.update(reasonCode="active-session", reason="Finish the active research Session before starting Portfolio: Factor, Portfolio and RL share source authority.")
        return route
    if lane["phase"] in {"scientific-limit", "repair-required"}:
        route.update(reasonCode="failed-evidence", reason="Inspect the retained failed Portfolio Run and its failure disposition before declaring new work.")
        return route
    command = next((c for c in lane["commands"] if c["id"] == "session.start"), None)
    if not command:
        route.update(reasonCode="no-start-command", reason="Core does not offer a Portfolio Session start for this state.")
        return route
    route.update(mode="start", reasonCode="admitted", reason=BUILD_WRITES,
                 argv=command["argv"], display=command["display"])
    return route


def observed_strategy_route(project, program, workspace_root, *, outcome=None):
    try:
        if outcome == "forward-realized-volatility":
            route = strategy_route(project, None, workspace_root)
            argv = ["aq", "project", "templates", "--json"]
            route.update(reasonCode="risk-outcome", argv=argv, display=join(argv),
                         reason="This Factor predicts future realized volatility. Core cannot translate a risk forecast into a forward-return Portfolio claim; a different caller-owned assignment is required.")
            return route
        if program is None and (project.root_dir / RESEARCH_PROGRAM_MANIFEST).exists():
            raise ValueError("The existing program failed snapshot verification")
        return strategy_route(project, program, workspace_root)
    except (KeyError, TypeError, ValueError, AutoQuantValidationError, OSError):
        route = strategy_route(project, None, workspace_root)
        route.update(reasonCode="invalid-program", reason="The coordinated program could not be verified; inspect Project diagnostics before building a strategy.")
        return route


def prepare_build(service, body):
    from .studio_actions import ActionError, Prepared, _params_object

    params = _params_object(body.get("params"), set())
    project = service._project(body.get("project"))
    try:
        program = load_research_program(project, optional=True)
        route = strategy_route(project, program, service.root)
    except (AutoQuantValidationError, OSError) as error:
        raise ActionError(409, "studio.blocked", str(error)) from error
    if route["mode"] != "start":
        raise ActionError(409, "studio.blocked", route["reason"])
    # Reuse all Session checks and trial disclosure. The Core command is unchanged.
    prepared = service._prepare({"actionId": "session.start", "project": project.manifest.id,
                                 "params": {"study": route["studyId"]}})
    import sys
    argv = [sys.executable, "-m", "autoquant", *route["argv"][1:]]
    fingerprint = prepared.fingerprint + json.dumps(program, sort_keys=True)
    return Prepared(project, BUILD_ID, params, argv, fingerprint, prepared.trial)


def catalog_entry(service, projects):
    from .studio_actions import ActionError

    targets = []
    for pid, project in projects.items():
        try:
            prepare_build(service, {"project": pid, "params": {}})
            reason = None
        except (ActionError, AutoQuantValidationError, OSError) as error:
            reason = str(error)
        active = service.runner.active_job(pid)
        reason = reason or (f"Project {pid} already has active job {active}" if active else None)
        targets.append({"project": pid, "activeJob": active, "sessions": [],
                        "available": reason is None, "blockedBy": reason})
    return {"id": BUILD_ID, "label": "Build strategy", "command": "aq session start",
            "classification": "writes-immutable-evidence", "writes": BUILD_WRITES,
            "requiresSecondConfirm": True, "timeoutSeconds": service._timeouts[BUILD_ID],
            "params": {}, "targets": targets}
