"""Apply an intake spec to a direction: add the hypothesis, write the spec
beside it, scaffold the experiment and freeze its plan.

This is the half of the intake that writes files. It runs inside the caller's
``Notebook.edit`` block and removes everything it created if any step fails.
"""

from __future__ import annotations

import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from autoquant.shinka_research import domains
from autoquant.shinka_research.intake import (
    INTAKE_SUFFIX,
    IntakeError,
    IntakeSpec,
    canonical_json,
)
from autoquant.shinka_research.intake_render import render_hypothesis, seed_program
from autoquant.shinka_research.intake_templates import TEMPLATES, Template
from autoquant.shinka_research.notebook import Notebook, experiment_dir
from autoquant.shinka_research.quant import QuantConfig, file_sha256, split_index
from autoquant.shinka_research.rules import Rule
from autoquant.shinka_research.scaffold import (
    freeze_plan,
    prepare_data,
    scaffold_experiment,
)


@dataclass(frozen=True)
class Applied:
    hypothesis: str
    experiment: str
    task_dir: Path
    spec_path: Path
    spec_sha256: str
    rule: Rule
    defaulted: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "hypothesis": self.hypothesis,
            "experiment": self.experiment,
            "task_dir": str(self.task_dir),
            "spec_path": str(self.spec_path),
            "spec_sha256": self.spec_sha256,
            "rule": self.rule.model_dump(mode="json"),
            "defaulted": self.defaulted,
        }


@dataclass
class _Undo:
    """Everything one apply created, so a failure leaves nothing behind. It
    runs under the direction's lock, which every writer to these places takes."""

    root: Path
    fresh: list[Path] = field(default_factory=list)
    kept: dict[Path, set[Path]] = field(default_factory=dict)

    def snapshot(self, directory: Path) -> None:
        """A directory this apply may add files to: remove it if it is absent
        now, otherwise remove only what is new in it afterwards."""
        if directory.exists():
            self.kept[directory] = set(directory.rglob("*"))
        else:
            self.fresh.append(directory)

    def watch(self, path: Path) -> None:
        """Remember the topmost missing ancestor of ``path`` (or ``path``
        itself) as ours; nothing if it exists. Call it before creating it."""
        top: Path | None = None
        node = path
        while node != self.root and node != node.parent and not node.exists():
            top, node = node, node.parent
        if top is not None:
            self.fresh.append(top)

    @staticmethod
    def _remove(path: Path) -> None:
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path, ignore_errors=True)
        else:
            path.unlink(missing_ok=True)

    def undo(self) -> None:
        for path in reversed(self.fresh):
            self._remove(path)
        for directory, before in self.kept.items():
            later = sorted(directory.rglob("*"), key=lambda p: len(p.parts), reverse=True)
            for path in later:
                if path not in before:
                    self._remove(path)


def check_data(template: Template, data: Path, timestamp_col: str) -> None:
    """The file must hold the columns the template's seed reads."""
    try:
        header = list(pd.read_csv(data, nrows=0).columns)
    except (OSError, ValueError) as error:
        raise IntakeError(f"{data}: cannot read the data file ({error})") from None
    need = [timestamp_col, *template.spec.columns]
    missing = [c for c in need if c not in header]
    if missing:
        raise IntakeError(
            f"{data} has no column {', '.join(missing)}; {template.id} reads "
            f"{', '.join(need)}"
        )


def _check_split(nb: Notebook, spec: IntakeSpec) -> None:
    """A direction's split is fixed by its first experiment; the spec must say
    what was built, not something else."""
    split = nb.data
    if split is None:
        return
    if split.timestamp_col != spec.backtest.timestamp_col:
        raise IntakeError(
            f"this direction's data uses timestamp column {split.timestamp_col!r}, "
            f"the spec says {spec.backtest.timestamp_col!r}"
        )
    if split_index(split.n_total, spec.backtest.lockbox_fraction) != split.n_dev:
        raise IntakeError(
            "this direction's lockbox was sealed at another fraction than the "
            f"spec's {spec.backtest.lockbox_fraction:g}; the split is fixed per direction"
        )


def apply_intake(root: Path, nb: Notebook, spec: IntakeSpec, data: Path) -> Applied:
    """Add the hypothesis, scaffold its experiment from the spec and freeze the
    plan, inside the caller's ``Notebook.edit`` block (the notebook is saved
    only if this returns). On any failure the files this created are removed
    and the exception propagates, so nothing is half-written."""
    root = Path(root)
    if nb.domain != domains.QUANT:
        raise IntakeError(
            f"{root} is a {nb.domain} direction; an intake builds quant experiments only"
        )
    template = TEMPLATES[spec.template]
    check_data(template, Path(data), spec.backtest.timestamp_col)
    _check_split(nb, spec)

    undo = _Undo(root)
    try:
        undo.snapshot(root / "hypotheses")
        undo.snapshot(root / "data")
        hyp = nb.add_hypothesis(root, spec.title, render_hypothesis(spec))
        spec_path = root / "hypotheses" / f"{hyp.id}{INTAKE_SUFFIX}"
        spec_path.write_bytes(canonical_json(spec).encode("utf-8"))

        split = prepare_data(
            root, nb, Path(data), spec.backtest.timestamp_col, spec.backtest.lockbox_fraction
        )
        cfg = QuantConfig(
            data_path=split.dev_path,
            timestamp_col=split.timestamp_col,
            oos_fraction=spec.backtest.oos_fraction,
            n_folds=spec.backtest.n_folds,
            cost_bps=spec.backtest.cost_bps,
            periods_per_year=spec.backtest.periods_per_year,
        )
        undo.watch(experiment_dir(root, hyp.id, f"e{len(hyp.experiments) + 1:02d}"))
        with tempfile.TemporaryDirectory() as tmp:
            seed = Path(tmp) / "initial.py"
            seed.write_text(seed_program(spec), encoding="utf-8", newline="\n")
            exp, task_dir = scaffold_experiment(root, nb, hyp.id, seed, cfg)

        digest = file_sha256(spec_path)
        try:
            dev_rel = Path(split.dev_path).resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            raise IntakeError(
                f"{split.dev_path}: the development data lies outside the direction"
            ) from None
        plan = freeze_plan(
            root,
            nb,
            hyp.id,
            exp,
            checker=[
                f"experiments/{hyp.id}/{exp.id}/task/evaluate.py",
                f"hypotheses/{hyp.id}{INTAKE_SUFFIX}",
            ],
            data=[dev_rel],
            rule=spec.rule,
            claim="empirical",
            rationale=(
                f"{spec.refutation}\n\nFrozen from the intake spec "
                f"hypotheses/{hyp.id}{INTAKE_SUFFIX} (sha256 {digest}), template "
                f"{spec.template}."
            ),
        )
    except BaseException as error:
        undo.undo()
        if isinstance(error, (ValueError, OSError)) and not isinstance(error, IntakeError):
            # The data or the split is not what the spec needs (other data,
            # too few bars, a file that is gone): a refusal, not a crash.
            raise IntakeError(str(error)) from error
        raise
    return Applied(hyp.id, exp.id, task_dir, spec_path, digest, plan.rule, list(spec.defaulted))
