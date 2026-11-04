"""Core projection of the Judge's Factor evidence into the development verdict word.

Studio's idea card and ``handoff.json`` must show the same word for the same
Run, so the rule lives here rather than in a browser read model. The words and
their limits are owned by docs/design/idea-verdict-card.md. There is no
"Refuted" state: no current Core protocol permits it.
"""

from __future__ import annotations

from typing import Any


VERDICT_POLICY = "factor-idea-development-v1"
VERDICT_WORDS = ("Supported", "Inconclusive", "Could not be tested", "Not tested")


def factor_development_verdict(
    *,
    tested: bool,
    exact: bool,
    run_status: str | None,
    qualification: dict[str, Any] | None,
    adjustment: dict[str, Any] | None,
) -> dict[str, Any]:
    """Return ``{"word", "reasons"}`` from Judge-produced evidence only."""

    qualification = qualification or {}
    claim = qualification.get("claim") or {}
    diagnosis = qualification.get("diagnosis") or {}
    if not tested:
        return {"word": "Not tested", "reasons": ["no-run"]}
    reasons = []
    if not exact:
        reasons.append("evidence-not-verified-for-this-run")
    if run_status != "succeeded":
        reasons.append(f"run-status-{run_status}")
    if not qualification.get("available"):
        reasons.append(qualification.get("reason") or "factor-qualification-unavailable")
    elif not diagnosis:
        reasons.append("factor-diagnosis-unavailable")
    if claim.get("claim") != "decision-signal" or claim.get("outcome") != "forward-return":
        reasons.append("claim-outside-development-policy")
    if reasons:
        return {"word": "Could not be tested", "reasons": reasons}
    stage = diagnosis.get("stage")
    passes = (adjustment or {}).get("passes")
    if stage == "decision-signal-positive" and passes is True:
        return {"word": "Supported", "reasons": ["decision-signal-positive", "selection-adjustment-passes"]}
    reasons = [f"diagnosis-{stage}" if stage != "decision-signal-positive" else "decision-signal-positive"]
    if passes is not True:
        status = (adjustment or {}).get("status")
        reasons.append("selection-adjustment-does-not-pass" if status == "available" else
                       f"selection-adjustment-{(adjustment or {}).get('reason') or 'unavailable'}")
    return {"word": "Inconclusive", "reasons": reasons}
