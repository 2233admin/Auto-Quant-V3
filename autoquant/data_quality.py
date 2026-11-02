"""Deterministic, network-free OHLCV diagnostics; never intake or scientific authority."""
from __future__ import annotations

from pathlib import Path
from zoneinfo import ZoneInfo

import exchange_calendars as xcals
import numpy as np
import pandas as pd

from .data_sources import load_sources
from .intake import normalize_ohlcv
from .ohlcv import coerce_ohlcv

CHECKS = ("parsing", "duplicates", "ordering", "prices", "ohlc", "volume", "zero-volume",
          "missing-bars", "long-gaps", "price-jumps", "session-alignment", "timezone", "survivorship")
RANK = {"pass": 0, "warn": 1, "fail": 2}


def check(name, examples=(), *, severity="fail", count=None, **extra):
    examples = list(examples)
    count = len(examples) if count is None else count
    return {"id": name, "verdict": severity if count else "pass", "count": int(count),
            "examples": examples[:5], **extra}


def _examples(frame, mask):
    return [{"row": int(i) + 2, "timestamp": None if pd.isna(frame.loc[i, "date"]) else frame.loc[i, "date"].isoformat()}
            for i in frame.index[mask]]


def _expected(index, market, frequency, *, date_only, options):
    """Exact calendar sessions, explicit weekdays, or epoch-anchored 24/7 bars.

    provider-observed and unnamed calendars deliberately have no inferred grid.
    """
    calendar = market.get("calendar")
    duration = pd.Timedelta(frequency)
    if duration <= pd.Timedelta(0):
        raise ValueError("Frequency must be positive")
    start = pd.Timestamp(options.get("start", index.min()))
    end = pd.Timestamp(options.get("end", index.max()))
    start = start.tz_localize("UTC") if start.tzinfo is None else start.tz_convert("UTC")
    end = end.tz_localize("UTC") if end.tzinfo is None else end.tz_convert("UTC")
    if end < start:
        raise ValueError("Declared end precedes start")
    if (end - start) / duration > 2_000_000:
        raise ValueError("Declared grid exceeds two million bars")
    if calendar == "24/7":
        return pd.date_range(start.ceil(duration), end.floor(duration), freq=duration)
    if frequency == "1d" and date_only and calendar == "weekdays":
        return pd.bdate_range(start.normalize(), end.normalize())
    if calendar not in xcals.get_calendar_names():
        return None
    cal = xcals.get_calendar(calendar, start=str((start - pd.Timedelta(days=7)).date()), end=str((end + pd.Timedelta(days=7)).date()))
    schedule = cal.schedule
    if frequency == "1d" and date_only:
        dates = pd.DatetimeIndex(schedule.index)
        dates = dates.tz_localize("UTC") if dates.tz is None else dates.tz_convert("UTC")
        return dates[(dates >= start.normalize()) & (dates <= end.normalize())]
    result = []
    for _, row in schedule.iterrows():
        # Breaks are respected for calendars with a lunch session.
        segments = [(row.open, row.close)]
        if frequency != "1d" and pd.notna(row.get("break_start")):
            segments = [(row.open, row.break_start), (row.break_end, row.close)]
        if frequency == "1d":
            result.append(row.close)
        else:
            for opening, closing in segments:
                result.extend(pd.date_range(opening + duration, closing, freq=duration))
                if not result or result[-1] != closing:
                    result.append(closing)
    grid = pd.DatetimeIndex(result)
    return grid[(grid >= start) & (grid <= end)]


def quality_report(path: str | Path, options: dict | None = None) -> dict:
    options = {} if options is None else options
    if not isinstance(options, dict):
        raise ValueError("Quality options must be an object")
    threshold = options.get("jumpThreshold", 0.3)
    gap_bars = options.get("longGapBars", 5)
    if type(threshold) not in (int, float) or not np.isfinite(threshold) or threshold <= 0:
        raise ValueError("jumpThreshold must be a finite positive return fraction")
    if type(gap_bars) is not int or gap_bars < 1:
        raise ValueError("longGapBars must be a positive integer")
    listing = options.get("universeStatus", "unknown")
    if listing not in ("unknown", "currently-listed-only", "contains-delisted"):
        raise ValueError("Invalid universeStatus declaration")
    source, package, assets, frequency, digest = load_sources(path, options)
    adjustment = (package or {}).get("priceAdjustment", options.get("priceAdjustment", "unknown"))
    result, indexes = [], []
    for asset in assets:
        raw = asset.frame
        checks = []
        try:
            frame = coerce_ohlcv(raw, source=asset.symbol)
        except (ValueError, TypeError) as error:
            checks = [check("parsing", [{"detail": str(error)}])]
            result.append({"asset": asset.symbol, "rows": len(raw), "dateRange": None, "market": asset.market,
                           "missingBarRate": None, "checks": checks, "verdict": "fail"})
            continue
        invalid = frame.isna().any(axis=1)
        checks.append(check("parsing", _examples(frame, invalid)))
        checks.append(check("duplicates", _examples(frame, frame.date.duplicated(keep="first"))))
        checks.append(check("ordering", _examples(frame, frame.date.diff() < pd.Timedelta(0))))
        prices = frame[["open", "high", "low", "close"]]
        checks.append(check("prices", _examples(frame, (~np.isfinite(prices) | (prices <= 0)).any(axis=1))))
        bounds = (frame.low > frame[["open", "close", "high"]].min(axis=1)) | (frame.high < frame[["open", "close", "low"]].max(axis=1))
        checks.append(check("ohlc", _examples(frame, bounds)))
        checks.append(check("volume", _examples(frame, ~np.isfinite(frame.volume) | (frame.volume < 0))))
        checks.append(check("zero-volume", _examples(frame, frame.volume == 0), severity="warn"))
        valid = frame.loc[frame.date.notna()].drop_duplicates("date").sort_values("date")
        index = pd.DatetimeIndex(valid.date)
        indexes.append((asset.symbol, index))
        date_only = bool(len(index) and (index == index.normalize()).all() and (package or {}).get("schemaVersion") != 5)
        zone = asset.market.get("timezone")
        try:
            if not zone:
                raise ValueError("Timezone is unknown")
            ZoneInfo(zone)
            timezone_issues = []
        except (ValueError, KeyError):
            timezone_issues = [{"timezone": zone, "detail": "Timezone authority is missing or invalid"}]
        checks.append(check("timezone", timezone_issues, severity="warn" if not zone else "fail"))
        if frequency != "1d" or (package or {}).get("schemaVersion") in (5, 6):
            date_column = next((c for c in raw.columns if str(c).strip().lower() in ("date", "datetime", "timestamp", "time")), None)
            if date_column is not None and not pd.api.types.is_numeric_dtype(raw[date_column]):
                naive = ~raw[date_column].astype(str).str.contains(r"(?:[zZ]|[+-]\d{2}:?\d{2})$", regex=True)
                if naive.any():
                    checks[-1] = check("timezone", _examples(frame, naive), severity="fail", detail="Intraday and V5/V6 timestamps must carry explicit UTC offsets")
        expected = _expected(index, asset.market, frequency, date_only=date_only, options=options) if len(index) else None
        missing_rate = None
        if expected is None:
            unknown = [{"detail": "Missing-bar rate is unknown without a supported declared calendar and timestamps"}]
            checks.extend([check("missing-bars", unknown, severity="warn", rate=None, expectedBars=None),
                           check("long-gaps", unknown, severity="warn"), check("session-alignment", unknown, severity="warn")])
        else:
            missing = expected.difference(index)
            missing_rate = len(missing) / len(expected) if len(expected) else 0.0
            checks.append(check("missing-bars", [{"timestamp": t.isoformat()} for t in missing], severity="warn", rate=missing_rate, expectedBars=len(expected)))
            checks.append(check("session-alignment", [{"timestamp": t.isoformat()} for t in index.difference(expected)]))
            runs, begin = [], None
            absent = ~expected.isin(index)
            for i, is_missing in enumerate([*absent, False]):
                if is_missing and begin is None:
                    begin = i
                elif not is_missing and begin is not None:
                    if i - begin >= gap_bars:
                        runs.append({"start": expected[begin].isoformat(), "end": expected[i-1].isoformat(), "missingBars": i-begin})
                    begin = None
            checks.append(check("long-gaps", runs, severity="warn", interpretation="Possible suspension or missing data; cause is unverified"))
        returns = valid.close.pct_change(fill_method=None)
        jumps = [{"timestamp": valid.loc[i, "date"].isoformat(), "return": float(returns.loc[i])}
                 for i in valid.index[(returns.abs() > threshold) & np.isfinite(returns)]]
        checks.append(check("price-jumps", jumps, severity="warn", threshold=threshold, adjustment=adjustment,
                            hint="Raw prices may contain corporate actions" if adjustment == "raw" else "Adjustment is a caller claim; verify jumps against source evidence"))
        checks.append(check("survivorship", [] if listing == "contains-delisted" else [{"coverage": listing}], severity="warn",
                            coverage=listing, authenticated=False))
        # Exercise the same strict OHLCV validation as intake, never its result as a repair.
        try:
            normalize_ohlcv(raw, source=asset.symbol)
        except (ValueError, TypeError) as error:
            checks.append(check("intake-ohlcv", [{"detail": str(error)}]))
        verdict = max((c["verdict"] for c in checks), key=RANK.get)
        result.append({"asset": asset.symbol, "rows": len(frame), "dateRange": {"start": index.min().isoformat(), "end": index.max().isoformat()} if len(index) else None,
                       "market": asset.market, "missingBarRate": missing_rate, "checks": checks, "verdict": verdict})
    alignment = []
    if indexes:
        reference_symbol, reference = indexes[0]
        for symbol, index in indexes[1:]:
            count = len(reference.symmetric_difference(index))
            if count:
                alignment.append({"asset": symbol, "reference": reference_symbol, "unmatchedTimestamps": count})
    summary = []
    for name in (*CHECKS, "intake-ohlcv"):
        found = [c for a in result for c in a["checks"] if c["id"] == name]
        if found:
            summary.append({"id": name, "verdict": max((c["verdict"] for c in found), key=RANK.get),
                            "count": sum(c["count"] for c in found),
                            "examples": [{"asset": a["asset"], **e} for a in result for c in a["checks"] if c["id"] == name for e in c["examples"]][:5]})
    summary.append(check("cross-asset-alignment", alignment, severity="warn", interpretation="Unmatched timestamps remain absent; observed-only panels may be intentional"))
    return {"schemaVersion": 1, "kind": "autoquant-data-quality-report", "source": str(source), "sourceHash": digest,
            "frequency": frequency, "jumpThreshold": threshold, "longGapBars": gap_bars, "universeStatus": listing,
            "rangeBasis": "Declared start/end, otherwise each asset's observed span; no listing-history inference",
            "verdict": max((c["verdict"] for c in summary), key=RANK.get), "summary": summary, "assets": result}
