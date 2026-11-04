---
name: acquire-openalice-bars
description: Turn OpenAlice BarService daily K-lines (exported with `alice market bars --output`) into an auditable AutoQuant staging package that keeps each asset's exact OpenAlice barId, the caller's timezone, calendar and adjustment claim, and the raw export bytes. Use when AutoQuant runs as an OpenAlice desk and the delegating coworker names OpenAlice barIds or supplies `alice market bars` files instead of asking the desk to download from a public provider.
---

# Acquire OpenAlice bars

OpenAlice's Market UI, `alice market bars` and the `getMarketBars` tool share
one BarService. A `barId` is `{sourceId}|{nativeSymbol}` and identifies a
*source* as well as an instrument: `yfinance|AAPL` and an Alpaca account's
`AAPL` are different series. Never rewrite native symbols or merge two
barIds into one asset.

Run the bundled script with `aq-python`, never an ambient `python`.

## Prepare

1. Read `$acquire-market-ohlcv` for the general research-data contract. This
   Skill is one provider route; it does not lift the two-source comparison
   rule when the research question needs independent confirmation.
2. Get from the caller, and record in `research.md`, the facts OpenAlice bar
   metadata does not carry: the price **adjustment** meaning of that source,
   the session **timezone**, the exchange **calendar**, whether the panel must
   be **aligned** or may be **observed-only**, and the data-use **terms**. The
   script refuses (`openalice.caller-fact-missing`) instead of defaulting any
   of them.
3. Write an assets file (see
   [openalice-bars-format.md](references/openalice-bars-format.md)): one entry
   per asset with `symbol`, exact `barId`, `venue`, `currency`, optional
   `assetClass`, and `barsFile` when the caller already exported the bars.

## Package

```bash
aq-python scripts/package_openalice_bars.py \
  --assets /absolute/path/assets.json \
  --output <workspace>/staging/market-data/<dataset-id> \
  --dataset-id <dataset-id> --dataset-version <version> \
  --asset-class equity --interval 1d \
  --adjustment split-adjusted --timezone America/New_York --calendar XNYS \
  --panel aligned \
  --terms "caller-authorized research use of OpenAlice market data"
```

When an asset has no `barsFile` and the `alice` CLI is available, add
`--fetch-start YYYY-MM-DD --fetch-end YYYY-MM-DD`; the script runs
`alice market bars --bar-id <barId> --interval 1d --start ... --end ...
--output <file>` per asset and preserves the bytes under `raw/`.

The script accepts only completed daily bars. OpenAlice intraday timestamps
are provider bar labels (`freshness.timestampMeaning =
provider_bar_timestamp`), not verified bar-close instants, so intraday V3/V5
packaging is refused until an exact close mapping exists.

It refuses rather than repairs: a `meta.barId` that differs from the
caller's barId, a different `meta.interval`, rows truncated at OpenAlice's
response ceiling, non-date labels, missing or non-positive OHLC, high/low
outside open/close, null or negative volume, unordered dates, and (for
`--panel aligned`) any asset whose dates differ. A refusal removes the output
directory and creates no package.

## Output

- `dataset-package.json`: V1 (aligned) or V4 (observed-only) package with
  `provider.name = openalice` and `provider.sourceUri =
  openalice-bars:v1?interval=…&timezone=…&adjustment=…&bar.<symbol>=<barId>`.
  Intake copies this claim into the content-locked snapshot, so every
  asset's barId becomes part of the Run's market identity
  (`autoquant/market_data_identity.py`) and `aq handoff` reports it.
- `<symbol>.csv`: date-first OHLCV, unchanged values.
- `raw/<symbol>.alice-bars.json`: the exact OpenAlice export bytes.
- `openalice-provenance.json`: `source.system = openalice`, caller facts,
  per-asset raw/CSV hashes, OpenAlice `meta` (provider, capability, quality,
  freshness) and limitations.

## Then

Inspect `openalice-provenance.json`, especially `meta.quality.excludedRows`
(rows OpenAlice already dropped for invalid OHLC are absent, never filled)
and `freshness.delay`. Set the Research Request `source.system` to
`openalice`. Run `$package-autoquant-ohlcv` audit and strict
`aq project intake` before treating the bars as Project authority.
