"""Helpers shared by the `aq shinka` command modules."""

from __future__ import annotations

import argparse
import contextlib
import sys
from typing import Iterator, List, Optional


from autoquant.shinka_research import grants
from autoquant.shinka_research.notebook import (
    Experiment,
    Notebook,
)
from autoquant.shinka_research.skeptic import (
    Thresholds,
)


def _not_confirming(nb: Notebook) -> None:
    """Experiment changes wait while a lockbox confirmation is unfinished: when
    it finishes, it records over the hypotheses it froze."""
    if nb.data is not None and nb.data.unfinished:
        sys.exit(
            "a lockbox confirmation is unfinished; `confirm --yes` finishes it, and "
            "experiments wait until then"
        )


@contextlib.contextmanager
def _refused() -> Iterator[None]:
    """A refusal from the owner's approvals ends the command with its reason."""
    try:
        yield
    except grants.Refused as refused:
        sys.exit(str(refused))


def _the_owners(what: str) -> None:
    if grants.in_agent_env():
        sys.exit(
            f"{what} is the owner's to give: from a terminal without "
            f"{grants.AGENT_ENV}, or from the workbench"
        )


def _pick_experiment(nb: Notebook, hid: str, eid: Optional[str]):
    hyp = nb.get(hid)
    if not hyp.experiments:
        sys.exit(f"{hid} has no experiment; run `scaffold` first")
    if eid is None:
        return hyp, hyp.experiments[-1]
    return hyp, next(e for e in hyp.experiments if e.id == eid)


def _rule_name(exp: Experiment) -> str:
    """The rule an experiment is judged by; experiments without a plan are
    unfrozen (legacy) and take thresholds from the command line."""
    if exp.plan is None:
        return "unfrozen"
    return f"{exp.plan.rule.kind} v{exp.plan.rule.version}"


def _given_thresholds(args: argparse.Namespace) -> List[str]:
    return [
        flag
        for flag in _THRESHOLD_FLAGS
        if getattr(args, flag[2:].replace("-", "_")) is not None
    ]


def _thresholds(args: argparse.Namespace) -> Thresholds:
    given = {
        field: getattr(args, flag[2:].replace("-", "_"))
        for flag, field in _THRESHOLD_FLAGS.items()
    }
    return Thresholds(**{k: v for k, v in given.items() if v is not None})


# Flag -> Thresholds field. The flags default to None so a command can tell
# thresholds given on the command line, which a frozen plan refuses, from the
# defaults (``Thresholds``'s own).
_THRESHOLD_FLAGS = {
    "--dsr": "dsr_supported",
    "--min-positive-fraction": "min_positive_fraction",
    "--subperiods": "n_subperiods",
    "--max-pbo": "max_pbo",
}


def _add_threshold_args(s: argparse.ArgumentParser) -> None:
    s.add_argument("--dsr", type=float, help="default 0.95")
    s.add_argument("--min-positive-fraction", type=float, help="default 2/3")
    s.add_argument("--subperiods", type=int, help="default 3")
    s.add_argument("--max-pbo", type=float, help="default 0.5")


def _add_dir(s: argparse.ArgumentParser, resolve: str = "direction") -> None:
    """The direction argument every command takes, resolved by ``project.py``."""
    s.add_argument(
        "dir",
        help="Project id or directory, a Workspace with --project, "
        "or a bare direction directory"
        + (" (a Workspace alone: its library)" if resolve == "library" else "")
        + (
            " (a Workspace alone: every Project with research)"
            if resolve == "watch"
            else ""
        ),
    )
    s.add_argument("--project", help="Project id inside the Workspace given as dir")
    s.set_defaults(resolve=resolve)
