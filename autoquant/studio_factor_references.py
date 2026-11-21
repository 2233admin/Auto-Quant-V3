"""Read-only library projection for Project reference factors and their decision evidence."""

from __future__ import annotations

import csv
import io
import json
import math
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from .runs import load_run
from .studio_actions import ActionError, _is_link, confine_workspace_path
from .workspace import AutoQuantValidationError


_REPLAY_STUDY = "kit-confirmation"
_MAX_REPLAY_ROWS = 100
_REFERENCE_FIELDS = ("id", "name", "formula", "direction", "evidence", "source")
_REFERENCE_TEXT = ("market", "evidenceUniverse", "meaning", "usage")


def _reference_replay(project, run_id):
    run = load_run(project, run_id)
    result = run.result
    artifact = "artifacts/daily.csv"
    if (
        result["status"] != "succeeded"
        or result["project"]["id"] != project.manifest.id
        or result["study"]["id"] != _REPLAY_STUDY
        or (result["subject"]["kind"], result["subject"]["name"])
        != ("research", _REPLAY_STUDY)
        or result["execution"].get("evaluationRole") != "research-selection"
        or artifact not in run.manifest["files"]
    ):
        return None
    metrics = result["metrics"]
    keys = ("dates", "cash_dates", "score", "versus_same_exposure_bp")
    if any(
        type(metrics.get(key)) not in (int, float) or not math.isfinite(metrics[key])
        for key in keys
    ):
        return None
    path = run.root_dir / artifact
    if _is_link(path) or _is_link(path.parent) or path.stat().st_size > 32_768:
        return None
    daily = _reference_decisions(path.read_text(encoding="utf-8"))
    if (
        not daily
        or len(daily) != metrics["dates"]
        or sum(row["cash"] for row in daily) != metrics["cash_dates"]
    ):
        return None
    return {
        "runId": run_id,
        "dates": metrics["dates"],
        "triggered": metrics["cash_dates"],
        "versusMomentumBp": metrics["score"],
        "versusSameExposureBp": metrics["versus_same_exposure_bp"],
        "daily": daily,
    }


def _reference_decisions(text):
    arms = ("momentum", "kit", "control")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames != ["day", "first", "second", "cash", *arms]:
        return []
    daily, dates = [], set()
    for row in reader:
        if len(daily) == _MAX_REPLAY_ROWS or None in row or None in row.values():
            return []
        day = row["day"]
        first, second = row["first"], row["second"]
        if (
            date.fromisoformat(day).isoformat() != day
            or day in dates
            or not first.strip()
            or not second.strip()
            or first == second
            or row["cash"] not in ("True", "False")
        ):
            return []
        values = {key: float(row[key]) for key in arms}
        if not all(math.isfinite(value) for value in values.values()):
            return []
        dates.add(day)
        daily.append(
            {
                "day": day,
                "first": first,
                "second": second,
                "cash": row["cash"] == "True",
                **values,
            }
        )
    return daily


def _reference_text(value):
    return isinstance(value, str) and 0 < len(value.strip()) <= 1000


def _reference_url(value):
    if not _reference_text(value):
        return False
    target = urlsplit(value)
    return target.scheme == "https" and target.hostname and target.username is None


def _reference_entry(row):
    if (
        not isinstance(row, dict)
        or not all(_reference_text(row.get(key)) for key in _REFERENCE_FIELDS)
        or row["direction"] not in ("higher", "lower", "diagnostic")
        or not _reference_url(row["source"])
    ):
        raise ValueError("Invalid factor reference")
    entry = {key: row[key] for key in _REFERENCE_FIELDS}
    for key in _REFERENCE_TEXT:
        if key in row:
            if not _reference_text(row[key]):
                raise ValueError("Invalid factor reference text")
            entry[key] = row[key]
    for key in ("tags", "plannedUniverses"):
        if key in row:
            if (
                not isinstance(row[key], list)
                or len(row[key]) > 10
                or not all(map(_reference_text, row[key]))
            ):
                raise ValueError("Invalid factor reference labels")
            entry[key] = row[key]
    if "strategyUrl" in row:
        if not _reference_url(row["strategyUrl"]):
            raise ValueError("Invalid strategy reference URL")
        entry["strategyUrl"] = row["strategyUrl"]
    if "strategyUses" in row:
        uses = row["strategyUses"]
        if (
            not isinstance(uses, list)
            or not 0 < len(uses) <= 8
            or not all(
                isinstance(use, dict)
                and set(use) in ({"name", "rule"}, {"id", "name", "rule"})
                and all(map(_reference_text, use.values()))
                for use in uses
            )
        ):
            raise ValueError("Invalid strategy uses")
        entry["strategyUses"] = uses
    return entry


def factor_references(project, runs):
    relative = Path(project.manifest.directories["factors"]) / "references.json"
    path = project.root_dir / relative
    try:
        if any(
            _is_link(p)
            for p in (path, *path.parents)
            if p.is_relative_to(project.root_dir)
        ):
            raise ValueError("Factor references must be local files")
        if not path.exists():
            return None
        path = confine_workspace_path(
            project.root_dir, str(relative), "factor references"
        )
        if not path.is_file() or path.stat().st_size > 512_000:
            raise ValueError("Invalid factor reference file")
        data = json.loads(path.read_text(encoding="utf-8"))
        if (
            not isinstance(data, dict)
            or type(data.get("schemaVersion")) is not int
            or data["schemaVersion"] != 1
        ):
            raise ValueError("Unknown factor reference schema")
        rows = data.get("factors")
        if not isinstance(rows, list) or len(rows) > 100:
            raise ValueError("Invalid factor reference list")
        entries, replays = {}, {}
        known = {
            r["id"]
            for r in runs
            if r["status"] == "succeeded" and r["studyId"] == _REPLAY_STUDY
        }
        for row in rows:
            entry = _reference_entry(row)
            if entry["id"] in entries:
                raise ValueError("Duplicate factor reference ID")
            entries[entry["id"]] = entry
            if "replayRun" not in row:
                continue
            run_id = row["replayRun"]
            if not isinstance(run_id, str) or not re.fullmatch(
                r"run-[A-Za-z0-9-]{1,90}", run_id
            ):
                raise ValueError("Invalid replay ID")
            if run_id in known:
                if run_id not in replays:
                    try:
                        replays[run_id] = _reference_replay(project, run_id)
                    except (
                        AutoQuantValidationError,
                        OSError,
                        ValueError,
                        OverflowError,
                        csv.Error,
                    ):
                        replays[run_id] = None
                if replays[run_id] is not None:
                    entry["replay"] = replays[run_id]
        return {"factors": list(entries.values()), "invalid": False}
    except (ActionError, AutoQuantValidationError, OSError, ValueError):
        return {"factors": [], "invalid": True}
