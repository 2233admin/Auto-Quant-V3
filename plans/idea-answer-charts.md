# Idea answer charts

- Status: `active`
- Updated: `2026-11-01`
- Related design: [[docs/design/idea-verdict-card]]

## Outcome

Show the bounded idea verdict, existing Factor chart and validation metrics
together on desktop, including 1083px, without horizontal scrolling.

## Scope

Reuse FactorHero, MetricGrid and the shared test gate. Preserve all immutable
Runs, verdict semantics, trial confirmation and holdout boundaries. No kit
motion edits, token changes, commits or pushes.

## Acceptance

- [x] Verdict, chart and validation/long-short metrics visible on the first screen.
- [x] Failed and untested ideas contain no chart; temporal Runs use Rank IC.
- [x] No test numbers or chart points before an allowed published audit.
- [x] Ideas table fits at 1083px; question remains accessible through a tooltip.
- [ ] Targeted tests, typecheck, build, documentation links and Edge captures.

## Work

- [x] Inspect existing components, shared gate and layout.
- [x] Implement answer composition and responsive desktop layout.
- [x] Verify and record screenshots and limitations for supervisor review.

## Findings and decisions

- Reuse the existing Factor evidence projection; add no scientific decisions.
- GitHub issue #1 in Auto-Quant-V3 owns the prior idea flow. CLI issue search
  returns HTTP 401. Connected GitHub search deduplicated the issue; the comment
  write was rejected because it requires approval and policy is `never`.
- Copied Sessions report `session.harness-stale` (installed Harness differs
  from baseline). No editable follow-up is offered for that retained authority;
  no immutable authority was changed to make a button appear.
- Restarted Studio retains the failed job receipt, but not its process error
  output. The card explicitly discloses this instead of inventing the exception.

## Verification

- `node studio-app/tests/run-idea-answer.cjs`: 8 tests passed. Covers verdict
  binding, validation-only tiles, both gate prerequisites, allowed audits,
  group/table/Rank IC filtering, fallback, chart-free states and primary actions.
- `npx tsc -b --noEmit` in studio-app: passed.
- `npm run build`: blocked by EPERM writing Vite temporary configuration through
  the external node_modules junction. `npm run build -- --configLoader runner`
  passed without changing package.json scripts; retained bundle warning >500kB.
- `uv run python -m unittest tests.test_studio_actions tests.test_factor_explorer`
  ran once at closeout: 54 tests in 157.952s, 53 passed, 1 failed. Existing
  `test_real_cancel_kills_the_whole_process_tree` fails its initial
  `alive(grandchild)` assertion before cancellation on this sandbox, matching
  the prior idea-flow receipt. No test was skipped or weakened.
- `uv run python scripts/check_doc_links.py`: 1814 links resolved.
- Edge/Playwright: all six requested screenshots at 1440x900 and 1083x900,
  saved in `D:/tmp/idea-chart/` with narrow `-1083` suffixes. Browser errors: zero.
  All 12 tiles fit at 1083: momentum bottom 870px, reversal bottom 871px,
  answer pane bottom 875px. Independent right scrolling was verified.
- Home document/table widths equal their scroll widths at both sizes. Long
  questions have ellipsis and full-text title; narrow Next step is omitted.
- Gate experiment intercepts only the browser Run response, removes testAudit,
  and injects unique test-only values. Full body.textContent, closed data tables,
  keyboard hover and Rank IC toggle expose none. Exact counts are in NOTES.txt.
- Original and copied immutable Run files: 40 files compared byte-for-byte,
  zero changed or missing. No research execution, holdout opening or Run deletion.

## Handoff

Implementation and captures are ready for supervisor review, not accepted.
The standard build environment limitation and existing process-tree test failure
remain explicit. No commit or push was made. Temporal fallback and optional
follow-up composition have unit coverage; no new temporal Run or editable trial
was created solely for screenshots. The old composite source has its original
dimensions, so it is not a matched-viewport baseline.

Supervisor tracker follow-up: append this receipt to
https://github.com/2233admin/Auto-Quant-V3/issues/1. No tracker write or closure
is claimed. Do not create a duplicate issue.

## Progress log

- 2026-11-01: Plan registered before implementation.
