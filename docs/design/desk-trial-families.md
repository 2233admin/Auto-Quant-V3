# Desk-level trial families

Status: implemented (V3, OpenAlice adaptation part 3). Tracking:
<https://github.com/2233admin/Auto-Quant-V3/issues/23>.

Related: [[docs/design/selection-adjusted-research-evidence]],
[[docs/design/factor-to-portfolio-conversion]],
[[docs/design/core-trial-gate]], [[docs/design/research-handoff]].

## Problem

A Project-local research family counts the distinct candidate sources one
Project tried against one fixed evaluator. A host such as OpenAlice can
delegate the same research question again in a new Session or a new Project
(by hand or from cron). Each new Project then starts at one trial, so a
"Supported" can be fished for while every Project honestly reports a small
count. #18 closed this hole for one route (a desk converted from a Factor
Lab inherits the source Project's count); this document closes it for every
route.

## Question fingerprint

`autoquant/trial_families.py` derives one fingerprint per Project Study
(method `question-and-caller-scope-v1`). Exactly these fields define "the
same hypothesis":

| Field | Source | Why it is part of the identity |
| --- | --- | --- |
| `question` | Research Request `question`, else the Project description | the caller's hypothesis |
| `scope.objectKind` | Study `subject.kind` (factor, portfolio, model…) | a Factor and a Portfolio built on it are different claims |
| `scope.objective` | Study objective metric and direction | the selection statistic being maximized |
| `scope.target` | request `factorPolicy.claim`, `factorPolicy.outcome`, `direction` | target/outcome of the claim |
| `scope.universe` | sorted request asset symbols; sorted `predictionAssets` | universe identity |
| `scope.horizon` | `primaryForwardBars` from `strategies/research-horizon.json` (or the request) | horizon |
| `scope.splitProtocol` | selection split implied by the objective (`validation`) and the fixed Judge entrypoint that owns the split | split protocol |

Missing caller facts stay `null`; nothing is defaulted. The data vintage,
provider, Project id/name, Judge bytes and candidate code are deliberately
**not** part of the identity: re-asking over a fresh download or in a renamed
Project is the fishing pattern being counted. A Study-owned request
(`studies/<id>/request.json`) takes precedence over the Project request.

Question normalization removes only presentation: Unicode NFKC, case
folding, whitespace collapsing, surrounding quotes and trailing sentence
punctuation. The family id is `tf-` plus the first 16 hex digits of the
SHA-256 of the canonical `{question, scope}`; `scopeHash` covers the scope
alone.

## Joining a family

- **Exact match joins automatically.** Same normalized question and same
  scope → same family id. A Project renamed, or a question that differs only
  in case, spacing or punctuation, joins.
- **Same scope, different question → possible related family.** Core cannot
  judge whether a reworded question is the same hypothesis, so it never
  decides. Project creation output (`aq project create|intake|from-factor`),
  `aq orient --json` (`deskResearch`) and `aq family show` list every other
  family with an identical `scopeHash` as `possibleRelatedFamilies` and set
  `declarationRequired`. The caller states the answer, a caller-owned fact:

  ```bash
  aq family declare <path> --project ID --study ID --same-family tf-…
  aq family declare <path> --project ID --study ID --new-hypothesis
  ```

  Until then the Core trial gate refuses counted trials with
  `trial-gate.family-declaration-required`. Declarations are append-only; a
  new-hypothesis declaration is symmetric, so the earlier Project is not
  asked again. Trials already registered in one family cannot be moved.
- **Different scope** (for example another horizon) is a different family
  and is not flagged.

## Ledger

One file per family: `trial-families/<family-id>.json` at the Workspace root
(kind `autoquant-trial-family`, V1), tracked in Git like Runs and Reports.

Why this location and shape:

- *Workspace root, not a Project*: the count must survive Project deletion
  and belongs to no single Project.
- *One file per family*: concurrent Projects (or Session branches) asking
  different questions touch disjoint files, so Git merges stay trivial and
  each file stays bounded.
- *Not under `.autoquant/`*: that directory holds operational, often ignored,
  Studio state; the ledger is durable desk state that a replacement Agent or
  the host must be able to recover from the repository.

Each file holds the fingerprint, `members` (Project, Study, how it joined,
its own fingerprint hash), `declarations`, and `trials`
(`projectId`, `studyId`, `runId`, `sourceHash`, `status`, `completedAt`,
`registeredAt`). A present but malformed file fails closed.

The ledger is written only by `aq` commands: after every trial command
(`run execute`, `session start`, `experiment evaluate`, `research run`, even
when they fail), after Project creation, and by `aq family declare`. Reads
never write. Registration is idempotent (`(project, study, run)` is the key;
the first `registeredAt` is kept) and nothing is ever removed.

**Migration.** Existing Projects get their family on first read: every read
unions the ledger with a live scan of the effective Workspace Projects, so a
desk created before this change is counted without rewriting any Run, Report
or Dossier. Frozen holdout targets are skipped: they re-evaluate already
counted sources and do not search.

## Counting

A desk trial is one distinct `(projectId, studyId, sourceHash)` in the
family; failed Runs count. `deskTrialCount` is the total; for one Project,
`otherProjectTrials` excludes its own trials (already in its Project
family) and the #18 lineage source Project (already in
`inheritedSourceTrials`).

When `otherProjectTrials > 0`, `build_research_family` adds
`deskInheritedTrials`, a `deskFamily` block (family id, fingerprint hash,
desk count, a hash of the counted keys) and raises `effectiveSourceTrials`,
so Factor Bonferroni and Portfolio DSR use the desk-wide `N`, exactly like
#18 inheritance. Projects whose family has no other Project keep the exact
historical projection.

**As-of semantics.** A projection with a cutoff (Report publication and
verification) counts only ledger trials registered *and* completed by the
cutoff. Report and Dossier publication register the whole Workspace first.
Trials discovered later — including migrated legacy trials — never enter an
earlier immutable Report, so old Reports keep verifying; live projections
include everything.

## Surfaces

- `aq family list|show|declare` (see [[docs/CLI]]).
- `aq orient --json` → `deskResearch.trialFamilies` with family id,
  desk-wide count, related families and budget state.
- Studio's Session-start and evaluation previews use the same
  `effectiveSourceTrials`; the Studio library verdict reads the same
  selection adjustment.

## Invariants

1. A question re-asked in a new Project never starts a fresh count.
2. Only an exact normalized match joins automatically; everything else that
   could be the same hypothesis waits for a caller declaration.
3. Reads never write; the ledger never forgets a trial.
4. An immutable Report's family is complete as of publication and does not
   change when later trials are registered.

## Known limits

- The horizon field is the bar count; two Projects with the same bar count
  over different base intervals share a family (conservative).
- A caller can still declare `new-hypothesis` dishonestly; the declaration
  is recorded with its time and fingerprint so a reviewer can audit it.
- Trial key is an upper bound: an identical source re-run in a second
  Project counts again.
