# PandaAI mechanisms and framework

Status: consolidated study note for AutoQuant V3 design. Methods and ideas
only; nothing here is implemented and no product code changes with it.
Date: 2026-11-05. It merges four earlier notes and a fresh reading of the
open-source tree into one mechanism-level picture:
[[docs/design/pandaai-reference-notes]] (live Qube, EVO and A2A observations,
2026-10-31), [[docs/design/panda-quantflow-logic-notes]] (open-source code
reading), [[docs/design/pandaai-frontend-study]] (page-by-page layout) and
[[docs/design/panda-display-gap-matrix]] (display gaps against our Studio).
Our own counterparts are [[docs/design/hypothesis-and-idea-verdict]],
[[docs/design/idea-verdict-card]] and [[docs/design/studio-assistant]]; the
Shinka counterpart is `docs/research/design.md` in the ShinkaEvolve fork
(`E:\projects\ShinkaEvolve`), which is not part of this repository.

Evidence tags, used on every claim:

- OBSERVED: seen by us on a public page or in the owner's signed-in session
  (read-only, owner-approved runs, 2026-10-31).
- CLAIMED-BY-VENDOR: vendor documentation or marketing prose; not verified in
  the product.
- CODE-READ: read in the open-source checkout
  `D:\projects\Quantitative\panda_quantflow` (HEAD `c5b89c6`); never executed.
  Not proof that the hosted product runs the same code.
- UNKNOWN: behind login, not shown, or not in the checkout.

Licence boundary: the checkout carries the GNU Affero General Public License
v3 (`LICENSE` header, verified 2026-11-05; the task brief said GPLv3, the file
says AGPL-3.0, which is stricter for network services). This note describes
mechanisms in our own words. Nothing is copied and nothing may be pasted into
AutoQuant. Names, marks, doc prose, screenshots and thresholds are not ours to
reuse (see [[docs/design/pandaai-reference-notes]] section 7).

## 1. Summary

PandaAI (site `pandaaiquant.com`) is a Chinese-market quant platform selling
compute credits (OBSERVED). **Qube** is the chat-based research workbench: an
LLM agent writes strategy code or a factor expression, a validation badge
gates the run, a backtest or factor analysis runs on the platform's data, and
results become versioned assets in a strategy library and a factor library
(OBSERVED for the factor lane and strategy lane through the owner's account;
CLAIMED for the rest of the docs). **Factor Center** is a platform-wide
screening board over a universe and window, with a capped personal factor
pool (CLAIMED). **EVO** is a persistent cloud workstation with an agent
harness in which a central agent dispatches researcher and reviewer
sub-agents (CLAIMED; the route redirected to the home page, UNKNOWN).
**A2A Office** is a multi-agent team with a meeting room, marked "coming soon"
(CLAIMED). The **Pro client** is a live-trading terminal reached after paper
trading (CLAIMED; the market terminal inside Qube is OBSERVED). The open-source
**panda_quantflow** is a separate node-workflow platform plus a backtest
engine; its LLM chat routes exist in the tree but the chat agent, the tuner
and the factor analytics are not in it (CODE-READ). The relationship: Qube is
the agent front door over the same asset chain (factor, strategy, version,
paper trade) that quantflow exposes as a manual node graph; EVO and A2A add
orchestration around the same chain; Factor Center feeds it with candidate
factors. What none of them add is a verdict (section 5).

## 2. Idea to artifact pipeline

One row per step. "Human gate" lists where a person must act. All steps are
Qube unless stated.

### 2.1 Intake

- Mechanism: a free-text chat plus "capability templates", verified starter
  prompts grouped by market and scenario (moving-average trend, turtle
  breakout with ATR stop, 20-day momentum factor, low PB plus high ROE
  composite, price-volume correlation factor, strategy porting). The docs
  say a good request has six elements: market, symbol, signal logic,
  position sizing, risk control, backtest specification; missing elements
  trigger follow-up questions. Source: [[docs/design/pandaai-reference-notes]]
  section 2.
- Strategy-from-factor has a second intake: a constraints form (universe,
  dates, capital, direction, rebalance period, top-N, weighting, maximum single
  weight, rebuy buffer, minimum hold days, take-profit, stop-loss, exclude ST)
  that hands off to the chat agent. The page states it does not auto-backtest.
  Took 4 min 25 s and about 6 credits in our run.
- Input: prose, a template, or a form. Output: a prompt the agent turns into
  code; the "six elements" are a checklist in the docs, not a stored schema we
  could see.
- Human gate: the person types the idea and answers follow-up questions.
- Tags: templates OBSERVED (home page cards); six elements and follow-up
  questions CLAIMED-BY-VENDOR; constraints form OBSERVED; whether the six
  elements exist as a typed object on the server UNKNOWN.
- Why it matters: this is the step that converts a vague sentence into
  parameters the machine can run. The converted spec is not frozen and not
  falsifiable (no refutation criterion, no threshold set before the run), but
  the conversion itself is smooth. This is our weakest step (section 6).

### 2.2 Generation

- Mechanism: the agent writes code (a single `STRATEGY_PARAMS` dict plus
  logic, with a warmup guard that raises if data is short) or a factor
  expression; a process panel shows "processing done, N seconds" and a
  collapsed action trail (thinking, capability load, task delegation, tool
  calls) that expands to the full chain, which the docs call the first place
  to locate errors. For a strategy built from a factor the agent runs a
  code-quality gate and a strategy-spec check before saving to the library.
- Input: the intake prompt, pinned context chips (a factor or strategy can be
  pinned as context). Output: code or expression saved as an asset, plus the
  action trail.
- Human gate: only in Approve mode (section 4.1); in Auto mode none.
- Tags: action trail and pinned chip OBSERVED (23-action trail on the AI
  optimize run); warmup guard and code-quality gate CLAIMED and partly
  OBSERVED (the gate was named in the build-strategy run); the open-source
  tree has three LLM routes (code, backtest and factor assistants, each
  streaming and non-streaming) but no agent loop (CODE-READ).

### 2.3 Validation badge and quality gates

- Mechanism: before a run the editor shows a validation badge ("passed") and
  the run button is gated on it. For strategy-from-factor, a code-quality
  gate and a spec check precede library entry. These are syntax, API and
  structure checks, not statistical checks.
- Input: code. Output: pass or fail badge, error text.
- Human gate: none (automatic).
- Tags: badge OBSERVED on the factor detail page (the code editor shows it);
  gate semantics CLAIMED. A statistical gate (significance, sample length,
  overfitting) is absent: the factor page offered "build strategy" and
  printed coloured Sharpe 0.22 and annualised 7.71 percent with t = 0.043 and
  IC mean and Rank IC of opposite sign, and nothing flagged it (OBSERVED,
  [[docs/design/pandaai-reference-notes]] section 5d).

### 2.4 Backtest and analysis

- Factor analysis: nine stages with a progress bar, a run selector (timestamp
  dropdown), a group cumulative-return chart with long-short lines, and a
  metrics grid (factor return, Sharpe, annualised return, max drawdown, IC
  mean, Rank IC, IC std, ICIR, IR, probability of IC beyond plus or minus 0.02,
  t statistic, p-value). Our run: CSI 300, six months, 5-day rebalance, 5
  groups, finished in 6 seconds for 1 credit. OBSERVED.
- Strategy backtest: eight stages, a 12-number grid including benchmark
  return, Sortino and Calmar, a net-value curve with buy and sell markers,
  a holdings table. Our run: 22.42 percent total, 50.87 percent annualised,
  Sharpe 1.41, max drawdown 17.09 percent, 336 trades, benchmark minus 5.19
  percent, on the same six-month window the factor had been tuned on.
  OBSERVED. Nothing reconciled this with the factor page's Sharpe of 0.22.
- Backtest parameters (date range, capital, margin multiplier, slippage, fee
  multiplier, frequency, benchmark) and run records with parameter snapshot
  and PDF export are CLAIMED; the run selector, re-run and export buttons are
  OBSERVED.
- Human gate: the person presses run (credits are spent). Backtest is not
  automatic after generation: "does not auto-backtest" is the default.
- Open-source counterpart: the event-driven stock and futures engine exists
  in the tree (fill at open or close, commission with a floor, stamp duty on
  sells, limit-up and limit-down rejection, suspension rejection, volume cap
  in board lots, T+1, 250-day annualisation; CODE-READ,
  [[docs/design/panda-quantflow-logic-notes]] section 2). Whether the hosted
  product uses it: UNKNOWN.

### 2.5 AI optimize versus parameter tuning

Two separate tools with a stated boundary (CLAIMED in docs, both OBSERVED in
use):

| | AI optimize | Parameter tuning task |
|---|---|---|
| Changes | logic or formula | numeric parameters only, code untouched |
| Output | one new candidate (and a version if the user saves) | up to 63 candidates plus one baseline, cap 64 concurrent runs |
| Objective | free; agent reads the baseline run and decides | one objective chosen at task creation (we saw total return) |
| Apply | agent rewrites; see below | manual "apply" per row, then save as version; "default: do not auto-apply" |

- AI optimize (OBSERVED, about 4.4 credits): the agent read the baseline,
  said in plain words that the signal was not significant, rewrote the
  formula, reran, and reported a before and after table (IC 0.0026 to
  minus 0.0206, annualised 7.71 to minus 22.92 percent, Sharpe 0.22 to minus
  1.11). It called the attempt a failure and offered restore or continue. But
  it had overwritten the saved formula, and version history stayed empty, so
  the original was not recoverable from the product.
- Tuning (OBSERVED, about 68 credits): the chat agent reads the strategy's
  parameter block, designs up to 63 numeric candidates, validates them,
  creates a task. Live view has queued, running and aggregated counters, a
  per-combination status matrix, an overlay of all net-value curves
  normalised to 1, and a sortable table. 58 combinations finished in about
  4.5 minutes with zero failures. Best: top-5 holdings, total return 30.82
  percent against 22.42 baseline, Sharpe 1.64, on the same single six-month
  window.
- No auto-apply is only the button default. A follow-up chat turn ("ok")
  applied the best parameters and edited the saved strategy code (top_n 10 to
  5) without offering a version (OBSERVED). So "no auto-apply" holds for the
  tuner, not for the chat agent. Auto mode appears to be the cause (section
  4.1), UNKNOWN as a formal statement.
- The docs prescribe a three-layer reading of tuning results: best combo,
  stable region (neighbours also good), risk constraints; and "if the best
  candidate does not beat the benchmark, suspect the logic, not the
  parameters" (CLAIMED). Recommended order: baseline version, signal window,
  liquidity filter, stop rules, trend filter; one change per version.
- Open source: only parameter injection into the strategy context exists; no
  search loop, no counter, no objective (CODE-READ). The tuner is hosted-only.

### 2.6 Versioning

- Mechanism: explicit "save as version" produces V1, V2 and so on, tagged as
  human edit or system optimization; rollback and a compare view on code,
  return, risk, stability, trade frequency, explainability (CLAIMED).
  Strategy tabs: parameters, version history, backtest history, tuning
  history, AI repair (OBSERVED). Each run keeps a parameter snapshot
  (CLAIMED).
- Gap found in use: versions are only created on an explicit save; the
  AI-optimize overwrite and the chat-applied tuning change created none
  (OBSERVED). The version chain is a convenience, not an audit trail.
- Open source: the factor analysis result is one document per factor, upserted
  by factor id, so a re-run overwrites the earlier result (CODE-READ,
  [[docs/design/panda-quantflow-logic-notes]] section 4.1).

### 2.7 Promotion to paper trading

- Mechanism: paper trading ("simulation disk") requires a saved strategy
  version. The dialog says it never connects real money (OBSERVED). Paper
  account metrics: net unit value, return, annualised, Sharpe with
  risk-free zero, Sortino, max and current drawdown, floating PnL, minute
  equity curve, daily report download (CLAIMED). From paper trading the next
  step is the Pro live client (CLAIMED). The docs name paper trading as the
  place where look-ahead, timing bias and liquidity show up.
- Human gate: the person creates the paper account from a saved version. No
  statistical gate: nothing checks that the version has evidence.
- Worth keeping: only a saved, versioned artifact can be promoted. Account
  was empty so paper trading itself was not seen running (OBSERVED, zero
  paper accounts).

## 3. Framework and architecture

### 3.1 Quantflow node model (CODE-READ)

The open-source platform is a visual workflow engine. Everything below was
read, not run.

- **Node registry.** A node is a class deriving from a base work node and
  registered by a decorator that takes a display name, a group path
  (slash-separated, shown as a palette tree), a type tag, and a box colour.
  Registration writes a class-name-keyed global dictionary; the type tag
  drives special nodes (for example code and result nodes). There are about
  50 built-in nodes: code and formula input, read and save CSV, factor build
  variants (formula, PCA, Spearman, multi-factor merge, ML-based), factor
  analysis, IC calculation, correlation, grouping, weight adjustment, feature
  engineering, six ML nodes (LightGBM, XGBoost, random forest, SVM, GRU,
  LSTM), model save and load, and stock and futures backtest plus a result
  node. A `custom/` folder is the plugin point.
- **Typed ports.** Each node declares a pydantic input model and an output
  model. A UI decorator maps fields to controls (date picker and so on), so
  one model drives both validation and the form. Output models may hold
  dataframes via an arbitrary-types flag.
- **Workflow object.** Nodes with static inputs, links between node uuids,
  feature tags; JSON import and export is advertised as the way to share and
  reproduce workflows. The graph is mutable and has no content hash.
- **DAG execution.** The runner counts incoming links per node and runs
  Kahn-style layering: all nodes with no pending inputs form layer 0, their
  successors whose count reaches zero form the next layer, and each layer's
  nodes are returned as a parallelisable group. No start node or leftover
  nodes means a cycle and the run raises before executing. Nodes within a
  layer can run concurrently.
- **Run state.** A workflow run record holds status (including a manual-stop
  state that the runner polls), progress 0 to 100, lists of running, succeeded
  and failed node ids, traversed link ids, last error message and stack
  trace, and a map from node uuid to output id. Progress is meaningful
  because node boundaries are real. A failed node is attributable.
- **Outputs.** Each node's output object is serialised with a general pickle
  library and stored in a MongoDB GridFS bucket, with metadata naming the
  class, run id, node id and owner; the run's output map holds the GridFS id.
  A smaller collection variant exists for objects under the document size
  limit. Consequence: outputs are opaque binary, and loading them executes
  code from the database.
- **Result nodes** hold only a task id; backtest results live in separate
  collections (summary, per-day profit, account, positions, trades, custom
  charts), served by paged routes with default page size 10 and no sort. All
  numbers are stored and served as strings.
- Hosted behaviour of the same model: UNKNOWN. Qube's UI shows stage bars
  ("9 stages", "8 stages") which look like node-boundary progress, but we
  have no payload.

### 3.2 Open source versus hosted-only

| Capability | In the open-source tree | Hosted only or external | Tag |
|---|---|---|---|
| Node registry, DAG runner, run state, GridFS outputs | yes | | CODE-READ |
| Stock and futures backtest engine, metric set | yes | | CODE-READ |
| Factor analysis maths (IC, groups, decay) | no, imports a separate `panda_factor` package (cloned from another repository, in our archive) | | CODE-READ |
| Market data reader | no, imports `panda_data` (external, paid SDK, MCP and REST) | yes | CODE-READ, CLAIMED |
| LLM chat routes (code, backtest, factor assistants) | routes only | agent loop, tools, templates | CODE-READ, UNKNOWN |
| Parameter tuner (64-run) | no, only parameter injection | yes | CODE-READ, OBSERVED |
| Version history, run selector, PDF export | no web UI in this tree | yes | OBSERVED |
| Paper trading, live trading | trading package with CTP interfaces; planned items include QMT and crypto | Pro client | CODE-READ, CLAIMED |
| EVO workstation, A2A meeting room | no | yes | CLAIMED |
| Scheduled tasks | a schedule package that is an empty skeleton | yes | CODE-READ, OBSERVED (demo text) |
| Factor Center (platform factor board) | no | yes | CLAIMED |

README itself lists "LLM support", API-style workflow invocation, CTP and QMT
live trading and crypto as planned (CODE-READ), which supports reading the
open source as an older, manual-graph generation of the product.

### 3.3 Data layer

- A-shares (SSE and SZSE) and futures for Qube; the data docs also list funds,
  indices, HK and US stocks, macro (CLAIMED). Factor universes: all A, CSI
  300, CSI 500, CSI 1000; windows half year to three years (CLAIMED). The
  market terminal lists 5,223 symbols, A-share only, no crypto (OBSERVED).
- Access by Python SDK `panda_data`, MCP and REST; unsubscribed sources show
  "no permission" in results (CLAIMED). Data and compute are paid in credits
  (OBSERVED tiers; 1 credit about 0.1 CNY).
- Point-in-time universe membership, delisting handling, survivorship,
  suspension handling in the data layer: UNKNOWN (the reader is not in either
  checkout). The backtest engine's own limit-up, suspension, T+1 and volume
  rules are CODE-READ; the factor path flags untradable bars on the signal
  day, not the entry day (CODE-READ).

## 4. Agent and multi-agent mechanisms

### 4.1 Auto versus Approve

- A single dropdown. In Approve mode the agent waits for confirmation at key
  execution nodes (tool calls); in Auto mode it proceeds. The docs say this is
  a tool-call approval switch, unrelated to optimization quality (CLAIMED).
  The control is OBSERVED in the composer row (model picker, thinking-effort
  picker, mode). Which tool calls count as "key nodes" is UNKNOWN.
- Observed interaction with credits: runs the owner approved cost 1 to 68
  credits. Observed side effect: a short follow-up turn applied tuned
  parameters and edited saved code with no version. So the approval gate
  protects tool-call execution, not research state.
- Verified: control exists. Claimed: its semantics. Not verified: what Approve
  mode blocks in practice (we ran with owner approval per action, outside the
  product's own gate).

### 4.2 EVO researcher and reviewer

- Claim: a central agent decomposes a goal and dispatches isolated
  sub-agents; a researcher produces, a reviewer "independently cross-checks
  adversarially", "survivors win"; models, memory, skills, tools and approvals
  live in a harness and are fully traceable; a persistent cloud workspace per
  account (CLAIMED, home page block and `/docs/evo`).
- Not verified: the route redirects to the home page without login, so layout,
  what the reviewer can reject, whether reviewer output is stored, and whether
  "survivors win" is a rule or a metaphor are UNKNOWN. The shape (producer,
  adversarial checker, selection) matches the pattern our Shinka skeptic and
  Hypothesis verdict use, but with no visible criteria it cannot be assumed to
  be a statistical check.

### 4.3 A2A meeting room

- Claim: a host agent plus market, news, fundamental and risk agents, and a
  "meeting room" where conclusions are cross-checked before the final result.
  The docs page says "coming soon" (CLAIMED). Nothing about its mechanics is
  verified. Treat it as roadmap marketing.

### 4.4 Scheduled tasks and persistence

- A scheduled-task demo on the home page ("ran 23 times, next 09:15") and a
  persistent cloud workspace (OBSERVED as demo text, CLAIMED in docs). The
  open-source schedule package is empty (CODE-READ). What a scheduled task can
  do unattended, and whether it can spend credits or apply changes, is
  UNKNOWN.

### 4.5 Process disclosure

The one agent mechanism we verified and rate highly: a collapsed "N actions"
line that expands into the tool-call chain, per-session status dot, pinned
context chips for the artifact under discussion, and next-step quick buttons
after each answer (OBSERVED). The agent also states failure honestly when
asked to optimize a non-significant signal (OBSERVED, section 2.5).

## 5. Evidence and overfitting controls

### 5.1 What exists

All CLAIMED unless noted:

- Cost knobs: slippage, fee multiplier "for cost stress test", margin
  multiplier. Advice to rerun with higher fees when return is high and trade
  count is abnormal.
- Sample-length warning in prose, with a worked example (a 60-day low-vol
  factor over about half a year, Rank IC 0.0334, t = -0.288, p = 0.7761,
  monotonicity 0.38, judged not valid).
- Factor dashboard: IC, Rank IC, ICIR, p, t, monotonicity, decay by lag, IC
  autocorrelation with warning bands (above 0.8 suspect leakage or overlap,
  below 0.2 near white noise), IC skew and kurtosis, five-group returns, group
  turnover; "four dimensions must cross-validate".
- Tuning reading rules (best, stable region, risk) and a candidate-curve
  overlay (OBSERVED) so dispersion is visible.
- Warmup guard in generated code; paper trading as the look-ahead catch.
- Porting honesty: a port that cannot be equivalent must name the gap.
- Reference thresholds in prose: absolute IC at least 0.02, absolute ICIR at
  least 0.5, p below 0.05, annual return at least 15 percent, max drawdown at
  most 20 percent, Sharpe at least 1.2.
- The agent's own honest failure statement (OBSERVED).

### 5.2 What is absent

All "not shown" by absence in docs and in the live pages we ran (OBSERVED
absence unless noted):

- Out-of-sample or holdout split: not shown. One date range per run. In the
  open-source factor path there is no split, purge or embargo; lookahead
  protection is a one-bar execution delay (CODE-READ).
- Trial count or search ledger: not shown, except the 64-combination cap.
  No cumulative count of strategies, versions or prompts tried.
- Multiple-testing correction (Bonferroni, deflated Sharpe, PBO, reality
  check): not shown. The quoted p cut-off is 0.05 with the caveat that
  significance is not predictive validity.
- Pre-registered hypothesis or kill criteria: not shown.
- Costs in the headline: not shown; default fee and slippage, stress test is
  advice. The open-source factor path charges zero commission (CODE-READ).
- Noise or random-baseline comparison: not shown.
- A verdict that can say "reject" or "inconclusive": not shown. Thresholds
  are reference ranges.
- Reconciliation across pages: the strategy page's Sharpe 1.41 on a factor
  whose own page showed Sharpe 0.22, both on the same six-month window used
  for tuning, with no in-sample flag.

### 5.3 Observed numbers (all 2026-10-31, owner-approved runs)

| Object | Window | Numbers | Reading |
|---|---|---|---|
| Momentum factor `close/delay(close,20)-1`, CSI 300, 5-day rebalance, 5 groups | 2026-02-21 to 2026-08-20 | IC mean 0.0026, Rank IC -0.0248, t 0.0432, Sharpe 0.22, annualised 7.71% | Not significant, signs disagree; build-strategy still offered |
| After AI optimize | same | IC -0.0206, annualised -22.92%, Sharpe -1.11, monotonicity 0.30 to 0.83 | Agent called it a failure; saved formula overwritten |
| Strategy built from the factor | same six months | total 22.42%, annualised 50.87%, Sharpe 1.41, drawdown 17.09%, 336 trades, benchmark -5.19% | Rests on an insignificant factor in-sample |
| Tuning, 58 of 64 combinations done | same | best top-5: 30.82%, Sharpe 1.64 vs 22.42% | 59 trials, no deflation, same window, objective equals reported number |

### 5.4 Open-source evidence defects worth knowing (CODE-READ)

Non-reproducible group assignment (unseeded noise on ties), user-chosen
direction after seeing IC sign, t-test that turns missing IC into zero,
back-filled IC labels used for ML training (true look-ahead), ML nodes that
evaluate on the training set, and a sample strategy whose fitness reuses the
window that built the factor. Full list: [[docs/design/panda-quantflow-logic-notes]]
section 7. These explain why a Panda-style metric grid is not an evidence
standard.

## 6. Mapping to AutoQuant V3 and Shinka

V3 status words: **built** (implemented), **slice** (implemented narrowly),
**proposed** (design only, per [[docs/design/hypothesis-and-idea-verdict]]),
**gap** (no design). Shinka means the research layer in the ShinkaEvolve fork
(program, hypothesis tree, frozen evaluator, skeptic, notebook, lockbox).

| Panda mechanism | V3 equivalent (or gap) | Shinka equivalent (or gap) | Take / beat / skip |
|---|---|---|---|
| Free-text idea in chat, capability templates, follow-up questions to fill the six elements | slice: Ideas page creates a dedicated Project from the question and hashes the wording ([[docs/design/idea-verdict-card]]); decision-signal factor claims only; arbitrary prose is not translated into an executable hypothesis. proposed: `frame-hypothesis` skill and `aq hypothesis route` for classification. Convention built: AGENTS.md "ask the caller" rule and `research.md` brief | Human writes `program.md`; agent proposes 3 to 8 falsifiable hypotheses; human picks; gap: no template library, no structured question loop | **Take** the template library and the targeted follow-up pattern; **beat** by making the output a frozen falsifiable spec |
| Six request elements (market, symbol, signal, position, risk control, backtest spec) | partial: strict `request.json` (universe, horizon, direction, factorPolicy, outcome); gap: position, risk control and cost are not in the Factor request, and nothing maps the six elements to our fields | Hypothesis md has test method plus support and refute criteria; no market-spec form | **Take** as the checklist an intake assistant walks; map each to a request or Hypothesis field |
| Constraints form before generation (strategy from factor) | proposed: Hypothesis `universe`, `horizon`, `costs`, `baseline` fields; Portfolio Lab has caller-owned policy docs | none | **Take** the form; **beat** by freezing and hashing it before the first trial |
| Code plus factor expression written by agent | slice: expression entry produces the ordinary pandas candidate; explicit first candidate, never the template demonstrator | agent edits the EVOLVE-BLOCK only | **Skip** hosting generation; **take** expression as the low-barrier entry (already done) |
| Collapsed action trail, pinned context chips | slice: [[docs/design/studio-assistant]] timeline of observable provider and tool events, drawer with identifiers | none | **Take** (mostly there); do not fabricate hidden reasoning |
| Validation badge before run; code-quality gate | built: Core preflight on `session start`, failed guard spends no trial, `session check` | evaluator rejects incorrect programs, lookahead truncation test | **Skip** (ours is stronger) |
| Backtest page order: metrics, curve, holdings, fills; stage progress | slice: Factor page FactorHero plus MetricGrid; run selector; stage line only when recorded | none | **Take** reading order and honest stage disclosure; **skip** invented progress |
| Auto vs Approve toggle | Studio Assistant: per-trial confirmation with exact command hash, fixed trial budget, Core trial gate; Auto write mode is an owner decision still gated | humans only at hypothesis selection and conclusion | **Beat**: approval is mandatory at trial spend, holdout open and promotion, not a per-session toggle |
| AI optimize (logic change) | Session experiments (KEEP/REVERT/CRASH) with counted trials | evolution loop, public metrics select | **Beat**: judge decides keep or revert; every rewrite is a numbered version |
| Parameter tuning task, cap 64, overlay of all curves, sortable table | partial: Portfolio parameter neighborhood (15 configs of scalars); noise frontier chart in Factor; gap: no per-config growth series, no apply flow | PBO over up to 64 programs on dev data, DSR with N trials | **Take** the live matrix and overlay; **beat** with trial-deflated best-of-N, noise frontier and stable-region check, objective on validation not on the reported window |
| Versions V1.., human or system tag, rollback, compare | built: immutable Runs, Sessions, Experiments; Compare page with basis lock; slice: no source diff published | notebook.json, results DB, git | **Take** the human-vs-system provenance tag and a source diff view; **skip** mutable overwrite |
| Promotion only from a saved version to paper trading | built conceptually: guarded promotion in Session; Core gives no trading authority, handoff projection only | forward test is a manual last gate (out of tool) | **Take** the versioned-artifact gate; promotion also needs a verdict |
| Factor Center board, pool cap, sort by Rank IC | gap by design: a leaderboard on raw IC is a multiple-testing generator; family trial ledger exists ([[docs/design/desk-trial-families]]) | none | **Skip** the board; **take** the "keep representatives, not near-duplicates" correlation warning |
| IC decay, autocorrelation bands, monotonicity, group turnover | partial: horizon profile, IC stats, tertile monotonicity; ranked list in [[docs/design/panda-quantflow-logic-notes]] section 8 (delay profile, autocorrelation, bucket turnover) | none | **Take** as check-ledger rows with thresholds; **skip** five to twenty group surfaces |
| Cost stress as docs advice | proposed: `cost-adjusted` ledger row; Portfolio Lab stress multipliers and break-even | cost bps in evaluator hash | **Beat**: make it a gate, not advice |
| Run history as the compare surface; basis rule | built: Compare page, basis lock | notebook | **Take** the four named comparison modes |
| Strategy card triage (name, three numbers, thumbnail) | partial: Project cards; verdict badge proposed | none | **Take**, replacing "latest run" with verdict, trials and holdout state |
| EVO reviewer and "survivors win" | proposed: Independent Research Review, Hypothesis verdict rules; no live multi-agent | skeptic with DSR, PBO, halves, baseline; lockbox | **Beat**: reviewer must emit stored criteria and reason codes; Panda's is UNKNOWN |
| A2A meeting room | none | none | **Skip** (roadmap, unverified) |
| Scheduled tasks, persistent workspace | gap: no unattended scheduling surface; Studio actions are on demand | none | **Skip** for now; revisit only with a spend cap and no apply authority |
| Verdict | proposed: four verdict states with reason codes; slice: four-word card (Supported, Inconclusive, Refuted reserved, Could not be tested) | supported / refuted / inconclusive by rule | **Beat** (Panda has none) |
| OOS, trial counter, deflation, noise baseline | built or proposed: splits, trial gate, selection-adjusted evidence, noise frontier, sealed tail (proposed) | lockbox, DSR, PBO | **Beat** (Panda has none) |

The asymmetry to hold on to: Panda's strength is the **front of the funnel**.
A person with half an idea gets, in one chat turn, code, a run and a number.
Our strength is the **back of the funnel**: a frozen question, counted trials
and a verdict. Our front door is thin: Ideas takes a decision-signal factor
claim only, and the Hypothesis object that would capture "what result would
make you drop this" is a design, not code. The mapping therefore says: take
Panda's intake ergonomics, put them in front of our frozen Hypothesis, and do
not take anything that makes a number look finished without a verdict.

### 6.1 What an idea-intake step would need (design pointers, not a spec)

Derived from the Panda mechanisms above and our existing documents:

1. Templates keyed by asset class and scenario that pre-fill the Hypothesis
   draft (`ideaKind`, universe, horizon, default rules) rather than prompts.
2. A checklist walker covering the six elements plus two Panda omits: the
   refutation criterion ("what result would make you drop this") and the cost
   assumption. Ask only what changes meaning; default the rest from published
   rule defaults ([[docs/design/hypothesis-and-idea-verdict]] `frame-hypothesis`
   steps 3 and 4).
3. A routing result that may be `untestable` with reason codes, not a forced
   run.
4. An output that is a frozen, hashed spec, not a prompt; the prose and the
   spec stay linked (question hash already exists in the idea card).
5. The agent proposes; Core validates the route and rule names; the agent
   cannot set a verdict. Panda's agent both proposes and reports.

## 7. Open questions and unknowns behind login

Ordered by how much they would change our design.

1. Is the "six elements" request a typed server object, or only a checklist
   the prompt follows? Does the follow-up question loop have a stopping rule?
   (Needs a fresh chat session with a deliberately incomplete request; costs
   credits.)
2. What exactly does Approve mode block, and does Auto mode explain the
   unversioned chat edits we saw? (Needs a controlled run in each mode.)
3. EVO: layout, reviewer output, what the reviewer can reject, whether it
   stores criteria, whether "survivors win" is a rule. Route redirected
   without login; may need a plan tier.
4. A2A meeting room: does anything exist beyond the "coming soon" page?
5. Scheduled tasks: scope, whether they can spend credits or apply changes.
6. Factor Center live page: filters, how the "best group only" performance
   columns are labelled, and whether any library-level trial count is shown.
7. Hosted analytics versus the open-source code: do the hosted factor and
   backtest pages run the same formulas (annualisation constants, IC
   sampling, Sharpe risk-free)? Capturing one hosted API payload would answer
   it. Data layer (point-in-time membership, delisting, suspension) is also
   UNKNOWN.
8. Version creation rules: which actions create versions, and why the AI
   optimize and chat-applied edits did not.
9. Pro client and live trading: anything beyond the paper-trading step is
   CLAIMED only.
10. Whether the 64-run cap is a compute rule or a statistical choice; the
    docs give no reason.

Nothing in this note should be read as describing the logged-in product
beyond what the OBSERVED tags say.
