"""Write side of the desk trial-family ledger (registration and declarations).

Only ``aq`` commands call these; reads in ``trial_families`` never write.
See docs/design/desk-trial-families.md.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from .trial_families import (DECLARATIONS, FAMILY_ID, FAMILY_KIND, LEDGER_DIRECTORY, SCHEMA_VERSION, _declared,
                             _holdout_bound, _issue, _live_index, _live_trials, _resolve, _study_ids,
                             _workspace_projects, family_state, load_ledger, now_utc, study_fingerprint,
                             workspace_root_for)
from .workspace import ProjectContext

def _write_family(root: Path, family: dict[str, Any]) -> None:
    directory = root / LEDGER_DIRECTORY
    directory.mkdir(exist_ok=True)
    target = directory / f"{family['id']}.json"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=directory, prefix=f".{target.name}.", suffix=".tmp", delete=False) as handle:
        json.dump(family, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, target)

def _new_family(fingerprint: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION, "kind": FAMILY_KIND, "id": fingerprint["familyId"],
        "fingerprint": {k: fingerprint[k] for k in ("method", "question", "scope", "scopeHash", "hash")},
        "createdAt": now_utc(), "members": [], "declarations": [], "trials": [],
    }

def register_project(project: ProjectContext) -> list[dict[str, Any]]:
    """Idempotently register every Study membership and Run of ``project``.

    Returns the changed family ids. Already registered Runs keep their first
    ``registeredAt``; nothing is ever removed, so a deleted Project's trials
    still count.
    """

    root = workspace_root_for(project)
    if root is None or _holdout_bound(project):
        return []
    ledger = load_ledger(root)
    live = _live_index(root)
    changed: dict[str, dict[str, Any]] = {}
    stamp = now_utc()
    for study_id in _study_ids(project):
        fingerprint = study_fingerprint(project, study_id)
        if fingerprint is None:
            continue
        resolution = _resolve(ledger, live, project.manifest.id, study_id, fingerprint)
        family = changed.get(resolution["familyId"]) or ledger.get(resolution["familyId"])
        if family is None:
            family = _new_family(fingerprint)
        family = json.loads(json.dumps(family))
        dirty = family["id"] not in ledger
        member = {"projectId": project.manifest.id, "studyId": study_id}
        if not any(m["projectId"] == member["projectId"] and m["studyId"] == study_id for m in family["members"]):
            family["members"].append({**member, "joinedBy": resolution["joinedBy"],
                                      "fingerprintHash": fingerprint["hash"], "joinedAt": stamp})
            dirty = True
        known = {(t["projectId"], t["studyId"], t["runId"]) for t in family["trials"]}
        for trial in _live_trials(live, {(project.manifest.id, study_id)}):
            if (trial["projectId"], trial["studyId"], trial["runId"]) not in known:
                family["trials"].append({**trial, "registeredAt": stamp})
                dirty = True
        if dirty:
            family["members"].sort(key=lambda m: (m["projectId"], m["studyId"]))
            family["trials"].sort(key=lambda t: (t["completedAt"], t["projectId"], t["runId"]))
            changed[family["id"]] = family
    for family in changed.values():
        _write_family(root, family)
    return sorted(changed)

def register_workspace(root: Path) -> list[str]:
    changed: set[str] = set()
    for owner in _workspace_projects(root):
        changed.update(register_project(owner))
    return sorted(changed)

def declare_family(project: ProjectContext, study_id: str, declaration: str,
                   same_family_id: str | None = None) -> dict[str, Any]:
    """Record the caller-owned answer for a possible related family."""

    root = workspace_root_for(project)
    fingerprint = study_fingerprint(project, study_id)
    if root is None or fingerprint is None:
        raise _issue(project.root_dir, "trial-family.unavailable", "The Project Study is not inside an effective Workspace")
    if declaration not in DECLARATIONS:
        raise _issue("declaration", "trial-family.declaration", "Declaration must be same-family or new-hypothesis")
    ledger = load_ledger(root)
    live = _live_index(root)
    if _declared(ledger, project.manifest.id, study_id) is not None:
        raise _issue(project.root_dir, "trial-family.already-declared", "This Project Study already declared its trial family; declarations are append-only")
    counted_in = {family["id"] for family in ledger.values() for t in family["trials"]
                  if t["projectId"] == project.manifest.id and t["studyId"] == study_id}
    target = same_family_id if declaration == "same-family" else fingerprint["familyId"]
    if counted_in - {target}:
        raise _issue(project.root_dir, "trial-family.has-trials",
                     "Trials already counted in another family cannot be moved")
    resolution = _resolve(ledger, live, project.manifest.id, study_id, fingerprint)
    related = [item["familyId"] for item in resolution["possibleRelatedFamilies"]]
    if declaration == "same-family":
        if same_family_id is None or not FAMILY_ID.fullmatch(same_family_id):
            raise _issue("same-family", "trial-family.target", "same-family requires an exact family id")
        known = set(ledger) | {entry["fingerprint"]["familyId"] for entry in live.values()}
        if same_family_id not in known:
            raise _issue("same-family", "trial-family.unknown", f"Unknown trial family: {same_family_id}")
        target_id = same_family_id
    else:
        if same_family_id is not None:
            raise _issue("same-family", "trial-family.target", "new-hypothesis takes no family id")
        target_id = fingerprint["familyId"]
    family = ledger.get(target_id)
    if family is None:
        source = next((e["fingerprint"] for e in live.values() if e["fingerprint"]["familyId"] == target_id), fingerprint)
        family = _new_family(source)
    stamp = now_utc()
    family["declarations"].append({"projectId": project.manifest.id, "studyId": study_id, "declaration": declaration,
                                   "relatedFamilyIds": sorted(set(related) - {target_id}),
                                   "fingerprintHash": fingerprint["hash"], "declaredAt": stamp})
    _write_family(root, family)
    register_project(project)
    return family_state(project, study_id) or {}

def register_owning_workspace(project: ProjectContext) -> list[str]:
    """Register every desk trial before an as-of publication freezes its family."""

    root = workspace_root_for(project)
    return register_workspace(root) if root is not None else []
