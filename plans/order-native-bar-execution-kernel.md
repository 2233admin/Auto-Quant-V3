# Order-native bar execution kernel

- Status: `proposed`
- Updated: `2026-08-19`
- Related design: [[docs/design/order-native-portfolio-decisions]].
- Parent plan: [[plans/order-native-portfolio-decisions]] (Work item 4 of 9).
- Depends on: [[plans/order-native-decision-plan-schema]].

## Outcome

A standalone, deterministic bar-by-bar order-execution kernel exists with its
own fixture-driven test suite. It consumes `OrderIntent`/`DecisionPlan`
objects and complete OHLCV bars and produces fill/lifecycle evidence. It is
not yet called from any Portfolio or RL lane.

## Context

The current `simulate_targets` in `portfolio_core.py` treats every target
weight delta as a complete close execution with no pending-order, entry
price, fill, expiry, OCO, or protective-order state
(`docs/design/order-native-portfolio-decisions.md` "Fixed bar execution" and
"Bracket TPSL" sections, and the parent plan's 2026-07-27 finding: "must be
replaced rather than wrapped as if it were equivalent"). This plan builds
that replacement kernel in isolation so its fill/gap/ambiguity logic can be
tested against fixtures before it touches any live decision lane.

## Scope

### In scope

- Deterministic fill rules for market, limit, stop, and stop-limit orders
  against one OHLCV bar, including gap-through behavior for both stops and
  limits (buy/sell symmetric), per the design doc's exact fill rules.
- Bracket TP/SL: children sized from parent's actual filled quantity, TP as
  reduce-only limit, SL as reduce-only stop/stop-limit, OCO cancellation on
  either fill, partial-fill-protects-only-filled-portion, gap-through-stop
  fills at first eligible open.
- Explicit, conservative resolution of same-bar ambiguity (both TP/SL
  reachable, intrabar parent entry plus child reachable, stop-limit
  trigger/fill path unknown, competing working orders on one reducible
  position) — conservative path is authoritative for promotion; an
  optimistic diagnostic bound and ambiguity rate are also recorded, never
  selected.
- Time-in-force and expiry handling (the intents this kernel supports per
  the design doc's "first kernel" boundary: no trailing/MOC/OPG/FOK/routing
  yet).
- Fixture-driven long and short test coverage for every lifecycle transition
  and every ambiguity case named above.

### Out of scope

- Trailing stops, MOC, OPG, FOK, or venue-specific order types (explicitly
  deferred by the design doc's "first kernel" boundary).
- L2 replay, queue position, latency modeling, smart routing, HFT semantics.
- Any Portfolio or RL integration ([[plans/order-native-mechanical-portfolio-integration]],
  [[plans/order-native-governed-rl-integration]]).
- Authenticated account/broker state, staging, approval, or fill
  confirmation of any kind.

## Acceptance

- [ ] Kernel resolves every fill rule stated in the design doc's "Fixed bar
      execution" section for market/limit/stop/stop-limit, long and short.
- [ ] Bracket TP/SL lifecycle is deterministic, causal (no lookahead), and
      OCO-safe under partial fills, per "Bracket TPSL".
- [ ] Same-bar ambiguity is never resolved in the candidate's favor; every
      ambiguous case records a conservative outcome plus an optimistic bound
      and contributes to a reported ambiguity rate.
- [ ] Kernel has zero dependency on `portfolio_core.py`'s existing
      `simulate_targets` path or any RL module — it is callable standalone
      against fixtures.
- [ ] Fixture tests cover every lifecycle transition and every named
      ambiguity case for both long and short positions; `uv run pytest`
      passes.

## Work

- [ ] Design the kernel's public call shape (inputs: bars + working orders;
      outputs: fills + lifecycle transitions + ambiguity evidence) against
      the schema from [[plans/order-native-decision-plan-schema]].
- [ ] Implement market/limit/stop/stop-limit fill resolution with gap
      handling.
- [ ] Implement bracket TP/SL, OCO, partial-fill protection, and expiry.
- [ ] Implement conservative same-bar ambiguity resolution plus the
      optimistic diagnostic bound and ambiguity-rate accounting.
- [ ] Build fixtures covering every transition/ambiguity case, long and
      short.
- [ ] Run full existing regression to confirm zero blast radius.

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 4 so the kernel can be built and fixture-tested before either
  decision lane depends on it.

## Verification

- Pending.

## Progress log

- 2026-08-19 — Plan created.

## Completion

Pending.
