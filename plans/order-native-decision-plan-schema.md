# Order-native decision-plan schema

- Status: `completed`
- Updated: `2026-08-21`
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

- [x] `DecisionPlan`, `OrderIntent`, and the order-lifecycle state enum exist
      as typed, importable definitions matching every field named in
      `docs/design/order-native-portfolio-decisions.md` under FactorState
      passthrough, TargetPortfolio, DecisionPlan, and OrderIntent.
- [x] `tradingAuthority` is structurally always `"none"` in this repository;
      no code path can construct a `DecisionPlan` claiming otherwise.
- [x] TP/SL child sizing is validated against parent filled quantity, not
      requested quantity, at the schema level.
- [x] Unit tests cover construction, illegal-state rejection, and
      serialization round-trip; `uv run python -m unittest tests.test_decision_plan -v`
      passes for the new module.
- [x] No existing test, Judge, or Studio/CLI surface is touched or broken.

## Work

- [x] Add the schema module (exact location: sibling to
      `autoquant/project_templates/ohlcv_portfolio_lab/portfolio_core.py`,
      final placement decided when this plan starts based on which Judges
      need to import it).
- [x] Implement `DecisionPlan`, `OrderIntent`, lifecycle enum, and evidence
      types with construction-time validation.
- [x] Add focused unit tests for every acceptance item.
- [x] Run full existing regression and documentation-link verification
      (`uv run python -m unittest discover -s tests -v`,
      `uv run python scripts/check_doc_links.py`).
- [x] Update this plan's Verification section with the exact commands run.

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 3 so schema definition can be implemented and verified independently
  of the kernel and both integration lanes.

## Verification

- `uv run python -m unittest tests.test_decision_plan -v` — 6 tests, OK.
- `uv run python -m unittest discover -s tests -v` — 460 tests run; the six
  decision-plan tests passed. The clean-checkout baseline campaign failure
  (`test_json_cli_runs_and_inspects_a_bounded_external_campaign`) occurred,
  along with unrelated environment/baseline failures involving external
  campaign subprocesses, generated-file line endings, harness-bundle state,
  immutable-run fixtures, and a network-blocked build test. No existing test,
  Judge, Studio, or CLI file was changed by this plan.
- `uv run python scripts/check_doc_links.py` — `✓ 1642 documentation double-links
  resolve`.

## Progress log

- 2026-08-19 — Plan created.
- 2026-08-21 — Added the standalone frozen decision-plan/order/evidence schema
  beside `portfolio_core.py`, with construction-time authority, lifecycle, and
  filled-quantity protection invariants.
- 2026-08-21 — Added six focused `unittest` cases and verified the focused
  module. Full discovery completed with unrelated pre-existing/environment
  failures; documentation links all resolve.
- 2026-08-21 — Reviewed the diff and found `decision_plan.py` had redefined
  `PortfolioFailure(ValueError)` instead of importing the existing one from
  `portfolio_core.py`; no circular-import obstruction exists. Removed the
  duplicate and imported the original instead. Re-verified: focused module
  (6 OK) and `check_doc_links.py` (1642 resolved).

## Completion

Shipped `decision_plan.py` with frozen `FactorState`, `TargetPortfolio`,
`OrderIntent`, `DecisionPlan`, `ProtectionSpec`, `ExecutionEvidence`, and the
exact seven-state `OrderLifecycleState`. `tradingAuthority` is an immutable
`"none"` field, and TP/SL sizing is bounded by parent filled quantity.

Implementation commit: `dd095c6`. Final commit (post-review dedup fix):
`e35eb2b`.
