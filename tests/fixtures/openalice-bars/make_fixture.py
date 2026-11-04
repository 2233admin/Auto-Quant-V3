"""Regenerate the recorded OpenAlice `alice market bars --output` fixture.

The alice CLI was not runnable where acquire-openalice-bars was built, so this
deterministic fixture follows OpenAlice's documented BarsResult shape
(src/domain/market-data/bars/types.ts). Values are synthetic.
"""
import json
import math
from pathlib import Path

import exchange_calendars as xcals

ASSETS = {"AAPL": "yfinance|AAPL", "MSFT": "yfinance|MSFT", "NVDA": "yfinance|NVDA", "SPY": "yfinance|SPY"}
here = Path(__file__).resolve().parent
sessions = [d.strftime("%Y-%m-%d") for d in xcals.get_calendar("XNYS").sessions_in_range("2025-01-02", "2025-12-31")][:200]
for number, (symbol, bar_id) in enumerate(ASSETS.items()):
    bars, close = [], 100.0 + 30 * number
    for t, day in enumerate(sessions):
        step = 0.0004 + 0.012 * math.sin(t / (4.0 + number)) * math.cos(t / (13.0 + 2 * number))
        open_ = round(close * (1 - 0.002 * math.sin(t / 3.0 + number)), 4)
        close = round(close * math.exp(step), 4)
        high = round(max(open_, close) * (1.004 + 0.001 * math.cos(t / 5.0)), 4)
        low = round(min(open_, close) * (0.996 - 0.001 * math.sin(t / 7.0)), 4)
        volume = int(1_000_000 * (1 + 0.2 * number) * math.exp(0.3 * math.sin(t / (6.0 + number))))
        bars.append({"date": day, "open": open_, "high": high, "low": low, "close": close, "volume": volume})
    meta = {
        "symbol": symbol, "from": sessions[0], "to": sessions[-1], "bars": len(bars), "source": "vendor",
        "sourceId": "yfinance", "barId": bar_id, "provider": "yfinance", "barCapability": "delayed",
        "interval": "1d", "limit": 5000, "truncatedRows": 0, "asOf": sessions[-1],
        "quality": {"scope": "fetched_window_before_count", "inspectedRows": len(bars), "excludedRows": 0,
                    "latestExcludedRecordAt": None, "latestExcludedFields": [], "reason": None},
        "freshness": {"earliestRecordAt": sessions[0], "earliestTimestampKind": "date", "earliestTimezone": None,
                      "latestTimezone": None, "timestampMeaning": "provider_bar_timestamp",
                      "delay": {"status": "unknown", "estimatedSeconds": None, "basis": "historical_request",
                                "explanation": "Historical request; record age is not a live delay signal."},
                      "fetchedAt": "2025-11-01T00:00:00.000Z", "latestRecordAt": sessions[-1],
                      "timestampKind": "date", "recordAgeSeconds": None, "historical": True},
    }
    (here / f"{symbol}.json").write_text(json.dumps({"bars": bars, "meta": meta}, indent=2) + "\n", encoding="utf-8")
assets = [{"symbol": s, "barId": b, "venue": "US-COMPOSITE", "currency": "USD", "assetClass": "equity",
           "barsFile": f"{s}.json"} for s, b in ASSETS.items()]
(here / "assets.json").write_text(json.dumps(assets, indent=2) + "\n", encoding="utf-8")
