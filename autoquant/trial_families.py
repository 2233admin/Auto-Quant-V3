"""Desk-level trial-family ledger keyed by a deterministic question fingerprint.

A Project-local research family (``selection.py``) only sees its own Runs. A
host can delegate the same question again in a new Project, so the desk keeps
one ledger file per *trial family* under ``trial-families/`` at the Workspace
root. Every counted trial of every Project registers there, and the
selection-adjusted evidence of a Project adds the trials that other Projects
spent on the same question. See docs/design/desk-trial-families.md.

The ledger is operational desk state, never research evidence: it is written
only by ``aq`` commands (never by reads), and reads always union it with a live
scan so existing Projects get their family on first read without rewriting any
immutable Run.
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .runs import list_runs, load_run
from .workspace import AutoQuantValidationError, ProjectContext, ValidationIssue, load_project, load_workspace


LEDGER_DIRECTORY = "trial-families"
FAMILY_KIND = "autoquant-trial-family"
FINGERPRINT_METHOD = "question-and-caller-scope-v1"
SCHEMA_VERSION = 1
DECLARATIONS = ("same-family", "new-hypothesis")
FAMILY_ID = re.compile(r"^tf-[0-9a-f]{16}$")
WORKSPACE_MANIFEST = "autoquant-workspace.json"
_TRAILING = ".?!;:。？！；：…"
_QUOTES = "\"'`“”‘’«»「」『』"
_CACHE: dict[str, tuple[tuple[int, int], Any]] = {}


def _issue(path: Path | str, code: str, message: str) -> AutoQuantValidationError:
    return AutoQuantValidationError([ValidationIssue(str(path), code, message)])


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _canonical_hash(value: Any) -> str:
    text = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _read_cached_json(path: Path) -> Any:
    """Parsed JSON or ``None`` when absent/unreadable; memoized by mtime/size."""

    try:
        if path.is_symlink() or not path.is_file():
            return None
        stat = path.stat()
    except OSError:
        return None
    key = str(path)
    stamp = (stat.st_mtime_ns, stat.st_size)
    cached = _CACHE.get(key)
    if cached is not None and cached[0] == stamp:
        return cached[1]
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        value = None
    _CACHE[key] = (stamp, value)
    return value


def normalize_question(text: Any) -> str | None:
    """Unicode-normalized, case-folded, whitespace-collapsed question text.

    Only presentation differences are removed: case, width, whitespace,
    surrounding quotes and trailing sentence punctuation. Any change in words
    is a different text and at most a *possible related* family.
    """

    if not isinstance(text, str):
        return None
    value = unicodedata.normalize("NFKC", text).casefold()
    value = " ".join(value.split())
    previous = None
    while value and value != previous:
        previous = value
        value = value.strip().strip(_QUOTES).rstrip(_TRAILING).strip()
    return value or None


def _sorted_strings(values: Any) -> list[str] | None:
    if not isinstance(values, list):
        return None
    return sorted({item for item in values if isinstance(item, str)})


def _study_paths(project: ProjectContext, study_id: str) -> tuple[Path, dict[str, Any] | None]:
    root = project.root_dir / project.manifest.directories["studies"] / study_id
    return root, _read_cached_json(root / "study.json")


def _dependency(project: ProjectContext, study: dict[str, Any], suffix: str, fallback: str) -> Any:
    paths = ((study.get("dependencies") or {}).get("paths") or []) if isinstance(study, dict) else []
    for relative in paths:
        if isinstance(relative, str) and relative.endswith(suffix) and "*" not in relative:
            return _read_cached_json(project.root_dir / relative)
    return _read_cached_json(project.root_dir / fallback)


def study_fingerprint(project: ProjectContext, study_id: str) -> dict[str, Any] | None:
    """Deterministic question fingerprint for one Study of one Project.

    Fields (and only these) define "the same hypothesis":

    - ``question``: normalized Research Request question, or the Project
      description when no request is bound;
    - ``scope.objectKind``: the Study subject kind (factor, portfolio, model…);
    - ``scope.objective``: fixed selection metric and direction;
    - ``scope.target``: caller-owned Factor claim/outcome and trade direction;
    - ``scope.universe``: sorted request assets and sorted prediction assets;
    - ``scope.horizon``: the bound primary forward-bar horizon;
    - ``scope.splitProtocol``: selection split implied by the objective and
      the fixed Judge entrypoint that owns the split.

    Missing caller facts stay ``None``; nothing is defaulted.
    """

    _, study = _study_paths(project, study_id)
    if not isinstance(study, dict):
        return None
    request = _dependency(project, study, f"/{study_id}/request.json", "request.json")
    request = request if isinstance(request, dict) else None
    horizon = _dependency(project, study, "research-horizon.json", "strategies/research-horizon.json")
    factor_policy = (request or {}).get("factorPolicy") if request else None
    factor_policy = factor_policy if isinstance(factor_policy, dict) else {}
    objective = study.get("objective") if isinstance(study.get("objective"), dict) else {}
    metric = objective.get("metric")
    assets = None
    if request and isinstance(request.get("assets"), list):
        assets = _sorted_strings([item.get("symbol") for item in request["assets"] if isinstance(item, dict)])
    elif isinstance((study.get("dataset") or {}).get("universe"), list):
        assets = _sorted_strings(study["dataset"]["universe"])
    primary = horizon.get("primaryForwardBars") if isinstance(horizon, dict) else None
    if primary is None and request and isinstance(request.get("horizonPolicy"), dict):
        primary = request["horizonPolicy"].get("primaryForwardBars")
    question = normalize_question(request.get("question") if request else project.manifest.description)
    scope = {
        "objectKind": (study.get("subject") or {}).get("kind"),
        "objective": {"metric": metric, "direction": objective.get("direction")},
        "target": {
            "claim": factor_policy.get("claim"),
            "outcome": factor_policy.get("outcome"),
            "direction": request.get("direction") if request else None,
        },
        "universe": {"assets": assets, "predictionAssets": _sorted_strings(factor_policy.get("predictionAssets"))},
        "horizon": {"primaryForwardBars": primary if isinstance(primary, int) and not isinstance(primary, bool) else None},
        "splitProtocol": {
            "selectionSplit": metric.split("_", 1)[0] if isinstance(metric, str) and "_" in metric else None,
            "judgeEntrypoint": (study.get("judge") or {}).get("entrypoint"),
        },
    }
    fingerprint = {"method": FINGERPRINT_METHOD, "question": question, "scope": scope,
                   "questionSource": "request" if request else "project-description"}
    fingerprint["scopeHash"] = _canonical_hash(scope)
    fingerprint["hash"] = _canonical_hash({"question": question, "scope": scope})
    fingerprint["familyId"] = "tf-" + fingerprint["hash"][:16]
    return fingerprint


def editable_study(project: ProjectContext, study_id: str) -> bool:
    _, study = _study_paths(project, study_id)
    paths = ((study or {}).get("editable") or {}).get("paths") if isinstance(study, dict) else None
    return bool(paths)


def _study_ids(project: ProjectContext) -> list[str]:
    root = project.root_dir / project.manifest.directories["studies"]
    try:
        return sorted(p.name for p in root.iterdir() if p.is_dir() and not p.is_symlink() and (p / "study.json").is_file())
    except OSError:
        return []


def _holdout_bound(project: ProjectContext) -> bool:
    # Frozen holdout targets re-evaluate already counted sources; they do not search.
    return (project.root_dir / "holdout").is_dir()


# -- workspace and ledger ----------------------------------------------------


def workspace_root_for(project: ProjectContext) -> Path | None:
    """Owning Workspace root when ``project`` is a directly discovered Project."""

    root = next((p for p in project.root_dir.parents if (p / WORKSPACE_MANIFEST).is_file()), None)
    if root is None:
        return None
    try:
        workspace = load_workspace(root)
    except (OSError, AutoQuantValidationError):
        return None
    if project.root_dir.parent.resolve() != workspace.projects_dir.resolve():
        return None
    return workspace.root_dir


def _workspace_projects(root: Path) -> list[ProjectContext]:
    workspace = load_workspace(root)
    projects = []
    for path in sorted(workspace.projects_dir.iterdir()):
        if not path.is_dir() or path.is_symlink() or path.name.startswith("."):
            continue
        try:
            projects.append(load_project(path))
        except (OSError, AutoQuantValidationError):
            continue
    return projects


def _validate_family(raw: Any, path: Path) -> dict[str, Any]:
    keys = {"schemaVersion", "kind", "id", "fingerprint", "createdAt", "members", "declarations", "trials"}
    if not isinstance(raw, dict) or set(raw) != keys or raw["kind"] != FAMILY_KIND or raw["schemaVersion"] != SCHEMA_VERSION:
        raise _issue(path, "trial-family.schema", "Trial-family ledger file has an unsupported shape")
    if not isinstance(raw["id"], str) or not FAMILY_ID.fullmatch(raw["id"]) or path.stem != raw["id"]:
        raise _issue(path, "trial-family.id", "Trial-family file name must equal its id")
    if not all(isinstance(raw[key], list) for key in ("members", "declarations", "trials")):
        raise _issue(path, "trial-family.schema", "Trial-family members, declarations and trials must be arrays")
    for trial in raw["trials"]:
        if not isinstance(trial, dict) or not all(isinstance(trial.get(k), str) for k in ("projectId", "studyId", "runId", "sourceHash", "completedAt", "registeredAt")):
            raise _issue(path, "trial-family.trial", "Every registered trial needs Project, Study, Run, source and timestamps")
    return raw


def load_ledger(root: Path) -> dict[str, dict[str, Any]]:
    """Every family file; a present but malformed file fails closed."""

    directory = root / LEDGER_DIRECTORY
    if not directory.exists():
        return {}
    if directory.is_symlink() or not directory.is_dir():
        raise _issue(directory, "trial-family.path", "Trial-family ledger must be a real directory")
    families = {}
    for path in sorted(directory.glob("tf-*.json")):
        if path.is_symlink() or not path.is_file():
            raise _issue(path, "trial-family.path", "Trial-family entries must be real files")
        raw = _read_cached_json(path)
        if raw is None:
            raise _issue(path, "trial-family.json", "Cannot read trial-family ledger file")
        families[path.stem] = _validate_family(raw, path)
    return families


# -- resolution --------------------------------------------------------------


def _declared(ledger: dict[str, dict[str, Any]], project_id: str, study_id: str) -> dict[str, Any] | None:
    for family in ledger.values():
        for item in family["declarations"]:
            if item.get("projectId") == project_id and item.get("studyId") == study_id:
                return {**item, "familyId": family["id"]}
    return None


def _live_index(root: Path) -> dict[tuple[str, str], dict[str, Any]]:
    index = {}
    for owner in _workspace_projects(root):
        if _holdout_bound(owner):
            continue
        for study_id in _study_ids(owner):
            fingerprint = study_fingerprint(owner, study_id)
            if fingerprint is not None:
                index[(owner.manifest.id, study_id)] = {"project": owner, "fingerprint": fingerprint}
    return index


def _resolve(ledger, live, project_id: str, study_id: str, fingerprint: dict[str, Any]) -> dict[str, Any]:
    declaration = _declared(ledger, project_id, study_id)
    if declaration is not None and declaration["declaration"] == "same-family":
        family_id, joined = declaration["familyId"], "declared-same-family"
    else:
        family_id, joined = fingerprint["familyId"], "fingerprint"
    acknowledged = set(declaration.get("relatedFamilyIds", [])) if declaration else set()
    scopes: dict[str, dict[str, Any]] = {}
    for family in ledger.values():
        owners = {(m["projectId"], m["studyId"]) for m in family["members"]}
        owners |= {(t["projectId"], t["studyId"]) for t in family["trials"]}
        if owners <= {(project_id, study_id)}:
            # This Study's own earlier registration is not a different question.
            continue
        scopes[family["id"]] = family["fingerprint"]
    for (pid, sid), entry in live.items():
        other = _declared(ledger, pid, sid)
        if other is None or other["declaration"] != "same-family":
            scopes.setdefault(entry["fingerprint"]["familyId"], entry["fingerprint"])
    related = []
    for other_id, other in sorted(scopes.items()):
        if other_id == family_id or other.get("scopeHash") != fingerprint["scopeHash"] or other_id in acknowledged:
            continue
        # A new-hypothesis declaration is symmetric: the other side need not repeat it.
        reverse = any(item.get("declaration") == "new-hypothesis" and family_id in item.get("relatedFamilyIds", [])
                      for item in ledger.get(other_id, {}).get("declarations", []))
        if not reverse:
            related.append({"familyId": other_id, "question": other.get("question")})
    return {"familyId": family_id, "joinedBy": joined, "declaration": declaration["declaration"] if declaration else None,
            "possibleRelatedFamilies": related, "declarationRequired": bool(related)}


def _members(ledger, live, family_id: str) -> set[tuple[str, str]]:
    members = {(m["projectId"], m["studyId"]) for m in ledger.get(family_id, {}).get("members", [])}
    for (pid, sid), entry in live.items():
        declaration = _declared(ledger, pid, sid)
        resolved = declaration["familyId"] if declaration and declaration["declaration"] == "same-family" else entry["fingerprint"]["familyId"]
        if resolved == family_id:
            members.add((pid, sid))
    return members


def _live_trials(live, members) -> list[dict[str, Any]]:
    trials = []
    for key in sorted(members):
        entry = live.get(key)
        if entry is None:
            continue
        owner = entry["project"]
        try:
            summaries = list_runs(owner, key[1])
        except (OSError, AutoQuantValidationError):
            continue
        for summary in summaries:
            try:
                run = load_run(owner, summary.id)
            except (OSError, AutoQuantValidationError):
                continue
            trials.append({"projectId": key[0], "studyId": key[1], "runId": run.result["id"],
                           "sourceHash": run.result["subject"]["sourceHash"], "status": run.result["status"],
                           "completedAt": run.result["completedAt"], "registeredAt": None})
    return trials


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def family_state(project: ProjectContext, study_id: str, *, cutoff: str | None = None,
                 exclude_projects: frozenset[str] = frozenset()) -> dict[str, Any] | None:
    """Desk-wide family projection for one Project Study, or ``None`` outside a Workspace.

    ``cutoff`` (an ISO timestamp) restricts counting to trials registered in
    the ledger and completed no later than it, so an immutable Report stays
    verifiable: trials discovered later never enter an earlier as-of family.
    """

    root = workspace_root_for(project)
    fingerprint = study_fingerprint(project, study_id)
    if root is None or fingerprint is None:
        return None
    ledger = load_ledger(root)
    live = _live_index(root)
    resolution = _resolve(ledger, live, project.manifest.id, study_id, fingerprint)
    family_id = resolution["familyId"]
    members = _members(ledger, live, family_id) | {(project.manifest.id, study_id)}
    registered = list(ledger.get(family_id, {}).get("trials", []))
    known = {(t["projectId"], t["studyId"], t["runId"]) for t in registered}
    trials = registered + ([t for t in _live_trials(live, members) if (t["projectId"], t["studyId"], t["runId"]) not in known]
                           if cutoff is None else [])
    if cutoff is not None:
        limit = _parse_time(cutoff)
        trials = [t for t in trials if _parse_time(t["registeredAt"]) <= limit and _parse_time(t["completedAt"]) <= limit]
    first_seen: dict[tuple[str, str, str], str] = {}
    for trial in trials:
        key = (trial["projectId"], trial["studyId"], trial["sourceHash"])
        if key not in first_seen or _parse_time(trial["completedAt"]) < _parse_time(first_seen[key]):
            first_seen[key] = trial["completedAt"]
    other = sorted(k for k in first_seen if k[0] != project.manifest.id and k[0] not in exclude_projects)
    return {
        "schemaVersion": SCHEMA_VERSION, "kind": FAMILY_KIND, "id": family_id,
        "fingerprintMethod": FINGERPRINT_METHOD, "fingerprintHash": fingerprint["hash"],
        "question": fingerprint["question"], "scope": fingerprint["scope"],
        "joinedBy": resolution["joinedBy"], "declaration": resolution["declaration"],
        "declarationRequired": resolution["declarationRequired"],
        "possibleRelatedFamilies": resolution["possibleRelatedFamilies"],
        "memberProjects": sorted({pid for pid, _ in members}),
        "deskTrialCount": len(first_seen),
        "otherProjectTrials": len(other),
        "otherProjectTrialsHash": _canonical_hash([list(k) for k in other]),
        "registered": family_id in ledger,
        "cutoff": cutoff if cutoff is not None else "current",
        "trialCountAssumption": "unique-project-study-source-upper-bound",
        "trialTimes": sorted(first_seen.values()),
    }


def desk_inheritance(project: ProjectContext, study_id: str, *, cutoff: str | None,
                     exclude_projects: frozenset[str]) -> dict[str, Any] | None:
    """Compact block merged into a research-family projection when other Projects tried this question."""

    state = family_state(project, study_id, cutoff=cutoff, exclude_projects=exclude_projects)
    if state is None or state["otherProjectTrials"] == 0:
        return None
    return {
        "kind": FAMILY_KIND, "id": state["id"], "fingerprintHash": state["fingerprintHash"],
        "deskTrialCount": state["deskTrialCount"], "otherProjectTrials": state["otherProjectTrials"],
        "otherProjectTrialsHash": state["otherProjectTrialsHash"],
        "countAssumption": state["trialCountAssumption"],
    }


def project_family_summary(project: ProjectContext) -> list[dict[str, Any]]:
    """Per-Study family states for Project creation and orientation output."""

    summary = []
    for study_id in _study_ids(project):
        if not editable_study(project, study_id):
            continue
        state = family_state(project, study_id)
        if state is not None:
            state = {k: v for k, v in state.items() if k != "trialTimes"}
            summary.append({"studyId": study_id, **state})
    return summary

