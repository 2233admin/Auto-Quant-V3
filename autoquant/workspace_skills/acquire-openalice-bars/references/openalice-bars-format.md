# OpenAlice bar export and assets file

## `alice market bars` output

Read from the OpenAlice source (read only): `alice market bars` maps to the
`getMarketBars` tool (`src/server/cli-commands.ts`,
`src/tool/market-bars.ts`). Flags follow its input schema: `--bar-id`, or
`--symbol` with `--asset-class`; `--interval` (`1m`…`1w`, default `1d`);
`--count`, `--start`, `--end`, `--as-of`; `--output FILE` (refuses to
overwrite). The file is the `BarsResult` object
(`src/domain/market-data/bars/types.ts`):

```json
{
  "bars": [
    {"date": "2025-01-02", "open": 1.0, "high": 1.1, "low": 0.9, "close": 1.05, "volume": 1200}
  ],
  "meta": {
    "symbol": "AAPL", "from": "2025-01-02", "to": "2025-10-31", "bars": 210,
    "source": "vendor", "sourceId": "yfinance", "barId": "yfinance|AAPL",
    "provider": "yfinance", "barCapability": "delayed", "interval": "1d",
    "truncatedRows": 0,
    "quality": {"scope": "fetched_window_before_count", "inspectedRows": 210,
                "excludedRows": 0, "latestExcludedRecordAt": null,
                "latestExcludedFields": [], "reason": null},
    "freshness": {"timestampKind": "date", "timestampMeaning": "provider_bar_timestamp",
                  "fetchedAt": "2025-11-01T00:00:00.000Z", "historical": true,
                  "delay": {"status": "unknown", "basis": "historical_request"}}
  }
}
```

Daily and weekly bars are rendered date-only; intraday bars are ISO instants.
`volume` may be `null` for some sources. The metadata carries no adjustment
or exchange-calendar claim.

The `alice` CLI was not runnable on the machine that built this Skill; the
script and its tests are written against this documented format with a
recorded fixture (`tests/fixtures/openalice-bars/`).

## Assets file

```json
[
  {"symbol": "AAPL", "barId": "yfinance|AAPL", "venue": "XNAS", "currency": "USD",
   "assetClass": "equity", "barsFile": "exports/AAPL.json"}
]
```

`barsFile` resolves from the assets file's directory. `symbol` is the
AutoQuant asset id (path-safe); `barId` is copied intact from
`alice market search-bars`.
