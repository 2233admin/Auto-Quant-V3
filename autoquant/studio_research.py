"""Studio read model of a Project's Shinka research direction and the Workspace library.

A Shinka direction is a Project (``<project>/research/``) and its knowledge
library is Workspace-level (``<workspace>/library/``); see
``docs/shinka-research/PORT.md``. The pages reuse the snapshot builders of
``autoquant/shinka_research/ui.py``, including their visibility filtering, and
add only what V3's rules ask for on top:

- the check ledger is computed here, never in the browser, with the states of
  [[docs/design/hypothesis-and-idea-verdict]] (``pass``, ``fail``, ``n.a.``,
  ``withheld``, ``not-computed``; reference rows are ``info``); a missing PBO
  is ``not-computed``, never a pass;
- while the lockbox is sealed its start date is not sent (visibility rule 6);
- local file paths of programs are not sent.

The research layer is an optional extra. Without it, or without the engine
that reads trial databases, the routes answer ``state: unavailable`` with the
reason instead of failing the page.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlsplit

from .workspace import (
    PROJECT_MANIFEST,
    AutoQuantValidationError,
    ValidationIssue,
    load_project,
    load_workspace,
)

RESEARCH_PATH = "/api/v1/project/research"
LIBRARY_PATH = "/api/v1/research-library"
RESEARCH_KIND = "autoquant-studio-project-research"
LIBRARY_KIND = "autoquant-studio-research-library"
RESEARCH_DIRNAME = "research"
LIBRARY_DIRNAME = "library"
NOTEBOOK = "notebook.json"
# The Shinka demo builder's marker; a converted demo Project keeps it.
DEMO_MARKER = "DEMO_DATA.md"
_PROJECT_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_JUDGED = {"supported", "refuted", "inconclusive", "confirmed", "unconfirmed"}
# Shinka's own defaults (skeptic.Thresholds) for evidence recorded without them.
_DEFAULT_THRESHOLDS = {"dsr_supported": 0.95, "min_positive_fraction": 2 / 3, "max_pbo": 0.5}


def _issue(path: str, code: str, message: str) -> AutoQuantValidationError:
    return AutoQuantValidationError([ValidationIssue(path, code, message)])


def _demo(research: Path) -> str | None:
    """The first non-heading line of the demo marker, or None for real research."""
    marker = research / DEMO_MARKER
    if not marker.is_file() or marker.is_symlink():
        return None
    lines = [line.strip("# ").strip() for line in marker.read_text(encoding="utf-8").splitlines()]
    return next((line for line in lines if line), "synthetic demo data")


# --------------------------------------------------------------------------- list projection


def research_summary(project_root: Path) -> dict[str, Any] | None:
    """What a Project list shows: hypothesis count and states, the latest
    verdict and the lockbox state. Read from ``notebook.json`` alone, so it
    needs neither the optional extra nor the engine. No validation figure is
    in it: a verdict label exists only once Shinka recorded the verdict."""
    research = Path(project_root) / RESEARCH_DIRNAME
    path = research / NOTEBOOK
    if not path.is_file() or path.is_symlink() or research.is_symlink():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        hypotheses = raw.get("hypotheses") or []
        data = raw.get("data") or None
        judged = []
        for h in hypotheses:
            verdict = h.get("verdict")
            if isinstance(verdict, dict):
                label = h.get("status") if h.get("status") in ("confirmed", "unconfirmed") else verdict.get("label")
                judged.append({"hypothesis": h.get("id"), "label": label, "at": verdict.get("created")})
        judged.sort(key=lambda v: v["at"] or "")
        return {
            "state": "ready",
            "direction": raw.get("direction"),
            "hypotheses": len(hypotheses),
            "statusCounts": dict(Counter(str(h.get("status")) for h in hypotheses)),
            "latestVerdict": judged[-1] if judged else None,
            "lockbox": "none" if not data else ("opened" if data.get("opened") else "sealed"),
            "demo": _demo(research),
        }
    except (OSError, ValueError, AttributeError, TypeError):
        return {"state": "invalid", "demo": None}


# --------------------------------------------------------------------------- resolution


def _project_root(directory: str | Path, requested: str | None, project_id: str | None) -> Path:
    if not requested:
        raise _issue("id", "project.id-required", "Query parameter id is required")
    if project_id is not None and requested != project_id:
        raise _issue(requested, "project.unknown", f"Studio is restricted to Project {project_id}")
    if not _PROJECT_ID.fullmatch(requested):
        raise _issue(requested, "project.unknown", f"Unknown Project: {requested}")
    root = Path(directory).expanduser().absolute()
    if (root / PROJECT_MANIFEST).is_file():
        project = load_project(root)
        if project.manifest.id != requested:
            raise _issue(requested, "project.unknown", f"Unknown Project: {requested}")
        return project.root_dir
    candidate = load_workspace(root).projects_dir / requested
    if candidate.is_symlink() or not candidate.is_dir():
        raise _issue(requested, "project.unknown", f"Unknown Project: {requested}")
    return load_project(candidate, expected_id=requested).root_dir


def _unavailable(error: ImportError) -> str:
    return "shinka-engine-missing" if type(error).__name__ == "EngineNotInstalled" else "shinka-extra-missing"


# --------------------------------------------------------------------------- check ledger


def _row(row_id: str, role: str, state: str, value: Any = None, threshold: str | None = None, **extra: Any) -> dict[str, Any]:
    return {"id": row_id, "role": role, "state": state, "value": value, "threshold": threshold, **extra}


def _context(row_id: str, value: Any) -> dict[str, Any]:
    """A reference figure, never a gate: ``info`` with a value, ``n.a.`` without."""
    return _row(row_id, "context", "n.a." if value is None else "info", value)


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _gate(row_id: str, value: float | None, ok: Callable[[float], bool], threshold: str, **extra: Any) -> dict[str, Any]:
    if value is None:
        return _row(row_id, "gate", "not-computed", None, threshold, **extra)
    return _row(row_id, "gate", "pass" if ok(value) else "fail", value, threshold, **extra)


def _lockbox_row(lockbox: dict[str, Any] | None, hypothesis: dict[str, Any]) -> dict[str, Any]:
    confirmation = hypothesis.get("confirmation")
    if isinstance(confirmation, dict) and "passed" in confirmation:
        state = "confirmed" if confirmation.get("passed") else "unconfirmed"
    elif lockbox is None:
        state = "none"
    else:
        state = "opened" if lockbox.get("opened") else "sealed"
    return _row("lockbox", "context", state)


def ledger(hypothesis: dict[str, Any], lockbox: dict[str, Any] | None, frontier: dict[str, Any]) -> list[dict[str, Any]]:
    """The check ledger of one hypothesis, from what the snapshot already
    allows: validation figures only when a verdict exists."""
    verdict = hypothesis.get("verdict")
    if not isinstance(verdict, dict):
        rows = [
            _row(row_id, "gate", "withheld", None, threshold)
            for row_id, threshold in (
                ("validation-sharpe", "> 0"),
                ("beats-buy-hold", "> buy and hold"),
                ("dsr", None),
                ("subperiods", None),
                ("pbo", None),
            )
        ]
        mine = frontier.get("byHypothesis", {}).get(hypothesis["id"])
        rows.append(_context("in-sample-best", mine))
        rows.append(_context("noise-frontier", frontier.get("bar")))
        rows.append(_context("family-trials", frontier.get("trials")))
        rows.append(_lockbox_row(lockbox, hypothesis))
        return rows
    ev = verdict.get("evidence") or {}
    if "dsr" not in ev and "oos_sharpe" not in ev:
        # Another rule kind (reach_target, counterexample, holdout_vs_baseline): its scalar evidence as recorded.
        rows = [
            _context(key, value)
            for key, value in sorted(ev.items())
            if isinstance(value, (int, float, str, bool)) and key not in ("experiment", "program_id", "best_program")
        ]
        rows.append(_lockbox_row(lockbox, hypothesis))
        return rows
    th = {**_DEFAULT_THRESHOLDS, **{k: v for k, v in (ev.get("thresholds") or {}).items() if _num(v) is not None}}
    oos, hold = _num(ev.get("oos_sharpe")), _num(ev.get("baseline_buy_hold_oos_sharpe"))
    return [
        _gate("validation-sharpe", oos, lambda v: v > 0, "> 0"),
        _gate("beats-buy-hold", oos if hold is not None else None, lambda v: v > (hold or 0.0), "> buy and hold", reference=hold),
        _gate("dsr", _num(ev.get("dsr")), lambda v: v >= th["dsr_supported"], f">= {th['dsr_supported']:g}"),
        _gate("subperiods", _num(ev.get("oos_positive_fraction")), lambda v: v >= th["min_positive_fraction"], f">= {th['min_positive_fraction']:.3g}"),
        _gate("pbo", _num(ev.get("pbo")), lambda v: v <= th["max_pbo"], f"<= {th['max_pbo']:g}"),
        _context("in-sample-sharpe", _num(ev.get("is_sharpe"))),
        _context("noise-frontier", _num(ev.get("expected_max_sharpe_annual"))),
        _context("family-trials", _num(ev.get("n_trials"))),
        _context("seed-baseline", _num(ev.get("baseline_seed_oos_sharpe"))),
        _context("decay", _num(ev.get("decay"))),
        _lockbox_row(lockbox, hypothesis),
    ]


# --------------------------------------------------------------------------- project research


def _strip_paths(evidence: Any) -> Any:
    if isinstance(evidence, dict):
        return {k: _strip_paths(v) for k, v in evidence.items() if k not in ("best_program", "data_path", "dev_path")}
    return evidence


def _frontier(snapshot: dict[str, Any]) -> dict[str, Any]:
    """The chart's summary line, read from the Core-computed trial points."""
    points = snapshot["trial_points"]
    scores = [p["score"] for p in points if p["score"] is not None]
    by_hypothesis: dict[str, float] = {}
    for p in points:
        if p["score"] is not None:
            by_hypothesis[p["hypothesis"]] = max(p["score"], by_hypothesis.get(p["hypothesis"], p["score"]))
    best = max(scores) if scores else None
    bar = points[-1]["bar"] if points else None
    return {
        "trials": snapshot["trials"],
        "programs": len(points),
        "failed": len(points) - len(scores),
        "probes": snapshot["probes"],
        "best": best,
        "bar": None if bar is None else float(bar),
        "gap": None if best is None or bar is None else float(best - bar),
        "clears": None if best is None or bar is None else bool(best > bar),
        "byHypothesis": by_hypothesis,
    }


def _plans(research: Path) -> dict[tuple[str, str], dict[str, Any]]:
    from .shinka_research.notebook import Notebook

    out = {}
    for h in Notebook.load(research).hypotheses:
        for e in h.experiments:
            plan = e.plan
            out[(h.id, e.id)] = {
                "evaluatorHash": e.evaluator_hash,
                "dataHash": e.data_hash,
                "plan": None
                if plan is None
                else {"domain": plan.domain, "claim": plan.claim, "rationale": plan.rationale, "rule": plan.rule.model_dump(mode="json")},
            }
    return out


def project_research(research: Path) -> dict[str, Any]:
    """One direction's page payload (requires the ``shinka`` extra)."""
    from .shinka_research import ui

    snapshot = ui.snapshot(research)
    snapshot.pop("library", None)
    lockbox = snapshot.get("lockbox")
    if isinstance(lockbox, dict) and not lockbox.get("opened"):
        # Visibility rule 6: no tail date while the lockbox is sealed.
        lockbox.pop("start", None)
    frontier = _frontier(snapshot)
    plans = _plans(research)
    for h in snapshot["hypotheses"]:
        if h.get("verdict"):
            h["verdict"]["evidence"] = _strip_paths(h["verdict"].get("evidence"))
        for e in h["experiments"]:
            if "skeptic" in e:
                e["skeptic"] = _strip_paths(e["skeptic"])
            e.update(plans.get((h["id"], e["id"]), {}))
        h["ledger"] = ledger(h, lockbox, frontier)
    snapshot["frontier"] = frontier
    return snapshot


def build_project_research(
    directory: str | Path, requested: str | None, *, project_id: str | None = None
) -> dict[str, Any]:
    from .studio import SCHEMA_VERSION

    root = _project_root(directory, requested, project_id)
    research = root / RESEARCH_DIRNAME
    payload: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": RESEARCH_KIND,
        "projectId": requested,
        "state": "none",
        "reason": None,
        "demo": None,
        "research": None,
    }
    if research.is_symlink() or not (research / NOTEBOOK).is_file():
        return payload
    payload["demo"] = _demo(research)
    try:
        payload["research"] = project_research(research)
    except ImportError as error:
        payload.update(state="unavailable", reason=_unavailable(error))
        return payload
    payload["state"] = "ready"
    return payload


# --------------------------------------------------------------------------- workspace library


def build_research_library(directory: str | Path, *, project_id: str | None = None) -> dict[str, Any]:
    from .studio import SCHEMA_VERSION

    payload: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": LIBRARY_KIND,
        "state": "none",
        "reason": None,
        "library": None,
    }
    root = Path(directory).expanduser().absolute()
    if (root / PROJECT_MANIFEST).is_file():
        # A single-Project Studio has no Workspace, so no Workspace library.
        payload["reason"] = "project-scope"
        return payload
    workspace = load_workspace(root).root_dir
    lib = workspace / LIBRARY_DIRNAME
    try:
        from .shinka_research import library, ui

        snapshot = ui.library_snapshot(lib)
        if snapshot is None:
            return payload
        sources = library.sources(lib)
        snapshot["findings"] = library.finding_pages(lib)
        snapshot["sources"] = {
            "agent": sources.agent,
            "human": sources.human,
            "unrecorded": sources.unrecorded,
            "lastAdded": sources.last_added,
        }
        snapshot["demo"] = _demo(lib)
    except ImportError as error:
        payload.update(state="unavailable", reason=_unavailable(error))
        return payload
    payload.update(state="ready", library=snapshot)
    return payload


# --------------------------------------------------------------------------- routes


def serve_research(handler: Any, path: str, directory: Path, project_id: str | None, head_only: bool) -> bool:
    """GET-only routes beside the Project route, sharing its fingerprint
    cache, ETag and 304 handling (``StudioHandler._cached``)."""
    if path == RESEARCH_PATH:
        ids = parse_qs(urlsplit(handler.path).query).get("id") or []
        requested = ids[0] if len(ids) == 1 else None
        scope = requested if requested and _PROJECT_ID.fullmatch(requested) else None
        handler._cached(
            ("project-research", requested),
            scope,
            lambda: build_project_research(directory, requested, project_id=project_id),
            head_only,
        )
        return True
    if path == LIBRARY_PATH:
        handler._cached(
            "research-library",
            None,
            lambda: build_research_library(directory, project_id=project_id),
            head_only,
        )
        return True
    return False
