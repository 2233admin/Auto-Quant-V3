"""Read-only direction and library snapshots for AutoQuant Studio.

Shinka's standalone web UI was removed in the V3 port; Studio
(``autoquant/studio_research.py``) serves these snapshots under
``/api/v1/project/research`` and ``/api/v1/research-library``.

Visibility follows the agent's rules (design.md §7.3): validation-segment
evidence appears only once a hypothesis has a verdict, and lockbox numbers
only exist after ``confirm``. The filtering happens here, so the browser
never receives data it must not show.
"""

from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from . import library, rounds, rundb
from .notebook import (
    NOTEBOOK_FILENAME,
    RESULTS_LOG,
    Hypothesis,
    Notebook,
    experiment_dir,
)
from .skeptic import expected_max_sharpe



def _confined(authority: Path, path: Path) -> Path:
    """``path`` resolved, refused unless it stays inside ``authority``."""
    target = path.resolve()
    try:
        target.relative_to(authority.resolve())
    except ValueError:
        raise PermissionError("Outside the research read scope") from None
    return target


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds")


def _results(root: Path, hid: str, eid: str) -> Path:
    experiments = _confined(root, root / "experiments")
    results = _confined(experiments, experiment_dir(root, hid, eid) / "results")
    for filename in (rundb.DB_FILENAME, rundb.PROMPT_DB_FILENAME):
        _confined(experiments, results / filename)
    return results


# rundb.trials rows: (timestamp, generation, in-sample score or None, program id).
Trial = Tuple[float, int, Optional[float], str]


def _runs(root: Path, nb: Notebook) -> Dict[Tuple[str, str], List[Trial]]:
    """Each experiment's evaluated programs, read once per response, so every
    count, best score and trial point in it comes from the same read even
    while a run is adding programs."""
    return {
        (h.id, e.id): rundb.trials(_results(root, h.id, e.id))
        for h in nb.hypotheses
        for e in h.experiments
    }


def _experiment(root: Path, h: Hypothesis, e, trials: List[Trial]) -> Dict[str, Any]:
    rd = _results(root, h.id, e.id)
    scores = [s for _, _, s, _ in trials if s is not None]
    cost = rundb.run_cost(rd)
    out: Dict[str, Any] = {
        "id": e.id,
        "created": e.created,
        # Counted in the run database, as the skeptic counts trials: the
        # notebook's copy is written only once a run returns.
        "n_evaluated": len(trials),
        "n_probed": e.n_probed,
        "best_is_score": max(scores) if scores else None,
        "spend_usd": cost.recorded_usd,
        "spend_known": cost.known,
        "first_trial": _iso(trials[0][0]) if trials else None,
        "last_trial": _iso(trials[-1][0]) if trials else None,
    }
    if h.verdict is not None:
        out["skeptic"] = e.skeptic
    return out


def _body(root: Path, hid: str) -> str:
    path = _confined(root, root / "hypotheses" / f"{hid}.md")
    return path.read_text(encoding="utf-8") if path.exists() else ""


# The key a run's end event ends with, there so the end is recorded once; it
# means nothing to a reader of the timeline.
_RUN_KEY = re.compile(r",? run [0-9a-f]{32}$")


def _events(root: Path, nb: Notebook, limit: int) -> List[Dict[str, Any]]:
    path = _confined(root, root / RESULTS_LOG)
    if not path.exists():
        return []
    judged = {h.id for h in nb.hypotheses if h.verdict is not None}
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines()[1:][-limit:]:
        time, hid, eid, event, note = (line.split("\t", 4) + [""] * 5)[:5]
        if event in ("run", "run-failed"):
            note = _RUN_KEY.sub("", note)
        # skeptic and verdict notes quote validation figures; a re-run clears
        # the verdict, so an old verdict note must hide again too. The page
        # words the withheld note in the reader's language.
        withheld = event in ("skeptic", "verdict") and hid not in judged
        rows.append(
            {
                "time": time,
                "hypothesis": hid,
                "experiment": eid,
                "event": event,
                "note": None if withheld else note,
                "withheld": withheld,
            }
        )
    return rows[::-1]


def _probes(nb: Notebook) -> int:
    return sum(e.n_probed for h in nb.hypotheses for e in h.experiments)


def _trials(
    nb: Notebook, runs: Dict[Tuple[str, str], List[Trial]]
) -> List[Dict[str, Any]]:
    """Every evaluated program of the direction in time order, with the noise
    bar: the expected best in-sample score of n null strategies, using the
    variance of the direction's in-sample scores (the skeptic's approximation,
    kept in the scores' own annualised units). Probes leave no program row, so
    they are not plotted; the bar counts them all from the start, which keeps
    it at least as high as the skeptic's (it counts every probe too)."""
    probes = _probes(nb)
    rows = [
        (t, g, s, pid, h.id, e.id)
        for h in nb.hypotheses
        for e in h.experiments
        for t, g, s, pid in runs[(h.id, e.id)]
    ]
    rows.sort(key=lambda r: r[0])
    scores = np.array([r[2] for r in rows if r[2] is not None])
    var = float(scores.var(ddof=1)) if len(scores) > 1 else 0.0
    out, best = [], float("-inf")
    for n, (t, g, s, pid, hid, eid) in enumerate(rows, start=1):
        record = s is not None and s > best
        best = s if record else best
        out.append(
            {
                "n": n,
                "time": _iso(t),
                "hypothesis": hid,
                "experiment": eid,
                "generation": g,
                "program": pid,
                "score": s,
                "record": record,
                "bar": expected_max_sharpe(n + probes, var),
            }
        )
    return out


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def library_snapshot(lib: Path) -> Optional[Dict[str, Any]]:
    """The raw -> wiki -> log library, or None before it exists."""
    path = Path(lib).absolute()
    # The library may not relocate outside the directory that owns it.
    lib = _confined(path.parent, path)
    manifest = _confined(lib, lib / library.MANIFEST)
    if not manifest.exists():
        return None
    if not isinstance(json.loads(manifest.read_text(encoding="utf-8")), dict):
        raise ValueError("Library manifest must be an object")
    raw = _confined(lib, lib / "raw")
    _confined(lib, lib / "wiki")
    # pending() hashes these files. Validate its exact read set without changing
    # the library CLI's filesystem semantics or the lexical relative names.
    for path in raw.rglob("*"):
        if path.is_file() and not path.name.startswith("."):
            _confined(lib, path)
    return {
        "index": _read(_confined(lib, lib / "index.md")),
        "log": _read(_confined(lib, lib / "log.md")),
        "pending": library.pending(lib),
        "pages": [
            {"name": name, "text": _read(_confined(lib, lib / "wiki" / f"{name}.md"))}
            for name in library.wiki_pages(lib)
        ],
    }


def snapshot(
    root: Path, events: int = 50, library_dir: Optional[Path] = None
) -> Dict[str, Any]:
    """One direction. ``library_dir`` adds its library; Studio serves the
    Workspace library on its own route and leaves it out."""
    root = Path(root).resolve()
    _confined(root, root / NOTEBOOK_FILENAME)
    nb = Notebook.load(root)
    runs = _runs(root, nb)
    hyps = []
    for h in nb.hypotheses:
        exps = [_experiment(root, h, e, runs[(h.id, e.id)]) for e in h.experiments]
        hyps.append(
            {
                "id": h.id,
                "title": h.title,
                "status": h.status.value,
                "created": h.created,
                "body": _body(root, h.id),
                "experiments": exps,
                "verdict": h.verdict.model_dump(mode="json") if h.verdict else None,
                "confirmation": h.confirmation,
            }
        )
    data = nb.data
    points = _trials(nb, runs)
    probes = _probes(nb)
    return {
        "direction": nb.direction,
        "created": nb.created,
        "budget_usd": nb.budget_usd,
        "spend_usd": sum(e["spend_usd"] for h in hyps for e in h["experiments"]),
        "unknown_cost_runs": sum(
            not e["spend_known"] for h in hyps for e in h["experiments"]
        ),
        # Every evaluated program plus every probe, the programs and probes the
        # skeptic counts for the DSR; a running experiment counts as it goes.
        "trials": len(points) + probes,
        "lockbox": None
        if data is None
        else {
            "opened": data.opened,
            "start": data.lockbox_start,
            "n_total": data.n_total,
            "n_dev": data.n_dev,
        },
        "hypotheses": hyps,
        "trial_points": points,
        "probes": probes,
        "events": _events(root, nb, events),
        "library": None if library_dir is None else library_snapshot(library_dir),
        # The agent's rounds, runs, lockbox approvals and what waits on the
        # owner (research-agent 3.2); it reports what it cannot read.
        "rounds": rounds.overview(root),
    }


def _workspace_root(root: Path) -> Path:
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError(f"Workspace directory does not exist: {root}")
    if (root / NOTEBOOK_FILENAME).exists():
        raise ValueError(
            f"This is a direction directory; pass its workspace: {root.parent}"
        )
    return root


def _direction_root(workspace: Path, direction: str) -> Path:
    """Resolve one directory-name ID, never an arbitrary client-provided path."""
    if (
        not direction
        or direction in {".", ".."}
        or "/" in direction
        or "\\" in direction
        or PureWindowsPath(direction).drive
    ):
        raise FileNotFoundError("Unknown direction")
    root = workspace / direction
    notebook = root / NOTEBOOK_FILENAME
    if root.is_symlink() or notebook.is_symlink():
        raise FileNotFoundError("Unknown direction")
    canonical = root.resolve()
    if (
        canonical != root
        or canonical.parent != workspace
        or not root.is_dir()
        or not notebook.is_file()
    ):
        raise FileNotFoundError("Unknown direction")
    return canonical


def _evidence(root: Path, nb: Notebook, recent: List[Dict[str, Any]]) -> Dict[str, Any]:
    """The overview's per-direction evidence, computed exactly as the direction
    snapshot does so both pages show the same numbers; no held-out figures.
    ``recent`` is the direction's events, newest first."""
    points = _trials(nb, _runs(root, nb))
    scores = [p["score"] for p in points if p["score"] is not None]
    # Trial and log times are both UTC isoformat(timespec="seconds"), so text
    # order is time order.
    times = [points[-1]["time"]] if points else []
    times += [e["time"] for e in recent[:1] if e["time"]]
    return {
        "hypothesis_status": dict(Counter(h.status.value for h in nb.hypotheses)),
        "best_score": max(scores) if scores else None,
        "noise_bar": points[-1]["bar"] if points else None,
        "evaluated_programs": len(points),
        "failed_programs": len(points) - len(scores),
        "last_activity": max(times, default=None),
    }


# The overview's activity column: the newest events across every direction.
WORKSPACE_EVENTS = 30


def workspace_snapshot(root: Path) -> Dict[str, Any]:
    root = _workspace_root(root)
    directions = []
    events: List[Dict[str, Any]] = []
    for child in sorted(root.iterdir()):
        marker = child / NOTEBOOK_FILENAME
        if (
            child.is_symlink()
            or marker.is_symlink()
            or not marker.is_file()
            or child.resolve() != child
        ):
            continue
        try:
            direction = _direction_root(root, child.name)
            nb = Notebook.load(direction)
            costs = [
                rundb.run_cost(_results(direction, h.id, e.id))
                for h in nb.hypotheses
                for e in h.experiments
            ]
            recent = _events(direction, nb, WORKSPACE_EVENTS)
            evidence = _evidence(direction, nb, recent)
            row = {
                "id": child.name,
                "direction": nb.direction,
                "created": nb.created,
                "hypotheses": len(nb.hypotheses),
                # As the direction snapshot counts them.
                "trials": evidence["evaluated_programs"] + _probes(nb),
                "spend_usd": sum(c.recorded_usd for c in costs),
                "unknown_cost_runs": sum(not c.known for c in costs),
                "budget_usd": nb.budget_usd,
                "lockbox_opened": nb.data.opened if nb.data else None,
                "evidence": evidence,
                "rounds": rounds.summary(rounds.overview(direction)),
                "error": None,
            }
        except (OSError, ValueError, sqlite3.Error) as error:
            # The kind of failure only; the page words it in the reader's language.
            directions.append(
                {
                    "id": child.name,
                    "direction": child.name,
                    "error": type(error).__name__,
                }
            )
            continue
        directions.append(row)
        # Same withholding as the direction snapshot: unjudged skeptic and
        # verdict notes never leave the server.
        events += [{**e, "direction": child.name} for e in recent]
    # UTC isoformat(timespec="seconds") times: text order is time order.
    events.sort(key=lambda e: e["time"], reverse=True)
    return {
        "name": root.name,
        "directions": directions,
        "events": events[:WORKSPACE_EVENTS],
        "library": library_snapshot(root / library.LIBRARY_DIRNAME),
    }
