# Product maturity roadmap

- Status: `active`
- Updated: `2026-11-03`
- Related design: [[docs/design/product-capability-map]],
  [[docs/design/studio-information-architecture]],
  [[docs/design/studio-assistant]],
  [[docs/design/research-selection-integrity]],
  [[docs/design/selection-adjusted-research-evidence]],
  [[docs/design/structural-rules]]
- Execution tracking: GitHub issues #2 and #4–#9 on
  https://github.com/2233admin/Auto-Quant-V3 (one issue per build step below).

## Outcome

AutoQuant Studio closes the most visible gaps against mature factor-research
products, in an agreed order, without giving up any research-integrity rule
that already distinguishes it. A first-time user can bring their own data,
read every headline number, compare Runs on the same baseline, check whether a
factor is new, and go from a Supported factor to an after-cost strategy
backtest inside Studio.

## Context

The 2026-11-03 survey [[docs/design/product-capability-map]] compared eleven
products (QuantConnect, Qlib, Numerai Signals, Alphalens/pyfolio, QuantRocket,
JoinQuant, RiceQuant, BigQuant, WorldQuant BRAIN, PandaAI and Zipline) with
AutoQuant v0.9.31 plus the PR #3 draft. Its section 11 ranks fifteen P0/P1
items. The owner agreed the order below on 2026-11-03: the first seven items
are scheduled as GitHub issues, the remaining eight are recorded as later
work.

Owner direction: adopt capabilities from mature open solutions rather than
reinventing them. JoinQuant `jqfactor_analyzer` (MIT) and Alphalens
(Apache-2.0) may be reused, adapted or ported, provided every reused or
adapted file is attributed in [[THIRD_PARTY_NOTICES]] with its licence text,
in the same way the existing entries there are written. Closed or
licence-incompatible products are studied for behaviour only.

One known blocker shapes step 5: `autoquant/portfolio_explorer.py` is 10,555
lines. Adding the Strategy workbench read model on top of it would grow an
already unreviewable module, so that file must first be split into cohesive
modules. The structural ratchet in [[docs/design/structural-rules]] keeps new
oversized files out while that debt is paid down.

## Scope

### In scope

The agreed build order, one GitHub issue per step:

1. **Studio Assistant** — land PR #3 / issue #2 (Claude first). Every change
   shows its trial number and a before/after comparison; a trial is counted
   only after confirmation. Coordinated in [[plans/studio-assistant]].
2. **Metric explanations** — issue #4. A "?" popover with a one-sentence
   explanation beside every headline number (HAC t, DSR, trial N and the
   rest) and a prescribed result reading order.
3. **Data intake wizard and quality report** — issue #5. Turn a user CSV into
   a research-ready dataset from Studio, with a one-page report of missing
   data, jumps, zero volume, long suspensions and whether delisted assets are
   present. Replaces the empty state that currently blocks first use.
4. **Run history and same-baseline compare** — issue #6. Filter Run history;
   compare two Runs side by side with a difference column; refuse and explain
   when universe, window or horizon differ.
5. **Strategy workbench** — issue #7. Build a portfolio from verified factors
   with Backtest/Versions/Analyses tabs and a New strategy action. First
   blocked by the `autoquant/portfolio_explorer.py` split described above.
6. **Factor redundancy** — issue #8. Correlation and residual IC of a new
   factor against the user's existing factor library, shown on the factor
   card as a likely-duplicate flag.
7. **Full factor tear sheet** — issue #9. Configurable 5/10 quantiles as a
   frozen parameter counted as one trial, per-group turnover, IC
   autocorrelation warning, after-cost long-short and a short-sample warning.

### Later (recorded, not scheduled)

8. Group neutralization from a caller-supplied industry or market-cap file.
9. Dated universe membership files with a survivorship caveat on the Verdict.
10. Tuning task: every combination counts toward the family, adjusted results
    only, overlaid with a noise frontier.
11. PBO/CSCV (slice C), replacing `pbo-not-computed`.
12. Hypothesis/Verdict objects and the Refuted protocol (H1–H17).
13. Workspace-default sealed-tail holdout in Studio.
14. Self-contained HTML (and printable PDF) Report export with the test gate.
15. Forward shadow tracking with decay alerts, producing no orders.

Each later item gets its own issue and, where it crosses public surfaces, its
own indexed plan when it is scheduled.

### Out of scope

- Everything in section 11(c) of the survey: raw-IC leaderboards, uncounted
  diagnostics, unadjusted threshold verdicts, single-sentence AI edits, an
  "Auto" approval bypass, headline-only cards, tuning reported on the tuning
  window, order placement or live deployment, silent data services,
  conclusion-free metric walls and community strategy copying.
- A factor DSL, a general portfolio optimizer and event-driven backtesting.

## Integrity rules that stay

These are not negotiable trade-offs for any step above:

- Approval for holdout unlock and for Verdict promotion is mandatory. Neither
  becomes a session-level toggle or an "Auto" mode, in Studio or in the
  Assistant.
- Tuning reports adjusted results only. Every evaluated combination counts
  toward the Project trial family, and no result is reported on the window
  it was selected on.
- Studio never computes verdicts. Verdicts come from the fixed Judge and Core
  evidence; Studio and the Assistant present, explain and request actions.
- Reused third-party code (Alphalens, `jqfactor_analyzer`) is adopted under
  these rules, not instead of them: its metrics are evidence inside the fixed
  Judge, never a new selection or promotion path.

## Acceptance

- [ ] Steps 1–7 are each closed through their GitHub issue with recorded
      verification evidence (tests, CLI/Studio parity where both surfaces are
      affected, and browser acceptance for Studio work).
- [ ] Every reused or adapted file from `jqfactor_analyzer` or Alphalens is
      listed in [[THIRD_PARTY_NOTICES]] with its licence.
- [ ] `autoquant/portfolio_explorer.py` is split before step 5 adds to it,
      and the structural gate in [[docs/design/structural-rules]] passes on
      every step's final tree without loosening a rule.
- [ ] None of the integrity rules above is weakened; any design change they
      touch is recorded in the owning `docs/design/` document.
- [ ] Items 8–15 each have an issue or an explicit deferral note.

## Work

- [x] Translate the 2026-11-03 survey into
      [[docs/design/product-capability-map]].
- [x] Record the agreed order, owner direction and integrity rules here and
      index this plan.
- [x] Add the conservative Code Intel structural ratchet
      ([[docs/design/structural-rules]]).
- [ ] Step 1: land PR #3 / issue #2.
- [ ] Step 2: issue #4 metric explanations.
- [ ] Step 3: issue #5 data intake wizard and quality report.
- [ ] Step 4: issue #6 Run history and same-baseline compare.
- [ ] Split `autoquant/portfolio_explorer.py` into cohesive modules.
- [ ] Step 5: issue #7 Strategy workbench.
- [ ] Step 6: issue #8 factor redundancy.
- [ ] Step 7: issue #9 full tear sheet.
- [ ] Open issues for items 8–15 when each is scheduled.
- [ ] Final completion audit.

## Findings and decisions

- 2026-11-03 — The survey's own suggested order put the data wizard first;
  the owner moved the Assistant (already in flight as PR #3) to step 1 and
  kept the rest of the P0 block in survey order.
- 2026-11-03 — Owner direction: adopt mature open solutions;
  `jqfactor_analyzer` (MIT) and Alphalens (Apache-2.0) may be reused with
  attribution in [[THIRD_PARTY_NOTICES]].
- 2026-11-03 — `autoquant/portfolio_explorer.py` measured at 10,555 lines;
  it blocks step 5 until split.
- 2026-11-03 — The Sentrux engine reads rules and baseline from
  `<scope>/.sentrux/`, which puts `autoquant/.sentrux/` inside the Python
  package. It is excluded from the Harness source hash (`autoquant/runs.py`)
  and from the wheel (`pyproject.toml`) so re-baselining never changes Run
  identity or ships governance files. Python/TypeScript import boundaries and
  a bundle exclusion are not expressible in the engine; see
  [[docs/design/structural-rules]].

## Verification

- 2026-11-03 — `uv run python scripts/check_doc_links.py` passes with the new
  survey, plan, structural-rules document and index entry.
- 2026-11-03 — `code-intel sentrux check autoquant` and
  `code-intel sentrux check studio-app/src` exit 0 on the committed tree. A
  throwaway 900-line file in each scope made `check` exit 1
  (`god_files_increased`, plus `quality_degraded` in `studio-app/src`); after
  deleting it `check` exited 0 again. The probe files were never committed.
- 2026-11-03 — Adding a file under `autoquant/.sentrux/` leaves
  `_harness_source_hash()` unchanged, and `uv build --wheel` contains no
  `.sentrux` entry.

## Progress log

- 2026-11-03 — Plan created from the capability survey and the owner's agreed
  build order.

## Completion

Complete this section only when status becomes `completed`.
