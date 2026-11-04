# Tiered test feedback

- Status: `proposed`
- Target release: `0.9.35`
- Updated: `2026-08-22`
- Related design: [[docs/design/documentation-system]] and
  [[docs/design/versioning-and-release]].

## Outcome

Give Workbench developers and unfamiliar coding Agents a sub-minute first
feedback loop without weakening the complete scientific, tamper-resistance,
build, or release audit.

## Context

The current `unittest discover` entry contains pure unit checks, Workspace and
Judge integrations, repeated pandas research calculations, external processes,
build/install provenance, and release closure in one serial suite. The
`0.9.32` audit ran 460 tests in 1,161.458 seconds even though the changed
Studio launch contract itself verified in seconds. Strong evidence boundaries
remain necessary because caller-selected models and Agents cannot be trusted
to preserve evaluation authority accidentally; scheduling all boundaries in
every inner loop is not necessary.

## Scope

### In scope

- Inventory test-module duration and isolation requirements.
- Define explicit `fast`, `integration`, and `release` membership with an
  executable completeness check so no new test silently escapes every tier.
- Keep causality, selection-integrity, immutable-evidence, and semantic-tamper
  protection in the appropriate mandatory tier.
- Route ordinary AGENTS development checks to fast plus affected integration
  tests while retaining a complete release gate.
- Add safe module-level concurrency or caching only after measured isolation.

### Out of scope

- Removing scientific contracts, trusting hashes without semantic replay,
  weakening release criteria, or changing quantitative behavior.

## Acceptance

- [ ] One documented command provides useful first feedback in under 60
  seconds on the reference development machine.
- [ ] Every test module has explicit tier ownership and an unclassified module
  fails deterministically.
- [ ] Integration and release commands preserve all current tests and expose
  per-module timing evidence.
- [ ] The complete release audit remains mandatory and passes before tagging.

## Work

- [ ] Measure the current suite and classify cost/isolation rather than
  guessing from filenames.
- [ ] Implement tier manifests/runners and completeness tests.
- [ ] Update AGENTS, contributor, and release guidance.
- [ ] Verify timing targets and full-suite parity.

## Findings and decisions

- 2026-08-21 — Test strength and feedback latency are separate concerns. The
  goal is staged execution of the same protection, not a smaller trust model.
- 2026-08-22 — The unstarted plan moved from `0.9.33` to `0.9.34` so the
  externally required generic Harness Web Surface compatibility correction can
  own `0.9.33` without combining release-contract and test-runner changes.
- 2026-08-22 — The plan moved again to `0.9.35` after real OpenAlice acceptance
  found that the `0.9.33` manifest command was not executable from an ordinarily
  prepared source Workspace. The `0.9.34` fix remains isolated from test-runner
  work.

## Verification

- Pending.

## Progress log

- 2026-08-21 — Proposed during the `0.9.32` release audit after the unchanged
  complete suite required about nineteen minutes for a narrow Studio launch
  integration.

## Completion

Pending.
