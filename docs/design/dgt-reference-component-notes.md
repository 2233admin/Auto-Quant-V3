# DGT reference component notes

Status: proposed (research notes; nothing in this document is implemented).

Related: [[docs/design/hypothesis-and-idea-verdict]],
[[docs/design/reference-absorption-inventory]],
[[docs/design/ohlcv-factor-lab]],
[[docs/design/ohlcv-price-event-study]],
[[docs/design/selection-adjusted-research-evidence]],
[[plans/shinka-research-methods-and-frontend-merge]], and
[[docs/ARCHITECTURE]].

## Purpose and rules of engagement

The owner's first real use case is a TradingView-style context indicator.
The spec behind it names a paid indicator family published by `dgtrd`
(SoleMare Analytics, branded MarketMastery) as the main reference. Our job is
not to clone that family. Our job is to turn each vendor component into a
deterministic, Python-testable **own model** and then test, as falsifiable
Hypotheses, whether that component carries information. The decomposition ids
`c1` to `c11` are the ones defined in
[[docs/design/hypothesis-and-idea-verdict]].

Evidence tags used below follow the spec:

- **F**: the vendor text states it. The source id and a short paraphrase are
  given. Quotes are limited to a few words.
- **U**: not disclosed, ambiguous, or contradicted between sources. Never
  filled in with an invented vendor fact.
- **P**: our own proposed definition. It is ours, it is named as ours, and it
  is not claimed to reproduce any vendor number.

### Terms and licensing

Everything here comes from public pages and public TradingView descriptions.
The source code of the paid scripts is protected and was not seen. The
vendor Terms and Conditions page (S-terms in the table above) says, in summary:

- subscribers may not redistribute the scripts or derivatives;
- may not reverse-engineer or try to extract the Pine source or the
  proprietary implementation;
- may not use the scripts or their implementation to build a competing
  commercial product without written permission;
- the vendor retains rights in its code, visual designs, documentation and
  branding, but says established market concepts, terminology and techniques
  are not claimed as proprietary merely because the tools implement them.

Consequences for this repository:

1. Only public descriptions are used. No attempt is made to decompile,
   scrape or infer source.
2. Every model below is an own model built from standard, public concepts
   (swing pivots, ATR buffers, volume-weighted average price, pivot formulas,
   volume ratios). Where a vendor number is not public it stays U.
3. The vendor trademarks (MarketMastery, Price Action Engine) are not used
   as names for our models. Our names are `fractal-swing-recursion-v1`,
   `atr-three-layer-trail-v1` and so on, and every output says "own model".
4. This is internal research on bar data. If this ever becomes a distributed
   product, the Terms wording above needs a fresh read first.

## Source reading status

| Id | Source | Read | Notes |
| --- | --- | --- | --- |
| S1 | Suite documentation (Google Sites) | fully | module guides, inputs, FAQ, alert steps |
| S2 | TradingView HOW-TO idea | fully | module list, tips; calls the anchor list Minor/Major/Macro |
| S3 | Suite script page and release notes | fully | paid space, source not public; notes Jun 2025 to Mar 2026 |
| S4 | Structure Breaks and Projections (site) | fully | lifecycle states, tiers, invalidation |
| S5 | VWAP Framework (site) | fully | five anchor types, deviation modes |
| S6 | Pivot Matrix (site) | fully | models, CPR, state panels |
| S7 | Liquidity Radar (site) | fully | map, profile, grab markers, dashboard |
| S8 | Institutional Power of Three (TradingView page) | fully | UI language Vietnamese, body English; the site page for it returns 404 |
| S9 | Macroeconomic Dashboard (site) | fully | 17 metrics, alert types |
| S0 | `dgtrd` profile and script list | list read through a browser | 44 scripts, first page of 21 read, "Show more" not expanded |
| S-ts | TradingView pages of the product scripts (Structure Breaks, VWAP, Pivot Matrix, Radar, Macro) | description read fully; release notes read to 31 January (Pivot Matrix) and 21 March (Macro); later notes, if any, not read | public text mirrors the site |
| S-pub | Free or public scripts: Fair Value Gaps, Volume Profile and Volume Indicator, Volume Profile Pivot Anchored, Positioning Flow Index, Initial Balance Auction Intelligence, Dual-Phase Reversal | descriptions read; the three volume-profile pages and PFI only up to the first few screens of release notes | not opened: Anchored Volume Profile, Custom Range, Supply and Demand Zones, Day Trading Booster, Neglected Volume, Squeeze Momentum (the last two were not on the first page of S0) |
| S-terms | Terms, Risk Disclaimer, Library pages (site) | fully | |

Could not read at all: the Pine source of any paid script, the current
Inputs panel of the paid scripts, and any backtest or performance statistics.
None of the pages publishes one.

Cross-source inconsistencies found while reading (all U, repeated in the open
list at the end):

- Evaluation Anchor options: S1 lists Micro, Minor, Major, Macro with Macro
  as default; S2 lists Minor, Major, Macro only.
- Zone layers: S1 lists eight options with "Minor and Major" default; S2
  lists a Multi-Scale option that shows "Micro through Major" while S1 says
  all four.
- Volume Activity classes: S1 names Spike, High, Low; S2 names Low,
  Moderate, High, Very High, Spike.
- Leverage Risk Zones: the module guide says liquidation levels come from
  entry, leverage and maintenance margin; the trading roadmap in S1 says they
  are "based on aggregated open interest and historical trap activity".
- Terminology renamed on 10 March (Local, Regional, Global became Micro,
  Minor, Major); S1 step guides still use the old names in places.
- S8 calls the third phase Distribution; the owner's spec calls it expansion.
  This document keeps the vendor word when describing the vendor and uses
  `expansion` in our own model, matching
  [[docs/design/hypothesis-and-idea-verdict]].

## Conventions for the own models (P)

All own models run on closed bars only.

- **Bars**: UTC bars with `open, high, low, close, volume`. First experiment
  data: OKX perpetual 1H bars, and UTC daily bars resampled from 1H. OKX
  native daily bars open at 16:00 UTC and must not be used directly. Perpetual
  volume must use the coin-quantity column, not contracts.
- **Causality**: a value stamped at bar `t` uses only bars `<= t`. A swing
  pivot that needs `k` bars on its right is known only from bar `t_pivot + k`;
  it may be drawn at its origin but every signal, anchor and zone built on it
  is stamped at the confirmation bar. Backfilling an accumulation from an
  anchor to the confirmation bar is allowed because only data up to the
  confirmation bar is used.
- **ATR**: Wilder-style ATR with `n = 14` unless a rule says otherwise.
  Warm-up bars produce `NaN` and no signal.
- **Ties and equality**: left side strict, right side non-strict for pivot
  detection (the first of equal highs wins). Level crossings are close-based
  and strict (`close > level`).
- **Zero or missing**: zero volume bars add nothing to volume-weighted
  sums and are flagged. Zero denominators give `NaN`, never `0`. Maintenance
  windows (for example OKX on 2022-12-18, 09:00 to 17:00 UTC, nine bars with
  zero volume) are kept and flagged, not interpolated.
- **Same-bar ordering**: if a bar's range touches two events and the order
  inside the bar is unknowable from OHLC, the state is `order-unknown`. It is
  never counted as a success.
- **Parameters** are listed with every definition and are P defaults. They
  are placeholders for pre-registration, not vendor facts and not optimised.
- **Naming**: every own model has a versioned id that is stored in the
  Hypothesis criteria and hashed with them.

## Component notes

Ids `c1` to `c10` come from the decomposition. Two vendor modules have no
decomposition id: projections and the liquidity map. They are written up as
`x1` and `x2` and are proposed as extensions of `c1` and `c2`.

### c1: structure, BoS, CHoCH, sweeps (Major and Minor first)

**F**
- Four fractal scales named Micro, Minor, Major, Macro. Each is built from the
  one below it. All come from the current chart timeframe, none from higher
  timeframe data. [S1, S2, S3]
- Swings are said to be found by an adaptive method with no fixed lookback.
  The method is proprietary. [S1]
- BoS is a break in the direction of the existing trend (continuation
  signal); CHoCH is a break against it (possible reversal). A liquidity sweep
  is a breach that fails to hold and reverses inside an ATR buffer. [S1, S2,
  S3]
- Break and sweep validation has two modes, Validate and Bypass. Validate
  confirms only when price **closes** beyond a volatility-adjusted ATR buffer;
  Bypass shows the event immediately. Each scale has its own ATR multiplier;
  the numbers are not published. [S1, S2, S3]
- Events marked with an asterisk are pending validation. A dashboard keeps up
  to 50 recent events with type, direction, level, price and time. [S1]
- Alerts text: "{depth} {Bullish|Bearish} Break of Structure" and
  "... Change of Character" with a trend-continuation or reversal label.
  [S3]
- Display options for fractal structures: None, Micro, Minor, Major, Macro,
  Minor and Major, Major and Macro, All. [S1]
- The vendor says the engine does not repaint because zones and structure
  update only as swings confirm. [S1]

**U**
- The swing algorithm, how a higher scale is derived from a lower one,
  default ATR multipliers, ATR length, what happens on gaps, equal highs, or
  the very first break (trend undefined).
- Whether Validate is evaluated on close only or also intrabar. S1 says
  "closes beyond", the alert text for sweeps does not say how many bars may
  pass before a failed break is declared a sweep.

**P: `fractal-swing-recursion-v1`**
- Level-0 (Micro) swing pivot high at bar `t` when `high[t] > high[t-j]` for
  `j = 1..k` and `high[t] >= high[t+j]` for `j = 1..k`, with `k = 2`. The
  mirror rule gives pivot lows. Pivots are known at bar `t + k`.
- Alternation: two pivots of the same type in a row keep only the more
  extreme one (equal keeps the earlier). The replacement is allowed until the
  opposite pivot is confirmed.
- Higher scales by recursion: take the alternating pivot sequence of scale
  `s` and apply the same rule with `k = 1` on that sequence to get scale
  `s + 1` (Minor from Micro, Major from Minor, Macro from Major). A higher
  pivot is known when the lower sequence neighbour on its right is known.
  This follows the vendor's stated "each scale from the one below" but is our
  construction and will not reproduce vendor swings.
- Trend state per scale `d_s`: direction of the last confirmed break at that
  scale. Initial state undefined.
- Break up at scale `s`: first bar with `close > H_s + m_s * ATR` where `H_s`
  is the last confirmed swing high of that scale. If `d_s` is down it is a
  CHoCH, if up a BoS, if undefined it is recorded as `initial-break` and
  excluded from BoS and CHoCH statistics. Mirror for breaks down.
- Validate mode default for Minor and Major, `m_s = 0.15` for all scales
  (spec default, P). Bypass uses `m_s = 0` and marks the event unvalidated.
- Sweep: a bar with `high > H_s` whose close is at or below `H_s + m_s *
  ATR`, followed by a close at or below `H_s` within `W = 3` bars before any
  close beyond the buffer. The event is stamped at the bar of the first close
  back at or below `H_s`.
- Gap through a level: the break is evaluated at that bar's close like any
  other bar. Two scales breaking on one bar produce two events.
- Factor signal for `c1`: mean of the signed last-break directions of Minor
  and Major (`+1` up, `-1` down, `0` undefined), held until the next break.

**Data**: OHLC only. Testable in the first experiment.

### c2: zones (order blocks, breaker blocks), proximity guide

**F**
- Zones come from the structure engine and are described as similar to ICT
  order blocks and breaker blocks. All four scales are used. [S1, S2]
- A zone that is broken flips to the opposite role (support becomes
  resistance); a flipped zone that is later broken or mitigated is removed.
  [S1, S3]
- Proximity Guide Line: a reference line outside the zone, enabled by
  default, default multiplier 2.1 times the zone height, styles solid,
  dashed (default) or dotted. Independent multipliers per scale were added in
  September 2025. [S1, S3]
- Zone Layers options: Micro, Minor, Major, Macro, Micro and Minor, Minor and
  Major (default), Major and Macro, all, none. None disables calculation and
  alerts. [S1]
- Structural Depth: Default or Incremented (one level up). [S1, S2]
- Alert events: rejection number n at a zone, retest number n after a break,
  support becomes resistance, reclaimed and removed, proximity entry,
  proximity reaction. [S1, S3]
- All zones come from the current chart timeframe. [S1]

**U**
- How an order block is selected (body or wick, which bar), what counts as a
  rejection, retest or mitigation, how zones cluster, per-scale proximity
  multiplier defaults, what Incremented does to other modules.

**P: `structure-zone-v1`**
- On a confirmed bullish break at scale `s`: zone is the high to low range of
  the last bearish bar (`close < open`) between the origin swing low and the
  breaking bar. If none exists use the origin swing low bar. Bearish break
  mirrors. The zone is known at the confirmation bar.
- States: `active`; `touched` (a later bar range intersects the zone);
  `rejected` (touched and the close is back outside on the originating side;
  count increments); `broken` (close beyond the far boundary by `0.15 * ATR`),
  which flips the zone to a breaker of opposite role; `removed` (a breaker is
  closed through again, or its flip is reclaimed).
- Proximity line distance = `2.1 * zone height` (the only vendor-published
  number) from the near boundary. Zero-height zones use one tick.
- Factor signal for `c2`: signed distance from close to the nearest active
  zone mid, in ATR units, clipped to `[-5, 5]`, sign positive when the nearest
  zone is support.

**Data**: OHLC only.

### c3: trend and range state (trailing stop layers)

**F**
- A "smart 3-tier" trailing stop with volatility-adjusted layers at several
  sensitivity tiers. Five regimes: bullish bias, potential bullish shift,
  ranging or transitioning, potential bearish shift, bearish bias. [S1, S2]
- Inputs: Length ("lookback", responsiveness) and Factor (margin between
  layers and price). Colours cyan, orange, gray by default. No defaults are
  published. [S1, S2]
- Layers: short as dots, mid as a thicker band, long as background shading.
  The mid band is the "primary signal zone". [S1]
- Changes are confirmed after the candle closes. Each transition is tagged
  with volume context (S1: spike, very high, low; S2: low, moderate, high,
  very high, spike). [S1, S2, S3]

**U**
- Formulas, number of layers' parameters, the exact rule mapping layer
  alignment to the five regimes, defaults.

**P: `atr-three-layer-trail-v1`**
- Three ATR trailing layers, each with ATR length `L = 14` and factors
  `0.5F, 1.0F, 2.0F`, `F = 3.0`. Each layer flips direction when the close
  crosses its stop. The stop only ratchets in its trend direction.
- `align = sum of layer directions`. All up is `bullish`; all down is
  `bearish`. Mixed layers with `align = +1` and close above the lowest stop
  is `potential-bullish`; `align = -1` mirrors. Mixed layers with the close
  between the lowest and highest stop is `ranging`.
- Factor signal for `c3`: ordinal `+2, +1, 0, -1, -2` for the five states.

**Data**: OHLC only.

### c4: volume activity (time-adjusted); CVD and open interest

**F (volume activity)**
- Each bar's volume is normalised by how much of the bar has elapsed and
  scored against historical averages; classes colour the candles. Thresholds
  are "proprietary". Spike markers and a spike alert exist. Values lock when
  the bar closes. [S1, S2]
- Volume source: selected instrument only, or combined spot and perpetual
  for crypto pairs that share a base name, USD, USDT and USDC. [S1, S3]
- Liquidity Radar and Pivot Matrix reuse the same time-normalised
  participation logic (March 2026 and 26 January notes). [S-ts]

**F (CVD and OI)**
- CVD is the running net of buy and sell pressure and is computed from lower
  timeframe data. OI is perpetual open interest and is crypto only. Visible
  Length changes how many bars are drawn, not the computation. [S1, S3]
- Dashboard flow cells: Volume, Volume Delta, OI Delta, each classed spike,
  very high, high, moderate, low, plus a premium index (perpetual minus
  spot). [S1, S2]

**U**
- Baseline window, class thresholds, how CVD classifies lower-timeframe
  volume, reset behaviour, OI data source and units.

**P (activity): `volume-ratio-v1`** (testable)
- `r[t] = volume[t] / mean(volume[t-20..t-1])`. Closed bars only, so the
  vendor's elapsed-time adjustment is not needed. Spike when `r >= 2.0`,
  high `1.3 <= r < 2.0`, low `r < 0.7` (spike value is the spec default;
  the rest are P). Bars with zero baseline are `NaN`.
- Factor signal for `c4`: `r[t] * sign(close - open)`, winsorised at 5.
- Use coin quantity, never contract count, for perpetuals.

**P (CVD and OI)**: not testable in the first experiment. Closed-bar
approximations of CVD from OHLCV exist (signed volume by close location) but
they are an estimate and must be labelled `estimated-cvd` and not stand in
for trade-side CVD. True CVD needs taker or trade-side data and OI needs an
open-interest series. A public OKX source may exist for both; it was not
verified in this session and history depth is unknown.

### c5: anchored VWAP and deviation bands

**F**
- Five anchor types: swing-anchored, user-anchored, session-anchored (Asia
  Tokyo, Frankfurt, London, New York, NYSE cash), time-anchored (day, week,
  month, quarter) and range-anchored (reset on new high or low of day, RTH,
  week, month, plus Initial Balance since 13 January). [S5, S-ts]
- Swing VWAPs anchor to confirmed swings, several can be active at once,
  and each stays active until price closes beyond it with volatility-adjusted
  acceptance. The structure depth is selectable. [S5]
- Only the user-anchored VWAP has deviation bands, in three modes:
  symmetric, asymmetric (upside and downside deviation separately) and hybrid
  (symmetric inner, asymmetric outer). [S5]
- Intraday-only features warn on higher timeframes (13 March note). [S-ts]

**U**
- Source price, the variance definition, the acceptance rule, band
  multipliers, the cumulative-volume treatment of zero-volume bars.

**P: `anchored-vwap-v1`**
- `VWAP[t] = sum(v * hlc3) / sum(v)` from the anchor bar to `t`.
- Time anchors: UTC day, ISO week (Monday 00:00 UTC), month, quarter. Session
  anchors use fixed UTC opens documented in the Hypothesis criteria.
- Swing anchors: the pivot bar of a confirmed swing at the chosen scale. The
  VWAP is usable from the confirmation bar. A swing-high VWAP is removed when
  a close exceeds it by `0.5 * ATR`; a swing-low VWAP mirrors.
- Variance: `E_v[p^2] - VWAP^2`. Symmetric band at `z * sigma`. Asymmetric
  uses separate volume-weighted deviations for bars at or above and below the
  VWAP. Hybrid is not implemented in the first version.
- Factor signal for `c5`: `(close - VWAP) / sigma`, `NaN` when `sigma = 0` or
  cumulative volume is zero. First test uses the UTC-week anchor and one
  confirmed-swing anchor.

**Data**: OHLCV. Session anchors on 1H are testable; swing VWAP needs c1.

### c6: pivot points and CPR

**F**
- Six pivot models: Camarilla, Directional, Fibonacci, Swing, Traditional,
  Woodie. Auto reference timeframe from the chart, with weekly and monthly
  overlays. [S6]
- CPR is the session fair-value zone. A narrow CPR is described as signalling
  compression and likelier breakout, a wide one as expansion already under
  way; states Narrow, Normal, Wide, Inverted were added on 23 January. Price
  above the top central pivot is bullish acceptance, below the bottom is
  bearish acceptance, between is contested. [S6, S-ts]
- Also in Pivot Matrix: previous higher-timeframe OHLC, pivot highs and lows,
  ADX and DMI directional flow, a mean proximity state with five classes,
  logistic EMA trend line, Ichimoku cloud projection, linear regression
  channel, a CPR-based sentiment meter, range and ATR state (expansion,
  balance, compression) and a Market Drivers panel. [S6, S-ts]
- Directional pivots adapt the base level to open versus close and project
  continuation and exhaustion levels. [S-ts]

**U**
- Narrow, Wide, Inverted thresholds; logistic transform; mean proximity
  definition; directional pivot formula.

**P: `cpr-v1`** (formulas for the classic models are public; vendor-specific
models are excluded)
- Reference period: the previous completed UTC day for 1H bars; the previous
  completed ISO week for daily bars. It is complete before the first bar that
  uses it, so there is no lookahead.
- `P = (H + L + C) / 3`, `BC = (H + L) / 2`, `TC = 2P - BC`. Width
  `= |TC - BC| / P`. Traditional levels `R1 = 2P - L`, `S1 = 2P - H`,
  `R2 = P + (H - L)`, `S2 = P - (H - L)`.
- `Inverted` when `TC < BC`. `Narrow` when width is at or below the 20th
  percentile of the previous 100 reference periods, `Wide` at or above the
  80th, otherwise `Normal` (percentile cut-offs are P).
- Factor signal for `c6`: `+1` if close above `max(TC, BC)`, `-1` if below
  `min(TC, BC)`, else `0`, with the CPR state kept as a covariate.

**Data**: OHLC only.

### c7: PO3 stage

**F**
- Three phases: accumulation, manipulation, distribution. Quality of each is
  scored: how often price tried to leave the range and failed, volatility
  contraction, per-side liquidity estimated from touches, wick rejection,
  failed closes and volume concentration, sweep class by depth, speed and
  duration, distribution strength from range and volume expansion, velocity,
  acceptance and follow-through, a volume profile with point of control and
  value area, delivery efficiency, and two higher timeframes blended with the
  larger weighted more. [S8]
- PO3 Expectation evolves during accumulation and manipulation and freezes
  when distribution starts. PO3 Score is meaningful only once distribution is
  under way. Labels: Watching, Candidate, Confirmed, Failed; grades A+ to D.
  [S8]
- The vendor says it is a probabilistic framework and not a prediction
  model, and that volume profile and liquidity are estimates from price and
  volume, not order-book data. [S8]

**U**
- Every threshold and weight, the probability model, value area definition,
  how HTFs are chosen, how failures are decided.

**P: `po3-box-v1`** (phase state and a frozen snapshot only; no probability)
- Accumulation box: a window of `N = 24` bars on 1H, or `N = 10` on daily
  bars, in which `max(high) - min(low) <= 3.0 * ATR(14)`. The box is
  `[L, H]`.
- Manipulation: after the box, a bar with `high > H` (up-sweep) or `low < L`
  (down-sweep) with excursion `<= 1.0 * ATR` and a close back inside the box
  within `W = 3` bars. The sweep direction is recorded and the expansion
  direction is the opposite.
- Expansion (our word for the vendor's distribution): a close beyond the
  opposite box boundary by `0.25 * ATR` within `E = 12` bars of the return
  close. It is `candidate` when only the sweep exists and `confirmed` on the
  expansion close. `failed` if a close beyond the sweep extreme comes first, or
  on timeout.
- At confirmation the model freezes: box, sweep extreme, direction, target
  (box height projected from the broken boundary) and invalidation (sweep
  extreme). Later evaluation never edits the frozen record. A bar touching
  target and invalidation together is `order-unknown`.
- Factor signal for `c7`: `+1` or `-1` by the frozen direction at
  confirmation, held for `h` bars, else `0`.

**Data**: OHLC only. The vendor probability, volume profile and nested HTF
parts are not reproduced.

### c8: zone-touch bounce and structure-break continuation (events)

**F**: the vendor supports these as ideas, not as measured rates. BoS means
"likely continuation", rejection counts and retest counts are logged, and
sweeps are said to often precede reversals. No rates are given. [S1, S3]

**P**: outcome definitions for later Event Lane work (slice F, currently
`event-definition-unsupported`): triple barrier on the next `H` bars with
`+1 ATR` target, `-1 ATR` stop, reported with the envelope in
[[docs/design/event-study-honesty-envelope]].

### c9: CVD and OI, premium index, positioning regimes

**F**: see c4 (CVD and OI). The free PFI script names four regimes (long
buildup, short buildup, short covering, long unwinding) from price and OI
z-scores, three selectable flow models, and a bounded index of minus 100 to
plus 100. Signal strength is a geometric mean of capped participation and
confirmation z-scores. Flow signals are confirmed only at bar close. [S-pub]

**Data**: needs open interest and trade-side volume. `untestable` here with
reason `data-non-ohlcv`, as in the decomposition.

### c10: macro dashboard slots

**F**: 17 indicators in five groups (global M2, federal funds rate, reverse
repo, CPI, PPI, real GDP growth, 10 year and 2 year yields, the 10Y minus 2Y
spread, DXY, VIX, an uncertainty index, SPX, NDX, gold, WTI, BTC), each with
short, mid and long-term trend state; an anomaly alert for statistically
unusual readings; a regime alert when the three horizons align; M2 drawn
with a forward offset; chart overlay needs a daily timeframe or higher. [S9,
S-ts]

**U**: horizon lengths, anomaly statistic and threshold, offset length,
exact TradingView symbols.

**Data**: external series intake. `untestable` here with reason
`data-non-ohlcv`.

### x1: structure breaks and projections (targets, lifecycle, invalidation)

**F**
- Tiers Minor, Major, Macro; a higher active tier takes priority; a
  "best available" mode picks the tier with most directional influence. [S4]
- Lifecycle: emerging, developing, confirmed, extended, primary target,
  exhaustion; and pullback, risk, invalidated. Two separate metrics:
  progress toward objectives and exposure relative to origin and
  invalidation. Projections are removed on invalidation. [S4, S-ts]
- Targets come from "the geometry of the broken structure"; levels adapt
  for linear or log price scale. [S4, S-ts]
- Early Structure Context is a low-weight, optional pre-confirmation layer.
  [S4]

**U**: target formula, state thresholds, risk zones, tier arbitration.

**P: `break-projection-v1`**
- After a confirmed break at scale `s`: break level `Lv`, origin swing `X`
  (the swing that began the leg), leg `= |Lv - X|`. Targets: `T1 = Lv + 0.618
  * leg`, primary `Tp = Lv + 1.0 * leg`, extended `Te = Lv + 1.618 * leg`
  (mirror for down). Invalidation: close beyond `X - 0.25 * ATR` (up case).
- Progress `p = (close - Lv) / (Tp - Lv)`. Emerging `p < 0.2`, developing
  `0.2 <= p < 0.5`, confirmed `0.5 <= p < 0.8`, extended `0.8 <= p < 1`,
  primary at `p >= 1`, exhaustion at `p >= 1.618`. Pullback when `close < Lv`;
  risk when `close < Lv - 0.5 * (Lv - X)`; invalidated at the rule above.
  State thresholds are P and are exactly the numbers a Hypothesis must
  pre-register.
- Same-bar target and invalidation: `order-unknown`.

**Data**: OHLC only. A candidate extension of `c1` and of the strategy `c11`.

### x2: liquidity map and grab markers

**F**
- Levels where stops and resting orders are likely to be, built from
  "volume and price activity"; clusters as magnet zones; sparse areas as
  rapid-move zones; a profile that aggregates levels into a density curve;
  markers where liquidity was swept; a dashboard with the nearest untouched
  levels above and below as a percentage; at most 500 horizontal lines.
  [S7, S-ts]
- The vendor text calls the levels estimates and says a sweep does not
  imply a reversal. [S7]

**U**: how levels are generated, clustering rule, density weighting.

**P: `swing-cluster-v1`**
- Candidates: confirmed swing highs and lows at Minor and Major, plus equal
  highs or lows within `0.1 * ATR`. Weight `= volume at the swing bar /
  baseline volume`.
- Cluster candidates within `0.5 * ATR`. Density = sum of weights. Nearest
  untouched level above and below with percentage distance. A level is
  `swept` when a bar's wick passes it; `grabbed` when the close is back on the
  original side.
- Factor signal: log ratio of density above to density below within `5 *
  ATR`.

**Data**: OHLCV. Labelled an estimate, as the vendor does.

### c11: the bundle as a rule

The vendor's central claim is confluence: a setup with structure, bias and
flow aligned differs from one with a single signal. [S2] The testable form is
an incremental one, not a score. See "usefulness claims", row U-1 and
[[docs/design/hypothesis-and-idea-verdict]] for the equal-weight combiner and
the paired delta rule. Components that need non-OHLCV data stay out of the
first bundle.

## What the vendor claims about usefulness

None of these claims is backed by published numbers on any page read. All are
**unverified**. Each one has a falsifiable form: claim, metric, baseline,
horizon. Horizons are in bars of the stated data (1H, or UTC daily). The
baselines are always the matched-regime buy-and-hold or an unconditional
rate.

| Id | Vendor claim (paraphrase, source) | Component | Falsifiable form | Testable now |
| --- | --- | --- | --- | --- |
| U-1 | Confluence of structure, bias and flow beats any single signal; "no signal means anything in isolation". [S2] | c11 | Claim: adding component B to A raises forward-return rank IC. Metric: paired delta of validation rank IC (HAC interval). Baseline: A alone and a price-only baseline. Horizon: 1, 6, 24 bars on 1H. | yes for OHLCV parts |
| U-2 | A BoS signals likely continuation. [S1, S3] | c1 | Claim: after a confirmed BoS, forward return in the break direction is above the unconditional rate. Metric: hit rate with Wilson interval, mean return. Baseline: unconditional rate on matched volatility regime. Horizon: 6 and 24 bars. | yes |
| U-3 | A CHoCH signals possible reversal. [S1, S3] | c1 | Same as U-2 but the sign is against the prior trend. A rate no different from baseline refutes it. | yes |
| U-4 | Liquidity sweeps (failed breaks inside the ATR buffer) mark traps and are followed by reversal. [S1, S3] | c1 | Claim: after a sweep the next 6 bars move opposite to the sweep more often than baseline. Metric: hit rate with interval. Baseline: breaks that held. | yes |
| U-5 | ATR validation improves break quality. [S1] | c1 | Claim: validated breaks have higher continuation rate than bypassed ones. Metric: difference in hit rate with interval. Baseline: bypass mode events. | yes |
| U-6 | Macro-scale CHoCH is rare and often precedes major trend transitions. [S1] | c1 | Claim: forward 24 and 120 bar drift after Macro CHoCH differs from baseline. Likely too few events; the envelope will withhold it. | likely withheld |
| U-7 | Major and Macro zones give higher-probability setups; counter-trend entries into Macro zones should be avoided. [S1] | c2 | Claim: reaction rate (bounce within 6 bars) at Major and Macro zones exceeds Minor zones and baseline touches. | yes |
| U-8 | Overlapping zone clusters are high-activity areas. [S1] | c2 | Claim: touches of clustered zones show higher reaction rate than isolated ones. | yes |
| U-9 | A broken zone flips role; a flipped zone is later respected. [S1, S3] | c2 | Claim: retest of a flipped zone reacts in the flip direction more often than baseline. | yes |
| U-10 | The trailing stop regimes separate trending from ranging and filter chop. [S1] | c3 | Claim: forward absolute return and trend persistence differ by regime; bullish bias has positive forward return. Metric: rank IC and mean return by regime. Baseline: unconditional. | yes |
| U-11 | Transitions backed by high volume are higher conviction than low-volume ones. [S1] | c3 and c4 | Claim: forward return after a flip with volume ratio above 2 exceeds low-volume flips. | yes |
| U-12 | Volume spikes mark engineered liquidity runs, traps, or momentum starts; low-volume bullish bars in a trend may signal exhaustion. [S1] | c4 | Claim: forward return after a spike differs from baseline in a sign-dependent way; low-volume up bars precede weaker returns. | yes |
| U-13 | CVD-price divergence signals absorption or reversal. [S1] | c9 | Needs trade-side data. | no (`data-non-ohlcv`) |
| U-14 | OI direction with price distinguishes new longs, new shorts and closing positions; this separates real breakouts from fakeouts. [S1, S-pub] | c9 | Needs OI. | no |
| U-15 | Alignment of price, OI and CVD raises trend confidence; disagreement reduces it. [S1] | c9 | Needs OI and CVD. | no |
| U-16 | Crowded liquidation levels "often attract price". [S2] | x2 and the leverage module | Claim: price reaches the nearest dense estimated level before the opposite one more often than 50 percent. Baseline: random level of equal distance. Note U contradiction on how the levels are built. | partly (estimate only) |
| U-17 | Targets from a confirmed break are a high-probability draw once the projection is developing; the engine orders states emerging to exhaustion. [S4] | x1 | Claim: from state developing, probability of reaching `Tp` before invalidation exceeds the base rate for the same leg size; state order predicts ordering of outcomes. Metric: hit rate with interval; Kaplan-Meier time to target. | yes |
| U-18 | Structure-anchored VWAPs act as dynamic support or resistance until accepted through. [S5] | c5 | Claim: touches of a swing VWAP react more often than touches of a random time-shifted line with the same slope. | yes |
| U-19 | Price above the weekly VWAP favours longs, below favours shorts. [S5] | c5 | Claim: forward return sign agrees with the side of weekly VWAP. Baseline: unconditional drift. | yes |
| U-20 | Inner deviation bands are mean-reversion zones; outer bands mark exhaustion. [S5] | c5 | Claim: forward return after touching the band is toward VWAP more often than baseline. | yes |
| U-21 | Narrow CPR raises breakout probability; wide CPR favours rotation. [S6] | c6 | Claim: day range and breakout rate differ by CPR state. Metric: realised range over ATR and break rate with interval. | yes |
| U-22 | Price above the top CPR is bullish acceptance, below bottom bearish. [S6] | c6 | Claim: forward day return by CPR position differs from baseline. | yes |
| U-23 | An overextended market reaching a pivot has compounded reversion pressure; a reaction in a trending state holds. [S6] | c6 and c3 | Claim: reaction rate at pivots is higher when mean proximity is overextended; interaction with regime. | partly (needs mean proximity definition) |
| U-24 | Zones targeted by liquidity are magnets; sparse areas move faster. [S7] | x2 | Claim: speed (bars to cross) is shorter through low-density bands than high-density bands. | yes (estimate) |
| U-25 | High PO3 quality sequences differ from ordinary consolidation; a high Expectation followed by a low Score means a failed setup. [S8] | c7 | Claim: after a confirmed `po3-box-v1` event the forward move in the frozen direction exceeds baseline; frozen expectation features predict realised score. The vendor probability model is not tested. | yes (phase only) |
| U-26 | Full macro alignment across horizons "carries high predictive weight"; price and macro overlay divergences resolve toward macro; anomalies precede shifts. [S9] | c10 | Needs external series. | no |
| U-27 | Auction acceptance supports continuation and failed auctions revert toward balance (free IB script). [S-pub] | extension | Needs intraday IB sessions; not in the first plan. | later |
| U-28 | Higher-volume price levels act as support or resistance (volume profile pages). [S-pub] | extension | Claim: touches of the high-volume node react more than random levels. | later |

Explicit non-claims worth recording: the vendor repeatedly states that its
tools do not predict, give no guarantee, and that PO3 outputs are "analytical
confidence rather than a trading signal". These statements are consistent
with our verdict vocabulary: a `supported` result is never a promise.

## Open U items

1. Swing engine: algorithm, parameters, handling of ties and gaps.
2. ATR length and per-scale multipliers for break validation and sweeps.
3. Number, parameters and mapping rules of the three trailing layers and the
   five regimes.
4. Order-block selection, rejection, retest and mitigation definitions;
   per-scale proximity multiplier defaults.
5. Volume activity baseline and class thresholds (two class lists conflict).
6. CVD classification and reset rules; OI source and units.
7. Evaluation anchor option list and its fallback (S1 and S2 disagree).
8. VWAP acceptance rule, source price, variance and band multipliers.
9. CPR state thresholds, mean proximity definition, directional pivot
   formula.
10. Liquidity map generation, clustering and density weighting.
11. Projection target formula, state thresholds, tier arbitration.
12. PO3 thresholds, weights, probability model and value-area rule.
13. Macro horizons, anomaly statistic, offset lengths, TradingView symbols.
14. Leverage module: whether it uses OI at all (S1 is inconsistent) and the
    liquidation formula beyond "isolated margin, full allocation, no fees or
    funding".
15. Whether any component's claims have been measured by anyone; no page
    publishes statistics.

## Implications for the first experiment

- Testable on OKX perpetual 1H and UTC daily OHLCV with own models: c1 to c7
  and the extensions x1 and x2. Their definitions above are fixed enough to be
  pre-registered in a Hypothesis; the parameters listed are the starting
  criteria, and changing them after the first Session is a new Hypothesis
  revision, as the verdict design requires.
- Not testable here: c8 as an event (until the Event lane takes new
  definitions), c9 (CVD, OI) and c10 (macro) because of data. They stay as
  recorded `untestable` Hypotheses with reason codes.
- The statistical risk is multiplicity: roughly 28 claims above times several
  horizons, both assets and two bar sizes. The research-family accounting and
  the Project-level hypothesis count `M` in the verdict design are what keep
  the result honest. Claims U-2 to U-5 share one event definition and should
  be pre-registered together.
- Every own model above must be stored with its version id, parameters and
  hash in the Hypothesis criteria, and none may be described as the vendor's
  formula.
