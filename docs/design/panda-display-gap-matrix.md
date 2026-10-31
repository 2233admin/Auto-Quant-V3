# Panda display gap matrix

Status: research note, 2026-11-01. Read-only audit; no code changed.

Related: [[docs/design/pandaai-reference-notes]],
[[docs/design/studio-local-actions]],
[[docs/design/factor-evidence-explorer]],
[[docs/design/portfolio-decision-explorer]],
[[docs/design/session-decision-matrix]], and [[docs/STUDIO]].

## Scope and method

[[docs/design/pandaai-reference-notes]] sections 5c to 5g and the captures in
`D:\tmp\panda\` (factor-result, ai-opt2, ai-opt3, bt1, tune2, tune3, sim1,
mkt1, mkstrat) list every data display the reference product shows. This note
takes each display as one row and answers: what does AutoQuant publish today,
does the new Studio (`studio-app/`, served at `/`) draw it, and what is the
smallest change to ship it. It describes methods and information design only;
nothing here copies the reference product's look, text or marks.

Evidence was gathered from the code and from real payloads:

- Workspace `D:/tmp/aq-exp/ws4` (Factor only; Project `ctx-volspike-btc`,
  4 crypto assets, 2 Runs, 1 Session) served with `aq studio serve --port 8850`.
- Repository root Workspace (Project `sample-research-desk`, 19 Runs, Factor
  plus Portfolio explorers present; RL, Book Risk, Allocation, Event Study and
  Book Path Stress explorers are `null`) served with `--port 8851`.
- Payloads read from `/api/v1/snapshot`. Both servers were stopped afterwards.
- Line numbers refer to the working tree on 2026-11-01. `autoquant/studio.py`
  has uncommitted edits in that tree, so its line numbers can drift by a few
  lines against the last commit.

Column vocabulary:

- Studio now: yes, partial, or no, with the page. Pages of the new Studio are
  Projects, Project, Factor evidence (`view=factor`), Run (`view=run`), Compare
  (`view=compare`) and Event Study (`/projects/<id>/event-study`). "Legacy" is
  the fallback Studio at `/legacy` (`autoquant/studio_assets/studio.js`, 5808
  lines), which still draws every lane the new Studio does not.
- Root cause when "no": not drawn yet; server does not publish; lane not
  migrated to the new Studio; needs new Core computation; out of scope.
- Effort: S = under a day, frontend or one field; M = a few days, one Core
  projection plus a page; L = a week or more, new artifact or new lane.
- Value: for the north-star question "I bring an idea or factor, does it hold".

Key facts that shape every row:

1. The Factor lane has three fixed quantile groups (low, middle, high), not
   five, and none at all for single-asset temporal factors. The BTC Project
   reports `quantileEvidence.status = protocol-unavailable` with reason code
   `temporal-tertiles-not-defined`, `quantilePath.points` empty.
   Source: `autoquant/factor_explorer.py:1176` (`_parse_quantiles`), `:3501`
   (`_quantile_summary`), `:3550` (`_quantile_evidence`).
2. `quantilePath` is already published (`factor_explorer.py:3791`
   `_paths`, `:4247`) but is sampled to the IC path timestamps (180 of
   `totalRows`) and the new Studio never reads it. Only the legacy bundle does
   (`studio.js:2003` `renderFactorChart`, `quantilePath` at `:2014`).
   A cumulative curve built from a sampled path would be wrong, so a real group
   curve needs a full-resolution series.
3. Portfolio evidence is rich (growth curves, drawdown, exposure, book,
   transitions, episodes) but the new Studio has no Portfolio page; `Project.tsx`
   lists it under "Other lanes" with a link to `/legacy`
   (`studio-app/src/pages/Project.tsx:265`).
4. There is no price, OHLCV, order book or account-ledger endpoint. The Studio
   API is `health`, `snapshot`, `workspace`, `project`, `run` plus the
   opt-in `--allow-actions` routes (`autoquant/studio.py:2327` to `:2420`).

## Matrix A. Factor result page

| Item | Reference shows | AutoQuant source today | Studio now | Root cause if no | Smallest change (files) | Effort | Value |
|---|---|---|---|---|---|---|---|
| Group cumulative return chart, 5 groups plus 2 long-short spreads | Seven lines over the window; legend per group; the page's centrepiece | Only 3 groups. Full per-day rows live in the `factor-quantiles` artifact (parsed at `factor_explorer.py:1176`); payload `quantilePath.points[]` has `low/middle/high/highMinusLow` per horizon but sampled to 180 dates (`:3791`). Real value on sample Project: 3 buckets | no (legacy only, `studio.js:2003`) | not drawn yet for sampled rows; needs new Core computation for a correct cumulative curve (compounding a sample is invalid); not defined for single-asset factors | Core: add a `quantileCurve` field to the Factor payload (cumulative h=1 low/middle/high and high-minus-low, split-tagged, evenly down-sampled after compounding) in `factor_explorer.py` `_paths`/`_load_factor_diagnostics_unlocked` (`:3861`), schema entry, test. Frontend: new chart in `studio-app/src/pages/FactorCharts.tsx`, mount in `Factor.tsx` section "Quantile returns". Show an explicit Empty state for temporal factors | M | high |
| Mean return by quantile (static bars) | Not a separate reference item, but the nearest thing we have | `quantileSummary[]` rows (`low/middle/high/highMinusLow/monotonicity/observations`) per horizon and split, `factor_explorer.py:3501` | yes: Factor page, "Quantile returns" (`FactorCharts.tsx:400` `Quantiles`) | n/a | none | n/a | high |
| Split bands on a time chart (train / validation / test) | Not shown by the reference (no splits) | `icPath.points[].split`, `protocol.splits` | yes: `IcOverTime` (`FactorCharts.tsx:256`) | n/a | none | n/a | high (ours beats theirs) |

## Matrix B. Core metrics grid (each metric separately)

Reference grid: factor return, Sharpe, annualized return, max drawdown, IC
mean, Rank IC, IC std, IC_IR, IR, P(IC < -0.02), P(IC > 0.02), t, p.

| Item | Reference shows | AutoQuant source today | Studio now | Root cause if no | Smallest change (files) | Effort | Value |
|---|---|---|---|---|---|---|---|
| Factor return | Total return of the best/long group over the window | Not found. Closest: `quantileSummary[].high` (mean per-bar forward return, not cumulative) and `highMinusLow` | no | needs new Core computation | Derive from the `quantileCurve` above: add `longShort.totalReturn` summary per split in `factor_explorer.py` | M (shares work with the curve) | med |
| Sharpe (of a group or long-short) | Single number | Not found for Factor. Portfolio has `sharpe` in strategy viability (`portfolio_explorer.py:3321` `_project_performance`) but that is a portfolio, not a factor group | no | needs new Core computation | Same `longShort` block: `sharpe`, `annualReturn`, `maximumDrawdown` computed from the daily high-minus-low series (annualization from the dataset interval). Keep them labelled "gross, no cost" | M | med (reference's own scope caveat applies: best-group stats are not an expectation) |
| Annualized return | Single number | Not found for Factor (see above) | no | needs new Core computation | Same block | included | med |
| Max drawdown | Single number | Not found for Factor | no | needs new Core computation | Same block | included | low |
| IC mean | Mean IC | `summary.validation.meanPearsonIc` and `meanRankIc` (`factor_explorer.py:3408` `_summary`, `:1659` `_ic_summary`); real value on sample Project: Pearson 0.0118, rank -0.0313 | partial: Pearson drawn in horizon table (`FactorEvidence.tsx:367`) and the sign-disagreement check (`:74`); Factor headline shows rank IC only | not drawn yet | Add Pearson IC mean to the Factor headline `stats` list in `Factor.tsx:281` | S | med |
| Rank IC | Mean Spearman IC | `summary.validation.meanRankIc` | yes: Factor headline and Run page (`RunPage.tsx:51`) | n/a | none | n/a | high |
| IC std | Standard deviation of IC | `summary.validation.rankIcStandardDeviation` (0.419 on sample). Pearson IC std not found | no: published, not drawn anywhere | not drawn yet | Add a "IC std" cell to the Run page `SplitRow` and Factor headline (`RunPage.tsx:20`, `Factor.tsx:281`) | S | low |
| IC_IR | Mean / std | `summary.validation.rankIcir` and `pearsonIcir` | yes: Run page headline (`RunPage.tsx:53`) and split table (Pearson IC_IR is published but not drawn) | n/a | Mirror it in the Factor headline | S | med |
| IR (information ratio) | Single number, meaning not stated by the reference | Not found for Factor. Portfolio `informationRatio` exists (`portfolio_explorer.py:3321`) | no | ambiguous definition; skip until the reference defines it | none; do not guess | n/a | low |
| P(IC < -0.02) and P(IC > 0.02) | Share of days with IC beyond a band | Not found. `rankHitRate` is P(IC > 0) only. Full daily IC lives in the daily artifact (`_parse_daily`, `factor_explorer.py:1003`); `icPath` is sampled | no | needs new Core computation (exact counts cannot come from the sampled path) | Core: add `positiveShare`/`beyondBandShare` (thresholds as explicit fields, e.g. 0.02) to `_ic_summary` in `factor_explorer.py:1659`; show in Run page split table | S to M | low (hit rate already covers the question) |
| t statistic | OLS-style t | `summary.validation.hacTStatistic` (HAC, -0.639 on sample) | yes: Factor headline, Run page, folds | n/a | none | n/a | high |
| p-value | Two-sided p | `hacNormalPValue` (0.523 on sample) | yes: same pages | n/a | none | n/a | high |
| Verdict row reading t and p | Absent in the reference (their gap) | `buildVerdict` runs in the browser from the payload (`FactorEvidence.tsx:33`, `VerdictStrip` at `:129`) | yes: Factor page top | n/a | none | n/a | high (our differentiator) |

## Matrix C. Strategy backtest result page

All Portfolio rows below come from the repository-root Project's
`portfolioExplorer` (`autoquant/portfolio_explorer.py:7428`
`load_portfolio_diagnostics`), which the new Studio does not render.

| Item | Reference shows | AutoQuant source today | Studio now | Root cause if no | Smallest change (files) | Effort | Value |
|---|---|---|---|---|---|---|---|
| Net-value curve with benchmark | Equity curve in capital units, dual axis | `portfolioExplorer.path.points[]` with `netGrowth`, `grossGrowth`, `benchmarkGrowth`, `drawdown`, split tag; 180 of 419 rows sampled with accounting anchors (`portfolio_explorer.py:4308` `_path_projection`) | no (legacy `studio.js:3016` `renderPerformanceChart`: net, gross, benchmark, drawdown) | lane not migrated to the new Studio | Frontend only: new route `view=portfolio` in `route.ts`, `pages/Portfolio.tsx`, chart component reusing `FactorCharts.tsx` primitives; add a `portfolio` pointer to `ProjectSnapshot` typing in `api.ts:89`. Note growth is relative to 1.0, not currency (initial capital not published for the path) | M | high |
| Buy and sell markers on the curve | Triangles at fills | `recentTransitions[]` (40 rows, `_recent_transitions` `portfolio_explorer.py:5224`) has `timestamp`, `asset`, `executionAction`; the full decision table is the `portfolio-decisions` artifact (7 artifacts listed under `artifacts`) but only 40 recent rows are published | no | server publishes only a recent window | Core: publish a bounded, date-indexed transition count per sampled point (or all transition dates, capped) in `_path_projection`; frontend draws ticks. Avoid per-trade triangles; use a rebalance tick strip | M | med |
| Core backtest metrics (total return, annualized, max drawdown, Sharpe, Sortino, Calmar, final equity, benchmark return and annualized) | 12-number grid | Net total return and max drawdown in `path.summary` (net 0.1023, MDD -0.1196 on sample); `strategyViability.validation.net` has `totalReturn, annualReturn, sharpe, sortino, maximumDrawdown, informationRatio` and `.benchmark` the same set (`portfolio_explorer.py:3321`). Calmar and final equity not projected (`calmar` is reconciled at `:3278` but dropped by `_project_performance`) | no (legacy summary strip in `renderPortfolioExplorer`, `studio.js:3793`, shows only net return, MDD, cost, turnover) | lane not migrated; Calmar not published | Frontend: metric grid with strategy and benchmark columns per split. Core (S): add `calmar` to `_project_performance` | S frontend, S Core | high |
| Benchmark | Benchmark return and annualized | `mandate.benchmark` (kind, asset, weights) and `benchmarkGrowth`; `strategyViability.validation.benchmark` | no | lane not migrated | Included in the Portfolio page | included | high |
| Positions table with search | Holdings by instrument, searchable, paginated | `currentBook.positions[]` (asset, weights pre/post trade, signal state, contribution, variance share) plus `attribution.validation[]` per asset (`portfolio_explorer.py:5137`, `:4407`). Only the last date; per-date weights are in `path.points[].weights` | no (legacy `studio.js:3681` `renderPortfolioBook`) | lane not migrated | Frontend table with client-side filter; 6 assets in the sample, so search is unnecessary at this scale | S to M | med |
| Trade list (every fill, searchable) | Timeline of fills | Not full. `recentTransitions` has 40 rows; episodes: `positionLifecycle.recentEpisodes[]` (24 rows with entry, exit, PnL, excursions) (`portfolio_explorer.py:7188`) | no (legacy `studio.js:3775`, `:3991`) | lane not migrated; server truncates | Frontend: transitions and episodes tables. Full list needs Core to publish a capped complete decision table | M | med |
| Exposure / cash chart | Not in the reference | `path.points[].grossExposure, netExposure, cashWeight` | no (legacy `studio.js:3075`) | lane not migrated | Include in the Portfolio page | S | low |
| Cost and turnover stress | Fee multiplier advice only | `strategyViability.validation.friction`, `costStress[]`, `extraDelay`, break-even cost (`portfolio_explorer.py:3469`) | no (legacy `studio.js:3542`) | lane not migrated | Frontend table | S | high (their notes list this as advice; ours is computed) |
| Strategy verdict | No verdict in the reference | `strategyViability.diagnosis` (stage, explanation) and `signalMonetization.diagnosis` | no (legacy) | lane not migrated | Surface the diagnosis as a banner on the Portfolio page | S | high |
| Stage progress (8 or 9 stage bar) | Per-stage bar with elapsed time | Not found per stage. Run rows carry `status` and `durationMs` (`studio.py:1171` run summary). Local actions jobs report `stageMode: "whole-action"` with `stages[]` all flipped together (`studio_actions.py:303`) | partial: duration and status in the Run list; action jobs only with `--allow-actions` | server does not publish stages; Core does not emit stage events | Do not fake stages. If wanted, Core would need to append stage records to `run.json`; skip for now | L | low |

## Matrix D. Iteration, versions, tuning

| Item | Reference shows | AutoQuant source today | Studio now | Root cause if no | Smallest change (files) | Effort | Value |
|---|---|---|---|---|---|---|---|
| Before / after table with delta column | Table: metric, before, after, change; agent's plain failure statement | `ComparePage` metricRows with A, B, delta and a "reading" word (`studio-app/src/pages/compare/ComparePage.tsx:37`), basis lock in `basis.ts` | yes: Compare page | n/a | Add the Portfolio metric group once the Portfolio page exists | S | high |
| Run selector (timestamp dropdown) | Dropdown of runs | `project.runs[]` | yes: `RunSelect.tsx`, Factor `RunSelector` (`Factor.tsx:215`) | n/a | none | n/a | high |
| Run history across strategies and factors | Table split by Strategy / Factor and market with thumbnails | `snapshot.projects[].runs[]` (19 on sample) with `primaryMetric`, `primaryValue`, `status`, `durationMs`, `errors`, `metricLayers` (`studio.py:1171`) | yes (partial): `RunList.tsx` per Project; no thumbnail, no cross-Project view, no lane filter | not drawn yet | Add a lane column and a sparkline from `metricLayers`; workspace-wide table in `Projects.tsx` | S | med |
| Version history (V1, V2, rollback) | Versions tagged human or system, compare | `sessions[].experiments[]` (sequence, verdict KEEP/REVERT/CRASH, hypothesis, `leaderValue`, `candidateValue`, `improvement`, `runId`), `candidate.sourceHashes`; no source text or diff published. Real: BTC Session has 1 REVERT experiment | partial: Project page "Experiments and trials" (`ProjectResearch.tsx:185`), trajectory chart (`:44`), trial matrix (`:135`) | source diff not published | Add a diff link from the experiment row to the Session worktree path (already in payload `path`); a published diff needs Core | S for the link, M for diff | med |
| Trial counter beside every number | Absent in the reference | `selectionIntegrity.candidateTrials`, `researchFamily.uniqueSourceTrials`, `selectionAdjustment` | yes: Project "Selection-adjusted evidence" (`ProjectResearch.tsx:266`) | n/a | Repeat the count on the Factor and Run pages (S) | S | high |
| Tuning combination status matrix | Grid of dots per combination, counters queued/running/done | Closest: `portfolioExplorer.parameterNeighborhood.validation.configurations[]` (15 configs: `netSharpe`, `totalReturn`, `annualizedOneWayTurnover`, `netSharpeDeltaVsBase`; `portfolio_explorer.py:2044`); Session `decisionMatrix.trials[]` | partial: Session trial matrix cells (`ProjectResearch.tsx:135`); the 15-config neighborhood only in legacy (`studio.js:3903`) | lane not migrated; AutoQuant has no live concurrent search runner (fixed predeclared grid) | Frontend: render the neighborhood as a grid (profile by band) coloured by `netSharpeDeltaVsBase`. No live status needed | S to M | med |
| Overlaid tuning curves (all combos, normalised) | Up to 64 curves in one chart | Not found. The neighborhood publishes per-config scalars only, not per-config growth series | no | server does not publish; needs new Core computation | Core: optionally project per-config `netGrowth` (sampled) in `_parameter_neighborhood_projection` (`portfolio_explorer.py:2044`). Pair with the noise-frontier band in the chart | M | med (their overfit warning is "dispersed curves"; scalars already show dispersion) |
| Sortable tuning result table | Columns: params, total return, Sharpe, MDD, Sortino; sort headers; "apply" button | Same 15 configs, plus Session `trials[]` ranked by the primary metric (`ProjectResearch.tsx:111` "Trials ranked by") | partial: trial rank list; no sortable multi-metric table | not drawn yet | Add a sortable table component for `configurations[]` | S | med |
| Noise frontier for the best-of-N | Absent in the reference | Computed in the browser: `frontier` in `Factor.tsx:348`, `NoiseFrontierChart` (`FactorCharts.tsx:537`) | yes: Factor page "Selection and noise" | n/a | Extend to Portfolio search once it has N trials | M | high |
| Parameter panel (analysis window, rebalance, groups, direction, universe) | Editable form beside result | Read-only equivalents: `ProtocolBox` (`FactorEvidence.tsx:561`: splits, horizons), `QuestionBlock` (`ProjectResearch.tsx:367`: claim, horizon), `mandate` (`portfolio_explorer.py:5574`: direction, universe, caps, cadence) | partial: Factor protocol and claim; mandate only in legacy | not drawn yet; editing is out of scope (Studio is observation, writes are `aq` commands) | Show the mandate and signal policy parameters on the Portfolio page, read-only | S | med |
| Apply best parameters / save as version | One click button | Studio actions with `--allow-actions` (`docs/design/studio-local-actions.md`); Session promotion is a guarded CLI step | no in Studio UI by default | out of scope by design (apply must be explicit, recorded, trial-numbered) | none | n/a | n/a |
| AI optimize chat with action trail | Chat panel, collapsible tool-call trail | `sessions[].campaigns[]` (`campaignRows` in `studio.js:5239`), Session `progress`, `commands` | partial: Session list on the Project page | out of scope as chat; trail partly present | Show campaign turns as a trail (S) if the external-researcher driver is used | S | low |
| Export PDF | Button | Reports are Markdown/JSON packages: `project.runReports`, `reviews`, `dossiers` listed in `ProjectResearch.tsx:482` | partial: lists documents, no PDF | not drawn yet; PDF is cosmetic | none now; print stylesheet later | S | low |
| Strategy library card (name, market tag, 3 numbers, thumbnail) | Card grid | `ProjectSummary` (`api.ts:5`): counts, brief, run count, latest run time, external holdout state; Projects page grid (`Projects.tsx:14`) | partial: card without a headline metric or thumbnail | not drawn yet | Add verdict badge, primary metric and a sparkline of `primaryValue` over runs to the Project card | S | med |

## Matrix E. Market terminal and paper trading

| Item | Reference shows | AutoQuant source today | Studio now | Root cause if no | Smallest change (files) | Effort | Value |
|---|---|---|---|---|---|---|---|
| Price K-line with main and sub indicators | Intraday plus D/W/M candles, MA and volume | OHLCV exists only as Project files (`projects/<id>/data/...`) and in memory for Runs. No route serves bars (`studio.py:2327` list of GETs) | no | out of scope as a terminal; server does not publish bars | If ever needed for evidence: a bounded `/api/v1/bars?project=&asset=` projection of the normalized snapshot, drawn as a plain close line with event markers. Not a charting terminal | M | low |
| Order book (five levels) | Live depth | Not found; no market-data subscription anywhere in Core | no | out of scope for the product (research, not live) | none | n/a | none |
| Paper-trading account view | Net unit value, floating PnL, minute curve | Not found; Core has no simulated account. Closest read-only idea: Portfolio `currentBook` with `historicalResearchWeights: true` | no | out of scope (live and simulated trading belong to OpenAlice/UTA per `AGENTS.md`) | none | n/a | none |
| Paper-trading gate "only a saved version can be promoted" | Dialog blocks creation without a saved version | Same idea exists as guarded promotion in the Session loop and the external holdout gate | partial: holdout state shown on the Project page | n/a | none | n/a | med (keep the principle) |

## Matrix F. Other lanes the legacy Studio draws and the new one does not

The new Studio has no page for these. Each one is "lane not migrated"; the
payload is published when the lane exists in a Project. On the repository-root
Workspace only Portfolio was non-null.

| Lane | Legacy renderer | Payload | Note |
|---|---|---|---|
| Portfolio | `studio.js:3793` | `portfolioExplorer` | See Matrix C. The first lane to migrate. |
| RL policy | `studio.js:4840` | `rlExplorer` | Not present in the sample Workspaces; migrate after Portfolio. |
| Book Risk | `studio.js:2451` | `bookRiskExplorer` | Descriptive audit of a reported book; low value for the factor question. |
| Allocation | `studio.js:2716` | `allocationExplorer` | Same. |
| Book Path Stress | `studio.js:2793` | `bookPathStressExplorer` | Same. |
| Event Study | `studio.js:2832` | `eventStudyExplorer` | Already migrated (`EventStudy.tsx`). |

## Ranked build list (value over effort)

1. Portfolio page: net-growth, benchmark and drawdown chart plus a metric grid
   per split (Matrix C rows 1, 3, 4). The data is published and verified; this
   is the largest hole between "has a verdict" and "can show the equity curve",
   and it is frontend only.
2. Factor headline completion: add Pearson IC mean, IC std, IC_IR and hit rate
   beside the existing rank IC, t and p (Matrix B). Everything is already in
   `summary.validation`; S effort, closes seven of the thirteen reference
   metrics at once.
3. Strategy viability and cost-stress block on the Portfolio page (gross vs net,
   break-even cost, extra delay, diagnosis): ours is computed, theirs is advice.
4. Quantile cumulative-return curve with long-short spread (Matrix A): the
   centrepiece of their factor page. Needs one Core field and one chart; show an
   honest "not defined for single-asset factors" state for temporal Runs.
5. Factor long-short summary (return, annualized, Sharpe, drawdown) from the
   same series, labelled gross and best-group-only, so we can answer the
   reference's headline numbers without adopting their scope blindness.
6. Parameter neighborhood grid and sortable table in the new Studio (Matrix D):
   the data exists (15 configurations); it is the honest version of their
   tuning matrix and feeds the noise frontier.
7. Project card headline: verdict badge, primary metric, run-value sparkline
   (library triage surface from section 6 idea 6 of the reference notes).
8. Trade and transition tables plus rebalance tick strip (Matrix C): `recentTransitions`
   and `recentEpisodes` already exist; full history needs a capped Core table.
9. Trial counter repeated on the Factor and Run pages beside the headline
   number ("N tried"): the count is already on the Project page.
10. Per-config growth series in `parameterNeighborhood` for an overlaid curve with
    a noise band: the only M-effort item that adds new insight rather than
    parity.

## Do not copy

- Live market terminal: K-line terminal, order book, risk and fund-flow tabs,
  5,223-symbol browser. It is a different product, needs market-data
  subscriptions, and does not help test whether a factor holds.
- Paper trading and simulated accounts: out of scope per `AGENTS.md`
  (live trading belongs to OpenAlice/UTA). Keep only the principle that
  promotion requires a saved, versioned artifact.
- Editable parameter panel and one-click apply: Studio is an observation
  surface; applying parameters must stay an explicit, recorded CLI step with a
  trial number (the reference's silent apply is the failure mode to avoid).
- Fake stage progress: Core does not emit stages, so a nine-step bar would be
  decoration.
- Five-group return surface and 3D group chart: our protocol fixes three
  groups and the 3D plot is hard to read.
- Chat-first workbench, compute-credit gauge, leaderboards ranked by IC or
  return, contests: marketing and multiple-testing generators.
- Metrics without a decision: the reference grid prints IC mean, Rank IC and
  Sharpe with no verdict; any metric we add stays under the existing verdict
  strip.
- IR with an undefined meaning, and P(IC beyond band) as headline numbers:
  low value next to hit rate and HAC t; add only as secondary cells.

## Core or server change versus frontend only

Frontend only (data already published):

- Portfolio page, net-growth and drawdown chart, metric grid, mandate, book
  table, transitions, episodes, exposure, viability, cost stress (Matrix C).
- Factor headline completion (Pearson IC, IC std, IC_IR, hit rate).
- Parameter neighborhood grid and sortable table.
- Project card headline and sparkline, run list lane column, trial counter on
  Factor/Run pages, Compare for Portfolio metrics.
- RL, Book Risk, Allocation and Book Path Stress pages if wanted later.

Needs a Core or server change:

- Quantile cumulative curve and long-short summary (`factor_explorer.py`).
- P(IC beyond band) exact shares (`factor_explorer.py:1659`).
- Calmar in the Portfolio performance projection (`portfolio_explorer.py:3321`).
- Full transition and trade table or per-date transition marks
  (`portfolio_explorer.py:4308`, `:5224`).
- Per-configuration growth series (`portfolio_explorer.py:2044`).
- Source diff for versions; stage records; bars endpoint (only if ever wanted).

Every Core addition changes a read-model schema, so it also needs the matching
schema entry (for example `portfolio_explorer.py:7777` for the path point
schema), tests, and an update to [[docs/design/factor-evidence-explorer]] or
[[docs/design/portfolio-decision-explorer]].
