"""Request-independent market-data identity for Factor redundancy peers.

A Run's dataset content hash covers every data file, including the intake
``snapshot.json`` manifest, which records the hash and asset list of the
Project's own Research Request. Two Projects that ask different questions over
byte-identical market data therefore have different dataset hashes. That is
correct for Run comparison (``run_compare`` stays strict: a different question
is not a comparable verdict baseline), but redundancy asks whether two factors
overlap on the same market data, so it may ignore the request-only fields.

The identity is derived only from bytes the Run content-locked: the snapshot is
re-read from the owning Project data root and must hash to the Run's recorded
value. Anything unverifiable returns ``None`` and the caller keeps the strict
dataset hash.
"""

from __future__ import annotations

import json
from pathlib import PurePosixPath

from .intake import DATASET_SNAPSHOT_KIND
from .studies import hash_file, hash_json
from .workspace import AutoQuantValidationError, confined_path


SNAPSHOT_NAME = "snapshot.json"
# Written from the Research Request at intake (intake.py: requestHash is the
# request digest; requestedAssets must equal the request's asset symbols).
# Market content stays bound by universe, per-asset records, normalized file
# hashes, market clock/calendar/timezone, adjustment, frequency/intervals,
# time range, provider/package claims, template and Study id.
REQUEST_ONLY_SNAPSHOT_FIELDS = frozenset({"requestHash", "requestedAssets"})


def market_data_identity(project, run):
    """Hash of the Run's dataset with request-only snapshot fields removed."""
    dataset = run.result.get("dataset") or {}
    hashes = dataset.get("sourceHashes")
    if not isinstance(hashes, dict) or not hashes:
        return None
    snapshots = sorted(k for k in hashes if PurePosixPath(k).name == SNAPSHOT_NAME)
    if not snapshots:
        return None
    try:
        data_root = confined_path(project.root_dir, project.manifest.directories["data"],
                                  "project/directories/data")
        manifests = {}
        for relative in snapshots:
            path = confined_path(data_root, relative, "dataset/snapshot")
            # Only the exact content-locked bytes may define the identity.
            if path.is_symlink() or not path.is_file() or hash_file(path) != hashes[relative]:
                return None
            snapshot = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(snapshot, dict) or snapshot.get("kind") != DATASET_SNAPSHOT_KIND:
                return None
            manifests[relative] = {k: v for k, v in snapshot.items()
                                   if k not in REQUEST_ONLY_SNAPSHOT_FIELDS}
    except (OSError, ValueError, KeyError, TypeError, AutoQuantValidationError):
        return None
    definition = {k: v for k, v in dataset.items() if k not in {"hash", "sourceHashes"}}
    files = {k: v for k, v in hashes.items() if k not in manifests}
    return hash_json({"definition": definition, "files": files, "snapshots": manifests})


# Construction labels name the Project route that materialized the snapshot,
# not the market content. A research desk rebuilt from a standalone Factor Lab
# over the exact same package differs only here and in request-only fields.
CONSTRUCTION_ONLY_SNAPSHOT_FIELDS = frozenset({"template", "studyId"})


def snapshot_market_identity(snapshot):
    """Market-content identity of one verified intake snapshot manifest.

    Uses the same exclusion rule as ``market_data_identity`` for request-only
    fields and additionally ignores the two construction labels above. Every
    per-asset source/normalized hash, the package manifest hash, the market
    clock, adjustment, frequency, universe and time range remain bound.
    """

    if not isinstance(snapshot, dict) or snapshot.get("kind") != DATASET_SNAPSHOT_KIND:
        return None
    excluded = REQUEST_ONLY_SNAPSHOT_FIELDS | CONSTRUCTION_ONLY_SNAPSHOT_FIELDS
    return hash_json({k: v for k, v in snapshot.items() if k not in excluded})
