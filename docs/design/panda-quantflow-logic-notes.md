# PandaAI Quantflow logic notes

Status: research note, 2026-11-01. Read-only code study; no code changed, no
code copied.

Related: [[docs/design/pandaai-reference-notes]],
[[docs/design/panda-display-gap-matrix]],
[[docs/design/factor-diagnostics]],
[[docs/design/factor-evidence-explorer]],
[[docs/design/research-selection-integrity]],
[[docs/design/selection-adjusted-research-evidence]], and
[[docs/design/portfolio-construction-lab]].

## Scope, sources and licence boundary

[[docs/design/pandaai-reference-notes]] and [[docs/design/panda-display-gap-matrix]]
describe what the hosted product (Qube) shows on screen. This note answers a
different question: what the open-source code actually computes, so we can
decide which parts of a Panda-style result page are worth re-implementing in
our own words and which would weaken our evidence.

Sources read:

- `D:/projects/Quantitative/panda_quantflow` (HEAD `c5b89c6`, a local commit
  that only adds a shim; upstream content is the node-workflow platform).
  Abbreviated `QF:` below, paths relative to `src/`.
- `D:/projects/Archive/2026-04-batch2/panda_factor` (HEAD `c714e18`).
  Abbreviated `PF:`, paths relative to `panda_factor/panda_factor/analysis/`
  unless stated. This is a separate upstream repository.

Both are AGPL-3.0. This note therefore describes ideas, definitions and
pseudo-formulas only. Nothing is pasted, nothing may be copied into AutoQuant.
Re-implementation must come from the definitions below, written from scratch,
with our own tests.

Important facts that change how the question must be read:

1. **panda_quantflow does not contain the factor analysis.** Its nodes
   `QF:panda_plugins/internal/factor_analysis_node.py:8` and
   `factor_ic_calculation_node.py:8` only import `panda_factor.analysis.*`,
   and `pyproject.toml` does not list that package (README line 80 says to
   clone it). Questions 1 and part of 4 are answered from `PF:`, not `QF:`.
   The market data reader (`panda_data`) is also external; point-in-time index
   membership and delisting handling could not be verified.
2. **The backtest engine is in `QF:`** (`panda_backtest/`), but **parameter
   tuning is not**. The repository only injects a parameter dictionary into
   the strategy context (`QF:panda_backtest/data/context/strategy_context.py:31`,
   called from `main_workflow_stock.py:56-74`). There is no search loop, no
   candidate counter and no objective handling. Everything we know about the
   64-run tuner comes from the hosted-product notes
   ([[docs/design/pandaai-reference-notes]] section 5g), which are vendor
   behaviour, not code.
3. **This may not be the code behind the hosted Qube product.** The open source
   is a node-workflow platform plus an A-share factor tool. The hosted product
   is a chat workbench with five-group surfaces, a 64-run tuner and paper
   trading. We have no proof the hosted analytics use these formulas. Treat
   everything here as "how a mainstream open implementation does it", not as a
   description of Qube.
4. No code was executed. Findings marked "appears" are from reading only.

## 1. Factor analysis outputs (PF)

### 1.1 Pipeline

`factor_analysis.py:18` runs: fetch bars for the date range, stock pool and
ST flag (`:91`); mark untradable rows; compute adjusted prices and forward
returns per symbol; clean the factor per date; left-merge bars with factor and
keep only rows where factor and the chosen forward return are present
(`:162-166`); compute lagged returns (`:188`); assign groups per date
(`:211`); then the `factor` object computes IC, group returns and tables
(`factor.py:255`). Task progress is a number 0 to 9 written to a task record
at each of nine steps (`:37-313`).

### 1.2 Forward return and alignment

`factor_func.py:34-54`: daily return is close over pre_close minus one. An
"adjustment factor" is the cumulative product of those returns, and the
"backward adjusted open" is the first open scaled by the ratio of that factor
to its first value. Forward return for cycle N is

```text
ret_N(t) = A(t + 1 + N) / A(t + 1) - 1        A = reconstructed adjusted level
```

The code comment calls A an adjusted open, but it is built from close/pre_close
compounding, so A is effectively the adjusted close level rescaled. The result
is a close-to-close return that skips one bar after the signal date: the
factor is known at close t, the position is assumed to start one bar later.
That is a one-bar execution delay, not a real next-open fill. The newer
`factor_analysis_workflow.py:14-50` repeats the same construction vectorised.
Shifts are by row position within a symbol, so a suspended or missing day
shortens the calendar horizon silently.

Lookahead protection is only this one-bar delay. There is no split, no purge
and no embargo.

### 1.3 Factor cleaning

Per date, cross-sectionally: add tiny random noise (std 1e-10, unseeded, so
runs are not reproducible), clip to mean +/- 3 std, then z-score
(`factor_func.py:502-532`, `:580-592`; `factor_analysis.py:129-140`). The
"median/MAD" branch is dead: both branches of the `if` call the 3-sigma
function (`factor_analysis.py:129-136`), so the UI choice "median" silently
becomes 3-sigma. Neutralisation helpers exist (`factor_func.py:535-640`) but
the analysis path never calls them. All statistics use only the same date's
cross-section, so cleaning itself does not look ahead.

### 1.4 Grouping and tradability

For every date, rows flagged untradable are removed (`factor_func.py:681`).
The flag marks bars where high equals low and equals limit-up or limit-down
(`clean_k_data`, `:112-138`) and is evaluated on the signal day's bar, not on
the entry day, so it does not describe whether the position could actually be
opened. A date is skipped when distinct non-NaN factor values are fewer than
the number of groups (`:690`). Groups are quantile bins from a rank-based cut
(2 to 20 bins, default 10 in code, 5 in the node UI) on factor plus unseeded
noise (`:701-703`). The universe benchmark for each date is the equal-weight
mean forward return of all stocks in the cross-section **before** the
untradable filter (`:671-681`).

### 1.5 IC, Rank IC, IC_IR, IR, tails, t, p

All in `factor.py:255-339` and `:230-253`.

- **Sampling.** Dates are visited in order and only every `period`-th date is
  kept (`:279-283`), so the kept returns do not overlap. The counter only
  advances for dates that survive the earlier unique-value skip (`:275-283`),
  so the stride can drift after a skipped date and overlap can return.
- **IC.** Per kept date, Pearson correlation of factor and the cycle-N forward
  return (`:288`). **Rank IC.** Pearson correlation of the two rank vectors
  (`:289`). No minimum number of names beyond the unique-value test.
- **IC_IR** = mean(IC) / std(IC) with pandas default ddof of 1 (`:236`).
- **"IR"** = mean over dates of IC times sqrt(number of names that date)
  (`:290`, `:237`). This is not an information ratio; it grows with universe
  breadth.
- **P(IC > 0.02)** and **P(IC < -0.02)**: counts over the number of IC values,
  denominator includes NaN dates (`:238-239`).
- **t and p**: one-sample t-test of IC against zero after replacing NaN IC by
  zero (`:240-245`). Independent-sample assumption, no HAC.
- **Monotonicity**: absolute Pearson correlation between per-group annualised
  return and the group index 1..G (`:248-251`).

### 1.6 Group returns, long-short, excess

Per kept date, each group's return is the equal-weight mean forward return of
its members (`:299-301`). Cumulative curves are **running sums** of those
per-date means, not compounded (`factor.py:359`, `:637`). The "excess" curve
for group g is group return minus the universe mean (`:314`).

Long-short 1 is the extreme pair, long-short 2 the next inner pair when there
are four or more groups. Which end is long is chosen by the user's
`factor_direction` parameter (`:316-329`). In the stored excess chart the
long-short series is the **absolute** long-short, not the excess one
(`factor.py:679-698` reuse `group_ls`, not `group_ls_pro`), so that line is
mislabelled.

### 1.7 Per-group statistics table (`cal_df_info1`, `factor.py:161-225`)

| Column | Definition used |
|---|---|
| annual return | mean per-sample group return times 252 / period (arithmetic, `:184`) |
| annual volatility | std (ddof 0) times sqrt(252 / period) (`:187`) |
| max drawdown | largest peak-to-trough fall of the **running sum**, in return units (`:193-195`) |
| Sharpe | (annual return - 0.025) / annual volatility, non-finite becomes 0 (`:201-204`) |
| excess annual return | mean excess times 252 / period (`:206`) |
| tracking error | sqrt(sum of squared excess / (n - 1)), uncentered, per sample (`:207`) |
| information ratio | excess annual return / annualised excess volatility (`:222`) |
| monthly win rate | share of calendar months with positive summed return (`:214-216`) |
| turnover | see below |

Turnover compares the member set of a group to the set `period` rows earlier
and reports names that are new divided by previous names (`:65-118`). It
appears to be broken: `cal_df_stock` (`:120-131`) builds a frame with groups
as rows and dates as columns (the older commented version transposed it,
`:143`), and `cal_turnover_rate` then indexes rows as if they were dates.
Treat their published turnover as untrustworthy. Costs are never charged:
the analysis passes commission 0 (`factor_analysis.py:275`).

### 1.8 Decay and autocorrelation

For lags 1 to 20, rank IC and IC are recomputed between today's factor and the
**1-day** forward return shifted by i further days (`factor.py:291-294`,
`factor_func.py:79-86`). So the decay chart is a **signal-delay** profile, not
a longer-horizon profile. The shift is applied after rows with missing factor
or return were already dropped (`factor_analysis.py:165-188`), so lag i can
span more than i trading days for a symbol with gaps. The IC series
autocorrelation uses an ACF routine with 95 percent bands, capped at 40 lags
(`factor.py:743-790`).

### 1.9 Coverage

No coverage statistic. Missing factor values are removed silently by the merge
filter (`factor_analysis.py:162-166`). The only disclosure is that the latest
date's top 20 names by factor are stored (`:254-256`).

## 2. Backtest engine (QF)

### 2.1 Metrics (`panda_backtest/extensions/common_api/index_calculate.py`, `trade_reverse_future/result/all_result.py:134-182`)

The daily strategy return is account equity today over yesterday's equity
minus one (`all_result.py:109-111`). Total return is cumulative profit over start
capital (`all_result.py:117`). The set below is computed at the end of the run and written
as strings into one run record (`result_db.py:59-83`, `common/backtest/model/backtest_backtest.py:38-82`).

| Metric | Definition |
|---|---|
| annual return | (1 + total return) ^ (250 / trading days) - 1 (`index_calculate.py:51-62`); a separate branch for ruin is dubious |
| benchmark annual return | same with the benchmark cumulative return (`:230-241`) |
| volatility | std (ddof 1) of daily returns times sqrt(250) (`:71-81`) |
| Sharpe | (annual return - 0.04) / annual volatility, NaN when volatility is zero (`:114-130`, `all_result.py:146`) |
| max drawdown | worst equity / running peak - 1 over the account equity list (`:83-112`) |
| "Kama" ratio | annual return / max drawdown (`:243-247`), which is negative whenever return is positive because drawdown is stored as a negative number; effectively a Calmar with a sign defect |
| downside risk | root of sum of squared **negative active returns versus the benchmark** / (n - 1) times sqrt(250) (`:174-190`) |
| Sortino | (annual return - benchmark annual return) / that downside risk (`:210-221`); not the textbook minimum-acceptable-return-zero form |
| beta | covariance with benchmark over benchmark variance (`:16-49`, `all_result.py:171`) |
| alpha | annual return - 0.04 - beta times (benchmark annual - 0.04) (`:132-149`) |
| tracking error | std (ddof 1) of daily active return; annual times sqrt(250) (`:192-208`) |
| information ratio | 250 times mean active return / annual tracking error (`:151-172`) |

Frequencies and risk-free are hard-coded and inconsistent with the factor
tool: 250 days and 4 percent here, 252 days and 2.5 percent in `PF:factor.py`.

### 2.2 Execution and cost model (stock path)

`panda_backtest/backtest_common/exchange/stock/back_test/stock_exchange.py`:

- **Fill price.** Default match type 1 fills at the bar open, 0 at the close
  (`:167-179`, `main_workflow_stock.py:37`). The workflow node offers only the
  daily frequency (`panda_plugins/internal/backtest_stock_node.py:12`).
- **Slippage.** A fraction of price on the adverse side (`:181-184`). The
  workflow entry sets it to 0 (`main_workflow_stock.py:35`).
- **Commission.** Price times volume times 0.0008 times a user multiplier,
  with a 5 CNY minimum (`:267-270`). **Stamp duty.** A flat 0.1 percent of sell
  notional (`:271-274`). No transfer fee, no per-venue differences.
- **Limit up / down.** Orders are rejected when the reference price is at or
  beyond the limit on the buy side (up) or sell side (down), and when the
  order price breaches the limits
  (`backtest_common/order/stock/back_test/stock_order_limit_price_verify.py:51-80`).
  Fill price is also clipped to the limits (`stock_exchange.py:193-205`).
- **Suspension.** Orders are rejected when the daily bar status flags
  suspension (`order/stock/common/stock_order_susp_verify.py:27`), or when bar
  volume is zero (`order/stock/back_test/stock_order_volume_verify.py:19`).
- **Capacity.** A fill larger than bar volume is cut to the volume rounded
  down to lots of 100 (200 on the STAR board) and the remainder cancelled
  (`stock_exchange.py:219-244`). There is no participation-rate limit.
- **T+1.** At each new date the sellable quantity is reset to the holding
  (`result/stock/back_test/base_trade_reverse_result.py:51-71`); sells larger
  than sellable are rejected (`stock_order_account_verify.py:61`).
- Dividends and ETF splits are applied at day start (`stock_exchange.py:43-65`).

### 2.3 What is missing

No out-of-sample protocol, no trial or search accounting, no turnover or cost
break-even, no per-split metrics. All figures are full-period.

## 3. Tuning and overfitting

Code evidence (QF): only parameter injection into the strategy context. A
sample strategy, `panda_backtest/strategy/genetic_programming_strategy.py`,
shows what in-repo "optimisation" looks like: its fitness (`:210-243`) is a
mean over a ten-bar price window already used to compute the factor, divided
by its dispersion. That is a circular in-sample proxy, not an evaluation.

ML nodes monitor the training set as the evaluation set
(`panda_plugins/internal/lightgbm_node.py:123`, `xgboost_node.py:103`): no
holdout, no purge, no early stopping on unseen data.

An "IC" label for ML training (`common/utils/index_calculate.py:62-98`,
`:116-138`) forward-fills and then **back-fills** missing daily IC values
(`:123-131`). Back-fill copies a later date's information into earlier rows,
a direct lookahead into training labels.

Hosted tuner behaviour (docs only): up to 64 candidates, sorted result table,
manual "apply", no stated overfitting guard ([[docs/design/panda-display-gap-matrix]]
Matrix D).

## 4. Storage and what the web layer serves

### 4.1 Factor results (PF server, per factor id)

One document per factor in `panda.factor_analysis_results`
(`factor.py:965-990`), upserted by factor id, so **a re-run overwrites the
previous result**: no run history. Fields: task id, factor name and id,
timestamps, `period`, `pred_direction`, `commission`, `mode`, and these chart
blobs, each a `ChartData` of the form title plus `x` and `y`, each a list of
`{name, data[]}` (`panda_common/models/chart_data.py:6-15`):

`return_chart` (one series per group plus long-short lines), `excess_chart`,
`ic_seq_chart` and `rank_ic_seq_chart` (IC plus cumulative IC),
`ic_den_chart` and `rank_ic_den_chart` (60-bin density plus normal curve),
`ic_decay_chart`, `rank_ic_decay_chart`, `ic_self_correlation_chart`,
`rank_ic_self_correlation_chart`, `simple_return_chart` (one group only).

Plus tables: `one_group_data` (return, annualised, Sharpe, drawdown of the
group the direction selects), `last_date_top_factor` (top 20 names),
`group_return_analysis` (the per-group table above) and
`factor_data_analysis` (IC table). **Table cells are formatted strings with
percent signs and Chinese keys** (`:938-960`), not numbers. Route names
(`panda_factor_server/routes/user_factor_pro.py`): one GET per blob, such as
`query_return_chart`, `query_ic_decay_chart`, `query_group_return_analysis`,
`query_factor_analysis_data`, `query_task_status`, `task_logs`.

### 4.2 Backtest results (QF server)

Routes, prefix `/api/backtest` (`panda_server/routes/backtest_route.py`):
`backtest` (summary by id), `account`, `position` (optional date), `profit`,
`trade`, `userstrategylog`. Responses use one envelope with `code`, `message`,
`data`; list endpoints return `items` plus `pagination` of total, page,
page_size, total_pages (`panda_server/models/backtest/query_profit_response.py`,
`logic/backtest/backtest_profit_get_logic.py`). **Default page size is 10 and
the query has no sort**, so a UI that wants the whole equity curve must page
through unordered rows.

Collections and fields (`result_db.py:27-117`, `backtest_common/model/result/*.py`):

- `panda_back_test`: run summary. `back_profit`, `back_profit_year`,
  `benchmark_profit`, `benchmark_profit_year`, `alpha`, `beta`, `sharpe`,
  `volatility`, `max_drawdown`, `information_ratio`, `sortino`,
  `tracking_error`, `kama_ratio`, `downside_risk`, `benchmark_name`,
  `time_consume`, `custom_tag`, `run_status`, plus the input settings
  (`benchmark`, `commission`, `slippage`, `start_date`, `end_date`,
  `run_params`, `strategy_code`). All stored and served as strings.
- `panda_backtest_profit`: one row per day. `strategy_profit` (cumulative
  fraction), `csi_stock` (benchmark cumulative), `overful_profit` (chained
  daily excess), `day_profit`, `day_purchase`, `day_put`, `gmt_create`.
  This is the nav curve source.
- `panda_backtest_account`: per day per account: `available_funds`,
  `total_profit` (equity), `market_value`, `cost`, `frozen_capital`,
  `daily_pnl`, `holding_pnl`, `realized_pnl`, `start_capital`.
- `panda_backtest_position`: per day per instrument: `contract_code`,
  `position`, `price`, `last_price`, `market_value`, `accumulate_profit`,
  `sellable`, `cost`.
- `panda_backtest_trade`: every fill: `contract_code`, `business`
  (0 buy, 1 sell), `volume`, `price`, `cost`, `trade_date`, `gmt_create_time`,
  `order_id`, `order_remark`.
- `panda_custom_chart`: strategy-drawn series keyed by run id.

### 4.3 What a good result page needs (derived)

From these shapes: the page needs a run summary object with typed numbers, a
full-resolution dated series per curve (not pages), a trade list and a
position-by-date view that can be filtered, and the inputs that produced the
run echoed beside the result. Their weaknesses (strings for numbers, unordered
paging, overwrite-on-rerun, no split, no trial count) are the shape of what to
avoid.

## 5. Workflow and node abstractions

| Panda concept | Where | Closest AutoQuant concept | Note |
|---|---|---|---|
| Workflow (nodes, links, per-node static inputs, feature tags) | `QF:panda_server/models/workflow_model.py:5-212` | Study / program (fixed evaluator definition) | graph is editable and mutable; no content hash, no family identity |
| Work node (name, group, type, input and output model, `run`) | `QF:panda_plugins/base/base_work_node.py`, `internal/*.py` | Judge stage or component | pydantic-typed ports; "type" tag drives special result nodes |
| Workflow run (status, progress 0-100, running / success / failed node id lists, passed link ids, `output_data_obj`) | `QF:panda_server/models/workflow_run_model.py:50-90` | Run | progress is real because node boundaries are real |
| Execution order by layers of nodes with no pending inputs | `QF:panda_server/utils/run_workflow_utils.py:484-560` | none | cycle detection raises before run |
| Node outputs serialised with cloudpickle into GridFS, referenced by node uuid | `QF:panda_server/utils/db_storage.py:15-56` | Run artifacts | opaque binary, not inspectable, loading pickles from a database is an execution risk |
| Backtest result node holds only a task id | `QF:panda_plugins/internal/backtest_result_node.py` | Run report | result lives outside the graph |

There is no equivalent of Project (a research question with a claim), Session,
trial, or holdout. The useful idea is per-node progress and failure
attribution for a Run, which our gap matrix already marks as not to be faked;
it becomes honest only if Core defines real stage boundaries.

## 6. Comparison with AutoQuant Core

Our factor numbers are produced by the Judge
(`autoquant/project_templates/ohlcv_factor_lab/judge.py` with
`factor_diagnostics.py`) and republished by `autoquant/factor_explorer.py`.
Portfolio numbers come from `ohlcv_portfolio_lab/portfolio_core.py` and
`autoquant/portfolio_explorer.py`.

Legend: "Core" means a Judge or explorer change plus a published field and a
test; "frontend" means data already published.

| Metric or behaviour | Their definition | Our definition (file:line) | Same / different | To get a result page like theirs | Risk |
|---|---|---|---|---|---|
| Forward return alignment | One-bar delayed close-to-close, `A(t+1+N)/A(t+1)-1` (`PF:factor_func.py:34-54`) | `close(t+h)/close(t)-1`, signal at close t (`factor_diagnostics.py:130-137`) | Different | Nothing for the page. Optionally add a delayed outcome through the outcome registry (`factor_outcome_panels`, `factor_diagnostics.py:164`) | Ours scores a return starting at the same close that produced the signal; theirs is more conservative. Both shift by row, not calendar |
| Split and purge | None; whole window, one headline | Chronological 60/20/20, last h rows of each split purged (`factor_diagnostics.py:34-80`) | Ours stronger | Keep | Their headline mixes in-sample and test: selection on everything |
| Daily Pearson IC | Per date, no minimum names except unique count (`PF:factor.py:288`) | At least 4 assets, at least 2 distinct values, NaN pairs dropped (`factor_diagnostics.py:209-230`) | Same idea, ours stricter | Frontend: Pearson mean is published (`factor_explorer.py:1659`), show it | Low |
| Rank IC | Pearson on ranks, no tie rule stated (`PF:factor.py:289`) | Average ranks, then correlation (`factor_diagnostics.py:178-207`) | Same | None | Low |
| Evaluation sampling | Every N-th date, non-overlapping (`PF:factor.py:279-283`) | Every bar, overlapping h-bar targets, Newey-West lag `min(5, n-1)` cross-sectional (`factor_diagnostics.py:233-266`, [[docs/design/factor-diagnostics]]) | Different | None | Ours: lag 5 is below `h-1` for h=10, so the non-primary horizon t is probably optimistic; verify before showing t at h=10. Theirs: stride can drift (section 1.5) |
| IC_IR | mean / std ddof 1 (`PF:factor.py:236`) | mean / std ddof 0 (`factor_diagnostics.py:277-318`) | Differs by factor sqrt(n/(n-1)) | Frontend: label ddof | Cross-tool comparison off by a small constant |
| "IR" | mean of IC times sqrt(names) (`PF:factor.py:290`) | Not published | Do not copy | Nothing | Breadth-inflated; not an information ratio |
| t and p | One-sample t, NaN becomes 0 (`PF:factor.py:240-245`) | HAC normal approximation, NaN dropped (`factor_diagnostics.py:233-266`) | Different | None | Theirs: NaN to zero shrinks the mean and fakes sample size; i.i.d. assumption |
| P(IC beyond +/-0.02) | Share over all dates incl. NaN (`PF:factor.py:238`) | Not published; hit rate (share above 0) is | Different | Core: add threshold shares to `_ic_summary` (`factor_explorer.py:1659`) | Fixed 0.02 is arbitrary; disclose |
| Monotonicity | abs Pearson of annual return vs rank (`PF:factor.py:250`) | Signed rank correlation of the three means vs 0,1,2 (`factor_diagnostics.py:362-400`) | Different | None | Theirs removes sign, hiding inverted factors |
| Group construction | 2 to 20 quantile bins, random noise breaks ties (`PF:factor_func.py:701-703`) | Fixed tertiles by stable sort, at least 4 assets and 3 distinct values (`factor_diagnostics.py:320-360`) | Different | Frontend: draw tertiles only; no five-group page | Theirs not reproducible. Ours: ties split across groups by column order, deterministic but arbitrary |
| Group return series | Mean per sampled date, curve is a running sum (`PF:factor.py:299-301`, `:359`) | Daily low/middle/high rows in `factor-quantiles.csv`, only means published; path sampled to about 180 points (`factor_explorer.py:3791`) | Different | Core: new full-resolution `quantileCurve` (section 7 item 1) | Cumulating overlapping h>1 rows double counts; use h=1 or a stride |
| Long-short | Top minus bottom, direction chosen by user (`PF:factor.py:316-329`) | Always high minus low, fixed sign (`factor_diagnostics.py:355`) | Ours better | Core: summary block (item 2) | Their direction flag can be set after seeing IC sign |
| Excess vs universe | Group minus mean of all stocks incl. untradable (`PF:factor_func.py:671-681`) | None (spread cancels the market) | Different | Core: optional `market_mean` column (item 6) | Equal-size groups needed to rebuild the mean from the three; do not derive |
| Group annual return, vol, Sharpe | Arithmetic mean times 252/period; rf 0.025 (`PF:factor.py:184-204`) | Not at factor level. Portfolio: geometric annual, rf 0, ddof 0, periods inferred (`portfolio_core.py:3888-3996`, `intervals.py:356`) | Different | Core: factor spread block (item 2) | Arithmetic annualisation overstates; label gross, no cost |
| Max drawdown | On running sum, return units (`PF:factor.py:193-195`) | On compounded equity, fraction (`portfolio_core.py:3942`) | Different | Compute on compounded spread for the block | Running-sum drawdown is not comparable to portfolio MDD |
| Sortino | Return minus benchmark return over downside vs benchmark (`QF:index_calculate.py:174-221`) | Mean over downside deviation about zero times sqrt(P) (`portfolio_core.py:3888-3996`) | Different | Frontend only | Theirs is a different statistic under the same name |
| Calmar | Annual return / signed drawdown, negative sign defect (`QF:index_calculate.py:243-247`) | Annual / abs(MDD) computed but dropped in `_project_performance` (`portfolio_explorer.py:3321`) | Different | Core: project `calmar` (S) | Low |
| Benchmark-relative | alpha with rf 4 %, beta, TE ddof 1, IR 250x (`QF:index_calculate.py:16-208`) | beta, active annual return, TE, IR, ddof 0 (`portfolio_core.py:3888-3996`) | Different | Frontend; Core optional alpha | Different ddof and 250 vs inferred periods |
| Annualisation and rf | 250 (backtest) vs 252 (factor); rf 4 % vs 2.5 % | Inferred, 252 for date bars; rf 0 (`intervals.py:356`) | Ours consistent | Label rf = 0 on page | Mixed constants make their numbers incomparable |
| Cost model | Factor: commission 0 (`PF:factor_analysis.py:275`). Backtest: 0.08 % commission with 5 CNY floor, 0.1 % sell stamp duty, slippage fraction default 0, T+1, limit and suspension rejection, volume cap (`QF:stock_exchange.py:167-274`) | One flat bps on traded notional, stress multipliers and extra delay, break-even cost (`portfolio_core.py:2118-2243`, `portfolio_explorer.py:3469`) | Different | None for A-share rules; they would be a market-bound Judge, not Core | Ours turns NaN forward returns into zero return (`portfolio_core.py:2229`): a delisted asset reads as flat, hiding loss (survivorship) |
| Turnover | Member-set overlap, apparently mis-oriented (`PF:factor.py:65-118`), never charged | One-way turnover 0.5 sum abs weight change (`portfolio_core.py:2242`); whole-factor rank turnover (`judge.py:2208-2212`) | Different | Core: bucket membership turnover for high/low (item 5) | Theirs untrustworthy; do not compare |
| Decay | Rank IC of factor vs 1-day return delayed 0..20 bars; ACF of IC (`PF:factor.py:291-294`, `:743`) | Mean IC at horizons 1, 5, 10 and ratios to primary (`judge.py:1375-1403`) | Different quantity (delay vs horizon) | Core: delay profile (item 4) and IC autocorrelation (item 7) | Their lag is applied after row filtering, may span gaps |
| Coverage | None | Mean coverage, per-asset coverage, availability artifact (`judge.py:2237`, `factor_explorer.py:3839`) | Ours stronger | Frontend: show it beside every headline | Their silent row drops hide thin cross-sections |
| Selection integrity | Direction, group count, period free per run, no trial count | Validation-only objective, visible test, family trial count, deflated Sharpe ([[docs/design/research-selection-integrity]], `selection.py:175`) | Ours stronger | Keep verdict above metrics | Any Panda-style metric grid must not become a ranking surface |
| Run history | One factor document, overwritten (`PF:factor.py:996-1002`) | Immutable Runs | Ours stronger | None | Overwrite erases the evidence trail |
| Result number format | Strings with percent signs (`PF:factor.py:938-960`) | Typed JSON numbers | Ours stronger | None | Strings block comparison |

## 7. Where their method would weaken our evidence

1. **No holdout, no split** (`PF:factor.py:255-339`). One window supplies both
   the choice and the number; the headline equals a selection-contaminated
   test.
2. **User-chosen direction and group count after the fact.** The reported
   "one group" figures follow the `direction` flag
   (`PF:factor.py:803-812`). Flipping it after seeing IC sign yields the
   favourable side with no trial recorded. Our high-minus-low is sign-fixed
   and the sign is part of the claim.
3. **Unseeded noise in cleaning and grouping** (`PF:factor_func.py:483`,
   `:701`). Group membership for tied values changes between runs; the run is
   not reproducible and a rerun can be used as a free resample.
4. **Arithmetic annualisation of running sums** overstates large returns and
   makes drawdown unlike a compounded equity drawdown.
5. **Signal-day tradability flag** (`PF:factor_func.py:112-138`, `:681`):
   whether a name could be bought is judged on the signal bar, not on the
   entry bar, so limit-up entry days are not excluded. Optimistic.
6. **Lagged-return alignment after row filtering** can span gaps and hides
   misalignment inside the decay chart.
7. **Back-filled IC labels** (`QF:common/utils/index_calculate.py:123-131`):
   true lookahead into a training label. Never adopt a fill that uses later
   values.
8. **Training-set evaluation in ML nodes** and a circular fitness in the
   sample strategy: both report in-sample numbers as if evaluated.
9. **Benchmark of "all stocks" including untradable ones** inflates or
   deflates excess depending on limit-day mix.
10. **Mislabelled excess long-short line** (`PF:factor.py:679-698`) and a
    dead median-clip branch (`PF:factor_analysis.py:129-136`): presentation
    bugs that look like evidence.
11. **Different t-test.** NaN to zero and independent samples; a page showing
    their t next to our verdict would contradict it.

Weaknesses in our own method that this study exposed (not copied, but worth a
ticket): HAC lag fixed at 5 for every horizon (probably short for h = 10), and
`np.nan_to_num` on forward returns in the portfolio simulation, which flattens
missing prices to zero return.

## 8. Ranked list: re-implement in our own words

Ranked by value for "does this factor or idea hold" over effort. Each item
states the Core change; frontend work follows from the published field.
Anything cumulative stays at h = 1 or a non-overlapping stride, labelled gross.

1. **Full-resolution cumulative quantile curve (low, middle, high, spread).**
   Core: in `autoquant/factor_explorer.py`, add a projection fed by the
   complete `factor-quantiles.csv` rows already parsed in `_parse_quantiles`
   (`:1176`), not the sampled path (`_paths`, `:3791`). New field
   `quantileCurve` per split and horizon with cumulative sums of the h = 1
   rows, split tags, and an explicit `unavailable` reason for temporal
   factors. No Judge change. Test in `tests/` that the final cumulative value
   equals the sum of daily rows, that splits are not bridged, and that
   `temporal-tertiles-not-defined` yields the empty state.
2. **Spread summary block (gross).** Core: same module, field `spreadSummary`
   with total, annualised (geometric, periods from `annualization_periods`),
   volatility, Sharpe, compounded max drawdown and calendar-month hit rate of
   high-minus-low per split, plus the HAC t of the spread mean. Test with a
   hand-built series where each value is known; assert the block uses
   validation-split numbers for any verdict wording.
3. **Calmar and expected shortfall in the portfolio projection.** Core:
   `_project_performance` at `autoquant/portfolio_explorer.py:3321` passes
   through `calmar` (already reconciled at `:3278`) and
   `expected_shortfall_95`. Test: schema entry plus value equals the Judge's
   own output.
4. **Signal-delay IC profile.** Core: `ohlcv_factor_lab/judge.py` computes mean
   rank IC for delays 0 to 5 bars using a delayed outcome, purged by
   `h + delay`, republished as `delayProfile` in `factor_explorer.py`. It
   answers "how late can we trade this" and sits next to `extra_delay` in
   `portfolio_core.py:2170`. Test: delay 0 equals existing primary IC;
   purge removes the extra rows; schema and Judge hash change are noted in
   `docs/design/factor-diagnostics.md`.
5. **Bucket membership turnover and a spread break-even cost.** Core: judge
   computes high and low bucket membership change per bar (the correct
   orientation), explorer publishes `bucketTurnover` and a break-even bps for
   the spread (gross spread per bar divided by traded notional per bar,
   with the formula stated). Test: constant ranking gives zero turnover;
   alternating ranking gives full turnover.
6. **Market-mean column for excess paths.** Core: judge writes `market_mean`
   (equal-weight mean outcome of the valid cross-section) into
   `factor-quantiles.csv`; explorer projects low, middle, high minus market.
   Test: market mean reconciles to the mean of the raw pair frame, not to the
   tertile mean. Lower priority because the spread already cancels the market.
7. **IC autocorrelation.** Core: explorer or judge publishes lag-1..5
   autocorrelation of the daily IC series per split, to expose how few
   independent dates exist. Test with a known AR(1) series.
8. **Exact IC tail shares.** Core: `_ic_summary` (`factor_explorer.py:1659`)
   adds `shareAbove` and `shareBelow` with the threshold as a published
   field, denominator = valid IC dates only. Test: NaN dates excluded.
   Secondary cell only, never a headline.
9. **Complete dated series access with deterministic order.** Server, not
   numerics: `autoquant/studio.py` serves the full daily IC and quantile
   series for one Run by date range with a stated sort (their paged, unsorted
   lists are the anti-pattern). Test: ordering and range bounds.
10. **Carry run inputs beside every result.** Frontend plus a small Core
    guarantee that the published payload names the horizon, split rule,
    outcome and cost assumption that produced each number, as their run
    record echoes `period`, `commission`, `mode`. Test: payload schema
    requires these fields.

Not worth re-implementing: five- to twenty-group surfaces, the breadth-scaled
"IR", direction-selected "best group" returns, running-sum drawdown, the
benchmark-minus-downside Sortino, any rf constant other than the one we state,
pickled node outputs, tuning leaderboards with an apply button.

## 9. Caveats

- Hosted Qube may not run this code; no hosted payload was captured here.
- `panda_data` is not in either checkout: universe membership, ST handling and
  delisting treatment are unverified, so survivorship cannot be judged.
- The turnover defect is inferred from reading the shape of a frame; it was not
  executed.
- The "effective adjusted open is really adjusted close" reading follows from
  the arithmetic in `factor_func.py:34-54`; a real data run would confirm it.
- Line numbers are from the checkouts named above on 2026-11-01. Our
  `autoquant/studio.py` has uncommitted edits in the original tree, so its
  numbers may drift by a few lines.
