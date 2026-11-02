# Studio confirmed design foundation

- Status: `active`
- Updated: `2026-11-01`
- Related design: [[docs/design/studio-design/DESIGN]], [[docs/design/studio-workbench-kit]], [[docs/design/studio-information-architecture]].

## Outcome

Apply the owner's confirmed hierarchy, shape, sign convention, figure anatomy,
state catalogue and dense data patterns to every Studio page template, retaining
the existing evidence authority and measured shell geometry.

## Context

Supervised worktree at 6d7b6c5. No commit or push. The supervising engineer owns
visual acceptance and integration. The explicit task confirms the foundation;
older draft labels and rejected colour guidance are not current authority.

## Scope

### In scope

- Shared presentation components, page composition, documentation and automated browser checks.
- Native Edge motion investigation without reduced-motion emulation.

### Out of scope

- Core scientific authority, research execution, new motion or the interim motion rewrite.
- Changes to source Workspace evidence or the protected experiment Workspace.

## Acceptance

- [x] All nine requested page cases measured at 1440 and 1083 pixels.
- [x] Type scale, radii, sign containment, shadows/gradients and primary counts checked automatically.
- [x] Gated figure captions, comparisons and viewer sign preference tested.
- [x] Before/after, blurred, state and sign screenshots retained for review.
- [x] Required TypeScript, frontend, backend and documentation checks recorded.

## Work

- [x] Read foundation and component contracts before implementation.
- [x] Capture baseline and open every component preview in Edge.
- [x] Extend kit and integrate page templates.
- [x] Record motion investigation and final automated evidence.
- [x] Update documentation and hand off uncommitted changes.

## Findings and decisions

- 2026-11-01: The source catalogue says hidden until frozen; actual visibility
  still requires an existing audit and the visible-diagnostic role. Preserve both guards.
- 2026-11-01: GitHub CLI deduplication returned HTTP 401; retry through available
  connected tools found the existing Studio tracking issue, Auto-Quant-V3 #1.
- 2026-11-01: Native Edge reports reduced motion false. Existing animations run;
  the selected-tab background masked the moving indicator. Corrected the caller
  styles without changing the motion implementation. Older local screenshot
  scripts explicitly emulated reduced motion; the owner's exact browser state
  cannot be reconstructed from that observation.
- 2026-11-01: DESIGN provides no quantitative blur threshold. Retain measurements
  and nine diagnostic flags for supervised review rather than claim visual acceptance.

## Verification

Evidence lives under `D:/tmp/idea-design/`:

- `check.py`, `check-report.md`, `check-report.json`: 18 page/viewport cases,
  zero type, radius, sign-containment, effect or primary-count violations.
  Nine blur diagnostics remain (both widths of Supported, Inconclusive,
  Portfolio and Run, plus Could not be tested at 1083). The luminance and region
  thresholds are explicitly documented, not an owner-approved acceptance rule.
- Before/after composites, native and Gaussian-radius-10 screenshots, both
  sign conventions, figures, state catalogue and read-only sample captures.
  The initially incorrect Run baseline route was corrected using the untouched
  6d7b6c5 bundled assets against the same read-only API.
- TypeScript build check passes; frontend tests pass 26/26. Five browser
  interaction checks pass, including denied storage and reading progress.
- The required backend command ran once: 57/58 pass. The process-tree test
  fails before cancellation at its initial child-alive assertion; its Windows
  `tasklist` probe independently returns `ERROR: Access denied`. No backend
  code or test was changed to hide that environment limitation.
- Native motion: tabs/collapse 260ms, chart disclosure 220ms, number interpolation
  about 520ms, copy opacity/transform 180/220ms, theme 300ms. Explicit reduced
  mode stops tab/collapse motion and sets final numbers immediately.
- Normal Vite build hit the junction-related EPERM. The successful build used
  `--configLoader runner`; package scripts are unchanged.

Documentation-link verification: all 1,834 double-links resolve. `git diff
--check` passes. No commit or push was made.

Tracker handoff: the connected GitHub tool found existing issue
https://github.com/2233admin/Auto-Quant-V3/issues/1, but its comment write was
rejected because it requires approval under the current `never` policy.
The CLI independently returns HTTP 401. No tracker write succeeded; the
supervising engineer must carry this local receipt into that existing issue.

## Progress log

- 2026-11-01: Plan registered before changes. Scratch desk copies ws-lib;
  source evidence remains unchanged.

## Completion

Pending supervised acceptance.
