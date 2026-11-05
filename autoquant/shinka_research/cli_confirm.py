"""`aq shinka confirm`: open the lockbox once and confirm supported hypotheses."""

from __future__ import annotations

import argparse
import tempfile
import sys
from pathlib import Path
from typing import Any, Dict, List


from autoquant.shinka_research import grants
from autoquant.shinka_research.notebook import (
    RESULTS_LOG,
    LockboxOpening,
    Notebook,
    Status,
    append_log,
)
from autoquant.shinka_research.skeptic import (
    Thresholds,
    check_source,
    confirm,
    confirm_target,
)
from autoquant.shinka_research.state import (
    atomic_write_text,
    file_lock,
    live_work,
)
from autoquant.shinka_research.cli_common import _refused, _thresholds


# Held for a confirm's whole run: a target found mid-scoring then belongs to a
# confirm that died, never to one still running.
CONFIRM_LOCK = ".confirm.lock"


def cmd_confirm(args: argparse.Namespace) -> None:
    root = Path(args.dir)
    entered = False
    try:
        with file_lock(root / CONFIRM_LOCK, timeout=0):
            entered = True
            _confirm(root, args)
    except TimeoutError:
        if entered:
            raise
        sys.exit("another confirm is running for this direction; wait for it to end")


def _confirmed(nb: Notebook, hid: str, report: Dict[str, Any]) -> None:
    assert nb.data is not None and nb.data.opening is not None
    hyp = nb.get(hid)
    hyp.confirmation = report
    hyp.status = Status.confirmed if report["passed"] else Status.unconfirmed
    nb.data.opening.target(hid).state = "done"


def _confirm(root: Path, args: argparse.Namespace) -> None:
    approval = args.approval
    if grants.in_agent_env() and approval is None:
        sys.exit(
            "an agent confirm needs the owner's lockbox approval: `confirm "
            "--approval <id>` (`shinka_research approve` records one); --yes is "
            "not enough here"
        )
    # The owner's approval stands for --yes.
    proceed = args.yes or approval is not None
    nb = Notebook.load(root)
    split = nb.data
    if split is None:
        sys.exit("this direction has no data yet")
    if split.opened and not split.unfinished:
        if split.opening is not None and not (root / CONFIRMATION).exists():
            if approval is not None:
                with _refused():
                    grants.check_opened_by(root, approval, split.opening.started)
            # The results are in the notebook but that confirm died before
            # writing them out; only the events it did not log are added.
            logged = _confirm_events(root, split.opening.started)
            hids = [t.hypothesis for t in split.opening.targets]
            _publish(root, nb, [hid for hid in hids if hid not in logged])
            return
        sys.exit("the lockbox was already opened; start a new direction with new data")
    if split.unfinished:
        assert split.opening is not None
        left = [t.hypothesis for t in split.opening.targets if t.state != "done"]
        if not proceed:
            sys.exit(
                f"The lockbox opening of {split.opening.started} did not finish. "
                f"This finishes it for {', '.join(left)} with the programs and rules "
                "it froze. Re-run with --yes to proceed."
            )
        if approval is not None:
            with _refused():
                grants.check_opened_by(root, approval, split.opening.started)
        check_source(split.opening.source_sha256, Path(args.data))
        th = Thresholds(**split.opening.thresholds)
    else:
        # The lockbox opens once, so every supported hypothesis is confirmed together.
        hids = [h.id for h in nb.hypotheses if h.status is Status.supported]
        if not hids:
            sys.exit("no supported hypotheses to confirm; the lockbox stays closed")
        if not proceed:
            sys.exit(
                f"This opens the lockbox (from {split.lockbox_start}) once for the "
                f"whole direction and scores {', '.join(hids)}. Re-run with --yes "
                "to proceed."
            )
        th = _thresholds(args)
        # Every check that leaves the lockbox untouched, so a mistake here, such
        # as the wrong --data, keeps it sealed.
        targets = [confirm_target(root, nb, hid) for hid in hids]
        check_source(split.source_hash, Path(args.data))
        with Notebook.edit(root) as nb:
            assert nb.data is not None
            # Every trial counts toward the DSR, so the count is frozen only
            # once no run or probe is still adding to it.
            busy = [f"{w['hypothesis']}/{w['experiment']}" for w in live_work(root)]
            if busy:
                sys.exit(
                    f"trials are still being added ({', '.join(busy)}); the lockbox "
                    "stays sealed, confirm once that work has ended"
                )
            supported = [h.id for h in nb.hypotheses if h.status is Status.supported]
            if (
                nb.data.opened
                or [confirm_target(root, nb, h) for h in supported] != targets
            ):
                sys.exit(
                    "the direction changed while confirm checked it; the lockbox "
                    "stays sealed, run confirm again"
                )
            opening = LockboxOpening(
                source_sha256=nb.data.source_hash,
                thresholds=th.model_dump(),
                targets=targets,
            )
            if approval is not None:
                # Spent in the same lock, before the opening is saved.
                with _refused():
                    grants.use_approval(root, approval, opening.started)
            nb.data.opened = True
            nb.data.opening = opening
    split = nb.data
    assert split is not None and split.opening is not None
    # A target already scoring belongs to a confirm that died after its program
    # saw the lockbox, whether or not it got a result: running it again would be
    # a second look.
    recorded: Dict[str, Dict[str, Any]] = {
        t.hypothesis: {
            "experiment": t.experiment,
            "program_id": t.program_id,
            "lockbox_start": split.lockbox_start,
            "passed": False,
            "failure": "interrupted",
        }
        for t in split.opening.targets
        if t.state == "scoring"
    }
    with tempfile.TemporaryDirectory() as tmp:
        for t in [t for t in split.opening.targets if t.state == "pending"]:

            def started(hid: str = t.hypothesis) -> None:
                with Notebook.edit(root) as fresh:
                    assert fresh.data is not None and fresh.data.opening is not None
                    fresh.data.opening.target(hid).state = "scoring"

            recorded[t.hypothesis] = confirm(
                root,
                split,
                t,
                th,
                Path(args.data),
                split.opening.source_sha256,
                Path(tmp),
                started,
            )
    # Every result reaches the notebook at once: candidate programs can read it,
    # so a program scored later must not find an earlier one's lockbox figures.
    with Notebook.edit(root) as nb:
        assert nb.data is not None and nb.data.opening is not None
        for hid, report in recorded.items():
            _confirmed(nb, hid, report)
        nb.data.opening.finish()
    _publish(root, nb, list(recorded))


CONFIRMATION = "CONFIRMATION.md"


def _confirm_events(root: Path, since: str) -> set:
    """Hypotheses with a confirm event in the run log from ``since`` on."""
    path = root / RESULTS_LOG
    rows = path.read_text().splitlines()[1:] if path.exists() else []
    fields = [(row.split("\t") + [""] * 4)[:4] for row in rows]
    return {
        hid for time, hid, _eid, event in fields if event == "confirm" and time >= since
    }


def _publish(root: Path, nb: Notebook, log: List[str]) -> None:
    """The confirmation's run-log events, then CONFIRMATION.md, both read from
    the notebook. The Markdown comes last and in one step, so while it is
    missing some events may be too, and the next confirm adds them."""
    assert nb.data is not None and nb.data.opening is not None
    for hid in log:
        rep = nb.get(hid).confirmation or {}
        status = nb.get(hid).status.value
        note = (
            f"{status}: {rep['failure']} on the lockbox"
            if "failure" in rep
            else f"{status}: lockbox Sharpe {rep['lockbox_sharpe']:.2f}, "
            f"DSR {rep['dsr']:.3f}"
        )
        append_log(root, hid, rep["experiment"], "confirm", note)
    lines = [f"# Lockbox confirmation\n\nLockbox from {nb.data.lockbox_start}.\n"]
    for t in nb.data.opening.targets:
        hyp = nb.get(t.hypothesis)
        rows = "\n".join(
            f"| {k} | {v:.4g} |" if isinstance(v, float) else f"| {k} | {v} |"
            for k, v in (hyp.confirmation or {}).items()
        )
        lines.append(
            f"## {hyp.id}: {hyp.title} — {hyp.status.value}\n\n"
            f"| check | value |\n|---|---|\n{rows}\n"
        )
    atomic_write_text(root / CONFIRMATION, "\n".join(lines))
    for t in nb.data.opening.targets:
        print(f"{t.hypothesis}: {nb.get(t.hypothesis).status.value}")
