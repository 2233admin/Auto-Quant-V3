# Panda AI Quant - reference notes

Status: study notes for AutoQuant V3 design. Methods and ideas only.
Date observed: 2026-10-31. Observer: read-only headless browser, no login, no forms.

Evidence tags: OBSERVED (seen on a public page), CLAIMED-BY-VENDOR (vendor
prose or marketing, not verifiable by us), UNKNOWN (behind login or not
shown). Page references are paths on `https://www.pandaaiquant.com`.
Local captures: `D:\tmp\aqshots\panda\` (see "Reachability").

## 0. Reachability (what we could and could not read)

- The requested page `/agent_quant/strategies` redirects to
  `/login?redirect=...` (OBSERVED, screenshot `strategies.png`: phone +
  password login form, nothing else). `/agent_quant/` and `/quantfactor-center`
  also redirect to login. `/evo` redirects to the home page.
- So the live strategy library, run history, tuning task page, factor
  dashboard and EVO workstation were NOT seen. Everything about their
  layout below comes from the vendor's public docs, which describe them in
  prose. Treat those as CLAIMED-BY-VENDOR, not as verified UI.
- Readable without login: home page `/` (marketing plus an embedded product
  demo transcript), pricing text on `/`, and the docs site `/docs/*`
  (about 30 pages; read: `qube`, `qube-backtest`, `qube-assets`,
  `qube-optimize`, `qube-metrics`, `qube-factor`, `qube-sim`,
  `factor-screening`, `factor-analysis`, `evo`, `a2a-office`, `data`,
  `resources/useragreement`).
- The docs page `factor-analysis` contains real chart screenshots (dark
  panels, IC bar plus cumulative line, decay line, autocorrelation, IC
  histogram, 3D group-return surface). Seen in `docs-factor-analysis.png`
  at low resolution only.
- Product naming: Qube = chat-based research workbench (strategy and factor
  lanes); EVO = persistent cloud workstation with an agent harness; A2A
  Office = multi-agent team (announced, "coming soon"); Factor Center =
  factor screening and pool; Pro client = live trading terminal.
  Markets: China A-shares and futures (Qube); data also lists HK/US stocks,
  funds, macro (`/docs/data`).

## 1. What a "strategy" object contains

| Item | Claim | Tag | Evidence |
|---|---|---|---|
| Card in strategy library: name plus system id, market tag (stock/futures), one-line logic description, latest backtest total return / Sharpe / trade count, equity-curve thumbnail, updated time, code entry | yes | CLAIMED-BY-VENDOR | `/docs/qube-assets` "策略卡片上有什么" table |
| Card is meant to be a triage surface: "不打开就能筛掉大部分" (screen out most without opening) | yes | CLAIMED-BY-VENDOR | same page |
| Code with a single `STRATEGY_PARAMS` dict (symbol, position size, MA window, warmup days); validation badge "校验通过" before run; warmup guard raises an error when data is short instead of running silently | yes | CLAIMED-BY-VENDOR | `/docs/qube` sections 3 and 6 |
| Backtest parameters: date range, initial capital (default 10,000,000 CNY), margin multiplier (futures), slippage, fee multiplier, frequency, benchmark (stocks) | yes | CLAIMED-BY-VENDOR | `/docs/qube-backtest` |
| Result in four reading steps: 10 core metrics -> equity curve (dual axis, buy/sell markers) -> positions by contract/stock -> trade timeline (every fill, searchable) | yes | CLAIMED-BY-VENDOR | `/docs/qube-backtest` section 3 |
| 10 metrics: total return, annualized, benchmark return and annualized, final equity, max drawdown, Sharpe, Sortino, Calmar, trade count | yes | CLAIMED-BY-VENDOR | same |
| Versions V1, V2... saved explicitly; each version tagged as human edit or system optimization; rollback; version compare on code, return, risk, stability, trade frequency, explainability | yes | CLAIMED-BY-VENDOR | `/docs/qube-optimize`, `/docs/qube-assets` |
| Run record keeps a parameter snapshot ("本次回测参数"), run status, PDF export | yes | CLAIMED-BY-VENDOR | `/docs/qube-backtest` section 9 |
| Lifecycle: requirement -> code -> backtest -> version -> tuning -> archive (strategy chain); factor build -> factor analysis -> factor to stock-picking strategy -> backtest re-check (factor chain); then paper-trading ("simulation disk") bound to a saved version; then live in the Pro client | yes | CLAIMED-BY-VENDOR | `/docs/qube` section 2, `/docs/qube-sim` |
| Paper account metrics: net unit value, return, annualized, Sharpe (rf=0), Sortino, max and current drawdown, floating PnL; minute equity curve; daily report download | yes | CLAIMED-BY-VENDOR | `/docs/qube-sim` |
| Verdict wording | There is NO verdict object. Guidance is prose and thresholds only: "跑赢基准才有超额价值", Sharpe "一般大于 1 较优", factor rules |IC|>=0.02, |ICIR|>=0.5, p<0.05, annual return >=15%, MDD <=20%, Sharpe >=1.2. No pass/fail/refuse label, no stored reasons. | OBSERVED (absence in docs) | `/docs/factor-analysis` section 2, `/docs/qube-metrics` |
| Live UI of any strategy page | not seen | UNKNOWN | login wall |

Note: a different, public demo on the home page shows a trading-client
account card (equity, daily PnL, drawdown, exposure, position share) with
mock data. It is about execution, not research (OBSERVED, home page text).

## 2. Agent workflow presentation

| Step | What they show | Tag | Evidence |
|---|---|---|---|
| Idea input | Free-text chat. Empty session offers "capability templates" (verified starter prompts by asset and scenario: MA trend, turtle breakout + ATR stop, 20-day momentum factor, low PB + high ROE composite, price-volume correlation factor, strategy porting). Docs say a good request has six elements: market, symbol, signal logic, position, risk control, backtest spec; missing items trigger follow-up questions. | OBSERVED (home page cards) and CLAIMED (six elements) | `/`, `/docs/qube` section 5 |
| Generation | Agent writes code plus factor expression; process panel shows "处理完成 · 用时 X 秒" and "N actions: thinking, capability load, task delegation, tool calls", expandable into the full execution chain; this is the "first entry to locate errors" | CLAIMED-BY-VENDOR | `/docs/qube` section 3 |
| Backtest | Same page; run button gated on validation badge; each run is one record in a result bar | CLAIMED-BY-VENDOR | `/docs/qube`, `/docs/qube-backtest` |
| Iteration | Two separate tools with a stated boundary: "AI optimize" changes logic and creates one new version; "parameter tuning task" only searches parameter values, at most 63 candidates + 1 baseline = 64 concurrent runs, "default: do not auto-apply, do not modify logic". Docs: "Qube has no separate auto-optimize". Recommended order: baseline version, signal window, liquidity filter, stop rules, trend filter; one change per version. | CLAIMED-BY-VENDOR | `/docs/qube-optimize` |
| Human approval | One dropdown "Auto / Approve": in Approve mode the agent waits for confirmation at key execution nodes. Applying tuned params is a manual button per row ("应用此参数"), then "save as version". Docs explicitly say this switch is a tool-call approval switch, unrelated to optimization. | CLAIMED-BY-VENDOR | `/docs/qube` section 3, `/docs/qube-optimize` |
| Multi-agent | EVO: "central agent decomposes goals, dispatches to isolated sub-agents; researcher produces, reviewer independently cross-checks adversarially, survivors win; models, memory, skills, tools, approvals live in the harness, fully traceable". A2A Office: host agent plus market/news/fundamental/risk agents, a "meeting room" where conclusions are cross-checked before entering the final result. A2A page says it is "coming soon". | CLAIMED-BY-VENDOR | `/` (EVO block), `/docs/evo`, `/docs/a2a-office` |
| Scheduled and persistent | Scheduled tasks (cron-like instruction, "ran 23 times, next 09:15"); persistent cloud workspace per account | OBSERVED (demo text), CLAIMED (docs) | `/`, `/docs/evo` |

How the adversarial reviewer actually works, what it can reject, and whether
reviewer output is stored: UNKNOWN (EVO is behind login).

## 3. Evidence and overfitting controls (strict)

Shown in docs (CLAIMED-BY-VENDOR, none verifiable in product):

- Costs: slippage parameter, fee multiplier "for cost stress test", margin
  multiplier. Advice: "high return with abnormally high trade count" is
  suspicious, rerun with higher fee multiplier. Costs are user-set knobs, not
  forced into a verdict.
- Sample length warning: short windows give "insufficient significance";
  worked example of a 60-day low-vol factor over about half a year with Rank
  IC 0.0334, t = -0.288, p = 0.7761, monotonicity 0.38, judged not valid
  (`/docs/qube-factor` section 5).
- Robustness advice in prose: "try another period, rebalance cycle, universe -
  the cheapest robustness test"; "a factor that only works in one window and
  one rebalance cycle is probably fitted noise".
- Tuning: "look at three layers, not rank one": best combo, stable region
  (neighbors also good), risk constraints; a lone spike with weak neighbors =
  overfit risk. Result page overlays all candidate equity curves normalized
  to 1 and shows "completed 16/16"; dispersed and falling curves mean no valid
  solution in that space. First check whether even the best candidate beats
  the benchmark; if not, suspect the logic, not the parameters.
- Factor board: IC, Rank IC, ICIR, p-value, t-stat, monotonicity, decay by
  lag, autocorrelation of IC (warning bands: > 0.8 suspect leakage or
  overlapping windows, < 0.2 near white noise), skew/kurtosis of IC, 5 group
  returns, group turnover. "Four dimensions must cross-validate".
- Look-ahead: warmup guard in generated code; paper trading described as the
  place where "future function, signal timing bias, liquidity" show up.
- Sharpe failure mode noted: near-zero return with near-zero vol yields
  absurd Sharpe (e.g. -103.9); "do not use".
- Porting honesty: when a JoinQuant to Qube port cannot be equivalent, the
  system must name the gap and a downgrade plan instead of hiding it.

NOT shown anywhere we could read (say "not shown"):

- Out-of-sample or holdout split: not shown. Backtest has one date range;
  no train/validation/holdout field, no locked final window.
- Trial count / search-space ledger: not shown, except the per-task cap of 64
  combos. No cumulative count of how many strategies, versions or prompts were
  tried before the one displayed.
- Multiple-testing correction (Bonferroni, BH, deflated Sharpe, PBO,
  White reality check): not shown. p < 0.05 is quoted as the cut-off with the
  caveat "statistical significance does not equal predictive validity".
- Pre-registration of hypothesis or kill criteria: not shown.
- Costs forced into the headline number: not shown; default is a single
  default fee and slippage, stress testing is optional advice.
- Noise or random-baseline comparison (shuffled signals, random-entry
  distribution): not shown.
- Automatic verdict that can say "reject": not shown; thresholds are
  reference ranges and readers decide.
- Threshold tension to remember: the docs treat Sharpe > 1 as "good" and
  annual return >= 15% as a factor bar with no trial adjustment.

## 4. UI and information design

Worth learning (from docs and demo; tagged CLAIMED unless noted):

- Card as triage surface: name, one-line logic, three headline numbers, a
  thumbnail curve, updated time. Filters: market tab with counts, text
  search over name/code/formula/notes, sort by modified time.
- Same-basis comparison: factor list recomputes every factor on one universe
  and one window when filters change, so a screen is comparable; docs warn
  that numbers across different filters are not comparable. Sort default
  Rank IC; card view for scanning, table view with sortable headers for
  compare; 30 per page.
- Run history as the compare surface: per-strategy run table (range, return,
  Sharpe, max drawdown, trades, status, thumbnail), four named comparison
  patterns (versions at same range, params at same version, across markets,
  across frequencies). Each record has a parameter snapshot to reproduce.
- Result reading order spelled out in the UI docs: metrics -> curve ->
  holdings -> fills. A "reading guide" hover (question-mark) on every metric.
- Factor dashboard as a matrix of small panels (IC, Rank IC each as series,
  decay, histogram, autocorrelation; group-return table and 3D surface);
  panels draggable and maximizable (OBSERVED image in `docs-factor-analysis.png`,
  OBSERVED red-up/green-down convention; the 3D group surface looks
  decorative and is hard to read).
- Process disclosure: a collapsed action count with expand-to-see chain of
  tool calls; per-session status dot (green done / red failed).
- Separation of "asset" modules (strategy library, factor library) from
  "evidence" module (run history): "assets manage things, history manages
  evidence".
- Next-step quick buttons after each answer (port strategy, tune current).

Avoid:

- Marketing density and gamification (compute-credit economy, sign-in tasks,
  contests, leaderboards ranked by IC or return). A leaderboard on raw IC
  or return is a multiple-testing generator.
- Verdict-free dashboards: ten metrics without a decision. The reader must
  infer pass/fail from reference ranges.
- Cosmetic 3D charts.
- Showing the best of N without N. The tuning page shows all curves, which
  is good, but the strategy card shows only the latest run's headline.
- Login wall on the core object: no public sample strategy page we could
  inspect.

## 5. Data, universe, scope and terms

- Markets: A-shares (SSE/SZSE) and futures for Qube (`/docs/qube`,
  `/docs/data`); data service also lists funds, indices, HK/US, macro
  (CLAIMED). Factor universes: all A, CSI 300, CSI 500, CSI 1000; windows:
  half year, 1, 2, 3 years (`/docs/factor-screening`).
- Data permission gates results: unsubscribed sources show "no permission"
  in results (`/docs/data`). Data and SDK are paid; access via Python SDK
  `panda_data`, MCP and REST. Pricing is in compute credits (1 credit about
  0.1 CNY); personal tiers Free / Lite 49 per month / Pro 199 / MAX 499 on
  the home page (OBSERVED text).
- Terms of use (`/docs/resources/useragreement`, CLAIMED legal text, read
  only for reuse limits): copyrighted materials on the service, "including
  logos, text, graphics, data, strategies, audio, video, page design,
  layout, software" belong to rights holders; users agree not to reuse them
  without consent. User-posted content is reprintable with attribution
  unless the author forbids it. We read only the matching clauses, not the
  whole agreement; do not rely on this summary as legal advice.
- Site footer disclaimer (OBSERVED): provides research tools, data, courses,
  contests; "not securities brokerage or investment advice".
- Honest limits: universe survivorship, point-in-time fundamentals,
  suspension/limit-up handling, T+1: UNKNOWN (not stated in pages we read).

## 5b. Factors page (`/agent_quant/factors`)

Reachability: OBSERVED redirect to `/login?redirect=.../agent_quant/factors`
(screenshot `factors.png`, login form only). Nothing of the live page is
visible. We did not sign in. The rest of this section is from public docs
(`/docs/qube-assets`, `/docs/qube-factor`, `/docs/factor-screening`,
`/docs/factor-analysis`) and is CLAIMED-BY-VENDOR; live UI is UNKNOWN.

- Factor object (CLAIMED): name; implementation tag (stock formula, stock
  Python, futures formula); formula mode (one-line cross-sectional
  expression, e.g. a rank of negative rolling volatility) or Python mode
  (variables, branches, outlier handling), switchable by tabs; versions and
  analysis records; actions "run analysis", "build stock strategy", "build
  futures strategy".
- Card fields (CLAIMED): name, implementation tag, latest factor return,
  Sharpe and annualized return of the latest analysis, thumbnail return
  curve, updated time, code entry.
- Analysis parameters (CLAIMED): analysis window, rebalance cycle, number of
  groups (default 5), factor direction, universe.
- Metrics (CLAIMED): IC mean, Rank IC, IC_STD, ICIR, t-stat, p-value,
  monotonicity, group returns table (annualized, excess, max drawdown,
  volatility, turnover, monthly win rate), long-short curve, plus the chart
  matrix in section 4.
- Organisation (CLAIMED): "factor library" of your own saved factors (market
  tabs with counts, search over name/code/formula/notes, sort by modified
  time); separate Factor Center of platform factors with category tags, a
  universe and window filter (all A, CSI 300/500/1000; half year to 3
  years), default sort Rank IC, card and table views, 30 per page, "add to
  factor pool" with pool size capped by plan (20 / 50 / 100).
- Scope caveat they state: list performance columns (annual return, drawdown,
  Sharpe) come from the best-performing group only, not an overall
  expectation; IC columns use the cross-section. Advice: keep two or three
  representatives of a family, not ten near-duplicates.
- Evidence shown: IC stats, significance, decay, autocorrelation, group
  monotonicity, sample-length warning. Not shown: out-of-sample or holdout
  split, factor-count or trial ledger, multiple-testing correction across a
  library of many factors screened on the same window, cost-adjusted long-short
  return, crowding or capacity, point-in-time data guarantees. Screening a
  large library by Rank IC on one window is exactly the setting that needs
  correction, and nothing is stated.
- Idea for us: our Factor lane card should show trials-in-library next to
  any IC, and a family-correlation warning (their "pick representatives"
  advice) as a check. Do not copy the layout or wording.

## 6. Ideas for us (prioritized, max 10)

Our spine: Hypothesis -> check ledger -> verdict page -> noise frontier ->
compare page -> strategy library.

1. Verdict page that can say "reject" with stored reasons (spine: verdict
   page). They list thresholds in prose and show ten metrics with no
   decision. We should keep a machine verdict (pass / watch / reject /
   insufficient evidence) with the failing check ids beside it.
2. Check ledger with a trial counter (spine: check ledger, Hypothesis).
   They show no cumulative trials; the 64-combo cap is the only count. Ours
   should record every candidate, version and prompt variant against a
   Hypothesis id and show "N tried" next to any headline number.
3. Noise frontier next to every tuning result (spine: noise frontier). Their
   tuning page overlays all candidate curves, which is a good visual; add
   what they lack: a shuffled/random-signal baseline and a "best-of-N under
   noise" band so rank one is judged against what luck alone produces.
4. Three-layer reading of search results: best, stable region, risk
   constraints (spine: noise frontier, verdict). Their rule "if even the best
   candidate does not beat the benchmark, suspect the logic, not the
   parameters" is cheap and automatable as a check.
5. Compare page with named comparison modes and a basis lock (spine: compare
   page). Adopt their four modes (versions at same range, params at same
   version, cross-market, cross-frequency) and the rule that a comparison
   recomputes every row on one universe and window and refuses mixed bases.
6. Strategy library card as triage surface (spine: strategy library).
   One-line hypothesis, verdict badge, three numbers, thumbnail, last-run
   time, market filter with counts, search over name and notes. Replace their
   "latest run only" headline with "verdict + trials + holdout status".
7. Fixed reading order on the verdict page (spine: verdict page). Metrics ->
   curve -> where PnL comes from -> fills, with a hover definition per
   metric. Ours adds the check ledger as step zero.
8. Cost stress as a default check, not advice (spine: check ledger). Run
   the fee multiplier and slippage ladder automatically and fail on
   cost-sensitive results, using their "high return + high trade count"
   smell as the trigger.
9. Factor lane diagnostics we may be missing (spine: check ledger for the
   Factor lane): IC decay by lag, IC autocorrelation warning bands,
   monotonicity score, group turnover. All are cheap to add as ledger checks
   with thresholds; include sample-length guard (their 60-day example).
10. Process disclosure and approval modes for any agent step (spine:
    Hypothesis, check ledger). Collapsed action chain with expand, and a
    per-step "approve before run" mode; for us approval should be mandatory
    at holdout unlock and at verdict promotion, not a per-session toggle.

## 7. Do not copy

- Names and marks: "PandaAI", "Panda AI Quant", "Qube", "EVO", "A2A Office",
  "QuantSkill(s)", "PandaData", "巅峰交易者", factor-contest names, the panda
  logo and mascot, the pixel-grid hero graphic.
- Text: all doc prose, example prompts, template card copy, tier names and
  descriptions, the disclaimer wording, Chinese phrasing quoted above. Quotes
  in this file are short evidence citations only.
- Visual assets: screenshots, chart images, the 3D group-return surface, the
  red-up/green-down dark panel styling as a look-and-feel, the demo trading
  account card.
- Mechanics that are theirs by contract: compute-credit pricing and tiers,
  contest and leaderboard formats, data subscription scheme, SDK/MCP
  endpoints and `panda_data` API.
- Their Sharpe/IC threshold table as-is. Use our own thresholds, derived and
  tested against our data, with the trial-adjustment that they lack.
- Anything from the login-gated product: we have not seen it, so we must not
  imply it works as the docs describe.

## 5c. Logged-in observation (2026-10-31, read-only)

Observed through the owner's signed-in Chrome with Browser Bridge (own tab, no clicks that create, save or run anything).

- Account is empty: strategy library has 0 strategies, run history 0, tuning tasks 0, paper trading 0. Factor library has 2 untitled stock factors (formula/Python) with "no factor analysis yet".
- Layout: left rail (chat workbench, session list, strategy library, factor library, run history, tuning tasks, paper trading, market data), compute-credit balance and notifications in the rail footer.
- Factor detail page: parameter panel (analysis window, rebalance period 5 days, 5 groups, direction, universe CSI 300), code editor with a validation badge, history versions, save, and a "run analysis" button. Result area stays empty until a run.
- Not observed: any result chart, because running an analysis spends the owner's compute credits. Result-page claims remain vendor documentation only.
- Run history is split by Strategy and Factor, then by market (stock/futures).

### 5d. First factor-analysis result page (2026-10-31, owner-approved run, cost 1 compute credit)

Run: formula `close/delay(close,20)-1`, CSI 300, 2026-02-21..2026-08-20, rebalance 5 days, 5 groups, positive direction. Finished in 6 seconds, "9 stages complete".

- Result page order: run selector (timestamp dropdown), action row (this run's parameters, AI optimize, save as version, build stock-selection strategy, export PDF), 9-stage progress bar, group cumulative-return line chart (5 groups plus two long-short spreads), core-metrics grid.
- Metrics shown: factor return, Sharpe, annualized return, max drawdown, IC mean, Rank IC, IC std, IC_IR, IR, P(IC < -0.02), P(IC > 0.02), t statistic, p-value.
- Observed numbers for this trivial momentum factor: IC mean 0.0026, Rank IC -0.0248, t 0.0432, yet the page still offers "build strategy" and prints Sharpe 0.22 and annualized 7.71% in colour. IC mean and Rank IC disagree in sign and nothing flags it.
- No sign of: out-of-sample split, trial count, multiple-testing adjustment, noise baseline, verdict, or an "inconclusive" state. A p-value sits at the bottom of a metrics grid with no pass line.
- Worth copying: one-click save as version, stage-by-stage progress, run selector, export PDF. Worth beating: an explicit verdict row that reads the t statistic and would say inconclusive here.
- Screenshots (not committed): `D:/tmp/panda/factor-result.png`.

### 5e. AI optimize and chat workbench (2026-10-31, owner-approved, cost about 4.4 compute credits)

- The "AI optimize" button opens the chat workbench with the factor pinned as a context chip. Left: conversation with a collapsible action trail ("capability load, thinking, tool call, 23 actions"). Right: tabs for parameters, version history, analysis history. Bottom: model picker, thinking-effort picker, auto mode, "strategy rewrite" shortcut.
- The agent read the baseline run itself and said the signal was not significant (t 0.043, Rank IC negative), then rewrote the formula, ran a new analysis, and reported a before/after table: IC 0.0026 to -0.0206, annualized 7.71% to -22.92%, Sharpe 0.22 to -1.11, monotonicity 0.30 to 0.83. It called the attempt a failure in plain words.
- Good: the agent states the failure honestly and offers restore or continue. Bad: it overwrote the saved formula, and "version history" stayed empty, so the original was not recoverable from the product. No trial counter, no held-out data: one more attempt on the same window raises selection risk and nothing records it.
- Copy: pinned-context chip, collapsible action trail, before/after table with delta column, honest failure statement. Beat: every rewrite gets a version and a trial number automatically, and the judge, not the agent, decides keep or revert.

### 5f. Strategy, backtest, paper trading, market terminal (2026-10-31, owner-approved)

- Build strategy from a factor: a constraints form (universe, dates, capital, direction, rebalance period, top-N, weighting, max single weight, rebuy buffer, minimum hold days, take-profit, stop-loss, exclude ST) hands off to the chat agent, which writes strategy code, runs a code-quality gate and a strategy-spec check, and only then saves it to the library. The page states "does not auto-backtest". Took 4 min 25 s, about 6 compute credits.
- Backtest of that strategy (same 6-month window the factor was tuned on): total return 22.42%, annualized 50.87%, Sharpe 1.41, max drawdown 17.09%, 336 trades, benchmark -5.19%. The factor-analysis page for the factor it was built on had shown Sharpe 0.22 or worse. Nothing on the page reconciles the two, flags that the window is in-sample, or shows a trial count.
- Backtest page: run selector with headline numbers, action row (this run's parameters, re-run, AI optimize, save as version, export PDF), 8-stage progress, 12-number grid including benchmark return, Sortino and Calmar, net-value curve with buy and sell markers, holdings table with search and pagination. Strategy tabs: parameters, version history, backtest history, tuning history, AI repair.
- Paper trading requires a saved strategy version. The dialog says it never connects real money. Copy this gate: only a saved, versioned artifact can be promoted.
- Market terminal: 5,223 symbols, stocks and futures, single stocks and ETFs, intraday plus minute and day/week/month candles, main and sub indicators, five-level order book, risk, events and fund-flow tabs. A-share only; no crypto.
- Copy: constraints form before generation, quality gate before library entry, "no auto backtest" default, versioned-only promotion to paper trading. Beat: a verdict that sees the 22% return rests on a factor with t near zero and a six-month in-sample window, and labels it inconclusive.

### 5g. Parameter tuning (2026-10-31, owner-approved, about 68 compute credits)

- Tuning is launched from the strategy's tuning tab and run by the chat agent: it reads the strategy's parameter block, designs up to 63 numeric candidates plus a baseline (cap 64), validates them, creates a task with an objective (here: total return), and does not change code or auto-apply.
- Live task view: three counters (queued, running in parallel, aggregated), a per-combination status matrix, an overlaid net-value chart of all combinations normalised to 1, and a parameter table sortable by total return, Sharpe, max drawdown and Sortino. 58 combinations finished in about 4.5 minutes with 0 failures.
- The agent reported best = top 5 holdings: total return 30.82% against 22.42% baseline, Sharpe 1.64. It called top-N the main sensitivity and 5-day rebalance a stable "sweet spot", from one six-month window.
- Gap we should beat: the objective is total return on the same window it is reported on, with 59 trials and no deflation, no held-out segment, no noise baseline. The only guard is the 64-combination cap.
- Side effect to remember for our own design: a follow-up chat turn ("可以") applied the best parameters and edited the saved strategy code (top_n 10 to 5) without a version being offered. Our Studio is read-only for exactly this reason: apply must be an explicit, recorded step with a trial number.
