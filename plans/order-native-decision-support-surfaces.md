# Order-native decision-support surfaces

- Status: `proposed`
- Updated: `2026-08-19`
- Related design: [[docs/design/order-native-portfolio-decisions]] and
  [[docs/design/program-research-dossiers]].
- Parent plan: [[plans/order-native-portfolio-decisions]] (Work item 7 of 9).
- Depends on: [[plans/order-native-mechanical-portfolio-integration]] and
  [[plans/order-native-governed-rl-integration]].

## Outcome

A caller can optionally supply portfolio context (as-of timestamp, reference
currency, current position weights/cash, pending-order summary, risk budget,
decision cadence, optional venue/order capabilities) and receive a durable
DecisionPlan/Report/Dossier delivery that carries evidence-backed target
portfolio, exact sizing explanation, conditional order template, and
expected loss-at-stop — all explicitly `tradingAuthority: none`.

## Context

The design doc's "Caller context and delivery" section defines both the
optional caller-supplied context shape and the required delivery shape. This
is new decision-support surface, distinct from the execution/trade/risk
*metrics* plan — this plan is about what a caller can supply and what a
delivered artifact must contain, not about which numbers get computed.

## Scope

### In scope

- Optional caller-portfolio-context intake: as-of timestamp, reference
  currency, current position weights/cash, pending-order summary, risk
  budget, decision cadence, optional venue/order capabilities, requested
  deliverables, decision deadline. Content-locked and caller-supplied, never
  authenticated by AutoQuant.
- Durable delivery contract for DecisionPlan/Report/Dossier: evidence-backed
  target portfolio, exact sizing explanation and binding constraints,
  conditional order template and TPSL/invalidation tree, expected
  loss-at-stop and portfolio impact, conditions requiring a fresh
  quote/UTA snapshot/human review, `tradingAuthority: none`.
- OpenAlice UTA vocabulary compatibility for the delivered order template
  (MKT/LMT/STP/STP LMT plus DAY/GTC/IOC/FOK/OPG/GTD, attached TP/SL),
  including the "loudly refuse unsupported mappings rather than silently
  drop protection" principle.

### Out of scope

- Any authenticated account state, staging, approval, submission, or fill
  confirmation — remains OpenAlice/UTA authority.
- New execution/trade/risk metric computation
  ([[plans/order-native-execution-risk-metrics]]).
- Studio/CLI rendering of these surfaces
  ([[plans/order-native-studio-cli-parity-regression]] owns UI parity).

## Acceptance

- [ ] Caller-supplied portfolio context is accepted, content-locked, and
      never treated as authenticated.
- [ ] Every delivered DecisionPlan/Report/Dossier includes the full delivery
      contract named above, with `tradingAuthority: none` always present.
- [ ] The delivered order template uses OpenAlice UTA-compatible vocabulary
      and explicitly refuses (rather than silently drops) unsupported
      bracket/venue mappings.
- [ ] `uv run pytest` passes for new and existing coverage.

## Work

- [ ] Define the caller-context intake shape and validation.
- [ ] Implement the delivery contract on top of the schema from
      [[plans/order-native-decision-plan-schema]] and the fills from
      [[plans/order-native-mechanical-portfolio-integration]] /
      [[plans/order-native-governed-rl-integration]].
- [ ] Implement the explicit-refusal path for unsupported bracket/venue
      mappings.
- [ ] Add coverage for context intake, delivery contract completeness, and
      the refusal path.
- [ ] Run full existing regression and record exact commands/results.

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 7.

## Verification

- Pending.

## Progress log

- 2026-08-19 — Plan created.

## Completion

Pending.
