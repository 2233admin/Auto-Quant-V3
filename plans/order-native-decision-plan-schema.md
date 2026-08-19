# Order-native decision-plan schema

- Status: `proposed`
- Updated: `2026-08-19`
- Related design: [[docs/design/order-native-portfolio-decisions]] and
  [[docs/design/quant-research-lifecycle]].
- Parent plan: [[plans/order-native-portfolio-decisions]] (Work item 3 of 9).
  This is the first slice; every later sub-plan in the series depends on the
  schema this plan defines.

## Outcome

A breaking `DecisionPlan`/`OrderIntent`/execution-evidence schema exists as an
importable, tested module with no dependency on the bar-execution kernel or
either decision-policy lane. Nothing consumes it yet; this plan only makes the
vocabulary real and typed.

## Context

`docs/design/order-native-portfolio-decisions.md` defines the full layered
model (FactorState → TargetPortfolio → DecisionPlan → OrderIntent → fixed bar
execution → ActualPortfolio/ExecutionEvidence). The current
`portfolio_core.py` has `SignalConstruction`/target-weight primitives but no
`DecisionPlan`, no `OrderIntent`, no order-state machine, and no
`tradingAuthority: none` evidence contract. This plan turns that design
section into code before any kernel or integration work begins, so every
downstream plan implements against one frozen vocabulary instead of inventing
its own shapes.

## Scope

### In scope

- `DecisionPlan` dataclass/schema: decision timestamp, FactorState reference,
  Portfolio Mandate reference, pre-decision portfolio snapshot, complete
  `TargetPortfolio`, one or more `OrderIntent` objects, protection/expiry
  rules, plan horizon, next-review timestamp, assumptions, unresolved
  ambiguities, `tradingAuthority: "none"` (literal, non-overridable).
- `OrderIntent` schema: side, type (market/limit/stop/stop-limit), requested
  weight/notional, resulting target weight, limit/stop trigger, activation
  time, time-in-force, expiry, parent id, OCO group, reduce-only flag,
  optional TP/SL child specs.
- Order lifecycle state enum: `planned -> working -> triggered -> filled`,
  with `expired`/`cancelled`/`rejected` terminal branches.
- Evidence-layer types for reconciling target, order, fill, protected
  quantity, actual weight, return, cost, and exit reason (structure only;
  no producer yet).
- Schema-level validation: `tradingAuthority` cannot be anything but `"none"`
  in this repository; TP/SL child weight cannot exceed parent fill.
- Unit tests asserting the schema's own invariants (construction, rejection
  of illegal states, JSON round-trip if the repo's other evidence types are
  JSON-serialized).

### Out of scope

- The bar-by-bar matching/execution kernel ([[plans/order-native-bar-execution-kernel]]).
- Wiring into `simulate_targets` or any existing Portfolio/RL lane.
- Studio, CLI, Report, or Dossier surfaces.
- Any OpenAlice/UTA network or format compatibility beyond vocabulary naming.

## Acceptance

- [ ] `DecisionPlan`, `OrderIntent`, and the order-lifecycle state enum exist
      as typed, importable definitions matching every field named in
      `docs/design/order-native-portfolio-decisions.md` under FactorState
      passthrough, TargetPortfolio, DecisionPlan, and OrderIntent.
- [ ] `tradingAuthority` is structurally always `"none"` in this repository;
      no code path can construct a `DecisionPlan` claiming otherwise.
- [ ] TP/SL child sizing is validated against parent filled quantity, not
      requested quantity, at the schema level.
- [ ] Unit tests cover construction, illegal-state rejection, and
      serialization round-trip; `uv run pytest` passes for the new module.
- [ ] No existing test, Judge, or Studio/CLI surface is touched or broken.

## Work

- [ ] Add the schema module (exact location: sibling to
      `autoquant/project_templates/ohlcv_portfolio_lab/portfolio_core.py`,
      final placement decided when this plan starts based on which Judges
      need to import it).
- [ ] Implement `DecisionPlan`, `OrderIntent`, lifecycle enum, and evidence
      types with construction-time validation.
- [ ] Add focused unit tests for every acceptance item.
- [ ] Run full existing regression to confirm zero blast radius
      (`uv run pytest`, `uv run python scripts/check_doc_links.py`).
- [ ] Update this plan's Verification section with the exact commands run.

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 3 so schema definition can be implemented and verified independently
  of the kernel and both integration lanes.

## Verification

- Pending.

## Progress log

- 2026-08-19 — Plan created.

## Completion

Pending.
