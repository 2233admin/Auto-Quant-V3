# Order-native execution and risk metrics

- Status: `proposed`
- Updated: `2026-08-19`
- Related design: [[docs/design/order-native-portfolio-decisions]].
- Parent plan: [[plans/order-native-portfolio-decisions]] (Work item 8 of 9).
- Depends on: [[plans/order-native-mechanical-portfolio-integration]] and
  [[plans/order-native-governed-rl-integration]] (metrics are computed from
  fill/protection evidence those plans produce).

## Outcome

Every metric category the design doc's "Evidence expected by a working quant
researcher" section requires is computed and available for reporting:
trade/protection metrics, portfolio-risk metrics, and the RL-specific
evidence extensions.

## Context

`portfolio_core.py` already computes prediction/portfolio evidence (IC,
decay, quantile, stability, drawdown, beta, tracking, turnover,
concentration, capacity, selection-risk) and target-weight attribution. The
design doc requires a materially new category the current code has no
equivalent for: trade/protection evidence (fill rate, expiry/cancel rate,
bars-to-fill, unfilled opportunity cost, exit-reason shares, hit rate,
payoff ratio, expectancy, profit factor, holding bars, MFE/MAE,
gap-through-stop count and loss beyond planned stop, same-bar ambiguity rate
and outcome spread, full quantity reconciliation) and extended portfolio-risk
evidence (risk-at-stop by asset/total, maximum simultaneous stop loss,
actual-vs-target tracking error, post-fill gross/net/cash and covariance
repair).

## Scope

### In scope

- Trade and protection metrics exactly as enumerated in the design doc's
  "Trade and protection" subsection.
- Portfolio risk metrics exactly as enumerated in the design doc's
  "Portfolio risk" subsection.
- RL-specific metric extensions from the design doc's "RL" subsection
  (representation value vs. simple factor baselines, decision-policy value
  vs. the same mechanical target/order policy, action stability, target
  churn, order churn, fill behavior, protection outcomes — coordinated with
  [[plans/order-native-governed-rl-integration]] if any evidence field
  ends up owned there instead).
- Reuse of existing metric-function conventions in `portfolio_core.py`
  (`position_episode_metrics`, `execution_risk_metrics`,
  `liquidity_capacity_metrics`, `signal_policy_metrics`,
  `attribution_metrics`, `performance_metrics`, `implementation_metrics`)
  rather than inventing a parallel metrics module.

### Out of scope

- Prediction/portfolio evidence that already exists and is unaffected by
  order-native execution.
- Studio/CLI/Report rendering of these metrics
  ([[plans/order-native-studio-cli-parity-regression]]).
- Caller-context intake and delivery-contract shape
  ([[plans/order-native-decision-support-surfaces]]).

## Acceptance

- [ ] Every metric named in the design doc's "Trade and protection" and
      "Portfolio risk" subsections is computed and covered by tests.
- [ ] RL evidence extensions are computed and reconciled with
      [[plans/order-native-governed-rl-integration]]'s baseline evidence.
- [ ] No RL value claim is possible without evidence covering cost,
      execution, risk, and validation breadth (structural enforcement, not
      only documentation).
- [ ] `uv run pytest` passes for new and existing coverage.

## Work

- [ ] Enumerate every metric field against the design doc and confirm none
      already exist under a different name in `portfolio_core.py`.
- [ ] Implement trade/protection metric functions from fill/lifecycle
      evidence.
- [ ] Implement extended portfolio-risk metric functions from fill-based
      exposure.
- [ ] Implement or extend RL evidence fields in coordination with
      [[plans/order-native-governed-rl-integration]].
- [ ] Add focused tests per metric category.
- [ ] Run full existing regression and record exact commands/results.

## Findings and decisions

- 2026-08-19 — Split out of [[plans/order-native-portfolio-decisions]] Work
  item 8.

## Verification

- Pending.

## Progress log

- 2026-08-19 — Plan created.

## Completion

Pending.
