# Order-native mechanical portfolio integration

- Status: `proposed`
- Updated: `2026-08-19`
- Related design: [[docs/design/order-native-portfolio-decisions]] and
  [[docs/design/portfolio-construction-lab]].
- Parent plan: [[plans/order-native-portfolio-decisions]] (Work item 5 of 9).
- Depends on: [[plans/order-native-decision-plan-schema]] and
  [[plans/order-native-bar-execution-kernel]].

## Outcome

The mechanical Portfolio lane (`construct_signal_policy` /
`simulate_targets` and their callers in
`autoquant/project_templates/ohlcv_portfolio_lab/portfolio_core.py`) realizes
its target weights through the order-native kernel instead of implicit
close-target execution. Unfilled or partially filled intent is never
reported as completed exposure.

## Context

The parent plan's 2026-07-27 finding identified the exact insertion point:
target weights and weight deltas already precede one shared
`simulate_targets` accounting path. This plan replaces that path's
close-target assumption with the kernel from
[[plans/order-native-bar-execution-kernel]], per the design doc's
"Breaking-change policy" (pre-alpha; replace, do not preserve a parallel
compatibility path) and its "Portfolio feedback loop" (actual filled
portfolio, not the old target, is the next decision's state).

## Scope

### In scope

- Replace `simulate_targets`'s implicit close-target execution with
  `DecisionPlan`/`OrderIntent` construction from each target-weight delta,
  routed through the kernel.
- Feed the kernel's fills back into portfolio accounting as the pretrade
  state for the next decision (per "Portfolio feedback loop").
- Preserve every existing causal, non-execution behavior of
  `construct_signal_policy` (signal transitions, position roles, risk
  governor, mandate constraints) unchanged.
- Update `build_decision_ledger` and downstream metrics
  (`signal_policy_metrics`, `attribution_metrics`, `performance_metrics`,
  `implementation_metrics`, `constraint_audit`, position-episode
  reconstruction) to consume fill-based, not close-target-based, exposure.
- Breaking-change migration: no dual-path compatibility shim for the old
  close-target evidence shape.

### Out of scope

- Governed RL integration ([[plans/order-native-governed-rl-integration]]).
- New decision-support surfaces or new execution/risk metrics beyond what is
  required to keep existing metrics correct under fill-based accounting
  ([[plans/order-native-decision-support-surfaces]],
  [[plans/order-native-execution-risk-metrics]] own new evidence).
- Studio/CLI/Report/Dossier surface changes
  ([[plans/order-native-studio-cli-parity-regression]] owns final parity).

## Acceptance

- [ ] `simulate_targets` (or its replacement) no longer treats a weight delta
      as a complete close execution; it constructs order intent and consumes
      kernel fills.
- [ ] Unfilled/expired/cancelled intent and partially protected exposure are
      never reported as a completed target portfolio.
- [ ] `build_decision_ledger` and every existing downstream metric function
      compute from actual filled state, matching the "Portfolio feedback
      loop" contract.
- [ ] Existing `tests/test_portfolio_lab.py` and `tests/test_mandates.py`
      pass after being updated for the new fill-based contract (breaking
      changes to test fixtures are expected and must be made, not worked
      around).
- [ ] Long and short positions both verified; `uv run pytest` passes for the
      full existing suite plus new coverage.

## Work

- [ ] Map every existing `simulate_targets` caller and consumer inside
      `portfolio_core.py` and the sample project templates.
- [ ] Replace the close-target execution path with kernel-backed order
      construction and fill consumption.
- [ ] Update `build_decision_ledger` and every metrics function that reads
      close-target exposure.
- [ ] Update `tests/test_portfolio_lab.py` and `tests/test_mandates.py` for
      the new contract; add fill-lifecycle-specific coverage.
- [ ] Run full existing regression and record exact commands/results.

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 5. Reuses the parent plan's existing 2026-07-27 finding that
  `simulate_targets` is the correct single insertion point.

## Verification

- Pending.

## Progress log

- 2026-08-19 — Plan created.

## Completion

Pending.
