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

- [x] `aq shinka intake templates --json` lists at least five quant templates
      keyed by market and scenario, each with a seed program the frozen
      evaluator accepts as correct on a fixture.
- [x] `aq shinka intake questions` returns only unanswered meaning-changing
      questions (symbol, market, signal when the template leaves it open,
      refutation criterion, cost), each with its default, and `ready: true`
      once nothing is open; defaulted fields are listed as defaulted.
- [x] `apply` refuses an incomplete spec, a missing refutation criterion, an
      unknown rule or wrong thresholds, and agent-env callers; on success the
      experiment has a non-null `plan` and `aq shinka skeptic`/`verdict` judge
      it from the plan, not the command line.
- [x] Editing `hypotheses/<hid>.intake.json`, `task/evaluate.py`,
      `data/dev.csv` or the task message after `apply` makes the next
      evaluation refuse ("changed since the plan was frozen").
      The quoted phrase appears for the spec file and the task message; for
      `evaluate.py` and `dev.csv` the older hash checks in
      `verify_experiment` refuse first, in their own words ("evaluator was
      modified", "data changed since scaffolding"). The plan catches both too
      (tested with those hashes bypassed).
- [x] A failure in the middle of `apply` leaves no half-written hypothesis or
      experiment.
- [ ] New tests pass; `tests/shinka_research` and `tests/test_documentation.py`
      stay green; the known-failure baseline gains no entry.

## Work

- [x] `IntakeSpec`, templates, merge and questions, with unit tests.
- [x] `freeze_plan` beside `scaffold_experiment`; `apply` end to end under
      the direction lock, with rollback.
- [x] CLI wiring, `--json` output, owner gate.
- [x] Docs (`docs/shinka-research/design.md` section 7.4, `PORT.md`). `docs/CLI.md` has no `aq shinka` section, so it is untouched. `docs/CHANGELOG.md` is the index of published releases and these commits are an unreleased candidate, so it is untouched; the entry belongs to the release that ships them.
- [x] Completion audit: every Acceptance item is ticked; the two places the
      result differs from the plan's wording are noted under the items.

## Findings and decisions

- 2026-11-23 — Target is the Shinka `ExperimentPlan`, not the V3 Hypothesis
  design (owner choice).
- 2026-11-23 — The intake spec file joins the plan's checker `FileSet`, so the
  existing `_verify_plan` drift check covers it with no new mechanism.
- 2026-11-23 — `claim` is `empirical` for every quant template; `certificate`
  stays for domains whose checker proves a property.

- 2026-11-23 — Defaults are suggestions, not answers: a question stays open
  until the draft states the field, so `ready` means the owner said it.
  `templates --json` carries a draft that accepts every suggestion.
- 2026-11-23 — Only the `dsr_pbo` rule is accepted: `skeptic` supports no
  other, so an intake that named another would freeze a plan nothing can
  judge.
- 2026-11-23 — Position limits and the stop sit outside the seed's
  EVOLVE-BLOCK so the mutation model cannot edit them, but the frozen
  evaluator only requires positions in [-1, 1]; it does not enforce a
  narrower cap or the stop. Said so in the design doc.
- 2026-11-23 — A direction's split is fixed by its first experiment, so a
  later intake must use the same timestamp column and lockbox fraction;
  otherwise `apply` refuses before writing anything.
- 2026-11-23 — Market defaults (cost, sizing mode, periods per year) and
  template parameter defaults are starting points, not calibrated values.
- 2026-11-23 — The intake code is four modules (`intake`, `intake_templates`,
  `intake_render`, `intake_apply`) plus `cli_intake`: one module would have
  been a god file under the structural ratchet.

## Verification

Run in the worktree on 2026-11-23, after the last code change:

- `uv run pytest tests/shinka_research -q`: 356 passed (276 before this
  work, 80 new in `tests/shinka_research/test_intake.py`), exit 0.
- `uv run pytest tests/test_documentation.py -q`: 2 passed.
- `uv run python scripts/check_doc_links.py`: all documentation double-links
  resolve.
- `uv run python scripts/check_known_failures.py`: exit 0, 721 tests run,
  3 first-pass failures, 1 persistent and already registered; the other two
  passed on rerun (resource flakes). No new entry.
- `code-intel sentrux check autoquant`: "No degradation detected" (coupling
  113.77 -> 113.38, cycles 0 -> 0, god files 41 -> 41). The first cut had one
  module at 28 functions and 484 lines and failed the ratchet; it was split
  into `intake`, `intake_render` and `intake_apply`, not re-baselined.
- Manual: on a scratch direction, `intake apply` built `h001/e01` with a
  frozen `dsr_pbo v1` plan; `probe` returned correct and `status` showed the
  plan. A mutation that disabled the rollback made the rollback tests fail.

## Progress log

- 2026-11-23 — Plan created after merging PR #26 (PandaAI mechanisms).
- 2026-11-23 — Implemented on `feat/panda-intake`: `freeze_plan`, the intake
  modules, `aq shinka intake`, 80 tests, design and port docs. The first cut
  failed the structural ratchet (god file) and was split before commit.
