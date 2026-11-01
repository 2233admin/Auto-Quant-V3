# Idea-first Factor Studio

- Status: `active`
- Updated: `2026-11-01`
- Related design: [[docs/design/idea-verdict-card]], [[docs/design/studio-local-actions]], [[docs/design/hypothesis-and-idea-verdict]]

## Outcome

An empty Workspace can create one idea, bind staged data, edit its first
Factor candidate, confirm a counted trial and read a bounded conclusion in Studio.

## Context

New idea is currently a disabled dialog and the editor requires existing Run
evidence. This circular dependency prevents the first user journey.

## Scope

Factor only. Reuse the workbench kit and local command runner. Preserve Judge,
Run, Report and Dossier contracts. No token, font or colour changes.

## Acceptance

- [x] Create an idea from blank Ideas with a real project.create command.
- [x] Only use confined staged packages; disclose absent data and staging instructions.
- [x] Show the original hypothesis before source and preserve its hash in the audit.
- [x] Save, check, confirm trial and execute through existing Core commands.
- [x] Distinguish inconclusive evidence from execution/protocol failure without inventing a Judge verdict.
- [x] Capture the real path at 1440x900 and 1083x900, including genuine inconclusive and failed execution.
- [ ] Targeted Python tests, frontend build and documentation link check pass.

## Work

- [x] Backend creation, staged intake and first candidate bridge.
- [x] Idea entry, Factor workbench and evidence-bound conclusion card.
- [x] Documentation and security/regression tests.
- [ ] Browser journey and completion audit.

## Findings and decisions

- 2026-11-01: Qualification failure is not falsification. The existing Judge
  cannot refute arbitrary prose. Formal H1-H17 Hypotheses and sealed-tail
  confirmation remain outside this slice.
- The current Session adjustment belongs to its leader. The new card reads
  Core's adjustment for the exact displayed Run instead; an older leader must
  not lend its support to a different candidate.
- The staged-data form is intentionally V1 daily only, with explicit prediction
  assets and horizon. Full package validation remains in CLI intake.
- Read-only evidence pages remain accessible from the card. Optional subsequent
  trials require explicitly reopening the editor; no terminal result forces tuning.

## Verification

- `npm run build` in studio-app: TypeScript and production bundle succeeded;
  bundle is rebuilt under autoquant/studio_app. Vite uses its runner config
  loader because this checkout's node_modules is a junction to another checkout.
- `uv run python scripts/check_doc_links.py`: 1812 double-links resolved.
- Six new action tests passed independently. They cover create argv/security,
  parameter validation, staged package discovery, asset escape, stale data
  previews, initial candidate compare-and-swap/freeze, and question audit hashes.
- Final combined targeted run is recorded in `D:/tmp/idea-flow/targeted-tests.txt`.
  Final result: 54 tests in 140.947 seconds, 53 passing and one environment failure.
  The existing real-process cancellation test cannot observe its grandchild:
  this host's sandbox denies tasklist, so it fails before the cancellation
  assertion. It is not skipped or weakened in this branch.
- Edge through existing Playwright 1.63.0: screenshots 01–09 at 1440x900 and
  under `D:/tmp/idea-flow/1083/` at 1083x900. Extra 10–11 prove the real
  save/check/evaluate follow-up and two retained immutable Runs.
- The clean narrow run took 10.371 seconds and 15 interactions, excluding
  explicit synthetic-data staging. The initial wide journey took 309.462 seconds
  and 33 interactions including debugging interruptions; timing.txt discloses
  that it is not a clean performance benchmark. No Run or trial was deleted.
- The failed candidate referenced a missing panel field and failed Core preflight
  without a Run. The inconclusive candidate was a five-bar reversal on the same
  declared synthetic fixture, with a real successful Run and non-positive IC.

## Progress log

- 2026-11-01: Read independent review, current action contracts and proposed Hypothesis design.
- 2026-11-01: Implemented the vertical slice and recorded both desktop journeys
  plus real failure/inconclusive states. Visual acceptance remains the supervisor's.

## Completion

Pending supervisor visual acceptance. No commit or push is authorized.

Execution tracking belongs to existing GitHub issue
https://github.com/2233admin/Auto-Quant-V3/issues/1 (deduplicated through the
connected GitHub search). CLI authentication returned HTTP 401; the connected
comment write was then rejected because it requires approval and this session's
approval policy is never. The attempted handoff explicitly left acceptance
with the supervisor and asked for the process-tree test outside this sandbox.
No tracker write or issue closure is claimed. Supervisor follow-up is required
to append this receipt; do not create a duplicate issue.
