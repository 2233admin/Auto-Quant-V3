# Reference absorption inventory

Status: proposed (inventory only; nothing in it is implemented except the
rows marked done).

Related: [[plans/shinka-research-methods-and-frontend-merge]],
[[docs/design/event-study-honesty-envelope]],
[[docs/design/ohlcv-price-event-study]],
[[docs/design/selection-adjusted-research-evidence]],
[[docs/design/research-selection-integrity]],
[[docs/design/agent-cli-contract]],
[[docs/design/studio-observation-surface]], and [[docs/ARCHITECTURE]].

## Scope

This document owns the feature-by-feature account of what AutoQuant takes
from the two reference projects the owner named, and what it does not:

- LuxAlgo `edge-stats` (MIT): a conditional-probability engine over session
  statistics, `P(outcome | conditions)`, with sample sizes and intervals.
- LuxAlgo `prop-firm-sim` (MIT, forked as `2233admin/prop-firm-sim`): a
  seeded Monte Carlo of rule-bound account journeys, with trade import.
- Skims only: `LuxAlgo/Vela` (charts), `LuxAlgo/PineTS` (Pine runtime) and
  `LuxAlgo/trade-journal` (journal analytics), noted where worth borrowing.

Rules for every row: methods are ported to independent Python; no TypeScript
is copied; product text says "method referenced from", never a LuxAlgo or
Edge Stats product name or logo (their `TRADEMARKS.md`). `edge-stats` calendar
and event data are CC BY 4.0 and need the attribution line "Calendar data
from Edge Stats by LuxAlgo (github.com/LuxAlgo/edge-stats)" if ever vendored.
PineTS is AGPL-3.0 and is never embedded in AutoQuant.

The default decision is absorb. A skip names a concrete reason.

## How to read the tables

Columns: id, source file in the reference project, feature, what it does,
AutoQuant equivalent today (file or function, or `none`), decision, reason,
target slice, required data, and the Studio surface that will show it.

Decisions:

- `absorb now`: ships before `v0.10.0`, or is already done.
- `absorb later`: planned for `0.10.x` after a named prerequisite exists.
- `adapt`: take the intent, change the mechanism to fit AutoQuant.
- `skip`: not taken, with the reason in the row.

Slices (A to E come from [[plans/shinka-research-methods-and-frontend-merge]];
the rest are new here):

| Slice | Meaning |
| --- | --- |
| A | Event Study honesty envelope (done) |
| B | Factor and Portfolio noise frontier, ledger, bootstrap intervals, under-water charts |
| C | Hypothesis object and PBO (from the Shinka side, no reference rows) |
| D | Remaining lanes redrawn; Dataset panel; shared components |
| E | Workspace library (from the Shinka side, no reference rows) |
| F | Session Statistics lab on daily-derivable fields, with the preset catalog |
| F-dsl | Query DSL as sugar that compiles to the JSON query contract |
| F-intraday | Intraday session statistics (opening range, initial balance, minutes-to-event) |
| F-events | Versioned macro event calendars and event conditions |
| F-futures | Futures package: contract column, roll days, CME calendar |
| F-later | MCP-style access to F-later features, after their prerequisite |
| G | Rule-survival Monte Carlo over a caller-owned rule set |
| G-econ | Fees, payouts and funded-stage economics on top of G |
| H | Reported trade-log intake, trade tags, news filter, overlap audit |
| I | Market-data provider Skills |
| J | Watch: on-demand live evaluation of a stored query |
| K | Charting engine decision (Vela) for session and path charts |

Required-data shorthand: `daily OHLC` means a verified daily dataset with
`priceAdjustment` of `raw` or `split-adjusted` (gap and prior-level fields
return NULL for dividend-adjusted or provider-adjusted series);
`intraday bars` means a V3 or V5 package with base interval from `1m` to `1h`
(XNYS regular session or continuous UTC); every minute-valued result is
quantized to the base interval and says so.

## Totals

Rows: 308. One row per registry field, predicate, outcome, preset, statistic,
pipeline stage, adapter, page, component, CLI command, MCP tool, engine mode,
rule switch, result field, analysis and importer.

| Source | absorb now | absorb later | adapt | skip | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| edge-stats | 120 | 76 | 20 | 8 | 224 |
| prop-firm-sim | 10 | 45 | 6 | 4 | 65 |
| Vela, PineTS, trade-journal | 1 | 6 | 2 | 10 | 19 |
| all | 131 | 127 | 28 | 22 | 308 |

The F rows are the largest single item (a new Session Statistics lab with a
registry, derivation module, catalog and Studio pages). Counting them as
`absorb now` is a proposal: the owner may move the whole F lab to `0.10.x`
without changing any row's reason.

By target slice:

| Slice | absorb now | absorb later | adapt | skip | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 8 | 0 | 0 | 0 | 8 |
| B | 7 | 0 | 0 | 0 | 7 |
| D | 3 | 1 | 3 | 0 | 7 |
| F | 103 | 4 | 15 | 0 | 122 |
| F-dsl | 0 | 3 | 0 | 0 | 3 |
| F-intraday | 2 | 33 | 1 | 0 | 36 |
| F-events | 0 | 11 | 0 | 0 | 11 |
| F-futures | 0 | 2 | 0 | 1 | 3 |
| F-later | 0 | 4 | 0 | 0 | 4 |
| G | 3 | 25 | 6 | 1 | 35 |
| G-econ | 0 | 4 | 0 | 0 | 4 |
| H | 1 | 22 | 0 | 0 | 23 |
| I | 4 | 7 | 3 | 0 | 14 |
| J | 0 | 8 | 0 | 0 | 8 |
| K | 0 | 3 | 0 | 0 | 3 |
| n/a | 0 | 0 | 0 | 20 | 20 |

## What the data limits decide

Of the 47 registry fields, 39 derive from daily OHLC, volume or the calendar
authority and are `absorb now`; 7 need intraday bars; `rollDay` needs a
futures contract column that AutoQuant intake does not carry. Of the 42
presets, 26 run on daily bars, 10 need intraday bars and 6 need event dates.
The existing Price Event Study is one fixed opening-gap event on daily
close-to-close sessions ([[docs/design/ohlcv-price-event-study]]); the new
Session Statistics lab is the home for the rest, so the registry is the
first thing to design, not the dashboard.

Intraday bases are supported by intake (V3 XNYS regular session through `1h`,
continuous UTC, V5 observed bases from `1m`), but no Study template consumes
them for session statistics yet. Opening-range windows must be multiples of
the base interval; `gapFillMinutes` at `1h` resolution is not the same
quantity as at `1m` and must be labelled.

## Conflicts with AutoQuant principles

1. **Many queries are many trials.** `edge-stats` shows each query alone
   with a raw interval; a 42-preset catalog invites picking the best card.
   AutoQuant counts every distinct query contract run on a dataset as a trial
   in the research family and shows a Bonferroni-adjusted interval beside the
   raw one ([[docs/design/selection-adjusted-research-evidence]]).
2. **Immutable Runs, not ad hoc queries.** `edge-stats` answers a live
   query against a mutable store. Here a query is a hashed contract and its
   answer is an immutable Run with strict re-derivation; the DSL is only a
   front end.
3. **Validation-only selection.** Descriptive statistics must be computed
   on the selection split declared by the Study. The frozen holdout opens
   once through the existing holdout flow; a query catalog must never become
   a route that shows test numbers during selection
   ([[docs/design/research-selection-integrity]]).
4. **No orders, no credentials, no network in Core.** Broker pulls, webhook
   or chat sinks, the live prop-firm directory fetch and browser-side market
   fetches are skipped for that reason; notification transport belongs to the
   host layer.
5. **Outcome-only fields must not be conditions.** `nextRangePct` and
   `nextRangeVsAtr` describe the next session; the registry rejects them as
   conditions and each field declares whether it is known at the open, at the
   close, or only afterwards.
6. **Adjusted prices break gap statistics.** Gap and prior-level fields
   compare an open with a prior close, so they need `priceAdjustment` of
   `raw` or `split-adjusted`; dividend-adjusted and provider-adjusted series
   yield NULL, never a silent approximation.
7. **Deterministic RNG must be frozen.** numpy `Generator` streams are not
   guaranteed stable across versions. Use the legacy MT19937 `RandomState` or
   an in-house PRNG, and record algorithm and seed in the Run.
8. **Caller-asserted inputs are not evidence.** A parametric win-rate
   trader and a fee table are hypotheticals; they are labelled so and never
   enter research-family trial counts or selection.
9. **Composite scores are gates.** A single Edge Score would be a new verdict;
   Work Briefs state they are not gates, so it is skipped pending an owner
   decision.
10. **Studio stays read-only.** Watches, imports and holdout opening stay on
    the CLI; Studio only draws verified Runs.

## Proposed AutoQuant-native shapes

These are minimum shapes to design against, not implementations.

### 1. Query and preset catalog for session statistics

One strict JSON contract, `autoquant-session-statistics-query` (schema 1),
with a content-derived id:

```json
{
  "kind": "autoquant-session-statistics-query",
  "registryVersion": "1",
  "outcome": {"name": "gapFill", "args": {}},
  "where": {"all": [{"field": "gapDir", "op": "=", "value": "down"}]},
  "groupBy": null,
  "presetId": "gap-fill-by-direction",
  "presetParams": {}
}
```

- The catalog is a directory of versioned preset files (outcome, base
  conditions, parameter specs with fragment templates, prose definition),
  validated against the registry and hashed; docs and the Studio catalog are
  generated from the same registry so they cannot drift.
- A Study freezes dataset snapshot hash, selection split, registry hash,
  derivation version and the list of query contracts. Adding a query is a new
  Study identity, therefore a counted trial.
- A Run executes the Study and writes the envelope (slice A shape), the
  matching-session ledger and the family trial count. The CLI form is
  `aq stats run`, `aq stats report <preset>`, `aq stats presets`,
  `aq stats fields`, all with `--json`; the DSL (`gapFill WHERE gapDir = down`)
  is sugar that compiles to the contract and echoes it back.
- Every field and predicate declares `knownAt` (open, close, after),
  `requires` (daily, intraday, volume, calendar, events, contract) and a unit;
  the validator rejects unit mismatches with a did-you-mean hint.

### 2. Session feature derivation

A new module derives one row per symbol and session from a verified dataset
snapshot (daily frame, or intraday base bars plus the calendar authority):

- Output is a pandas frame with a schema version; schema version and
  derivation version are hashed into the Run.
- Stage order mirrors the reference: per-session aggregates, intraday scans
  (later), cross-session state (prior levels, gap, streaks, ATR(14), patterns,
  FVG from prior sessions only), then parameterized scans.
- A session is `complete` only when bars cover its window; incomplete sessions
  leave every historical count and are listed, never averaged over holes.
- Early closes come from the exchange-calendars authority already pinned in
  `uv.lock`; no vendored holiday files.
- Volume fields return NULL when the dataset declares `unavailable-zero`.

### 3. Macro event calendars as versioned data

One JSON file per event family under a data directory, schema: `event`,
`version`, `sources` (primary URLs), `coverage` (from, to), `dates`, `notes`.
The dataset panel shows the version and horizon and flags a stale horizon.
`eventDay`, `dayBeforeEvent` and `dayAfterEvent` use the trading calendar, not
date arithmetic. OPEX is computed from the calendar (third Friday, holiday
rule). FOMC, CPI and NFP dates are authored from primary sources; if
`edge-stats` files are vendored instead, `THIRD_PARTY_NOTICES` carries the
CC BY 4.0 attribution line above. The hash of the event files is part of the
Study identity.

### 4. Monte Carlo and block bootstrap module

A pure function over a numeric series: `(series, blockMeanLength, paths, seed,
algorithm) -> bootstrap samples`, using a stationary (geometric-block)
bootstrap, with one derived seed per path and a frozen generator (conflict 7).
Slice B uses it for intervals on Portfolio validation Sharpe, annual return
and max drawdown, plus longest time under water. The contract states paths,
seed, block length and algorithm; they are bounded and hashed. Output is
descriptive uncertainty, never a selection input.

### 5. Rule-survival simulator, sizing and sensitivity

A caller-owned rule set (`autoquant-rule-set`: max-loss mode with lock and
offset, daily-loss switches, consistency rule, steps, optional fees and
payout rules, `flagsNotSimulated`, `sources`, `asOf`) is applied to resampled
paths of a verified return series. Output: per-step and joint pass
probability with Wilson intervals, fail reasons, stagnation, drawdown
percentiles; the economics layer (G-econ) adds cost, payouts and EV. The
assumptions list is a required Run field. Risk sweeps and sensitivity are
grids in the contract. The live firm directory is not fetched; a rule set is
supplied inline, and prose-derived rules follow the three-tier honesty
policy (verbatim, inferred and disclosed, ambiguous and refused).

### 6. Trade-log import

`aq trades import` reads statement files only (no broker keys, no network):
normalizes to canonical trades with structured diagnostics, detects the
format, and reconstructs round trips with signed FIFO. R is trusted in a
strict ladder (explicit, calculated from the file, inferred from a stated
risk spec, unavailable); partial R coverage is refused. Output is an
immutable trade-log package with a content hash, consumable by Book Risk,
trade tags, the news filter, the overlap audit and the survival simulator.
Importers are written against synthetic fixtures and refuse formats they
cannot verify.

## Inventory


### edge-stats registry: fields

Sources: `packages/core/src/registry/fields.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-F01 | core/src/registry/fields.ts | dayOfWeek (Day of week) | Weekday of the session's trade date (Mon–Sun). The classic seasonality cut: any query can be grouped or filtered by it. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F02 | core/src/registry/fields.ts | month (Month) | Calendar month of the trade date (1–12), for monthly seasonality cuts. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F03 | core/src/registry/fields.ts | year (Year) | Calendar year of the trade date. Grouping by year is the manual stability check. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F04 | core/src/registry/fields.ts | rangePct (Session range %) | Session high-to-low range as a percent of the session's open. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F05 | core/src/registry/fields.ts | retOcPct (Open→close return %) | Session return from open to close, in percent (signed). | partial: positive-return rate in autoquant/event_explorer.py (event windows only) | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F06 | core/src/registry/fields.ts | green (Green session) | True when the session closed above its open. | partial: positive-return rate in autoquant/event_explorer.py (event windows only) | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F07 | core/src/registry/fields.ts | gapPct (Gap %) | Opening gap versus the prior session's close, in percent (signed; positive = gapped up). NULL on roll days: a gap across a futures roll is a roll, not a gap. | partial: opening-gap event with one caller threshold in autoquant/event_studies.py | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. Gap is open versus the raw prior close; the dataset adjustment claim must allow that (see conflicts). | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F08 | core/src/registry/fields.ts | absGapPct (Absolute gap %) | Absolute size of the opening gap in percent, direction ignored. | partial: opening-gap event with one caller threshold in autoquant/event_studies.py | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. Gap is open versus the raw prior close; the dataset adjustment claim must allow that (see conflicts). | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F09 | core/src/registry/fields.ts | gapDir (Gap direction) | Direction of the opening gap: 'up', 'down', or 'none'. | partial: opening-gap event with one caller threshold in autoquant/event_studies.py | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. Gap is open versus the raw prior close; the dataset adjustment claim must allow that (see conflicts). | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F10 | core/src/registry/fields.ts | gapBucket (Gap size bucket) | Gap size bucketed for grouping: xs (<0.15%), s (0.15–0.3%), m (0.3–0.75%), l (0.75–1.5%), xl (≥1.5%). | partial: opening-gap event with one caller threshold in autoquant/event_studies.py | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. Gap is open versus the raw prior close; the dataset adjustment claim must allow that (see conflicts). | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F11 | core/src/registry/fields.ts | gapFilled (Gap filled) | True when the session traded back to the prior session's close after gapping (the conventional fill). | partial: opening-gap event with one caller threshold in autoquant/event_studies.py | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. Gap is open versus the raw prior close; the dataset adjustment claim must allow that (see conflicts). | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F12 | core/src/registry/fields.ts | gapFillMinutes (Minutes to gap fill) | Minutes from the session open to the gap fill (NULL when unfilled). | none | absorb later | Needs intraday bars; results are quantized to the base bar interval and must say so. Needs an intraday session-statistics intake path first. | F-intraday | intraday bars (V3 XNYS or continuous base 1m to 1h) | Session Statistics: filter chip and group-by option |
| ES-F13 | core/src/registry/fields.ts | openPosInPrevRange (Open position in prior range) | Where the open printed inside the prior session's range: 0 = at prior low, 1 = at prior high; outside [0,1] = opened beyond the range. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F14 | core/src/registry/fields.ts | openAbovePrevHigh (Opened above prior high) | True when the session opened above the prior session's high. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F15 | core/src/registry/fields.ts | openBelowPrevLow (Opened below prior low) | True when the session opened below the prior session's low. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F16 | core/src/registry/fields.ts | touchedPrevHigh (Touched prior high) | True when the session traded at or above the prior session's high at any point. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F17 | core/src/registry/fields.ts | touchedPrevLow (Touched prior low) | True when the session traded at or below the prior session's low at any point. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F18 | core/src/registry/fields.ts | touchPrevHighMinutes (Minutes to prior high touch) | Minutes from the open to the first touch of the prior high (NULL when untouched). | none | absorb later | Needs intraday bars; results are quantized to the base bar interval and must say so. Needs an intraday session-statistics intake path first. | F-intraday | intraday bars (V3 XNYS or continuous base 1m to 1h) | Session Statistics: filter chip and group-by option |
| ES-F19 | core/src/registry/fields.ts | touchPrevLowMinutes (Minutes to prior low touch) | Minutes from the open to the first touch of the prior low (NULL when untouched). | none | absorb later | Needs intraday bars; results are quantized to the base bar interval and must say so. Needs an intraday session-statistics intake path first. | F-intraday | intraday bars (V3 XNYS or continuous base 1m to 1h) | Session Statistics: filter chip and group-by option |
| ES-F20 | core/src/registry/fields.ts | closedAbovePrevHigh (Closed above prior high) | True when the session closed above the prior session's high. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F21 | core/src/registry/fields.ts | closedBelowPrevLow (Closed below prior low) | True when the session closed below the prior session's low. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F22 | core/src/registry/fields.ts | insideDay (Inside session) | True when the session's whole range sat inside the prior session's range. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F23 | core/src/registry/fields.ts | outsideDay (Outside session) | True when the session traded beyond both the prior session's high and low. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F24 | core/src/registry/fields.ts | nr4 (NR4) | True when the session had the narrowest range of the last 4 sessions. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F25 | core/src/registry/fields.ts | nr7 (NR7) | True when the session had the narrowest range of the last 7 sessions. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F26 | core/src/registry/fields.ts | bullEngulfing (Bullish engulfing session) | True when the session's body engulfed a prior red session's body (session-level candle). | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F27 | core/src/registry/fields.ts | bearEngulfing (Bearish engulfing session) | True when the session's body engulfed a prior green session's body (session-level candle). | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F28 | core/src/registry/fields.ts | doji (Doji session) | True when the session closed within 10% of its range from its open (session-level candle). | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F29 | core/src/registry/fields.ts | highTimeMinutes (Minutes to session high) | Minutes from the open to the first print of the session high. | none | absorb later | Needs intraday bars; results are quantized to the base bar interval and must say so. Needs an intraday session-statistics intake path first. | F-intraday | intraday bars (V3 XNYS or continuous base 1m to 1h) | Session Statistics: filter chip and group-by option |
| ES-F30 | core/src/registry/fields.ts | lowTimeMinutes (Minutes to session low) | Minutes from the open to the first print of the session low. | none | absorb later | Needs intraday bars; results are quantized to the base bar interval and must say so. Needs an intraday session-statistics intake path first. | F-intraday | intraday bars (V3 XNYS or continuous base 1m to 1h) | Session Statistics: filter chip and group-by option |
| ES-F31 | core/src/registry/fields.ts | highBeforeLow (High before low) | True when the session printed its high before its low. | none | absorb later | Needs intraday bars; results are quantized to the base bar interval and must say so. Needs an intraday session-statistics intake path first. | F-intraday | intraday bars (V3 XNYS or continuous base 1m to 1h) | Session Statistics: filter chip and group-by option |
| ES-F32 | core/src/registry/fields.ts | atrPct (ATR(14) %) | Prior 14-session average true range as a percent of the prior close: the session's volatility context, known before the open. | none | absorb now | Prior 14-session ATR is known before the open; derive from daily OHLC with a documented true-range rule. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F33 | core/src/registry/fields.ts | rangeVsAtr (Range vs ATR) | Session range divided by the prior ATR(14): how big the session was against its own recent volatility. | none | absorb now | Prior 14-session ATR is known before the open; derive from daily OHLC with a documented true-range rule. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F34 | core/src/registry/fields.ts | volumeVsAvg20 (Volume vs 20-session average) | Session volume divided by the prior 20-session average volume. | none | absorb now | Needs a volume column; datasets with zero or missing volume return NULL, never zero-filled. | F | daily OHLC + volume | Session Statistics: filter chip and group-by option |
| ES-F35 | core/src/registry/fields.ts | prevGreenStreak (Prior green streak) | How many consecutive green sessions ended immediately before this one (0 when the prior session was red). | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F36 | core/src/registry/fields.ts | prevRedStreak (Prior red streak) | How many consecutive red sessions ended immediately before this one. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F37 | core/src/registry/fields.ts | prevDayGreen (Prior session green) | True when the prior session closed green. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F38 | core/src/registry/fields.ts | prevInsideDay (Prior session was inside) | True when the PRIOR session's range sat inside the range before it: conditioning today on yesterday's compression, known at the open. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F39 | core/src/registry/fields.ts | prevNr7 (Prior session was NR7) | True when the PRIOR session had the narrowest range of its trailing 7: the classic day-after-compression setup, known at the open. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F40 | core/src/registry/fields.ts | prevDoji (Prior session was a doji) | True when the PRIOR session closed within 10% of its range from its open, known at the open. | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F41 | core/src/registry/fields.ts | nextRangePct (Next session range %) | The NEXT session's high-to-low range as a percent of its open. As an outcome via hit(), this is the day-after expansion question: hit(nextRangePct, gte, x) WHERE nr7. | none | absorb now | Uses the NEXT session, so it is outcome-only: the registry must refuse it as a condition to keep conditions causal (edge-stats allows it as a field). | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F42 | core/src/registry/fields.ts | nextRangeVsAtr (Next session range vs ATR) | The NEXT session's range divided by ITS prior ATR(14): day-after expansion in volatility-adjusted units. | none | absorb now | Uses the NEXT session, so it is outcome-only: the registry must refuse it as a condition to keep conditions causal (edge-stats allows it as a field). | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F43 | core/src/registry/fields.ts | rollDay (Futures roll day) | True when the continuous futures series changed front contract on this session. Gap features are NULL on roll days; exclude or isolate them explicitly with this field. | none | absorb later | AQV2 intake has no futures contract column or continuous-futures package yet; absorb with a futures package. Keep the rule: no back-adjustment, gap and prior-level fields NULL on roll days. | F-futures | bars with a contract column | Session Statistics: filter chip and group-by option |
| ES-F44 | core/src/registry/fields.ts | halfDay (Half day) | True when the exchange closed early on this session (holiday-adjacent schedules). | none | absorb now | The version-locked exchange-calendars authority already publishes early closes; derive instead of vendoring holiday files. NULL when the authority has no early-close data. | F | calendar authority (early closes) | Session Statistics: filter chip and group-by option |
| ES-F45 | core/src/registry/fields.ts | fvgAbove (Unfilled FVG above) | True when an unfilled session-level fair value gap sat entirely above the open at session start (formed on prior sessions: no lookahead). | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F46 | core/src/registry/fields.ts | fvgBelow (Unfilled FVG below) | True when an unfilled session-level fair value gap sat entirely below the open at session start (formed on prior sessions: no lookahead). | none | absorb now | Derivable exactly from daily OHLC, causal at the session open or close as the definition says. | F | daily OHLC | Session Statistics: filter chip and group-by option |
| ES-F47 | core/src/registry/fields.ts | ibBreakType (Initial-balance break type) | How the session resolved its initial balance: 'none', 'single_up', 'single_down', or 'double' (both sides broken). | none | absorb later | Needs intraday bars; results are quantized to the base bar interval and must say so. Needs an intraday session-statistics intake path first. | F-intraday | intraday bars (V3 XNYS or continuous base 1m to 1h) | Session Statistics: filter chip and group-by option |

### edge-stats registry: predicates

Sources: `packages/core/src/registry/predicates.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-P01 | core/src/registry/predicates.ts | gapUp (Gapped up) | The session opened above the prior session's close. | none | absorb now | Boolean over daily-derived fields. | F | daily OHLC | Session Statistics: condition chip |
| ES-P02 | core/src/registry/predicates.ts | gapDown (Gapped down) | The session opened below the prior session's close. | none | absorb now | Boolean over daily-derived fields. | F | daily OHLC | Session Statistics: condition chip |
| ES-P03 | core/src/registry/predicates.ts | noGap (No gap) | The session opened exactly at the prior session's close (or gap data is unavailable). | none | absorb now | Boolean over daily-derived fields. | F | daily OHLC | Session Statistics: condition chip |
| ES-P04 | core/src/registry/predicates.ts | orbBroke (Opening range broke) | The session broke its opening range (first n minutes) in the given direction after the range formed. | none | absorb later | Opening-range or initial-balance state needs intraday bars; window arguments must be multiples of the base bar interval. | F-intraday | intraday bars, window a multiple of the base interval | Session Statistics: condition chip |
| ES-P05 | core/src/registry/predicates.ts | orbFalseBroke (Opening range false break (condition)) | The first opening-range break failed: price closed back inside the range (or beyond the opposite side). Condition form of the orbFalseBreak outcome. | none | absorb later | Opening-range or initial-balance state needs intraday bars; window arguments must be multiples of the base bar interval. | F-intraday | intraday bars, window a multiple of the base interval | Session Statistics: condition chip |
| ES-P06 | core/src/registry/predicates.ts | orbBrokeBoth (Opening range broke both sides) | The session traded beyond both extremes of its opening range. | none | absorb later | Opening-range or initial-balance state needs intraday bars; window arguments must be multiples of the base bar interval. | F-intraday | intraday bars, window a multiple of the base interval | Session Statistics: condition chip |
| ES-P07 | core/src/registry/predicates.ts | ibSingleBreak (Initial balance single break) | The session broke exactly one side of its initial balance. | none | absorb later | Opening-range or initial-balance state needs intraday bars; window arguments must be multiples of the base bar interval. | F-intraday | intraday bars, window a multiple of the base interval | Session Statistics: condition chip |
| ES-P08 | core/src/registry/predicates.ts | ibDoubleBreak (Initial balance double break) | The session broke both sides of its initial balance. | none | absorb later | Opening-range or initial-balance state needs intraday bars; window arguments must be multiples of the base bar interval. | F-intraday | intraday bars, window a multiple of the base interval | Session Statistics: condition chip |
| ES-P09 | core/src/registry/predicates.ts | ibNoBreak (Initial balance held) | The session never traded beyond its initial balance. | none | absorb later | Opening-range or initial-balance state needs intraday bars; window arguments must be multiples of the base bar interval. | F-intraday | intraday bars, window a multiple of the base interval | Session Statistics: condition chip |
| ES-P10 | core/src/registry/predicates.ts | eventDay (Macro event day) | The trade date is in the events calendar under the given name (e.g. 'FOMC', 'CPI', 'NFP', 'OPEX'). Event dates ship as versioned data files with cited sources. | none | absorb later | Needs a versioned event calendar (FOMC, CPI, NFP, OPEX) with cited sources; day-before and day-after use the trading calendar, not calendar-day arithmetic. CC BY 4.0 attribution if edge-stats dates are vendored. | F-events | versioned macro event dates + trading calendar | Session Statistics: condition chip |
| ES-P11 | core/src/registry/predicates.ts | dayBeforeEvent (Trading day before event) | The NEXT trading session for this symbol is an event day: trading-calendar aware, not calendar-day arithmetic. | none | absorb later | Needs a versioned event calendar (FOMC, CPI, NFP, OPEX) with cited sources; day-before and day-after use the trading calendar, not calendar-day arithmetic. CC BY 4.0 attribution if edge-stats dates are vendored. | F-events | versioned macro event dates + trading calendar | Session Statistics: condition chip |
| ES-P12 | core/src/registry/predicates.ts | dayAfterEvent (Trading day after event) | The PREVIOUS trading session for this symbol was an event day. | none | absorb later | Needs a versioned event calendar (FOMC, CPI, NFP, OPEX) with cited sources; day-before and day-after use the trading calendar, not calendar-day arithmetic. CC BY 4.0 attribution if edge-stats dates are vendored. | F-events | versioned macro event dates + trading calendar | Session Statistics: condition chip |
| ES-P13 | core/src/registry/predicates.ts | streak (Consecutive-session streak) | At least n consecutive sessions of the given color ended immediately before this session. | none | absorb now | Boolean over daily-derived fields. | F | daily OHLC | Session Statistics: condition chip |
| ES-P14 | core/src/registry/predicates.ts | fvgPresent (Unfilled fair value gap present) | An unfilled session-level FVG sat entirely on the given side of the open at session start. Zones form on prior sessions only: no lookahead. | none | absorb now | Session-level fair value gap from three prior daily sessions only (no lookahead); a fixed documented definition. | F | daily OHLC | Session Statistics: condition chip |

### edge-stats registry: outcomes

Sources: `packages/core/src/registry/outcomes.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-O01 | core/src/registry/outcomes.ts | gapFill (Gap fill) | Of the sessions that opened with a gap, how often price traded back to the prior session's close. Roll days are excluded by construction: a gap across a futures roll is a roll, not a gap. | none | absorb now | Binary fill rate from daily high and low; the minutes-to-fill distribution is intraday only (see the gapFillMinutes field row). | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O02 | core/src/registry/outcomes.ts | gapHold (Gap holds (gap-and-go)) | Of the sessions that opened with a gap, how often the gap NEVER filled and the session closed beyond its open in the gap's direction: the gap-and-go continuation, measured directly instead of as the complement of the fill rate. | none | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O03 | core/src/registry/outcomes.ts | gapReversal (Reversal after gap fill) | Of the sessions that filled their opening gap, how often the session then closed beyond the prior close against the gap's direction (fill-and-reverse). | none | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O04 | core/src/registry/outcomes.ts | closeGreen (Session closes green) | How often the session closed above its open, under whatever conditions you compose. | partial: positive-return rate in autoquant/event_explorer.py | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O05 | core/src/registry/outcomes.ts | nextCloseGreen (Next session closes green) | How often the NEXT session closed green given today's conditions: the day-after family of questions as one outcome. | none | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O06 | core/src/registry/outcomes.ts | orbBreak (Opening range break) | Of the sessions with a formed opening range, how often the range broke in the given direction. | none | absorb later | Needs intraday bars; same envelope as every other rate. | F-intraday | intraday bars | Session Statistics: result card with Wilson envelope |
| ES-O07 | core/src/registry/outcomes.ts | orbFalseBreak (Opening range false break) | Of the sessions whose opening range first broke in the given direction, how often that break failed (closed back inside the range or beyond the opposite side). | none | absorb later | Needs intraday bars; same envelope as every other rate. | F-intraday | intraday bars | Session Statistics: result card with Wilson envelope |
| ES-O08 | core/src/registry/outcomes.ts | orbTargetHit (Opening range extension target hit) | Of the sessions whose opening range first broke in the given direction, how often price extended at least r × the range beyond the broken side. Run a ladder of r values for target hit-rates. | none | absorb later | Needs intraday bars; same envelope as every other rate. | F-intraday | intraday bars | Session Statistics: result card with Wilson envelope |
| ES-O09 | core/src/registry/outcomes.ts | ibExtension (Initial balance extension) | Of the sessions that broke their initial balance in the given direction, how often price extended at least r × the IB range beyond the broken side. | none | absorb later | Needs intraday bars; same envelope as every other rate. | F-intraday | intraday bars | Session Statistics: result card with Wilson envelope |
| ES-O10 | core/src/registry/outcomes.ts | touchPrevHigh (Touches prior high) | How often the session traded at or above the prior session's high. | none | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O11 | core/src/registry/outcomes.ts | touchPrevLow (Touches prior low) | How often the session traded at or below the prior session's low. | none | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O12 | core/src/registry/outcomes.ts | breakHoldPrevHigh (Breaks and holds prior high) | Of the sessions that touched the prior high, how often they also closed above it. | none | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O13 | core/src/registry/outcomes.ts | breakHoldPrevLow (Breaks and holds prior low) | Of the sessions that touched the prior low, how often they also closed below it. | none | absorb now | Binary rate with eligibility (denominator) and success (numerator) both stated; uses the slice A envelope. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O14 | core/src/registry/outcomes.ts | timeOfHighBefore (Session high prints early) | How often the session high printed within the first m minutes. The value distribution is the full time-of-high profile. | none | absorb later | Needs intraday bars; same envelope as every other rate. | F-intraday | intraday bars | Session Statistics: result card with Wilson envelope |
| ES-O15 | core/src/registry/outcomes.ts | timeOfLowBefore (Session low prints early) | How often the session low printed within the first m minutes. The value distribution is the full time-of-low profile. | none | absorb later | Needs intraday bars; same envelope as every other rate. | F-intraday | intraday bars | Session Statistics: result card with Wilson envelope |
| ES-O16 | core/src/registry/outcomes.ts | hit (Threshold hit (generic)) | The escape hatch: P(field ⋈ value) for any numeric field in the registry. Composable with any conditions: if the stat you want is not a named outcome, it is probably one hit() away. | none | absorb now | The generic threshold outcome; keep, but restrict to registry fields that are causal for the chosen outcome clock. | F | daily OHLC | Session Statistics: result card with Wilson envelope |
| ES-O17 | core/src/registry/outcomes.ts | eventOccurs (Event occurs on the session) | How often the session's trade date appears in the named events calendar. Every session is eligible, so this is the event's frequency under your conditions. Built for trade tags (TRADED, TRADED_WIN, TRADED_LOSS from `edgestats trades import` | none | absorb later | Frequency of an event under conditions; trade tags need the reported trade-log intake (slice H). | F-events | event calendar or trade tags | Session Statistics: result card with Wilson envelope |

### edge-stats preset catalog (42 presets)

Sources: `presets/*.json`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-C01 | presets/gap-and-go.json | gap-and-go (gaps) | Of gapped sessions, the gap never filled and the session closed beyond its open in the gap direction. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C02 | presets/gap-fill-by-direction.json | gap-fill-by-direction (gaps) | Gap-fill rate for up and down gaps side by side. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C03 | presets/gap-fill-by-size.json | gap-fill-by-size (gaps) | Gap-fill rate by gap-size bucket (xs to xl). | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C04 | presets/gap-fill-by-weekday.json | gap-fill-by-weekday (gaps) | Gap-fill rate by weekday. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C05 | presets/gap-fill-time.json | gap-fill-time (gaps) | Gap-fill rate plus the minutes-to-fill distribution. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C06 | presets/gap-fill.json | gap-fill (gaps) | Of sessions that opened away from the prior close, how often price traded back to it. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C07 | presets/gap-reversal.json | gap-reversal (gaps) | Of sessions that filled the gap, how often they closed beyond the prior close against the gap. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C08 | presets/orb.json | orb (opening range) | Opening range breakout rate in either or a chosen direction, plus time-to-break. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C09 | presets/orb-by-direction.json | orb-by-direction (opening range) | Of sessions with a formed range, how often the first break went the chosen way. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C10 | presets/orb-false-break.json | orb-false-break (opening range) | Of first breaks in a direction, how often the break failed. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C11 | presets/orb-target.json | orb-target (opening range) | Of first breaks, how often price extended r times the range. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C12 | presets/orb-time-to-break.json | orb-time-to-break (opening range) | Break rate read through the minutes-to-break distribution. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C13 | presets/ib-extension.json | ib-extension (initial balance) | Of sessions that broke the initial balance, how often price extended r times the IB range. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C14 | presets/initial-balance.json | initial-balance (initial balance) | Green-close rate by initial-balance resolution (none, single up, single down, double). | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C15 | presets/prev-high-break-hold.json | prev-high-break-hold (prior levels) | Of sessions that traded at or above the prior high, how often they closed above it. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C16 | presets/prev-high-touch-by-open.json | prev-high-touch-by-open (prior levels) | Prior-high touch rate by open location inside the prior range. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C17 | presets/prev-low-break-hold.json | prev-low-break-hold (prior levels) | Of sessions that traded at or below the prior low, how often they closed below it. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C18 | presets/prev-low-touch.json | prev-low-touch (prior levels) | Prior-low touch rate by open location inside the prior range. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C19 | presets/prev-range.json | prev-range (prior levels) | Touch rate of the prior high or low conditioned on open location. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C20 | presets/doji-follow-through.json | doji-follow-through (session shape) | After a session-level doji, how often the next session closed green. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C21 | presets/engulfing-bear.json | engulfing-bear (session shape) | After a bearish engulfing session, how often the next session closed green. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C22 | presets/engulfing-bull.json | engulfing-bull (session shape) | After a bullish engulfing session, how often the next session closed green. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C23 | presets/inside-day.json | inside-day (session shape) | After an inside day, how often the next session closed green. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C24 | presets/nr7-expansion.json | nr7-expansion (session shape) | Among NR7 sessions, how often the range reached r times ATR(14). | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C25 | presets/outside-day.json | outside-day (session shape) | After an outside day, how often the next session closed green. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C26 | presets/streak-continuation.json | streak-continuation (streaks) | After n or more green sessions, how often the next closed green. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C27 | presets/streak-reversion.json | streak-reversion (streaks) | After n or more red sessions, how often the next closed green. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C28 | presets/day-of-week.json | day-of-week (seasonality) | Green rate by weekday. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C29 | presets/green-rate.json | green-rate (seasonality) | Unconditional green rate: the baseline every other preset is compared to. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C30 | presets/month-of-year.json | month-of-year (seasonality) | Green rate by calendar month. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C31 | presets/day-after-event.json | day-after-event (events) | Green rate on the session after an event day. | none | absorb later | Same catalog entry, enabled when the versioned event calendar exists. | F-events | versioned macro event dates | Session Statistics: catalog card, then report page with parameters |
| ES-C32 | presets/day-before-event.json | day-before-event (events) | Green rate on the session before an event day. | none | absorb later | Same catalog entry, enabled when the versioned event calendar exists. | F-events | versioned macro event dates | Session Statistics: catalog card, then report page with parameters |
| ES-C33 | presets/event-day-cpi.json | event-day-cpi (events) | Green rate on CPI days. | none | absorb later | Same catalog entry, enabled when the versioned event calendar exists. | F-events | versioned macro event dates | Session Statistics: catalog card, then report page with parameters |
| ES-C34 | presets/event-day-fomc.json | event-day-fomc (events) | Green rate on FOMC days. | none | absorb later | Same catalog entry, enabled when the versioned event calendar exists. | F-events | versioned macro event dates | Session Statistics: catalog card, then report page with parameters |
| ES-C35 | presets/event-day-nfp.json | event-day-nfp (events) | Green rate on NFP days. | none | absorb later | Same catalog entry, enabled when the versioned event calendar exists. | F-events | versioned macro event dates | Session Statistics: catalog card, then report page with parameters |
| ES-C36 | presets/event-day-opex.json | event-day-opex (events) | Green rate on monthly options expiration days. | none | absorb later | Same catalog entry, enabled when the versioned event calendar exists. | F-events | versioned macro event dates | Session Statistics: catalog card, then report page with parameters |
| ES-C37 | presets/high-time.json | high-time (time of day) | How often the session high printed in the first m minutes, with the full time-of-high distribution. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C38 | presets/low-time.json | low-time (time of day) | How often the session low printed in the first m minutes, with the full time-of-low distribution. | none | absorb later | Same catalog entry, enabled when the intraday session-statistics path exists. | F-intraday | intraday bars | Session Statistics: catalog card, then report page with parameters |
| ES-C39 | presets/quiet-then-wild.json | quiet-then-wild (volatility) | Among NR4 sessions, how often the range reached r times ATR(14). | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C40 | presets/range-vs-atr.json | range-vs-atr (volatility) | How often the session range reached r times the prior ATR(14). | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C41 | presets/fvg-below-green.json | fvg-below-green (fair value gaps) | Green rate with an unfilled session-level FVG entirely below the open. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |
| ES-C42 | presets/fvg-magnet.json | fvg-magnet (fair value gaps) | Gap-fill rate when an unfilled FVG sat on a chosen side of the open. | none | absorb now | One declarative query file in the AQV2 catalog; computed on the Study selection split and counted as a trial in the research family. | F | daily OHLC | Session Statistics: catalog card, then report page with parameters |

### edge-stats statistics layer

Sources: `packages/core/src/stats, query/execute.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-S01 | core/src/stats/stats.ts | wilson() | Wilson score interval for a binomial proportion, 95%. | done: wilson_interval in autoquant/event_envelope.py | absorb now | Shipped in slice A; reuse for every binary rate in later slices. | A | any rate | Event Study and Session Statistics interval bar |
| ES-S02 | core/src/stats/stats.ts | applyGuards() | Warn below 30, refuse below 10 matched sessions. | done: guard_status in autoquant/event_envelope.py | absorb now | Shipped in slice A. Floors stay fixed constants unless the Study contract states them. | A | any rate | Sample badge |
| ES-S03 | core/src/stats/stats.ts | stabilitySplit() | First-half versus second-half rate; halves agree when Wilson intervals overlap. | done: stability_split in autoquant/event_envelope.py | absorb now | Shipped in slice A. | A | any rate | Stability row |
| ES-S04 | core/src/stats/stats.ts | distributionFromQuantiles() | Count, mean, min, p25, median, p75, p90, max of a continuous outcome. | done: quantile_summary in autoquant/event_envelope.py | absorb now | Shipped in slice A. | A | continuous outcome | Percentile strip |
| ES-S05 | core/src/query/execute.ts | per-year counts | Hits and N per calendar year. | done: per_year in autoquant/event_envelope.py | absorb now | Shipped in slice A. | A | dated sessions | Per-year chips |
| ES-S06 | core/src/config.ts | recencyWindow view | Last 250 sessions next to full history. | none | absorb later | Needs a fixture long enough for a recency split to mean anything; compute inside the same envelope when it does. | F | daily OHLC, 250+ sessions | Recency row on result card |
| ES-S07 | core/src/query/execute.ts | fixed disclaimer | Historical frequencies, not predictions; travels with every result. | done: notice on the Event Study page | absorb now | Shipped in slice A; make it a schema field so no surface can omit it. | A | n/a | Result footer |
| ES-S08 | core/src/query/execute.ts | byte-identical determinism | Same store and query give an identical envelope. | done: immutable Runs, hash-verified re-derivation (autoquant/runs.py) | absorb now | AQV2 is stricter (content hashes). Session Statistics results must be Runs, not ad hoc queries. | F | n/a | Run identity badge |
| ES-S09 | ARCHITECTURE.md | no code path prints a rate without N | Design rule: every rate leaves the engine as an envelope. | done for Event Study; enforce for every new rate | absorb now | Add a schema test that rejects any rate without count and interval. | A | n/a | All cards |
| ES-S10 | (none) multiple-comparison control | family-wise adjustment across many queries | edge-stats shows each query alone; the 42-preset catalog invites cherry-picking. | partial: selection-adjusted evidence in autoquant/selection.py (Factor and Portfolio only) | absorb now | AQV2 principle, not in edge-stats: every distinct query on a dataset is a trial in the research family; show family size and a Bonferroni-adjusted interval beside the raw one. | F | n/a | Trial counter and adjusted interval on every card |

### edge-stats query language and export

Sources: `packages/core/src/query`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-Q01 | core/src/query/lexer.ts | DSL lexer | Tokens with exact positions; units: percent, m, h. | none | absorb later | AQV2 Study contracts are strict JSON. Offer the DSL only as sugar that compiles to the JSON contract; JSON stays the hashed truth. | F-dsl | n/a | Query builder text box |
| ES-Q02 | core/src/query/parser.ts | DSL parser | outcome WHERE boolean expression with AND, OR, NOT, BETWEEN, IN, comparisons; AND binds tighter than OR. | none | absorb later | Same: parse to the JSON contract, then validate and hash that. | F-dsl | n/a | Query builder |
| ES-Q03 | core/src/query/ast.ts | AST | Typed expression tree for conditions. | none | absorb later | Becomes the JSON condition tree in the Study contract. | F | n/a | n/a |
| ES-Q04 | core/src/query/compile.ts | SQL compiler with unit safety | AST to DuckDB SQL; percent versus minutes mismatches rejected with hints. | none | adapt | Compile to pandas/numpy over the derived session frame (AQV2 has no DuckDB); keep unit checking and did-you-mean errors. | F | n/a | Inline validation errors |
| ES-Q05 | core/src/query/normalize.ts | normalized query echo | Result echoes the canonical query so mis-parses show. | none | absorb now | The canonical JSON contract hash is shown on every result; the DSL echo is generated from it. | F | n/a | Query echo line |
| ES-Q06 | core/src/query/execute.ts | QueryResult envelope | One envelope shared by CLI, API, dashboard, MCP. | partial: event envelope in autoquant/event_envelope.py | absorb now | One Run artifact schema; CLI JSON, snapshot and Studio read the same projection. | F | n/a | All cards |
| ES-Q07 | core/src/query/export.ts | export query matches | COPY matches to CSV or parquet. | none | adapt | Studio is read-only; offer `aq ... --json` plus CSV from the Run artifacts. Parquet only if pyarrow (optional extra) is present. | F | n/a | Copy and download links |
| ES-Q08 | core/src/query/session-bars.ts | session bars endpoint | Raw bars of one session with derived levels drawn on them. | none | absorb later | Needs intraday bars and a chart library; see the Vela row. | F-intraday | intraday bars | Session drawer chart |

### edge-stats derivation, calendars and events

Sources: `packages/core/src/features, calendar, events.ts; data/`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-D01 | core/src/features/derive.ts | S1 per-session aggregates | OHLCV and opening-range levels per session. | none | absorb now | Daily frame derivation in a new autoquant module; versioned and hashed into the Run. | F | daily OHLC | n/a |
| ES-D02 | core/src/features/derive.ts | S2 intraday scans | Break times, extensions, high and low times. | none | absorb later | Needs intraday bars. | F-intraday | intraday bars | n/a |
| ES-D03 | core/src/features/derive.ts | S3 cross-session state | Prior levels, gaps, rolls, streaks, ATR, patterns, FVG zones, next-session outcomes. | none | absorb now | The daily-derivable core of the registry; no lookahead in decision-time fields. | F | daily OHLC | n/a |
| ES-D04 | core/src/features/derive.ts | S4 parameterized scans | Gap-fill time and prior-level touches that need S3 parameters. | none | absorb later | Intraday part only; daily gap-fill and touch flags are in S3. | F-intraday | intraday bars | n/a |
| ES-D05 | core/src/features/derive.ts | complete flag | A session is complete only when bars cover its window; incomplete sessions leave every historical count. | partial: complete-bar rules in autoquant/intervals.py | absorb now | Reuse the causal completed-bar rules; never average over holes. | F | intraday or daily bars | Excluded-sessions note |
| ES-D06 | core/src/features/derive.ts | no-lookahead stance | FVG zones from prior sessions; ATR and streaks strictly before the open. | partial: causal alignment in event_studies.py | absorb now | State per field whether it is known at the open, at the close, or only afterwards, and enforce it in the registry. | F | n/a | Field tooltip: known at |
| ES-D07 | core/src/features/schema.ts | session_features table with per-window OR columns | Wide row per symbol, session, window. | none | adapt | Use a derived session frame with a versioned schema hashed into the Run, not a mutable table. | F | n/a | n/a |
| ES-D08 | core/src/calendar/sessions.ts | session windows by asset class | rth, globex, utc, ny, forex windows from wall-clock plus IANA zone. | partial: XNYS regular session and continuous UTC in autoquant/intervals.py | adapt | AQV2 supports XNYS regular-session and continuous UTC only; add other windows with the calendar authority, not hand-rolled offsets. | F-intraday | calendar authority | Dataset panel: session definition |
| ES-D09 | core/src/calendar/data.ts | DST handling | Boundaries computed through the tz database; both 2024 transitions tested. | done via exchange-calendars==4.13.2 | absorb now | Already inherited; keep the DST fixtures when intraday sessions land. | F-intraday | calendar authority | n/a |
| ES-D10 | data/holidays/*.json | versioned holiday and half-day files | NYSE and CME calendars with sources, version and coverage horizon. | partial: exchange-calendars authority pinned in uv.lock | skip | Do not vendor holiday files: exchange-calendars is already pinned and version-locked in AQV2. CME profile is the only gap; absorb with the futures package. | F-futures | calendar authority | Freshness line |
| ES-D11 | core/src/calendar/types.ts | half-day flag | Early close truncates the session and is queryable. | none | absorb now | Derive from the calendar authority early closes (see halfDay field row). | F | calendar authority | Condition chip |
| ES-D12 | docs/continuous-futures.md | continuous futures roll days | Roll days detected from the contract column; gaps and prior-level fields NULL on them; no back-adjustment. | none | absorb later | Adopt the policy verbatim when a futures package exists. | F-futures | bars with contract column | Roll-day flag |
| ES-D13 | core/src/events.ts | versioned macro event calendars | FOMC, CPI, NFP, OPEX files with version, sources, coverage, dates. | none | absorb later | Author a versioned AQV2 data file per event with sources and coverage; vendoring edge-stats dates needs the CC BY 4.0 line in THIRD_PARTY_NOTICES. OPEX is computable from the calendar (third Friday). | F-events | event dates | Dataset panel: calendar versions |
| ES-D14 | scripts/generate-catalog.ts | generated catalog page | Docs table generated from presets and registry. | none | absorb now | Generate docs and the Studio catalog from the same registry so they cannot drift. | F | n/a | Catalog page |
| ES-D15 | fixtures/golden-sessions | golden sessions fixture | Hand-computed market where every flag and count is known. | none | absorb now | Copy the idea, not the data: build an AQV2 fixture with hand-computed expected values for every registry field. | F | daily OHLC fixture | n/a |

### edge-stats store, sync and adapters

Sources: `packages/core/src/store, sync.ts, adapters`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-A01 | core/src/store/store.ts | DuckDB store with hive-partitioned parquet | Local bars and features store. | partial: content-locked dataset snapshots (autoquant/study_datasets.py) | skip | Stack mismatch and weaker identity: DuckDB files and watermarks are mutable, AQV2 Runs need content-addressed, immutable inputs and pandas/numpy only. | n/a | n/a | n/a |
| ES-A02 | core/src/sync.ts | watermark sync | Pull bars to a watermark, then derive. | partial: provider Skills outside Core (autoquant/workspace_skills) | adapt | AQV2 keeps provider networking outside Core by design; sync stays a Skill that packages a content-locked dataset. | I | provider bytes | n/a |
| ES-A03 | core/src/adapters/csv.ts | csv adapter | Any exported file. | done: package-autoquant-ohlcv Skill and intake V1 to V6 | absorb now | Already covered by dataset packages. | I | csv | n/a |
| ES-A04 | core/src/adapters/synthetic.ts | synthetic adapter | Seeded deterministic demo bars. | partial: seeded random.Random fixtures in autoquant/templates.py | absorb now | Add a seeded synthetic intraday fixture for tests when slice F-intraday starts. | F-intraday | none | n/a |
| ES-A05 | core/src/adapters/binance.ts | binance adapter | Spot crypto 1m history, keyless. | done: fetch-binance-ohlcv Skill | absorb now | Already covered. | I | provider | n/a |
| ES-A06 | core/src/adapters/coinbase.ts | coinbase adapter | Coinbase Exchange 1m candles, keyless. | none | absorb later | Add a provider Skill; keyless, low effort. | I | provider | n/a |
| ES-A07 | core/src/adapters/alpaca.ts | alpaca adapter | US equities and ETFs 1m, free IEX tier, keys. | none | absorb later | Add a provider Skill; credentials come from the caller environment and are never stored by Core. | I | provider + keys | n/a |
| ES-A08 | core/src/adapters/databento.ts | databento adapter | CME futures continuous 1m, pay as you go. | none | absorb later | Needs the futures package and a cost preflight; provider Skill only. | I | provider + keys + futures package | n/a |
| ES-A09 | core/src/adapters/massive.ts | massive adapter | Flat files from disk. | none | absorb later | Covered by csv packaging once the file layout is documented; add a Skill only if the layout needs parsing. | I | local files | n/a |
| ES-A10 | core/src/adapters/lse.ts | lse adapter | Stocks, FX, crypto, commodities, indices, one free key. | none | absorb later | Provider Skill; check that provider terms allow local research use. | I | provider + key | n/a |
| ES-A11 | core/src/adapters/dukascopy.ts | dukascopy adapter | FX, index CFDs, commodities, crypto, keyless. | none | absorb later | Provider Skill; FX sessions need calendar authority beyond XNYS. | I | provider | n/a |
| ES-A12 | core/src/adapters/hyperliquid.ts | hyperliquid adapter | Perp crypto with live tail. | none | absorb later | Historical bars only; the live tail is out (no streaming in Core). | I | provider | n/a |
| ES-A13 | core/src/adapters/types.ts | adapter contract | Normalized bars with watermark. | done: dataset package contract (docs/design/agent-native-market-data-acquisition.md) | absorb now | Already covered. | I | n/a | n/a |
| ES-A14 | core/src/config.ts | edge-stats.config.json | Symbols, sessions, OR windows, IB window, minN, recencyWindow, live. | partial: autoquant.json project manifests | adapt | Per-Project Study contract carries these values and they are hashed; no global config file. | F | n/a | Study contract panel |
| ES-A15 | docs/data-sources.md | data-sources guide | How each adapter works, costs, env keys. | partial: docs/design/agent-native-market-data-acquisition.md | absorb now | Extend the provider Skill docs as providers are added. | I | n/a | n/a |
| ES-A16 | packages/cli/src/commands/bench.ts | bench command | Time the query battery as an interactivity gate. | none | adapt | Add the snapshot and query timings to the test suite as a budget test rather than a user command. | F | n/a | n/a |

### edge-stats live board

Sources: `packages/core/src/live`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-L01 | core/src/live/board.ts | watch phases forming/active/resolved | Evaluates a watch on the developing session; history cut the day before. | none | absorb later | Absorb as an on-demand read-only evaluation (no daemon): `aq watch eval` writes an immutable Watch Evaluation. Needs incomplete-session rows. | J | daily or intraday bars + incomplete session | Watch page |
| ES-L02 | core/src/live/board.ts | threshold alert with dedupe ledger | Fire once per watch per trade date when the estimate crosses min or max with enough N. | none | absorb later | Evaluation records are the ledger; alerts are a read, not a push. | J | n/a | Watch page |
| ES-L03 | core/src/live/sinks.ts | webhook sink | POST the alert payload. | none | skip | Core has no network egress and AGENTS.md puts communication in the host layer; ndjson on disk covers hand-off. | n/a | n/a | n/a |
| ES-L04 | core/src/live/sinks.ts | discord sink | Alert to Discord. | none | skip | Same: notification transport belongs to the host (OpenAlice), not Core. | n/a | n/a | n/a |
| ES-L05 | core/src/live/sinks.ts | telegram sink | Alert to Telegram. | none | skip | Same. | n/a | n/a | n/a |
| ES-L06 | core/src/live/sinks.ts | desktop sink | Desktop notification. | none | skip | Same; Studio is a read-only page. | n/a | n/a | n/a |
| ES-L07 | core/src/live/sinks.ts | ndjson sink | Append alerts to a file. | none | absorb later | Keep as the one local sink. | J | n/a | n/a |
| ES-L08 | core/src/live/replay.ts | alerts and replay commands | List fired alerts; re-print the stored evaluation snapshot behind one. | none | absorb later | Falls out of immutable Watch Evaluations. | J | n/a | Watch history list |

### edge-stats trade tags

Sources: `packages/core/src/trades.ts; packages/cli`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-T01 | core/src/trades.ts | TRADED / TRADED_WIN / TRADED_LOSS tags | Your imported trades become event-calendar tags that queries can condition on. | none | absorb later | Depends on the reported trade-log intake and event conditions; compare base rate with realized result with both envelopes. | H | trade log | Trade overlay on result card |
| ES-T02 | core/src/trades.ts | FIFO realized P&L | Signed FIFO per symbol, net of fees, on the closing fill date. | none | absorb later | Part of the trade intake; state the multiplier and fee rules. | H | trade log | n/a |
| ES-T03 | packages/cli/src/commands/trades.ts | broker import (read-only, env keys) | Pull fills through broker-sdk. | none | skip | AQV2 Core holds no credentials and makes no network calls; a caller may export fills to CSV and use the statement import. | n/a | n/a | n/a |
| ES-T04 | packages/cli/src/commands/trades.ts | statement CSV import with --map and --mult | Symbol mapping and contract multipliers; unmapped fills skipped and counted. | none | absorb later | Absorb into the reported trade intake. | H | trade log | n/a |

### edge-stats hosted store and migration docs

Sources: `docs/`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-H01 | docs/hosted-store.md | hosted derived store | Nightly build publishing session features and precomputed envelopes. | none | skip | Redistributes derived market data (provider terms) and needs a hosted service; AQV2 is local-first. | n/a | n/a | n/a |
| ES-H02 | docs/coming-from-edgeful.md | report-to-preset migration map | Maps familiar reports to preset ids. | none | absorb later | Write an AQV2 "from other tools" note in the catalog docs; do not name competitors in product text. | F | n/a | n/a |

### edge-stats dashboard pages and components

Sources: `packages/web/src`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-W01 | packages/web/src/pages/reports.tsx | Reports grid | Cards per preset, each showing N and interval. | none | absorb now | Catalog page of Session Statistics cards. | F | daily OHLC | Catalog page |
| ES-W02 | packages/web/src/pages/report.tsx | Report page with parameters | Per-preset parameters, group-by, full result panel. | none | absorb now | Report page driven by the catalog entry parameters. | F | daily OHLC | Report page |
| ES-W03 | packages/web/src/pages/builder.tsx | Query builder with live DSL | Compose outcome and conditions; live DSL string. | none | absorb later | After the JSON contract and DSL sugar exist. | F-dsl | daily OHLC | Builder page |
| ES-W04 | packages/web/src/pages/data.tsx | Data page | Coverage, watermarks, calendar versions, freshness. | partial: dataset identity in the Project snapshot | absorb now | Dataset panel on the Project page: source, snapshot hash, coverage, calendar authority. | D | dataset snapshot | Dataset panel |
| ES-W05 | packages/web/src/pages/live.tsx | Live page | Board of watches with phases and alerts. | none | absorb later | With the Watch slice. | J | n/a | Watch page |
| ES-W06 | packages/web/src/components/charts.tsx | CiBar | Interval bar with point estimate. | done: IntervalBar in studio-app/src/pages/EventStudy.tsx | absorb now | Shipped; promote to a shared component. | A | n/a | Shared component |
| ES-W07 | packages/web/src/components/charts.tsx | YearBars | Per-year bars. | partial: per-year chips | absorb now | Upgrade chips to bars when years exceed ten. | F | n/a | Shared component |
| ES-W08 | packages/web/src/components/charts.tsx | PercentileStrip | Distribution strip with quantile ticks. | partial: quantile table | absorb now | Draw the strip. | F | n/a | Shared component |
| ES-W09 | packages/web/src/components/estimate.tsx | Estimate and EstimateInline | Rate with N, hits and interval formatted consistently. | done: result card in EventStudy.tsx | absorb now | Promote to a shared component. | F | n/a | Shared component |
| ES-W10 | packages/web/src/components/results-panel.tsx | ResultsPanel | Estimate, stability, per-year, distribution, grouped table, footer. | partial: Event Study page | absorb now | Generalize to every rate-bearing lane. | F | n/a | Shared component |
| ES-W11 | packages/web/src/components/results-panel.tsx | SessionDrawer | Drill-down to the matching sessions. | partial: event table on Event Study page | absorb now | Add the drawer for Session Statistics matches. | F | n/a | Drawer |
| ES-W12 | packages/web/src/components/results-panel.tsx | EnvelopeFooter | Normalized query, calendar hash, disclaimer. | none | absorb now | Footer shows contract hash, derivation version and disclaimer. | F | n/a | Footer |
| ES-W13 | packages/web/src/components/session-view.tsx | SessionView chart | Bars of one session with prior levels, open, ranges, gap band, fill marker. | none | absorb later | Needs intraday bars and a charting decision (Vela, Apache-2.0). | F-intraday | intraday bars | Session drawer chart |
| ES-W14 | packages/web/src/components/ui.tsx | Badge, NBadge, LowSampleBadge, StabilityTick, Panel, Button, CopyButton, CodeBlock, EmptyState, ErrorNote, Skeleton | UI kit used by the dashboard. | partial: studio-app design tokens and Notice | adapt | Use the Shinka design tokens already ported; add only the badges that carry honesty meaning. | D | n/a | Shared components |
| ES-W15 | packages/web/src/lib/api.ts, hooks.ts | URL-encoded query state | The whole query lives in the URL so any view is shareable. | partial: query-param routing in studio-app | absorb now | Keep every Studio view deep-linkable. | D | n/a | Router |

### edge-stats MCP tools

Sources: `packages/mcp/src/lib/tools.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-M01 | packages/mcp/src/lib/tools.ts | edge_query | Run a DSL query. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | absorb later | Same; blocked on the slice it depends on. | F-later | n/a | n/a |
| ES-M02 | packages/mcp/src/lib/tools.ts | edge_fields | List registry fields, predicates, outcomes. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | adapt | AQV2 exposes capabilities as `aq` JSON commands; add the matching command first, an optional MCP shim is a thin later layer. | F | n/a | n/a |
| ES-M03 | packages/mcp/src/lib/tools.ts | edge_sessions | List matching sessions. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | adapt | AQV2 exposes capabilities as `aq` JSON commands; add the matching command first, an optional MCP shim is a thin later layer. | F | n/a | n/a |
| ES-M04 | packages/mcp/src/lib/tools.ts | edge_session_bars | Bars of one session. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | absorb later | Same; blocked on the slice it depends on. | F-later | n/a | n/a |
| ES-M05 | packages/mcp/src/lib/tools.ts | edge_report | Run a preset. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | adapt | AQV2 exposes capabilities as `aq` JSON commands; add the matching command first, an optional MCP shim is a thin later layer. | F | n/a | n/a |
| ES-M06 | packages/mcp/src/lib/tools.ts | edge_reports_list | List the preset catalog. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | adapt | AQV2 exposes capabilities as `aq` JSON commands; add the matching command first, an optional MCP shim is a thin later layer. | F | n/a | n/a |
| ES-M07 | packages/mcp/src/lib/tools.ts | edge_freshness | Coverage and calendar versions. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | adapt | AQV2 exposes capabilities as `aq` JSON commands; add the matching command first, an optional MCP shim is a thin later layer. | F | n/a | n/a |
| ES-M08 | packages/mcp/src/lib/tools.ts | edge_export | Export bars, sessions, events, matches. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | adapt | AQV2 exposes capabilities as `aq` JSON commands; add the matching command first, an optional MCP shim is a thin later layer. | F | n/a | n/a |
| ES-M09 | packages/mcp/src/lib/tools.ts | edge_trades | Trade tags. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | absorb later | Same; blocked on the slice it depends on. | F-later | n/a | n/a |
| ES-M10 | packages/mcp/src/lib/tools.ts | edge_live | Live board state. | none: the Agent contract is `aq ... --json` (docs/design/agent-cli-contract.md) | absorb later | Same; blocked on the slice it depends on. | F-later | n/a | n/a |

### edge-stats CLI commands

Sources: `packages/cli/src/index.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-X01 | packages/cli/src/index.ts | init | Create config and data dir (with --demo). | none | adapt | AQV2 has `aq workspace init` and `aq project new`; add a seeded demo fixture. | F | n/a | n/a |
| ES-X02 | packages/cli/src/index.ts | sync | Pull bars and derive. | none | adapt | Provider Skills package data; deriving happens inside the Run. | I | n/a | n/a |
| ES-X03 | packages/cli/src/index.ts | query | Run a DSL query. | none | absorb later | After the JSON contract; `aq stats run` with a contract file first. | F | n/a | n/a |
| ES-X04 | packages/cli/src/index.ts | report | Run a preset. | none | absorb now | `aq stats report <preset> --project`; writes an immutable Run. | F | n/a | n/a |
| ES-X05 | packages/cli/src/index.ts | presets | List the catalog. | none | absorb now | `aq stats presets --json`. | F | n/a | n/a |
| ES-X06 | packages/cli/src/index.ts | fields | Print the registry with definitions. | none | absorb now | `aq stats fields --json`; includes the known-at-open flag. | F | n/a | n/a |
| ES-X07 | packages/cli/src/index.ts | adapters | List adapters and env keys. | none | adapt | Covered by the provider Skill index. | I | n/a | n/a |
| ES-X08 | packages/cli/src/index.ts | trades import/status | Import trades and show tags. | none | absorb later | Reported trade intake. | H | n/a | n/a |
| ES-X09 | packages/cli/src/index.ts | export | Export bars, sessions, events, matches. | none | adapt | Run artifacts are files; add CSV export of a Run. | F | n/a | n/a |
| ES-X10 | packages/cli/src/index.ts | calendar | Show resolved session windows. | none | absorb now | `aq dataset calendar` from the calendar authority. | F | n/a | n/a |
| ES-X11 | packages/cli/src/index.ts | freshness | Watermarks, calendar versions, horizons. | none | adapt | Dataset snapshot identity replaces watermarks; show calendar authority version. | D | n/a | n/a |
| ES-X12 | packages/cli/src/index.ts | serve | Local dashboard and API. | done: aq studio serve | absorb now | Studio already serves (`aq studio serve`). | D | n/a | n/a |
| ES-X13 | packages/cli/src/index.ts | live | Run the watch loop. | none | absorb later | Becomes `aq watch eval`, no loop. | J | n/a | n/a |
| ES-X14 | packages/cli/src/index.ts | alerts | List fired alerts. | none | absorb later | List Watch Evaluations. | J | n/a | n/a |
| ES-X15 | packages/cli/src/index.ts | replay | Re-print the snapshot behind an alert. | none | absorb later | Read a Watch Evaluation. | J | n/a | n/a |
| ES-X16 | packages/cli/src/index.ts | bench | Time the query battery. | none | adapt | Budget test. | F | n/a | n/a |

### prop-firm-sim engine, trader models, options

Sources: `packages/core/src`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-E01 | packages/core/src/engine/rng.ts | seeded deterministic RNG and pathSeed | Same spec, profile, options and seed give byte-identical results; one derived seed per path. | partial: seeded random.Random in autoquant/templates.py (fixtures only) | absorb now | Use a frozen generator (numpy RandomState MT19937 or an in-house PRNG); numpy Generator streams are not guaranteed stable across versions. Record the algorithm and seed in the Run. | B | n/a | Seed shown in result footer |
| PF-E02 | packages/core/src/bootstrap/block.ts | stationary block bootstrap | Geometric blocks with mean length L preserve streaks; L=1 is i.i.d. | none | absorb now | Core of slice B: confidence intervals for Portfolio validation Sharpe and max drawdown from the return series. | B | Portfolio validation return series (per decision bar) | Interval on Portfolio headline metrics |
| PF-E03 | packages/core/src/spec/trader.ts | bootstrap trader profile (R series, blockMeanLength) | Resample real per-trade R-multiples. | none | absorb later | AQV2 has per-bar returns, not trades; trade-level R needs the reported trade intake (slice H). | H | trade log | Rule-survival page |
| PF-E04 | packages/core/src/spec/trader.ts | parametric trader profile | Bernoulli win rate with average win and loss in R, optional lognormal spread. | none | absorb later | Caller-asserted what-if, not evidence: label it hypothetical and keep it out of research-family trial counts. | G | caller inputs | Rule-survival page (hypothetical badge) |
| PF-E05 | packages/core/src/spec/trader.ts | trades per day model (fixed or poisson) | Daily trade count. | none | absorb later | Part of the parametric profile. | G | caller inputs | Rule-survival form |
| PF-E06 | packages/core/src/spec/trader.ts | risk sizing modes (percent of balance, percent of initial, fixed amount) | Currency value of one R. | none | absorb later | Part of the trade-level model. | G | caller inputs | Rule-survival form |
| PF-E07 | packages/core/src/spec/trader.ts | fromBrokerStats() | Build a parametric profile from broker round-trip statistics. | none | absorb later | Falls out of the trade intake. | H | trade log | n/a |
| PF-E08 | packages/core/src/spec/options.ts | simulation options (paths, seed, attemptCap, simulateFunded, fundedHorizonDays, unlimitedStepDayCap, includeHistograms, tracePaths) | Run size and caps. | none | absorb now | Fixed in the Study contract and hashed; paths bounded; caps are disclosed assumptions. | B | n/a | Contract panel |
| PF-E09 | packages/core/src/engine/simulate.ts | simulate() Monte Carlo engine | Plays whole challenge journeys path by path. | none | absorb later | Rule-survival simulator over a rule set; see the proposal section. | G | Portfolio validation return series (per decision bar) | Rule-survival page |
| PF-E10 | packages/core/src/engine/aggregate.ts | aggregation of paths | Pass rates with Wilson CIs, cost and payout distributions. | none | absorb later | Reuse the slice A envelope for every rate. | G | n/a | Result cards |
| PF-E11 | packages/core/src/stats/summary.ts | wilson95, quantileSorted, summarizeSorted, histogramSorted, standardError | Summary helpers. | done: autoquant/event_envelope.py | absorb now | Same helpers exist; add histogram bins and standard error. | B | n/a | Histogram component |

### prop-firm-sim rule semantics and results

Sources: `packages/core/src/spec, engine`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-R01 | packages/core/src/spec/challenge.ts | maxLoss static-initial | Floor fixed at initial minus limit forever. | none | absorb later | Rule set field in the rule-survival contract. | G | Portfolio validation return series (per decision bar) | Rule form + floor line on path chart |
| PF-R02 | packages/core/src/spec/challenge.ts | maxLoss trailing-realized-eod | Floor ratchets with end-of-day balance highs. | none | absorb later | Same. | G | Portfolio validation return series (per decision bar) | Floor line |
| PF-R03 | packages/core/src/spec/challenge.ts | maxLoss trailing-intraday-unrealized | Floor trails peak unrealized equity intraday. | none | absorb later | Needs intra-bar equity; with per-bar returns use bar high and low equity or disclose the approximation. | G | Portfolio validation return series (per decision bar) + intrabar extremes | Floor line |
| PF-R04 | packages/core/src/spec/challenge.ts | maxLoss trailing-locks-at-initial | Trails then locks at breakeven; exact lock and offset semantics. | none | absorb later | Same. | G | Portfolio validation return series (per decision bar) | Floor line |
| PF-R05 | packages/core/src/spec/challenge.ts | dailyLoss limitBasis (initial-balance or anchor) | Daily allowance as a fixed amount or percent of each day start. | none | absorb later | Rule set field. | G | Portfolio validation return series (per decision bar) | Rule form |
| PF-R06 | packages/core/src/spec/challenge.ts | dailyLoss basis (prior-day balance or equity) | Which day-start number anchors the floor. | none | absorb later | Rule set field. | G | Portfolio validation return series (per decision bar) | Rule form |
| PF-R07 | packages/core/src/spec/challenge.ts | dailyLoss includesOpenPnl | Whether floating loss can breach mid-trade. | none | absorb later | Rule set field. | G | Portfolio validation return series (per decision bar) | Rule form |
| PF-R08 | packages/core/src/spec/challenge.ts | dailyLoss evaluation (intraday or end-of-day) | Touch-kills versus close-only. | none | absorb later | Rule set field. | G | Portfolio validation return series (per decision bar) | Rule form |
| PF-R09 | packages/core/src/spec/challenge.ts | consistency rule | Best-day share cap; modeled as a moving profit target with a rational stopping rule. | none | absorb later | Rule set field; simulate the extra days at risk it forces. | G | Portfolio validation return series (per decision bar) | Rule form |
| PF-R10 | packages/core/src/spec/challenge.ts | steps (profit target, minTradingDays, maxDays) | Multi-phase evaluations on fresh accounts; stop-and-grind assumption after targets. | none | absorb later | Rule set field; disclose the stop-risking assumption. | G | Portfolio validation return series (per decision bar) | Rule form |
| PF-R11 | packages/core/src/spec/challenge.ts | fees (one-time, discounted reset, activation, refundable, monthly) | Cost to funded as a distribution. | none | absorb later | Economics layer on top of survival; caller-owned numbers only. | G-econ | caller inputs | Cost card |
| PF-R12 | packages/core/src/spec/challenge.ts | funded stage and payoutRules (winning-day minimum, per-payout caps, profit buffer, funded consistency) | Payout gating over a funded horizon. | none | absorb later | Economics layer; withdrawals never cross the loss floor. | G-econ | Portfolio validation return series (per decision bar) | Payout card |
| PF-R13 | packages/core/src/spec/challenge.ts | constraints (leverage, newsTrading, copyTrading, autoTrading, weekend and overnight holding, stopLossRequired) | Declared rule attributes that are not simulated. | none | absorb later | Carry as disclosed non-simulated flags only. | G | caller inputs | Assumptions list |
| PF-R14 | packages/core/src/spec/challenge.ts | flagsNotSimulated and assumptions.flags | Every simplification echoed in every result. | partial: honesty notices in Event Study | absorb now | Make a required Run field: a result without its assumption list is invalid. | G | n/a | Assumptions list |
| PF-R15 | packages/core/src/spec/challenge.ts | sources and provenance on specs | Citation and last-verified date travel into results. | partial: dataset provenance claims | absorb now | Every rule set carries its source and an as-of date. | G | n/a | Provenance line |
| PF-R16 | packages/core/src/spec/result.ts | per-phase and joint pass probability with Wilson CI and fail reasons | Which rule killed the attempt. | none | absorb later | Output of the survival simulator. | G | Portfolio validation return series (per decision bar) | Result cards |
| PF-R17 | packages/core/src/spec/result.ts | attempts to funded, total cost, days to funded | Journey statistics. | none | absorb later | Economics layer. | G-econ | Portfolio validation return series (per decision bar) | Result cards |
| PF-R18 | packages/core/src/spec/result.ts | stagnation days (longest stretch without a new equity high) | Dead-time distribution. | none | absorb now | Cheap and useful for any Portfolio return series: report longest time under water. | B | Portfolio validation return series (per decision bar) | Result card |
| PF-R19 | packages/core/src/spec/result.ts | EV total, standard error, P(EV greater than 0), payout probability, days to first payout, funded blown rate | Expected value with fees priced in. | none | absorb later | Economics layer. | G-econ | Portfolio validation return series (per decision bar) | Result cards |
| PF-R20 | packages/core/src/spec/result.ts | max drawdown while evaluating | Drawdown percentiles in the attempt. | partial: drawdown evidence in Book Risk | absorb now | Bootstrap interval around the validation max drawdown. | B | Portfolio validation return series (per decision bar) | Result card |
| PF-R21 | packages/core/src/engine/trace.ts | traced equity path fan chart | 800 paths with the moving loss floor drawn beneath. | none | absorb later | Observation only; never changes numbers. | G | Portfolio validation return series (per decision bar) | Path fan chart |

### prop-firm-sim analyses

Sources: `packages/core/src/analyze`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-A01 | packages/core/src/analyze/optimalRisk.ts | optimal risk sizing sweep | Pass probability and EV against risk per trade; the two maxima differ. | none | absorb later | Run the survival simulator over a risk grid; the grid is part of the contract. | G | Portfolio validation return series (per decision bar) | Risk sweep chart |
| PF-A02 | packages/core/src/analyze/sensitivity.ts | sensitivity of win rate | Pass probability and EV when win rate moves one to three points, with gradient. | partial: parameter neighborhood in portfolio_explorer.py | absorb later | Parametric profiles only; for bootstrap profiles use block-length sensitivity. | G | caller inputs | Sensitivity table |
| PF-A03 | packages/core/src/analyze/compare.ts | compare challenges | Side-by-side rule sets under the same trader. | none | absorb later | Compare rule sets or Studies on the same return series. | G | Portfolio validation return series (per decision bar) | Compare page |

### prop-firm-sim trade tools

Sources: `packages/core/src/trades`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-T01 | packages/core/src/trades/log.ts | parseTradeLog and parseTimestamp | Timestamped trade log with robust timestamp parsing. | none | absorb later | Part of the reported trade intake. | H | trade log | n/a |
| PF-T02 | packages/core/src/trades/news.ts | news filter and recurring release templates | Replay the log with trades inside news windows removed; show the delta with the same seed. | none | absorb later | Needs the versioned event calendar; author AQV2 templates from primary sources rather than copying the list. | H | trade log + event dates | News delta card |
| PF-T03 | packages/core/src/trades/portfolio.ts | mergeTradeLogs | Chronological merge of up to five histories. | none | absorb later | Part of the trade intake. | H | trade log | n/a |
| PF-T04 | packages/core/src/trades/portfolio.ts | analyzeOverlap with audit risk bands | Same-direction overlapping positions across histories with disclosed heuristic bands. | partial: diversification stress in Portfolio (portfolio-diversification-stress) | absorb later | Disclose that the bands are heuristics. | H | trade log | Overlap banner |

### prop-firm-sim importers

Sources: `packages/core/src/import`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-I01 | packages/core/src/import/adapters/broker-json.ts | broker-json importer | Normalize this format into canonical trades with structured diagnostics. | none | absorb later | Port the parsing method per format with synthetic fixtures; refuse formats you cannot verify. | H | trade log file | Import report |
| PF-I02 | packages/core/src/import/adapters/thinkorswim.ts | thinkorswim importer | Normalize this format into canonical trades with structured diagnostics. | none | absorb later | Port the parsing method per format with synthetic fixtures; refuse formats you cannot verify. | H | trade log file | Import report |
| PF-I03 | packages/core/src/import/adapters/tradingview.ts | tradingview importer | Normalize this format into canonical trades with structured diagnostics. | none | absorb later | Port the parsing method per format with synthetic fixtures; refuse formats you cannot verify. | H | trade log file | Import report |
| PF-I04 | packages/core/src/import/adapters/metatrader.ts | metatrader importer | Normalize this format into canonical trades with structured diagnostics. | none | absorb later | Port the parsing method per format with synthetic fixtures; refuse formats you cannot verify. | H | trade log file | Import report |
| PF-I05 | packages/core/src/import/adapters/mt5-deals.ts | mt5-deals importer | Normalize this format into canonical trades with structured diagnostics. | none | absorb later | Port the parsing method per format with synthetic fixtures; refuse formats you cannot verify. | H | trade log file | Import report |
| PF-I06 | packages/core/src/import/adapters/generic-csv.ts | generic-csv importer | Normalize this format into canonical trades with structured diagnostics. | none | absorb later | Port the parsing method per format with synthetic fixtures; refuse formats you cannot verify. | H | trade log file | Import report |
| PF-I07 | packages/core/src/import/aliases.ts | header alias resolution | Resolve ambiguous columns by inspecting values. | none | absorb later | Part of the importers. | H | trade log file | n/a |
| PF-I08 | packages/core/src/import/rmultiple.ts | R ladder (explicit, calculated, inferred, unavailable) | Strict trust order for risk per trade; verdicts ready, needs-risk, partial (refused), unavailable. | none | absorb later | Adopt verbatim: R is computed, never fabricated; partial coverage is refused. | H | trade log file | Verdict banner |
| PF-I09 | packages/core/src/import/reconstruct.ts | round-trip reconstruction from fills | Rebuild trades from raw executions. | none | absorb later | Part of the importers. | H | trade log file | n/a |
| PF-I10 | docs/trade-import.md | security and robustness rules for imports | Bounded inputs, no execution, no network. | none | absorb now | Adopt as import guard tests. | H | n/a | n/a |

### prop-firm-sim directory and hosted product

Sources: `packages/core/src/directory; README`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-D01 | packages/core/src/directory/index.ts | adaptFirm three-tier honesty policy | Structured columns verbatim; free text inferred only with one reading and disclosed; ambiguity refused. | partial: strict request intake | absorb now | Adopt the policy for any rule set an Agent drafts from prose. | G | n/a | Provenance line |
| PF-D02 | packages/core/src/directory/index.ts | live LuxAlgo prop-firm directory fetch | Runtime fetch of firm rules from a hosted API. | none | skip | Remote nondeterministic input breaks content-locked Runs, Core makes no network calls, and the data is a third-party service; rule sets are supplied inline with a source and as-of date. | n/a | n/a | n/a |
| PF-D03 | README.md | hosted simulator and firm rankings | Browser product with precomputed odds per firm. | none | skip | A hosted commercial product; AQV2 is local and offers no rankings or offers. | n/a | n/a | n/a |

### prop-firm-sim CLI commands

Sources: `packages/cli/src/index.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-X01 | packages/cli/src/index.ts | firms | List firms from the directory. | none | skip | Depends on the directory fetch (skipped). | n/a | n/a | n/a |
| PF-X02 | packages/cli/src/index.ts | rules | Print one challenge ruleset. | none | absorb later | Print a rule set contract with its source and as-of date. | G | n/a | n/a |
| PF-X03 | packages/cli/src/index.ts | simulate | Run the Monte Carlo. | none | absorb later | `aq risk simulate` over a rule-set contract and a return series. | G | n/a | n/a |
| PF-X04 | packages/cli/src/index.ts | optimal-risk | Sweep risk per trade. | none | absorb later | Risk grid in the contract. | G | n/a | n/a |
| PF-X05 | packages/cli/src/index.ts | compare | Compare challenges. | none | absorb later | Compare rule sets. | G | n/a | n/a |
| PF-X06 | packages/cli/src/index.ts | overlap | Portfolio overlap audit. | none | absorb later | Part of the trade intake. | H | n/a | n/a |

### prop-firm-sim MCP tools

Sources: `packages/mcp/src/tools.ts`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-M01 | packages/mcp/src/tools.ts | list_firms | List firms. | none: the Agent contract is `aq ... --json` | skip | Directory fetch skipped. | G | n/a | n/a |
| PF-M02 | packages/mcp/src/tools.ts | get_challenge_rules | Rules for a challenge. | none: the Agent contract is `aq ... --json` | adapt | CLI JSON; MCP shim optional later. | G | n/a | n/a |
| PF-M03 | packages/mcp/src/tools.ts | simulate_challenge | Run the simulation. | none: the Agent contract is `aq ... --json` | adapt | CLI JSON first. | G | n/a | n/a |
| PF-M04 | packages/mcp/src/tools.ts | optimal_risk | Risk sweep. | none: the Agent contract is `aq ... --json` | adapt | CLI JSON first. | G | n/a | n/a |
| PF-M05 | packages/mcp/src/tools.ts | compare_challenges | Compare. | none: the Agent contract is `aq ... --json` | adapt | CLI JSON first. | G | n/a | n/a |
| PF-M06 | packages/mcp/src/tools.ts | bootstrap_simulate | Simulate from your R series. | none: the Agent contract is `aq ... --json` | adapt | CLI JSON first. | G | n/a | n/a |
| PF-M07 | packages/mcp/src/tools.ts | analyze_portfolio_overlap | Overlap audit. | none: the Agent contract is `aq ... --json` | adapt | CLI JSON first. | G | n/a | n/a |

### Vela and PineTS (skimmed)

Sources: `LuxAlgo/Vela, LuxAlgo/PineTS READMEs`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VL-01 | LuxAlgo/Vela | headless chart core | Data model, engines, drawings, providers behind public ports. | none | absorb later | Apache-2.0. Candidate chart engine for session views, equity and path charts; evaluate bundle size and a no-WebGL fallback before adopting. | K | bars | Charts |
| VL-02 | LuxAlgo/Vela | native WebGL2 renderer with canvas2d fallback | Fast rendering of large bar sets. | none | absorb later | Same evaluation; local use makes GPU availability a non-issue. | K | bars | Charts |
| VL-03 | LuxAlgo/Vela | workspace app (topbar, grids, sync groups, keymap) | Complete chart application. | none | skip | Studio already has its own shell and router; a second app shell would duplicate it. | n/a | n/a | n/a |
| VL-04 | LuxAlgo/Vela | ui kit and design tokens | Component kit on Zag.js. | none | skip | Studio uses the Shinka tokens already ported; mixing two token systems breaks the theme. | n/a | n/a | n/a |
| VL-05 | LuxAlgo/Vela | plugin SDK and native indicators | Chart types, renderer layers, indicators. | none | absorb later | Use only to draw prior levels, gap bands and fill markers via a plugin layer. | K | bars | Session drawer chart |
| VL-06 | LuxAlgo/Vela | data providers (Binance, Coinbase, Hyperliquid) | Live and historical bars in the browser. | none | skip | Browser-side market fetches bypass content-locked datasets; Studio reads verified Runs only. | n/a | n/a | n/a |
| VL-07 | LuxAlgo/PineTS | Pine Script runtime | Run Pine indicators and strategies in Node or the browser. | none | skip | AGPL-3.0: cannot be embedded in an MIT package; may only run as a separate external tool the caller installs. | n/a | n/a | n/a |

### trade-journal (README skimmed)

Sources: `LuxAlgo/trade-journal README`.

| Id | Source | Feature | What it does | AutoQuant today | Decision | Reason | Slice | Data | Studio surface |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TJ-01 | LuxAlgo/trade-journal | round-trip reconstruction from fills | Rebuilds trades from executions across brokers. | none | absorb later | Same method as the trade-import rows; one implementation. | H | trade log | n/a |
| TJ-02 | LuxAlgo/trade-journal | P&L calendar | Daily P&L heat calendar. | none | absorb later | Return calendar for Portfolio Runs and trade logs. | D | Portfolio validation return series (per decision bar) | Calendar heatmap |
| TJ-03 | LuxAlgo/trade-journal | equity curve and drawdown gauges | Account equity and drawdown views. | partial: Portfolio explorer headline metrics | absorb now | Draw under-water curves for Portfolio Runs. | B | Portfolio validation return series (per decision bar) | Equity and under-water chart |
| TJ-04 | LuxAlgo/trade-journal | Edge Score formula | Documented versioned composite score. | none | skip | A composite score is a new verdict or gate; AQV2 Work Briefs state they are not gates. Revisit only on an owner decision. | n/a | n/a | n/a |
| TJ-05 | LuxAlgo/trade-journal | estimated MAE and MFE with candle replay | Excursion statistics and trade replay on closed trades. | none | absorb later | Needs intraday bars and the order-native execution kernel plans; schedule after them. | H | trade log + intraday bars | Trade replay |
| TJ-06 | LuxAlgo/trade-journal | prop firm tracker (costs, refunds, payouts, ROI) | Personal accounting of real prop accounts. | none | skip | Accounting for real money flows, not research evidence. | n/a | n/a | n/a |
| TJ-07 | LuxAlgo/trade-journal | AI reflection and voice dictation | LLM journaling prompts. | none | skip | Core and Studio make no model calls; the coding Agent is the reflector. | n/a | n/a | n/a |
| TJ-08 | LuxAlgo/trade-journal | currency conversion with fixed rates | Combine accounts in one reporting currency. | none | skip | AQV2 datasets and books carry one declared currency; conversion is a separate data authority problem. | n/a | n/a | n/a |
| TJ-09 | LuxAlgo/trade-journal | export (CSV, JSON, PDF, PNG) | Portable records. | partial: Runs are files | adapt | CSV and JSON from Run artifacts; no PDF or PNG in Core. | D | n/a | Download links |
| TJ-10 | LuxAlgo/trade-journal | SQLite journal with attachments and notes | Mutable local record. | none | skip | AQV2 records are immutable Runs, Reports and Dossiers; a mutable journal would be a second source of truth. | n/a | n/a | n/a |
| TJ-11 | LuxAlgo/trade-journal | demo data | Generated demo account. | none | adapt | Seeded demo fixtures for tests and screenshots, never committed as real data. | F | n/a | n/a |
| TJ-12 | LuxAlgo/trade-journal | broker sync with encrypted credentials | Pull trades by API key. | none | skip | Core holds no credentials and makes no network calls. | n/a | n/a | n/a |

## Coverage and gaps in this inventory

Read in full: `edge-stats` README, ARCHITECTURE, every doc under `docs/`,
the three registry files (every field, predicate and outcome), the preset
catalog table, stats, config and event schemas, the DSL grammar header, and
the web, MCP and CLI file lists with their exported names. `prop-firm-sim`:
README, `rule-semantics.md`, `trade-import.md`, the trader, options and
result schemas, and the file lists for engine, analyze, trades, import,
directory, CLI and MCP.

Skimmed, not read line by line: `edge-stats` `derive.ts` stage internals,
adapter internals, web component bodies, MCP tool schemas and the 42 preset
JSON bodies (rows come from the generated catalog and registry docs);
`prop-firm-sim` engine internals (`attempt.ts`, `funded.ts`, `journey.ts`),
importer parsers and the news template list; the READMEs of Vela, PineTS and
trade-journal only. Rows for those areas rest on documentation, so each
one needs a source read before its slice starts.

No LuxAlgo code is executed or vendored by this inventory.

