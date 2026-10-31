"""Honesty envelope for descriptive price-event results.

Every rate leaves this module with its sample size. Binary outcomes carry a
Wilson score interval, fixed minimum-sample guards, a chronological
first-half/second-half stability split, and per-year counts. Continuous
outcomes carry fixed quantiles. The envelope is a read-side projection of the
already verified immutable event ledger; it never changes a Run.

Method referenced from the conditional-frequency statistics of the open-source
Edge Stats project (MIT); this is an independent Python implementation of the
standard Wilson interval and guard conventions.
"""

from __future__ import annotations

import math
from typing import Any, Sequence

import numpy as np
import pandas as pd


ENVELOPE_METHOD = "wilson-honesty-envelope-v1"
Z_95 = 1.959963984540054
CONFIDENCE_LEVEL = 0.95
WARN_BELOW = 30
WITHHOLD_BELOW = 10
QUANTILES = (0.10, 0.25, 0.50, 0.75, 0.90)
DISCLAIMER = (
    "Historical conditional frequencies with sample sizes. Not predictions, "
    "not advice, and no trading authority."
)


def wilson_interval(
    successes: int,
    count: int,
    z: float = Z_95,
) -> tuple[float, float] | None:
    """Wilson score interval for a binomial proportion; None when count is 0."""

    if count <= 0:
        return None
    if successes < 0 or successes > count:
        raise ValueError(f"impossible counts: k={successes} n={count}")
    p = successes / count
    z2 = z * z
    denominator = 1.0 + z2 / count
    center = (p + z2 / (2.0 * count)) / denominator
    half = (
        z * math.sqrt(p * (1.0 - p) / count + z2 / (4.0 * count * count))
    ) / denominator
    return max(0.0, center - half), min(1.0, center + half)


def guard_status(count: int) -> str:
    """ok at or above the warn floor, small-sample below it, withheld below 10."""

    if count < WITHHOLD_BELOW:
        return "withheld"
    if count < WARN_BELOW:
        return "small-sample"
    return "ok"


def rate(successes: int, count: int) -> dict[str, Any]:
    """One rate with its N, guard status, and (when allowed) estimate and CI."""

    guard = guard_status(count)
    if guard == "withheld":
        return {
            "n": count,
            "successes": successes,
            "guard": guard,
            "estimate": None,
            "ci95": None,
        }
    interval = wilson_interval(successes, count)
    assert interval is not None
    return {
        "n": count,
        "successes": successes,
        "guard": guard,
        "estimate": successes / count,
        "ci95": [interval[0], interval[1]],
    }


def stability_split(flags: Sequence[bool]) -> dict[str, Any]:
    """First half versus second half of a chronologically ordered outcome list.

    The first half holds the first ``n // 2`` observations. The halves agree
    when their Wilson intervals overlap; agreement is null when either half is
    withheld by the minimum-sample guard.
    """

    count = len(flags)
    cut = count // 2
    first, second = list(flags[:cut]), list(flags[cut:])
    first_rate = rate(sum(first), len(first))
    second_rate = rate(sum(second), len(second))
    agree: bool | None = None
    if first_rate["ci95"] is not None and second_rate["ci95"] is not None:
        agree = (
            first_rate["ci95"][0] <= second_rate["ci95"][1]
            and second_rate["ci95"][0] <= first_rate["ci95"][1]
        )
    return {"firstHalf": first_rate, "secondHalf": second_rate, "agree": agree}


def quantile_summary(values: Sequence[float]) -> dict[str, Any]:
    """Count, mean, extremes, and fixed quantiles; null fields when empty."""

    array = np.asarray(list(values), dtype=float)
    if len(array) == 0:
        return {
            "n": 0,
            "mean": None,
            "minimum": None,
            "maximum": None,
            "quantiles": {f"p{round(q * 100)}": None for q in QUANTILES},
        }
    return {
        "n": int(len(array)),
        "mean": float(array.mean()),
        "minimum": float(array.min()),
        "maximum": float(array.max()),
        "quantiles": {
            f"p{round(q * 100)}": float(np.quantile(array, q))
            for q in QUANTILES
        },
    }


def _year(timestamp: str) -> int:
    return int(pd.Timestamp(timestamp).year)


def per_year(
    timestamps: Sequence[str],
    flags: Sequence[bool],
) -> list[dict[str, Any]]:
    """Counts per calendar year of the event; estimates obey the same guard."""

    buckets: dict[int, list[bool]] = {}
    for timestamp, flag in zip(timestamps, flags, strict=True):
        buckets.setdefault(_year(timestamp), []).append(bool(flag))
    return [
        {"year": year, **rate(sum(values), len(values))}
        for year, values in sorted(buckets.items())
    ]


def build_event_envelope(
    events: Sequence[dict[str, Any]],
    unconditional_asset_returns: Sequence[float],
) -> dict[str, Any]:
    """Derive the envelope from verified events (primary population only).

    ``events`` are the verified ledger rows in chronological order. Rates use
    the non-overlapping primary population because that is the only population
    whose observations do not share return intervals. The unconditional
    reference rate is reported with N but never with an interval, because its
    observations overlap by construction.
    """

    primary = [row for row in events if row["primaryEligible"]]
    timestamps = [row["eventTimestamp"] for row in primary]
    asset_returns = [float(row["assetReturn"]) for row in primary]
    excess_returns = [float(row["excessReturn"]) for row in primary]
    positive_asset = [value > 0.0 for value in asset_returns]
    positive_excess = [value > 0.0 for value in excess_returns]
    unconditional_positive = sum(1 for value in unconditional_asset_returns if value > 0.0)
    unconditional_count = len(unconditional_asset_returns)

    def outcome(flags: list[bool]) -> dict[str, Any]:
        return {
            **rate(sum(flags), len(flags)),
            "stability": stability_split(flags),
            "perYear": per_year(timestamps, flags),
        }

    return {
        "method": ENVELOPE_METHOD,
        "confidenceLevel": CONFIDENCE_LEVEL,
        "population": "primary-non-overlapping-events",
        "guards": {"warnBelow": WARN_BELOW, "withholdBelow": WITHHOLD_BELOW},
        "outcomes": {
            "primaryPositiveReturn": outcome(positive_asset),
            "primaryPositiveExcess": outcome(positive_excess),
        },
        "unconditionalPositiveReturn": {
            "n": unconditional_count,
            "successes": unconditional_positive,
            "estimate": (
                unconditional_positive / unconditional_count
                if unconditional_count
                else None
            ),
            "ci95": None,
            "intervalWithheldReason": "overlapping-observations",
        },
        "returnDistribution": quantile_summary(asset_returns),
        "excessDistribution": quantile_summary(excess_returns),
        "disclaimer": DISCLAIMER,
    }
