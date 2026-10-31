# Merge Shinka Research methods and frontend into AutoQuant V2

- Status: `active`
- Updated: `2026-10-31`
- Target release: `v0.10.0`
- Related design: [[docs/design/selection-adjusted-research-evidence]],
  [[docs/design/research-selection-integrity]],
  [[docs/design/frozen-external-holdout-challenge]],
  [[docs/design/studio-observation-surface]],
  [[docs/design/research-session-loop]].

## Outcome

AQV2 gains the research-governance methods proven in the ShinkaEvolve fork
(`2233admin/ShinkaEvolve`, `shinka/research/`) and serves the fork's dark
instrument frontend as its primary Studio, without losing any existing lane.

## Context

Source survey (fork `main` at `a43eb89`, 2026-10-23):

- Shinka research layer: falsifiable hypotheses with a status machine,
  frozen evaluator + data hashes, IS / validation / lockbox split, DSR with
  cumulative trial count, PBO (CSCV over the top-64 programs), look-ahead
  truncation checks in isolated interpreters, a raw -> wiki -> finding
  knowledge library, per-direction budget, `results.tsv` ledger, and a React
  19 + TypeScript read-only frontend (query-param routing, server-side
  visibility filtering, noise-frontier chart).
- AQV2 already has: DSR/PSR and family-wise HAC p over a content-derived
  research family (`autoquant/selection.py`), frozen external holdout,
  evaluator/data hashes, validation-only selection, bounded Sessions.
- AQV2 gaps: no PBO (design doc: Runs publish no combinatorial matrix), no
  first-class hypothesis (`--hypothesis TEXT` is free text), no cross-Project
  knowledge library, no candidate-search engine (Agent iterates by hand),
  Studio is a 265 KB no-build vanilla JS bundle with a different look.

Owner decisions (2026-10-31):

1. Frontend migration is strangler: new shell at `/`, old Studio kept at
   `/legacy` until parity, then deleted.
2. Methods first, engine later: the ShinkaEvolve evolution engine enters only
   as an optional candidate generator behind an interface, in the last phase.
3. Project = Shinka "direction"; Hypothesis becomes a first-class object under
   a Project, with success/refute criteria frozen before a Session starts.

4. Order revised (2026-10-31): frontend (phase 2) first, on branch
   `feat/shinka-studio-frontend` of the fork `2233admin/Auto-Quant-V2`;
   methods (phase 1) follow as periodic commits on the same branch.
5. Engine: built only when a concrete consumer asks for it; no phase-3 work
   is scheduled.
6. English only for now; the Shinka zh i18n bundle is not ported yet.
7. Option B revised (2026-10-31): the legacy Studio design is not wanted. It
   stays mounted at `/legacy` only as a hidden fallback (no visible nav link
   once a lane is migrated) and is removed in `0.10.1`. Every AQV2 lane is
   re-drawn natively in the new design before `0.10.0`.
8. All features of the reference projects (LuxAlgo `edge-stats`,
   `prop-firm-sim`) are taken in over time, as methods ported to Python; no TS
   code is copied. See "Reference feature inventory".
9. Slice order: A Event Study honesty envelope and UI; B Factor/Portfolio
   noise frontier, ledger and Portfolio bootstrap CI; C Hypothesis and PBO;
   D remaining lanes; E Workspace library; then the reference slices F to K
   defined in "Reference feature inventory".

## Concept mapping

| Shinka | AQV2 | Note |
| --- | --- | --- |
| direction | Project | one body of research |
| hypothesis | Hypothesis (new) | frozen criteria, status machine |
| experiment | Study + Session | Study fixes evaluator; Session is the search |
| trial | unique `subject.sourceHash` in a research family | already counted |
| verdict | Report verdict + selection-adjusted evidence | Report stays immutable |
| lockbox | frozen external holdout | AQV2 holdout is strictly later external data |
| library | Workspace library (new) | shared across Projects |
| `brief` | Agent Work Brief (`aq orient`) | extend, do not add a second brief |

## Scope

### In scope

- Phase 1, methods: PBO; Hypothesis object; hypothesis-bound criteria freeze;
  Workspace library; budget ledger; look-ahead truncation audit comparison
  against `research.py`.
- Phase 2, frontend: JSON contract, React shell, parity matrix, `/legacy`.
- Phase 3, engine: only on demand (see decision 5).

### Out of scope

- Importing Shinka's `quant.py` backtest (AQV2 judges stay authoritative).
- Changing any existing Run, Report, or Dossier byte (immutability holds).
- Write actions in the UI; Studio stays read-only, holdout never one click.
- Phase 3 implementation before phases 1 and 2 are accepted.

## v0.10.0 scope: the idea-to-verdict spine

Owner north star (2026-10-31): *I propose a strategy, idea, or factor and we
test whether it holds.* `v0.10.0` is re-scoped around that single path, per
[[docs/design/hypothesis-and-idea-verdict]]. Reference-project features are
taken in by how much they help judge an idea, not by count.

Priority order for `v0.10.0`:

1. Hypothesis object, frozen criteria, verdict rules v1, check ledger, verdict
   page with the noise-frontier chart (design steps H1 to H9).
2. PBO (slice C) and Portfolio bootstrap CI (slice B); they enter as verdict
   rules `v2` without changing frozen `v1` Hypotheses.
3. The daily-bar part of slice F (conditional-statistics lab): the registry
   fields, predicates, and presets that run on daily OHLC.

Deferred past `0.10.0`: slice F rows that need intraday bars or event-date
data, slice G (rule-survival Monte Carlo), slice H (trade-log import), and
slice E (knowledge library). The inventory keeps every row; only the target
release moves.

## Reference feature inventory

The row-by-row inventory is [[docs/design/reference-absorption-inventory]]
(308 rows: 131 absorb now, 127 absorb later, 28 adapt, 22 skip). This section
keeps the licence rules and the per-slice checklist.

Methods only. Both projects are MIT; the code is not copied and not
redistributed, so no code licence text is shipped. Product text says
"method referenced from", never "Edge Stats" or "LuxAlgo" as a product name,
and never uses their logos (their `TRADEMARKS.md` forbids implying
endorsement). `edge-stats` calendar and event data are CC BY 4.0 with required
attribution "Calendar data from Edge Stats by LuxAlgo
(github.com/LuxAlgo/edge-stats)"; if those dates are ever vendored, ship that
line in `THIRD_PARTY_NOTICES`. PineTS is AGPL-3.0: never embed it in AQV2; it
may only run as a separate external tool.

Slice order (decision 9, extended): A Event Study envelope (done); B Factor and
Portfolio noise frontier, ledger, bootstrap intervals; C Hypothesis and PBO;
D remaining lanes; E library; then the reference slices F (Session Statistics
lab on daily-derivable fields), F-dsl, F-intraday, F-events, F-futures,
G (rule-survival Monte Carlo), G-econ, H (reported trade intake), I (provider
Skills), J (Watch), K (charting engine). Each reference slice needs its own
design document before code.

- [x] A: Wilson interval, min-N guards, stability split, per-year counts,
  quantiles, drill-down, fixed disclaimer (8 rows done).
- [ ] B: seeded stationary block bootstrap with a frozen RNG (conflict 7 in
  the inventory), intervals on Portfolio validation Sharpe, annual return and
  max drawdown, longest time under water, under-water chart, noise frontier
  (7 rows).
- [ ] D: Dataset panel (source, snapshot hash, coverage, calendar authority),
  shared honesty components, return calendar, CSV export of Run artifacts.
- [ ] F: session feature derivation module, strict query contract, registry
  of 47 fields, 14 predicates, 17 outcomes, catalog of 26 daily presets,
  `aq stats` commands, catalog and report pages, trial counter with adjusted
  interval (103 rows now, 4 later, 15 adapt). Owner may move F to `0.10.x`.
- [ ] F-dsl: query DSL that compiles to the JSON contract and echoes it back,
  Studio builder (3 rows).
- [ ] F-intraday: intraday session statistics (opening range, initial
  balance, minutes-to-event, session chart); needs an intraday Study path
  (36 rows).
- [ ] F-events: versioned macro event calendars and event conditions with the
  CC BY 4.0 note where vendored (11 rows).
- [ ] F-futures: contract column, roll-day policy without back-adjustment, CME
  calendar (3 rows).
- [ ] G: rule-survival simulator over a caller-owned rule set, risk sweep,
  sensitivity, compare (35 rows); G-econ: fees, payouts, EV (4 rows).
- [ ] H: reported trade-log intake with the R ladder, trade tags, news filter,
  overlap audit (23 rows).
- [ ] I: provider Skills for keyless or keyed sources (14 rows).
- [ ] J: `aq watch eval` with immutable Watch Evaluations, no daemon, no
  network sinks (8 rows).
- [ ] K: decide Vela (Apache-2.0) for session and path charts (3 rows).
- Not taken, with reasons in the inventory: DuckDB store, hosted store,
  webhook/chat/desktop sinks, broker pull, live firm directory, hosted
  simulator, Vela workspace app and UI kit, PineTS (AGPL-3.0), Edge Score,
  prop-firm accounting, AI reflection, mutable journal database.

## Parity matrix

The new shell is served at `/` and the legacy Studio at `/legacy`. A row moves
to `migrated` only when the new page draws the same verified snapshot fields
and the owner accepts it. `/legacy` is a hidden fallback (see decision 7): once a row is migrated its
nav link to `/legacy` disappears, and `/legacy` is removed in `0.10.1`.

| Surface | Status | New page | Note |
| --- | --- | --- | --- |
| Workspace / Project list | migrated (slice 1) | Projects | `/api/v1/workspace` |
| Project header, brief, next move | migrated (slice 1) | Project | Agent Work Brief |
| Studies and latest Run per Study | migrated (slice 1) | Project | validation-split values only |
| Factor evidence, validation split | migrated (slice 1) | Project | tertiles, folds, components still legacy |
| Sessions list, activity timeline | migrated (slice 1) | Project | no KEEP/REVERT trajectory chart yet |
| External holdout | legacy | link only | state shown, board stays legacy |
| Factor qualification funnel, components, quantiles | legacy | | |
| Portfolio decision explorer, sizing, stress, viability | legacy | | |
| Research program / lane admission | legacy | | |
| Research agenda | legacy | | |
| Governed RL policy lab | legacy | | |
| Book risk, path stress | legacy | | |
| Price event study | migrated (slice A) | Event Study | `/projects/<id>/event-study`: Wilson envelope, stability, per-year, drill-down; see [[docs/design/event-study-honesty-envelope]] |
| Strategic allocation | legacy | | |
| Reports, Independent Reviews, Dossiers | legacy | | |
| Selection-adjusted evidence (DSR family trials) | legacy | | noise-frontier chart planned |
| Command palette | migrated (slice 1) | Ctrl K | pages and Projects only |
| Theme (dark/light), auto refresh | migrated (slice 1) | top bar | |

## Acceptance

- [ ] PBO is computed from a published per-bar return matrix of the top-K
  unique sources in a research family; CSCV 16 blocks; documented as
  visibility evidence, not a hidden gate, until the owner promotes it.
- [ ] A Hypothesis cannot be edited after its first Session starts; its
  criteria hash is recorded in every Run it governs.
- [ ] CLI and Studio parity: every new field is in `aq` JSON and in the
  snapshot before any UI renders it.
- [ ] Visibility rule kept: no test/holdout number in any view before the
  corresponding verdict or holdout audit exists (server-side filtering).
- [ ] Parity matrix lists every lane (Factor, Portfolio, RL, Research Desk,
  Book Risk, Event Study, Allocation, Holdout, Reports, Reviews, Dossiers);
  `/legacy` is removed only when every row is migrated and owner-accepted.
- [ ] Full test suite passes; existing sample Project Runs unchanged
  byte-for-byte.
- [ ] Wheel ships a built frontend (dist committed or built in release);
  no pnpm needed at install time.

## Work

- [ ] Phase 0: owner-approved plan; open questions below answered.
- [x] 1.1 Design doc [[docs/design/hypothesis-and-idea-verdict]] (Hypothesis, frozen criteria, verdict rules, ledger, graveyard). PBO gets its own design when slice C starts.
- [ ] 1.2 Run artifact: per-bar validation return matrix for top-K sources.
- [ ] 1.3 PBO projection in `selection.py` + `aq` JSON + tests vs Bailey
  et al. reference values.
- [ ] 1.4 Hypothesis implementation steps H1 to H9 from the design doc
  (schema and freeze, routing, Session/Run binding, verdict rules v1, Verdict
  Record, graveyard search, read model, Studio verdict page, Skill).
- [ ] 1.5 Workspace library (`raw/`, `wiki/`, manifest, `aq library ...`);
  finding write-back after a Report; holdout numbers excluded until audit.
- [x] 2.1 Frontend contract (slice 1): `/api/v1/workspace` and per-Project snapshot
  split (current single fat snapshot is the adapter source).
- [ ] 2.2 (slice 1 done) Port shell, tokens, Directions/Project, Report, Compare, Library
  pages; wire noise-frontier chart to `expected_max_SR`.
- [ ] 2.3 Parity matrix and per-lane migration; `/legacy` mount.
- [ ] 2.4 Browser regression (Puppeteer) and owner visual acceptance.
- [ ] 3.1 (on demand only) Candidate-generator interface; Shinka adapter.
- [ ] Final completion audit.

## Open questions

- Shinka frontend license/provenance: it embeds Plotly and upstream-derived
  analysis pages (`THIRD_PARTY_NOTICES`); decide whether the viz_tree
  analysis iframe is ported or dropped (it is only meaningful with the engine).
- Where `dist` lives: commit built assets, or build in the release pipeline.
- Tracking: issue #1 on `2233admin/Auto-Quant-V3`; this plan holds the detail.

## Findings and decisions

- 2026-10-31 — Survey found AQV2 already covers DSR, family trial counting,
  holdout and evaluator hashing; the real gaps are PBO, Hypothesis, library,
  engine and frontend.
- 2026-10-31 — Snapshot builder was slow because every projection re-verified
  every Run: 284 `load_run` calls for 19 Runs, 3.09 s per build, repeated on
  every request. Fix is a per-build memo plus a fingerprint-keyed server
  cache; CLI verification is untouched.
- 2026-10-31 — Decided: the built `studio_app/` bundle is excluded from
  the Harness `sourceHash` (commit `b294b42`). Earlier note follows.
- 2026-10-31 — (superseded) Open: the Harness `sourceHash` hashes every file under the
  package, including `studio_app/` and `studio_assets/`, so each frontend
  rebuild changes the Harness identity recorded in new Runs. Proposal, not
  applied: exclude `studio_app/` (a presentation bundle, not evaluation code)
  in `_harness_source_hash`. This changes the hash of every future Run, so it
  needs an owner decision.

## Verification

- Pending.

## Progress log

- 2026-10-31 — Design doc [[docs/design/hypothesis-and-idea-verdict]] written; v0.10.0 re-scoped as the idea-to-verdict spine.
- 2026-10-31 — Plan created from the ShinkaEvolve survey and owner decisions.
- 2026-10-31 — Slice 1 (branch `feat/shinka-studio-frontend`): server routes
  `/api/v1/workspace` and `/api/v1/project?id=`, legacy Studio at `/legacy`,
  built app committed at `autoquant/studio_app/`, source in `studio-app/`.
  Ported design tokens, shell, Modal, Notice; Projects and Project pages are
  new. Term, Markdown, Palette i18n, run/compare/analysis pages not ported.
- 2026-10-31 — Snapshot builder speedup, three commits: per-build Run memo
  (snapshot 3.09 s -> 1.58 s, disk loads 284 -> 19 per build); fingerprint
  cache with single-flight rebuild, ETag and 304 (warm request about 0.03 s,
  cold unchanged); Project page makes one request, Plex Mono latin-only
  (bundle 845 KB / 39 files -> 597 KB / 15). Inter Variable has no
  latin-only entry, so it still carries every subset. Data routes now send
  `Cache-Control: no-cache` plus `ETag` instead of `no-store`.
- 2026-10-31 — Owner decisions 7-9 recorded; reference feature inventory
  added; slice A (Event Study honesty envelope) started.
- 2026-10-31 — Slice A shipped on `feat/shinka-studio-frontend`: Event Study
  honesty envelope (`autoquant/event_envelope.py`, read-side projection, no Run
  or schema change to stored artifacts), `aq run event-study` prints every rate
  with N and interval, Studio page at `/projects/<id>/event-study`.
- 2026-10-31 — Reference absorption inventory written
  ([[docs/design/reference-absorption-inventory]]): 308 rows across
  edge-stats, prop-firm-sim, Vela, PineTS and trade-journal; ten conflicts
  with AQV2 principles and six proposed native shapes recorded; thin checklists
  above replaced by per-slice lists.
- 2026-10-31 — Owner decisions folded into
  [[docs/design/hypothesis-and-idea-verdict]]: Allocation, Book Risk, and Path
  Stress get verdict rules (Q3); many Hypotheses flow through one Project
  pipeline with `M` disclosed and no pooled DSR (Q4); one Hypothesis per
  dedicated Project with a Workspace-level idea record and an incremental
  (ablation) Hypothesis kind (Q6); a sealed tail carved at intake and opened
  once by `aq hypothesis confirm`, which alone yields `confirmed` or
  `unconfirmed`. New implementation steps H10 to H17 and open questions 11 to
  17 added. Design only, nothing implemented.
- 2026-10-31 — Read the public DGT reference pages (site and TradingView) and wrote
  [[docs/design/dgt-reference-component-notes]]: per-component F/U/P notes, own-model
  definitions on OHLCV, 28 unverified vendor usefulness claims in falsifiable form,
  vendor Terms constraints, and the open undisclosed items. Research notes only.
