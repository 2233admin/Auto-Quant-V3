# Panda-style intake into a frozen Shinka experiment plan

- Status: `active`
- Updated: `2026-11-23`
- Related design: [[docs/design/pandaai-mechanisms]] (section 6.1),
  [[docs/shinka-research/design]], [[docs/shinka-research/PORT]]

## Outcome

A person with half an idea picks a template or writes a rough sentence. The
person answers only the questions that change what the test means, and gets a
quant hypothesis plus a scaffolded experiment whose `ExperimentPlan` is
frozen before the first trial: rule, thresholds, checker, data, task message
and the intake spec itself.

## Context

PandaAI's strength is the front of the funnel. Templates and a six-element
checklist (market, symbol, signal, position sizing, risk control, backtest
spec) turn a vague sentence into something runnable in one turn. Its output is
not frozen and has no refutation criterion. V3's Shinka layer has the back of
the funnel: `ExperimentPlan` freezes the rule and hashes, `scaffold.verify`
rejects drift, and the verdict reads only the frozen rule.

Finding, 2026-11-23: no production code writes `ExperimentPlan`. Only
`tests/shinka_research/test_plan_rules.py` and the upstream demo builder do.
Every real experiment is therefore "unfrozen (legacy)" and takes thresholds
from the command line, which is the criteria-shopping hole the plan exists to
close. This intake is the first writer.

The owner chose this target over the unbuilt V3 Hypothesis object (H1/H2 in
[[docs/design/hypothesis-and-idea-verdict]]) on 2026-11-23.

## Scope

### In scope

- `autoquant/shinka_research/intake.py`: strict `IntakeSpec` (six elements,
  plus two Panda omits: the refutation criterion and an explicit cost
  assumption, plus the rule and its thresholds); a closed template set for
  the quant domain; merging a template with caller answers; the list of
  open questions.
- `aq shinka intake templates|questions|apply` (`apply` is owner-gated like
  `grant`).
- `apply` adds the hypothesis, prepares data, scaffolds the experiment with a
  `QuantConfig` from the backtest element, writes the template's seed program,
  writes `hypotheses/<hid>.intake.json`, and freezes the `ExperimentPlan` with
  that spec file in its checker set.
- Tests and docs (`docs/shinka-research/`, `docs/CLI` if it lists `aq shinka`,
  `docs/CHANGELOG`).

### Out of scope

- Studio intake page (next slice, after the CLI contract settles).
- The V3 Hypothesis object, routing table and `untestable` reason codes.
- Non-quant domains (`open`) and LLM-driven translation of prose into code.
- Any change to rule semantics, the evaluator, or existing notebooks.

## Acceptance

- [ ] `aq shinka intake templates --json` lists at least five quant templates
      keyed by market and scenario, each with a seed program the frozen
      evaluator accepts as correct on a fixture.
- [ ] `aq shinka intake questions` returns only unanswered meaning-changing
      questions (symbol, market, signal when the template leaves it open,
      refutation criterion, cost), each with its default, and `ready: true`
      once nothing is open; defaulted fields are listed as defaulted.
- [ ] `apply` refuses an incomplete spec, a missing refutation criterion, an
      unknown rule or wrong thresholds, and agent-env callers; on success the
      experiment has a non-null `plan` and `aq shinka skeptic`/`verdict` judge
      it from the plan, not the command line.
- [ ] Editing `hypotheses/<hid>.intake.json`, `task/evaluate.py`,
      `data/dev.csv` or the task message after `apply` makes the next
      evaluation refuse ("changed since the plan was frozen").
- [ ] A failure in the middle of `apply` leaves no half-written hypothesis or
      experiment.
- [ ] New tests pass; `tests/shinka_research` and `tests/test_documentation.py`
      stay green; the known-failure baseline gains no entry.

## Work

- [ ] `IntakeSpec`, templates, merge and questions, with unit tests.
- [ ] `freeze_plan` beside `scaffold_experiment`; `apply` end to end under
      the direction lock, with rollback.
- [ ] CLI wiring, `--json` output, owner gate.
- [ ] Docs and changelog.
- [ ] Completion audit.

## Findings and decisions

- 2026-11-23 — Target is the Shinka `ExperimentPlan`, not the V3 Hypothesis
  design (owner choice).
- 2026-11-23 — The intake spec file joins the plan's checker `FileSet`, so the
  existing `_verify_plan` drift check covers it with no new mechanism.
- 2026-11-23 — `claim` is `empirical` for every quant template; `certificate`
  stays for domains whose checker proves a property.

## Verification

- Pending.

## Progress log

- 2026-11-23 — Plan created after merging PR #26 (PandaAI mechanisms).
