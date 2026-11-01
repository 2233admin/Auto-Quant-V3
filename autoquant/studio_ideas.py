"""Small Studio bridges for the first Factor idea; never a research evaluator."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sys
from shlex import join

from .studio_actions import (
    ActionError, CANDIDATE_RELATIVE, _is_link, _params_object, _sha256,
    confine_workspace_path, validate_save_params,
)
from .runs import list_runs
from .sessions import list_sessions
from .workspace import load_workspace

CREATE_ID = "project.create"
INTAKE_ID = "project.intake"
INITIAL = "initial"
TEMPLATES = ("blank", "ohlcv-factor-lab")
POLICY = "factor-idea-development-v1"
WORDING = {
    "supportedWhen": "Core publishes decision-signal-positive for forward-return and the exact Run's trial-family adjustment passes; development evidence only.",
    "refutedWhen": "Unavailable: the current Core protocol does not refute arbitrary hypothesis text.",
    "inconclusiveWhen": "An applicable completed diagnosis does not establish the declared ranking claim, or its trial-family adjustment is absent or does not pass.",
    "couldNotTestWhen": "Execution, preflight or the applicable Factor protocol is unavailable; no scientific conclusion.",
}


def text_param(value, label, minimum=1, maximum=500):
    if (not isinstance(value, str) or not minimum <= len(value) <= maximum
            or value != value.strip() or value.startswith("-")
            or re.search(r"[\x00-\x1f\x7f]", value)):
        raise ActionError(422, "validation.failed", f"{label}: expected {minimum} to {maximum} plain characters")
    return value


def safe_path(service, relative):
    """Confinement plus no links, including links which stay inside the root."""
    path = confine_workspace_path(service.root, relative, "idea path")
    original = Path(relative)
    original = original if original.is_absolute() else service.root / original
    if ".." in original.parts:
        raise ActionError(422, "studio.path", "Parent traversal is not permitted")
    current = original
    while current != service.root:
        if _is_link(current):
            raise ActionError(422, "studio.path", "Symlinks and junctions are not permitted")
        if current.parent == current:
            raise ActionError(422, "studio.path", "Path must be inside the Workspace")
        current = current.parent
    return path


def package_info(service, relative):
    path = safe_path(service, relative)
    staging = safe_path(service, "staging")
    if not path.is_relative_to(staging) or not path.is_file() or path.stat().st_size > 1_000_000:
        raise ActionError(422, "studio.dataset", "Select a dataset manifest under Workspace staging")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or data.get("kind") != "autoquant-ohlcv-dataset-package":
            raise ValueError("not a dataset package")
        if data.get("schemaVersion") != 1:
            raise ValueError("This first-idea flow currently supports aligned daily V1 packages only; use CLI intake for other contracts")
        digest = hashlib.sha256(path.read_bytes())
        for asset in data["assets"]:
            raw = Path(asset["path"])
            if raw.is_absolute() or ".." in raw.parts:
                raise ValueError("asset paths must stay inside the package directory")
            file = safe_path(service, str(path.parent / raw))
            if not file.is_relative_to(path.parent) or not file.is_file():
                raise ValueError("missing or escaped asset file")
            digest.update(asset["path"].encode())
            with file.open("rb") as handle:
                for block in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(block)
        return data, digest.hexdigest()
    except (ValueError, KeyError, TypeError, OSError) as error:
        raise ActionError(422, "studio.dataset", str(error)) from error


def datasets(service):
    staging = safe_path(service, "staging")
    items, rejected = [], []
    if staging.exists():
        # os.walk never follows directory links; explicit reparse checks also cover Windows junctions.
        for directory, dirs, files in os.walk(staging, followlinks=False):
            dirs[:] = [d for d in dirs if not _is_link(Path(directory) / d)]
            for name in files:
                if not name.endswith(".json"):
                    continue
                file = Path(directory) / name
                if _is_link(file) or file.stat().st_size > 1_000_000:
                    continue
                try:
                    raw = json.loads(file.read_text(encoding="utf-8"))
                    if not isinstance(raw, dict) or raw.get("kind") != "autoquant-ohlcv-dataset-package":
                        continue
                    relative = file.relative_to(service.root).as_posix()
                    data, digest = package_info(service, relative)
                    items.append({"path": relative, "sha256": digest, "id": data["id"],
                                  "assets": [a["symbol"] for a in data["assets"]],
                                  "provider": data["provider"]["name"],
                                  "adjustment": data["priceAdjustment"], "frequency": data["frequency"]})
                except ActionError as error:
                    rejected.append({"path": str(file.relative_to(service.root)), "reason": error.message})
                except (ValueError, KeyError, TypeError, OSError):
                    continue
    return {"datasets": items, "unavailable": rejected, "templates": list(TEMPLATES),
            "stagingCommand": f'New-Item -ItemType Directory -Force "{staging}"; Copy-Item -Recurse "<complete-package-directory>" "{staging}"',
            "stagingNote": "Copy a complete dataset package directory, including its manifest and referenced CSV files. No data is downloaded or invented by Studio."}


def request_for(project, package, horizon, assets):
    hypothesis = project.manifest.description
    return {"schemaVersion": 1, "kind": "autoquant-research-request",
            "title": project.manifest.name, "question": hypothesis,
            "decisionContext": "Test whether the authored Factor ranks forward returns on the explicitly selected population; no trading decision.",
            "assets": [{"symbol": a["symbol"], "assetClass": package["assetClass"], "venue": a["venue"]} for a in package["assets"]],
            "direction": "research-only", "horizon": f"{horizon} completed daily bars",
            "horizonPolicy": {"primaryForwardBars": horizon, "diagnosticForwardBars": [5 if horizon != 5 else 20]},
            "factorPolicy": {"claim": "decision-signal", "knownStyle": None, "outcome": "forward-return", "predictionAssets": assets},
            "hypotheses": [hypothesis], "constraints": ["Factor research only. No trading authority. No sealed-tail confirmation."],
            "deliverables": ["Validation Factor evidence with counted trials"],
            "source": {"system": "local", "workspaceId": None, "sessionId": None, "artifactPath": None, "artifactRevision": None}}


def prepare(service, body):
    if service.scope != "workspace":
        raise ActionError(409, "studio.blocked", "Idea creation requires serving a Workspace")
    action = body["actionId"]
    if action == CREATE_ID:
        params = _params_object(body.get("params"), {"id", "name", "description", "template"})
        pid = params.get("id")
        if not isinstance(pid, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", pid):
            raise ActionError(422, "validation.failed", "id must contain lowercase letters, digits and dashes")
        name = text_param(params.get("name"), "name", maximum=120)
        description = text_param(params.get("description"), "hypothesis", minimum=8)
        template = params.get("template")
        if template not in TEMPLATES:
            raise ActionError(422, "validation.failed", "Template is not allowlisted")
        workspace = load_workspace(service.root)
        target = safe_path(service, str(workspace.projects_dir / pid))
        if target.exists():
            raise ActionError(409, "studio.project-exists", "This Project id already exists; choose a new id")
        argv = [sys.executable, "-m", "autoquant", "project", "create", str(service.root), pid,
                "--name", name, "--description", description, "--template", template, "--json"]
        fingerprint = str(workspace.projects_dir)
        request = None
        writes = "Creates one dedicated Project and stores the hypothesis in its description and research.md. No trial or Run."
    else:
        params = _params_object(body.get("params"), {"dataset", "horizon", "predictionAssets"})
        project = service._project(body.get("project"))
        pid = project.manifest.id
        if list_runs(project) or list_sessions(project) or (project.root_dir / "request.json").exists():
            raise ActionError(409, "studio.blocked", "Data intake is only available before the first binding or Run")
        package, digest = package_info(service, params.get("dataset"))
        horizon = params.get("horizon")
        assets = params.get("predictionAssets")
        if type(horizon) is not int or not 1 <= horizon <= 60:
            raise ActionError(422, "validation.failed", "Choose a forward horizon from 1 to 60 bars")
        universe = [a["symbol"] for a in package["assets"]]
        if (not isinstance(assets, list) or not assets or any(not isinstance(a, str) or a not in universe for a in assets)
                or len(set(assets)) != len(assets)):
            raise ActionError(422, "validation.failed", "Choose an explicit prediction population from the package")
        request = request_for(project, package, horizon, assets)
        from .briefs import validate_research_request
        validate_research_request(request)
        request_path = safe_path(service, f".autoquant/idea-inputs/{pid}.json")
        argv = [sys.executable, "-m", "autoquant", "project", "intake", str(service.root), pid,
                "--request", str(request_path), "--dataset", str(safe_path(service, params["dataset"])),
                "--template", "ohlcv-factor-lab", "--name", project.manifest.name, "--json"]
        fingerprint = service._fingerprint(project) + digest + json.dumps(request, sort_keys=True)
        writes = "Writes the displayed request and binds a normalized Project-local snapshot through strict Core intake. No trial."
    preview = {"actionId": action, "project": pid, "params": params, "argv": argv,
               "display": join(argv), "commandHash": service.command_hash(action, pid, argv, fingerprint),
               "writes": writes, "trial": None, "requiresSecondConfirm": False, "timeoutSeconds": 120,
               "request": request}
    return preview


def launch(service, body):
    preview = prepare(service, body)
    if body.get("confirm") is not True:
        raise ActionError(400, "studio.confirm-required", "confirm must be true")
    if body.get("commandHash") != preview["commandHash"]:
        raise ActionError(409, "studio.stale-preview", "Inputs changed; preview again")
    pid = preview["project"]
    if service.runner.active_job(pid):
        raise ActionError(409, "studio.busy", "This Project already has a running job")
    if preview["request"] is not None:
        target = safe_path(service, f".autoquant/idea-inputs/{pid}.json")
        target.parent.mkdir(parents=True, exist_ok=True)
        service._atomic_write(target, (json.dumps(preview["request"], indent=2) + "\n").encode())
    job = service.runner.create(action_id=preview["actionId"], project=pid, argv=preview["argv"],
                                display=preview["display"], command_hash=preview["commandHash"],
                                timeout=120, cwd=str(service.root))
    return {"jobId": job.id, "status": job.status, "commandHash": preview["commandHash"]}


def question(service, project):
    request = safe_path(service, str(project.root_dir / "request.json"))
    if request.is_file() and not _is_link(request):
        return json.loads(request.read_text(encoding="utf-8"))["question"]
    return project.manifest.description


def binding(service, project, trial_hypothesis=None):
    original = question(service, project)
    return {"hypothesis": original, "hypothesisSha256": _sha256(original.encode()),
            "verdictPolicy": POLICY, "verdictWording": WORDING, "trialHypothesis": trial_hypothesis,
            "trialHypothesisSha256": _sha256(trial_hypothesis.encode()) if trial_hypothesis else None}


def initial_path(service, project):
    if list_runs(project) or list_sessions(project):
        raise ActionError(409, "studio.blocked", "Initial candidate is frozen after the first Run; edit through its Session")
    if not safe_path(service, str(project.root_dir / "request.json")).is_file():
        raise ActionError(409, "studio.blocked", "Bind a staged dataset before authoring the first candidate")
    candidate = safe_path(service, str(project.root_dir / CANDIDATE_RELATIVE))
    if not candidate.is_file():
        raise ActionError(409, "studio.blocked", "No Factor candidate exists in this Project")
    return candidate


def initial_candidate(service, project):
    path = initial_path(service, project)
    raw = path.read_bytes()
    return {"path": str(path.relative_to(service.root)), "source": raw.decode("utf-8"),
            "sha256": _sha256(raw), "bytes": len(raw), "editable": True, "blockedReason": None}


def save_initial(service, body):
    project = service._project(body.get("project"))
    params = validate_save_params(body.get("params"))
    if body.get("confirm") is not True:
        raise ActionError(400, "studio.confirm-required", "confirm must be true")
    with service.runner.hold(project.manifest.id):
        path = initial_path(service, project)
        if _sha256(path.read_bytes()) != params["baseSha256"]:
            raise ActionError(409, "studio.conflict", "The candidate changed; reload before saving")
        raw = params["source"].encode()
        record = {"project": project.manifest.id, "sourceSha256": _sha256(raw), **binding(service, project)}
        service.audit.append({"event": "initial-candidate-save-started", **record}, fsync=True)
        try:
            service._atomic_write(path, raw)
        except OSError as error:
            service.audit.append({"event": "initial-candidate-save-failed", **record}, fsync=True)
            raise ActionError(500, "studio.write-failed", f"Cannot save the initial candidate: {error}") from error
        service.audit.append({"event": "initial-candidate-saved", **record}, fsync=True)
    return {"sha256": _sha256(raw), "bytes": len(raw)}


def idea_view(service, project_id):
    project = service._project(project_id)
    request_path = safe_path(service, str(project.root_dir / "request.json"))
    request = json.loads(request_path.read_text(encoding="utf-8")) if request_path.is_file() else None
    records = []
    finished = {}
    authored_hashes = set()
    audit_path = safe_path(service, ".autoquant/studio-actions.jsonl")
    if audit_path.is_file():
        for line in audit_path.read_text(encoding="utf-8").splitlines():
            try:
                entry = json.loads(line)
                if entry.get("event") == "finished":
                    finished[entry["jobId"]] = entry
                if entry.get("event") == "initial-candidate-saved" and entry.get("project") == project_id:
                    authored_hashes.add(entry["sourceSha256"])
                if entry.get("project") == project_id and entry.get("hypothesisSha256") and entry.get("event") == "started":
                    records.append(entry)
            except ValueError:
                continue
    from .runs import load_run
    from .selection import build_research_family, build_selection_adjustment
    runs = list_runs(project, "ohlcv-factor-quality")
    evidence = None
    if runs:
        latest = max(runs, key=lambda r: (r.started_at, r.id))
        run = load_run(project, latest.id)
        family = build_research_family(project, run)
        evidence = {"runId": latest.id, "researchFamily": family.projection,
                    "selectionAdjustment": build_selection_adjustment(run, family)}
    jobs = {j.id: j.to_dict() for j in service.runner.recent() if j.project == project_id}
    for record in records:
        receipt = finished.get(record["jobId"])
        if receipt and record["jobId"] not in jobs:
            jobs[record["jobId"]] = {"jobId": record["jobId"], "actionId": record["actionId"],
                                     "project": project_id, "status": receipt["status"],
                                     "startedAt": record["startedAt"], "endedAt": receipt["endedAt"],
                                     "createdRefs": receipt["createdRefs"], "result": None,
                                     "stderrTail": "", "stdoutTail": "", "stages": []}
        if receipt:
            record["runId"] = receipt["createdRefs"].get("runId")
    candidate_path = safe_path(service, str(project.root_dir / CANDIDATE_RELATIVE))
    return {**binding(service, project), "bound": request is not None, "request": request,
            "frozen": bool(records or list_runs(project)), "bindings": records,
            "evidence": evidence,
            "initialAuthored": _sha256(candidate_path.read_bytes()) in authored_hashes if candidate_path.is_file() else False,
            "jobs": sorted(jobs.values(), key=lambda j: j["startedAt"] or "", reverse=True)}
