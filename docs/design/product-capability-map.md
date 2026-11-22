# Mature quant factor research products: capability map versus AutoQuant Studio

> **Research survey dated 2026-11-03, not a commitment.** This document records
> what mature factor-research products do and how AutoQuant compares. It does
> not own any AutoQuant invariant or schedule. The agreed build order derived
> from it lives in [[plans/product-maturity-roadmap]]; lasting contracts stay in
> the subsystem documents linked below.

Date: 2026-11-03. Subject: AutoQuant
(`D:\projects\.worktrees\aqv3-merge-assistant`, v0.9.31 plus the PR #3 draft).
Purpose: decide what to build next. Read-only survey; the repository was not
changed while it was written. Translated from the original Chinese survey; the
tables, priorities and source-reliability tags are preserved.

## 0. Survey scope and reliability

Tag conventions:

- **[doc]**: an official documentation page was read during this survey (URLs
  in section 12).
- **[second-hand]**: official documentation was not readable; the statement
  comes from third-party or community material.
- **[inferred]**: the author's inference or general industry knowledge, not
  verified against a document read in this survey.
- **[our docs]**: the PandaAI material comes from our own
  [[docs/design/pandaai-reference-notes]] and
  [[docs/design/pandaai-frontend-study]].

| Product | What was read | Reliability |
|---|---|---|
| QuantConnect / LEAN | Optimization, backtest results, paper trading, reality modeling, collaboration, Security Master, AI Assistance/Mia, the Alpha Streams shutdown announcement | [doc] |
| Microsoft Qlib | Home table of contents, data layer, PIT database, Recorder, Online Serving | [doc] |
| Numerai Signals | Signals overview, Signals scoring, MMC | [doc] |
| Alphalens / pyfolio (reloaded documentation site) | API index (list of tear sheets) | [doc], function list only, no details |
| QuantRocket (including Zipline, Moonshot) | Documentation navigation index | [doc], index only |
| JoinQuant | **The website blocks non-mainland IPs; platform documentation was not read**; only the official open-source `jqfactor_analyzer` README was read | Platform features [inferred]; analyzer [doc] |
| RiceQuant | Documentation index page (RQData/RQAlpha/RQFactor/RQOptimizer); the RQFactor page returned 403 | Product list [doc], details [inferred] |
| BigQuant | Only the wiki home navigation; factor-analysis documentation was not found | Effectively **skipped**, mentioned once |
| WorldQuant BRAIN | **Official documentation sits behind a login wall and JavaScript and could not be read**; only the marketing site plus community material | Marketing page [doc]; concrete settings and submission checks [second-hand] |
| PandaAI / QUBE | Our existing logged-in hands-on notes | [our docs] |
| Zipline-reloaded (standalone) | Not read separately; QuantRocket's Zipline index stands in | — |

Eleven products in total; BigQuant was effectively skipped.

## AutoQuant current-state summary (basis for the "AutoQuant today" columns)

- Data: OHLCV only. Daily or intraday CSV/Parquet dataset packages pass strict
  intake and become content-locked snapshots; the XNYS calendar is verified;
  multiple providers can be composed. Adjustment, survivorship and calendar
  semantics are declared by the caller and not certified by AutoQuant; see the
  "Honest boundary" in [[docs/STATUS]].
  [[docs/design/research-intake-and-dataset-snapshots]] states that it does not
  prove point-in-time constituents or delisting coverage.
- Factors: an ordinary pandas long-form panel, not a DSL. Studio has a small
  expression-to-Python adapter ([[docs/design/idea-verdict-card]]). Diagnostics
  include rank/Pearson IC, HAC t/p, decay by horizon, **fixed terciles**, rank
  turnover, fold/regime/asset stability, fixed style overlap, coverage and
  component attribution; see [[docs/design/factor-diagnostics]],
  [[docs/design/factor-evidence-explorer]] and [[docs/STUDIO]].
- Integrity mechanisms: frozen question; train/validation/test splits with
  selection on validation only; Project-level trial family; HAC×N family-wise
  correction for Factor and PSR/DSR for Portfolio; test hidden before audit;
  frozen external holdout; fixed Judge; immutable KEEP/REVERT/CRASH evidence.
  See [[docs/design/research-selection-integrity]],
  [[docs/design/selection-adjusted-research-evidence]] and
  [[docs/design/frozen-external-holdout-challenge]]. PBO is explicitly
  `not-computed`.
- Portfolio: target weights, caps, cash, benchmark, rebalance cadence,
  covariance volatility ceiling, linear costs, a 0/base/25 bps cost curve,
  capacity envelope, contribution attribution and a parameter neighbourhood
  (context only, never used for selection). There is no general optimizer; see
  "Known product gaps" in [[docs/STATUS]].
- Studio: read-only by default. `--allow-actions` enables project.create,
  intake, candidate.save, session.start/check and experiment.evaluate. The
  information architecture is organised by object (Factors/Strategies/Runs/
  Tuning); Run history filtering, Tuning and the Strategy workbench are **not
  finished**, see build order 3–5 in
  [[docs/design/studio-information-architecture]].
- Assistant: PR #3 is a **draft**. It works with local Claude Code; Codex is
  not available; arbitrary Python execution is blocked. It has not been
  verified against a real provider.

---

## 1. Data

| Capability | How mature products do it (who) | AutoQuant today | Why it matters for honest factor research | Suggested priority |
|---|---|---|---|---|
| Preset universes (index constituents, TOP3000, etc.) | BRAIN uses preset pools such as TOP3000 [second-hand]; Qlib's `instruments/csi300.txt` gives every stock start and end dates [doc]; PandaAI has all A-shares/CSI 300/500/1000 [our docs]; QC has universe selection [inferred] | **Missing**. The universe is the asset list the caller writes in the request; see [[docs/design/caller-owned-factor-population]] | Backtesting the past with today's constituents introduces survivorship bias | **P1**: first support a "membership file with date ranges", not a data service |
| Point-in-time data | Qlib has a PIT database that stores every revision by publication date [doc]; QC Security Master delisting and ticker-change events [doc] | **Missing**; OHLCV only, no fundamentals, see `research-intake...md:683` | Fundamental factors not taken point-in-time are look-ahead | **P2**: not needed at the OHLCV stage; becomes P0 once fundamentals are connected |
| Corporate actions (splits, dividends, renames, delistings) | QC Security Master tracks these since 1998 and pushes them to algorithms as events [doc]; Qlib adjusts prices with a `factor` field [doc] | **Partial**. Adjustment semantics are declared by the caller and locked into the package; Core does not certify them, see [[docs/STATUS]] | Wrong adjustment means wrong returns | **P1**: add an intake "adjustment consistency" self-check (split-jump detection) |
| Survivorship bias | QC datasets include delisted names [doc]; QuantRocket has a securities master [doc] | **Missing**; disclosure only (Honest boundary) | Using only survivors systematically overstates results | **P1**: the intake report states explicitly whether delisted assets are present, and the Verdict carries a caveat |
| Trading calendar | Qlib's `calendars/day.txt` [doc]; QuantRocket has exchange calendars [doc] | **Present**: the XNYS calendar and half days are verified; crypto is continuous UTC ([[docs/design/configurable-session-interval-inputs]]) | Misalignment creates false signals | Already present, keep |
| Data quality checks | Qlib `check_data_health.py` checks missing data, large price or volume jumps, missing columns [doc] | **Partial**. Strict intake validates structure and provenance but there is no quality report for "jumps, zero volume, long suspensions" ([inferred], not found in documentation) | Bad points create extreme IC | **P0**: cheap, directly improves credibility |
| Custom data upload | Qlib `dump_bin` supports CSV/Parquet [doc]; QuantRocket supports custom data [doc]; QC supports custom data [inferred] | **Present** (CLI): dataset package + `aq project intake`. Studio can only pick an already staged V1 package, see [[docs/design/idea-verdict-card]] | Bring-your-own data is the core selling point of a local tool | **P0**: an "import data" wizard in Studio; today the empty state blocks the way |
| Data catalogue/browsing | BRAIN claims 400,000+ data fields [doc: marketing page]; PandaAI has a market terminal [our docs] | **Missing** (no data browsing, only intake results) | Users need to see what data they have | **P2** |

## 2. Ideas and factor authoring

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Formula/expression language | BRAIN Fast Expression [second-hand]; Qlib expression engine (`Ref`, `Mean`, custom operators can be registered) [doc]; PandaAI formula mode [our docs] | **Partial**: the Studio expression box generates a pandas candidate ([[docs/design/idea-verdict-card]]); a DSL is deliberately not built (README) | Expressions lower the entry bar and make deduplication and comparison easier | **P1**: widen the operator coverage of expression-to-pandas; do not build a separate DSL |
| Python authoring | QC/LEAN, QuantRocket and Qlib all support it [doc] | **Present**: ordinary pandas panel, CodeField editor | — | Keep |
| Operator library | Qlib `ops.py` [doc]; BRAIN `ts_rank` and similar [second-hand] | **Missing**: no user-facing operator catalogue ([inferred]) | Discoverability | **P2** |
| Templates/starter factors | PandaAI "capability template" starter prompts [our docs]; Qlib has Alpha158/Alpha360 [doc] | **Partial**: Project templates `aq project templates`, sample-research-desk | Cold start | **P1**: provide 3–5 "known-style" example factors, labelled as known-style |
| Versions | PandaAI has V1/V2, rollback and comparison [our docs, but in hands-on use the AI rewrite kept no version]; QC has clone, no version history [doc] | **Present and stronger**: Git, Session worktrees, KEEP/REVERT, immutable Runs, candidate hashes ([[docs/design/research-session-loop]]) | Reproducibility | Keep; Studio must show version diffs, see section 7 |
| Naming/description | Everyone has it | **Present**: Project name, research.md | — | Keep |
| Notes | PandaAI cards allow searching notes [our docs] | **Present**: research.md, trial note (8–500 characters), see [[docs/design/idea-verdict-card]] | Records the motivation for a hypothesis | Keep |
| Frozen question/preregistration | **None** of the competitors read in this survey have it (PandaAI does not, see [[docs/design/pandaai-reference-notes]] §3) | **Present**: question hash, freezing | Prevents changing the question after the fact | Keep and display prominently |

## 3. Factor analysis

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| IC/IR | Alphalens information tear sheet [doc]; Qlib SigAnaRecord produces IC/ICIR/RankIC [doc]; jqfactor_analyzer `far.ic` [doc]; PandaAI has IC, RankIC, ICIR, t, p [our docs] | **Present**, plus HAC t/p ([[docs/STUDIO]]) | Core | Keep |
| Decay | PandaAI has IC decay and IC autocorrelation [our docs]; Alphalens multiple holding periods [inferred] | **Present**: decay by horizon, up to 5 horizons | — | Keep; an IC-autocorrelation warning band can be added (P1) |
| Turnover | Alphalens turnover tear sheet [doc]; jqfactor per-quantile turnover and rank autocorrelation [doc] | **Partial**: rank turnover exists, per-group turnover does not ([inferred]) | High turnover eats returns | **P1** |
| Quantile returns | Alphalens returns tear sheet [doc]; jqfactor configurable quantile count [doc]; PandaAI defaults to 5 groups [our docs] | **Partial**: **fixed terciles**; protocol-unavailable for temporal and two-asset modes ([[docs/STATUS]]) | 5 or 10 quantiles is the industry-standard reading; terciles hide monotonicity detail | **P1**: configurable quantile count, written into frozen parameters and counted as one trial |
| Long-short | Alphalens and jqfactor give the top-bottom spread [doc] | **Present**: six validation long-short metrics ([[docs/design/idea-verdict-card]]) | — | Keep; add **after-cost** long-short (P1) |
| Neutralization (industry/size/style) | BRAIN exposes neutralization as a setting [second-hand]; Numerai neutralizes against existing signals and Barra, industry and country factors [doc]; jqfactor has `group_adjust` and industry grouping [doc] | **Partial**: only train-only neutralization disclosure against fixed OHLCV styles ([[docs/design/factor-qualification-funnel]]); **no industry/size group data** | Without neutralization a "new factor" is often just industry or size exposure | **P1**: let the caller supply a group or market-cap file and compute group-neutral IC |
| Correlation with existing factors | BRAIN requires self-correlation < 0.7 to submit [second-hand]; Numerai MMC/BMC measure marginal contribution to the meta-model [doc]; PandaAI suggests keeping only 2–3 representatives per family [our docs] | **Partial**: overlap with fixed styles plus peer/residual IC among a candidate's own components; **no correlation with the user's own factor library** | This is the key gate that stops a factor library **bloating**; it is also the honest-research question "is this actually new" | **P0** |
| Coverage | BRAIN has coverage/concentration checks [second-hand] | **Present** (coverage is in the Factor tear sheet) | — | Keep |
| Capacity | QC has a Capacity chart [doc]; pyfolio has a capacity tear sheet [doc] | **Present** (Portfolio has a dollar-volume capacity envelope, [[docs/design/portfolio-liquidity-capacity]]); none at the Factor layer | — | Keep |
| Stability by period/regime | BRAIN has sub-universe checks [second-hand]; pyfolio interesting times [doc] | **Present**: fold/regime/asset stability | — | Keep |
| Sample-length guard | PandaAI documentation uses a 60-day example to flag insufficient significance [our docs] | **Partial**: HAC and observation counts reflect it, but there is no explicit "sample too short" warning ([inferred]) | Cheap | **P1** |
| Tear sheet | Alphalens full/summary tear sheet [doc]; jqfactor `create_full_tear_sheet` [doc] | **Present**: Factor Evidence Explorer | — | Keep; export, see section 7 |

## 4. Combination and Portfolio

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Multi-factor combination | Qlib model zoo and ensembles [doc]; BigQuant StockRanker [second-hand] | **Partial**: fixed equal-weight rank blend inside one candidate plus component attribution; no cross-Project multi-factor combination ([inferred]; [[docs/design/cross-study-factor-dependencies]] only covers Factor→RL) | Real strategies rarely use a single factor | **P1**: a "predeclared combination of several verified factors", with the combination method counted as one trial |
| Portfolio optimization | RiceQuant RQOptimizer [doc: name only]; Qlib TopkDropout [doc] | **Missing**: an arbitrary optimizer is deliberately not built; ERC allocation exists | Constrained portfolios are an institutional standard | **P2**: wait for a real need, per the STATUS principle |
| Constraints | QC buying power and margin [doc]; PandaAI has top-N, per-name cap and take-profit/stop-loss forms [our docs] | **Present**: gross/per-asset caps, direction roles, cash, volatility ceiling | — | Keep |
| Costs and slippage | QC has fill/slippage/fee models [doc]; PandaAI has a fee multiplier and slippage [our docs] | **Present**: linear costs, 0/base/25 bps curve, break-even cost | — | Keep; impact-cost model P2 |
| Benchmark | QC Benchmark chart [doc]; PandaAI has benchmark returns [our docs] | **Present**: cash or a named-asset benchmark | — | Keep |
| Attribution | jqfactor style, industry and specific-return attribution [doc]; pyfolio perf_attrib [doc] | **Partial**: asset contribution and signal-to-execution chain attribution; **no style/industry factor attribution** | Separates alpha from beta | **P2**: depends on the group data in section 3 |

## 5. Backtesting and evaluation

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Event-driven vs vectorized | QuantRocket has both: Moonshot vectorized, Zipline event-driven [doc]; LEAN event-driven [inferred] | **Vectorized/bar-level**, conservative OHLC fills, target weights plus Order/TPSL ([[docs/design/order-native-portfolio-decisions]]) | Vectorized is sufficient for research | Keep; do not chase event-driven |
| Realism controls | QC reality modeling: fills, slippage, fees, buying power, settlement, financing rates, short availability [doc] | **Partial**: costs, delayed-Sharpe difference, no-trade band; no borrow or settlement (the Honest boundary explicitly excludes them) | — | **P2** |
| Metrics | QC has PSR, Sharpe, drawdown, rolling statistics [doc]; PandaAI has 10–12 metrics [our docs] | **Present**, plus DSR | — | Keep |
| Out-of-sample | QC: **an organisation administrator can set a holdout period that prevents backtests from using the most recent data** [doc]; pyfolio splits in/out-of-sample statistics [doc]; PandaAI has none [our docs] | **Present and stricter**: validation for selection, test hidden before audit, one-shot frozen external holdout | This is the integrity core | Keep; QC's "organisation-level holdout" idea is worth borrowing as a Workspace-level default sealed tail |
| Walk-forward / rolling | QuantRocket ML has rolling and expanding walk-forward [doc]; Qlib RollingStrategy [doc] | **Partial**: chronological folds and RL fold×seed exist; no rolling re-estimation for Factor/Portfolio ([[docs/design/quant-research-lifecycle]] lists it as a goal) | Tests temporal stability | **P1** |
| Robustness | PandaAI has only textual advice [our docs] | **Present**: parameter neighbourhood, target-window robustness, cost stress, drop-best-5-days | — | Keep |
| Overfitting protection (DSR/PBO, trial counts) | QC has PSR [doc]; Numerai warns that **repeated use of diagnostics overfits** [doc]; neither BRAIN nor PandaAI has a trial ledger (PandaAI per [our docs], BRAIN [inferred]) | **DSR/HAC×N and trial counts present; PBO missing** ([[docs/design/selection-adjusted-research-evidence]]) | The foundation this product stands on | **P1**: PBO/CSCV (slice C) |
| Noise baseline | None of the competitors read have it | **Missing** ([[docs/design/hypothesis-and-idea-verdict]] proposes a noise frontier) | Judge the winner against "how well luck alone could do" | **P1** |

## 6. Search and optimization

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Parameter sweeps | QC optimization is grid search only, a Cartesian product, with a curse-of-dimensionality warning [doc]; QuantRocket has segmented scans [doc]; PandaAI runs at most 63+1 combinations in parallel [our docs] | **Partial**: a predeclared 15-cell parameter neighbourhood, context only, not used for selection; no user-defined sweeps | Users will want to tune; if we do not offer it they tune elsewhere and the trials go uncounted | **P1**: a Tuning task where **every combination counts toward the family** and only adjusted results are shown |
| Tuning task UI | PandaAI has queued/running/aggregated counters, overlaid full curves and a sortable table [our docs]; QC has a Results dashboard [doc] | **Missing** (IA build order 5 not done) | — | **P1** |
| AI assistance | PandaAI "AI optimize" changes the logic and produces a before/after table [our docs]; QC Mia, Research Agent [doc] | **Partial**: external Researcher driver and Campaign budgets ([[docs/design/external-researcher-driver]]); Assistant draft | — | See section 10 |
| Guardrails | QC has only a textual overfitting warning [doc]; Numerai textual warning [doc]; PandaAI has only a 64-combination cap [our docs] | **Present, strongest**: trial N/M double confirmation, Judge decides KEEP/REVERT, budget caps | — | Keep |

## 7. Review, comparison and reporting

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Run comparison | PandaAI has a run history table and four comparison modes [our docs]; Qlib compares through the MLflow UI [doc] | **Partial**: Session Decision Matrix (within one Session); cross-Run history filtering and Compare **not done** (IA build order 4) | One of the most frequent user actions | **P0**: and it must **lock the same baseline** (same universe, window, horizon); refuse the comparison when baselines differ |
| Versions/diffs | PandaAI has code, return and risk comparison [our docs] | **Partial**: Git and hashes exist; Studio has no diff view ([inferred]) | See exactly what changed | **P1** |
| Report export | QC Download Report [doc]; PandaAI exports PDF [our docs]; pyfolio and Alphalens tear sheets [doc] | **Partial**: Report/Dossier are Markdown/JSON and Studio can export JSON; **no HTML/PDF** | To show others, or to archive | **P1**: export self-contained HTML with the test gate applied |
| Notebook | QC research notebook, Mia can work inside notebooks [doc]; QuantRocket uses JupyterLab [inferred] | **Missing** | Researcher habit | **P2**: only "export a Run as a read-only notebook" |
| Sharing | QC can publish a backtest as a link or embed [doc] | **Missing** (local loopback) | — | **P2** |
| Independent review | None of the competitors read have it | **Present**: Independent Review, four evidence classes, correction chain | — | Keep and display prominently |

## 8. Deployment path (AutoQuant deliberately submits no live orders)

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Paper trading | QC paper trading: simulated fills, no slippage by default, multi-asset, automatic restart [doc]; PandaAI paper trading accepts only saved versions [our docs]; BigQuant has a papertrading module [second-hand] | **Missing** (deliberately) | — | No order placement; see the next row |
| Forward shadow tracking (no orders) | Numerai recommends **submitting without stake to track live out-of-sample performance** [doc] | **Missing** | Forward data after freezing is the only sample nobody has truly seen; it is cleaner than any holdout | **P1**: every time new data arrives for a frozen factor, record an immutable forward Run, producing no orders |
| Signal delivery | Qlib Online Serving produces signals in a daily routine but no orders [doc]; Numerai signal submission [doc] | **Partial**: the OpenAlice desk delivers Reports (README); the order-native design has optional host delivery | — | **P2** |
| Monitoring | QC live results and runtime statistics [doc]; QuantRocket has account monitoring and Papertrail alerts [doc] | **Missing** | — | **P2** |
| Decay alerts | Numerai has churn and payout mechanics [doc]; not read for other products | **Missing** | Factors stop working | **P1**: build together with forward shadow tracking |

## 9. Workspace and collaboration

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Projects | Everyone has them | **Present**: Workspace/Project | — | Keep |
| Permissions | QC allows one editor at a time (AI included), separately authorised Live Control, organisation-level IP ownership [doc] | **Missing** (single machine, no authentication, deliberately loopback) | Needed with multiple people | **P2** |
| Audit trail | QC unclear [doc]; Qlib's Recorder logs parameters, metrics and artifacts [doc] | **Present and stronger**: immutable Runs, `.autoquant/studio-actions.jsonl`, Git | — | Keep |
| Notifications | QC can configure notifications at deployment [doc]; QuantRocket uses Papertrail [doc]; PandaAI scheduled tasks [our docs] | **Missing** | Long tasks need a completion reminder | **P2** |
| Settings | — | **Present**: Settings page, selectable up/down colours | — | Keep |
| Onboarding/help | PandaAI has a "?" interpretation guide on every metric and prescribes a result reading order [our docs] | **Partial**: sample project and OPERATOR_GUIDE exist; Studio has **no metric-explanation popovers** ([inferred]) | New users who cannot read HAC t or DSR will not trust the conclusion | **P0**: cheap |
| Empty states | PandaAI has starter template cards [our docs] | **Partial**: the New idea dialog gives CLI commands; with no data package it only offers a PowerShell copy command ([[docs/design/idea-verdict-card]]) | First use gets stuck immediately | **P0**: fold into the "import data" wizard |
| Localization | — | **Present**: English and Chinese ([[docs/design/studio-localization]]) | — | Keep |

## 10. Agent/AI layer

| Capability | How mature products do it | AutoQuant today | Why it matters | Priority |
|---|---|---|---|---|
| Conversation | QC Mia chatbot, selectable model, BYOK [doc]; PandaAI has a conversation workbench, pinnable context and collapsible action chains [our docs] | **Partial**: PR #3 draft, persistent conversations plus a context drawer | — | **P0**: land PR #3 |
| Tool calls | QC provides an MCP Server, Agents/Tasks, Agent Teams [doc]; Mia can create, read, update and delete and run notebooks [doc] | **Present (CLI layer)**: 59 commands, JSON contract, Skills, Work Brief; the Assistant goes through a governed aq broker | — | Keep |
| Explanation | The PandaAI agent honestly says "failed" and gives a before/after table [our docs] | **Partial**: Work Brief, Agenda, Report written by the Agent | — | **P1**: the Assistant outputs "before/after comparison for this trial plus the trial number" |
| Governance | QC AI documentation **mentions no approval or guardrails** [doc]; PandaAI has an Auto/Approve switch, but in hands-on use a single "OK" changed saved code [our docs] | **Present, strongest**: action preview, command hash, double confirmation, trial N/M, the Agent cannot judge KEEP itself | — | Keep; this is the differentiator |
| Scheduled/automatic tasks | QC Tasks have schedules [doc]; PandaAI scheduled tasks [our docs] | **Missing** (unbounded loops deliberately not built) | — | **P2**: only for forward shadow tracking |

---

## 11. Conclusions

### (a) Top-15 P0/P1 items in the suggested build order

| # | Item | Priority | What the user sees |
|---|---|---|---|
| 1 | Studio "import data" wizard plus a data quality report (missing data, jumps, zero volume, long suspensions, whether delisted assets are present) | P0 | On first launch they can turn their own CSV into a research-ready dataset and see one page of "problems in this data" |
| 2 | Metric explanation popovers plus a result reading order (HAC t, DSR and trial N each get a one-sentence explanation) | P0 | Every number has a "?" beside it, and a newcomer can understand why the conclusion is Supported/Inconclusive |
| 3 | Run history filtering plus same-baseline Compare (refused when baselines differ) | P0 | Pick two Runs to get a side-by-side comparison with a difference column; when baselines differ it says "not comparable" and why |
| 4 | Factor-library redundancy check: correlation and residual IC of a new factor against the user's existing factors | P0 | The factor card shows "correlation 0.82 with X, residual IC 0.01", flagging a likely duplicate |
| 5 | Strategy workbench (build a portfolio from verified factors, Backtest/Versions/Analyses tabs) plus a New strategy action | P0 | Go from a Supported factor to an after-cost portfolio backtest without leaving Studio |
| 6 | Land the PR #3 Assistant (Claude first); every change shows the trial number and a before/after comparison | P0 | A side conversation can read the current object and propose changes, and a trial is counted only after confirmation |
| 7 | Complete the Factor tear sheet: configurable 5/10 quantiles (frozen parameter), per-group turnover, IC-autocorrelation warning, after-cost long-short, short-sample warning | P1 | Users familiar with Alphalens/JoinQuant see the charts they expect, already net of costs |
| 8 | Group neutralization: the caller supplies an industry or market-cap file and gets group-neutral IC | P1 | They see "IC falls from 0.04 to 0.005 after neutralization" and know it was just industry exposure |
| 9 | Dated universe membership files, with a survivorship caveat on the Verdict | P1 | The conclusion is labelled "membership by historical date" or "warning: current membership used" |
| 10 | Tuning task: every combination counts toward the family, only adjusted results are shown, overlaid with a noise frontier | P1 | The tuning page shows 58 curves, a "luck ceiling band" and the adjusted best value instead of a bare winner |
| 11 | PBO/CSCV (slice C) | P1 | `pbo-not-computed` on the Strategy verdict becomes a number |
| 12 | Hypothesis/Verdict objects and the Refuted protocol (H1–H17) | P1 | A factor can be formally marked "refuted", with a reviewable saved rationale |
| 13 | Sealed-tail holdout inside Studio (borrowing QC's organisation-level holdout idea: the Workspace seals the most recent N months by default) | P1 | New projects automatically seal the latest period; the UI shows a lock and the unlock condition |
| 14 | Report export to self-contained HTML (and printable PDF), with the test gate still enforced | P1 | One click produces a tear sheet file that can be sent to a colleague |
| 15 | Forward shadow tracking plus decay alerts (after freezing, every new data arrival produces an immutable forward Run, with no orders) | P1 | The factor card gains a "forward IC over 63 days since freezing" curve; on decay it enters the Attention list |

### (b) Where AutoQuant is stronger than most products and should always be visible

1. **Trial counts and family-wise/DSR adjustment.** Among the competitors read,
   only QC shows PSR, and none shows "how many attempts were made". PandaAI
   reports the winner directly after 59 tuning runs ([our docs]). Cards and
   buttons always show trial N/M.
2. **Test hidden before audit, plus a frozen external holdout.** QC's
   organisation-level holdout is the closest; PandaAI has a single interval.
3. **Frozen question and question hash**: a declaration made in advance rather
   than a justification found afterwards. None of the competitors read have
   it.
4. **A fixed Verdict vocabulary that can say "uncertain"**
   (Supported/Inconclusive/Could not be tested). PandaAI still shows a coloured
   Sharpe and offers a "build strategy" button at t=0.04 ([our docs] §5d).
5. **Judge decides, not the Agent**; every action has a command preview, hash,
   double confirmation and audit log. QC's AI documentation describes no
   guardrails.
6. **Immutable evidence chain plus Independent Review plus correction chain**;
   failed Runs are retained too.
7. **File-backed and Agent-resumable**: work can be recovered without private
   chat context. This is a superset of approaches such as Qlib's Recorder.

### (c) What mature products do that AutoQuant should **deliberately not copy**

| Do not copy | Who does it | Reason (in relation to research integrity) |
|---|---|---|
| Leaderboards and competitions ranked by raw IC or returns | BRAIN daily challenges and IQC [doc: marketing page]; PandaAI competitions [our docs] | A leaderboard is essentially a multiple-testing generator; the winner is mostly luck |
| Uncounted diagnostic tools that allow unlimited resubmission | Numerai diagnostics (they warn themselves that it overfits) [doc] | Every look at validation or test is a selection and must count toward the family |
| Threshold tables as verdicts (\|IC\|≥0.02, Sharpe≥1.2, etc., without trial adjustment) | PandaAI [our docs]; community BRAIN thresholds [second-hand] | Unadjusted fixed thresholds are bound to be crossed under repeated attempts |
| AI changing saved code or parameters from a single sentence | PandaAI hands-on [our docs] §5g | Changes must be versioned, carry a trial number and be decided by the Judge |
| An "Auto" mode that skips approval | PandaAI Auto/Approve switch [our docs] | Approval for holdout unlock and Verdict promotion must be mandatory, not a session-level toggle |
| Cards that show only the headline number of the latest Run | PandaAI strategy cards [our docs] | It hides N; cards should show the Verdict, trial count and holdout status |
| Reporting tuning results on the tuning window itself | PandaAI tuning [our docs]; QC grid can be used this way too [inferred] | Selecting and reporting on the same window is in-sample |
| Automatic order placement, one-click live deployment | QC live [doc]; PandaAI Pro client [our docs] | Beyond research authority (README boundary); a research conclusion is not trading authorisation |
| Silent data services (downloading for the user and "guaranteeing" adjustment or survivorship-free data) | BRAIN, JoinQuant and RiceQuant hosted data [inferred] | AutoQuant cannot certify these semantics and should state that honestly instead of pretending |
| Decorative 3D group-return surfaces, ten-metric walls without a conclusion | PandaAI [our docs] | Piling up metrics without a conclusion pushes judgement onto the reader, who will pick the number they like |
| Community strategy copying, emphasis on "trending" | BigQuant strategy community [second-hand]; QC public backtests [doc] | Public sharing must be preceded by a Review; share Reports, not re-runnable "bait" |

---

## 12. Source URLs

QuantConnect

- https://www.quantconnect.com/docs/v2/cloud-platform/optimization
- https://www.quantconnect.com/docs/v2/cloud-platform/optimization/strategies
- https://www.quantconnect.com/docs/v2/cloud-platform/backtesting/results (includes the organisation-level holdout period description)
- https://www.quantconnect.com/docs/v2/cloud-platform/live-trading/brokerages/quantconnect-paper-trading
- https://www.quantconnect.com/docs/v2/writing-algorithms/reality-modeling/key-concepts
- https://www.quantconnect.com/docs/v2/cloud-platform/projects/collaboration
- https://www.quantconnect.com/docs/v2/writing-algorithms/datasets/quantconnect/us-equity-security-master
- https://www.quantconnect.com/docs/v2/ai-assistance
- https://www.quantconnect.com/docs/v2/ai-assistance/predefined-agents/mia
- https://www.quantconnect.com/docs/v2/ai-assistance/predefined-agents/research-agent
- https://www.quantconnect.com/forum/discussion/13441/alpha-streams-refactoring-2-0/ (Alpha Streams 1.0 shutdown, forum announcement, undated)

Qlib

- https://qlib.readthedocs.io/en/latest/
- https://qlib.readthedocs.io/en/latest/advanced/PIT.html
- https://qlib.readthedocs.io/en/latest/component/data.html
- https://qlib.readthedocs.io/en/latest/component/recorder.html
- https://qlib.readthedocs.io/en/latest/component/online.html

Numerai

- https://docs.numer.ai/numerai-signals/signals-overview
- https://docs.numer.ai/numerai-signals/scoring
- https://docs.numer.ai/numerai-tournament/scoring/meta-model-contribution-mmc

Alphalens / pyfolio / QuantRocket

- https://alphalens.ml4trading.io/
- https://pyfolio.ml4trading.io/
- https://www.quantrocket.com/docs/

Chinese platforms

- https://github.com/JoinQuant/jqfactor_analyzer (the JoinQuant website joinquant.com blocks non-mainland IPs; platform documentation was not read)
- https://www.ricequant.com/doc/ (the RQFactor subpage returned 403)
- https://bigquant.com/wiki/home (navigation only)

WorldQuant BRAIN (official documentation not readable)

- https://www.worldquant.com/brain/ (marketing page)
- [second-hand] https://github.com/zl3311/alpha-mining
- [second-hand] https://www.quantt.co.uk/resources/worldquant-brain

AutoQuant itself (read-only)

- [[README]], [[docs/STATUS]], [[docs/STUDIO]],
  [[docs/design/studio-information-architecture]],
  [[docs/design/idea-verdict-card]], [[docs/design/studio-local-actions]],
  [[docs/design/studio-mods]], [[docs/design/pandaai-reference-notes]],
  [[docs/design/pandaai-frontend-study]],
  [[docs/design/pandaai-mechanisms]],
  [[docs/design/factor-qualification-funnel]],
  [[docs/design/selection-adjusted-research-evidence]],
  [[docs/design/hypothesis-and-idea-verdict]],
  [[docs/design/research-intake-and-dataset-snapshots]]
- PR #3: https://github.com/2233admin/Auto-Quant-V3/pull/3 (DRAFT)
