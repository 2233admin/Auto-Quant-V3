"""CLI registration and dispatch for desk-level trial families and handoffs."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .cli_contract import artifact, next_action, project_context, workspace_context
from .handoff import HANDOFF_FILE, build_handoff, write_handoff
from .trial_families import family_state, project_family_summary
from .trial_family_ledger import declare_family, register_project
from .trial_gate import gate_state
from .workspace import load_project, load_workspace


DESK_COMMANDS = frozenset({"family.list", "family.show", "family.declare", "handoff"})
CREATION_COMMANDS = frozenset({"project.create", "project.intake", "project.from-factor"})


def add_desk_parsers(subcommands, json_argument) -> None:
    family = subcommands.add_parser("family", help="inspect and declare desk-level trial families")
    actions = family.add_subparsers(dest="family_action", required=True)
    listing = actions.add_parser("list", help="list every desk trial family and its desk-wide count")
    listing.add_argument("workspace")
    listing.set_defaults(command_id="family.list")
    json_argument(listing)
    show = actions.add_parser("show", help="show a Project's trial families, related families and budget")
    show.add_argument("path")
    show.add_argument("--project")
    show.set_defaults(command_id="family.show")
    json_argument(show)
    declare = actions.add_parser("declare", help="record the caller-owned same-family or new-hypothesis answer")
    declare.add_argument("path")
    declare.add_argument("--project")
    declare.add_argument("--study", required=True)
    choice = declare.add_mutually_exclusive_group(required=True)
    choice.add_argument("--same-family", metavar="FAMILY_ID")
    choice.add_argument("--new-hypothesis", action="store_true")
    declare.set_defaults(command_id="family.declare")
    json_argument(declare)
    handoff = subcommands.add_parser("handoff", help="write the versioned handoff.json for one Run, Report or Dossier")
    handoff.add_argument("path")
    handoff.add_argument("--project")
    subject = handoff.add_mutually_exclusive_group(required=True)
    subject.add_argument("--run")
    subject.add_argument("--report")
    subject.add_argument("--dossier")
    handoff.add_argument("--valid-from", help="caller-owned first valid date YYYY-MM-DD (required)")
    handoff.add_argument("--valid-until", help="caller-owned last valid date YYYY-MM-DD (required)")
    handoff.add_argument("--review-date", help="caller-owned review date YYYY-MM-DD (required)")
    handoff.add_argument("--assumption", action="append", default=[])
    handoff.add_argument("--unsupported-claim", action="append", default=[])
    handoff.add_argument("--external-holdout-digest", help="SHA-256 of the host-held external holdout")
    handoff.add_argument("--external-holdout-status", choices=("pending", "passed", "failed", "inconclusive"))
    handoff.set_defaults(command_id="handoff")
    json_argument(handoff)


def _families(workspace: str) -> list[dict[str, Any]]:
    from .trial_families import _study_ids, _workspace_projects, editable_study
    root = load_workspace(workspace).root_dir
    families: dict[str, dict[str, Any]] = {}
    for project in _workspace_projects(root):
        for study_id in _study_ids(project):
            if not editable_study(project, study_id):
                continue
            state = family_state(project, study_id)
            if state is None:
                continue
            entry = families.setdefault(state["id"], {"id": state["id"], "question": state["question"],
                                                      "deskTrialCount": state["deskTrialCount"],
                                                      "registered": state["registered"], "members": []})
            entry["members"].append({"projectId": project.manifest.id, "studyId": study_id,
                                     "declarationRequired": state["declarationRequired"]})
    return sorted(families.values(), key=lambda item: item["id"])


def run_desk_command(args, select_project, result_type):
    if args.command_id == "family.list":
        data = {"families": _families(args.workspace)}
        lines = [f"{f['id']}  trials={f['deskTrialCount']}  {f['question']}" for f in data["families"]]
        return result_type("family.list", data, "\n".join(lines) + "\n",
                           context=workspace_context(load_workspace(args.workspace)))
    project = select_project(args)
    if args.command_id == "family.show":
        families = project_family_summary(project)
        for item in families:
            item["trialGate"] = gate_state(project, item["studyId"])
        lines = [f"{f['studyId']}: {f['id']} desk trials={f['deskTrialCount']} "
                 f"declarationRequired={str(f['declarationRequired']).lower()}" for f in families]
        return result_type("family.show", {"families": families}, "\n".join(lines) + "\n",
                           context=project_context(project))
    if args.command_id == "family.declare":
        state = declare_family(project, args.study, "new-hypothesis" if args.new_hypothesis else "same-family",
                               args.same_family)
        state.pop("trialTimes", None)
        return result_type("family.declare", state,
                           f"{args.study}: family {state.get('id')} ({state.get('declaration')})\n",
                           context=project_context(project))
    kind, subject_id = next((k, getattr(args, k)) for k in ("run", "report", "dossier") if getattr(args, k))
    handoff = build_handoff(
        project, kind=kind, subject_id=subject_id, valid_from=args.valid_from, valid_until=args.valid_until,
        review_date=args.review_date, assumptions=args.assumption, unsupported_claims=args.unsupported_claim,
        holdout_digest=args.external_holdout_digest, holdout_status=args.external_holdout_status)
    target = write_handoff(handoff)
    words = ", ".join(f"{v['studyId']}={v['word'] or 'no-core-verdict'}" for v in handoff["verdicts"])
    human = (f"Handoff written: {target}\nVerdicts: {words}\nTrading authority: none\n"
             f"Primary deliverable directory: {handoff['primaryDeliverableDirectory']}\n")
    return result_type("handoff", {"handoffPath": str(target), "handoff": handoff}, human,
                       context=project_context(project),
                       artifacts=[artifact("research-handoff", HANDOFF_FILE, target, immutable=False)])


def with_family_summary(args, result):
    """Register a newly created Project and disclose its trial families."""

    directory = (result.data or {}).get("projectDir") if isinstance(result.data, dict) else None
    if directory is None:
        directory = load_workspace(args.workspace).projects_dir / args.project_id
    project = load_project(Path(directory))
    register_project(project)
    families = project_family_summary(project)
    if isinstance(result.data, dict):
        result.data["trialFamilies"] = families
    for item in families:
        if item["declarationRequired"]:
            related = ", ".join(r["familyId"] for r in item["possibleRelatedFamilies"])
            result.human += (f"Possible related trial family for {item['studyId']}: {related}. "
                             "State same-family or new-hypothesis before the first trial.\n")
            result.next_actions.append(next_action(
                "family.declare",
                f"Caller-owned: is Study {item['studyId']} the same hypothesis as {related}?",
                ["aq", "family", "declare", str(project.root_dir), "--study", item["studyId"],
                 "(--same-family FAMILY_ID | --new-hypothesis)", "--json"],
                "mutates-workspace"))
    return result


__all__ = ["CREATION_COMMANDS", "DESK_COMMANDS", "add_desk_parsers", "run_desk_command", "with_family_summary"]
