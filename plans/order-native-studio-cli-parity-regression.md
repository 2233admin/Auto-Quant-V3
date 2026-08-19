# Order-native Studio/CLI parity and closing regression

- Status: `proposed`
- Updated: `2026-08-19`
- Related design: [[docs/design/order-native-portfolio-decisions]] and
  [[docs/design/studio-observation-surface]].
- Parent plan: [[plans/order-native-portfolio-decisions]] (Work item 9 of 9,
  closing plan for the series).
- Depends on: every other `order-native-*` sub-plan in this series
  ([[plans/order-native-decision-plan-schema]],
  [[plans/order-native-bar-execution-kernel]],
  [[plans/order-native-mechanical-portfolio-integration]],
  [[plans/order-native-governed-rl-integration]],
  [[plans/order-native-decision-support-surfaces]],
  [[plans/order-native-execution-risk-metrics]]).

## Outcome

Studio, CLI, Report, and Dossier surfaces present the full order-native
model with parity, a realistic hourly standalone scenario and the same
host-delegated scenario both pass bounded end-to-end verification, complete
regression is green, and the parent plan
[[plans/order-native-portfolio-decisions]] can be marked `completed`.

## Context

This is the parent plan's final Work item and Acceptance item: "A realistic
hourly standalone scenario and the same host-delegated scenario pass bounded
end-to-end verification and complete regression." Every other sub-plan in
this series ships an isolated piece (schema, kernel, mechanical integration,
RL integration, delivery surfaces, metrics). This plan is where they are
proven to work together and exposed consistently to a human or Agent
operator.

## Scope

### In scope

- Studio surfaces for DecisionPlan/OrderIntent state, fill/protection
  lifecycle, and the new trade/protection/risk metrics.
- CLI parity for every new surface Studio exposes.
- Report/Dossier parity: current target portfolio, conditional order
  template, `tradingAuthority: none`, and every field required by
  [[plans/order-native-decision-support-surfaces]].
- One realistic hourly standalone scenario (no OpenAlice host) and the same
  scenario replayed as an OpenAlice-hosted delegated request, both passing
  bounded end-to-end verification.
- Full repository regression: `uv run pytest`,
  `uv run python scripts/check_doc_links.py`, and any other check this
  repository's own CI/verification convention requires at that time.
- Marking [[plans/order-native-portfolio-decisions]] `completed` with its
  Completion section filled in, once every sub-plan and this plan's own
  acceptance items are satisfied.

### Out of scope

- Any new execution semantics, metrics, or schema fields not already defined
  by an earlier sub-plan in this series (this plan integrates and verifies;
  it does not add new product surface).

## Acceptance

- [ ] Studio, CLI, Report, and Dossier expose the full order-native model
      with verified parity across all four surfaces.
- [ ] The hourly standalone scenario and the host-delegated scenario both
      pass bounded end-to-end verification.
- [ ] Complete regression is green.
- [ ] [[plans/order-native-portfolio-decisions]] is updated to `completed`
      with a filled Completion section referencing this plan and every
      sub-plan as the shipped work.

## Work

- [ ] Confirm every dependency sub-plan is `completed` before starting.
- [ ] Implement Studio surfaces for the new evidence.
- [ ] Implement CLI parity.
- [ ] Implement Report/Dossier parity.
- [ ] Build and run the hourly standalone scenario.
- [ ] Build and run the host-delegated scenario.
- [ ] Run and record complete regression.
- [ ] Close out [[plans/order-native-portfolio-decisions]].

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 9 as the closing plan for the whole series.

## Verification

- Pending.

## Progress log

- 2026-08-19 — Plan created.

## Completion

Pending.
