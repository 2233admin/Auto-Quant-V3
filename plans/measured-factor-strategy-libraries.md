# Measured Factor and Strategy libraries

- Status: `active`
- Updated: `2026-11-01`
- Related design: [[docs/design/studio-information-architecture]], [[docs/design/idea-verdict-card]], [[docs/design/studio-workbench-kit]].

## Outcome

Make Factors the landing library, reproduce the supplied library geometry, and restore a usable persistent factor editor. The supervising engineer owns visual acceptance and integration; this worktree is not committed or pushed.

## Scope

Library summary projections, compact cards, navigation, frozen question and complete parameters, candidate tabs, pinned trial note, and an explicit stale-session recovery action. No new research method, strategy construction action, or trading authority.

## Acceptance

- [x] Library geometry measured against both original PNGs, with viewport percentage differences and exceptions recorded.
- [x] Factors and Strategies use compact summary data and never request diagnostics per card; hidden test points are excluded.
- [x] Editor exposes full locked values, source, trial notes, and actionable read-only reasons.
- [x] Required checks and real Edge screenshots retained under `D:/tmp/idea-lib`.
- [ ] Supervisor reviews screenshots and measurements.

## Work

- [x] Read source designs and previous measured handoff.
- [x] Measure reference and implement library projections and composition.
- [x] Implement editor recovery and layout.
- [x] Update contracts and run required verification; supervisor owns acceptance and the two failing Python checks.

## Findings and decisions

- The reference uses a 240px sidebar, 56px title, 32px toolbar, 8px card gap, and three 387px columns at 1440px. Factor and Strategy cards have different heights.
- The existing expression helper compiles into candidate Python, so both source modes remain visible as tabs.
- Existing session.start blocks every active Session, including stale ones. Recovery must preserve the old Session and its Runs and permit a fresh Session only when existing authority is stale.

## Verification

Evidence directory: `D:/tmp/idea-lib`; complete handoff in `NOTES.txt`.

- TypeScript: `npx tsc -b --noEmit` passes. Frontend tests: 19/19.
- Standard build encounters EPERM in the existing node_modules junction; `npx vite build --configLoader runner` passes with unchanged package scripts.
- Requested Python suite invoked once: 58 tests, 56 pass, one failure in the existing tasklist-based process liveness assertion and one WinError 10053 HTTP connection-abort error. No passing result is claimed for either; supervisor rerun remains required.
- Documentation: 1824 links resolve; `git diff --check` passes.
- Real Edge at 1440x900: sidebar/title/toolbar/card/curve/footer max error 0.06 viewport percentage points; three columns, 8px gap. Filter/search geometry exceptions are recorded explicitly.
- Real UI proves stale restart through counted confirmation, full parameters, both Ctrl+Enter locations, cancellation/reconfirmation, retained new Run, first-attempt note hiding, all five filters, expression search, Strategy sorting/copy, and read-only canonical source.
- Both scratch UI passes preserve all pre-existing Run files. The final pass preserved 524 files and ended with 564; the original 484 files remain unchanged. No Run was deleted.
- GitHub issue #1 already owns this increment. CLI authentication returned 401; the connector read succeeded but the comment required approval under policy never. The unposted receipt is retained with the handoff.

The plan stays active until the supervising engineer accepts screenshots and measurements and resolves the two Python verification limits. Nothing is committed or pushed.
