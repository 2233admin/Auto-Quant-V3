"""Confined, read-only staging inspection and the wizard's audited intake bridge."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
from shlex import join
import sys
from functools import wraps
from types import SimpleNamespace

from .briefs import validate_research_request
from .data_quality import quality_report
from .data_sources import inspect_source, load_sources
from .intake import SAFE_SYMBOL, _validate_package_manifest, normalize_ohlcv
from .runs import list_runs
from .sessions import list_sessions
from .studio_actions import ActionError, _is_link, _params_object
from .studio_ideas import request_for, safe_path, text_param
from .workspace import load_workspace


def validated(function):
    @wraps(function)
    def call(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except (ValueError, TypeError, KeyError, OSError) as error:
            raise ActionError(422, "studio.dataset", str(error)) from error
    return call


def staging_path(service, relative):
    if service.scope != "workspace":
        raise ActionError(409, "studio.blocked", "Data inspection requires serving a Workspace")
    path = safe_path(service, relative)
    staging = safe_path(service, "staging")
    if not path.is_relative_to(staging) or not path.exists():
        raise ActionError(422, "studio.dataset", "Select an existing path under Workspace staging")
    return path


@validated
def sources(service, relative=None):
    if service.scope != "workspace":
        raise ActionError(409, "studio.blocked", "Data inspection requires serving a Workspace")
    if relative is not None:
        return inspect_source(staging_path(service, relative))
    staging = safe_path(service, "staging")
    items = []
    if staging.exists():
        for directory, dirs, files in os.walk(staging, followlinks=False):
            dirs[:] = sorted(d for d in dirs if not _is_link(Path(directory) / d) and not d.startswith("wizard-"))
            folder = Path(directory)
            if any(name.lower().endswith(".csv") and not _is_link(folder / name) for name in files):
                items.append({"path": folder.relative_to(service.root).as_posix(), "kind": "csv-folder"})
            for name in sorted(files):
                file = folder / name
                if file.suffix.lower() != ".json" or _is_link(file) or file.stat().st_size > 1_000_000:
                    continue
                try:
                    raw = json.loads(file.read_text(encoding="utf-8"))
                    if isinstance(raw, dict) and raw.get("kind") == "autoquant-ohlcv-dataset-package":
                        items.append({"path": file.relative_to(service.root).as_posix(), "kind": "dataset-package"})
                except (ValueError, OSError):
                    continue
    return {"sources": sorted(items, key=lambda item: item["path"]), "root": "staging"}


def _inputs(service, params):
    path = staging_path(service, params.get("source"))
    options = params.get("options", {})
    if not isinstance(options, dict):
        raise ActionError(422, "validation.failed", "options must be an object")
    _, package, assets, _, _ = load_sources(path, options)
    for asset in assets:
        staging_path(service, str(asset.path))
    return path, options, package, assets


@validated
def data_check(service, body):
    params = _params_object(body.get("params"), {"source", "options"})
    path, options, _, _ = _inputs(service, params)
    return quality_report(path, options)


@validated
def check_preview(service, body):
    params = _params_object(body.get("params"), {"source", "options"})
    path, options, _, _ = _inputs(service, params)
    argv = [sys.executable, "-m", "autoquant", "data", "check", str(path), "--options-json", json.dumps(options, sort_keys=True), "--json"]
    return {"actionId": "data.check", "params": params, "argv": argv, "display": join(argv),
            "writes": "None", "requiresSecondConfirm": False, "confirmationRequired": False}


def _json_bytes(value):
    return (json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n").encode()


def _bundle(service, body):
    params = _params_object(body.get("params"), {"source", "options", "name", "question", "horizon", "predictionAssets"})
    path, options, package, assets = _inputs(service, params)
    report = quality_report(path, options)
    if report["verdict"] == "fail":
        raise ActionError(422, "studio.data-quality", "Resolve failing data checks before intake")
    pid = body.get("project")
    if not isinstance(pid, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", pid):
        raise ActionError(422, "validation.failed", "Choose a path-safe Project id")
    workspace = load_workspace(service.root)
    target = safe_path(service, str(workspace.projects_dir / pid))
    if target.exists():
        project = service._project(pid)
        if list_runs(project) or list_sessions(project) or (project.root_dir / "request.json").exists():
            raise ActionError(409, "studio.blocked", "Choose an unbound pristine Factor Project")
        fingerprint = service._fingerprint(project)
        name, question = project.manifest.name, project.manifest.description
    else:
        name = text_param(params.get("name"), "name", maximum=120)
        question = text_param(params.get("question"), "question", minimum=8)
        project = SimpleNamespace(manifest=SimpleNamespace(name=name, description=question))
        fingerprint = str(workspace.projects_dir)
    outputs = {}
    digest = hashlib.sha256((report["sourceHash"] + pid + fingerprint + json.dumps(params, sort_keys=True)).encode()).hexdigest()
    destination = safe_path(service, f"staging/wizard-{digest}")
    if package is None:
        if options.get("frequency") != "1d" or options.get("clock") != "session":
            raise ActionError(422, "studio.dataset", "Raw CSV packaging requires declared daily session bars; supply an existing package for other contracts")
        package = {"schemaVersion": 1, "kind": "autoquant-ohlcv-dataset-package", "id": f"wizard-{digest[:16]}",
                   "version": digest[:16], "assetClass": options.get("assetClass"), "frequency": "1d",
                   "market": {key: options.get(key) for key in ("clock", "calendar", "timezone")},
                   "priceAdjustment": options.get("priceAdjustment"), "provider": options.get("provider"), "assets": []}
        for asset in assets:
            if not SAFE_SYMBOL.fullmatch(asset.symbol):
                raise ActionError(422, "studio.dataset", "CSV filenames or asset values must be path-safe asset identifiers")
            frame = normalize_ohlcv(asset.frame, source=asset.symbol)
            if not (frame.date == frame.date.dt.normalize()).all():
                raise ActionError(422, "studio.dataset", "V1 CSV packaging requires daily date labels; use a close-time-aware V5 package for timestamps")
            frame["date"] = frame.date.dt.strftime("%Y-%m-%d")
            filename = f"{asset.symbol}.csv"
            outputs[filename] = frame.to_csv(index=False, lineterminator="\n").encode()
            package["assets"].append({"symbol": asset.symbol, "path": filename, "venue": options.get("venue"), "currency": options.get("currency")})
        manifest_path = destination / "dataset-package.json"
        package = _validate_package_manifest(package, manifest_path)
        outputs["dataset-package.json"] = _json_bytes(package)
    else:
        manifest_path = path
    horizon, population = params.get("horizon"), params.get("predictionAssets")
    universe = [a["symbol"] for a in package["assets"]]
    if type(horizon) is not int or not 1 <= horizon <= 60:
        raise ActionError(422, "validation.failed", "Choose a forward horizon from 1 to 60 bars")
    if (not isinstance(population, list) or not population or any(not isinstance(a, str) or a not in universe for a in population)
            or len(set(population)) != len(population)):
        raise ActionError(422, "validation.failed", "Choose an explicit prediction population from the dataset")
    request = request_for(project, package, horizon, population)
    if package["schemaVersion"] != 1:
        request["horizon"] = f"{horizon} completed {package.get('baseInterval', package.get('frequency'))} bars"
    request["question"] = question
    request["assets"] = [{"symbol": a["symbol"], "assetClass": a.get("assetClass", package["assetClass"]), "venue": a["venue"]} for a in package["assets"]]
    validate_research_request(request)
    outputs["request.json"] = _json_bytes(request)
    outputs["transformation-audit.json"] = _json_bytes({"schemaVersion": 1, "source": params["source"], "sourceHash": report["sourceHash"],
        "options": options, "operation": "column mapping and canonical CSV serialization; no fill, deduplication or price adjustment",
        "outputs": {name: hashlib.sha256(raw).hexdigest() for name, raw in outputs.items()}})
    argv = [sys.executable, "-m", "autoquant", "project", "intake", str(service.root), pid,
            "--request", str(destination / "request.json"), "--dataset", str(manifest_path),
            "--template", "ohlcv-factor-lab", "--name", name, "--json"]
    preview = {"actionId": "project.intake", "project": pid, "params": params, "argv": argv, "display": join(argv),
               "commandHash": service.command_hash("project.intake", pid, argv, digest), "trial": None,
               "writes": "Creates a content-addressed staging bundle and binds a normalized Project snapshot through strict Core intake. No trial.",
               "requiresSecondConfirm": True, "timeoutSeconds": 120, "request": request,
               "package": package, "quality": report, "stagingDirectory": str(destination)}
    return preview, destination, outputs


@validated
def prepare_intake(service, body):
    if service.scope != "workspace":
        raise ActionError(409, "studio.blocked", "Data intake requires serving a Workspace")
    return _bundle(service, body)[0]


@validated
def launch_intake(service, body):
    preview, directory, outputs = _bundle(service, body)
    if body.get("confirm") is not True or body.get("secondConfirm") is not True:
        raise ActionError(400, "studio.second-confirm-required", "Confirm the exact command and acknowledge the snapshot write")
    if body.get("commandHash") != preview["commandHash"]:
        raise ActionError(409, "studio.stale-preview", "Source bytes or Project state changed; preview again")
    if service.runner.active_job(preview["project"]):
        raise ActionError(409, "studio.busy", "This Project already has an active job")
    for filename, raw in outputs.items():
        target = safe_path(service, str(directory / filename))
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with target.open("xb") as handle:
                handle.write(raw)
        except FileExistsError:
            if target.read_bytes() != raw:
                raise ActionError(409, "studio.stale-preview", "Staging bundle differs from its content identity") from None
    job = service.runner.create(action_id="project.intake", project=preview["project"], argv=preview["argv"],
                                display=preview["display"], command_hash=preview["commandHash"], timeout=120, cwd=str(service.root))
    return {"jobId": job.id, "status": job.status, "commandHash": preview["commandHash"]}
