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
- [ ] A completed result appears in chat with five metrics, one group cumulative return chart, and a link to the evidence page.
- [ ] The full evidence page remains the source for complete tables, group returns, and original Run records.
- [ ] Desktop shows the session list. Narrow screens show the chat without page-level horizontal overflow.
- [ ] Existing Assistant confirmation, trial budget, and read-only checks still pass.
- [ ] Frontend tests cover the template fill, required fields, read-only send, result summary, and deep link.
- [ ] `pnpm run test:ui`, `pnpm run typecheck`, `pnpm run check:i18n`, and `pnpm run build` pass.

## Work

- [ ] Write a short interaction spec for the chat landing page, template card, six fields, and result summary.
- [ ] Add a template catalog to the Assistant empty state.
- [ ] Add the six-field sidebar and required-field validation.
- [ ] Add the result summary card and link to the full evidence page.
- [ ] Add frontend tests for the new behavior.
- [ ] Run the full check set and a real browser pass at desktop and narrow widths.
- [ ] Complete the audit and link the final commit or pull request.

## Findings and decisions

- 2026-11-22 — The online product's template gallery is organized by market and task type. AutoQuant will use task type as the top-level grouping and put the market on the card as a label.
- 2026-11-22 — The online product sends a template immediately. AutoQuant will fill the composer only, because the user must confirm the six fields and the action gate.
- 2026-11-22 — The online product shows model, thinking level, and execution mode beside the composer. AutoQuant will show only the model, because the trial budget and confirmation gate are the meaningful controls.
- 2026-11-22 — The online product embeds result metrics and charts in chat. AutoQuant will show five metrics and one group cumulative return chart in chat, with the full evidence page one click away.
- 2026-11-22 — Mobile history access is deferred. The desktop session list remains.

## Verification

- Pending.

## Progress log

- 2026-11-22 — Plan created after a logged-in review of the online product's chat, factor library, strategy library, run history, tuning, simulation, and market pages.
- 2026-11-23 — Template cards (#30) and the six intake fields (#32) landed;
  the in-chat result summary with five metrics and a chart is not built. Status
  moved to `active`; acceptance not audited.

## Completion

Complete this section only when status becomes `completed`. Summarize what shipped, identify any intentionally deferred follow-up as a separately indexed plan, and link the final commit or pull request when available.