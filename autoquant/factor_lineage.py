"""Strict reader for a research desk's inherited Factor lineage.

A desk created by ``aq project from-factor`` carries one Project-root
``factor-lineage.json``. It records, by reference, which standalone Factor
Project, candidate source, Runs, and market data the desk was built from, and
how many distinct candidate sources that source Project had already tried.

This module only reads and verifies the file. It deliberately has no
dependency on Runs, Studies, or selection code so the research-family
projection can import it without cycles. See
docs/design/factor-to-portfolio-conversion.md.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .workspace import AutoQuantValidationError, ProjectContext, ValidationIssue


FACTOR_LINEAGE = "factor-lineage.json"
FACTOR_LINEAGE_KIND = "autoquant-factor-lineage"
FACTOR_LINEAGE_SCHEMA_VERSION = 1
LINEAGE_KEYS = frozenset(
    {
        "schemaVersion",
        "kind",
        "createdAt",
        "authority",
        "tradingAuthority",
        "source",
        "candidate",
        "marketData",
        "trials",
        "mandate",
    }
)


def _issue(path: Path | str, code: str, message: str) -> AutoQuantValidationError:
    return AutoQuantValidationError([ValidationIssue(str(path), code, message)])


def _non_negative_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def validate_factor_lineage(raw: Any, path: Path | str) -> dict[str, Any]:
    """Return the lineage when its structure and trial arithmetic are exact."""

    if not isinstance(raw, dict) or set(raw) != LINEAGE_KEYS:
        raise _issue(path, "lineage.schema", "Factor lineage must contain exactly the documented fields")
    if raw["kind"] != FACTOR_LINEAGE_KIND or raw["schemaVersion"] != FACTOR_LINEAGE_SCHEMA_VERSION:
        raise _issue(path, "lineage.kind", "Unsupported Factor lineage kind or schema version")
    if raw["authority"] != "evidence-by-reference" or raw["tradingAuthority"] != "none":
        raise _issue(path, "lineage.authority", "Factor lineage carries reference evidence only and no trading authority")
    source = raw["source"]
    trials = raw["trials"]
    if not isinstance(source, dict) or not isinstance(source.get("projectId"), str) or not source["projectId"]:
        raise _issue(path, "lineage.source", "Factor lineage must name its source Project")
    if not isinstance(trials, dict):
        raise _issue(path, "lineage.trials", "Factor lineage must record inherited trials")
    inherited = trials.get("inheritedSourceTrials")
    distinct = trials.get("sourceProjectDistinctSources")
    families = trials.get("sourceFamilies")
    if (
        not _non_negative_int(inherited)
        or not _non_negative_int(distinct)
        or inherited != distinct
        or not isinstance(families, list)
        or not families
        or any(
            not isinstance(item, dict)
            or not isinstance(item.get("id"), str)
            or not _non_negative_int(item.get("uniqueSourceTrials"))
            or item["uniqueSourceTrials"] > inherited
            for item in families
        )
    ):
        raise _issue(
            path,
            "lineage.trials",
            "Inherited source trials must equal the source Project's distinct Factor sources and bound every source family",
        )
    return raw


def load_factor_lineage(project: ProjectContext) -> tuple[dict[str, Any], str] | None:
    """Return ``(lineage, sha256)`` or ``None`` for a Project without lineage.

    A present but unreadable or malformed file fails closed: silently ignoring
    it would reset the inherited trial count.
    """

    path = project.root_dir / FACTOR_LINEAGE
    if not path.exists() and not path.is_symlink():
        return None
    if path.is_symlink() or not path.is_file():
        raise _issue(path, "lineage.path", "Factor lineage must be a regular file")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise _issue(path, "lineage.json", f"Cannot read Factor lineage: {error}") from error
    return validate_factor_lineage(raw, path), hashlib.sha256(path.read_bytes()).hexdigest()


def inheritance_projection(project: ProjectContext) -> dict[str, Any] | None:
    """Compact research-family inheritance block, or ``None`` without lineage."""

    loaded = load_factor_lineage(project)
    if loaded is None:
        return None
    lineage, digest = loaded
    return {
        "kind": FACTOR_LINEAGE_KIND,
        "lineagePath": FACTOR_LINEAGE,
        "lineageHash": digest,
        "sourceProjectId": lineage["source"]["projectId"],
        "sourceFamilyIds": sorted(item["id"] for item in lineage["trials"]["sourceFamilies"]),
        "inheritedSourceTrials": lineage["trials"]["inheritedSourceTrials"],
        "countAssumption": "source-project-distinct-factor-sources-upper-bound",
    }
