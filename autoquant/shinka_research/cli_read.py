"""`aq shinka` library, brief, status and watch commands."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional


from autoquant.shinka_research import grants, library
from autoquant.shinka_research.notebook import (
    RESULTS_LOG,
    DataSplit,
    Notebook,
    experiment_dir,
)
from autoquant.shinka_research.rundb import count_evaluated
from autoquant.shinka_research.skeptic import (
    trial_count,
)
from autoquant.shinka_research.rounds import direction_spend, news, overview
from autoquant.shinka_research.runs import (
    watch,
)
from autoquant.shinka_research.state import (
    atomic_write_text,
    live_work,
    read_text,
)
from autoquant.shinka_research.cli_common import _rule_name


def _library(args: argparse.Namespace) -> Path:
    """The library ``project.library_for`` resolved for the command."""
    return library.ensure(args.library)


def cmd_library_add(args: argparse.Namespace) -> None:
    lib = _library(args)
    by = "agent" if grants.in_agent_env() else "human"
    for source in args.sources:
        print(library.add(lib, source, by).relative_to(lib).as_posix())


def cmd_library_pending(args: argparse.Namespace) -> None:
    for rel in library.pending(_library(args)):
        print(rel)


def cmd_library_compiled(args: argparse.Namespace) -> None:
    lib = _library(args)
    rels = library.pending(lib) if args.all else args.files
    library.mark_compiled(lib, rels)
    print(f"{len(rels)} marked compiled")


def cmd_library_log(args: argparse.Namespace) -> None:
    library.log(_library(args), args.kind, args.text)


def _evidence(h) -> str:
    ev = h.verdict.evidence if h.verdict else {}
    keys = (("is_sharpe", "IS"), ("oos_sharpe", "val"), ("dsr", "DSR"), ("pbo", "PBO"))
    parts = [
        f"{label} {ev[k]:.2f}" for k, label in keys if isinstance(ev.get(k), float)
    ]
    return ", ".join(parts)


def _lockbox(split: DataSplit) -> str:
    if split.unfinished:
        return "OPENED, confirmation unfinished (confirm --yes finishes it)"
    return "OPENED" if split.opened else "sealed"


def _sources_line(lib: Path) -> str:
    """Where the library's knowledge comes from: only shown, never enforced."""
    src = library.sources(lib)
    added = f"{src.agent} added by the agent, {src.human} by people"
    if src.unrecorded:
        added += f", {src.unrecorded} with no recorded origin"
    last = f"last added {src.last_added}" if src.last_added else "none added yet"
    pages = len(library.wiki_pages(lib))
    findings = len(library.finding_pages(lib))
    return f"- Sources: {added}; {last}; {findings} of {pages} wiki pages are findings"


def cmd_brief(args: argparse.Namespace) -> None:
    """Digest for the researcher agent before proposing the next round. With
    ``--since``, it also lists the news that consumer has not read and marks it
    read, after printing it."""
    root = Path(args.dir)
    nb = Notebook.load(root)
    fresh, cursor = news(root, _seen(root, args.since)) if args.since else ([], None)
    lib = args.target.library
    spent, known = direction_spend(root, nb, live_work(root))
    budget = f" of ${nb.budget_usd:.2f}" if nb.budget_usd is not None else ""
    out = [f"# Brief: {nb.direction}", ""]
    trials = trial_count(root, nb)
    out.append(f"- Trials so far: {trials} (raise the bar for 'supported')")
    out.append(f"- LLM spend: {'' if known else '>='}${spent:.2f}{budget}")
    if nb.data:
        out.append(f"- Lockbox: {_lockbox(nb.data)} (from {nb.data.lockbox_start})")
    pend = library.pending(lib) if lib.exists() else []
    out.append(
        f"- Library: {len(library.wiki_pages(lib))} wiki pages, "
        f"{len(pend)} raw sources not compiled yet ({lib})"
    )
    out.append(_sources_line(lib))
    if args.since:
        out += ["", f"## News since the last brief ({args.since})", ""]
        out += [f"- {_news_line(row)}" for row in fresh] or ["(none)"]
    out += ["", "## Hypotheses", ""]
    if not nb.hypotheses:
        out.append("(none yet)")
    for h in nb.hypotheses:
        line = f"- {h.id} [{h.status.value}] {h.title}"
        if h.verdict:
            line += f" — {h.verdict.reason}"
            ev = _evidence(h)
            if ev:
                line += f" ({ev})"
        out.append(line)
    # The same reading of the rounds the workbench shows.
    view = overview(root)
    out += ["", f"## Agent rounds ({view['state']})", ""]
    for r in view["grants"]:
        out.append(
            f"- {r['id']}: {' '.join(r['hypotheses'])}, {r['used']} of "
            f"{r['attempts']} attempts taken, each stops at ${r['max_cost']:g}"
        )
    for item in view["pending"]:
        about = ", ".join(
            f"{key} {' '.join(value) if isinstance(value, list) else value}"
            for key, value in item.items()
            if key not in ("kind", "do") and value is not None
        )
        out.append(
            f"- pending {item['kind']}{f' ({about})' if about else ''}: {item['do']}"
        )
    if not view["grants"] and not view["pending"]:
        out.append("(no round granted yet)")
    log_path = root / RESULTS_LOG
    if log_path.exists():
        recent = log_path.read_text().splitlines()[1:][-args.recent :]
        out += ["", f"## Last {len(recent)} events ({RESULTS_LOG})", ""]
        out += [f"    {line}" for line in recent]
    print("\n".join(out))
    if args.since:
        # Only once printed: a brief that never reached its reader leaves the
        # news unread, so the next watch reports it again.
        seen = _seen_path(root, args.since)
        seen.parent.mkdir(exist_ok=True)
        atomic_write_text(seen, json.dumps(cursor))


# Each news consumer's cursor into the run log (`brief --since NAME`).
WATCH_DIR = ".watch"


def _consumer(name: str) -> str:
    """A news consumer's name, which names its cursor file."""
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", name):
        raise argparse.ArgumentTypeError(
            f"{name!r}: use lowercase letters, digits and dashes, e.g. terminal"
        )
    return name


def _seen_path(root: Path, name: str) -> Path:
    return Path(root) / WATCH_DIR / f"{name}.json"


def _seen(root: Path, name: str) -> Optional[Dict[str, Any]]:
    """A consumer's cursor: none when it has not read any yet, or when its
    file is not a cursor (repeats news rather than hiding it; the next brief
    rewrites it). Any other read error propagates: reported as news it would
    wake the agent on every tick, while as a failure it reaches the job's
    failure handling."""
    try:
        cursor = json.loads(read_text(_seen_path(root, name)))
    except (FileNotFoundError, ValueError):
        return None
    return cursor if isinstance(cursor, dict) else None


def _news_line(row: str) -> str:
    time, hid, eid, event, note = (row.split("\t") + [""] * 5)[:5]
    return f"{time} {event}" + (f" {hid}/{eid}" if hid else "") + f": {note}"


def _evaluated(root: Path, hid: str, eid: str) -> int:
    return count_evaluated(experiment_dir(root, hid, eid) / "results")


def cmd_status(args: argparse.Namespace) -> None:
    root = Path(args.dir)
    nb = Notebook.load(root)
    print(f"Direction: {nb.direction}")
    print(f"Total trials: {trial_count(root, nb)}")
    if nb.data:
        print(
            f"Lockbox: {_lockbox(nb.data)} (from {nb.data.lockbox_start}, "
            f"{nb.data.n_total - nb.data.n_dev} of {nb.data.n_total} bars)"
        )
    for h in nb.hypotheses:
        counts = [
            f"{e.id}({_evaluated(root, h.id, e.id)}, {_rule_name(e)})"
            for e in h.experiments
        ]
        exps = ", ".join(counts) or "-"
        line = f"{h.id}  {h.status.value:<12} {h.title}  [{exps}]"
        if h.verdict:
            line += f"\n      verdict: {h.verdict.reason}"
        print(line)


def cmd_watch(args: argparse.Namespace) -> None:
    """Prints one line per run whose end it recorded, and nothing otherwise.
    With ``--since``, it prints instead the news that consumer has not read
    with ``brief --since`` and exits 3 when there is any; it never marks news
    read, so a wake that never reached the agent is reported again."""
    named = args.named
    unread = False
    for name, root in args.roots:
        recorded = watch(root)
        lines = (
            [_news_line(row) for row in news(root, _seen(root, args.since))[0]]
            if args.since
            else recorded
        )
        for line in lines:
            print(f"{name}: {line}" if named else line)
        unread = unread or bool(lines and args.since)
    if unread:
        sys.exit(3)
