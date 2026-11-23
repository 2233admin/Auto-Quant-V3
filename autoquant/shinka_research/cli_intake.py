"""`aq shinka intake`: templates, questions and apply.

``templates`` and ``questions`` read nothing from a direction. ``apply`` is the
owner's, like ``grant``: it adds a hypothesis, scaffolds its experiment from
the answers and freezes the experiment's plan, all under the direction's lock.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict

from autoquant.shinka_research import grants
from autoquant.shinka_research.cli_common import _add_dir, _not_confirming, _the_owners
from autoquant.shinka_research.intake import IntakeError, Resolution, resolve
from autoquant.shinka_research.intake_apply import apply_intake
from autoquant.shinka_research.intake_render import describe_template
from autoquant.shinka_research.intake_templates import TEMPLATES
from autoquant.shinka_research.notebook import Notebook, append_log


def _print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _read_draft(path: str) -> Dict[str, Any]:
    try:
        draft = json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError as error:
        sys.exit(f"{path}: cannot read the spec ({error})")
    except ValueError as error:
        sys.exit(f"{path}: not valid JSON ({error})")
    if not isinstance(draft, dict):
        sys.exit(f"{path}: the spec must be a JSON object")
    return draft


def _resolve(template: str | None, spec: str | None) -> Resolution:
    draft = _read_draft(spec) if spec else {}
    try:
        return resolve(template, draft)
    except IntakeError as error:
        sys.exit(f"intake: {error}")


def cmd_templates(args: argparse.Namespace) -> None:
    listing = [describe_template(t) for t in TEMPLATES.values()]
    if args.json:
        _print_json({"templates": listing})
        return
    for t in listing:
        params = " ".join(f"{p['name']}={p['default']}" for p in t["params"])
        asked = [p["name"] for p in t["params"] if p["open"]]
        print(f"{t['id']}  {t['title']}")
        print(f"    reads {', '.join(t['columns'])}; {params}")
        if asked:
            print(f"    asks: {', '.join(asked)}")


def _questions_text(res: Resolution) -> str:
    lines = [f"template {res.template.id}"]
    if res.questions:
        lines.append(f"{len(res.questions)} open question(s):")
        for q in res.questions:
            choices = f"; one of {', '.join(map(str, q.choices))}" if q.choices else ""
            lines.append(f"  {q.field}: {q.prompt}")
            lines.append(f"      suggested: {q.default}{choices}")
    else:
        lines.append("ready: nothing is open")
    if res.defaulted:
        lines.append(f"defaulted from the template: {', '.join(res.defaulted)}")
    return "\n".join(lines)


def cmd_questions(args: argparse.Namespace) -> None:
    res = _resolve(args.template, args.spec)
    if args.json:
        _print_json(res.as_dict())
    else:
        print(_questions_text(res))


def cmd_apply(args: argparse.Namespace) -> None:
    _the_owners("an intake apply")
    root = Path(args.dir)
    res = _resolve(None, args.spec)
    if res.spec is None:
        sys.exit(
            "intake: the spec is not ready; answer these first with "
            "`aq shinka intake questions`:\n"
            + "\n".join(f"  {q.field}: {q.prompt}" for q in res.questions)
        )
    with Notebook.edit(root) as nb:
        _not_confirming(nb)
        try:
            applied = apply_intake(root, nb, res.spec, Path(args.data))
        except IntakeError as error:
            sys.exit(f"intake: {error}")
    append_log(
        root,
        applied.hypothesis,
        applied.experiment,
        "intake",
        f"{res.spec.template}, spec sha256 {applied.spec_sha256[:12]}",
    )
    if args.json:
        _print_json(applied.as_dict())
        return
    th = ", ".join(f"{k}={v:g}" for k, v in applied.rule.thresholds.items())
    print(
        f"{applied.hypothesis}/{applied.experiment} frozen: rule {applied.rule.kind} "
        f"v{applied.rule.version} ({th}), spec {applied.spec_path.name} "
        f"sha256 {applied.spec_sha256}"
    )
    if applied.defaulted:
        print(f"defaulted from the template: {', '.join(applied.defaulted)}")
    print(applied.task_dir)


def add_intake_parser(sub: Any) -> None:
    s = sub.add_parser(
        "intake",
        help="Turn a template and a few answers into a frozen quant experiment plan",
    )
    isub = s.add_subparsers(dest="action", required=True)

    a = isub.add_parser(
        "templates", help="List the quant templates and their seed programs"
    )
    a.add_argument("--json", action="store_true")
    a.set_defaults(func=cmd_templates, resolve="none")

    a = isub.add_parser(
        "questions", help="List what is still open in a template or a draft spec"
    )
    which = a.add_mutually_exclusive_group(required=True)
    which.add_argument("--template", help="A template id from `intake templates`")
    which.add_argument(
        "--spec", help="A JSON draft (its `template` names the template)"
    )
    a.add_argument("--json", action="store_true")
    a.set_defaults(func=cmd_questions, resolve="none")

    a = isub.add_parser(
        "apply",
        help="Add the hypothesis, scaffold its experiment and freeze the plan "
        f"(the owner's, never from the agent environment {grants.AGENT_ENV})",
    )
    _add_dir(a)
    a.add_argument(
        "--spec", required=True, help="JSON draft with every open question answered"
    )
    a.add_argument(
        "--data", required=True, help="CSV with the columns the template reads"
    )
    a.add_argument("--json", action="store_true")
    a.set_defaults(func=cmd_apply)
