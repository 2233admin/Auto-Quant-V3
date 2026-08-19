# Order-native governed RL integration

- Status: `proposed`
- Updated: `2026-08-19`
- Related design: [[docs/design/order-native-portfolio-decisions]] and
  [[docs/design/rl-factor-policy-lab]].
- Parent plan: [[plans/order-native-portfolio-decisions]] (Work item 6 of 9).
- Depends on: [[plans/order-native-bar-execution-kernel]] and
  [[plans/order-native-mechanical-portfolio-integration]] (RL must share the
  exact same fixed execution semantics the mechanical lane just adopted).

## Outcome

Governed RL and its baselines execute target-weight decisions through the
same order-native kernel as the mechanical lane, so mechanical and RL
policies are comparable on identical execution terms.

## Context

The design doc's invariant 5 states: "Every RL and mechanical policy uses
the same fixed execution semantics." The parent plan's 2026-07-27 finding is
explicit about RL's boundary: RL may learn a causal state representation or
a constrained decision policy over FactorState, but it may never own fixed
execution truth, alter fills/fees/timing, or gain future-bar access from
inside candidate code. This plan wires the already-integrated kernel into
the RL lane without weakening that boundary.

## Scope

### In scope

- Route governed RL's target-weight/action output through the same
  `DecisionPlan`/`OrderIntent`/kernel path the mechanical lane now uses.
- Preserve every existing RL governance boundary: no data-timing, fill,
  fee, Mandate, or evaluation-split control from inside candidate/policy
  code.
- Update RL baseline comparisons so "value beyond the factor itself" and
  "value versus the same mechanical target/order policy" are computed on
  identical execution terms (per the design doc's RL evidence expectations).
- Preserve fold/seed/baseline evidence structure; extend it with
  order/fill/protection outcomes where the design doc requires them (action
  stability, target churn, order churn, fill behavior, protection
  outcomes).

### Out of scope

- Any new RL algorithm, state representation, or policy architecture.
- New decision-support or execution/risk metrics beyond what RL parity with
  the mechanical lane requires
  ([[plans/order-native-decision-support-surfaces]],
  [[plans/order-native-execution-risk-metrics]] own new evidence types).
- Studio/CLI/Report/Dossier surfaces
  ([[plans/order-native-studio-cli-parity-regression]]).

## Acceptance

- [ ] Governed RL executes through the identical kernel and
      `DecisionPlan`/`OrderIntent` contract as the mechanical lane; no
      parallel or divergent execution path exists.
- [ ] No RL candidate code path can alter data timing, fills, fees, Mandate
      permissions, or the evaluation split (existing governance tests still
      pass and are extended to cover the new execution surface).
- [ ] RL baseline evidence reports action stability, target churn, order
      churn, fill behavior, and protection outcomes.
- [ ] "No claim of RL value unless it survives cost, execution, risk, and
      validation breadth" is enforced structurally, not just documented.
- [ ] Existing RL tests pass with fill-based accounting; `uv run pytest`
      passes for the full suite.

## Work

- [ ] Locate every governed-RL module that currently assumes close-target
      execution and enumerate required changes.
- [ ] Route RL action/target output through the shared kernel path.
- [ ] Extend fold/seed/baseline evidence with order/fill/protection outcome
      fields.
- [ ] Update or add governance tests proving RL cannot bypass the fixed
      execution boundary.
- [ ] Run full existing regression and record exact commands/results.

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 6.

## Verification

- Pending.

## Progress log

- 2026-08-19 — Plan created.

## Completion

Pending.
