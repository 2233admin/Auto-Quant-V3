"""Shared public CLI access to the existing confined candidate editor."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .studio_actions import ActionService
from .studio import _resolve_source, _walk_fingerprint


def candidate_access(
    directory: str, project_id: str, session_id: str, *,
    source: str | None = None, base_sha256: str | None = None,
) -> dict[str, Any]:
    scope, root, _, projects, _ = _resolve_source(Path(directory), project_id)
    service = ActionService(
        root, scope=scope,
        load_projects=lambda: {p.manifest.id: p for p in projects},
        fingerprint=lambda project: _walk_fingerprint([project.root_dir]),
    )
    if source is None:
        return service.candidate(project_id, session_id)
    return service.create({
        "actionId": "candidate.save", "project": project_id, "confirm": True,
        "params": {"session": session_id, "source": source,
                   "baseSha256": base_sha256},
    })
