"""Core per-desk research budget and per-trial acknowledgement gate.

Any Agent that spends a counted trial through ``aq`` (OpenAlice's native Agent,
a coding Agent, Studio, or the Studio Assistant) passes through this gate. It
replaces safeguards that previously lived only in the Studio Assistant. See
docs/design/desk-trial-families.md ("Core trial gate").
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .cli_contract import CliCommandError
from .trial_families import _parse_time, _read_cached_json, editable_study, family_state, workspace_root_for
from .trial_family_ledger import register_project
from .workspace import AutoQuantValidationError, ProjectContext, ValidationIssue


POLICY_FILE = "autoquant-research-policy.json"
POLICY_KIND = "autoquant-research-policy"
DEFAULT_MAX_TRIALS = 20
DEFAULT_WINDOW_DAYS = 30
TRIAL_COMMANDS = frozenset({"run.execute", "session.start", "experiment.evaluate", "research.run"})


def _refuse(code: str, message: str, state: dict[str, Any] | None = None) -> CliCommandError:
    context = {"scope": "global", "trialGate": state} if state is not None else None
    return CliCommandError(code, message, issues=[ValidationIssue("trialGate", code, message)], context=context)


def load_policy(root: Path | None) -> dict[str, Any]:
    """Desk budget policy; absent means the documented default, malformed fails closed."""

    default = {"maxCountedTrialsPerFamily": DEFAULT_MAX_TRIALS, "windowDays": DEFAULT_WINDOW_DAYS, "source": "default"}
    if root is None:
        return default
    path = root / POLICY_FILE
    if not path.exists() and not path.is_symlink():
        return default
    raw = _read_cached_json(path)
    budget = raw.get("trialBudget") if isinstance(raw, dict) else None
    valid = (
        isinstance(raw, dict) and set(raw) == {"schemaVersion", "kind", "trialBudget"}
        and raw["schemaVersion"] == 1 and raw["kind"] == POLICY_KIND
        and isinstance(budget, dict) and set(budget) == {"maxCountedTrialsPerFamily", "windowDays"}
        and all(type(budget[k]) is int and budget[k] >= 1 for k in budget)
    )
    if not valid:
        raise _refuse("trial-gate.policy-invalid",
                      f"{path} must be {{schemaVersion: 1, kind: {POLICY_KIND}, trialBudget: "
                      "{maxCountedTrialsPerFamily: int>=1, windowDays: int>=1}}")
    return {**budget, "source": POLICY_FILE}


def gate_state(project: ProjectContext, study_id: str, *, planned: int = 1,
               now: datetime | None = None) -> dict[str, Any] | None:
    """Budget and declaration state for spending ``planned`` trials, or ``None`` if ungated."""

    if not editable_study(project, study_id):
        return None
    root = workspace_root_for(project)
    policy = load_policy(root)
    try:
        family = family_state(project, study_id)
    except AutoQuantValidationError as error:
        raise _refuse("trial-gate.ledger-invalid", str(error)) from error
    current = now or datetime.now(timezone.utc)
    start = current - timedelta(days=policy["windowDays"])
    times = family["trialTimes"] if family else []
    used = sum(1 for value in times if _parse_time(value) >= start)
    limit = policy["maxCountedTrialsPerFamily"]
    reason = None
    if family and family["declarationRequired"]:
        reason = "trial-gate.family-declaration-required"
    elif used + planned > limit:
        reason = "trial-gate.budget-exhausted"
    return {
        "familyId": family["id"] if family else None,
        "deskTrialCount": family["deskTrialCount"] if family else None,
        "possibleRelatedFamilies": family["possibleRelatedFamilies"] if family else [],
        "budget": {"maxCountedTrialsPerFamily": limit, "windowDays": policy["windowDays"],
                   "policySource": policy["source"], "usedInWindow": used,
                   "remaining": max(0, limit - used), "windowStart": start.isoformat()},
        "planned": planned,
        "nextTrial": used + 1,
        "allowed": reason is None,
        "refusal": reason,
        "acknowledgement": "--confirm-trial",
    }


def enforce(project: ProjectContext, study_id: str, *, confirmed: bool, planned: int = 1) -> dict[str, Any] | None:
    """Raise a stable-code refusal unless the trial may be spent now."""

    state = gate_state(project, study_id, planned=planned)
    if state is None:
        return None
    family = state["familyId"]
    if state["refusal"] == "trial-gate.family-declaration-required":
        related = ", ".join(item["familyId"] for item in state["possibleRelatedFamilies"])
        raise _refuse(state["refusal"],
                      f"Study {study_id} may repeat trial family {related}. State the caller-owned answer first: "
                      f"aq family declare <path> --project {project.manifest.id} --study {study_id} "
                      "(--same-family FAMILY_ID | --new-hypothesis)", state)
    if state["refusal"] == "trial-gate.budget-exhausted":
        budget = state["budget"]
        raise _refuse(state["refusal"],
                      f"Trial family {family} already spent {budget['usedInWindow']} of "
                      f"{budget['maxCountedTrialsPerFamily']} counted trials in the last {budget['windowDays']} days "
                      f"(planned {planned}); the desk policy ({budget['policySource']}) refuses more", state)
    if not confirmed:
        raise _refuse("trial-gate.confirmation-required",
                      f"This command spends counted trial {state['nextTrial']} of family {family} "
                      f"(budget {state['budget']['maxCountedTrialsPerFamily']} per {state['budget']['windowDays']} days). "
                      "Every trial is counted against selection-adjusted evidence; rerun with --confirm-trial to acknowledge.",
                      state)
    return state


def gated(args: Any, select_project, handler, study_for_session) -> Any:
    """Run a trial-spending CLI handler behind the gate and register its Runs."""

    project = select_project(args)
    study_id = getattr(args, "study", None) or study_for_session(project, args.session)
    planned = getattr(args, "max_turns", 1) if args.command_id == "research.run" else 1
    enforce(project, study_id, confirmed=bool(getattr(args, "confirm_trial", False)), planned=max(1, planned))
    try:
        return handler(args)
    finally:
        register_project(project)


HANDOFF_COMMAND = ("aq handoff {root} --project {project} (--run ID | --report ID | --dossier ID) "
                   "--valid-from YYYY-MM-DD --valid-until YYYY-MM-DD --review-date YYYY-MM-DD "
                   "[--assumption TEXT] [--unsupported-claim TEXT] "
                   "[--external-holdout-digest SHA256 --external-holdout-status STATUS] --json")


def desk_research_projection(project: ProjectContext) -> dict[str, Any]:
    """Orientation block: trial families, budget state and the handoff command."""

    from .trial_families import project_family_summary

    keys = ("id", "deskTrialCount", "otherProjectTrials", "joinedBy", "declaration",
            "declarationRequired", "possibleRelatedFamilies", "registered")
    try:
        families = []
        for item in project_family_summary(project):
            state = gate_state(project, item["studyId"])
            families.append({"studyId": item["studyId"], **{k: item[k] for k in keys},
                             # windowStart is time-varying; orientation stays deterministic.
                             "budget": ({k: v for k, v in state["budget"].items() if k != "windowStart"}
                                        if state else None),
                             "nextTrial": state["nextTrial"] if state else None,
                             "refusal": state["refusal"] if state else None})
        status, reason = "available", None
    except (CliCommandError, AutoQuantValidationError) as error:
        families, status, reason = [], "invalid", str(error)
    return {
        "status": status, "reason": reason,
        "trialFamilies": families,
        "trialGate": {"commands": sorted(TRIAL_COMMANDS), "acknowledgement": "--confirm-trial",
                      "policyFile": POLICY_FILE,
                      "declare": f"aq family declare {project.root_dir} --study STUDY (--same-family FAMILY_ID | --new-hypothesis) --json",
                      "show": f"aq family show {project.root_dir} --json"},
        "handoff": {"command": HANDOFF_COMMAND.format(root=project.root_dir, project=project.manifest.id),
                    "schema": "aq schema research-handoff",
                    "callerOwned": ["validFrom", "validUntil", "reviewDate"],
                    "plainTextEnding": "Primary deliverable directory: <absolute path>"},
    }
