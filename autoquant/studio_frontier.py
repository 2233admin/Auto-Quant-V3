"""Noise-frontier series for the Studio Factor and Strategy pages.

The frontier shows how large the best of N noise-only trials is expected to
look, against the selected value. Studio only draws it. This module computes
every plotted number from statistics Core already published for the selected
Run, using the closed form in ``selection.expected_maximum_z`` and the same
normal quantile function. It adds no verdict: ``passes`` is the value the
Core selection adjustment already carries, never a comparison made here.

The series are read-model fields beside the frozen evidence. They never enter
a Run, Judge, Session ledger or Report.
"""

from __future__ import annotations

import math
from typing import Any

from .selection import CONFIDENCE_LEVEL, NORMAL, expected_maximum_z

FRONTIER_SCHEMA_VERSION = 1
FACTOR_KIND = "factor-mean-ic"
PORTFOLIO_KIND = "portfolio-net-sharpe"
# The curve spans N = 1 .. max(MINIMUM_AXIS_TRIALS, 4 * N_ledger), log spaced.
MINIMUM_AXIS_TRIALS = 50
CURVE_POINTS = 80
TABLE_TRIALS = (1, 2, 5, 10, 20, 50)

PORTFOLIO_METHOD = "deflated-sharpe-ratio-v1"


def _finite(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _unavailable(
    kind: str,
    code: str,
    detail: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "schemaVersion": FRONTIER_SCHEMA_VERSION,
        "kind": kind,
        "status": "unavailable",
        "reasonCode": code,
        "detail": detail,
    }


def _axis(trials: int) -> tuple[int, list[float], list[int]]:
    """Log-spaced curve abscissae from 1 to the axis maximum, and the table rows."""

    maximum = max(MINIMUM_AXIS_TRIALS, trials * 4)
    log_maximum = math.log(maximum)
    curve = [
        math.exp(index / (CURVE_POINTS - 1) * log_maximum)
        for index in range(CURVE_POINTS)
    ]
    curve[0] = 1.0
    curve[-1] = float(maximum)
    table = sorted({*TABLE_TRIALS, trials})
    return maximum, curve, table


def _adjustment_unavailable(kind: str, adjustment: dict[str, Any]) -> dict[str, Any]:
    return _unavailable(
        kind,
        "adjustment-unavailable",
        {
            "status": adjustment.get("status"),
            "reason": adjustment.get("reason"),
        },
    )


def factor_noise_frontier(
    sessions: list[dict[str, Any]],
    runs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Frontier of the best mean IC under noise, from the Project Factor ledger.

    The HAC standard error is recovered from the selected value and its raw
    p-value: ``|IC| / z(1 - p / 2)``. The expectation is that error times the
    expected maximum of N standard-normal trials. The pass line inverts the
    published Bonferroni rule (adjusted p = raw p x N <= 0.05).
    """

    candidates = [
        item["selectionIntegrity"]
        for item in sessions
        if isinstance(item.get("selectionIntegrity"), dict)
        and item["selectionIntegrity"].get("selectionMetric")
        == "validation_mean_ic"
    ]
    if not candidates:
        return _unavailable(FACTOR_KIND, "no-factor-ledger")
    integrity = next(
        (
            candidate
            for candidate in candidates
            if isinstance(candidate.get("selectionAdjustment"), dict)
            and candidate["selectionAdjustment"].get("statistics")
        ),
        candidates[0],
    )
    adjustment = integrity.get("selectionAdjustment")
    family = integrity.get("researchFamily")
    if not isinstance(adjustment, dict) or not isinstance(family, dict):
        return _unavailable(FACTOR_KIND, "no-adjustment")
    statistics = adjustment.get("statistics")
    if adjustment.get("status") != "available" or not isinstance(statistics, dict):
        return _adjustment_unavailable(FACTOR_KIND, adjustment)
    observed = _finite(statistics.get("observedMeanIc"))
    raw_p = _finite(statistics.get("rawHacPValue"))
    adjusted_p = _finite(statistics.get("familywiseAdjustedPValue"))
    trials = statistics.get("uniqueTrials")
    if (
        observed is None
        or observed == 0.0
        or raw_p is None
        or not 0.0 < raw_p < 1.0
        or adjusted_p is None
        or isinstance(trials, bool)
        or not isinstance(trials, int)
        or trials < 1
    ):
        return _unavailable(FACTOR_KIND, "degenerate-p-value")

    # Two-sided z from the lower tail: 1 - p/2 rounds to 1.0 for p below about
    # 1e-16, which inv_cdf rejects, while inv_cdf(p/2) stays exact down to the
    # smallest normal float. The value is identical for every ordinary p.
    half = raw_p / 2.0
    if half <= 0.0:
        return _unavailable(FACTOR_KIND, "degenerate-p-value")
    standard_error = abs(observed) / -NORMAL.inv_cdf(half)

    def expected(count: float) -> float:
        return standard_error * max(0.0, expected_maximum_z(count))

    def pass_line(count: float) -> float:
        return standard_error * NORMAL.inv_cdf(
            1.0 - (1.0 - CONFIDENCE_LEVEL) / 2.0 / max(1.0, count)
        )

    def row(count: float) -> dict[str, float]:
        return {
            "trials": count,
            "expected": expected(count),
            "passLine": pass_line(count),
        }

    maximum, curve, table = _axis(trials)
    matches = [
        run["id"]
        for run in runs
        if _finite(run.get("primaryValue")) is not None
        and abs(float(run["primaryValue"]) - observed) < 1e-12
    ]
    return {
        "schemaVersion": FRONTIER_SCHEMA_VERSION,
        "kind": FACTOR_KIND,
        "status": "available",
        "reasonCode": None,
        "detail": None,
        "method": adjustment.get("method"),
        "trials": trials,
        "axisMaximumTrials": maximum,
        "standardError": standard_error,
        "selectedValue": observed,
        "rawPValue": raw_p,
        "adjustedPValue": adjusted_p,
        "passes": adjustment.get("passes"),
        "expectedAtTrials": expected(trials),
        "passLineAtTrials": pass_line(trials),
        "trialCountAssumption": family.get("trialCountAssumption"),
        "totalExecutions": family.get("totalExecutions"),
        "leaderRunId": matches[0] if len(matches) == 1 else None,
        "curve": [row(count) for count in curve],
        "table": [row(float(count)) for count in table],
    }


def portfolio_noise_frontier(
    adjustment: dict[str, Any] | None,
    family: dict[str, Any] | None,
) -> dict[str, Any]:
    """Frontier of the best annualized net Sharpe under noise for a Portfolio Run.

    The expectation is the trial dispersion Core measured from the Project
    successful Sharpe trials times the expected maximum of N standard-normal
    trials, the same product ``expected_maximum_sharpe`` forms for the deflated
    Sharpe ratio. Without an available Core adjustment, or with no measured
    spread across trials, there is no series.
    """

    if not isinstance(adjustment, dict):
        return _unavailable(PORTFOLIO_KIND, "no-adjustment")
    statistics = adjustment.get("statistics")
    if (
        adjustment.get("status") != "available"
        or adjustment.get("method") != PORTFOLIO_METHOD
        or not isinstance(statistics, dict)
    ):
        return _adjustment_unavailable(PORTFOLIO_KIND, adjustment)
    trials = statistics.get("uniqueTrials")
    annualization = statistics.get("annualizationPeriods")
    dispersion = _finite(statistics.get("trialSharpeDispersionAnnualized"))
    observed = _finite(statistics.get("observedAnnualizedSharpe"))
    expected_at_trials = _finite(statistics.get("expectedMaximumAnnualizedSharpe"))
    if (
        isinstance(trials, bool)
        or not isinstance(trials, int)
        or trials < 1
        or isinstance(annualization, bool)
        or not isinstance(annualization, int)
        or annualization < 1
        or dispersion is None
        or dispersion < 0.0
        or observed is None
        or expected_at_trials is None
    ):
        return _unavailable(PORTFOLIO_KIND, "incomplete-trial-statistics")
    if dispersion / math.sqrt(annualization) <= 1e-15:
        # Core's cut-off for no measured spread (a single trial): the noise scale is unknown, so draw no curve.
        return _unavailable(
            PORTFOLIO_KIND,
            "no-trial-dispersion",
            {
                "trials": trials,
                "successfulTrials": statistics.get("successfulSharpeTrials"),
            },
        )

    def expected(count: float) -> float:
        return dispersion * max(0.0, expected_maximum_z(count))

    maximum, curve, table = _axis(trials)
    return {
        "schemaVersion": FRONTIER_SCHEMA_VERSION,
        "kind": PORTFOLIO_KIND,
        "status": "available",
        "reasonCode": None,
        "detail": None,
        "method": adjustment.get("method"),
        "trials": trials,
        "axisMaximumTrials": maximum,
        "successfulTrials": statistics.get("successfulSharpeTrials"),
        "trialDispersion": dispersion,
        "selectedValue": observed,
        "passes": adjustment.get("passes"),
        "deflatedSharpeProbability": _finite(
            statistics.get("deflatedSharpeProbability")
        ),
        "expectedAtTrials": expected_at_trials,
        "trialCountAssumption": (family or {}).get("trialCountAssumption"),
        "totalExecutions": (family or {}).get("totalExecutions"),
        "curve": [
            {"trials": count, "expected": expected(count)} for count in curve
        ],
        "table": [
            {"trials": float(count), "expected": expected(float(count))}
            for count in table
        ],
    }
