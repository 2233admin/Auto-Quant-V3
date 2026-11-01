# Measured Idea workbench and floating app shell

- Status: `active`
- Updated: `2026-11-01`
- Related design: [[docs/design/idea-verdict-card]], [[docs/design/studio-workbench-kit]]

## Outcome

Reproduce the supplied PandaAI screenshot's layout geometry and editor/result
operating order with AutoQuant content, tokens and evidence semantics.

## Context

The previous result hid the candidate editor and differed in shell, proportions
and result ordering. Pixel measurements, not stylistic resemblance, define this
bounded implementation. The supervisor owns final review; no commit or push.

## Scope

Shared shell, additive kit components, Idea Factor editor/result, regression
tests and design documents. No research authority, backend or token changes.

## Acceptance

- [x] Measure reference and compare twelve DOM regions at 1534x847 and 1440x900.
- [x] Shared floating shell, persistent editor, one primary action, ordered results.
- [x] Preserve frozen question, counted confirmation and gated test evidence.
- [x] Capture requested real Workspace states and 1083px views.
- [x] Run required frontend/backend and documentation checks; record environment failures.

## Work

- [x] Inspect references, existing components and contracts.
- [x] Implement shell and Idea workbench through shared kits.
- [x] Verify geometry, operation and all result states.
- [x] Update contracts and record exact checks and exceptions.
- [ ] Supervisor acceptance, including the standard build and process-tree test in an unrestricted environment.

## Findings and decisions

- 2026-11-01: Reference is 1534x847; 8px canvas margin, 240px rail,
  56px title, 439/815px editor/result cards, 16px column gap. The reference
  metrics card is clipped by its scroll parent; compare its visible bounds.
- 2026-11-01: Eleven regions meet 3 percentage points for every coordinate
  and dimension at both measured viewports. The chips' natural width is the
  sole exception: three available operations versus five in the reference
  (-13.96 percentage points at 1534px). No placeholder actions were added.
- 2026-11-01: Retained Sessions report a stale Harness and remain read-only.
  A new synthetic UI fixture in the copied Workspace proved baseline and
  candidate execution without editing any old Run or Session authority.

## Verification

Artifacts and executable comparison live in `D:/tmp/idea-clone/`.
The served Workspace is a copy at `D:/tmp/aq-idea/ws-clone`.

- `npx tsc -b --noEmit`: passed.
- `npm run build`: EPERM writing through the node_modules junction into
  `.vite-temp`. No package script changes. `npx vite build --configLoader
  runner`: passed, producing the reviewed bundle (175 modules).
- `node studio-app/tests/run-idea-answer.cjs`: 13/13 passed, including gated
  test evidence, result ordering, history isolation and expression round-trip.
- Real Edge smoke: new Project, intake, Save, baseline confirmation, persistent
  editor, Parameters, JSON export, new source check, cancel/retry confirmation,
  second retained Run, history, all six other routes and sidebar collapse.
- `uv run python -m unittest tests.test_studio_actions tests.test_factor_explorer`:
  executed once; 54 tests, 53 passed, one failed at the pre-cancellation
  `alive(grandchild)` assertion in `test_real_cancel_kills_the_whole_process_tree`.
  Its Windows implementation uses `tasklist`; querying even the current shell
  returned `ERROR: Access denied` while `Get-Process` found the same PID.
- `uv run python scripts/check_doc_links.py`: 1817 links resolve.
- `git diff --check`: passed. No commit or push.
- Tracker dedupe found existing `2233admin/Auto-Quant-V3#1`. The comment write
  was blocked by the connector approval policy; CLI returned 401. The unposted
  receipt draft is `D:/tmp/idea-clone/tracker-comment.md`. No duplicate issue.

## Progress log

- 2026-11-01: Plan created before implementation.

## Completion

Implementation and evidence are ready for the supervising engineer. This plan
remains active pending supervisor acceptance of the documented geometry
exception and rerunning the two environment-limited checks. Receipt is not
acceptance. The original Workspace and `D:/tmp/aq-exp/ws4` were not changed.
