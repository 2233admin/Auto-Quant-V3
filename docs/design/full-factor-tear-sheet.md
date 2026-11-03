# Full Factor tear sheet

Issue #9. Related: [[docs/design/factor-diagnostics]],
[[docs/design/factor-evidence-explorer]], [[docs/design/study-run-evidence]],
[[docs/design/research-selection-integrity]].

## Frozen authority and compatibility

New Factor template Judges publish `factor-tear-sheet.json` (kind
`factor-tear-sheet`). The envelope and evidence each carry `schemaVersion: 1`;
the envelope binds `inputHash`. Run metrics contain `factor_tear_sheet`, the
same evidence without full paths. Publication does not change any objective,
qualification, KEEP/REVERT logic, or legacy tertile artifact.

Optional Study `judge.quantiles` accepts exactly integer 3, 5 or 10. CLI:
`aq study create ... --quantiles 5`. It participates in Study identity and
cannot be tuned inside a Session. Absence serializes exactly as before and
means 3; no old manifest or Run is rewritten. Study loading refuses an
explicit count larger than the dataset universe; the Judge also checks the
actual request-bound prediction population. New Projects copy the new template
Judge; pinned Project Judges do not change. A separate Study can explicitly
use a newly copied Judge entrypoint. Imported computation belongs to the
content-hashed Harness runtime, following the validation-pair precedent.

## Bins, units and sample counts

Each primary-horizon, split-purged close pairs finite factor/outcome values,
stably sorts by factor (ties retain canonical asset-column order), then uses
`numpy.array_split` into Q approximately equal-name groups. N=1 is the minimum
members per group; at least Q distinct scores are also required. A deficient
bar is refused as a whole, counted in `refusedBars`, and never filled or
silently reduced to fewer bins. Singleton bins are explicitly disclosed.

`quantileMeans` equally averages the per-bar equal-name group means.
`meanTurnover` averages `|current names minus previous names| / |current names|`
for each group, including changing observed universes. The first bar of a
split or after refused grouping has null turnover; no cross-split transition
is used. This is different from the legacy absolute-percentile-rank-change
`mean_rank_turnover`. Every summary carries its own finite-bar observation
count; fewer than 20 sets `shortSample`. Twenty is a disclosure threshold,
not a claim of statistical sufficiency or a verdict gate. Empty means stay
null with zero observations.

Full-history group and top-minus-bottom return indices compound `1 + outcome`
at each eligible bar, independently starting at one inside each split. A
return <= -1 invalidates the subsequent curve instead of clipping it. For
primary horizons above one, overlapping windows are compounded each bar:
these are descriptive indices and can overstate investable growth. Refused
bars are absent, not zero-return observations. Sampling follows full-history
calculation. Neither annualized rates nor investable Portfolio NAV is claimed.

Forward-realized-volatility Runs retain their request-bound risk outcome for
group means and IC. Studio does not draw return indices or long-short returns
for them. Temporal evaluation explicitly returns `protocol-unavailable` with
`cross-sectional-population-required`; it never invents one-name cross-sections.

## Costs and long-short meaning

Gross spread is the top group's primary-horizon mean return minus the bottom
group's. Target weights are equal +1 funded unit in the top and -1 in the
bottom, two units gross (not the analyzer factor-weighted portfolio).

An exact fixed Study dependency `strategies/portfolio-mandate.json` supplies
the cost model when present. Otherwise an exact fixed Study Research Request
may explicitly supply `portfolioPolicy.baseCostBps` under the same existing
linear-notional contract. Supported policy is `linear-traded-notional-v1` and
the mandate's frozen `implementationPolicy.baseCostBps`; no ambient mandate or default
10 bps may be inferred. No model means `costModel: null`, null net values,
and the explicit UI state “No cost model”. An explicit zero-bps model is
different and produces net equal to gross.

Per rebalance: `tradedNotional = sum(abs(target - previousTarget))` and
`net = gross - tradedNotional * baseCostBps / 10000`. Opening costs are charged
from cash (two units notional); there is no terminal liquidation. After a
refused bar, target history resets. This is a linear target-change diagnostic:
no drift, no-trade band, impact, borrow, financing, fills or executable book is
modeled. Multi-bar outcomes overlap while cost is charged once per rebalance.
These limits stay visible beside the curve. The rate is reused from the fixed
Study, not a claim that the Factor diagnostic reproduces Portfolio accounting.

## Decay, persistence and reference methods

H is `max(researchHorizon.diagnosticForwardBars)`, including the canonically
added primary horizon. The new diagnostic covers every integer horizon/lag
1..H without changing the existing fixed horizon profile or its five-horizon
request limit.

IC decay is mean per-bar cross-sectional Spearman correlation at each forward
horizon, using average ties, at least four finite paired names, the exact
request-bound outcome, and horizon-specific 60/20/20 boundary purge. Horizons
therefore have different eligible populations. Rank autocorrelation ranks
each observed cross-section first, shifts by lag within the split's observed
union clock, Pearson-correlates rank vectors on at least four common names,
and averages finite bars. Both endpoints stay inside the same split; missing
names are never filled. Persistent ranks do not establish predictive quality.

Formulas follow [jqfactor_analyzer performance.py](https://github.com/JoinQuant/jqfactor_analyzer/blob/master/jqfactor_analyzer/performance.py)
and [Alphalens-reloaded performance.py](https://github.com/stefan-jansen/alphalens-reloaded/blob/main/src/alphalens/performance.py).
Independent parity tests cover 5/10 equal-size groups, group returns, turnover,
rank autocorrelation and IC decay within 1e-9. Intentional differences:
Core retains ordinal `array_split` bins rather than value-boundary `qcut`, raw
outcomes rather than default demeaning, independent split purges rather than
cross-split history, and unannualized statistics. Core's existing HAC inference
is unchanged; these curves have no new inferential or selection authority.

## Reader and Studio

`aq run factor --json` exposes `tearSheet`. Immutable Run verification happens
before confined artifact reading. The reader requires a unique paired
artifact/metric, exact schema/input/Study quantile/horizon/outcome identity,
32 MiB file bound, 100,000 rows per split, finite values, complete group/lag
axes, chronological primary-horizon purged paths, and consistent counts,
spread, net cost, cumulative curves and summary means. Full paths validate
before deterministic per-split thinning (40–400 points), retaining endpoints.
Malformed new evidence fails closed. Legacy absence returns `not-published`
and “Not published by this Run's Judge”, without recomputation or error.

The Factor Evidence tab shows six workbench FigureCards: group means, all
group cumulative indices, gross/net spread, group turnover, IC decay and rank
autocorrelation. Each has a takeaway, metric-catalogue help and a data table.
The existing test-audit gate applies before values, captions, tables or split
controls are read; validation is the default. Charts use neutral strokes and
line patterns. Labels and definitions are English/Chinese; evidence numbers
come exclusively from the published read model.
