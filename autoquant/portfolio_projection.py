"""Shared strict Portfolio projection primitives; no evaluation authority."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .intervals import timestamp_label
from .workspace import AutoQuantValidationError, ValidationIssue

BREAK_EVEN_COST_SEARCH_MAX_BPS = 1_000.0
STRATEGY_VIABILITY_METHOD = (
    "validation-factor-gross-friction-net-viability-diagnosis-v1"
)


def _issue(path: Path | str, code: str, message: str) -> ValidationIssue:
    return ValidationIssue(str(path), code, message)



def _fail(path: Path | str, code: str, message: str) -> None:
    raise AutoQuantValidationError([_issue(path, code, message)])



def _finite(value: Any, path: Path | str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        _fail(path, "portfolio.number", "Expected a finite numeric value")
    if not math.isfinite(number):
        _fail(path, "portfolio.number", "Expected a finite numeric value")
    return number



def _optional_finite(value: Any, path: Path | str) -> float | None:
    if value is None or value == "":
        return None
    return _finite(value, path)



def _session_date(value: Any, path: Path | str) -> str:
    if not isinstance(value, str):
        _fail(
            path,
            "portfolio.timestamp",
            "Timestamp must be an ISO date or UTC date-time",
        )
    try:
        normalized = timestamp_label(value)
    except (TypeError, ValueError):
        _fail(
            path,
            "portfolio.timestamp",
            "Timestamp must be an ISO date or UTC date-time",
        )
    if normalized != value:
        _fail(
            path,
            "portfolio.timestamp",
            "Timestamp must be a canonical ISO date or UTC date-time",
        )
    return value



@dataclass(frozen=True)
class ParsedDaily:
    dates: list[str]
    rows: list[dict[str, Any]]



def _split_for(timestamp: str, splits: dict[str, Any], names: list[str]) -> str:
    for name in names:
        if splits[name]["start"] <= timestamp <= splits[name]["end"]:
            return name
    _fail(
        timestamp,
        "portfolio.split-membership",
        "Daily timestamp does not belong to exactly one fixed split",
    )



def _sample_indices(
    total: int,
    limit: int,
    anchors: set[int],
) -> list[int]:
    if total <= limit:
        return list(range(total))
    fixed = sorted(index for index in anchors if 0 <= index < total)
    if len(fixed) > limit:
        _fail(
            "portfolio sampling",
            "portfolio.sample-limit",
            "Point limit is smaller than required accounting anchors",
        )
    candidates = [index for index in range(total) if index not in anchors]
    slots = limit - len(fixed)
    selected: set[int] = set(fixed)
    if slots >= len(candidates):
        selected.update(candidates)
    elif slots == 1:
        selected.add(candidates[len(candidates) // 2])
    elif slots > 1:
        positions = {
            round(position * (len(candidates) - 1) / (slots - 1))
            for position in range(slots)
        }
        selected.update(candidates[position] for position in positions)
        if len(selected) < limit:
            selected.update(
                candidate
                for candidate in candidates
                if candidate not in selected
                for _ in [None]
                if len(selected) < limit
            )
    return sorted(selected)



