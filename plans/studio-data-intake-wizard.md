# Studio data intake wizard and quality report

- Status: `completed`
- Updated: `2026-11-03`
- Issue: https://github.com/2233admin/Auto-Quant-V3/issues/5
- Related design: [[docs/design/studio-local-actions]], [[docs/design/studio-localization]]

## Outcome

Inspect staged CSV or dataset packages without network access, review deterministic
quality diagnostics, and bind explicitly declared data through existing strict intake.

## Scope and boundaries

New quality and staging modules; narrow CLI, action, route and entry hooks. Preserve
strict intake authority, raw source bytes and existing pages. Do not grow intake.py,
edit PLANS.md (owned by another branch), push, or open a PR.

## Acceptance and work

- [x] Deterministic per-asset diagnostics, calendar authority and bounded examples.
- [x] CLI envelope and action confinement, stale preview, confirmation and audit.
- [x] Four-step bilingual wizard with empty/loading/error/read-only states.
- [x] Synthetic tests, intake and Studio regressions, frontend and docs gates.
- [x] Real clean/bad staged browser journeys and Chinese/English screenshots.

## Findings and decisions

- Existing project.intake supports pristine Factor Projects and V1 packages.
- Unknown calendar/listing coverage remains unknown; quality is not research evidence.
- Keep the roadmap index untouched as explicitly requested by the owner.

## Verification

149 requested Python regression tests passed (exit 0). Final focused quality
and Studio data tests passed again (32 tests, exit 0), including empty asset
tables and hourly V5 request wording. Frontend tests passed (32, exit 0), as
did TypeScript, production build, zero-string UI inventory and doc links.

The real clean/bad browser journeys and all shared states passed at 1440 x 900
in installed Edge, with twelve Chinese/English screenshots. No Run was created.
Full commands, failed initial attempts, the bounded unrelated Windows research
driver limitation and cleanup are recorded in [[plans/studio-data-intake-qa]].

## Completion

Delivered issue #5 locally with strict Core intake, staged source preservation,
audited confirmation and no push or PR. Raw CSV package construction is V1;
existing package contracts retain their restrictions. PLANS.md remains untouched
under the owner's explicit exception. This is a technical receipt for owner
review, not issue closure or visual acceptance.
