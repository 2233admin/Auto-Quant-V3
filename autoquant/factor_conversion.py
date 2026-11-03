"""Convert a tested standalone Factor Lab into a research-desk Project.

``aq project from-factor`` composes existing Core contracts only:

* the source Project's verified intake, request, snapshot, Studies and Runs
  are read, never written;
* the caller supplies a complete strategy mandate (question, direction,
  per-asset position roles, benchmark and portfolio policy); nothing is
  defaulted;
* the new desk is constructed through ordinary strict research-desk intake
  over the *same* dataset package, proven by package/asset hashes and the
  market-content snapshot identity;
* the exact candidate source closure is written before any Study identity,
  and a ``factor-lineage.json`` records every reference plus the source
  Project's distinct Factor source count, which the desk's research families
  inherit (see ``selection.build_research_family``).

See docs/design/factor-to-portfolio-conversion.md.
"""

from __future__ import annotations

import copy
import dataclasses
import json
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .factor_lineage import (
    FACTOR_LINEAGE,
    FACTOR_LINEAGE_KIND,
    FACTOR_LINEAGE_SCHEMA_VERSION,
    validate_factor_lineage,
)
from .intake import DATASET_SNAPSHOT, load_project_intake, prepare_project_intake
from .factor_lineage import load_factor_lineage  # noqa: F401  (re-exported for Studio)
from .mandates import DEFAULT_PORTFOLIO_POLICY
from .market_data_identity import snapshot_market_identity
from .studies import hash_bytes, hash_file, hash_json, list_studies, load_study, snapshot_patterns
from .workspace import (
    AutoQuantValidationError,
    ProjectContext,
    ValidationIssue,
    create_project,
    load_project,
    load_workspace,
)


TARGET_TEMPLATE = "ohlcv-research-desk"
SOURCE_TEMPLATE = "ohlcv-factor-lab"
MANDATE_KIND = "autoquant-strategy-mandate"
MANDATE_KEYS = frozenset(
    {
        "schemaVersion",
        "kind",
        "question",
        "direction",
        "positionRoles",
        "benchmarkPolicy",
        "portfolioPolicy",
        "callerConfirmed",
    }
)
CALLER_FIELDS = (
    "question",
    "direction",
    "positionRoles",
    "benchmarkPolicy",
    "portfolioPolicy",
)
POSITION_ROLES = ("long-only", "short-only", "two-sided", "context-only")
DIRECTIONS = ("long", "short", "long-short")
FACTOR_METRIC = "validation_mean_ic"
FACTOR_EDITABLE = "factors/**"
PORTFOLIO_LANE_FLOOR = 180  # holdouts.HOLDOUT_LANE_MINIMUM_OBSERVATIONS["portfolio"]
RL_LANE_FLOOR = 240  # ohlcv_rl_factor_lab judge MIN_OBSERVATIONS
MAX_STAGING_FILES = 5000
MAX_MANIFEST_BYTES = 1_000_000

# Stable refusal codes; Studio shows them as explicit blocked reasons.
REFUSALS = {
    "conversion.not-factor-lab": "Only a request-bound standalone ohlcv-factor-lab Project can be converted.",
    "conversion.risk-outcome": "This Factor predicts future realized volatility; it cannot become a forward-return Portfolio claim.",
    "conversion.source-not-tested": "The source Factor has no successful Factor Run; test it before building a strategy.",
    "conversion.source-changed": "The source candidate changed after its latest Factor Run; re-test the exact source before building a strategy.",
    "conversion.data-not-reusable": "The source dataset package could not be found unchanged under Workspace staging, so the same market data cannot be proven.",
    "conversion.data-mismatch": "The supplied dataset package is not the exact market data the source Factor was tested on.",
    "conversion.mandate": "The strategy mandate is incomplete or invalid; every caller-owned Portfolio fact must be supplied.",
    "conversion.target-exists": "The new Project id already exists.",
}


def refusal(code: str, detail: str | None = None, path: str = "conversion") -> AutoQuantValidationError:
    message = REFUSALS[code] + (f" {detail}" if detail else "")
    return AutoQuantValidationError([ValidationIssue(path, code, message)])


def refusal_code(error: AutoQuantValidationError) -> str | None:
    for issue in error.issues:
        if issue.code in REFUSALS:
            return issue.code
    return None


# --- mandate ------------------------------------------------------------------


def _text(value: Any, minimum: int, maximum: int) -> bool:
    return (
        isinstance(value, str)
        and minimum <= len(value) <= maximum
        and value == value.strip()
        and not any(ord(ch) < 32 or ord(ch) == 127 for ch in value)
    )


def validate_strategy_mandate(raw: Any, source_request: dict[str, Any]) -> dict[str, Any]:
    """Structural check; numeric/benchmark semantics stay with strict intake."""

    def bad(detail: str) -> AutoQuantValidationError:
        return refusal("conversion.mandate", detail, "mandate")

    if not isinstance(raw, dict) or set(raw) != MANDATE_KEYS:
        missing = sorted(MANDATE_KEYS - set(raw)) if isinstance(raw, dict) else []
        extra = sorted(set(raw) - MANDATE_KEYS) if isinstance(raw, dict) else []
        raise bad(f"Expected exactly {sorted(MANDATE_KEYS)}; missing {missing}, unknown {extra}.")
    if raw["kind"] != MANDATE_KIND or raw["schemaVersion"] != 1:
        raise bad(f"kind must be {MANDATE_KIND} with schemaVersion 1.")
    if raw["callerConfirmed"] is not True:
        raise bad("callerConfirmed must be true: the caller confirms every Portfolio fact.")
    if not _text(raw["question"], 8, 500):
        raise bad("question must be 8 to 500 plain characters.")
    if raw["direction"] not in DIRECTIONS:
        raise bad(f"direction must be one of {list(DIRECTIONS)}.")
    roles = raw["positionRoles"]
    symbols = [item["symbol"] for item in source_request["assets"]]
    if not isinstance(roles, dict) or set(roles) != set(symbols):
        raise bad(f"positionRoles must name every source request asset exactly: {symbols}.")
    if any(role not in POSITION_ROLES for role in roles.values()):
        raise bad(f"Every position role must be one of {list(POSITION_ROLES)}.")
    long_capable = any(role in {"long-only", "two-sided"} for role in roles.values())
    short_capable = any(role in {"short-only", "two-sided"} for role in roles.values())
    if not long_capable and not short_capable:
        raise bad("At least one asset must be tradable.")
    expected = "long-short" if long_capable and short_capable else "long" if long_capable else "short"
    if raw["direction"] != expected:
        raise bad(f"direction {raw['direction']!r} contradicts the position roles; they imply {expected!r}.")
    if not isinstance(raw["benchmarkPolicy"], dict):
        raise bad("benchmarkPolicy must be an explicit object (cash, asset, or fixed-weights).")
    if not isinstance(raw["portfolioPolicy"], dict):
        raise bad("portfolioPolicy must be a complete object.")
    return raw


def load_strategy_mandate(path: str | Path, source_request: dict[str, Any]) -> tuple[dict[str, Any], str]:
    file = Path(path).expanduser().absolute()
    if file.is_symlink() or not file.is_file():
        raise refusal("conversion.mandate", f"Mandate file not found: {file}", "mandate")
    raw_bytes = file.read_bytes()
    try:
        raw = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise refusal("conversion.mandate", f"Invalid JSON: {error}", "mandate") from error
    return validate_strategy_mandate(raw, source_request), hash_bytes(raw_bytes)


def mandate_defaults(request: dict[str, Any]) -> dict[str, Any]:
    """Displayed starting values only; `callerConfirmed` stays false until the caller confirms."""

    symbols = [item["symbol"] for item in request["assets"]]
    return {
        "schemaVersion": 1, "kind": MANDATE_KIND,
        "question": f"Does the inherited Factor survive costed long-only portfolio construction? Source question: {request['question']}"[:500],
        "direction": "long",
        "positionRoles": {symbol: "long-only" for symbol in symbols},
        "benchmarkPolicy": {"kind": "fixed-weights", "weights": {symbol: 1.0 / len(symbols) for symbol in symbols}},
        "portfolioPolicy": copy.deepcopy(DEFAULT_PORTFOLIO_POLICY),
        "callerConfirmed": False,
    }


def compose_request(source_project: ProjectContext, source_request: dict[str, Any], mandate: dict[str, Any]) -> dict[str, Any]:
    """Source question context plus the caller's mandate; nothing invented.

    Factor policy, horizon and asset descriptions are the source caller's
    authority and are carried unchanged. Portfolio facts come only from the
    caller-confirmed mandate.
    """

    request = copy.deepcopy(source_request)
    roles = mandate["positionRoles"]
    request["title"] = f"{source_request['title']} strategy"
    request["question"] = mandate["question"]
    request["direction"] = mandate["direction"]
    request["assets"] = [{**item, "positionRole": roles[item["symbol"]]} for item in source_request["assets"]]
    request["benchmarkPolicy"] = copy.deepcopy(mandate["benchmarkPolicy"])
    request["portfolioPolicy"] = copy.deepcopy(mandate["portfolioPolicy"])
    request["decisionContext"] = (
        f"Portfolio research on the Factor inherited by reference from Project "
        f"{source_project.manifest.id}; quantitative decision support only."
    )
    request["constraints"] = [
        "No live trading authority.",
        f"The Factor source, its market data and its counted trials are inherited by reference from Project {source_project.manifest.id}.",
    ]
    request["deliverables"] = ["Costed Portfolio evidence for the inherited Factor with continued trial counting"]
    request["source"] = {
        "system": "local",
        "workspaceId": None,
        "sessionId": None,
        "artifactPath": None,
        "artifactRevision": None,
    }
    return request


# --- source evidence ----------------------------------------------------------


def _source_snapshot(project: ProjectContext, intake: dict[str, Any]) -> dict[str, Any]:
    relative = intake["manifest"]["datasetSnapshotPath"]
    path = project.root_dir / relative
    if path.is_symlink() or not path.is_file() or hash_file(path) != intake["manifest"]["datasetSnapshotHash"]:
        raise refusal("conversion.data-not-reusable", "The source snapshot does not match its intake hash.")
    return json.loads(path.read_text(encoding="utf-8"))


def tree_digest(root: Path) -> dict[str, Any]:
    """Hash every regular file under a Project, excluding only its cache dir."""

    files: dict[str, str] = {}
    for directory, dirs, names in os.walk(root, followlinks=False):
        current = Path(directory)
        dirs[:] = sorted(d for d in dirs if not (current / d).is_symlink() and not (current == root and d == ".autoquant"))
        for name in sorted(names):
            path = current / name
            if path.is_file() and not path.is_symlink():
                files[path.relative_to(root).as_posix()] = hash_file(path)
    return {"files": len(files), "hash": hash_json(files), "excluded": [".autoquant/"]}


def source_factor_evidence(project: ProjectContext, *, diagnostics: bool = True) -> dict[str, Any]:
    """Verified, read-only summary of the source Factor's tested evidence."""

    from .runs import list_runs, load_run
    from .selection import build_research_family, build_selection_adjustment, research_family_id

    intake = load_project_intake(project)
    if intake is None or intake["manifest"]["template"] != SOURCE_TEMPLATE:
        raise refusal("conversion.not-factor-lab")
    request = intake["request"]
    if (request.get("factorPolicy") or {}).get("outcome") != "forward-return":
        raise refusal("conversion.risk-outcome")
    factor_studies = {}
    for summary in list_studies(project):
        study = load_study(project, summary.id)
        if study.definition.objective.metric == FACTOR_METRIC and study.definition.editable["paths"] == [FACTOR_EDITABLE]:
            factor_studies[summary.id] = study
    runs = sorted(
        (item for item in list_runs(project) if item.study_id in factor_studies),
        key=lambda item: (item.started_at, item.id),
    )
    if not runs:
        raise refusal("conversion.source-not-tested")
    anchor_summary = runs[-1]
    if anchor_summary.status != "succeeded":
        raise refusal("conversion.source-not-tested", f"Latest Factor Run {anchor_summary.id} is {anchor_summary.status}.")
    anchor = load_run(project, anchor_summary.id)
    study = factor_studies[anchor_summary.study_id]
    if study.source_hash != anchor.result["subject"]["sourceHash"]:
        raise refusal("conversion.source-changed", f"Latest Factor Run: {anchor_summary.id}.")
    family = build_research_family(project, anchor)
    adjustment = build_selection_adjustment(anchor, family)
    loaded = [load_run(project, item.id) for item in runs]
    families: dict[str, dict[str, Any]] = {}
    for run in loaded:
        family_id = research_family_id(run.result)
        if family_id not in families:
            projection = build_research_family(project, run).projection
            families[family_id] = {
                "id": family_id,
                "studyId": run.result["study"]["id"],
                "uniqueSourceTrials": projection["uniqueSourceTrials"],
                "totalExecutions": projection["totalExecutions"],
            }
    stage = None
    try:
        if not diagnostics:
            raise KeyError("diagnostics skipped")
        from .factor_explorer import load_factor_diagnostics

        diagnosis = load_factor_diagnostics(project, anchor_summary.id, point_limit=40)["factorQualification"].get("diagnosis")
        stage = diagnosis.get("stage") if isinstance(diagnosis, dict) else None
    except (AutoQuantValidationError, OSError, KeyError, TypeError, ValueError):
        stage = None
    return {
        "intake": intake,
        "request": request,
        "study": study,
        "anchor": anchor,
        "runs": [
            {
                "id": run.result["id"],
                "studyId": run.result["study"]["id"],
                "status": run.result["status"],
                "sourceHash": run.result["subject"]["sourceHash"],
                "resultHash": run.manifest["resultHash"],
            }
            for run in loaded
        ],
        "families": sorted(families.values(), key=lambda item: item["id"]),
        "distinctSources": len({run.result["subject"]["sourceHash"] for run in loaded}),
        "anchorFamily": family.projection,
        "anchorAdjustment": {"status": adjustment["status"], "method": adjustment["method"], "passes": adjustment["passes"]},
        "qualificationStage": stage,
    }


# --- dataset -----------------------------------------------------------------


def discover_dataset_package(workspace_root: Path, snapshot: dict[str, Any]) -> Path | None:
    """Find the exact source package manifest under Workspace staging."""

    staging = workspace_root / "staging"
    expected = snapshot.get("packageManifestHash")
    if not isinstance(expected, str) or not staging.is_dir() or staging.is_symlink():
        return None
    seen = 0
    for directory, dirs, names in os.walk(staging, followlinks=False):
        current = Path(directory)
        dirs[:] = sorted(d for d in dirs if not (current / d).is_symlink())
        for name in sorted(names):
            if not name.endswith(".json"):
                continue
            seen += 1
            if seen > MAX_STAGING_FILES:
                return None
            path = current / name
            try:
                if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_MANIFEST_BYTES:
                    continue
                if hash_file(path) == expected:
                    return path
            except OSError:
                continue
    return None


def verify_same_market_data(prepared: Any, snapshot: dict[str, Any]) -> None:
    if hash_file(prepared.package_path) != snapshot.get("packageManifestHash"):
        raise refusal("conversion.data-mismatch", "Package manifest hash differs.")
    supplied = {asset.symbol: asset.source_hash for asset in prepared.assets}
    recorded = {item["symbol"]: item["sourceHash"] for item in snapshot.get("assets", [])}
    if supplied != recorded:
        raise refusal("conversion.data-mismatch", "Per-asset source hashes differ.")


# --- construction seed -------------------------------------------------------


@dataclass(frozen=True)
class FactorSeed:
    files: dict[str, bytes]
    source_hash: str
    market_identity: str
    source_snapshot_hash: str
    lineage: dict[str, Any]
    brief: str

    def apply(self, project: ProjectContext) -> None:
        apply_factor_seed(project, self)


def apply_factor_seed(project: ProjectContext, seed: FactorSeed) -> None:
    """Called inside research-desk construction before any Study identity."""

    factors = project.root_dir / "factors"
    for path in sorted(factors.rglob("*")) if factors.is_dir() else []:
        relative = path.relative_to(project.root_dir).as_posix()
        if path.is_file() and relative not in seed.files:
            path.unlink()  # scaffold file absent from the source closure
    for relative, raw in seed.files.items():
        target = project.root_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    if hash_json(snapshot_patterns(project, [FACTOR_EDITABLE])) != seed.source_hash:
        raise refusal("conversion.source-changed", "Copied Factor closure does not reproduce the source hash.")
    snapshot_path = project.root_dir / DATASET_SNAPSHOT
    target_snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    identity = snapshot_market_identity(target_snapshot)
    if identity != seed.market_identity:
        raise refusal("conversion.data-mismatch", "Materialized desk snapshot has a different market identity.")
    lineage = copy.deepcopy(seed.lineage)
    lineage["marketData"].update(
        {
            "targetSnapshotHash": hash_file(snapshot_path),
            "targetMarketIdentity": identity,
            "sameMarketData": True,
        }
    )
    lineage["candidate"]["targetSourceHash"] = seed.source_hash
    validate_factor_lineage(lineage, FACTOR_LINEAGE)
    (project.root_dir / FACTOR_LINEAGE).write_text(
        json.dumps(lineage, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    research = project.root_dir / project.manifest.research_program
    research.write_text(research.read_text(encoding="utf-8").rstrip("\n") + "\n\n" + seed.brief, encoding="utf-8")


def _brief(source_id: str, evidence: dict[str, Any], mandate: dict[str, Any], inherited: int) -> str:
    roles = ", ".join(f"{symbol}={role}" for symbol, role in sorted(mandate["positionRoles"].items()))
    return (
        "## Conversion provenance (written by `aq project from-factor`)\n\n"
        f"- Source Factor Project: `{source_id}`; anchor Factor Run "
        f"`{evidence['anchor'].result['id']}`; candidate source hash "
        f"`{evidence['anchor'].result['subject']['sourceHash']}`.\n"
        f"- Inherited counted trials: {inherited} distinct Factor sources tried in the "
        "source Project. Selection adjustment in this desk counts them.\n"
        f"- Caller-confirmed mandate: direction `{mandate['direction']}`; roles {roles}; "
        "benchmark and portfolio policy as recorded in `request.json`.\n"
        "- The source Project and its Runs are referenced, never modified. See "
        f"`{FACTOR_LINEAGE}`.\n"
    )


# --- command -----------------------------------------------------------------


def plan_conversion(
    workspace_directory: str | Path,
    source_id: str,
    new_id: str,
    mandate: dict[str, Any],
    mandate_sha256: str,
    *,
    dataset: str | Path | None = None,
) -> tuple[Any, ProjectContext, dict[str, Any]]:
    """Run every check and prepare intake without writing anything."""

    workspace = load_workspace(workspace_directory)
    source = load_project(workspace.projects_dir / source_id, expected_id=source_id)
    target = workspace.projects_dir / new_id
    if target.exists() or target.is_symlink():
        raise refusal("conversion.target-exists", str(target))
    evidence = source_factor_evidence(source)
    validate_strategy_mandate(mandate, evidence["request"])
    snapshot = _source_snapshot(source, evidence["intake"])
    package = Path(dataset).expanduser().absolute() if dataset is not None else discover_dataset_package(workspace.root_dir, snapshot)
    if package is None:
        raise refusal("conversion.data-not-reusable")
    request = compose_request(source, evidence["request"], mandate)
    with tempfile.TemporaryDirectory(prefix="autoquant-from-factor-") as directory:
        request_path = Path(directory) / "request.json"
        request_path.write_text(json.dumps(request, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        # Same lane-scoped floor rule as the frozen holdout desk: the required
        # Factor and Portfolio lanes need 180 rows; optional RL keeps its own
        # 240-row Judge floor and is disclosed below when the data is shorter.
        prepared = prepare_project_intake(
            request_path,
            package,
            TARGET_TEMPLATE,
            minimum_observations_override=PORTFOLIO_LANE_FLOOR,
        )
    verify_same_market_data(prepared, snapshot)
    study = evidence["study"]
    files = {relative: (source.root_dir / relative).read_bytes() for relative in sorted(study.editable_hashes)}
    if {relative: hash_bytes(raw) for relative, raw in files.items()} != study.editable_hashes:
        raise refusal("conversion.source-changed", "Candidate bytes changed while reading.")
    inherited = evidence["distinctSources"]
    anchor = evidence["anchor"].result
    market_identity = snapshot_market_identity(snapshot)
    observations = min(int(item["observations"]) for item in snapshot["assets"])
    lineage = {
        "schemaVersion": FACTOR_LINEAGE_SCHEMA_VERSION,
        "kind": FACTOR_LINEAGE_KIND,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "authority": "evidence-by-reference",
        "tradingAuthority": "none",
        "source": {
            "projectId": source.manifest.id,
            "template": SOURCE_TEMPLATE,
            "requestHash": evidence["intake"]["manifest"]["requestHash"],
            "factorPolicy": copy.deepcopy(evidence["request"].get("factorPolicy")),
            "anchorRun": {
                "id": anchor["id"],
                "studyId": anchor["study"]["id"],
                "resultHash": evidence["anchor"].manifest["resultHash"],
                "familyId": evidence["anchorFamily"]["id"],
                "qualificationStage": evidence["qualificationStage"],
                "selectionAdjustment": evidence["anchorAdjustment"],
            },
            "factorRuns": evidence["runs"],
            "treeDigest": tree_digest(source.root_dir),
        },
        "candidate": {
            "paths": sorted(files),
            "fileHashes": dict(study.editable_hashes),
            "sourceHash": study.source_hash,
        },
        "marketData": {
            "sourceSnapshotHash": evidence["intake"]["manifest"]["datasetSnapshotHash"],
            "packageManifestHash": snapshot["packageManifestHash"],
            "packagePath": str(package),
            "sourceMarketIdentity": market_identity,
            "identityMethod": "snapshot-market-identity-v1",
            "observations": observations,
            "intakeMinimumObservations": PORTFOLIO_LANE_FLOOR,
            "rlLane": {
                "requiredObservations": RL_LANE_FLOOR,
                "sufficient": observations >= RL_LANE_FLOOR,
            },
        },
        "trials": {
            "inheritedSourceTrials": inherited,
            "sourceProjectDistinctSources": inherited,
            "sourceFamilies": evidence["families"],
            "countAssumption": "source-project-distinct-factor-sources-upper-bound",
        },
        "mandate": {
            "sha256": mandate_sha256,
            "callerProvidedFields": list(CALLER_FIELDS),
            "defaultsApplied": [],
        },
    }
    seed = FactorSeed(
        files=files,
        source_hash=study.source_hash,
        market_identity=market_identity,
        source_snapshot_hash=evidence["intake"]["manifest"]["datasetSnapshotHash"],
        lineage=lineage,
        brief=_brief(source.manifest.id, evidence, mandate, inherited),
    )
    return dataclasses.replace(prepared, factor_seed=seed), source, evidence


def convert_factor_project(
    workspace_directory: str | Path,
    source_id: str,
    new_id: str,
    mandate_path: str | Path,
    *,
    dataset: str | Path | None = None,
    name: str | None = None,
) -> tuple[ProjectContext, dict[str, Any], dict[str, Any]]:
    workspace = load_workspace(workspace_directory)
    source = load_project(workspace.projects_dir / source_id, expected_id=source_id)
    intake = load_project_intake(source)
    if intake is None:
        raise refusal("conversion.not-factor-lab")
    mandate, mandate_sha = load_strategy_mandate(mandate_path, intake["request"])
    prepared, source, evidence = plan_conversion(
        workspace_directory, source_id, new_id, mandate, mandate_sha, dataset=dataset
    )
    before = prepared.factor_seed.lineage["source"]["treeDigest"]
    project = create_project(
        workspace_directory,
        new_id,
        name=name or prepared.request["title"],
        description=prepared.request["question"],
        template=TARGET_TEMPLATE,
        template_intake=prepared,
    )
    after = tree_digest(source.root_dir)
    lineage = json.loads((project.root_dir / FACTOR_LINEAGE).read_text(encoding="utf-8"))
    return project, lineage, {"before": before, "after": after, "unchanged": before == after}
