"""Studio read model of one Shinka experiment's evolution run.

Replaces the fork's analysis server (``shinka.webui.visualization`` behind
``aq shinka ui``), which was removed with the standalone UI: the same content
is read straight from the experiment's ``results/`` directory inside
``<project>/research/`` and served read-only beside the Project route.

- Programs and program details come from the engine's own read-only
  ``ProgramDatabase(read_only=True)`` (``get_programs_summary``, ``get``) and
  prompt versions from ``SystemPromptDatabase(read_only=True)``; both open a
  quoted ``mode=ro`` URI, so literal URI characters in a path are safe. Run
  totals use ``rundb.run_cost``, the research layer's one cost rule. The
  engine's HTTP handler is not used.
- Visibility follows the fork's server, which never opted into private
  metrics: ``private_metrics`` hold held-out (validation) evidence and are
  never sent, only whether the run recorded some. Paths are confined to the
  Project's ``research/`` directory; no absolute path is sent.
- Every series (per-generation best, mean, success rate, cost, stage
  durations) is computed here; the browser draws.

Without the ``shinka`` extra or the engine, routes answer ``state: unavailable``.
"""

from __future__ import annotations

import json
import re
import statistics
from contextlib import closing
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlsplit

from .studio_research import NOTEBOOK, RESEARCH_DIRNAME, _demo, _issue, _project_root, _unavailable

RUN_PATH = "/api/v1/project/research/run"
PROGRAM_PATH = "/api/v1/project/research/program"
PROMPT_PATH = "/api/v1/project/research/prompt"
META_PATH = "/api/v1/project/research/meta"
RUN_KIND = "autoquant-studio-evolution-run"
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_PROGRAM_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")
_COSTS = ("api_costs", "embed_cost", "novelty_cost", "meta_cost")
_STAGES = ("sampling_seconds", "evaluation_seconds", "postprocess_seconds", "pipeline_seconds")
_TAIL = 4000


# --------------------------------------------------------------------------- resolution


def _results(directory: Path, query: dict[str, list[str]], project_id: str | None) -> tuple[Path, str, str, str]:
    """``results/`` of experiment ``e`` of hypothesis ``h`` in Project ``id``, confined to its research directory."""

    def one(key: str) -> str | None:
        values = query.get(key) or []
        return values[0] if len(values) == 1 else None

    requested, hid, eid = one("id"), one("h"), one("e")
    root = _project_root(directory, requested, project_id)
    research = root / RESEARCH_DIRNAME
    if not hid or not eid or not _ID.fullmatch(hid) or not _ID.fullmatch(eid):
        raise _issue("h,e", "research.experiment-required", "Query parameters h and e name one experiment")
    try:
        notebook = json.loads((research / NOTEBOOK).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise _issue(requested or "", "research.none", "This Project has no research direction") from None
    known = {(h.get("id"), e.get("id")) for h in notebook.get("hypotheses") or [] for e in h.get("experiments") or []}
    if (hid, eid) not in known:
        raise _issue(f"{hid}/{eid}", "research.experiment-unknown", f"Unknown experiment: {hid}/{eid}")
    results = research / "experiments" / hid / eid / "results"
    resolved = results.resolve()
    if research.is_symlink() or not resolved.is_relative_to(research.resolve()):
        raise _issue(f"{hid}/{eid}", "research.outside", "Experiment results must stay inside research/")
    return resolved, requested or "", hid, eid


def _envelope(requested: str, hid: str, eid: str, research: Path) -> dict[str, Any]:
    from .studio import SCHEMA_VERSION

    return {
        "schemaVersion": SCHEMA_VERSION,
        "kind": RUN_KIND,
        "projectId": requested,
        "hypothesis": hid,
        "experiment": eid,
        "state": "none",
        "reason": None,
        "demo": _demo(research),
    }


def _engine():
    from .shinka_research._engine import require_engine

    return require_engine("shinka.database"), require_engine("shinka.database.prompt_dbase")


def _programs_db(results: Path):
    database, _ = _engine()
    return closing(database.ProgramDatabase(database.DatabaseConfig(db_path=str(results / "programs.sqlite")), read_only=True))


# --------------------------------------------------------------------------- shaping


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _cost(meta: dict[str, Any]) -> float:
    return sum(_number(meta.get(key)) or 0.0 for key in _COSTS)


def _lean(row: dict[str, Any]) -> dict[str, Any]:
    """One program as every view lists it; never its private metrics."""
    meta = row.get("metadata") or {}
    correct = bool(row.get("correct"))
    return {
        "id": str(row.get("id")),
        "parent": row.get("parent_id"),
        "generation": int(row.get("generation") or 0),
        "timestamp": _number(row.get("timestamp")),
        "score": _number(row.get("combined_score")) if correct else None,
        "correct": correct,
        "island": row.get("island_idx"),
        "children": int(row.get("children_count") or 0),
        "archive": bool(row.get("in_archive")),
        "copy": bool(meta.get("_is_island_copy") or meta.get("_spawned_island")),
        "patchType": meta.get("patch_type"),
        "patchName": meta.get("patch_name"),
        "model": meta.get("model_name") or meta.get("model"),
        "cost": _cost(meta),
    }


def _generations(programs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Per generation: programs, valid programs, best and mean valid score, the
    running best, success rate and cost (island copies excluded, as in trial counts)."""
    by: dict[int, list[dict[str, Any]]] = {}
    for p in programs:
        if not p["copy"]:
            by.setdefault(p["generation"], []).append(p)
    rows, record, spent = [], None, 0.0
    for g in sorted(by):
        scores = [p["score"] for p in by[g] if p["score"] is not None]
        best = max(scores) if scores else None
        record = best if record is None or (best is not None and best > record) else record
        cost = sum(p["cost"] for p in by[g])
        spent += cost
        rows.append(
            {
                "generation": g,
                "programs": len(by[g]),
                "correct": len(scores),
                "successRate": len(scores) / len(by[g]),
                "best": best,
                "mean": statistics.fmean(scores) if scores else None,
                "record": record,
                "cost": cost,
                "cumulativeCost": spent,
            }
        )
    return rows


def _best_path(programs: list[dict[str, Any]]) -> list[str]:
    """Ancestry of the first program at the highest valid score, root first."""
    valid = [p for p in programs if p["score"] is not None]
    if not valid:
        return []
    top = max(p["score"] for p in valid)
    best = min((p for p in valid if p["score"] == top), key=lambda p: (p["generation"], p["timestamp"] or 0))
    by_id = {p["id"]: p for p in programs}
    path, seen, node = [], set(), best
    while node is not None and node["id"] not in seen:
        seen.add(node["id"])
        path.insert(0, node["id"])
        node = by_id.get(node["parent"]) if node["parent"] else None
    return path


def _quantile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[max(0, min(len(ordered) - 1, int(round(q * (len(ordered) - 1)))))]


def _throughput(rows: list[dict[str, Any]], programs: list[dict[str, Any]]) -> dict[str, Any]:
    """Stage durations (p50/p95/max seconds) and completions per hour of wall time."""
    stages = []
    for stage in _STAGES:
        values = [v for r in rows if (v := _number((r.get("metadata") or {}).get(stage))) is not None]
        if values:
            stages.append({"stage": stage.removesuffix("_seconds"), "p50": _quantile(values, 0.5), "p95": _quantile(values, 0.95), "max": max(values), "n": len(values)})
    times = [p["timestamp"] for p in programs if p["timestamp"] is not None and not p["copy"]]
    hours = (max(times) - min(times)) / 3600 if len(times) > 1 else None
    return {
        "stages": stages,
        "wallHours": hours,
        "perHour": (len(times) / hours) if hours else None,
    }


def _prompts(results: Path) -> list[dict[str, Any]]:
    if not (results / "prompts.sqlite").is_file():
        return []
    _, prompt_dbase = _engine()
    config = prompt_dbase.SystemPromptConfig(db_path=str(results / "prompts.sqlite"))
    with closing(prompt_dbase.SystemPromptDatabase(config, read_only=True)) as db:
        prompts = [p.to_dict() for p in db.get_all_prompts()]
    keys = ("id", "parent_id", "name", "description", "generation", "patch_type", "program_count", "correct_program_count", "fitness", "total_improvement", "in_archive")
    return [{k: p.get(k) for k in keys} for p in prompts]


def _meta_files(results: Path) -> list[int]:
    meta = results / "meta"
    if not meta.is_dir() or meta.is_symlink():
        return []
    return sorted(int(f.name[5:-4]) for f in meta.glob("meta_*.txt") if f.name[5:-4].isdigit() and not f.is_symlink())


# --------------------------------------------------------------------------- payloads


def _guarded(directory: Path, query: dict[str, list[str]], project_id: str | None, build: Callable[[Path, dict[str, Any]], None]) -> dict[str, Any]:
    results, requested, hid, eid = _results(directory, query, project_id)
    payload = _envelope(requested, hid, eid, results.parents[3])
    if not (results / "programs.sqlite").is_file():
        return payload
    try:
        build(results, payload)
    except ImportError as error:
        payload.update(state="unavailable", reason=_unavailable(error))
        return payload
    payload["state"] = "ready"
    return payload


def build_run(directory: Path, query: dict[str, list[str]], project_id: str | None = None) -> dict[str, Any]:
    def fill(results: Path, payload: dict[str, Any]) -> None:
        from .shinka_research import rundb

        with _programs_db(results) as db:
            rows = db.get_programs_summary()
        programs = sorted((_lean(r) for r in rows), key=lambda p: (p["generation"], p["timestamp"] or 0))
        valid = [p for p in programs if p["score"] is not None]
        generations = _generations(programs)
        best = max(valid, key=lambda p: p["score"]) if valid else None
        cost = rundb.run_cost(results)
        payload.update(
            programs=programs,
            generations=generations,
            bestPath=_best_path(programs),
            prompts=_prompts(results),
            metaFiles=_meta_files(results),
            throughput=_throughput(rows, programs),
            privateMetrics="hidden" if any(r.get("private_metrics") for r in rows) else "none",
            stats={
                "programs": sum(not p["copy"] for p in programs),
                "correct": sum(not p["copy"] for p in valid),
                "successRate": (sum(not p["copy"] for p in valid) / max(1, sum(not p["copy"] for p in programs))),
                "best": best["score"] if best else None,
                "bestGeneration": best["generation"] if best else None,
                "maxGeneration": generations[-1]["generation"] if generations else None,
                "sinceImprovement": (generations[-1]["generation"] - best["generation"]) if best and generations else None,
                "costUsd": cost.recorded_usd,
                "costKnown": cost.known,
                "promptCostUsd": cost.prompts_usd,
            },
        )

    return _guarded(directory, query, project_id, fill)


def _tail(value: Any) -> str | None:
    return None if not value else str(value)[-_TAIL:]


def build_program(directory: Path, query: dict[str, list[str]], project_id: str | None = None) -> dict[str, Any]:
    ids = query.get("program") or []
    program_id = ids[0] if len(ids) == 1 else ""
    if not _PROGRAM_ID.fullmatch(program_id):
        raise _issue("program", "research.program-required", "Query parameter program names one program")

    def fill(results: Path, payload: dict[str, Any]) -> None:
        with _programs_db(results) as db:
            found = db.get(program_id)
            rows = db.get_programs_summary()
        if found is None:
            raise _issue(program_id, "research.program-unknown", f"Unknown program: {program_id}")
        full = found.to_dict()
        meta = full.get("metadata") or {}
        lean = {r["id"]: _lean(r) for r in rows}
        me = _lean(full)
        payload["program"] = {
            **me,
            "language": full.get("language"),
            "code": full.get("code") or None,
            "diff": full.get("code_diff") or None,
            "feedback": full.get("text_feedback") or None,
            "publicMetrics": full.get("public_metrics") or {},
            "privateMetrics": "hidden" if full.get("private_metrics") else "none",
            "description": meta.get("patch_description"),
            "thought": _tail(meta.get("thought")),
            "stdout": _tail(meta.get("stdout_log")),
            "stderr": _tail(meta.get("stderr_log")),
            "failure": meta.get("failure_reason"),
            "timings": {s.removesuffix("_seconds"): _number(meta.get(s)) for s in _STAGES if _number(meta.get(s)) is not None},
            "systemPrompt": full.get("system_prompt_id"),
        }
        payload["parent"] = lean.get(me["parent"]) if me["parent"] else None
        payload["offspring"] = sorted((p for p in lean.values() if p["parent"] == program_id), key=lambda p: (p["generation"], p["timestamp"] or 0))

    return _guarded(directory, query, project_id, fill)


def build_prompt(directory: Path, query: dict[str, list[str]], project_id: str | None = None) -> dict[str, Any]:
    ids = query.get("prompt") or []
    prompt_id = ids[0] if len(ids) == 1 else ""
    if not _PROGRAM_ID.fullmatch(prompt_id):
        raise _issue("prompt", "research.prompt-required", "Query parameter prompt names one prompt version")

    def fill(results: Path, payload: dict[str, Any]) -> None:
        _, prompt_dbase = _engine()
        if not (results / "prompts.sqlite").is_file():
            raise _issue(prompt_id, "research.prompt-unknown", "This run has no prompt versions")
        config = prompt_dbase.SystemPromptConfig(db_path=str(results / "prompts.sqlite"))
        with closing(prompt_dbase.SystemPromptDatabase(config, read_only=True)) as db:
            found = next((p.to_dict() for p in db.get_all_prompts() if p.id == prompt_id), None)
        if found is None:
            raise _issue(prompt_id, "research.prompt-unknown", f"Unknown prompt version: {prompt_id}")
        payload["prompt"] = {"id": prompt_id, "name": found.get("name"), "text": found.get("prompt_text")}

    return _guarded(directory, query, project_id, fill)


def build_meta(directory: Path, query: dict[str, list[str]], project_id: str | None = None) -> dict[str, Any]:
    counts = query.get("n") or []
    count = counts[0] if len(counts) == 1 else ""
    if not count.isdigit():
        raise _issue("n", "research.meta-required", "Query parameter n names one meta-analysis file")

    def fill(results: Path, payload: dict[str, Any]) -> None:
        meta = results / "meta" / f"meta_{int(count)}.txt"
        if meta.is_symlink() or not meta.is_file() or not meta.resolve().is_relative_to(results):
            raise _issue(count, "research.meta-unknown", f"No meta-analysis file for {count} programs")
        payload["meta"] = {"processedCount": int(count), "text": meta.read_text(encoding="utf-8")}

    return _guarded(directory, query, project_id, fill)


def experiment_curves(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Running best in-sample score by generation for each experiment of a
    direction (the trial points' own scores), for the direction's comparison."""
    curves: dict[tuple[str, str], dict[int, float]] = {}
    for p in points:
        if p.get("score") is None:
            continue
        by_gen = curves.setdefault((p["hypothesis"], p["experiment"]), {})
        by_gen[p["generation"]] = max(p["score"], by_gen.get(p["generation"], p["score"]))
    out = []
    for (hid, eid), by_gen in sorted(curves.items()):
        record, steps = None, []
        for g in sorted(by_gen):
            record = by_gen[g] if record is None else max(record, by_gen[g])
            steps.append([g, record])
        out.append({"hypothesis": hid, "experiment": eid, "steps": steps})
    return out


_ROUTES = {RUN_PATH: build_run, PROGRAM_PATH: build_program, PROMPT_PATH: build_prompt, META_PATH: build_meta}


def serve_evolution(handler: Any, path: str, directory: Path, project_id: str | None, head_only: bool) -> bool:
    """GET-only evolution routes sharing the Project route's fingerprint cache, ETag and 304."""
    build = _ROUTES.get(path)
    if build is None:
        return False
    query = parse_qs(urlsplit(handler.path).query)
    key = tuple((k, tuple(v)) for k, v in sorted(query.items()))
    requested = (query.get("id") or [None])[0]
    scope = requested if requested and _ID.fullmatch(requested) and "." not in requested else None
    handler._cached(("evolution", path, key), scope, lambda: build(directory, query, project_id), head_only)
    return True
