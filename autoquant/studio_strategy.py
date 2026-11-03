"""Honest Factor-to-Portfolio routing over Core contracts.

Two Core paths sit behind the one ``strategy.build`` action:

* a research desk whose Core gate admits Portfolio starts its existing
  Portfolio Study in a governed Session (unchanged behavior);
* a tested standalone Factor Lab is converted into a new research desk by
  ``aq project from-factor`` with a caller-confirmed mandate; Studio never
  defaults a Portfolio fact and the source Project is only read.

See docs/design/factor-to-portfolio-conversion.md.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from shlex import join

from . import factor_conversion as conversion
from .research_program import RESEARCH_PROGRAM_MANIFEST, load_research_program
from .studio_actions import ActionError, Prepared, _params_object
from .studio_ideas import safe_path
from .templates import project_template_routes
from .workspace import AutoQuantValidationError

BUILD_ID = "strategy.build"
BUILD_WRITES = (
    "Starts a governed Portfolio Session in this research desk's existing Study; "
    "creates a worktree and, unless reused, a counted immutable baseline Run. "
    "No Project conversion, new Study, parameter search or promotion."
)
CONVERT_WRITES = (
    "Creates one new research-desk Project from this tested Factor by reference: "
    "the exact candidate source, the same market data, the caller-confirmed mandate "
    "and the inherited trial count. Runs nothing; the source Project is only read."
)
CONVERT_STAGES = (("project-created", "research desk created"),)
CONVERT_TIMEOUT_SECONDS = 300
NEW_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
MANDATE_DIR = ".autoquant/strategy-mandates"


def _relative(path, root):
    try:
        return Path(path).relative_to(root).as_posix()
    except ValueError:
        return str(path)


def conversion_route(project, workspace_root, route):
    """Readiness of a standalone Factor Lab for `aq project from-factor`."""

    argv = ["aq", "project", "from-factor", str(workspace_root), project.manifest.id,
            "<new-strategy-id>", "--mandate", "<caller-confirmed-mandate.json>", "--json"]
    try:
        evidence = conversion.source_factor_evidence(project, diagnostics=False)
        snapshot = conversion._source_snapshot(project, evidence["intake"])
        package = conversion.discover_dataset_package(Path(workspace_root), snapshot)
    except AutoQuantValidationError as error:
        code = conversion.refusal_code(error)
        if code is None or code == "conversion.not-factor-lab":
            return route
        route.update(reasonCode=code.split(".", 1)[1], reason=str(error), argv=argv, display=join(argv))
        return route
    if package is None:
        route.update(reasonCode="data-not-reusable", argv=argv, display=join(argv),
                     reason="The source dataset package could not be found unchanged under Workspace staging, so the same market data cannot be proven.")
        return route
    observations = min(int(item["observations"]) for item in snapshot["assets"])
    request = evidence["request"]
    route.update(
        mode="convert", reasonCode="convertible", argv=argv, display=join(argv),
        # The exact source is pinned by hash below; any displayed Run of the same
        # current source may start the conversion.
        reason=CONVERT_WRITES, factorRunId=None,
        conversion={
            "sourceRunId": evidence["anchor"].result["id"],
            "sourceHash": evidence["anchor"].result["subject"]["sourceHash"],
            "inheritedSourceTrials": evidence["distinctSources"],
            "sourceFamilies": evidence["families"],
            "assets": [item["symbol"] for item in request["assets"]],
            "predictionAssets": list((request.get("factorPolicy") or {}).get("predictionAssets") or []),
            "datasetPackage": _relative(package, Path(workspace_root)),
            "observations": observations,
            "rlLaneSufficient": observations >= conversion.RL_LANE_FLOOR,
            "suggestedProjectId": f"{project.manifest.id}-strategy"[:64],
            "defaults": conversion.mandate_defaults(request),
            "defaultsNotice": "Displayed starting values only. Nothing is recorded until you confirm every Portfolio fact.",
        },
    )
    return route


def strategy_route(project, program, workspace_root):
    """Use published program gates, never a browser verdict or metric threshold."""
    template = next(t for t in project_template_routes() if t["id"] == "ohlcv-research-desk")
    argv = ["aq", "project", "intake", str(workspace_root), "<new-strategy-id>",
            "--template", template["id"], "--request", "<caller-approved-request.json>",
            "--dataset", "<complete-package.json>", "--json"]
    route = {"mode": "blocked", "reasonCode": "no-coordinated-program",
             "reason": "This Project has no coordinated Factor-to-Portfolio program and is not a request-bound standalone Factor Lab that Core can convert.",
             "template": template["id"], "fits": template["fits"], "argv": argv,
             "display": join(argv), "studyId": None, "runId": None, "factorRunId": None}
    if not program:
        return conversion_route(project, workspace_root, route)
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
            route = strategy_route(project, {"lanes": []}, workspace_root)
            argv = ["aq", "project", "templates", "--json"]
            route.update(reasonCode="risk-outcome", argv=argv, display=join(argv),
                         reason="This Factor predicts future realized volatility. Core cannot translate a risk forecast into a forward-return Portfolio claim; a different caller-owned assignment is required.")
            return route
        if program is None and (project.root_dir / RESEARCH_PROGRAM_MANIFEST).exists():
            raise ValueError("The existing program failed snapshot verification")
        return strategy_route(project, program, workspace_root)
    except (KeyError, TypeError, ValueError, AutoQuantValidationError, OSError):
        route = strategy_route(project, {"lanes": []}, workspace_root)
        route.update(reasonCode="invalid-program", reason="The coordinated program could not be verified; inspect Project diagnostics before building a strategy.")
        return route


# --- desk path: start the admitted Portfolio Study ------------------------------


def prepare_build(service, body):

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
    argv = [sys.executable, "-m", "autoquant", *route["argv"][1:]]
    fingerprint = prepared.fingerprint + json.dumps(program, sort_keys=True)
    return Prepared(project, BUILD_ID, params, argv, fingerprint, prepared.trial)


# --- standalone path: convert by reference ------------------------------------


def conversion_requested(service, body):
    """True when strategy.build targets a Project without a coordinated program."""

    if not isinstance(body, dict) or body.get("actionId") != BUILD_ID:
        return False
    try:
        project = service._project(body.get("project"))
        return load_research_program(project, optional=True) is None
    except Exception:  # unknown Project or invalid program: the ordinary path reports it
        return False


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def preview_conversion(service, body):

    if service.scope != "workspace":
        raise ActionError(409, "studio.blocked", "Building a strategy from a standalone Factor requires serving a Workspace")
    params = _params_object(body.get("params"), {"newProject", "mandate"})
    source = service._project(body.get("project"))
    route = conversion_route(source, service.root, strategy_route(source, {"lanes": []}, service.root))
    if route["mode"] != "convert":
        raise ActionError(409, "studio.blocked", route["reason"])
    new_id = params.get("newProject")
    if not isinstance(new_id, str) or not NEW_ID.fullmatch(new_id):
        raise ActionError(422, "validation.failed", "newProject must contain lowercase letters, digits and dashes")
    mandate = params.get("mandate")
    try:
        conversion.validate_strategy_mandate(mandate, json.loads((source.root_dir / "request.json").read_text(encoding="utf-8")))
        raw = (json.dumps(mandate, indent=2, sort_keys=True) + "\n").encode("utf-8")
        mandate_sha = hashlib.sha256(raw).hexdigest()
        package = safe_path(service, route["conversion"]["datasetPackage"])
        prepared, _, _ = conversion.plan_conversion(service.root, source.manifest.id, new_id, mandate, mandate_sha, dataset=package)
    except AutoQuantValidationError as error:
        raise ActionError(409, "studio.blocked", str(error)) from error
    mandate_path = safe_path(service, f"{MANDATE_DIR}/{new_id}.json")
    argv = [sys.executable, "-m", "autoquant", "project", "from-factor", str(service.root),
            source.manifest.id, new_id, "--mandate", str(mandate_path), "--dataset", str(package), "--json"]
    lineage = prepared.factor_seed.lineage
    fingerprint = service._fingerprint(source) + mandate_sha + lineage["marketData"]["packageManifestHash"]
    inherited = lineage["trials"]["inheritedSourceTrials"]
    return {
        "actionId": BUILD_ID, "project": source.manifest.id, "params": params,
        "argv": argv, "display": join(argv),
        "commandHash": service.command_hash(BUILD_ID, source.manifest.id, argv, fingerprint),
        "writes": CONVERT_WRITES, "requiresSecondConfirm": True, "timeoutSeconds": CONVERT_TIMEOUT_SECONDS,
        "trial": {"n": inherited + 1, "m": inherited + 1, "inheritedSourceTrials": inherited,
                  "notice": f"the new desk continues {inherited} counted source trials; its first Portfolio evaluation will be trial {inherited + 1}"},
        "mandate": mandate, "mandateSha256": mandate_sha, "request": prepared.request,
        "conversion": {"newProject": new_id, "sourceRunId": lineage["source"]["anchorRun"]["id"],
                       "sourceHash": lineage["candidate"]["sourceHash"],
                       "datasetPackage": route["conversion"]["datasetPackage"],
                       "marketIdentity": lineage["marketData"]["sourceMarketIdentity"],
                       "observations": lineage["marketData"]["observations"],
                       "rlLaneSufficient": lineage["marketData"]["rlLane"]["sufficient"],
                       "callerProvidedFields": lineage["mandate"]["callerProvidedFields"]},
    }


def launch_conversion(service, body):

    preview = preview_conversion(service, body)
    if body.get("confirm") is not True:
        raise ActionError(400, "studio.confirm-required", "confirm must be true")
    if body.get("commandHash") != preview["commandHash"]:
        raise ActionError(409, "studio.stale-preview", "Inputs or Project state changed; preview again")
    if body.get("secondConfirm") is not True:
        raise ActionError(400, "studio.second-confirm-required", "Confirm creating the research desk and continuing its counted trials")
    new_id = preview["conversion"]["newProject"]
    if service.runner.active_job(new_id) or service.runner.active_job(preview["project"]):
        raise ActionError(409, "studio.busy", "A job for this source or target Project is already running")
    target = safe_path(service, f"{MANDATE_DIR}/{new_id}.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    service._atomic_write(target, (json.dumps(preview["mandate"], indent=2, sort_keys=True) + "\n").encode("utf-8"))
    audit = {"conversion": {"sourceProject": preview["project"], "newProject": new_id,
                            "sourceRunId": preview["conversion"]["sourceRunId"],
                            "sourceHash": preview["conversion"]["sourceHash"],
                            "mandateSha256": preview["mandateSha256"],
                            "inheritedSourceTrials": preview["trial"]["inheritedSourceTrials"],
                            "callerProvidedFields": preview["conversion"]["callerProvidedFields"]}}
    job = service.runner.create(action_id=BUILD_ID, project=new_id, argv=preview["argv"],
                                display=preview["display"], command_hash=preview["commandHash"],
                                timeout=CONVERT_TIMEOUT_SECONDS, cwd=str(service.root),
                                audit_fields=audit, stages=CONVERT_STAGES)
    return {"jobId": job.id, "status": job.status, "commandHash": preview["commandHash"], "project": new_id}


def catalog_entry(service, projects):

    targets = []
    for pid, project in projects.items():
        reason = None
        try:
            if load_research_program(project, optional=True) is not None:
                prepare_build(service, {"project": pid, "params": {}})
            else:
                route = strategy_route(project, None, service.root)
                if route["mode"] != "convert":
                    reason = route["reason"]
                elif service.scope != "workspace":
                    reason = "Building a strategy from a standalone Factor requires serving a Workspace"
        except (ActionError, AutoQuantValidationError, OSError) as error:
            reason = str(error)
        active = service.runner.active_job(pid)
        reason = reason or (f"Project {pid} already has active job {active}" if active else None)
        targets.append({"project": pid, "activeJob": active, "sessions": [],
                        "available": reason is None, "blockedBy": reason})
    return {"id": BUILD_ID, "label": "Build strategy", "command": "aq session start | aq project from-factor",
            "classification": "writes-immutable-evidence", "writes": BUILD_WRITES + " " + CONVERT_WRITES,
            "requiresSecondConfirm": True, "timeoutSeconds": service._timeouts[BUILD_ID],
            "params": {"newProject": {"type": "string", "pattern": NEW_ID.pattern, "optional": True},
                       "mandate": {"type": "object", "kind": "autoquant-strategy-mandate", "optional": True}},
            "targets": targets}


# --- desk projection ------------------------------------------------------------


def lineage_summary(project, snapshot):
    """Compact verified lineage for the Strategy workbench, or None."""

    try:
        loaded = conversion.load_factor_lineage(project)
    except AutoQuantValidationError as error:
        return {"valid": False, "error": str(error)}
    if loaded is None:
        return None
    lineage, digest = loaded
    try:
        request = json.loads((project.root_dir / "request.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        request = {}
    gates = ((snapshot.get("researchProgramStatus") or {}).get("progression") or {}).get("gates") or []
    gate = next((g for g in gates if g.get("id") == "factor-to-portfolio"), None)
    market = lineage["marketData"]
    return {
        "valid": True, "lineageHash": digest,
        "sourceProjectId": lineage["source"]["projectId"],
        "sourceRunId": lineage["source"]["anchorRun"]["id"],
        "sourceQualificationStage": lineage["source"]["anchorRun"]["qualificationStage"],
        "sourceSelectionAdjustment": lineage["source"]["anchorRun"]["selectionAdjustment"],
        "sourceRunCount": len(lineage["source"]["factorRuns"]),
        "sourceHash": lineage["candidate"]["sourceHash"],
        "inheritedSourceTrials": lineage["trials"]["inheritedSourceTrials"],
        "sourceFamilies": lineage["trials"]["sourceFamilies"],
        "sameMarketData": market.get("sameMarketData") is True,
        "marketIdentity": market.get("targetMarketIdentity"),
        "observations": market["observations"],
        "rlLaneSufficient": market["rlLane"]["sufficient"],
        "rlRequiredObservations": market["rlLane"]["requiredObservations"],
        "callerProvidedFields": lineage["mandate"]["callerProvidedFields"],
        "mandate": {"direction": request.get("direction"),
                    "positionRoles": {a.get("symbol"): a.get("positionRole") for a in request.get("assets", [])},
                    "benchmarkPolicy": request.get("benchmarkPolicy"),
                    "portfolioPolicy": request.get("portfolioPolicy")},
        "factorGate": {"status": gate.get("status"), "explanation": gate.get("explanation")} if gate else None,
    }
