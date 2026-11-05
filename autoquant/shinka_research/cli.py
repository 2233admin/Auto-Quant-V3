"""`aq shinka` command line interface.

Every command takes the direction it works on as ``dir``: a Project id or
directory (its notebook is ``<project>/research/``), a Workspace with
``--project``, or a bare direction directory (see ``project.py``).
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import subprocess
import tempfile
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from autoquant.shinka_research import domains, grants, library, rules
from autoquant.shinka_research.notebook import (
    Notebook,
    Status,
    Verdict,
    append_log,
    experiment_dir,
)
from autoquant.shinka_research.quant import QuantConfig, run_quant_eval
from autoquant.shinka_research.rundb import count_evaluated, run_cost
from autoquant.shinka_research.skeptic import (
    Thresholds,
    challenge,
    decide,
    render_report,
)
from autoquant.shinka_research.scaffold import (
    SHINKA_CONFIG_FILENAME,
    load_config,
    prepare_data,
    scaffold_experiment,
    verify_experiment,
)
from autoquant.shinka_research.rounds import direction_spend, held
from autoquant.shinka_research.runs import (
    RUN_LOG,
    detached,
    finish_run,
    hypothesis_evaluated,
    watch,
)
from autoquant.shinka_research.state import (
    attach_worker,
    file_lock,
    hand_over,
    live_work,
    lock_path,
    record_exit,
    register_work,
)

from autoquant.shinka_research import project
from autoquant.shinka_research.cli_common import (
    _add_dir,
    _add_threshold_args,
    _given_thresholds,
    _not_confirming,
    _pick_experiment,
    _refused,
    _rule_name,
    _the_owners,
    _thresholds,
)
from autoquant.shinka_research.cli_confirm import cmd_confirm
from autoquant.shinka_research.cli_read import (
    _consumer,
    cmd_brief,
    cmd_library_add,
    cmd_library_compiled,
    cmd_library_log,
    cmd_library_pending,
    cmd_status,
    cmd_watch,
)


def cmd_init(args: argparse.Namespace) -> None:
    root = Path(args.dir)
    project.attach(args.target)
    with file_lock(lock_path(root)):
        if Notebook.path(root).exists():
            sys.exit(f"{root} already has a notebook")
        Notebook(
            direction=args.direction, domain=args.domain, budget_usd=args.budget_usd
        ).save(root)
    library.ensure(args.target.library)
    program = root / "program.md"
    if not program.exists():
        program.write_text(domains.program(args.domain, args.direction))
    print(root)


def cmd_hypothesis_add(args: argparse.Namespace) -> None:
    root = Path(args.dir)
    body = Path(args.file).read_text() if args.file else sys.stdin.read()
    with Notebook.edit(root) as nb:
        hyp = nb.add_hypothesis(root, args.title, body)
    print(hyp.id)


def cmd_hypothesis_status(args: argparse.Namespace) -> None:
    with Notebook.edit(Path(args.dir)) as nb:
        nb.set_status(args.hid, Status(args.status))


def cmd_scaffold(args: argparse.Namespace) -> None:
    root = Path(args.dir)
    # The experiment number and the sealed split are allocated here, so the
    # whole scaffold holds the direction's lock.
    with Notebook.edit(root) as nb:
        if nb.domain != domains.QUANT:
            sys.exit(
                f"{root} is a {nb.domain} direction; `scaffold` builds quant "
                "experiments only"
            )
        _not_confirming(nb)
        split = prepare_data(
            root,
            nb,
            Path(args.data) if args.data else None,
            args.timestamp_col,
            args.lockbox_fraction,
        )
        cfg = QuantConfig(
            data_path=split.dev_path,
            timestamp_col=split.timestamp_col,
            oos_fraction=args.oos_fraction,
            n_folds=args.n_folds,
            cost_bps=args.cost_bps,
            periods_per_year=args.periods_per_year,
            lookahead_checks=args.lookahead_checks,
        )
        exp, task_dir = scaffold_experiment(root, nb, args.hid, Path(args.initial), cfg)
    append_log(root, args.hid, exp.id, "scaffold", f"seed {Path(args.initial).name}")
    print(task_dir)


def cmd_grant(args: argparse.Namespace) -> None:
    _the_owners("a round grant")
    with _refused():
        grant = grants.add_grant(
            Path(args.dir).resolve(),
            args.hids,
            args.attempts,
            args.max_cost,
            args.allow,
            args.note,
        )
    print(grants.terms(grant))


def cmd_approve(args: argparse.Namespace) -> None:
    _the_owners("a lockbox approval")
    with _refused():
        approval = grants.add_approval(Path(args.dir).resolve(), args.note)
    print(grants.approval_terms(approval))


# The evolution command a run starts; the lease keeps the full command, so a
# detached supervisor runs exactly what was checked here.
SHINKA_RUN = ["shinka_run"]

# The model lists shinka_run calls. evo.task_sys_msg holds the hypothesis text,
# which may name a headless/ model without configuring one.
_MODEL_FIELDS = (
    "llm_models",
    "meta_llm_models",
    "novelty_llm_models",
    "prompt_llm_models",
)


def _headless_models(task_dir: Path) -> List[str]:
    """The headless/* models the task's shinka.yaml configures in either of
    shinka_run's names for that section (``evo``, ``evo_config``). A file that
    does not parse is left to shinka_run, which refuses it."""
    try:
        loaded = yaml.safe_load(
            (task_dir / SHINKA_CONFIG_FILENAME).read_text(encoding="utf-8")
        )
    except (OSError, yaml.YAMLError):
        return []
    if not isinstance(loaded, dict):
        return []
    found = []
    for section in (loaded.get("evo"), loaded.get("evo_config")):
        if not isinstance(section, dict):
            continue
        for name in _MODEL_FIELDS:
            models = section.get(name) or []
            if isinstance(models, str):
                models = [models]
            if isinstance(models, list):
                found += [
                    m
                    for m in models
                    if isinstance(m, str) and m.startswith("headless/")
                ]
    return found


def cmd_run(args: argparse.Namespace, extra: List[str]) -> None:
    if any("headless/" in a for a in extra):
        # Headless CLI agents work inside results_dir, which holds private
        # (out-of-sample) metrics; they would see the holdout.
        sys.exit(
            "headless/* mutation models are not allowed: they can read OOS metrics"
        )
    agent = grants.in_agent_env()
    if agent and args.grant is None:
        sys.exit(
            "an agent run needs a round the owner granted: `run --grant <id>` "
            "(`shinka_research grant` records one)"
        )
    root = Path(args.dir).resolve()
    # A run that ended unobserved is recorded first, so its leftover running
    # mark does not pass for this run's earlier status.
    for line in watch(root):
        print(line)
    with Notebook.edit(root) as nb:
        _not_confirming(nb)
        hyp, exp = _pick_experiment(nb, args.hid, args.eid)
        live = live_work(root)
        if any((w["hypothesis"], w["experiment"]) == (hyp.id, exp.id) for w in live):
            sys.exit(
                f"{hyp.id}/{exp.id} already has a run in progress; two runs would "
                "write the same programs.sqlite"
            )
        verify_experiment(root, nb, hyp.id, exp)
        task_dir = experiment_dir(root, hyp.id, exp.id) / "task"
        headless = _headless_models(task_dir)
        if headless:
            sys.exit(
                "headless/* mutation models are not allowed: they can read OOS "
                f"metrics ({', '.join(headless)} in {task_dir / SHINKA_CONFIG_FILENAME})"
            )
        spent = 0.0
        if nb.budget_usd is not None:
            spent, known = direction_spend(root, nb, live)
            if spent >= nb.budget_usd:
                sys.exit(
                    f"direction budget exhausted: {'' if known else '>='}${spent:.2f} "
                    f"of ${nb.budget_usd:.2f}"
                )
            # A lower bound cannot show that the budget still has room.
            if not known:
                sys.exit(
                    "direction budget cannot be checked: some runs have an unknown "
                    f"cost (recorded ${spent:.2f} of ${nb.budget_usd:.2f})"
                )
        exp_dir = experiment_dir(root, hyp.id, exp.id)
        results_dir = exp_dir / "results"
        work = uuid.uuid4().hex
        origin: Dict[str, Any] = {"env": "agent" if agent else "manual"}
        passthrough = extra
        if args.grant is not None:
            # Every refusal comes before the attempt is taken, and the attempt
            # before the lease, so no run goes without one.
            with _refused():
                grant, used, tokens = grants.check_run(
                    root, args.grant, hyp.id, exp.id, extra, live
                )
            cap = grant["max_cost"]
            if nb.budget_usd is not None:
                # A run with no stop point (the owner's own, say) may spend any
                # of what is left, so nothing can be held for this one.
                open_ended = [w for w in live if "cap" not in (w.get("origin") or {})]
                if open_ended:
                    w = open_ended[0]
                    sys.exit(
                        f"{w['hypothesis']}/{w['experiment']} has a run in progress "
                        "with no stop point, so the direction budget cannot hold room "
                        "for a grant run; it waits until that run ends"
                    )
                # Rounded so the subtraction's float noise reads as no room.
                left = round(nb.budget_usd - spent - held(root, live), 9)
                cap = min(cap, left)
                if cap <= 0:
                    sys.exit(
                        f"the direction budget has no room for a grant run: "
                        f"${spent:.2f} of ${nb.budget_usd:.2f} spent, the rest held "
                        "by grant runs in progress"
                    )
            # shinka_run counts what the experiment's database already spent
            # toward its cap when it resumes it, by the same rule; from a lower
            # bound the run could spend past the grant's cap.
            prior = run_cost(results_dir)
            if not prior.known:
                sys.exit(
                    f"{hyp.id}/{exp.id} has spent an unknown amount (at least "
                    f"${prior.recorded_usd:.2f}), so a grant run's cap cannot "
                    "hold; the owner must resolve the unknown cost first"
                )
            cost_before = prior.recorded_usd
            stops_at = cost_before + cap
            passthrough = [part for token in tokens for part in ("--set", token)]
            passthrough += ["--set", f"evo.max_api_costs={stops_at!r}"]
            origin.update(
                grant=grant["id"],
                attempt=used + 1,
                of=grant["attempts"],
                cap=cap,
                cost_before=cost_before,
            )
            grants.take_attempt(
                root, grant, used + 1, hyp.id, exp.id, work, cap, stops_at
            )
        cmd = [
            *SHINKA_RUN,
            "--task-dir", str(exp_dir / "task"),
            "--results_dir", str(results_dir),
            "--num_generations", str(args.num_generations),
            "--config-fname", SHINKA_CONFIG_FILENAME,
            *passthrough,
        ]  # fmt: skip
        # The lease, with the checks that allowed it: confirm cannot freeze the
        # trial count while this run adds trials, a second run of this
        # experiment is refused, and the run's end is recorded from it. A run
        # joining another live run of the hypothesis shares its baseline, so the
        # hypothesis goes back to the status it had before any of them.
        joined = next((w for w in live if w["hypothesis"] == hyp.id), None)
        baseline = (
            {k: joined[k] for k in ("previous_status", "previous_verdict", "before")}
            if joined
            else {
                "previous_status": hyp.status.value,
                "previous_verdict": hyp.verdict.model_dump(mode="json")
                if hyp.verdict
                else None,
                "before": hypothesis_evaluated(root, hyp),
            }
        )
        register_work(
            root,
            hyp.id,
            exp.id,
            work_id=work,
            cmd=cmd,
            origin=origin,
            evaluated_before=count_evaluated(results_dir),
            **baseline,
        )
        hyp.status, hyp.verdict = Status.running, None

    # An agent's run outlives the window or page that asked for it.
    if args.detach or agent:
        try:
            supervisor = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "autoquant.shinka_research.runs",
                    str(root),
                    work,
                ],
                **detached(),
            )
        except BaseException:
            finish_run(root, work, 1)
            raise
        # The supervisor owns the run from here; this command may live on. If
        # the supervisor took over first, its own hand-over stands.
        hand_over(root, work, supervisor.pid, replacing=os.getpid())
        print(
            f"{hyp.id}/{exp.id} is running in the background (pid {supervisor.pid}); "
            f"its output goes to {exp_dir / RUN_LOG}, and `shinka_research watch "
            f"{root}` records its end if nothing else does"
        )
        return
    print("$ " + " ".join(cmd), flush=True)
    code = 1
    try:
        # subprocess.call, keeping the child's pid: the child adds the trials
        # and may outlive this command.
        with subprocess.Popen(cmd) as proc:
            try:
                attach_worker(root, work, proc.pid)
                code = proc.wait()
                record_exit(root, work, code)
            except BaseException:
                proc.kill()
                raise
    finally:
        # Always record what was evaluated, even on Ctrl-C, so trials are counted.
        finish_run(root, work, code)
    if code:
        sys.exit(code)


def cmd_probe(args: argparse.Namespace) -> None:
    """Score a program with the frozen evaluator, showing public metrics only."""
    root = Path(args.dir)
    # Probing is a manual search step and a trial for the DSR from the moment it
    # starts, so one that fails or is killed is counted too, and a lockbox
    # opened meanwhile has already frozen it. The run log records it in the same
    # lock, so the log and the count agree.
    with file_lock(lock_path(root)):
        with Notebook.edit(root) as nb:
            _not_confirming(nb)
            hyp, exp = _pick_experiment(nb, args.hid, args.eid)
            verify_experiment(root, nb, hyp.id, exp)
            exp.n_probed += 1
        who = "agent" if grants.in_agent_env() else "manual"
        append_log(root, hyp.id, exp.id, "probe", f"{Path(args.program).name}, {who}")
    cfg = load_config(experiment_dir(root, hyp.id, exp.id) / "task")
    with (
        tempfile.TemporaryDirectory() as tmp,
        contextlib.redirect_stdout(io.StringIO()),
    ):
        metrics, correct, err = run_quant_eval(args.program, tmp, cfg)
    shown = {
        "correct": correct,
        "error": err,
        "combined_score": metrics.get("combined_score"),
        "public": metrics.get("public"),
        "text_feedback": metrics.get("text_feedback"),
    }
    print(json.dumps(shown, indent=2, default=float))


def cmd_skeptic(args: argparse.Namespace) -> None:
    root = Path(args.dir)
    nb = Notebook.load(root)
    _not_confirming(nb)
    hyp, exp = _pick_experiment(nb, args.hid, args.eid)
    # A changed file is named before anything else, whatever the rule.
    verify_experiment(root, nb, hyp.id, exp)
    plan = exp.plan
    if plan is None:
        # Unfrozen (legacy): thresholds from the command line, as always.
        th = _thresholds(args)
    else:
        given = _given_thresholds(args)
        if given:
            sys.exit(
                f"{hyp.id}/{exp.id}'s rule and thresholds are frozen by its plan; "
                f"drop {', '.join(given)}"
            )
        if plan.rule.kind != rules.DSR_PBO:
            sys.exit(
                f"{hyp.id}/{exp.id}'s rule {plan.rule.kind} is judged from the "
                "checker's evidence, which `skeptic` cannot gather yet "
                "(research-domains 1.3)"
            )
        th = Thresholds(**plan.rule.thresholds)
    # What the challenge starts from; a change to it meanwhile (a verdict, a
    # confirmation, a run, another challenge) is newer than this result.
    start = (hyp.status, hyp.verdict, exp.skeptic)
    report = challenge(root, nb, hyp.id, exp, th)
    if plan is None:
        label, reason = decide(report, th)
    else:
        verdict, reason = rules.judge(plan.rule, report)
        label = Status(verdict)
    # The challenge ran unlocked; its result goes onto the latest notebook.
    with Notebook.edit(root) as nb:
        _not_confirming(nb)
        hyp, exp = _pick_experiment(nb, hyp.id, exp.id)
        if (hyp.status, hyp.verdict, exp.skeptic) != start:
            sys.exit(
                f"{hyp.id} changed while the challenge ran (now {hyp.status.value}); "
                "nothing was recorded, challenge it again"
            )
        exp.skeptic = {
            **report,
            "rule_label": label.value,
            "rule_reason": reason,
            "thresholds": th.model_dump(
                include={"dsr_supported", "min_positive_fraction", "max_pbo"}
            ),
        }
        if plan is not None:
            exp.skeptic["rule"] = plan.rule.model_dump()
        hyp.status, hyp.verdict = Status.challenged, None
    append_log(root, hyp.id, exp.id, "skeptic", f"rule says {label.value}: {reason}")
    out = experiment_dir(root, hyp.id, exp.id) / "skeptic.md"
    frozen = (
        "frozen by the plan"
        if exp.plan is not None
        else "legacy, thresholds from the command line"
    )
    out.write_text(
        render_report(hyp.id, exp.id, report, label)
        + f"\nRule: {_rule_name(exp)} ({frozen})\n\n{reason}\n"
    )
    print(out.read_text())


def cmd_verdict(args: argparse.Namespace) -> None:
    root = Path(args.dir)
    with Notebook.edit(root) as nb:
        _not_confirming(nb)
        hyp, exp = _pick_experiment(nb, args.hid, args.eid)
        if exp.plan is not None:
            # Unfrozen (legacy) experiments keep recording without this check.
            verify_experiment(root, nb, hyp.id, exp)
        if exp.skeptic is None:
            sys.exit(f"{hyp.id}/{exp.id} has not been challenged; run `skeptic` first")
        label = Status(args.label or exp.skeptic["rule_label"])
        if args.label and label.value != exp.skeptic["rule_label"] and not args.reason:
            sys.exit("--reason is required when overriding the rule-based verdict")
        reason = args.reason or exp.skeptic["rule_reason"]
        nb.set_verdict(
            hyp.id,
            Verdict(
                label=label,
                reason=reason,
                evidence={"experiment": exp.id, **exp.skeptic},
            ),
        )
    append_log(root, hyp.id, exp.id, "verdict", f"{label.value}: {reason}")
    print(f"{hyp.id}: {label.value} — {reason}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="aq shinka",
        description="Hypothesis-driven research on top of ShinkaEvolve.",
    )
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("init", help="Attach a research direction to a Project")
    _add_dir(s)
    s.add_argument(
        "--create-project",
        action="store_true",
        help="With a Workspace and --project ID: create the blank Project "
        "first (as `aq project create --template blank`) when it does not exist",
    )
    s.add_argument("--direction", required=True)
    s.add_argument(
        "--budget-usd", type=float, help="Stop runs once LLM spend hits this"
    )
    s.add_argument(
        "--domain",
        choices=domains.NAMES,
        default=domains.DEFAULT,
        help="What kind of research; written once, never changed "
        "(open: no preset, the agent drafts everything)",
    )
    s.set_defaults(func=cmd_init)

    s = sub.add_parser("hypothesis", help="Manage hypotheses")
    hsub = s.add_subparsers(dest="action", required=True)
    a = hsub.add_parser("add", help="Add a hypothesis (body from --file or stdin)")
    _add_dir(a)
    a.add_argument("--title", required=True)
    a.add_argument("--file")
    a.set_defaults(func=cmd_hypothesis_add)
    a = hsub.add_parser("status", help="Select or drop a hypothesis")
    _add_dir(a)
    a.add_argument("hid")
    a.add_argument("status", choices=["proposed", "selected", "dropped"])
    a.set_defaults(func=cmd_hypothesis_status)

    s = sub.add_parser("scaffold", help="Create a Shinka task for a hypothesis")
    _add_dir(s)
    s.add_argument("hid")
    s.add_argument("--initial", required=True, help="Seed program (initial.py)")
    s.add_argument(
        "--data",
        help="CSV with timestamp + close (required for the first experiment)",
    )
    s.add_argument(
        "--lockbox-fraction",
        type=float,
        default=0.2,
        help="Tail reserved for `confirm` (set once per direction)",
    )
    s.add_argument("--timestamp-col", default="timestamp")
    s.add_argument("--oos-fraction", type=float, default=0.3)
    s.add_argument("--n-folds", type=int, default=3)
    s.add_argument("--cost-bps", type=float, default=5.0)
    s.add_argument("--periods-per-year", type=float, default=252.0)
    s.add_argument("--lookahead-checks", type=int, default=5)
    s.set_defaults(func=cmd_scaffold)

    s = sub.add_parser(
        "run", help="Evolve an experiment (extra args after -- go to shinka_run)"
    )
    _add_dir(s)
    s.add_argument("hid")
    s.add_argument("--eid")
    s.add_argument("--num-generations", type=int, default=20)
    s.add_argument(
        "--detach",
        action="store_true",
        help="Keep running after this window closes; `watch` records an end "
        "nothing else saw",
    )
    s.add_argument(
        "--grant",
        help="The owner's round grant this run takes an attempt from; required "
        f"where {grants.AGENT_ENV} is set, where runs also always detach",
    )
    s.set_defaults(func=cmd_run, takes_extra=True)

    s = sub.add_parser(
        "probe", help="Score a program with the frozen evaluator (public only)"
    )
    _add_dir(s)
    s.add_argument("hid")
    s.add_argument("program")
    s.add_argument("--eid")
    s.set_defaults(func=cmd_probe)

    s = sub.add_parser("skeptic", help="Challenge an experiment on the holdout")
    _add_dir(s)
    s.add_argument("hid")
    s.add_argument("--eid")
    _add_threshold_args(s)
    s.set_defaults(func=cmd_skeptic)

    s = sub.add_parser(
        "confirm",
        help="Open the lockbox once and confirm supported hypotheses",
    )
    _add_dir(s)
    s.add_argument(
        "--data", required=True, help="The source CSV the direction was split from"
    )
    s.add_argument("--yes", action="store_true", help="Really open the lockbox")
    s.add_argument(
        "--approval",
        help="The owner's lockbox approval this opening spends (instead of --yes); "
        f"required where {grants.AGENT_ENV} is set",
    )
    _add_threshold_args(s)
    s.set_defaults(func=cmd_confirm)

    s = sub.add_parser("verdict", help="Record the verdict (rule-based by default)")
    _add_dir(s)
    s.add_argument("hid")
    s.add_argument("--eid")
    s.add_argument("--label", choices=["supported", "refuted", "inconclusive"])
    s.add_argument("--reason")
    s.set_defaults(func=cmd_verdict)

    s = sub.add_parser("library", help="Workspace research library (raw -> wiki)")
    lsub = s.add_subparsers(dest="action", required=True)
    a = lsub.add_parser("add", help="Add files or URLs to library/raw")
    _add_dir(a, "library")
    a.add_argument("sources", nargs="+")
    a.set_defaults(func=cmd_library_add)
    a = lsub.add_parser("pending", help="List raw sources not compiled yet")
    _add_dir(a, "library")
    a.set_defaults(func=cmd_library_pending)
    a = lsub.add_parser("compiled", help="Mark raw sources as compiled into the wiki")
    _add_dir(a, "library")
    a.add_argument("files", nargs="*")
    a.add_argument("--all", action="store_true", help="Every pending source")
    a.set_defaults(func=cmd_library_compiled)
    a = lsub.add_parser("log", help="Append to library/log.md (lint, qa, finding)")
    _add_dir(a, "library")
    a.add_argument("kind")
    a.add_argument("text")
    a.set_defaults(func=cmd_library_log)

    s = sub.add_parser("brief", help="Digest of the direction for the next round")
    _add_dir(s)
    s.add_argument("--recent", type=int, default=15)
    s.add_argument(
        "--since",
        type=_consumer,
        metavar="NAME",
        help="also list the news consumer NAME has not read, and mark it read",
    )
    s.set_defaults(func=cmd_brief)

    s = sub.add_parser("status", help="Show the notebook")
    _add_dir(s)
    s.set_defaults(func=cmd_status)

    s = sub.add_parser(
        "grant",
        help="Grant the agent one round: attempts, a per-run cap and the settings "
        "it may choose (the owner's, never from the agent environment)",
    )
    _add_dir(s)
    s.add_argument("hids", nargs="+", metavar="hid")
    s.add_argument("--attempts", type=int, required=True)
    s.add_argument(
        "--max-cost", type=float, required=True, help="USD each run may spend"
    )
    s.add_argument(
        "--allow",
        action="append",
        default=[],
        metavar="NS.FIELD",
        help="A shinka_run --set key the agent may choose (repeatable)",
    )
    s.add_argument("--note", default="")
    s.set_defaults(func=cmd_grant)

    s = sub.add_parser(
        "approve",
        help="Approve opening the lockbox once (the owner's, never from the agent "
        "environment)",
    )
    _add_dir(s)
    s.add_argument("--note", default="")
    s.set_defaults(func=cmd_approve)

    s = sub.add_parser(
        "watch",
        help="Record the end of runs whose processes are all gone "
        "(a direction, or every direction of a workspace)",
    )
    _add_dir(s, "watch")
    s.add_argument(
        "--since",
        type=_consumer,
        metavar="NAME",
        help="print the news consumer NAME has not read with `brief --since` "
        "(owner grants and approvals, run ends) and exit 3 if there is any",
    )
    s.set_defaults(func=cmd_watch)

    return p


def _resolve(args: argparse.Namespace) -> None:
    """Turn ``dir`` into the paths the command works on (``project.py``)."""
    kind = getattr(args, "resolve", "direction")
    if kind == "library":
        args.library = project.library_for(args.dir, args.project)
    elif kind == "watch":
        args.roots, args.named = project.watch_roots(args.dir, args.project)
    else:
        args.target = project.resolve(
            args.dir,
            args.project,
            create=getattr(args, "create_project", False),
            description=getattr(args, "direction", "") or "",
        )
        args.dir = str(args.target.root)


def main(argv: Optional[List[str]] = None) -> None:
    argv = list(sys.argv[1:] if argv is None else argv)
    extra: List[str] = []
    if "--" in argv:
        i = argv.index("--")
        argv, extra = argv[:i], argv[i + 1 :]
    args = build_parser().parse_args(argv)
    _resolve(args)
    if getattr(args, "takes_extra", False):
        args.func(args, extra)
    else:
        if extra:
            sys.exit("extra arguments after -- are only accepted by `run`")
        args.func(args)


if __name__ == "__main__":
    main()
