# Shinka frontend parity matrix

Status: working inventory, 2026-10-31. Nothing here is implemented by this
document. It lists every research feature of the ShinkaEvolve fork frontend,
what AutoQuant (AQV2) data could feed it, and whether the new Studio app
already draws it.

Related: [[plans/shinka-research-methods-and-frontend-merge]],
[[docs/design/hypothesis-and-idea-verdict]],
[[docs/design/selection-adjusted-research-evidence]],
[[docs/design/studio-observation-surface]],
[[docs/design/factor-evidence-explorer]].

## Scope and method

- Reference (read-only): `shinka/research/webui/app/src` in the fork checkout
  at `D:\tmp\shinka\ShinkaEvolve`, plus the Python side
  (`shinka/research/skeptic.py`, `notebook.py`, `library.py`, `analysis.py`)
  only to learn what data each view shows.
- Ours: `studio-app/src` (shell, Projects, Project, Event Study) and the
  payload built by `autoquant/studio.py` (`/api/v1/health`, `snapshot`,
  `workspace`, `project`; no other route exists).
- Data shapes were checked, not assumed: `build_project_snapshot` was run on
  a real Project (`ctx-volspike-btc`, one Factor Study, two Runs, one Session
  with one KEEP/REVERT experiment) and every field named below was listed from
  that output. `result.metrics` field names were checked against a real Factor
  Run (`run.show` output `run1.json`).
- Reading depth. Read in full: `App.tsx`, `types.ts`, `shell/route.ts`,
  `report/*` (Report, HypothesisTable, Ledger, Side, Events; Timeline and
  TrialChart down to their doc comments and imports), `DirectionMeta.tsx`,
  `Definition.tsx`, `Term.tsx`, `Markdown.tsx`, `AnalysisWorkspace.tsx`,
  `library/Library.tsx` (to the article body), `format.ts` checks. Read for
  doc comments, exports, props and the i18n key list only (not every drawing
  line): `Overview.tsx`, `Compare.tsx`, `series.ts`, `RunList.tsx`, and all of
  `run/*` (RunPage, Inspector, Lineage, LineagePanel, Offspring, PromptTree,
  Scrubber, panes, Progress, ProgressSections, throughput, costs, success).
  Test files (`*.test.mjs`), CSS and `i18n/copy.ts` text were not reviewed
  beyond key names. Rows that depend on unread detail say `unclear`.
- Vocabulary map (from the merge plan): Shinka direction = AQV2 Project;
  experiment = Study plus Session; trial = unique `subject.sourceHash` in a
  research family; lockbox = frozen external holdout; library = Workspace
  library (not built).
- A structural difference drives many rows. Shinka judges on a hidden
  validation segment that only the skeptic sees. AQV2 has no hidden tier:
  validation drives selection, the test split is a visible diagnostic, and the
  only confirmation tier is the external holdout (see the mapping table in
  [[docs/design/hypothesis-and-idea-verdict]]). Rows that port a Shinka check
  therefore translate it; they do not copy it.

Status values: `done` (drawn in `studio-app` today), `partial` (some of the
view exists), `missing`. Priority values for the idea -> verdict workflow:
`P0` needed to judge an idea, `P1` needed to research well, `P2` engine-only
or convenience, `drop` not wanted (reason given).

Terms used in the data column: `snap` is the `/api/v1/project` payload for one
Project (`projects[0]`). `FE` is `snap.factorExplorer`. `SI` is
`snap.sessions[].selectionIntegrity`. `DM` is `snap.sessions[].decisionMatrix`.
`NOT AVAILABLE` means no field in today's payload carries it.

## 1. Parity matrix

### 1.1 Shell and cross-cutting

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| S1 | Rail and phone tab bar (`shell/Rail.tsx`) | Page navigation, search hint, pending-source count | Static; ours has `shell/Rail.tsx` with `TabBar` | done | P1 |
| S2 | Top bar: breadcrumbs, theme, live toggle, last-updated (`shell/TopBar.tsx`, `useShellData.ts`) | Where am I; is the data fresh; pause auto refresh | `/api/v1/workspace` poll every 30 s with ETag | done | P1 |
| S3 | Command palette (`shell/Palette.tsx`, items built in `App.tsx`) | Jump to any page, direction, run, program of the open run, library page; theme, language, refresh actions | Pages and Projects only today. Needs Studies, Runs, Experiments, Reports as items (`snap.studies`, `snap.runs`, `sessions[].experiments`, `sessions[].reports`) | partial | P2 |
| S4 | Design tokens, icons, theme, `useWidth` (`design/*`) | Shared visual language | Same file names and line counts in `studio-app/src/design` for icons, tokens, theme, useWidth; `base.css` is 98 vs 105 lines. Not diffed, so `unclear` whether identical | done | P1 |
| S5 | `Notice.tsx` | Error and info banners | Static | done | P1 |
| S6 | `shell/Modal.tsx` | Dialog host (prompt text and diff in Shinka) | Static; file exists in ours, use by a page `unclear` | done | P2 |
| S7 | Glossary terms with hover/focus definitions (`Term.tsx`, `Definition.tsx`, keys `term.sharpe`, `dsr`, `pbo`, `noise`, `trials`, `sealed`, ...) | Defines Sharpe, DSR, PBO, noise line, sealed in place so a reader can act on a number | Static copy. AQV2 already ships definitions as data: `FE.protocol.semantics` (`measure`, `inference`, `split`, `score`, `target`, `regimes`) and `FE.factorOutcome.targetSemantics` | missing | P1 |
| S8 | Sanitised Markdown renderer (`Markdown.tsx`, `renderMarkdown.ts`, markdown-it with html off) | Renders hypothesis body, library pages, meta-analysis text | Inline Markdown exists for `snap.researchProgram.text`. Report and Dossier bodies are only paths (`markdownPath`): NOT AVAILABLE inline, needs a read-only file route | missing | P1 |
| S9 | URL carries page state (`shell/route.ts`: `hypothesis`, `runs`, `select`, `sort`, `kind`, `pane`, `gen`, `panel`, `program`) | Every selection is shareable and Back restores it | Ours encodes only `view=project&id` and `/projects/<id>/event-study` (`route.ts`). No hypothesis, run, sort or filter state | partial | P1 |
| S10 | Remembered per-direction UI state (`report/remember.ts`: table sort, open sections, event filter) | Convenience while reading one report | Client-only | missing | P2 |
| S11 | Keyboard row navigation and sortable-header a11y (`HypothesisTable.tsx` `moveBetweenRows`, `Overview.tsx`) | Arrow keys between rows, `aria-sort` | Client-only | missing | P2 |
| S12 | Chinese/English switch (`i18n/lang.tsx`, `copy.ts`) | Language | Merge plan decision 6: English only for now | missing | drop |
| S13 | Demo tag and preview harness (`demo.ts`, `preview/*`) | Fixture preview of the design | Fixtures only | missing | drop |
| S14 | Hosted legacy analysis page in an iframe (`AnalysisWorkspace.tsx`, `legacyFrame.ts`, `analysis/*`) | Shinka's own pre-redesign viz page for solution space and contest | Ours links to `/legacy` (hidden fallback, removed in 0.10.1 per plan) | missing | drop |

### 1.2 Overview (Shinka "Research" home) -> our Projects page

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| O1 | Directions table rows (`overview/Overview.tsx`) | One row per body of research; link in | `/api/v1/workspace` `projects[]`; ours `pages/Projects.tsx` | done | P1 |
| O2 | Unreadable-direction row | Which directory failed to load and why | `ProjectSummary.valid`, `diagnostics`; ours Verification column and Notice | done | P1 |
| O3 | Hypothesis status counts per direction (`home.colHypotheses`, `Hypotheses()`) | How many ideas are supported, refuted, inconclusive, confirmed | NOT AVAILABLE: needs the Hypothesis object (proposed, H1 to H9 unimplemented). Proxy only: `snap.counts.verdicts` = `{KEEP, REVERT, CRASH}` per Experiment, authority `session-objective-only`, and it is not in the workspace summary | missing | P0 |
| O4 | Trials column: trials, evaluated, failed (`Trials()`) | How many tries stand behind the number | `SI.researchFamily` (`uniqueSourceTrials`, `successfulSourceTrials`, `failedSourceTrials`, `totalExecutions`). Not in `ProjectSummary`; needs a summary field | missing | P0 |
| O5 | Evidence gauge: best record vs noise bar on one shared scale (`Gauge`, `evidenceScale`) | Does the best result clear what luck alone would give, at a glance across Projects | Scalar substitute per Project: `SI.selectionAdjustment.passes`, `.interpretation`, `.statistics` (sample: `observedMeanIc`, `rawHacPValue`, `familywiseAdjustedPValue`, `uniqueTrials` for `bonferroni-hac-v1`). Portfolio uses `deflated-sharpe-ratio-v1` (seen in `selection.py:396`, statistics keys not run here: `unclear`). No common-scale "noise bar" exists for Factor by design | missing | P1 |
| O6 | Lockbox column: sealed / opened (`Lockbox()`) | Is the confirmation tier still unspent | `ProjectSummary.externalHoldout {present, status}`; ours prints the status word in a column | partial | P1 |
| O7 | Budget column: spend vs budget, over-budget state (`Budget()`, `direction.ts`) | Is the research inside its money limit | NOT AVAILABLE: no spend or budget field in the snapshot; the plan lists a budget ledger as phase 1 work. Runs carry `durationMs` only | missing | P2 |
| O8 | Direction state: active / concluded / new / over-budget (`direction.ts`) | Where each line of research stands | Proxy: `snap.agentWorkBrief.focus.coordinationPhase`, `review.label`, `sessions[].session.status`. Ours shows the `brief.headline` as "Next move" | partial | P2 |
| O9 | Headline sentence with linked categories and sub-sentence (`home.sentence`, `home.sub`) | "N projects: x confirmed, y active, z over budget; k of m clear the noise bar" | Needs O3, O4, O5 first. Ours prints counts of Projects, Studies, Runs | partial | P2 |
| O10 | Sort selector (`SORTS`) | Order by activity, evidence, spend | Client-side on workspace summary | missing | P2 |
| O11 | Activity feed across all directions (`Feed`, `WorkspaceSnapshot.events`) | What happened lately anywhere, with withheld notes | NOT AVAILABLE at workspace level; per-Project `snap.timeline` exists (kind, id, at, status, title, value) | missing | P2 |
| O12 | Totals row and key notes | Sums and legend | Client-side | missing | drop |
| O13 | Empty-state onboarding with the init command (`home.emptyTitle`) | First run guidance | Static; ours has a one-line empty message | partial | P2 |

### 1.3 Direction report (Shinka "Report") -> our Project page, the verdict surface

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| P1 | Direction meta chips: state, created, trials, spend vs budget (80% note), lockbox (`DirectionMeta.tsx`) | One-line status of the whole research line | Name, verification, counts are drawn. Created: `snap.sessions[].session.createdAt`. Trials: `SI.researchFamily`. Lockbox: `snap.externalHoldout.state`. Spend: NOT AVAILABLE | partial | P1 |
| P2 | Hypotheses table: id, title, outcome glyph, experiments, trials, best, OOS, verdict date; sortable, row selects (`report/HypothesisTable.tsx`) | Every idea in the line and where each stands | NOT AVAILABLE: no Hypothesis objects. Proxies: `snap.sessions[].delegation.request.hypotheses[]` (strings), `snap.studies[].researchRequest`, `snap.sessions[].experiments[]` (`hypothesis`, `verdict`, `candidateValue`, `improvement`) | missing | P0 |
| P3 | Claim panel: title, Claim / Mechanism / Falsification parsed from the body, created, counts, folded full text (`report/Report.tsx` `Claim`) | What exactly is being tested and what would refute it | Question and context: `snap.agentWorkBrief.question {title, text, origin}`, `snap.sessions[].delegation.request {question, decisionContext, hypotheses, horizon, direction}`, `FE.factorQualification.claim {claim, outcome, authority}`, `FE.researchHorizon`. Falsification and success criteria: NOT AVAILABLE (frozen criteria are unimplemented). Ours draws only `description` | missing | P0 |
| P4 | Trials and noise chart: every trial in order, record step line, noise line, failures as crosses in their own band (`report/TrialChart.tsx`, `data.ts frontier`) | Is the best result a real record or what N tries would produce by chance | Points: `DM.trials[]` (`sequence`, `primaryValue`, `status`, `verdict`, `isCurrentLeader`, `errors`), capped at 12 (`STUDIO_COMPARISON_TRIALS`, `DM.scope.omittedCandidateTrials` says how many were cut). Noise line: NOT AVAILABLE; for Factor there is no null-trial formula (design doc: row is `n.a.`), for Portfolio the per-prefix `expected_maximum_sharpe` series is not exposed (design step H5). Scalar substitute: `SI.selectionAdjustment.statistics` | missing | P0 |
| P5 | Chart reading: hover and arrow-key tooltip, click opens the program, filled vs hollow by selected hypothesis, right-edge gauge, probes note (`TrialChart.tsx`) | Inspect any trial; relate trials to hypotheses | Needs P2 and P4; probes (trials that leave no record) have no AQV2 counterpart found: `unclear` | missing | P1 |
| P6 | Check ledger: five rules with thresholds taken from the verdict, plus five reference figures (`report/Ledger.tsx`, `format.ts checksOf`, `skeptic.decide`) | Which specific checks pass or fail and by how much | NOT AVAILABLE as a payload (verdict rules v1 unimplemented; browser must not compute). Ingredients exist: validation mean IC > 0 `FE.summary.validation.meanRankIc`; beats baseline `FE.factorQualification.validation.dominantStyle`; selection adjustment `SI.selectionAdjustment.passes`; sub-period `FE.stability.chronologicalFolds`; sample size `FE.summary.validation.sufficient`; reproducibility `SI.researchFamily.reproducible`. PBO: NOT AVAILABLE (no combinatorial matrix published) | missing | P0 |
| P7 | Verdict panel: glyph, label, reason text (`report/Side.tsx Verdict`) | The answer, with the reason, in plain words | NOT AVAILABLE as a verdict label. Closest: `SI.selectionAdjustment.passes` and `.interpretation` (diagnostic-only), `snap.agentWorkBrief.review {label, title, detail, next}`, `sessions[].experiments[].verdict` (objective only). Ours draws the "Next move" action, not a verdict | partial | P0 |
| P8 | Pre-verdict reading: in-sample progress against the current noise bar, "validation later" note, next command when nothing ran (`Side.tsx`) | What can be said before the verdict exists without leaking it | Needs P4 noise value and the visibility rules (design doc: server-side filtering, unimplemented). Today the test split is visible in `FE.summary.testAudit` and is not drawn | missing | P1 |
| P9 | Lockbox results panel: pass/fail, Sharpe vs buy-and-hold, return, drawdown, DSR, positive fraction, trials, bars covered, program judged (`Side.tsx LockboxResults`) | Did the idea survive the one-shot confirmation | `snap.externalHoldout` (`state`, `binding`, `result`, `evidence`, `assessment`, `nextAction`); `null` in the sample so evidence field names are `unclear`. Ours prints one sentence and defers to legacy | partial | P1 |
| P10 | Experiments list: span, evaluated, probed, best, cost, "open analysis" link (`Side.tsx Experiments`) | The concrete tries behind the verdict, each openable | `snap.sessions[].experiments[]` (`id`, `sequence`, `verdict`, `hypothesis`, `leaderValue`, `candidateValue`, `improvement`, `runId`, `completedAt`), `sessions[].campaigns`, `sessions[].progress`. Ours lists only session id, study, status. Cost: NOT AVAILABLE | missing | P0 |
| P11 | Timeline tracks: one bar per hypothesis from first to last trial with skeptic, verdict and confirm marks, d3 time axis (`report/Timeline.tsx`, `data.ts spans, marks`) | When each idea ran and when it was judged | `snap.timeline[]` (kind, id, at, status, title, value) and report/review/dossier `publishedAt`. Per-hypothesis tracks: NOT AVAILABLE. Ours draws a flat list of 12 rows | partial | P1 |
| P12 | Event log with text filter; skeptic and verdict notes withheld until the verdict (`report/Events.tsx`) | Audit trail of what happened and when | No event log with notes. Nearest: `snap.timeline`. No withholding logic exists | partial | P2 |

### 1.4 Run-level evidence (Shinka Inspector "Evaluation" pane and Progress metric cards) -> Factor Run evidence

Shinka judges a program by its public metrics, feedback text, logs and plots
(`run/panes.tsx EvalPane`, `Inspector.tsx`, `ProgressSections.tsx
MetricsSection`). The AQV2 equivalent is the Factor Run's diagnostics. All
rows below read `snap.factorExplorer`, which is built only for the current
Run of the lane (see L7). Field names were listed from a real Run.

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| R1 | Public metrics list for the selected program (`panes.tsx EvalPane` `Metrics`) | The headline numbers | `FE.summary.validation` (`meanRankIc`, `rankIcir`, `hacNormalPValue`, `observations`, `sufficient`); ours draws four tiles and a "below minimum" flag | done | P0 |
| R2 | Visible test split, hidden-metrics note (`EvalPane` private metrics) | What the unseen segment says, labelled as audit | `FE.summary.testAudit` (same shape as validation), `FE.protocol.testRole = visible-diagnostic`, `testEntersSelection = false`. Not drawn | missing | P1 |
| R3 | Metric-over-time cards (`MetricsSection`, L04) | How a metric moves across the run | `FE.icPath.points[]` (180 sampled points of `totalRows` 59880; keys `timestamp`, `split`, `role`, `regime`, `rankIcH4/H24/H72`, `pearsonIcH4/H24/H72`). No chart exists in ours (no d3 or SVG helper beyond icons) | missing | P0 |
| R4 | Per-split stability (no Shinka equal; the nearest is the ledger "sub-period" rule, `checksOf` `oos_positive_fraction`) | Does the effect hold in both halves | `FE.stability.chronologicalFolds[]` (`id`, `split`, `meanRankIc`, `hacNormalPValue`, `observations`), `FE.summary.weakestValidationFold` | missing | P0 |
| R5 | Factor qualification funnel (AQV2-native; Shinka analog is the ledger's "beats buy-and-hold" row) | Is the edge raw, style-driven, or absent; does it qualify for Portfolio | `FE.factorQualification.diagnosis {stage, iterationFocus, explanation, qualifiesForPortfolio}`, `.validation {candidate, dominantStyle, styleNeutralCandidate, equalRankBlend, incremental}`, `.selection {dominantStyle, candidates[]}`, `.claim` | missing | P0 |
| R6 | Horizon profile (analog: Progress per-generation small multiples) | Is the claim at the primary horizon, and what do neighbouring horizons say | `FE.horizonProfile[]` (`horizon` 4/24/72, `train/validation/test` summaries); Run metric `horizon_quality` | missing | P1 |
| R7 | Regime split (no Shinka equal) | Does the edge live in one market regime | `FE.stability.causalRegimes[]` (12 rows: split x regime) | missing | P1 |
| R8 | Per-asset split | Is one asset carrying it | `FE.stability.assets[]`; for single-asset temporal runs only the prediction asset has a row (`unclear` for multi-asset) | missing | P1 |
| R9 | Style correlations (analog: ledger baseline row) | Overlap with known styles (momentum, reversal, ...) | `FE.stability.styles[]`, `FE.summary.maximumValidationStyleOverlap`; Run metric `style_correlations` | missing | P1 |
| R10 | Component attribution (analog: `EvalPane` "code analysis") | Which declared component carries the score; ablation; redundancy | `FE.factorComponents` (`components[]`, `trialDisclosure`, `validationDiagnosis`, `fixedBlend`, `pairwise`) | missing | P1 |
| R11 | Quantile spread (no Shinka equal) | Monotonic payoff across signal buckets | `FE.quantileSummary[]`, `FE.quantileEvidence`, `FE.quantilePath`. In the sample these are empty with `status protocol-unavailable` (single-asset temporal). Behaviour on a cross-sectional Run: `unclear` | missing | P1 |
| R12 | Input availability and coverage (analog: `EvalPane` general block) | Is the panel complete; where are the holes | `FE.inputAvailability`, `FE.coverage[]`, `FE.availabilityPath.points[]` | missing | P1 |
| R13 | Protocol and split box (analog: `Inspector` meta header) | Selection split, test role, 60/20/20 boundaries, purge, horizon blocks | `FE.protocol` (`selectionSplit`, `testRole`, `testEntersSelection`, `splits`, `horizons`); Run metrics `research_integrity`, `split_protocol`. Ours prints the authority sentence in "Next move" only | partial | P1 |
| R14 | Factor decay (no Shinka equal) | Does IC decay from train to validation to test | Run metric `factor_decay` exists in the judge output, but `FE` has no decay field: NOT AVAILABLE in the snapshot, needs an explorer field | missing | P1 |
| R15 | Prediction universe, outcome and horizon semantics (analog: Inspector "general" rows) | What was predicted, on which assets, over which bars | `FE.predictionUniverse`, `FE.factorOutcome`, `FE.researchHorizon` | missing | P1 |
| R16 | Provenance: ids, hashes, harness, dataset, duration (analog: `EvalPane` general: id, parent id, language, time) | Can this result be reproduced | `FE.run` (`id`, `inputHash`, `studyHash`, `sourceHash`), `FE.dataset` (`id`, `version`, `hash`, `timeRange`, `universe`), `FE.harness` (`version`, `commit`, `dirty`), `snap.runs[].durationMs` | missing | P1 |
| R17 | Failure display for a program (`Inspector.tsx` failed badge, feedback) | Why a try failed | `snap.runs[].errors`, `.failureDisposition`, `.summary`. In the snapshot, not drawn | missing | P1 |
| R18 | stdout / stderr panes (`EvalPane`) | Raw logs | NOT AVAILABLE: `stdout.txt`, `stderr.txt` are in the Run directory (manifest lists them) but no route serves them | missing | P2 |
| R19 | Plots gallery (`EvalPane` `get_plots`) | Images the evaluator wrote | NOT AVAILABLE: AQV2 Runs write CSV and JSON artifacts, no images | missing | drop |

### 1.5 Run list, Run page, Compare

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| L1 | Run list: grouped by task, search, kind filter, collapsible groups (`runs/RunList.tsx`, `runs/data.ts`) | Every run, found fast | `snap.runs[]` (`id`, `status`, `studyId`, `subject`, `primaryMetric`, `primaryValue`, `startedAt`, `durationMs`, `summary`, `errors`, `failureDisposition`, `metricLayers`). Ours shows only the latest Run per Study | missing | P1 |
| L2 | Row statistics: programs, valid, failed, best, generations, stall, prompts, cost, runtime, updated | Health and progress per run | Map: `status`, `primaryValue`, `startedAt`, `durationMs`, `errors.length`. Programs, generations, prompt count, cost: NOT AVAILABLE (engine or spend concepts) | missing | P1 |
| L3 | Sort by updated, name, score, cost; totals and subtotals | Ordering and sums | Client-side on `snap.runs`; cost: NOT AVAILABLE | missing | P2 |
| L4 | Cross-Project run listing | Runs of the whole workspace in one table | NOT AVAILABLE: workspace summary carries `runCount` only | missing | P2 |
| L5 | Select 2 or more runs -> Compare | Start a comparison | Client-side | missing | P1 |
| L6 | Run page route: `RunPage` with run bar, view tabs, resident inspector | Open any single run and read all of it | NOT AVAILABLE for past Runs: `FE` is built only for the lane's current Run (`current_program_run`) or latest succeeded one. Older Runs have `summary` and `metricLayers` only. `load_factor_diagnostics(project, run_id)` exists in `factor_explorer.py`, so the fix is a `/api/v1/run?project=&id=` route. Without it a KEEP/REVERT row cannot be opened | missing | P0 |
| C1 | Compare chart: one step curve per run, best / programs / valid by generation (`compare/Compare.tsx`, `series.ts byGeneration`) | Which candidate is ahead and when | Analog: `DM.trials[]` x `DM.metrics[]` (9 metrics, each with `split`, `preference`, `selectionEligible`) and `trials[].vsBaseline`. Legacy Studio draws it (`renderDecisionMatrix`); new app does not | missing | P1 |
| C2 | Compare by spend (`bySpend`) | Score per dollar | NOT AVAILABLE (no spend) | missing | P2 |
| C3 | Leaderboard of each run's top programs (`groupBoards`, `groupLeads`) | Which candidate to keep | `DM.tradeoffs {nonDominatedRunIds, leaderVsBaseline, incompleteRunIds}` | missing | P1 |
| C4 | Metric switch, pointer readout of all runs at one x, shape-coded runs | Reading values precisely | Client-side over C1 data | missing | P2 |
| C5 | Cross-Project compare | Same Study in two Projects | NOT AVAILABLE (see L4) | missing | P2 |

### 1.6 Progress view (Shinka `run/Progress*.tsx`)

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| G1 | Best-so-far per generation with failures as crosses (`Progress.tsx`, `progressData.ts`, `trends.ts`) | Is the search still getting better | Analog: Session trajectory = `sessions[].experiments[]` in `sequence` order with `leaderValue`, `candidateValue`, `verdict` (KEEP / REVERT / CRASH). Legacy draws it (`renderTrajectory`) | missing | P1 |
| G2 | Cost per generation, stacked by model / meta / prompt (`costs.ts`, `ProgressSections SpendSection`) | Where money goes | NOT AVAILABLE | missing | P2 |
| G3 | Programs per generation (throughput bars) | Search rate | Experiments per Session only; low value | missing | P2 |
| G4 | Model posterior per model (`Progress.tsx posterior`) | Which sampler is winning | NOT AVAILABLE: AQV2 has no model-sampling engine | missing | P2 |
| G5 | By-model table: success rate, best, mean, cost (`ModelTable`, `success.ts`) | Which model writes better candidates | NOT AVAILABLE: no per-model attribution recorded (`unclear` whether Sessions record the authoring model) | missing | P2 |
| G6 | Score vs cumulative spend or compute time (`SpendSection`) | Efficiency | NOT AVAILABLE | missing | P2 |
| G7 | Runtime / throughput worker-lane timeline (`RuntimeSection`, `throughput.ts`, R10) | Worker utilisation | Only `runs[].durationMs`; `sessions[].progress` (running campaigns) shape `unclear` | missing | P2 |
| G8 | Diagnostics: patch-type x model heatmaps, success by patch type (`DiagnosticsSection`, `Heatmap`, `TypeBars`) | Which mutation kinds work | Engine only | missing | P2 |
| G9 | Generation scrubber and replay (`run/Scrubber.tsx`) | Replay the search | Engine only. Could scrub Experiments (P2) | missing | P2 |

### 1.7 Evolution-engine views (kept for completeness)

Reason for the P2 marks in this subsection: AQV2 has no program database, no
islands, no prompt evolution and no automatic mutation loop. The merge plan
(decisions 2 and 5) defers the engine until a concrete consumer asks. A
Session is a linear chain baseline -> Experiments, not a tree.

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| E1 | Lineage tree per island, ancestry of best and selected (`run/Lineage.tsx`) | How the best program descended | NOT AVAILABLE. Linear analog only: Experiment `leaderValue` -> `candidateValue`, `candidate.sourceHash` | missing | P2 |
| E2 | Islands: population per island and every migration (`LineagePanel.tsx Islands`) | Diversity management | Engine only | missing | P2 |
| E3 | Prompt tree and prompt versions with line diff (`PromptTree.tsx`, `LineagePanel.tsx PromptsSection`) | How system prompts evolved | Engine only | missing | P2 |
| E4 | Offspring: most fertile parents, mutation size vs score change (`Offspring.tsx`) | Which parents breed winners | Engine only | missing | P2 |
| E5 | Meta-analysis conclusions with update picker and plain-text download (`LineagePanel.tsx Conclusions`, `get_meta_content`) | LLM digest of the run | Engine only; AQV2 analog is a published Report (K1) | missing | P2 |
| E6 | Inspector LLM pane and meta pane (`Inspector.tsx`) | The sampler's prompt and response; the program's meta summary | Engine only. Agent conversations are not recorded in a Run (`unclear`) | missing | P2 |
| E7 | Inspector code pane: highlighted source, line numbers, copy, download (`panes.tsx CodePane`, `highlight.ts`) | Exactly what was evaluated | NOT AVAILABLE through the API: candidate source is in the Run directory (`sources/factors/candidate.py`, hashed in the manifest) and `snap.sessions[].candidate.sourceHash` names it. Needs a read-only file route | missing | P1 |
| E8 | Inspector diff pane: against parent or initial, changes-only (`panes.tsx DiffPane`) | What this candidate changed | Same blocker as E7. Leader source and candidate source both live in the Session worktree and Run directories | missing | P1 |
| E9 | Resident inspector layout and program selection that every view drives (`run/RunPage.tsx`, 6.1/OD-11) | One selection across views | Becomes a Run selection once L6 exists | missing | P2 |

### 1.8 Documents and library

| ID | Shinka feature (file) | What it shows / question it answers | AQV2 data source | Status | Prio |
| --- | --- | --- | --- | --- | --- |
| K1 | Library page: index, log, wiki pages, double-bracket page links, pending raw sources (`library/Library.tsx`, `library.py`) | Accumulated knowledge across directions; what failed before | NOT AVAILABLE: Workspace library is slice E, deferred past 0.10.0. Nearest existing text: Reports, Reviews, Dossiers across Projects | missing | P2 |
| K2 | Report as the written conclusion (Shinka: verdict reason text plus finding pages; AQV2 concept map: Report verdict + selection-adjusted evidence) | The delivered conclusion with findings and recommendations | `snap.sessions[].reports[]` and `snap.runReports[]`: `title`, `executiveSummary`, `findings`, `recommendations`, `authority`, `leaderDecisionSupport`, `selectionIntegrity`, `publishedAt`, `supersededBy`, `correction`. Body: `markdownPath` only | missing | P0 |
| K3 | Independent review (no Shinka equal; closest is a skeptic note in the log) | A second reader's classification of each claim | `snap.reviews[]`: `conclusion`, `claims`, `classifications`, `target {reportId, runId, sessionId}` | missing | P1 |
| K4 | Dossier (no Shinka equal) | Program-level evidence bundle across lanes | `snap.dossiers[]`, `snap.dossierStatus` (`includedLanes`, `executiveSummary`, `evidenceHash`) | missing | P1 |
| K5 | Hypothesis body as the long-form claim (`Claim` folded full text) | The reasoning behind the idea | `snap.researchProgram.text` (inline Markdown), `researchProgramStatus.lanes`, `recommendedLaneId`; needs S8 | missing | P1 |
| K6 | "Next command" hint when a hypothesis has no experiment (`rep.nextScaffold`, `rep.nextRun`) | What to do next | `agentWorkBrief.primaryAction`, `supportingActions`, `snap.commands`; ours draws `primaryAction` | done | P1 |
| K7 | Research agenda moves (no Shinka equal) | Bounded follow-up experiments the evidence suggests | `snap.agentWorkBrief.researchAgenda.moves[]`; legacy `renderResearchAgenda` | missing | P1 |

## 2. AQV2 surfaces the Shinka frontend does not have

These are not Shinka features, so they are outside the matrix above. They are
listed because the merge plan's parity table keeps them as `legacy`, and a
researcher of those lanes is blocked the same way.

| Surface | New app today | Source |
| --- | --- | --- |
| Price event study | done (`pages/EventStudy.tsx`) | `snap.eventStudyExplorer` |
| Portfolio decision explorer, sizing, stress, viability | legacy only | `snap.portfolioExplorer` |
| Governed RL policy lab | legacy only | `snap.rlExplorer` |
| Book risk | legacy only | `snap.bookRiskExplorer` |
| Reported-book path stress | legacy only | `snap.bookPathStressExplorer` |
| Strategic allocation | legacy only | `snap.allocationExplorer` |
| Research program and lane admission | legacy only | `snap.researchProgramStatus` |
| Studies: dataset, request, upstream evidence | name and metric only | `snap.studies[].dataset`, `researchRequest`, `upstreamEvidence`, `datasetContext` |

## 3. What a researcher cannot do today

Tasks blocked in the new app (most are still possible in the hidden `/legacy`
Studio, which is removed in 0.10.1).

1. State and read the idea. The question, decision context, hypotheses,
   horizon and claim type are in the payload (P3) but not drawn; the page
   shows only the Project description. What would count as success or failure
   does not exist as data at all.
2. Tell whether a validation IC is luck. The number of tries and the
   family-wise adjusted p (`SI.researchFamily`, `SI.selectionAdjustment`) are
   not drawn, so a mean IC of 0.033 looks the same whether it came from 1 try
   or 90 (O4, P4, P6).
3. See a verdict with reasons. There is no verdict label, no check ledger and
   no pass/fail per rule (P6, P7). The Hypothesis object is not built.
4. See the KEEP/REVERT history. Experiments, their hypothesis text, leader vs
   candidate value and improvement are not drawn; only the Session id is
   (P10, G1).
5. Look at the IC over time. No chart exists, and the 180-point IC path with
   split and regime tags is unused (R3).
6. Check stability. Chronological folds, regimes, per-asset and style
   overlap are not drawn, so "does it hold in both halves" is unanswerable
   (R4, R7, R8, R9).
7. Diagnose why a factor fails. The qualification stage (raw edge absent vs
   style-driven), style-neutral IC and blend uplift are not drawn (R5, R10).
8. Open any Run other than the current one. The explorer exists only for the
   lane's current Run, and there is no Run route or Run page (L6).
9. Compare a candidate to the baseline across metrics, or see which trials
   are non-dominated (C1, C3).
10. Read what was tested. Candidate source and the diff against the leader
    are not served (E7, E8).
11. Read the written conclusion: Report findings and recommendations, the
    Independent Review, the Dossier (K2 to K4). Report bodies need a file
    route.
12. See the holdout result and its Assessment label (P9).
13. Browse Run history, filter failures, read errors (L1, R17).
14. Verify reproducibility: dataset, study and harness hashes and the Run
    `inputHash` are in the payload and not shown (R16).
15. Read a definition of HAC, purge, rank IC or style-neutral in place (S7).
16. See, from the Projects list, which Projects have cleared their bar and
    how many tries each took (O3 to O5).

## 4. Recommended build order for the missing P0 and P1 views

Principle: finish everything the existing payload can already feed (steps 1
to 5, frontend only), run the server work for the Hypothesis, ledger and noise
series in parallel, then wire it. The browser draws and never computes (design
doc rule), so every item that needs a number the server does not send is
marked `server`. First task for steps 1 to 5: widen `studio-app/src/api.ts`,
which types only the fields the current pages read, and add a small chart
helper (SVG or d3; ours has none).

| Step | Build | Rows | Wire to | Needs |
| --- | --- | --- | --- | --- |
| 1 | Experiments ledger and trajectory chart on the Project page | P10, G1, P7 (interim) | `sessions[].experiments[]` (`sequence`, `hypothesis`, `verdict`, `leaderValue`, `candidateValue`, `improvement`, `runId`); `sessions[].decisionMatrix.trials[]` (`primaryValue`, `isCurrentLeader`, `status`) | frontend only |
| 2 | Selection-adjusted evidence block: trial counts and adjustment | O4, P4 (scalar), P6 (partial) | `sessions[].selectionIntegrity.researchFamily` (`uniqueSourceTrials`, `failedSourceTrials`, `totalExecutions`, `reproducible`), `.selectionAdjustment` (`passes`, `interpretation`, `method`, `statistics`), `.externalHoldoutRequired`, `.warning` | frontend only |
| 3 | Question and claim panel | P3 | `agentWorkBrief.question`, `sessions[].delegation.request`, `factorExplorer.factorQualification.claim`, `researchHorizon` | frontend only |
| 4 | Factor evidence set: IC path chart, fold table, qualification diagnosis, horizon profile, regimes, assets, styles, provenance, protocol box, errors | R3, R4, R5, R6, R7, R8, R9, R13, R15, R16, R17 | `factorExplorer.icPath.points`, `.stability.chronologicalFolds/causalRegimes/assets/styles`, `.factorQualification.diagnosis/.validation`, `.horizonProfile`, `.protocol`, `.run/.dataset/.harness`, `snap.runs[].errors` | frontend only |
| 5 | Reports, Reviews, Dossiers, holdout panel | K2, K3, K4, P9, K7 | `sessions[].reports[]`, `runReports[]`, `reviews[]`, `dossiers[]`, `externalHoldout`, `agentWorkBrief.researchAgenda.moves` | frontend only; holdout evidence keys to confirm on a Project that has one |
| 6 | Run route and Run page; Run list; Compare | L6, L1, L2, L5, C1, C3 | New `server`: `/api/v1/run?project=&id=` returning `load_factor_diagnostics(project, run_id)` for any Run; list from `snap.runs[]`; compare from `decisionMatrix.metrics/trials/tradeoffs` | `server` route, then frontend |
| 7 | Candidate source and diff viewers; stdout/stderr | E7, E8, R18 | New `server`: read-only file route for `sources/**`, `stdout.txt`, `stderr.txt` of a verified Run (confined to the Run directory, hash-checked against the manifest) | `server` |
| 8 | Hypothesis table, claim criteria, check ledger, verdict panel, noise-frontier line, per-hypothesis timeline, Projects-list status counts and gauge | P2, P3 (criteria), P6, P7, P4 (noise line), P8, P11, O3, O5 | Design steps H1 to H9 in [[docs/design/hypothesis-and-idea-verdict]]: `hypotheses` array on `/api/v1/project`, `GET /api/v1/hypothesis`, ledger rows, per-prefix `expected_maximum_sharpe` series (Portfolio only), PBO `not-computed` until slice C | `server`, then frontend |
| 9 | Glossary tooltips, Markdown renderer, URL state, palette items, factor decay and quantile views | S7, S8, S9, S3, R14, R11 | Definitions from `FE.protocol.semantics`; `markdownPath` through the step 7 route; `factor_decay` needs an explorer field; quantiles need a cross-sectional Run to verify | mixed |

Notes on the order. Step 8 is where the real verdict lives, but it is the only
step that blocks on unbuilt server objects; steps 1 to 5 deliver a readable
interim "evidence page" now and make step 8 a re-wiring. Step 2 comes before
step 4 because the adjustment turns the headline IC from a claim into a
number with a price. Step 6 is the first server change and is small (the
loader already exists).

## 5. Known limits of this inventory

- Sample Project is single-asset temporal Factor with one Experiment; Portfolio,
  RL, Book Risk and Path Stress payload shapes were not listed.
- `DM.trials` is capped at 12; a chart of a long Session needs the cap raised
  or a separate series (`DM.scope.omittedCandidateTrials` reports the cut).
- Shinka `run/*` rows were derived from doc comments, props and copy keys, not
  from reading every drawing branch; the engine rows are low risk, the
  Progress rows (G1 to G9) moderate.
- Whether Sessions record the authoring model, a spend figure or a probe
  count was not found in `studio.py`; those rows say `unclear` or `NOT
  AVAILABLE` accordingly.
