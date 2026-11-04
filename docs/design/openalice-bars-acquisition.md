# OpenAlice bars acquisition

Status: implemented as the `acquire-openalice-bars` Workspace Skill.

Related: [[docs/design/agent-native-market-data-acquisition]],
[[docs/design/research-intake-and-dataset-snapshots]],
[[docs/design/research-handoff]], [[docs/design/openalice-hosting]].

## Why

Hosted in OpenAlice, the delegating coworker already has market data through
OpenAlice's BarService (`alice market bars`, the Market chart and the
`getMarketBars` tool). Re-downloading the same series through a `fetch-*`
Skill duplicates work and loses the identity OpenAlice uses: the `barId`
`{sourceId}|{nativeSymbol}`, which names a *source* as well as an instrument.

## Contract

`autoquant/workspace_skills/acquire-openalice-bars/` has the same shape as the
`fetch-*-ohlcv` Skills (SKILL.md, `agents/openai.yaml`, reference, one
script). Its script reads one `alice market bars --output` file per asset
(caller-provided, or exported through the `alice` CLI when it is on PATH) and
writes a staging package:

- V1 (aligned) or V4 (observed-only) `dataset-package.json` with
  `provider.name = openalice` and `provider.sourceUri =
  openalice-bars:v1?interval&timezone&adjustment&bar.<symbol>=<barId>`;
- unchanged date-first CSVs, the raw export bytes, and
  `openalice-provenance.json` (`source.system = openalice`, caller facts,
  hashes, OpenAlice quality/freshness metadata).

OpenAlice bar metadata carries no adjustment or exchange calendar, and its
daily bars are civil dates. Adjustment, timezone, calendar, panel policy and
terms are therefore caller-owned: missing ones refuse with
`openalice.caller-fact-missing`. The script also refuses a barId or interval
mismatch, truncated windows, invalid or null values, and misaligned dates; it
never fills or repairs. Intraday is refused because OpenAlice intraday
timestamps are provider bar labels, not verified close instants.

## Identity

Strict intake copies the provider claim into the content-locked snapshot, so
the barIds, interval, timezone and adjustment are part of the market identity
(`autoquant/market_data_identity.py`); `run_instruments` reads them back for
`aq handoff`. `encode_openalice_source_uri` and the Skill's encoder are the
same function (tested).

## Honest boundary

The `alice` CLI was not runnable where this Skill was built. The script is
implemented against OpenAlice's documented `BarsResult` format
(`src/domain/market-data/bars/types.ts`, `src/tool/market-bars.ts`,
`default/skills/market-data/SKILL.md`) and tested with a recorded synthetic
fixture (`tests/fixtures/openalice-bars/`); `--fetch-start/--fetch-end` is
unexercised against a live OpenAlice.
