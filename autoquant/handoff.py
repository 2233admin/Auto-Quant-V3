"""Versioned machine-readable research handoff (``handoff.json``).

The plain-text handoff an Agent returns to OpenAlice stays authoritative for
conversation; this file is its exact, verifiable projection. It is generated
from verified Core evidence only: verdict words come from the Judge-backed
Core projection, test metrics never appear, target weights and OrderIntents
appear only when the evidence publishes them, and validity is caller-owned.
See docs/design/research-handoff.md.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from .market_data_identity import run_instruments
from .research_verdict import VERDICT_POLICY, VERDICT_WORDS, factor_development_verdict
from .run_history import test_audit_visible
from .runs import load_run
from .selection import build_research_family, build_selection_adjustment
from .trial_families import family_state, now_utc, workspace_root_for
from .workspace import AutoQuantValidationError, ProjectContext, ValidationIssue


HANDOFF_KIND = "autoquant-research-handoff"
SCHEMA_VERSION = 1
HANDOFF_FILE = "handoff.json"
HANDOFF_DIRECTORY = "handoffs"
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
HOLDOUT_STATUSES = ("not-supplied", "pending", "passed", "failed", "inconclusive")


def _refuse(path: str, code: str, message: str) -> AutoQuantValidationError:
    return AutoQuantValidationError([ValidationIssue(path, code, message)])


def _validity(valid_from: Any, valid_until: Any, review_date: Any) -> dict[str, str]:
    missing = [name for name, value in (("--valid-from", valid_from), ("--valid-until", valid_until),
                                        ("--review-date", review_date)) if value is None]
    if missing:
        raise _refuse("validity", "handoff.validity-required",
                      "The validity window and review date are caller-owned and never defaulted; supply "
                      + ", ".join(missing))
    for name, value in (("validFrom", valid_from), ("validUntil", valid_until), ("reviewDate", review_date)):
        if not isinstance(value, str) or not DATE.fullmatch(value):
            raise _refuse(f"validity/{name}", "handoff.validity-format", f"{name} must be YYYY-MM-DD")
    if valid_from > valid_until:
        raise _refuse("validity", "handoff.validity-window", "validFrom must not be later than validUntil")
    return {"validFrom": valid_from, "validUntil": valid_until, "reviewDate": review_date, "source": "caller"}


def _holdout(digest: Any, status: Any) -> dict[str, Any]:
    if digest is None and status not in (None, "not-supplied"):
        raise _refuse("externalHoldout", "handoff.holdout-digest", "An external holdout audit status needs its digest")
    if digest is not None and not (isinstance(digest, str) and SHA256.fullmatch(digest)):
        raise _refuse("externalHoldout/digest", "handoff.holdout-digest", "Digest must be a lowercase SHA-256 hex string")
    if digest is not None and status in (None, "not-supplied"):
        raise _refuse("externalHoldout/auditStatus", "handoff.holdout-status", "A supplied holdout digest needs its audit status")
    return {
        "custody": "host" if digest is not None else "not-supplied",
        "heldInDesk": False,
        "digest": digest,
        "auditStatus": status if digest is not None else "not-supplied",
    }


def _run_verdict(project: ProjectContext, run, *, frozen_integrity: dict[str, Any] | None,
                 cutoff: str | None) -> dict[str, Any]:
    metric = run.result["objective"]["metric"]
    if frozen_integrity is not None:
        family = frozen_integrity["researchFamily"]
        adjustment = frozen_integrity["selectionAdjustment"]
    else:
        built = build_research_family(project, run, cutoff=cutoff)
        family, adjustment = built.projection, build_selection_adjustment(run, built)
    entry: dict[str, Any] = {
        "studyId": run.result["study"]["id"], "runId": run.result["id"], "runStatus": run.result["status"],
        "objective": {"metric": metric, "direction": run.result["objective"]["direction"],
                      "value": run.result["metrics"].get(metric)},
        "selectionAdjustment": {k: adjustment.get(k) for k in ("status", "method", "passes", "reason")},
        "researchFamilyId": family["id"], "effectiveTrials": family.get("effectiveSourceTrials", family["uniqueSourceTrials"]),
        "word": None, "policy": None, "qualificationStage": None, "reasons": [],
    }
    if metric != "validation_mean_ic":
        entry["reasons"] = [f"no-core-verdict-policy-for-objective-{metric}"]
        return entry
    qualification = None
    if run.result["status"] == "succeeded":
        from .factor_explorer import load_factor_diagnostics
        qualification = load_factor_diagnostics(project, run.result["id"], point_limit=40)["factorQualification"]
    verdict = factor_development_verdict(tested=True, exact=True, run_status=run.result["status"],
                                         qualification=qualification, adjustment=adjustment)
    entry.update(word=verdict["word"], policy=VERDICT_POLICY, reasons=verdict["reasons"],
                 qualificationStage=((qualification or {}).get("diagnosis") or {}).get("stage"))
    return entry


def _decision(project: ProjectContext, run) -> dict[str, Any]:
    weights = None
    if run.result["status"] == "succeeded" and run.result["objective"]["metric"] == "validation_net_sharpe":
        try:
            from .portfolio_explorer import load_portfolio_diagnostics
            mechanical = load_portfolio_diagnostics(project, run.result["id"], point_limit=40)["mechanicalDecision"]
            weights = {"timestamp": mechanical["timestamp"], "authority": mechanical["authority"],
                       "positions": [{"symbol": p["asset"], "targetWeight": p["targetWeight"]}
                                     for p in mechanical["positions"]]}
        except (OSError, KeyError, TypeError, ValueError, AutoQuantValidationError):
            weights = None
    intents = [a for a in run.result.get("artifacts", []) if isinstance(a, dict)
               and re.search(r"order-?intent|decision-?plan", str(a.get("path", "")), re.IGNORECASE)]
    return {
        "targetWeights": weights,
        "orderIntents": [{"path": a.get("path"), "sha256": a.get("sha256")} for a in intents] or None,
        "source": "run-evidence" if weights or intents else "not-in-evidence",
    }


def _anchors(project: ProjectContext, kind: str, subject_id: str) -> dict[str, Any]:
    """Resolve the subject into anchor Runs, evidence ids, and its bundle directory."""

    if kind == "run":
        run = load_run(project, subject_id)
        return {"runs": [(run, None, None)], "evidence": {"runs": [run.result["id"]], "experiments": [],
                "reports": [], "dossier": None}, "directory": run.root_dir}
    if kind == "dossier":
        from .dossiers import load_dossier
        dossier = load_dossier(project, subject_id)
        lanes = dossier.dossier["evidence"]["lanes"]
        runs = [(load_run(project, lane["leaderRun"]["id"]), lane["report"]["selectionIntegrity"],
                 lane["report"]["publishedAt"]) for lane in lanes]
        return {"runs": runs, "evidence": {"runs": sorted({r.result["id"] for r, _, _ in runs}), "experiments": [],
                "reports": sorted(lane["report"]["id"] for lane in lanes), "dossier": subject_id},
                "directory": dossier.root_dir}
    from .run_reports import list_run_reports, load_run_report
    if any(item.id == subject_id for item in list_run_reports(project)):
        report = load_run_report(project, subject_id)
        run = load_run(project, report.report["anchor"]["runId"])
        return {"runs": [(run, report.report["evidence"]["selectionIntegrity"], report.report["publishedAt"])],
                "evidence": {"runs": [run.result["id"]], "experiments": [], "reports": [subject_id], "dossier": None},
                "directory": report.root_dir}
    from .reports import list_reports, load_report
    from .sessions import list_sessions, load_session
    for summary in list_sessions(project):
        session = load_session(project, summary.id)
        if any(item.id == subject_id for item in list_reports(project, session)):
            report = load_report(project, session, subject_id)
            evidence = report.report["evidence"]
            run = load_run(project, evidence["session"]["leader"]["runId"])
            return {"runs": [(run, evidence["selectionIntegrity"], report.report["publishedAt"])],
                    "evidence": {"runs": sorted(item["id"] for item in evidence["runs"]),
                                 "experiments": sorted(item["id"] for item in evidence["experiments"]),
                                 "reports": [subject_id], "dossier": None},
                    "directory": report.root_dir}
    raise _refuse("report", "handoff.report-missing", f"Unknown Report: {subject_id}")


def build_handoff(project: ProjectContext, *, kind: str, subject_id: str, valid_from: Any, valid_until: Any,
                  review_date: Any, assumptions: list[str], unsupported_claims: list[str],
                  holdout_digest: str | None = None, holdout_status: str | None = None) -> dict[str, Any]:
    validity = _validity(valid_from, valid_until, review_date)
    holdout = _holdout(holdout_digest, holdout_status)
    resolved = _anchors(project, kind, subject_id)
    verdicts, families, instruments, splits, decisions = [], {}, {}, [], []
    for run, frozen, cutoff in resolved["runs"]:
        verdicts.append(_run_verdict(project, run, frozen_integrity=frozen, cutoff=cutoff))
        study_id = run.result["study"]["id"]
        state = family_state(project, study_id)
        if state is not None:
            families[study_id] = {"studyId": study_id, "familyId": state["id"], "deskTrialCount": state["deskTrialCount"],
                                  "otherProjectTrials": state["otherProjectTrials"],
                                  "declarationRequired": state["declarationRequired"]}
        for item in run_instruments(project, run) or []:
            instruments.setdefault(item["symbol"], item)
        integrity = run.result["metrics"].get("research_integrity") or {}
        splits.append({"studyId": study_id, "runId": run.result["id"], "validation": {"role": "selection"},
                       "visibleTest": {"role": integrity.get("test_role"),
                                       "auditVisible": test_audit_visible(run.result["metrics"]),
                                       "metricsIncluded": False}})
        decisions.append({"runId": run.result["id"], **_decision(project, run)})
    directory = project.root_dir / HANDOFF_DIRECTORY / subject_id
    root = workspace_root_for(project) or project.root_dir
    return {
        "schemaVersion": SCHEMA_VERSION, "kind": HANDOFF_KIND, "generatedAt": now_utc(),
        "desk": {"rootDir": str(root)},
        "project": {"id": project.manifest.id, "rootDir": str(project.root_dir)},
        "primaryDeliverableDirectory": str(directory),
        "subject": {"kind": kind, "id": subject_id, "evidenceDirectory": str(resolved["directory"])},
        "verdicts": verdicts,
        "evidence": resolved["evidence"],
        "splits": {"lanes": splits, "externalHoldout": holdout},
        "trialFamilies": sorted(families.values(), key=lambda item: item["studyId"]),
        "instruments": [instruments[key] for key in sorted(instruments)],
        "decisions": decisions,
        "validity": validity,
        "assumptions": list(assumptions),
        "unsupportedClaims": list(unsupported_claims),
        "tradingAuthority": "none",
    }


def write_handoff(handoff: dict[str, Any]) -> Path:
    directory = Path(handoff["primaryDeliverableDirectory"])
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / HANDOFF_FILE
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=directory, prefix=".handoff.", suffix=".tmp",
                                     delete=False) as handle:
        json.dump(handoff, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, target)
    return target


_STRINGS = {"type": "array", "items": {"type": "string", "minLength": 1}}
_NULLABLE_STRING = {"type": ["string", "null"]}
_DATE = {"type": "string", "pattern": DATE.pattern}
RESEARCH_HANDOFF_JSON_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://autoquant.local/schemas/research-handoff.v1.json",
    "title": "AutoQuant research handoff",
    "type": "object",
    "additionalProperties": False,
    "required": ["schemaVersion", "kind", "generatedAt", "desk", "project", "primaryDeliverableDirectory",
                 "subject", "verdicts", "evidence", "splits", "trialFamilies", "instruments", "decisions",
                 "validity", "assumptions", "unsupportedClaims", "tradingAuthority"],
    "properties": {
        "schemaVersion": {"const": SCHEMA_VERSION},
        "kind": {"const": HANDOFF_KIND},
        "generatedAt": {"type": "string", "minLength": 1},
        "desk": {"type": "object", "additionalProperties": False, "required": ["rootDir"],
                 "properties": {"rootDir": {"type": "string", "minLength": 1}}},
        "project": {"type": "object", "additionalProperties": False, "required": ["id", "rootDir"],
                    "properties": {"id": {"type": "string", "minLength": 1}, "rootDir": {"type": "string", "minLength": 1}}},
        "primaryDeliverableDirectory": {"type": "string", "minLength": 1},
        "subject": {"type": "object", "additionalProperties": False, "required": ["kind", "id", "evidenceDirectory"],
                    "properties": {"kind": {"enum": ["run", "report", "dossier"]}, "id": {"type": "string", "minLength": 1},
                                   "evidenceDirectory": {"type": "string", "minLength": 1}}},
        "verdicts": {"type": "array", "minItems": 1, "items": {
            "type": "object", "additionalProperties": False,
            "required": ["studyId", "runId", "runStatus", "objective", "selectionAdjustment", "researchFamilyId",
                         "effectiveTrials", "word", "policy", "qualificationStage", "reasons"],
            "properties": {
                "studyId": {"type": "string"}, "runId": {"type": "string"}, "runStatus": {"type": "string"},
                "objective": {"type": "object"}, "selectionAdjustment": {"type": "object"},
                "researchFamilyId": {"type": "string"}, "effectiveTrials": {"type": "integer", "minimum": 0},
                "word": {"enum": [*VERDICT_WORDS, None]}, "policy": {"enum": [VERDICT_POLICY, None]},
                "qualificationStage": _NULLABLE_STRING, "reasons": _STRINGS}}},
        "evidence": {"type": "object", "additionalProperties": False,
                     "required": ["runs", "experiments", "reports", "dossier"],
                     "properties": {"runs": _STRINGS, "experiments": _STRINGS, "reports": _STRINGS,
                                    "dossier": _NULLABLE_STRING}},
        "splits": {"type": "object", "additionalProperties": False, "required": ["lanes", "externalHoldout"],
                   "properties": {
                       "lanes": {"type": "array", "items": {
                           "type": "object", "additionalProperties": False,
                           "required": ["studyId", "runId", "validation", "visibleTest"],
                           "properties": {"studyId": {"type": "string"}, "runId": {"type": "string"},
                                          "validation": {"type": "object"},
                                          "visibleTest": {"type": "object", "required": ["role", "auditVisible", "metricsIncluded"],
                                                          "properties": {"metricsIncluded": {"const": False}}}}}},
                       "externalHoldout": {"type": "object", "additionalProperties": False,
                                           "required": ["custody", "heldInDesk", "digest", "auditStatus"],
                                           "properties": {"custody": {"enum": ["host", "not-supplied"]},
                                                          "heldInDesk": {"const": False},
                                                          "digest": {"type": ["string", "null"], "pattern": SHA256.pattern},
                                                          "auditStatus": {"enum": list(HOLDOUT_STATUSES)}}}}},
        "trialFamilies": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["studyId", "familyId", "deskTrialCount", "otherProjectTrials", "declarationRequired"],
            "properties": {"studyId": {"type": "string"}, "familyId": {"type": "string", "pattern": "^tf-[0-9a-f]{16}$"},
                           "deskTrialCount": {"type": "integer", "minimum": 0},
                           "otherProjectTrials": {"type": "integer", "minimum": 0},
                           "declarationRequired": {"type": "boolean"}}}},
        "instruments": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["symbol", "barId"],
            "properties": {"symbol": {"type": "string"}, "barId": _NULLABLE_STRING}}},
        "decisions": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["runId", "targetWeights", "orderIntents", "source"],
            "properties": {"runId": {"type": "string"}, "targetWeights": {"type": ["object", "null"]},
                           "orderIntents": {"type": ["array", "null"]},
                           "source": {"enum": ["run-evidence", "not-in-evidence"]}}}},
        "validity": {"type": "object", "additionalProperties": False,
                     "required": ["validFrom", "validUntil", "reviewDate", "source"],
                     "properties": {"validFrom": _DATE, "validUntil": _DATE, "reviewDate": _DATE,
                                    "source": {"const": "caller"}}},
        "assumptions": _STRINGS,
        "unsupportedClaims": _STRINGS,
        "tradingAuthority": {"const": "none"},
    },
}
