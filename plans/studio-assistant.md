# Governed local Studio Assistant

- Status: `active`
- Updated: `2026-11-02`
- Related design: [[docs/design/studio-assistant]], [[docs/design/studio-local-actions]]
- Execution tracking: https://github.com/2233admin/Auto-Quant-V3/issues/2

## Outcome

Operate AutoQuant from persistent Studio conversations with the owner's
already authenticated local Claude Code or Codex. Support automatic writes
in the first release, inspectable actions and durable artifact results.

## Context and scope

Studio already owns preview, confirmation, aq jobs and audit. Assistant reuses
those contracts. This plan owns navigation, contextual drawers, conversation
persistence, streaming transports and a structured broker. Conversation text
does not gain research-evidence or trading authority.

## Acceptance

- [ ] Both local providers are usable under proven confinement.
- [ ] New chat, persistence, incremental answers, cancellation and recovery work.
- [ ] Recorded actions, commands, diffs and artifact links are inspectable.
- [ ] Current-object drawers provide safe context.
- [ ] Automatic writes use shared aq contracts and source optimistic locking.
- [ ] Trial confirmations and atomically reserved budgets cannot be bypassed.
- [ ] Sealed data cannot leak through queries, inherited tools or candidate code.
- [ ] Real-provider canaries and repository checks are separately recorded.
- [ ] Portfolio creation and bounded optimization complete genuine Core paths.

## Work

- [x] Locate clean baseline and record owner decisions in GitHub.
- [x] Implement provider adapters and fail-closed availability.
- [x] Implement conversation persistence, HTTP integration and aq broker.
- [x] Add aq candidate show/save using the existing editor contract.
- [x] Integrate and build Assistant UI and contextual drawer.
- [ ] Verify actual Codex native tool closure.
- [ ] Add candidate-process isolation; enable guarded research execution.
- [ ] Run live streaming/login/isolation canaries without research trials.
- [ ] Complete Portfolio/optimization actions and acceptance audit.

## Findings and decisions

- 2026-11-02 — Owner selected two providers and automatic writes in V1.
- 2026-11-02 — Existing preview trial counts describe exposure, not budgets.
- 2026-11-02 — candidate.save wrote directly. New aq commands reuse its
  exact path, Session, hash and audit gates.
- 2026-11-02 — orient, snapshots and Run readers expose holdout projections;
  denying only the holdout verb is insufficient.
- 2026-11-02 — Candidate Python lacks process confinement. Execution remains
  denied; an allowlisted CLI is not a sandbox.
- 2026-11-02 — Codex dynamic tools are additive. Its adapter is implemented,
  but public availability stays false until closure canaries pass.
- 2026-11-02 — Preserve per-trial confirmation until the owner explicitly
  chooses an initial scoped automatic grant.
- 2026-11-02 — Native command/editor calls did not return and made no local
  edits. Development uses isolated GitHub branches and in-memory validation.

## Verification

- 2026-11-02 — 87 tests passed using the repository Python 3.11 environment
  and in-memory source overlays: 18 Assistant/HTTP/candidate CLI tests,
  46 existing Studio action regressions and 23 provider cases. Includes a real
  Windows parent-exit/descendant-cleanup canary with disposable Python
  processes; no provider inference or research trials.
- 2026-11-02 — Full frontend TypeScript check: 339 files, zero diagnostics.
  Standard Vite production build passed; generated served assets committed.
  Six route and eight SSR assertions passed; browser visual review is unrun.
- 2026-11-02 — Independent review found and prompted fixes for cross-process
  writes, crash-stale state locks, exact MCP tool approval and server shutdown.
  Provider readiness is cached and recent sessions are ordered by update time.
- 2026-11-02 — 1838 documentation double-links resolve with remote changes
  overlaid in memory; no document failures.
- Pending: actual branch checkout full unittest discovery, live provider
  streaming/login/tool-isolation canaries, browser interaction acceptance.

## Progress log

- 2026-11-02 — Baseline 9eae0f8, source checkout
  D:/projects/.worktrees/aqv2-fork, branch feat/shinka-studio-frontend.
  Native subagents own provider/UI worker branches; root owns integration
  branch feat/studio-assistant. Issue #2 remains open.

## Completion

Not complete. Receipt and fake-provider proofs are not product acceptance.
