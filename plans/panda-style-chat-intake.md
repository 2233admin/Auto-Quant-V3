# Panda-style chat intake UX

- Status: `active`
- Updated: `2026-11-23`
- Related design: [[docs/design/studio-observation-surface]], [[docs/design/external-researcher-driver]], [[docs/design/studio-assistant]]

## Outcome

A user opens AutoQuant Studio and lands in a chat workspace. The user can start from a template card or type a request. The page shows the six intake fields beside the conversation. The user sends the request only after the required fields are present. The result appears in the chat as a short summary with five metrics, one group cumulative return chart, and a link to the full evidence page.

## Context

AutoQuant already has an Assistant page with local model sessions, trial budgets, message history, and confirmation gates. Its first viewport is a factor library, so a user with a half-formed research idea has no chat entry until they find the Assistant navigation item. The online product PandaAI opens directly into a chat workspace with template cards and an input box. The goal is to match that entry experience without copying the platform's styling or bypassing AutoQuant's confirmation, trial budget, and read-only boundaries.

The online product was used from a logged-in Chrome session on 2026-11-22. The observed chat page had a left session list, a template gallery, a text composer, a model picker, and inline result cards. The gallery grouped templates into futures strategies, stock strategies, ETF strategies, futures factors, stock factors, data queries, and research tools. A template click started a run immediately. AutoQuant will keep a confirmation step.

## Scope

### In scope

- Make the chat workspace the default Studio landing page.
- Add template cards grouped by task type: strategy, factor, data query, research tool.
- Each card shows a title, a one-sentence description, and a “fill and confirm” hint.
- Clicking a card fills the composer. It does not send.
- Show the six intake fields in the right sidebar: market, symbol, signal, position sizing, risk control, backtest specification.
- Require market, symbol, and signal before sending. Position sizing, risk control, and backtest specification may start with defaults.
- In read-only mode, allow the template to fill the composer, disable send, and show the read-only reason.
- Show only the current model beside the composer. Model selection stays in settings.
- Render five result metrics, one group cumulative return chart, and a link to the full evidence page inside the chat.
- For each counted trial, show the candidate's previous kept result beside this trial's result for the same validation metrics, in the confirmation and in the turn after the trial. Say so when no previous result exists.
- Reuse three visual components as references: template card, result card, and session list. Style them with AutoQuant design tokens.
- Preserve the left session list on desktop. Defer mobile history access.
- Keep the existing confirmation, trial budget, action gate, and original Run links.

### Out of scope

- No live trading or order submission.
- No automatic send after a template click.
- No copy of the online platform's visual styling, logo, or page layout.
- No mobile history drawer in this plan.
- No new research engine, evaluator, or data source.
- No change to the factor library's evidence model.

## Acceptance

- [ ] Opening the Studio root shows the chat workspace.
- [ ] The empty chat shows template cards grouped by task type.
- [ ] A template click fills the composer and does not send.
- [ ] The right sidebar shows the six intake fields.
- [ ] Send is disabled until market, symbol, and signal are present.
- [ ] In read-only mode, a template fills the composer, send stays disabled, and the page gives the read-only reason.
- [ ] The composer shows the current model and does not duplicate the settings page.
- [x] A completed result appears in chat with five metrics, one group cumulative return chart, and a link to the evidence page. Factor and Portfolio Runs carry the five metrics and the chart; a Run of any other lane shows a header and the link (see Findings and decisions).
- [ ] The full evidence page remains the source for complete tables, group returns, and original Run records.
- [x] A counted trial shows the candidate's previous kept result beside this trial's result for the same validation metrics, in the confirmation and in the turn after the trial, or says that no previous result exists.
- [ ] Desktop shows the session list. Narrow screens show the chat without page-level horizontal overflow.
- [ ] Existing Assistant confirmation, trial budget, and read-only checks still pass.
- [ ] Frontend tests cover the template fill, required fields, read-only send, result summary, and deep link.
- [ ] `pnpm run test:ui`, `pnpm run typecheck`, `pnpm run check:i18n`, and `pnpm run build` pass.

## Work

- [ ] Write a short interaction spec for the chat landing page, template card, six fields, and result summary.
- [ ] Add a template catalog to the Assistant empty state.
- [ ] Add the six-field sidebar and required-field validation.
- [x] Add the result summary card and link to the full evidence page.
- [x] Add the before/after table for a counted trial, with the one server field it needed (`priorLeaderRunId` on each decision-matrix trial).
- [x] Add frontend tests for the result card and the before/after table.
- [ ] Add frontend tests for the new behavior.
- [ ] Run the full check set and a real browser pass at desktop and narrow widths.
- [ ] Complete the audit and link the final commit or pull request.

## Findings and decisions

- 2026-11-22 — The online product's template gallery is organized by market and task type. AutoQuant will use task type as the top-level grouping and put the market on the card as a label.
- 2026-11-22 — The online product sends a template immediately. AutoQuant will fill the composer only, because the user must confirm the six fields and the action gate.
- 2026-11-22 — The online product shows model, thinking level, and execution mode beside the composer. AutoQuant will show only the model, because the trial budget and confirmation gate are the meaningful controls.
- 2026-11-22 — The online product embeds result metrics and charts in chat. AutoQuant will show five metrics and one group cumulative return chart in chat, with the full evidence page one click away.
- 2026-11-22 — Mobile history access is deferred. The desktop session list remains.
- 2026-11-23 — Result card metric choice. A Factor Run card shows Mean rank IC, HAC t-statistic, Adj. p, Long-short return (gross) and Trials counted. A Portfolio Run card shows Net Sharpe, Net annual return, Max drawdown, Deflated Sharpe and 1-way turnover per year. Every tile opens the existing metric explanation. Every number comes from an existing server projection (the Run payload, the Project snapshot, the Session ledger); Studio does no statistics. A value the server does not publish shows the Not published state, never a placeholder.
- 2026-11-23 — The Factor long-short number is the gross validation total return of the high-minus-low group and is labelled gross, because the Factor Run publishes no net long-short figure. Adj. p is the Session ledger's familywise value and appears only when the Run is that Session's leader; any other Run shows Not published. The Portfolio card matches Deflated Sharpe to the Run through the Strategy evidence run id, and the Project snapshot carries per-Run Portfolio numbers and the net curve only for the latest Portfolio Run, so an older Portfolio Run shows Not published with a note. The card draws the Portfolio net curve with a small plot of its own (`PortfolioNetPlot`) instead of reusing the Portfolio page chart.
- 2026-11-23 — A Run of another lane (reinforcement learning, book risk, allocation and so on) shows a header and the link to its evidence page, not five metrics. The brief did not settle metrics for those lanes. Choosing them is left to the plan owner.
- 2026-11-23 — The before/after table lists the validation, selection-eligible, non-context metrics the Session decision matrix already serves, for the candidate's previous kept result and for this trial. The previous kept result is the trial named by the new `priorLeaderRunId` field, which the matrix builder already knew and now exposes (null for the baseline). The verdict and the primary-objective change are the server's `objectiveImprovementVsPriorLeader`; Studio subtracts nothing. The test split is never listed. Before confirmation the table shows the previous result and a dash under This trial; when no previous result is in the displayed trials it says so.
- 2026-11-23 — At most three cards follow a turn, newest first, with a note that earlier Runs are listed under Artifacts. Cards carry `aria-live="off"` so the message log does not announce them again. The card corner trims only the top-right chamfer with its own clip-path, because the shared chamfer would clip the metric explanation popovers.

## Verification

Result card and before/after table, branch `feat/assistant-result-card`, run 2026-11-23 from `D:\projects\.worktrees\aqv3-fe-b`:

- `uv run python -m unittest tests.test_studio_assistant tests.test_studio_assistant_providers tests.test_decision_matrix` — 44 tests, OK, exit 0 (includes the new `priorLeaderRunId` assertions).
- `uv run python scripts/check_doc_links.py` — 2121 documentation double-links resolve, exit 0.
- In `studio-app`: `pnpm run typecheck` exit 0; `pnpm run check:i18n` exit 0 (0 raw strings, 0 missing enums, 0 missing catalog); `pnpm run test:ui` 134 tests, 134 pass, 0 fail (24 are new, in `studio-app/tests/assistant-result.test.tsx`); `pnpm run build` exit 0.
- Real browser pass with a scratch page (deleted afterwards) that mounted the real card and confirmation components over mocked `/api/v1/run` and a fixture Project snapshot: desktop in English and light theme, 375 px width in Chinese, no page-level horizontal overflow, the card corner and the open metric explanation stay inside the card, the before/after table renders in the confirmation and under the card.

Not yet verified: the card and the table against a live Assistant session with a real backend; the landing page, template cards, six-field sidebar, send gating, read-only reason and model display (other work on this plan); the full acceptance list, so the status stays `proposed`.

## Progress log

- 2026-11-22 — Plan created after a logged-in review of the online product's chat, factor library, strategy library, run history, tuning, simulation, and market pages.
- 2026-11-23 — Template cards (#30) and the six intake fields (#32) landed.
  Status moved to `active`; acceptance not audited.
- 2026-11-23 — Added the Assistant result card (five published metrics per Factor or Portfolio Run, one cumulative chart, link to the full evidence page) and the before/after table for counted trials, with one server field (`priorLeaderRunId`) and 24 frontend tests. Evidence is in Verification. Left open: live-session check, other lanes, and every item not about results.

## Completion

Complete this section only when status becomes `completed`. Summarize what shipped, identify any intentionally deferred follow-up as a separately indexed plan, and link the final commit or pull request when available.