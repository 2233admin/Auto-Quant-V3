# Shinka research direction as a V3 Project, drawn natively in Studio

- Status: `active`
- Updated: `2026-11-05`
- Related design: [[docs/design/hypothesis-and-idea-verdict]],
  [[docs/design/studio-information-architecture]],
  [[docs/design/studio-observation-surface]],
  [[docs/design/studio-localization]],
  [[docs/design/structural-rules]].

## Outcome

A Shinka research direction lives inside an AutoQuant Project
(`<project>/research/`), `aq shinka` addresses it by Project, the knowledge
library is Workspace-level, and Studio shows the direction, its hypotheses,
trials against the noise frontier, check ledger, verdict and lockbox state,
and the library natively in Direction H. Shinka's standalone web UI is gone.

## Context

Step 1 (commits `949ba37`, `393f914`, `a5b6315` on `feat/shinka-port`) copied
the fork's research layer verbatim and exposed it as `aq shinka`. The owner
decided on 2026-11-05 that a direction IS a Project and that the fork's UI is
deleted and redrawn in Studio's current design, not copied. This replaces the
"serve the fork's frontend as the primary Studio" outcome of
[[plans/shinka-research-methods-and-frontend-merge]] for the research pages.

## Scope

### In scope

- Storage layout and `dir` resolution (`autoquant/shinka_research/project.py`);
  `init` attaching to or creating a Project.
- Removal of `aq shinka ui`, its server, the analysis adapter, `webui/dist/`
  and `studio-shinka/`.
- Read-only Studio routes for a Project's research and the Workspace library,
  with server-side visibility filtering, ETag and fingerprint cache.
- Studio pages: research library list, Project research page, knowledge
  library, Project page section; synthetic demo fixture.

### Out of scope

- Core Hypothesis objects, Verdict Records and the V3 sealed tail (H1-H17 of
  the hypothesis design). The Shinka notebook stays Shinka's format.
- Any write action from Studio (select/drop, verdict, confirm stay CLI).
- The per-experiment evolution tree (upstream run viewer) and the fork's
  direction Compare page.

## Acceptance

- [x] `aq shinka init/status/...` accept a Project id, Project directory,
  `research/` directory or Workspace with `--project`; bare directories keep
  working; library at `<workspace>/library/`.
- [x] Standalone UI and its tests removed; snapshot builders kept.
- [ ] `/api/v1/project/research?id=` and `/api/v1/research-library` serve
  filtered snapshots with ETag/304, documented in the Studio schema.
- [ ] Studio research pages built, localized, screenshotted with the
  synthetic fixture.
- [ ] Shinka tests, Studio/documentation tests, UI checks, full suite against
  the known-failure baseline, structural gate.

## Work

- [x] Backend binding and CLI split.
- [x] Delete the standalone UI.
- [ ] Studio read model and routes.
- [ ] Demo fixture Workspace.
- [ ] Studio pages and bundle.
- [ ] Docs and verification.

## Findings and decisions

- 2026-11-05 — The Shinka library is a knowledge base (raw sources compiled
  into wiki pages), not the Studio Factor/Strategy library of verified Run
  evidence; it stays one per Workspace and Studio shows it as a separate
  section of the Library area rather than merging the two models.
- 2026-11-05 — `cli.py` (1,109 non-empty lines after step 1) failed the
  no-new-god-file ratchet; it was split by command group instead of
  re-baselining.

## Verification

- Pending.

## Progress log

- 2026-11-05 — Plan created; backend binding and UI removal done.

## Completion

Pending.
