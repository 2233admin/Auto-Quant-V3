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
- [x] `/api/v1/project/research?id=` and `/api/v1/research-library` serve
  filtered snapshots with ETag/304, documented in the Studio schema.
- [x] Studio research pages built, localized, screenshotted with the
  synthetic fixture.
- [x] Shinka tests, Studio/documentation tests, UI checks, full suite against
  the known-failure baseline, structural gate.

## Work

- [x] Backend binding and CLI split.
- [x] Delete the standalone UI.
- [x] Studio read model and routes.
- [x] Demo fixture Workspace.
- [x] Studio pages and bundle.
- [x] Docs and verification.

## Findings and decisions

- 2026-11-05 — The Shinka library is a knowledge base (raw sources compiled
  into wiki pages), not the Studio Factor/Strategy library of verified Run
  evidence; it stays one per Workspace and Studio shows it as a separate
  section of the Library area rather than merging the two models.
- 2026-11-05 — `cli.py` (1,109 non-empty lines after step 1) failed the
  no-new-god-file ratchet; it was split by command group instead of
  re-baselining.

## Verification

2026-11-05, Windows Server 2025, `.venv` with the `shinka` and `shinka-engine` extras:

- `pytest tests/shinka_research -q`: 276 passed (step 1: 336 passed, 1 skipped; UI, analysis and design-token tests removed, 5 binding tests added).
- `unittest tests.test_studio_research`: 13 OK; `tests.test_studio tests.test_studio_cache tests.test_documentation` OK.
- Full `unittest discover -s tests -t .`: 714 run, 1 failure, the known `test_sample_template_owned_files_match_a_fresh_research_desk`; `scripts/check_known_failures.py --no-rerun` exit 0.
- `studio-app`: `pnpm typecheck` 0, `pnpm build` 0 (reproducible), `pnpm check:i18n` 0; `node studio-app/tests/run-idea-answer.cjs` from the repository root 89/89 (`pnpm test:ui` inside `studio-app/` fails one cwd-dependent test, as on the base).
- `code-intel sentrux check autoquant` and `studio-app/src` pass after the explained re-baseline (`chore(structure)` commit).
- Screenshots of the demo Workspace at 1440x900 in `D:	mpqv3-shinka-shots\`.

## Deferred

- (Done 2026-11-05, owner follow-up) The evolution run pages and the within-direction experiment comparison are redrawn; failed-proposal nodes, embedding views, plot images, the meta PDF and the worker occupancy timeline are not.
- Studio is read-only for research; select/drop, verdict and confirm stay on the CLI.
- Shinka modules other than `ui.py`/`state.py` still use locale-default text encoding.

## Progress log

- 2026-11-05 — Plan created; backend binding and UI removal done.
- 2026-11-05 — Read model, fixture, Studio pages, docs and verification done; awaiting owner review.
- 2026-11-05 — Owner follow-up: evolution run pages (progress, lineage, inspector, prompts, meta, throughput) and experiment comparison added.

## Completion

Pending.
