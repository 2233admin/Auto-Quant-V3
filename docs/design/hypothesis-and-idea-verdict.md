# Hypothesis and idea verdict

Status: proposed design; nothing here is implemented. It owns the path from a
rough trading idea to an evidence-derived verdict. The owner decisions of
2026-10-31 (Allocation and Book Risk verdict rules, the pipeline reading of
multiplicity, one Hypothesis per dedicated Project, idea decomposition with
incremental Hypotheses, and the sealed tail) are recorded in
[Owner decisions](#owner-decisions-2026-10-31) and built into the sections
below.

Related: [[docs/design/quant-research-lifecycle]],
[[docs/design/research-selection-integrity]],
[[docs/design/selection-adjusted-research-evidence]],
[[docs/design/frozen-external-holdout-challenge]],
[[docs/design/run-bound-research-reports]],
[[docs/design/evidence-driven-research-agenda]],
[[docs/design/research-program-orchestration]],
[[docs/design/program-research-dossiers]],
[[docs/design/independent-research-reviews]],
[[docs/design/studio-research-decision-brief]],
[[docs/design/factor-qualification-funnel]],
[[docs/design/event-study-honesty-envelope]],
[[docs/design/ohlcv-price-event-study]],
[[docs/design/agent-native-quant-workbench]],
[[docs/design/studio-observation-surface]],
[[docs/design/reference-absorption-inventory]],
[[docs/design/portfolio-native-allocation-lab]],
[[docs/design/reported-position-book-risk]],
[[docs/design/reported-book-historical-path-stress]],
[[docs/design/executed-book-risk-compliance]],
[[docs/design/factor-diagnostics]],
[[docs/PROJECT_FORMAT]], [[docs/CLI]], and
[[plans/shinka-research-methods-and-frontend-merge]].

## Purpose

The owner's north star is one sentence: *I propose a strategy, idea, or factor
and we test whether it holds.* AutoQuant already measures hard. It does not yet
make the question itself a first-class, frozen, falsifiable object, and it
does not give the owner one page that answers "does it hold?" with the
evidence and the reasons it might not.

Today the idea exists only as loose text:

- `request.json` carries `hypotheses: string[]`, `direction`, and `horizon`;
- each Experiment carries a free-text `hypothesis` string;
- the research agenda derives candidate-iteration moves with their own
  `hypothesis` text;
- the Factor claim (`strategies/factor-claim.json`) freezes what kind of
  Factor claim is being made, but not what result would support or refute it.

Nothing records, before the first trial, what would count as success, what
would count as failure, and how many ideas were tried. The ShinkaEvolve
research layer solved exactly this with a falsifiable Hypothesis, a frozen
plan, a deterministic verdict rule, and a one-page ledger. This document ports
that method onto AutoQuant's existing objects instead of creating a second
research system.

## Owner decisions (2026-10-31)

The owner reviewed the first draft and decided the open questions below. They
are normative for the rest of this document.

| # | Decision | Where it lands |
| --- | --- | --- |
| Q3 | Allocation, Book Risk, and Path Stress get verdict rules. They are not descriptive-only. | [Allocation, Book Risk, and Path Stress](#allocation-book-risk-and-path-stress) |
| Q4 | Many Hypotheses flow through one Project pipeline. Core discloses the Hypothesis count `M` and its family-wise effect. There is no pooled DSR across families. | [Multiplicity across Hypotheses](#multiplicity-across-hypotheses) |
| Q6 | One Hypothesis per dedicated Project. A multi-component idea is decomposed into one falsifiable Hypothesis per component, each in its own Project, linked by a Workspace-level idea record, plus an incremental (ablation) Hypothesis kind. | [Idea umbrella, components, and incremental Hypotheses](#idea-umbrella-components-and-incremental-hypotheses) |
| New | A sealed tail (hidden confirmation segment, ported from the Shinka fork's lockbox) is carved at Project intake before any Agent sees data and opened exactly once. Only that step can produce `confirmed` or `unconfirmed`. | [Sealed tail](#sealed-tail-hidden-confirmation-segment) |
| Use case | The first real use is a TradingView-style context indicator (structure breaks, zones, trend state, volume, anchored VWAP, pivot, PO3 stage, macro slots) tested for whether it helps judgment. Its own-model components are `P` designs, not vendor formulas. | the worked decomposition inside the umbrella section |

## Scope

In scope:

- a Hypothesis object (statement, kind, lane route, success and refutation
  criteria, thresholds) stored in the Project and frozen by content hash;
- a status machine whose terminal states are derived from evidence;
- a versioned, deterministic verdict rule set per idea kind;
- the check ledger and the noise-frontier chart the Studio verdict page draws;
- `aq hypothesis` commands, Agent Work Brief surfacing, and a bundled Skill;
- a searchable idea graveyard over the Workspace;
- multiplicity accounting across Hypotheses;
- verdict rules for Allocation, Book Risk, and Path Stress claims;
- a Workspace-level idea record that decomposes a multi-component idea into
  one Hypothesis per component and adds incremental (ablation) Hypotheses;
- the sealed tail: a physically separated, one-shot confirmation segment.

Out of scope:

- changing any existing Run, Report, Dossier, Judge, or frozen contract byte;
- new evaluators, PBO computation itself (slice C), the bootstrap CI for
  Portfolio (slice B), and the library/wiki (slice E);
- candidate search engines;
- any order, account, or live-trading authority;
- identity authentication. Core records claims; it cannot prove who wrote one.

## What exists and what is missing

| Need | Exists | Missing |
| --- | --- | --- |
| Question and decision context | `request.json` question, `decisionContext`, `hypotheses[]`, `direction`, `horizon` | structure: no criteria, no thresholds, no revision lineage |
| Frozen evaluation | Study, Judge, dataset, dependency hashes; `strategies/*.json` frozen contracts | frozen *meaning of success* |
| Trial counting | research family and unique source trials ([[docs/design/selection-adjusted-research-evidence]]) | counting of *ideas* (Hypotheses) per Project |
| Selection-adjusted statistic | HAC x N for Factor, PSR/DSR for Portfolio | a rule that turns statistics into a verdict |
| Honest interval | Wilson envelope for the Event lane | same envelope vocabulary on a single page |
| Out-of-time confirmation | frozen external holdout and Assessment | linkage from the Assessment back to the idea |
| Independent challenge | Independent Research Review | linkage from the Review to the verdict |
| Past attempts | Reports and Dossiers per Project | a Workspace-wide index of ideas that failed |

The new objects below fill only the right-hand column.

## Mapping from the Shinka fork

AutoQuant's splits differ from Shinka's, so the port is a translation, not a
copy:

| Shinka | AutoQuant | Consequence |
| --- | --- | --- |
| in-sample, `public` metrics, drive selection | train and **validation** split; validation drives KEEP/REVERT | same role |
| validation segment, only the skeptic sees it | **visible test split**, diagnostic only, never in selection | AutoQuant test numbers are *visible* ([[docs/design/research-selection-integrity]]); they cannot serve as a hidden confirmation |
| lockbox, opened once per direction | **frozen external holdout**: a strictly later dataset, one-shot, at Project/Dossier level | this is the only confirmation tier; it is not per Hypothesis |
| direction | Project | decided by the owner |
| hypothesis | Hypothesis (new) | this document |
| experiment | Study plus Session or direct Run | existing |
| verdict `supported` | `supported` on **development evidence** | never "confirmed" until the holdout persists |
| trial count N | unique `subject.sourceHash` in a research family | existing; Hypothesis count M is added on top |

Consequence worth saying plainly: AutoQuant has no hidden validation tier like
Shinka's. A `supported` verdict therefore always means "supported by selection
(validation) evidence, with visible test audit and trial-adjusted statistics,
before any external holdout". The word is never shown without that qualifier.

## Object model

### Hypothesis

A Hypothesis is one Project file, strict JSON, append-only by revision:

```text
<project>/hypotheses/<hid>/
  hypothesis.json        # revision r1, authored while status = proposed
  freeze.json            # written by `aq hypothesis freeze`: criteria hash
  revisions/r2.json ...  # each later revision, with lineage
  verdicts/<vid>.json    # immutable verdict records (see below)
```

`<hid>` is a stable slug (`hyp-0001-short-name`) assigned by Core, unique in
the Project.

```json
{
  "schemaVersion": 1,
  "kind": "autoquant-hypothesis",
  "id": "hyp-0003-gap-down-reversal",
  "revision": 1,
  "supersedes": null,
  "idea": "NVDA gap downs of 5% or more bounce within a week.",
  "ideaKind": "event",
  "statement": "After an NVDA opening gap of -5% or worse, the close five bars later beats the matched SPY return more than half the time.",
  "mechanism": "Forced selling at the open overshoots; liquidity providers fade it.",
  "lane": "ohlcv-event-study-lab",
  "route": { "template": "ohlcv-event-study-lab", "studyId": "price-event-study" },
  "universe": { "assets": ["NVDA", "SPY"], "decisionAssets": ["NVDA"] },
  "horizon": { "interval": "1d", "forwardBars": 5 },
  "data": { "datasetId": null, "datasetHash": null },
  "costs": { "bps": null, "note": "n/a for the event lane" },
  "baseline": { "kind": "matched-reference", "ref": "SPY" },
  "claim": {
    "direction": "above",
    "metric": "event.beatsReference.rate",
    "threshold": 0.5
  },
  "supportedIf": {
    "rule": "event-rate-above-v1",
    "minEvents": 30,
    "requireHalvesAgree": true,
    "ciLevel": 0.95
  },
  "refutedIf": {
    "rule": "event-rate-ci-below-threshold-v1"
  },
  "risks": ["regime dependence", "overlapping events", "survivorship in assets"],
  "origin": { "requestHash": null, "requestHypothesisIndex": null },
  "authority": {
    "proposedBy": "agent-claim",
    "criteria": "default",
    "tradingAuthority": "none"
  }
}
```

Field notes:

- `ideaKind` is `factor`, `event`, `strategy`, `allocation`, `book-risk`,
  `path-stress`, or `incremental`.
  `lane` and `route` are *derived* from it by Core's routing table (below); the
  Agent proposes, Core validates the route exists for the current
  Project template and data.
- `statement` must be falsifiable: Core rejects statements without a `claim`
  and rejects `claim.metric` values outside the lane's published metric list.
- `supportedIf` and `refutedIf` name a rule from the **closed, versioned**
  rule set below plus its thresholds. Agents pick a rule and give thresholds;
  they never write judging code. This is the Shinka rule principle.
- `refutedIf` is mandatory. A Hypothesis cannot be frozen without a declared
  way to be wrong. This is how `refuted` stays honest.
- `origin` links to `request.json` when the idea came from the delegated
  request; `aq hypothesis add --from-request N` copies request string N into
  `idea`. The request file is not modified.
- `authority.criteria` is `default` when every threshold equals the rule's
  published default, else `caller-specified`. Core cannot authenticate the
  owner, so it records the claim and shows it.

### Freezing

`aq hypothesis freeze <hid>` canonicalizes the revision (sorted keys, no
whitespace), computes `criteriaHash = sha256(canonical revision)`, and writes
`freeze.json` containing the hash, UTC time, Harness identity, rule versions,
and the hash of the current `request.json` and Study identities when present.
After this the revision file is read-only to every Core writer; validation
rejects any byte change.

What a frozen revision binds to:

- **Session**: `aq session start --hypothesis <hid>` copies the frozen
  revision and its `criteriaHash` into the Session manifest, beside the
  request and Brief that are already copied and revalidated on load. A Session
  binds at most one Hypothesis.
- **Direct Run** (Event, Allocation, Book Risk lanes, which have no Session):
  `aq run ... --hypothesis <hid>` records `hypothesis: {id, revision,
  criteriaHash}` in the Run's `execution` block. This is a new optional Run
  field; old Runs omit it and stay valid.
- **Report and Dossier**: `aq report` and `aq dossier` read the binding
  from the Session or Run they anchor; no new field is needed there.

A frozen revision is **not** a Study dependency. This is deliberate: the
research family id is derived from Study, program, Judge, dataset, dependency
hash, and objective ([[docs/design/selection-adjusted-research-evidence]]).
If criteria were a dependency, editing a threshold would start a new family and
silently reset the trial count, which is exactly the criteria-shopping attack.
Criteria revisions therefore never reset trials.

### Revision lineage

`aq hypothesis revise <hid>` creates `revisions/rN.json` with
`supersedes: <previous criteriaHash>` and returns the status to `proposed` for
that revision. Rules:

1. A revision never edits an earlier file.
2. Evidence for revision rN is only Runs and Sessions bound to rN's
   `criteriaHash`. Runs bound to an earlier revision remain in the family
   (their trials still count) but are labelled `evidence for r(N-1)` and do not
   support rN's verdict. To re-use the same source under rN, the Agent re-runs;
   an identical source adds an execution, not a unique trial.
3. The verdict page shows the revision count and any revision made after a
   bound Run existed (`revisedAfterFirstRun`), as a visible caveat row.
4. A revision that *loosens* any criterion (lower threshold, weaker rule,
   fewer required checks) after a bound Run existed is allowed but flagged
   `loosenedAfterEvidence: true`. The verdict rules cap such a revision at
   `inconclusive` until the owner clears the flag with a recorded decision
   (`aq hypothesis revise --accept-loosening`, stored as a claim in the
   revision).

### Verdict record

A verdict is *derived*, not authored. Core computes it on every read from the
frozen revision plus verified immutable evidence, exactly as it derives
`selectionIntegrity`. Browser code never computes it.

An immutable **Verdict Record** is written only on `aq hypothesis verdict
--record`:

```json
{
  "schemaVersion": 1,
  "kind": "autoquant-hypothesis-verdict",
  "id": "verdict-20261101T...-ab12cd34ef56",
  "hypothesis": { "id": "hyp-0003-...", "revision": 1, "criteriaHash": "..." },
  "ruleSet": "hypothesis-verdict-rules-v1",
  "verdict": "inconclusive",
  "tier": "development",
  "reasonCodes": ["sample-below-minimum"],
  "ledger": [ { "check": "sample-size", "state": "fail", "value": 18, "threshold": 30 } ],
  "evidence": {
    "family": { "id": "...", "ledgerHash": "...", "uniqueTrials": 1 },
    "runs": [ { "id": "run-...", "inputHash": "...", "resultHash": "..." } ],
    "projectHypothesisCount": 3,
    "asOf": "2026-11-01T00:00:00Z"
  },
  "caveats": ["pbo-not-computed", "holdout-not-run"]
}
```

Why a new record rather than reusing Report or Dossier:

- A Report is the primary researcher's lane analysis over an evidence prefix;
  its prose is Agent-authored and it is bound to one Run or Session. A verdict
  must be Core-authored, rule-derived, and reproducible without prose.
- A Dossier composes lane Reports into one Project-level answer; one Project
  may hold several Hypotheses with different verdicts, so a Dossier cannot be
  the carrier.
- The graveyard needs a small immutable record per idea that survives even if
  no Report was ever written (an idea dropped early has none).

The record is append-only: a later verdict is a new file; the previous remains.
It is an as-of snapshot, like the family ledger frozen into a Report. Loading
recomputes the verdict from the frozen evidence refs and rejects a mismatch,
the same integrity pattern as selection integrity.

A Report may *cite* a Verdict Record by id and hash in its evidence references.
Nothing forces it to, and a Report's prose can never override the record.

## Status machine

```text
proposed -> framed -> running -> challenged -> supported | refuted | inconclusive
    |          |          |            |
    +----------+----------+------------+--> dropped
proposed -> untestable      (framing result: no lane can test it here)
```

| Status | Meaning | Set by |
| --- | --- | --- |
| `proposed` | file exists, criteria editable | `aq hypothesis add` / `revise` (Agent) |
| `untestable` | no lane can test it with this Project's data; carries reason codes and `unblockedBy` | Core, from the routing check (Agent only triggers the check) |
| `framed` | criteria frozen; `criteriaHash` exists | `aq hypothesis freeze` (Agent) |
| `running` | at least one Session or Run is bound to this revision | derived |
| `challenged` | a terminal Run/Session exists for the revision and a verdict is computable | derived |
| `supported` / `refuted` / `inconclusive` | rule output | derived by Core; the Agent cannot set it |
| `dropped` | abandoned with a reason; trials already run still count | `aq hypothesis drop` (Agent or owner), reason required |

Rules:

1. The Agent cannot move a Hypothesis to `supported`, `refuted`, or
   `inconclusive`. Those are outputs of the rule set; the CLI has no setter.
   This is the answer to Agent self-grading.
2. `dropped` is allowed from any non-terminal state and records `dropReason`
   and the trial count at drop time. A dropped idea stays in the graveyard and
   in the Project multiplicity count M.
3. A verdict can change as evidence grows (more trials raise the noise
   frontier). The status shown is the latest verdict; earlier Verdict Records
   remain.
4. `supported` is never shown bare. It renders as `Supported on development
   evidence`. After a holdout Assessment exists for the same frozen candidate
   it can add `, confirmed out of time` (persists) or `, weakened out of time`.
   The tier is a separate field, not a status.
5. `confirmed` and `unconfirmed` are tier values, never statuses, and only the
   one-shot sealed-tail step can produce them ([Sealed tail](#sealed-tail-hidden-confirmation-segment)).
   Only a Hypothesis whose latest verdict is `supported` may be confirmed.
   The page then reads `Supported on development evidence, confirmed on the
   sealed tail` or `Supported on development evidence, not confirmed on the
   sealed tail`. A tail result never changes `status` and never reaches back
   into the development verdict.

## Verdict rules (`hypothesis-verdict-rules-v1`)

The rule set is closed and versioned. A frozen Hypothesis records the rule
set; a later AutoQuant release adds `v2` rules without changing what `v1`
means. Each rule is a pure function of frozen criteria plus verified
evidence, with no wall-clock, randomness, or Agent input.

### Common rules

1. `refuted` requires the pre-declared `refutedIf` to fire on **raw** evidence.
   Trials and multiplicity can only make `supported` harder; they can never make
   `refuted` easier. (Shinka's holdout rule uses the same asymmetry: a
   correction gates support, a raw non-positive difference gates refutation.)
2. `supported` requires every gate row in the ledger to pass.
3. Anything else is `inconclusive`, with machine-readable `reasonCodes`.
   Failing to show an edge is not a refutation.
4. A gate row in `withheld` or `not-computed` state never passes silently. It
   either blocks `supported` (withheld) or adds a caveat (not-computed, only for
   rows whose method is not yet implemented, listed explicitly below).
5. Visible test results never enter any gate. They appear as an audit row only.
6. Minimum observation floors from the lane contracts apply
   ([[docs/design/frozen-external-holdout-challenge]] uses 120/180/240 rows for
   Factor/Portfolio/RL; the Event envelope uses 10 and 30 events).

### Factor (`ideaKind: factor`, lane `ohlcv-factor-lab`)

Evidence: the Factor Run's primary-horizon validation mean rank IC with HAC
statistics, the qualification stage from
[[docs/design/factor-qualification-funnel]], chronological folds, and the
research-family adjusted p-value from `selection.py`.

- `supported` iff
  1. qualification stage is the positive stage for the declared claim
     (`factor-qualification-positive`, `decision-signal-positive`, or
     `known-style-validation-positive`);
  2. `selectionAdjustment.status = available` and family-wise
     `adjustedP <= 0.05` (HAC p x unique trials N, as already published);
  3. the Hypothesis-level multiplicity correction passes (below);
  4. both chronological validation folds have the declared sign.
- `refuted` iff `refutedIf.rule = factor-ic-not-positive-v1` fires: validation
  mean rank IC in the declared direction is at or below
  `refutedIf.maxMeanRankIc` (default `0.0`) with at least
  `minObservations` validation observations (default: the Judge's own floor).
- otherwise `inconclusive`.

### Event (`ideaKind: event`, lane `ohlcv-event-study-lab`)

Evidence: the honesty envelope ([[docs/design/event-study-honesty-envelope]])
for the declared primary outcome.

- `supported` iff
  1. `N >= supportedIf.minEvents` (default 30);
  2. the Wilson interval lower bound is strictly above `claim.threshold`
     (default `0.5` for a rate; for a continuous outcome the declared quantile
     rule applies instead);
  3. `requireHalvesAgree` holds: both chronological halves have point estimates
     on the supported side of the threshold;
  4. the Event lane's own status is not `no-observed-advantage`.
- `refuted` iff `event-rate-ci-below-threshold-v1` fires: `N >= 10` and the
  Wilson **upper** bound is below the threshold. This is a stronger refutation
  than a point estimate and costs nothing in false confidence.
- `N < 10` is always `inconclusive` with reason `sample-withheld`.

### Strategy (`ideaKind: strategy`, lanes `ohlcv-portfolio-lab` or the
Factor-to-Portfolio desk)

Evidence: Portfolio Run net-of-cost validation Sharpe, PSR/DSR from the
research family, cost and delay stress, declared baseline (benchmark or
equal-weight reference already in the Study), and strategy-viability evidence.

- `supported` iff
  1. post-cost validation net Sharpe beats the declared baseline;
  2. DSR (selection adjustment) is at least `0.95` for the family's unique
     trials;
  3. the strategy-viability diagnosis is the positive stage
     (`post-cost-edge-positive`);
  4. PBO, **when computed**, is at most `0.5`. Until slice C ships, the ledger
     row is `not-computed`, the verdict carries the `pbo-not-computed` caveat,
     and the page says so in the verdict sentence. It is never shown as a pass.
- `refuted` iff `strategy-net-sharpe-not-positive-v1` fires: post-cost
  validation net Sharpe at or below `0.0` (default).
- otherwise `inconclusive`.

When `ruleSet` moves to `v2` (after PBO exists), `pbo` becomes a hard gate.

### Allocation, Book Risk, and Path Stress

Decided 2026-10-31: these lanes carry verdict rules too. They have no selection
loop, so there is no family search to correct; the claim is either a reference
comparison (Allocation) or a bound on a book the caller already specified
(Book Risk, Path Stress). Idea kinds: `allocation`, `book-risk`, `path-stress`.
The same rules still hold: refutation uses raw evidence only, `inconclusive`
is first class, and `supported` is development evidence.

Rule families (all in `hypothesis-verdict-rules-v1`):

- `fixed-reference-advantage-v1` for Allocation;
- `historical-bound-v1` for Book Risk and Path Stress.

#### Allocation (`ideaKind: allocation`, lane `ohlcv-allocation-lab`)

Falsifiable claims the lane can carry (only metrics the verified Run already
publishes may appear in `claim.metric`; the published list is the contract, see
[[docs/design/portfolio-native-allocation-lab]]):

- primary: `allocation.netSharpeAdvantage` greater than a threshold (default
  `0.0`): the fixed method (equal risk contribution) net of the declared costs
  against the caller's fixed-weight reference, over the validation split;
- risk-budget claims (for example realized annualized volatility below the
  caller's ceiling) only when the Run publishes the figure; otherwise the
  routing check answers `outcome-unsupported`.

Verdicts:

- `supported` iff
  1. observations at or above the lane's row floor;
  2. `netSharpeAdvantage` strictly above `claim.threshold`;
  3. both chronological halves have the same sign of advantage;
  4. the interval row is `pass`: the paired-return bootstrap interval for the
     advantage (Portfolio bootstrap CI, slice B) has a lower bound above zero.
- `refuted` iff `allocation-advantage-not-positive-v1` fires: validation
  `netSharpeAdvantage` at or below `0.0` on at least the floor of observations.
  Raw evidence only.
- otherwise `inconclusive`.

Until slice B publishes the interval, row 4 is `not-computed`, `supported` is
**capped**: the best verdict is `inconclusive` with reason
`interval-not-computed`, and the page says so. Refutation is not capped.
There is no DSR row: the lane has exactly one fixed method, so unique trials
are one by construction; `M` is still disclosed.

#### Book Risk (`ideaKind: book-risk`, lane `ohlcv-book-risk-lab`)

The claim is a **bound on a funded book the caller specified** over a declared
lookback (the book is a reported or hypothetical one; see
[[docs/design/reported-position-book-risk]] and
[[docs/design/executed-book-risk-compliance]]):

- `bookRisk.annualizedVolatility` at or below a declared ceiling;
- `bookRisk.maxDrawdown` (signed, non-positive) no worse than a declared floor;
- optionally the same bounds under each caller-authored scenario book.

Verdicts (`historical-bound-v1`):

- `supported` iff every declared bound held on the verified historical window,
  the complete-window count is at or above the lane floor, and both
  chronological halves also satisfy each bound.
- `refuted` iff any declared bound was breached on the raw verified window.
  A breach of a stated bound is a direct falsification and needs no
  statistics. This is the only family where a single raw figure refutes, and
  it is safe because the claim is a bound, not an effect estimate.
- otherwise `inconclusive` (for example history shorter than the lookback).

The supported sentence always reads `the bound held historically over this
window; this is not a forecast`. Book Risk has no search, so no DSR; `M` is
disclosed.

#### Path Stress (`ideaKind: path-stress`, lane `ohlcv-book-path-stress-lab`)

The claim is a bound on worst historical terminal loss over a fixed horizon
([[docs/design/reported-book-historical-path-stress]]): the primary metric
`worst_terminal_book_return` no worse than a declared floor (for example
`-0.12` over the declared horizon).

- `supported` iff the metric is at or above the floor, the complete-window
  count and the selected non-overlapping episode count meet the lane floors,
  and the first and second halves of the window set each respect the floor.
- `refuted` iff the metric is below the floor on the raw verified windows.
- otherwise `inconclusive`.

Same wording rule: a historical bound, not a forecast of future stress.

#### Ledger rows these lanes add

See [The check ledger](#the-check-ledger): `reference-advantage`, `bound-held`,
`window-coverage`. All other rows apply as listed (sample size, stability
halves, reproducibility, criteria integrity, holdout and sealed-tail status).

### Multiplicity across Hypotheses

Per-family trial counting already prevents hiding variants of one idea. It does
not count *ideas*. A Project that tests 20 Hypotheses and reports the best one
has the same selection problem one level up.

Core derives `projectHypothesisCount = M` as the number of non-`untestable`
Hypotheses in the Project that have at least one bound Run, plus `dropped`
ones that had bound Runs. Drafts that never ran do not count; ideas abandoned
after trials do.

- Factor: the multiplicity row requires `min(1, adjustedP x M) <= 0.05`.
  Bonferroni needs no independence assumption and is conservative, matching
  the existing choice in [[docs/design/selection-adjusted-research-evidence]].
- Event: the Wilson level is widened to `1 - 0.05 / M` for the `supported`
  gate only; the displayed 95% interval stays as published.
- Strategy: DSR is computed per family as now; the ledger adds a disclosed
  `M` and a note, but V1 does not recompute DSR across families (the trial
  dispersion across unrelated Studies has no defensible meaning). Owner
  confirmation (2026-10-31, Q4): many Hypotheses flow through one Project
  pipeline, so Core **discloses `M` and the family-wise effect on every
  verdict page and does not pool DSR across families**. The disclosure is
  concrete, not a footnote: the ledger row `multiplicity` shows `M`, the
  Bonferroni-adjusted level that Factor and Event gates used, and for Strategy
  the number of families whose best DSR was hidden by the choice of the
  reported one. This is the weakest cell of the design; it is a known gap,
  not an open question.
- Allocation, Book Risk, Path Stress: no family search exists, so there is no
  adjustment; `M` is disclosed only. Because the owner's rule is one
  Hypothesis per dedicated Project ([Idea umbrella](#idea-umbrella-components-and-incremental-hypotheses)),
  `M` inside a single Project is normally 1, and the cross-Project count is
  carried by the idea record, which discloses its own component count.

M is shown on every verdict page. It is not a gate by itself.

## Sealed tail (hidden confirmation segment)

Decided 2026-10-31. The Shinka fork physically carves the last slice of the
data into a lockbox before any experiment exists and opens it once per
direction. AutoQuant has no such tier today: its visible test split is an
audit, and its only confirmation is the strictly-later external holdout, which
needs new data to exist. The sealed tail adds a **same-vintage, pre-registered,
one-shot confirmation** that is available immediately.

### Intake and storage

`aq project intake` gains `--sealed-tail FRACTION` (default `0.2` when the flag
is given without a value). The fraction is fixed in the Project at intake and
cannot change.

- The split is by time, at one common timestamp `T` for every asset: the
  development panel ends at the last timestamp not after `T`, and every later
  timestamp belongs to the tail. A panel is never cut per asset.
- Intake refuses the flag when the tail would have fewer than 120 rows (the
  smallest lane floor, [[docs/design/frozen-external-holdout-challenge]]).
  `aq hypothesis route` later warns `sealed-tail-below-lane-floor` when the
  tail is below the declared lane's own floor, before the criteria freeze.
- The tail bytes go to a **Workspace-level sealed store outside every Project**:
  by default `<user data dir>/autoquant/sealed/<workspace-id>/<project-id>/`,
  overridable with `AUTOQUANT_SEALED_DIR`. It is never inside the Workspace
  root, no Core reader lists it, and the normalized bytes use the same format
  as the intake snapshot.
- The Project records only a state block, never data:

```json
{
  "schemaVersion": 1,
  "kind": "autoquant-sealed-tail",
  "fraction": 0.2,
  "devRows": 1008,
  "devEndTimestamp": "2024-12-31T00:00:00Z",
  "tailRows": 252,
  "tailHash": "sha256:...",
  "storeKey": "...",
  "sealedAt": "2026-11-01T00:00:00Z",
  "state": "sealed"
}
```

- Dev snapshot write, sealed-store write, and the state block are one
  transaction, reusing the transactional intake and rollback machinery
  ([[docs/design/research-intake-and-dataset-snapshots]]). Re-running intake
  into a Project that already has the block is refused, and so is a different
  fraction.
- Studies, Sessions, and Runs never receive the tail: the dataset identity of a
  Study covers development rows only, and every Run records
  `execution.sealedTail = { tailHash, state: "sealed" }` so a reader can see the
  tail existed and was not used.

State machine of the tail itself:

```text
absent -> sealed -> opened -> confirmed | unconfirmed
                      |
                      +--> unconfirmed (reason: interrupted)   # opened, no result
```

### Opening: `aq hypothesis confirm`

```text
aq hypothesis confirm <path> --id HID --open-sealed-tail [--project ID] [--json]
```

The explicit flag is required, like the other one-shot operations; Core cannot
authenticate the owner, so it records the claim and the Skill tells the Agent
to ask the owner first. Preconditions, all checked fail-closed:

1. the Hypothesis latest verdict is `supported` and was recorded (`--record`)
   against the current `criteriaHash`; no later revision exists;
2. no Session is running and none starts afterwards (like holdout, Session
   start is unavailable once the tail is open);
3. the tail state is `sealed` and the store file hashes to `tailHash`;
4. the registry in the sealed store shows the `tailHash` was never opened
   before (see reuse below).

Procedure, in order, atomic per step:

1. **Freeze**: write `confirmations/<cid>/pending.json` with the criteria hash,
   candidate source closure hashes, Harness identity, `M` and unique-trial
   counts, rule version, and `tailHash`.
2. **Mark opened**: set the tail state to `opened` and write the opened marker
   in the sealed-store registry. This happens before any candidate runs.
3. **Evaluate once** with the existing fixed Judges on the tail via the holdout
   machinery (below).
4. **Write the immutable result** and derive the tier.

If the process dies after step 2, running confirm again returns `unconfirmed`
with reason `interrupted` and **never re-evaluates**. This is the Shinka
interrupt rule.

Reuse of the external-holdout machinery (do not build a second one):

| Holdout machinery | Reused for the tail |
| --- | --- |
| atomic `create-target` with imported exact frozen source bytes and hashes | same, from the verdict evidence Run closure |
| strictly later, non-overlapping dataset proof | holds by construction: the tail starts after `devEndTimestamp` |
| target has no Runs, Sessions, Reports | an ephemeral confirmation target is created and is never reused |
| one-shot fixed Judge execution, repeat returns the stored result | same |
| immutable result with `candidateFrozen=true`, `selectionAllowed=false`, `automaticPromotion=false`, `tradingAuthority=none` | same, with `evaluationRole=sealed-tail-confirmation` |

Two differences need design work and are implementation steps:

- the holdout binding today requires a source Dossier. The tail binds a
  **Hypothesis plus its verdict evidence Run closure** instead, so Event,
  Allocation, Book Risk, and Path Stress Hypotheses (which have no editable
  candidate or Dossier lane) can be confirmed by re-running the fixed Study on
  the tail dataset;
- the tail has no warm-up history before its first row (the same property as
  the holdout target), so the lane floors apply to tail rows alone.

### Confirmation rules (`hypothesis-confirmation-rules-v1`)

Pure functions of the frozen criteria and the one tail result. No Agent input,
no clock, no randomness. The same gates as the development rule apply to the
tail evidence **except the selection-adjustment rows**: nothing was searched on
the tail, so `selection-adjusted` and `noise-frontier` are `n.a.`. The frozen
`M` still widens the multiplicity gate.

| Kind | `confirmed` iff |
| --- | --- |
| factor | tail observations at or above the floor; mean rank IC in the declared direction at or above `claim.threshold`; HAC p at or below the frozen adjusted level; both tail halves have the declared sign |
| event | tail events at or above `minEvents`; Wilson lower bound above `claim.threshold` at the frozen level; halves agree |
| strategy | tail observations at or above the floor; post-cost net Sharpe above the declared baseline and above zero; PSR on tail returns at or above `0.95` |
| allocation | the Allocation rule applied to the tail (interval row required) |
| book-risk, path-stress | every declared bound holds on the tail windows |
| incremental | the incremental rule applied to the tail |

Anything else is `unconfirmed`, with one machine-readable reason:
`tail-contradicts` (effect has the wrong sign or a bound was breached),
`tail-underpowered` (below floor, withheld estimate), `interrupted`, or
`tail-reused`. `unconfirmed` is not `refuted`: the development verdict is not
rewritten. The tail never feeds selection.

### Composition with the external holdout

Both can exist for one idea and answer different questions:

| Tier | Data | Question | Needs |
| --- | --- | --- | --- |
| development | validation split | does it hold in the search window? | nothing |
| sealed tail | last fraction of the same vintage, sealed at intake | does the frozen candidate hold on data nobody searched, same period? | `--sealed-tail` at intake |
| external holdout | strictly later external dataset | does it persist forward in time? | later data and a Dossier ([[docs/design/frozen-external-holdout-challenge]]) |

Order: development, then sealed tail, then external holdout. A sealed-tail
`confirmed` does not satisfy the holdout, and the holdout Assessment labels
(`persists`, `mixed`, `weakens`, `inconclusive`) stay separate fields on the
page.

### What Studio shows

- Before opening: a `Sealed tail` card with state `sealed`, fraction, `tailRows`,
  development end date, short hash, and the sentence `never opened`. No tail
  date range, no figures, and no placeholder numbers. The ledger row
  `sealed-tail` is `withheld`.
- After opening: the tier text, the tail dates, and the confirmation ledger
  (values, thresholds, reason codes), once the immutable result exists. While
  `pending` or `interrupted`, only the state is shown.
- Filtering is server side. The tail result is omitted from JSON until its
  immutable record exists, as for holdout numbers.

### Reuse, peeking, and what this is not

- **Not a sandbox.** The sealed store is a path convention outside the Project
  and Workspace. An Agent with filesystem access could read it, and so could
  the owner's staging file that was handed to intake. Sealing protects against
  accidental use by Studies, Sessions, Runs, and Agents that follow the Skill.
  For an adversarial setting the owner should keep the tail offline (open
  question 13).
- **Reuse after a failed confirmation is impossible by construction**: the
  registry marks `tailHash` opened. Recreating a Project over the same data
  yields the same `tailHash`, the confirm step refuses with `tail-reused`, and
  the Studio shows that a previous Project already spent the tail.
- **Shape leakage**: the visible facts are the fraction, row count, and
  development end date. They reveal how much was held back, not what it
  contains. The tail dates stay hidden until opening, though the market's
  public history cannot be hidden from anyone who knows it.
- **Retroactive sealing** is refused for any Project that already has a Run or
  Session, because the Agent has already seen the data. The owner re-intakes
  into a new Project instead.

## Idea umbrella, components, and incremental Hypotheses

Decided 2026-10-31: **one Hypothesis per dedicated Project.** Reasons that are
already true of the machinery: the criteria hash and the research family are
Project-scoped, the sealed tail is carved per Project, a holdout target is a
Project, and a Project is self-contained. A Project may still *list* several
Hypotheses (the checks above work), but the supported workflow is one idea
bench per Project. (The forward holdout target remains a separate Project made
from this one by `aq holdout create-target`.)

A real idea is often a bundle. The owner's first use case is a
TradingView-style context indicator. One Hypothesis cannot be falsified
meaningfully for a bundle, so the bundle is decomposed.

### The idea record

A bundle needs one place that spans Projects. Core already requires a Project
to be self-contained, so the cross-Project link lives at the **Workspace**:

```text
<workspace>/ideas/<idea-id>/idea.json      # authored; append-only revisions
```

```json
{
  "schemaVersion": 1,
  "kind": "autoquant-idea",
  "id": "idea-0001-context-indicator",
  "revision": 1,
  "text": "A context indicator (structure, zones, trend, volume, VWAP, pivot, PO3) helps judge direction.",
  "components": [
    {
      "key": "c1-structure",
      "project": "ctx-c1-structure",
      "hypothesis": "hyp-0001-structure-state",
      "criteriaHash": "sha256:...",
      "role": "component"
    }
  ],
  "ladder": [
    { "key": "i1", "project": "ctx-i1", "hypothesis": "hyp-0001-added-volume", "criteriaHash": "sha256:...", "role": "incremental" }
  ],
  "preregistered": { "ladderFixedAt": "2026-11-01T00:00:00Z" },
  "authority": { "tradingAuthority": "none" }
}
```

Why a new object: Projects are self-contained, so no Project can hold a link to
sibling Projects without breaking that rule, and the graveyard needs the
relation between a bundle and its parts. Each link pins `criteriaHash`, so a
link cannot silently point at a revised Hypothesis. Core derives the rollup;
nothing is authored:

- `idea-rollup-v1` is a **table, never a scalar score**: each component with its
  verdict and tier, each incremental step with its verdict, the component
  count `K`, and `K` as the idea-level multiplicity. No averaging, no weights.
- `the bundle holds` is a statement only when an **incremental Hypothesis for
  the bundle** is `supported`. Many `supported` components do not imply it.
- An idea whose components are `untestable` shows that, with reason codes.

### One Hypothesis per component

Worked example. The own-model components are `P` designs from the owner's
spec, not vendor formulas, and are tested as daily-bar translations. Statements
about the vendor's private indicators are not testable and are not made. The
horizon and base interval are part of each Hypothesis, and a daily result does
not transfer to a 15-minute chart.

| Key | Component (own model) | Daily-bar translation | `ideaKind` | Lane | Testable now |
| --- | --- | --- | --- | --- | --- |
| c1 | Major and Minor structure break | signed score from the last confirmed break direction, confirmed at the close | factor | `ohlcv-factor-lab` | yes |
| c2 | Order-block zone proximity | signed distance to the nearest active zone in ATR units, capped | factor | `ohlcv-factor-lab` | yes |
| c3 | Three-layer trend state | ATR-trailing model states mapped to a signed ordinal | factor | `ohlcv-factor-lab` | yes |
| c4 | Volume spike | ratio to a 20-bar baseline times the sign of the bar | factor | `ohlcv-factor-lab` | yes |
| c5 | Anchored VWAP deviation | z-score of close against a session or weekly anchored VWAP | factor | `ohlcv-factor-lab` | yes |
| c6 | Pivot and CPR position | close relative to the prior completed period's CPR | factor | `ohlcv-factor-lab` | yes |
| c7 | PO3 stage | accumulation, manipulation, expansion mapped to a signed score at confirmation | factor | `ohlcv-factor-lab` | yes |
| c8 | Zone-touch bounce, structure-break continuation | conditional event rates | event | `ohlcv-event-study-lab` | no: `event-definition-unsupported` (the Event lane evaluates the fixed gap-event definition; new definitions are slice F) |
| c9 | CVD and open interest | needs trade-side and OI data | factor | none | no: `data-non-ohlcv` |
| c10 | Macro slots | needs external series intake | factor | none | no: `data-non-ohlcv` |
| c11 | The bundle as a rule (long when at least `k` components agree, costs included) | fixed rule over c1 to c7 | strategy | `ohlcv-portfolio-lab` | yes, after the components exist |

The accountable factor claim for c1 to c7 is the Factor lane's own claim
(forward return rank IC at the declared horizon), so every component inherits
the research-family and multiplicity machinery for free. A component that is
`untestable` stays in the idea record as an honest gap; it is not silently
dropped, and it is not scored.

### Incremental Hypotheses (ablation)

`ideaKind: incremental` answers: **does component B add value over component A
and a baseline?** It is not a new lane. It is a fixed comparison Study built
from two frozen candidates:

```json
{
  "ideaKind": "incremental",
  "statement": "Adding the volume-spike score to the structure score raises validation rank IC.",
  "incremental": {
    "base":  { "project": "ctx-c1-structure", "hypothesis": "hyp-0001-structure-state", "criteriaHash": "sha256:..." },
    "added": { "project": "ctx-c4-volume",    "hypothesis": "hyp-0001-volume-spike",    "criteriaHash": "sha256:..." },
    "combiner": "equal-weight-zscore-sum-v1",
    "baseline": "zero",
    "mode": "forward-addition"
  },
  "claim": { "direction": "above", "metric": "incremental.deltaRankIc", "threshold": 0.0 }
}
```

Mechanics:

- the incremental Project imports the exact frozen candidate sources of both
  components (hash-verified, the holdout import pattern) onto the **same dataset
  identity and horizon**; mismatched dataset hash or horizon is `untestable`
  with `incremental-inputs-mismatch`;
- three candidates run on identical data: `base` (A), `combined` (A and B
  through the **fixed combiner, no fitted weights**, so there are no extra
  degrees of freedom), and the declared baseline;
- the metric is the paired difference `metric(combined) - metric(base)` over the
  validation split. For Factor it is the per-date rank IC difference taken from
  each Run's `daily-factor-evidence.csv`
  ([[docs/design/factor-diagnostics]]), with a HAC interval on the mean
  difference. For Strategy it is the post-cost net Sharpe difference with a
  paired bootstrap interval (slice B); the Factor path needs no new lane
  authority, and the Strategy path needs per-period net returns in the Portfolio
  artifacts, which is verified at implementation (step H15) and added as a
  Judge extension if absent.

Verdicts (`incremental-paired-v1`):

- `supported` iff both inputs share dataset and horizon; observations at or
  above the floor; mean difference above `claim.threshold`; the interval lower
  bound above zero at the level adjusted for the number of incremental steps
  in the idea ladder; both chronological halves agree in sign; and `combined`
  is not worse than the baseline;
- `refuted` iff the mean difference is at or below `0.0` on raw evidence with
  at least the floor of observations;
- otherwise `inconclusive`. The Strategy path is capped at `inconclusive`
  (`interval-not-computed`) until slice B ships.

Order effects are guarded by **pre-registration**: the idea record fixes the
ladder (forward addition order, or leave-one-out) before the first incremental
Hypothesis runs (`preregistered.ladderFixedAt`), and every step is a separate
Hypothesis whose count enters the idea-level multiplicity. A ladder edited
after evidence arrived is flagged like `loosenedAfterEvidence`.

## The check ledger

One row per check. Every row carries a state, a value, a threshold, its source
(an evidence path, like `evidenceRefs` in the research agenda), and a role.

States: `pass`, `fail`, `n.a.` (not applicable to this idea kind), `withheld`
(the evidence exists but visibility rules hide it, or the sample guard
withholds the estimate), `not-computed` (the method is not implemented in this
release; never faked).

| Row id | Applies to | Role | Source |
| --- | --- | --- | --- |
| `sample-size` | all | gate | observations or events vs floor |
| `effect-vs-claim` | all | gate | primary metric against `claim.threshold` |
| `interval` | event (Wilson), factor (HAC t), strategy (PSR) | gate | envelope or Run stats |
| `family-trials` | all | context | research family: unique, failed, executions |
| `selection-adjusted` | factor, strategy | gate | `selectionAdjustment` (HAC x N, DSR) |
| `noise-frontier` | strategy | context | expected maximum Sharpe of N noise trials |
| `multiplicity` | factor, event (gate); strategy, allocation, book-risk, path-stress, incremental (disclosure only) | gate or context | M, the adjusted level, and for an idea the component count K |
| `pbo` | strategy | gate when computed | slice C; `not-computed` until then |
| `stability-halves` | factor (folds), event (halves), strategy (halves) | gate | chronological split |
| `per-year` | event, strategy | context | per-year counts and signs |
| `baseline` | strategy, event | gate | benchmark, matched reference, or known style |
| `cost-adjusted` | strategy | gate | net of cost, turnover, cost drag, delay stress |
| `visible-test-audit` | factor, strategy | audit | test split; never a gate; shown only after a verdict exists |
| `holdout-status` | all | context | `none`, `bound`, `run`, then the Assessment label |
| `reproducibility` | all | gate | Harness identity, source/data/Judge hashes, verified load |
| `criteria-integrity` | all | gate | frozen hash matches; revision count; `revisedAfterFirstRun`; `loosenedAfterEvidence` |
| `reference-advantage` | allocation, incremental | gate | `netSharpeAdvantage` against the fixed-weight reference, or the paired delta of an incremental step; interval row `not-computed` until slice B for Strategy-path deltas and Allocation |
| `bound-held` | book-risk, path-stress | gate | each declared bound (volatility ceiling, maximum drawdown floor, worst terminal return floor) against the verified window, with the margin |
| `window-coverage` | book-risk, path-stress | gate | complete windows and selected episodes against the lane floors |
| `sealed-tail` | all with a sealed tail | context, then gate for tier | state `none`, `sealed` (withheld), `opened`, then `confirmed` or `unconfirmed` with reason codes; the only row that can set the confirmation tier |

Notes:

- `noise-frontier` is context, not a gate: DSR already encodes the same
  threshold; the row exists to make the correction visible. For Factor
  objectives (rank IC) AutoQuant has no null-trial formula, so the row is
  `n.a.` there rather than inventing one.
- `visible-test-audit` follows the visibility rule below.
- `criteria-integrity` is a gate because a Hypothesis whose revision changed
  after its evidence arrived cannot be `supported` (rule 4 of revision
  lineage).

### Visibility rules (server side)

Following the existing discipline in
[[docs/design/studio-research-decision-brief]] and Shinka's `ui.snapshot`,
filtering happens in Core when the page payload is built, never in the
browser:

1. Selection (validation) values are always allowed.
2. Visible test values appear only in `visible-test-audit`, only when a
   verdict has been computed, and are labelled `diagnostic audit`.
3. Holdout numbers appear only after the immutable holdout result exists, and
   are labelled with the Assessment label. Before that the row shows state
   only (`none` or `bound`).
4. While the verdict is not yet computable, rows that would reveal a verdict by
   themselves (adjusted p, DSR) are shown as `pending` with no value.
5. Hidden values are omitted from the JSON, not sent and hidden.
6. Sealed-tail values follow the holdout rule: while the tail state is
   `sealed`, `opened` without an immutable result, or `interrupted`, the
   page and the JSON carry the state only. Tail dates, rows beyond the
   recorded count, and every figure appear only after the immutable
   confirmation result exists.

## Routing and untestable ideas

| Idea kind | Lane (template) | Typical statement | Verdict support |
| --- | --- | --- | --- |
| `factor` | `ohlcv-factor-lab` (or the desk) | "20-day reversal predicts next-week returns across these assets" | Factor rules |
| `event` | `ohlcv-event-study-lab` | "After a -5% gap NVDA beats SPY over 5 bars" | Event rules |
| `strategy` | `ohlcv-portfolio-lab`, or `ohlcv-research-desk` when Factor evidence must feed it | "Trade this factor with these constraints after costs" | Strategy rules |
| `allocation` | `ohlcv-allocation-lab` | "ERC beats my fixed weights on a net-Sharpe basis" | Allocation rules (`supported` capped until the interval exists) |
| `book-risk` | `ohlcv-book-risk-lab` | "This book stays under 15% annualized volatility and a -20% drawdown" | Book Risk bound rules |
| `path-stress` | `ohlcv-book-path-stress-lab` | "The worst 20-day terminal loss of this book is no worse than -12%" | Path Stress bound rules |
| `incremental` | `ohlcv-factor-lab` (Factor path) or `ohlcv-portfolio-lab` (Strategy path), fixed comparison Study | "Adding the volume score to the structure score raises validation rank IC" | Incremental paired rules |

An idea no lane can test gets `untestable`, not a manufactured result. The
routing check returns reason codes and what would unblock it:

| Reason code | Meaning | `unblockedBy` |
| --- | --- | --- |
| `data-interval-unsupported` | needs bars finer than the lane evaluates (the Event lane is daily-session only) | a lane that evaluates the finer bars; none exists for events today |
| `data-non-ohlcv` | needs fundamentals, order book, flows, news | external data intake not available |
| `needs-event-calendar` | conditioning on macro or earnings dates | event calendar data (reference inventory slice F) |
| `needs-execution-model` | depends on order-level behavior or fills | out of AutoQuant scope (no orders) |
| `universe-too-small` | for example three decision assets for a cross-sectional claim | change the basket |
| `history-too-short` | below the lane's row floor | more data |
| `outcome-unsupported` | outcome has no lane metric | none in this release |
| `no-falsifiable-claim` | no `claim` can be stated | rewrite the idea |
| `event-definition-unsupported` | the conditional event is not the Event lane's fixed definition (for example a zone touch or a structure break) | new event definitions (reference inventory slice F) |
| `incremental-inputs-mismatch` | the two component Hypotheses differ in dataset hash or horizon, or one is not frozen | align both on one dataset and horizon |
| `sealed-tail-below-lane-floor` | caveat, not a refusal: the tail has fewer rows than the declared lane's floor, so confirmation would be underpowered | more data or a larger fraction at intake |

`untestable` is a framing result with an owner-visible reason, not a verdict.
It is kept in the graveyard so the same dead end is not rediscovered.

## CLI

New command group, discoverable through `aq capabilities` and covered by
`docs/CLI`:

```text
aq hypothesis add <path> --idea TEXT [--from-request N] [--kind factor|event|strategy|allocation|book-risk|path-stress|incremental] [--project ID] [--json]
aq hypothesis route <path> --id HID [--project ID] [--json]        # route + testability check
aq hypothesis freeze <path> --id HID [--project ID] [--json]
aq hypothesis revise <path> --id HID [--accept-loosening] [--project ID] [--json]
aq hypothesis show <path> --id HID [--project ID] [--json]          # frozen criteria + derived status + ledger
aq hypothesis list <path> [--project ID] [--status S] [--json]
aq hypothesis verdict <path> --id HID [--record] [--project ID] [--json]
aq hypothesis drop <path> --id HID --reason TEXT [--project ID] [--json]
aq hypothesis search <path> [--text T] [--kind K] [--asset A] [--verdict V] [--json]
aq hypothesis confirm <path> --id HID --open-sealed-tail [--project ID] [--json]   # one-shot, owner-gated
aq project intake ... --sealed-tail [FRACTION]                                       # carve the tail at intake
aq idea add <workspace> --text TEXT [--json]
aq idea link <workspace> --idea ID --project P --hypothesis HID --role component|incremental [--json]
aq idea ladder <workspace> --idea ID --mode forward-addition|leave-one-out [--json]   # pre-registers the ladder
aq idea show <workspace> --idea ID [--json]                                          # derived rollup table
aq idea list <workspace> [--json]
aq session start ... --hypothesis HID
aq run ... --hypothesis HID
```

Every command is read-only except `add`, `freeze`, `revise`, `verdict
--record`, and `drop`, which write only under `hypotheses/`. `aq hypothesis
show --json`:

```json
{
  "schemaVersion": 1,
  "kind": "autoquant-hypothesis-status",
  "id": "hyp-0003-...",
  "revision": 1,
  "status": "challenged",
  "criteriaHash": "...",
  "lane": "ohlcv-event-study-lab",
  "ruleSet": "hypothesis-verdict-rules-v1",
  "verdict": {
    "label": "inconclusive",
    "tier": "development",
    "reasonCodes": ["sample-below-minimum"],
    "sentence": "18 qualifying events; the estimate is withheld below 30 events."
  },
  "ledger": [ { "check": "sample-size", "role": "gate", "state": "fail", "value": 18, "threshold": 30, "sourcePath": "/envelope/primary/n" } ],
  "multiplicity": { "projectHypothesisCount": 3, "method": "bonferroni" },
  "caveats": ["pbo-not-computed", "holdout-not-run"],
  "nextActions": [ { "command": "aq run ... --hypothesis hyp-0003-...", "why": "more events needed" } ]
}
```

### Agent Work Brief

`aq orient` already returns `agentWorkBrief` with `primaryAction`, `focus`,
and `researchAgenda`. It gains an optional `hypothesis` block when exactly one
Hypothesis is in `framed` or `running`, and a `hypotheses` summary list
otherwise: status counts, the next required action per Hypothesis (freeze,
bind a Session, run, record a verdict), and the multiplicity count. No new
brief authority: the block is `diagnostic-only` like the agenda.

The research agenda's `moves[].hypothesis` strings stay as candidate-iteration
guidance inside a Session. They are micro-experiments; a Hypothesis is the
owner-level idea they serve. When a Session is bound to a Hypothesis, each move
shows the Hypothesis id.

### Bundled Skill: `frame-hypothesis`

Added to the bundled Skills in `autoquant/workspace_skills/` and materialized
into both Agent discovery roots. The Agent workflow:

1. **Capture** the owner's rough sentence verbatim in `idea`.
2. **Classify** into `ideaKind`; run `aq hypothesis route`. If `untestable`,
   report the reason codes and stop; do not bend the idea to fit a lane.
3. **Draft** `statement`, `mechanism`, `claim`, and the default rules and
   thresholds. Use published defaults; do not invent thresholds.
4. **Ask the owner only** for decisions that change meaning and cannot be
   defaulted from the Project: the direction when ambiguous, the universe or
   horizon when the request does not fix them, any non-default threshold, and
   "what result would make you drop this?" (it becomes `refutedIf`).
5. **Freeze** only after those answers; record `criteria: caller-specified`
   when any default was overridden.
6. **Run** through the lane; do not edit criteria while evidence arrives.
7. **Report**: quote the Core verdict sentence verbatim; the Agent may add
   interpretation but may not restate a different verdict.

Worked example. Owner: "I think stocks that gap down hard bounce." The Agent
classifies `event`, asks only which asset(s) and what "hard" means (default
suggestion: -5%) and what bounce horizon (default: 5 bars), freezes with
default `supportedIf`/`refutedIf`, runs the Event lane, and quotes the verdict.

## Read model and Studio

### API

- `GET /api/v1/project?id=` gains `hypotheses`: an array of summaries (`id`,
  `revision`, `idea`, `ideaKind`, `status`, `verdict.label`, `tier`,
  `criteriaHash`, `updatedAt`) and `projectHypothesisCount`. Projects without
  Hypotheses return an empty array and a `hypothesisState: "none"` marker.
- `GET /api/v1/hypothesis?project=&id=` returns the full page payload shown
  above plus the trial series for the noise-frontier chart and the timeline.
  It uses the same fingerprint cache and ETag as the other routes; its
  fingerprint also covers `hypotheses/**`.
- Both are read-only; visibility rules above are applied when building.

### Verdict page layout

The page follows the argument order, as the Shinka report page does:
idea and criteria, then trials and noise frontier, then the check ledger, then
the verdict and holdout state, then the timeline. On wide screens the verdict
column sits to the right; narrower, it follows the ledger.

```text
+---------------------------------------------------------------------------+
| Projects / nvda-event / Hypotheses / hyp-0003 gap-down reversal           |
+---------------------------------------------------------------------------+
| IDEA   "Stocks that gap down hard bounce."            kind: event         |
| CLAIM  NVDA beats SPY over 5 bars after a -5% gap, rate > 50%            |
| SUPPORTED IF  Wilson low > 50%, N >= 30, both halves agree               |
| REFUTED IF    Wilson high < 50%, N >= 10        criteria: default  r1  #ab12|
+------------------------------------------------+--------------------------+
| TRIALS AND NOISE FRONTIER                       | VERDICT                  |
|  Sharpe                                         |  INCONCLUSIVE            |
|   2 |            .  record                      |  development evidence    |
|     |       . ____.-----   <- best so far       |  18 events; estimate     |
|   1 |   .  /                                    |  withheld below 30.      |
|     | - - - - - - - - - - noise line (N=7)      |  Not a refutation.       |
|   0 +----------------------------> trial order  |                          |
|  filled = ok  hollow = failed  dashed = noise   |  HOLDOUT  not run        |
+------------------------------------------------+  CAVEATS pbo-not-computed |
| CHECK LEDGER                                    |  MULTIPLICITY  M = 3     |
|  check             result     threshold  state  +--------------------------+
|  sample size       18         >= 30      FAIL   | Reproducibility  pass    |
|  rate vs claim     withheld   > 50%      --     | Criteria integrity pass  |
|  interval          withheld   low > 50%  --     |                          |
|  stability halves  n.a.       agree      --     |                          |
|  selection adj.    n.a.       <= 0.05    --     |                          |
|  holdout           none                         |                          |
+------------------------------------------------+--------------------------+
| TIMELINE  frozen r1 | Run 1 | Run 2 | verdict record | (dropped?)          |
+---------------------------------------------------------------------------+
```

`INCONCLUSIVE` has the same type size and prominence as `SUPPORTED` and
`REFUTED`; it is not a muted fallback. State is carried by text and by a
shape (filled check, cross, dash, hollow circle), never by colour alone.

### Noise-frontier chart spec

Available for objectives measured in Sharpe (Strategy kind). For Event and
Factor it renders trials only, with the note `noise frontier not defined for
this objective`.

- **x**: trial order, the unique source trials of the research family sorted by
  Run completion time. Failed trials get a hollow marker on the axis.
- **y**: validation objective in annualized units (net Sharpe), same units as
  the selection adjustment.
- **dots**: each successful unique-source trial's value.
- **step line**: running best (record frontier).
- **dashed line**: the expected maximum Sharpe of `k` noise trials, evaluated at
  each prefix `k >= 2` by calling the same function the selection adjustment
  uses (`expected_maximum_sharpe` in `autoquant/selection.py`) on the first `k`
  successful trial Sharpes, then annualized. The line rises as trials grow, so
  "the more you try, the higher the bar" is visible.
- **marker**: the selected record, drawn with a distinct shape and labelled with
  its gap to the final dashed value. When the record is below the line, the
  caption reads `record does not clear what N noise trials would produce`.
- All values come from the Core payload; the browser draws, never computes.
  Pointing or arrow-key stepping shows the trial's source hash prefix, Run id,
  and value.

The dashed line is a projection of existing math; it requires no new
statistics, only exposing the per-prefix series.

## Idea graveyard

Every Hypothesis lives in the Project's Git history, so the graveyard needs no
new store. It is a **derived Workspace-level index**: `aq hypothesis search
<workspace>` walks the one-level Project discovery already used by `aq project
list`, reads `hypotheses/*/` and their Verdict Records, and returns structured
entries:

```json
{
  "id": "hyp-0003-...", "project": "nvda-event",
  "idea": "...", "ideaKind": "event", "assets": ["NVDA"], "horizon": "5d",
  "status": "refuted", "verdict": "refuted", "tier": "development",
  "keyNumbers": { "n": 44, "uniqueTrials": 1 },
  "reasonCodes": ["ci-below-threshold"], "droppedReason": null,
  "decidedAt": "2026-11-02T00:00:00Z"
}
```

`aq hypothesis add` prints a **prior-attempt check**: structured matches by
asset overlap, idea kind, and horizon, plus lexical overlap of the statement.
This is deliberately not semantic search; it lists candidates a human or Agent
reads. Matching is advisory and never blocks.

Ideas persist forever, including `untestable`, `dropped`, `refuted`, and
`inconclusive`, because a failed idea's trials already count toward M and the
next researcher should not redo it blind. A free-text knowledge library (raw
sources compiled into linked pages, Shinka's P4) is slice E and is not part of
this design.

## Failure modes and anti-overfitting

| Failure mode | Defense | Residual risk |
| --- | --- | --- |
| Criteria shopping: edit thresholds until the result passes | frozen hash; criteria never reset the family; evidence only counts for the revision it was bound to; `revisedAfterFirstRun` and `loosenedAfterEvidence` caveats; loosening caps at `inconclusive` | an owner can still choose weak defaults before the first run; the page shows `criteria: caller-specified` |
| Many ideas, best one reported | M counts ideas with bound Runs, including dropped ones; multiplicity gate and display | Strategy-kind DSR is not recomputed across families (decided, Q4); `M` is disclosed |
| Post-hoc rewriting of the statement | statement is inside the hash; a different statement is a new revision with lineage | wording that is vague but frozen; `no-falsifiable-claim` guard helps |
| Agent self-grading | no setter for verdict status; verdict computed by Core; Verdict Record is a pure function of frozen evidence; Report prose cannot overwrite it | an Agent may still select which Hypotheses to create; M and the graveyard make that visible |
| Reusing the visible test split as confirmation | test is `audit` only, never a gate; only the external holdout confirms; `supported` always says "development evidence" | owners may over-read the audit row; its label says diagnostic |
| Holdout reuse | holdout stays Project/Dossier-level and one-shot; the Hypothesis page shows its state and never re-runs it | per-Hypothesis holdouts need one Hypothesis per Project, which is now the supported workflow (decided, Q6) |
| Silent method gaps | rows are `not-computed` or `n.a.` with reasons; PBO is never faked | the verdict sentence must carry the caveat so it is not skimmed away |
| Dropping failed ideas to avoid M | dropped-with-runs still count in M | an idea dropped before any run does not count; that is the intended boundary |
| Peeking at the sealed tail (filesystem, staging file) | the tail is outside the Project and Workspace, never listed by Core, hash-only in the Project; Studies, Sessions, Runs never receive it; every Run records the tail as `sealed` and unused | not a sandbox: an Agent or owner with disk access can read it (open question 13); the owner may keep the tail offline |
| Shape leakage of the tail | only fraction, row count, and development end date are visible; tail dates hidden until open | the market's public history is public |
| Reusing the tail after a failure | opened marker written before evaluation; interrupted runs are `unconfirmed (interrupted)` and never re-evaluate; the registry marks `tailHash` spent | recreating the Project over the same data is detected as `tail-reused` by hash |
| Re-running intake to reseal | an existing state block makes intake refuse, and so does a different fraction; retroactive sealing is refused when Runs or Sessions exist | a brand-new dataset is a brand-new tail, by design |
| Ablation order shopping | ladder pre-registered in the idea record; every step is a Hypothesis; K enters the idea-level multiplicity | an owner can still pick a convenient ladder before the first run; the page shows it |
| A bundle claimed as holding because parts passed | `idea-rollup-v1` is a table, no score; `the bundle holds` requires a `supported` incremental Hypothesis for the bundle | parts that are `untestable` show as gaps |
| Independent challenge missing | an Independent Research Review can be attached to a verdict; the page shows review count and its governed status | optional, not required |

## Migration and compatibility

- A Project with no `hypotheses/` directory loads and verifies exactly as now.
  The Studio verdict section shows `No Hypothesis in this Project` with the
  command to add one; Project pages and all existing lanes are unchanged.
- New files are strict `schemaVersion: 1`. Unknown fields are rejected, as
  everywhere else in AutoQuant.
- The Run `execution.hypothesis` field is optional. Readers that do not know it
  ignore only because the Run schema is versioned; the Run schema version bump
  is a design decision recorded with the implementation step, and old Runs
  without the field stay valid. Existing Runs and Reports are never rewritten;
  historical Runs cannot be bound to a Hypothesis retroactively.
- `request.json` `hypotheses[]` strings are untouched. `--from-request N`
  copies, it does not link by mutation.
- `aq orient` and Studio degrade gracefully when the Hypothesis block is absent.
- A Project without a sealed-tail block shows the state `no sealed tail`. It
  cannot be added later to a Project that already has Runs or Sessions, so
  existing Projects keep every existing behavior and never gain a half-sealed
  state. Intake without the flag is byte-identical to today.
- A Workspace without `ideas/` shows no idea record; Project pages are
  unchanged. `idea.json` is strict `schemaVersion: 1`.
- Allocation, Book Risk, and Path Stress Runs need no change: their Hypothesis
  verdicts read the verified Run artifacts that exist today. The one new
  published figure the Allocation path needs, the paired interval, arrives
  with slice B and the verdict stays capped until then.
- Distribution: the new files are under the Project, the new code under
  `autoquant/`; the Harness `sourceHash` covers the code as for any module.

## Implementation plan

Each step ships independently verifiable value and does not depend on the
frontend.

| Step | Content | Verification |
| --- | --- | --- |
| H0 | this design merged; open questions answered | `tests.test_documentation`, link check |
| H1 | `autoquant/hypotheses.py`: strict schema, canonical hash, `add`/`show`/`list`/`freeze`/`revise`/`drop`; `hypotheses/` layout; validation of frozen files | unit tests: schema rejection, hash stability, immutability after freeze, lineage, loosening flag |
| H2 | routing table and testability check (`aq hypothesis route`), reason codes | table-driven tests per idea kind and each `untestable` code |
| H3 | binding: `aq session start --hypothesis`, `aq run --hypothesis`; Run `execution.hypothesis` and Session copy; evidence filter by `criteriaHash`; Run schema version | tests: binding recorded, old Runs unchanged byte for byte, evidence for earlier revision excluded |
| H4 | verdict rules v1 for Event and Factor (the lanes with complete evidence today) and the ledger builder; `aq hypothesis verdict` | golden tests with hand-computed Wilson and HAC cases; reproducibility on reload; Core-only verdict (no setter) |
| H5 | Strategy rules v1 with `not-computed` PBO; multiplicity M; noise-frontier series (per-prefix expected maximum) | fixtures for DSR pass and fail; prefix series equals direct calls to `expected_maximum_sharpe` |
| H6 | Verdict Record write and reload recomputation; graveyard `search` and prior-attempt check | tamper tests (edited evidence ref rejected); search over a multi-Project fixture Workspace |
| H7 | read model: `/api/v1/project.hypotheses`, `/api/v1/hypothesis`, fingerprint coverage, visibility filtering, `aq orient` block | HTTP tests: hidden values absent from JSON, ETag 304, `none` state |
| H8 | Studio verdict page, noise-frontier chart, Project page list | typecheck/build; browser screenshots with fixtures including `withheld`, `not-computed`, `inconclusive`, `supported`, `refuted`, `untestable` |
| H9 | bundled Skill `frame-hypothesis`; docs (`docs/CLI`, `docs/PROJECT_FORMAT`, `docs/STATUS`); a field trial with a fresh Agent on a rough sentence | Skill bundle tests; trial transcript retained in the completed plan |
| H10 | Allocation, Book Risk, Path Stress: claim metric lists per lane (only metrics Runs already publish), `fixed-reference-advantage-v1` and `historical-bound-v1`, routing rows and ledger rows `reference-advantage`, `bound-held`, `window-coverage`; Allocation `supported` cap | golden tests with hand-computed bounds and a breach; cap test: no `supported` while the interval row is `not-computed` |
| H11 | sealed store and intake: `--sealed-tail`, atomic split at a common timestamp, `data/sealed-tail.json`, rollback, refusal rules (existing block, different fraction, below 120 rows, existing Runs) | tests: no tail byte anywhere under the Project or Workspace tree, hash recorded, forced failure rolls back both writes, Studies and Runs record `sealed` |
| H12 | generalize the holdout binding to accept a Hypothesis plus verdict-evidence Run closure instead of a Dossier; `evaluationRole=sealed-tail-confirmation` | tests: holdout behavior on existing fixtures unchanged byte for byte; Event and Book Risk Hypotheses confirm on a tail dataset |
| H13 | `aq hypothesis confirm`: freeze, mark opened, evaluate once, immutable result, `interrupted` rule, `tail-reused` registry; `hypothesis-confirmation-rules-v1` | tests: second call returns the stored result; kill-after-open returns `unconfirmed (interrupted)` without evaluation; spent tail refuses; confirmation never edits the development verdict |
| H14 | sealed-tail read model and Studio card; ledger row `sealed-tail`; visibility rule 6 | HTTP tests: no tail figure or date in JSON before the immutable result; browser screenshots for `sealed`, `opened`, `confirmed`, `unconfirmed` |
| H15 | idea record: `autoquant/ideas.py`, `aq idea add|link|ladder|show|list`, pinned `criteriaHash` links, `idea-rollup-v1` table; verify the Portfolio artifacts carry per-period net returns, else add the Judge extension as a prerequisite sub-step | tests: link to a revised Hypothesis is flagged; rollup is a table with no scalar; ladder edit after evidence is flagged |
| H16 | `ideaKind: incremental`: fixed-combiner comparison Study, paired delta from each Run's `daily-factor-evidence.csv`, HAC interval, `incremental-paired-v1`, `incremental-inputs-mismatch` | tests: hand-computed paired difference; mismatched dataset hash is `untestable`; Strategy path capped until slice B |
| H17 | idea page and sealed-tail card in Studio; worked decomposition fixture for the context-indicator use case (c1 to c7 as Factor candidates, c8 to c10 `untestable`); bundled Skill update (`frame-hypothesis` decomposes bundles, asks the owner before opening a tail) | build, typecheck, screenshots; fresh-Agent field trial on a rough bundle sentence |

H1 to H7 are Core-only and testable without Studio. H10 follows H5; H11 and H12 are
independent of the verdict rules and can start after H1; H13 needs H4, H11,
and H12; H15 and H16 need H4 and H5. The recommended build order for the
owner's first use case is H1, H2, H3, H4, H11, H13, H15, H16, then the Studio
steps. H8 depends on the Studio
shell already shipped. PBO (slice C) and Portfolio bootstrap CI (slice B) plug
into rule set `v2` without changing any frozen `v1` Hypothesis.

## Change checklist

- Add a new rule only as a new versioned rule id; never change what a shipped
  rule means.
- Every new ledger row states its role, its source path, and its visibility.
- Never present `not-computed` as `pass`.
- Update Run/Session schemas, `docs/PROJECT_FORMAT`, `docs/CLI`, Studio, and
  tests together.
- Keep the browser a renderer; no statistic is computed client-side.

## Known gaps

- Allocation `supported` and the Strategy-path incremental `supported` stay capped until slice B publishes the paired interval.
- PBO is `not-computed` until slice C; the Strategy verdict says so.
- Hypothesis multiplicity for Strategy-kind DSR is disclosed, not recomputed.
- The sealed tail is a path convention, not a sandbox; an adversarial reader
  with disk access can open it (open question 13).
- The external holdout still needs a Dossier; the sealed tail does not (H12).
- Event-style claims about zone touches and structure breaks are `untestable` until Event definitions generalize (slice F).
- No semantic idea search; the knowledge library is slice E.
- Core cannot authenticate who proposed or approved criteria.

## Open questions for the owner

| # | Question | Recommended default |
| --- | --- | --- |
| 1 | Should `supported` ever show without the words "development evidence"? | No. Always qualified; the tier adds `confirmed on the sealed tail` only after the tail result, and `confirmed out of time` only after a holdout Assessment persists. |
| 2 | Event lane default: Wilson lower bound above 0.5, N at least 30? | Yes. Matches the envelope guards already shipped. |
| 3 | **Decided: yes.** Allocation, Book Risk, and Path Stress get verdict rules. | Implemented as `fixed-reference-advantage-v1` and `historical-bound-v1` (see the Allocation, Book Risk, and Path Stress section). Allocation `supported` is capped until the paired interval exists. |
| 4 | **Decided: pipeline reading, disclose `M`.** Many Hypotheses flow through one Project pipeline; Core discloses `M` and the family-wise effect and does not pool DSR across families. | Confirmed by the owner 2026-10-31. Revisit only if a defensible cross-family dispersion model appears. |
| 5 | Does a Hypothesis count toward M before its first Run? | No. Count when at least one Run is bound; dropped-after-run still counts. |
| 6 | **Decided: one Hypothesis per dedicated Project.** A multi-component idea is decomposed into one Hypothesis per component, each in its own Project, linked by a Workspace-level idea record, plus an incremental Hypothesis kind. | Confirmed 2026-10-31 (see the idea umbrella section). The forward holdout target stays a separate Project. |
| 7 | Who may clear `loosenedAfterEvidence`? | Only an explicit `--accept-loosening` recorded as a caller claim, shown on the page. |
| 8 | Is an Independent Review required before `supported` can be recorded? | No (optional); the page lists attached Reviews. |
| 9 | Hypothesis file location: `hypotheses/<hid>/` inside the Project, or a Workspace-level folder? | Inside the Project (self-contained rule); the graveyard index is derived at Workspace level. |
| 10 | Should refutation use the point estimate (Shinka) or the interval (this design) for the Event lane? | Interval. A point estimate below 0.5 is almost always true for noise. |
| 11 | Sealed tail default fraction and minimum? | 20%, refuse below 120 tail rows (the smallest lane floor), warn when below the declared lane's own floor. |
| 12 | Should the sealed-tail confirmation need a Dossier like the external holdout, or bind a Hypothesis plus its verdict evidence Run closure? | Bind the Hypothesis plus Run closure (step H12). The Event, Allocation, Book Risk, and Path Stress lanes have no Dossier lane, and requiring one would leave them unconfirmable. |
| 13 | Who holds the tail bytes: a Workspace-level store under the user data directory, or the owner offline? | User-data-directory store by default with the honest not-a-sandbox disclosure; an owner-held offline mode (the owner supplies the tail only at `confirm`) as a later option for adversarial settings. |
| 14 | Where does the idea record live? | `<workspace>/ideas/<idea-id>/idea.json`: the Workspace owns cross-Project discovery, and no Project may link to siblings without breaking self-containment. |
| 15 | Incremental combiner? | Fixed `equal-weight-zscore-sum-v1`, no fitted weights, so the comparison adds no degrees of freedom; any other combiner is a new versioned id. |
| 16 | Book Risk and Path Stress: does one raw breach of a declared bound refute? | Yes. The claim is a bound, not an effect estimate, so a verified breach is direct falsification. Only these two kinds refute on a single figure. |
| 17 | Component translation fidelity: the own-model components are daily-bar translations of an intraday-oriented TradingView spec. Accept daily as the first test, with intraday as a later intake path? | Yes. State the interval in every Hypothesis; do not claim transfer to intraday. |
