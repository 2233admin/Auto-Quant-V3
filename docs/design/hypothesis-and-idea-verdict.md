# Hypothesis and idea verdict

Status: proposed design; nothing here is implemented. It owns the path from a
rough trading idea to an evidence-derived verdict.

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

## Scope

In scope:

- a Hypothesis object (statement, kind, lane route, success and refutation
  criteria, thresholds) stored in the Project and frozen by content hash;
- a status machine whose terminal states are derived from evidence;
- a versioned, deterministic verdict rule set per idea kind;
- the check ledger and the noise-frontier chart the Studio verdict page draws;
- `aq hypothesis` commands, Agent Work Brief surfacing, and a bundled Skill;
- a searchable idea graveyard over the Workspace;
- multiplicity accounting across Hypotheses.

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

- `ideaKind` is `factor`, `event`, `strategy`, or `allocation`.
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

### Allocation (`ideaKind: allocation`, lane `ohlcv-allocation-lab`)

The Allocation lane is a fixed descriptive Study with no selection loop. V1 has
**no verdict rule** for it. Its Hypothesis is accepted, routed, run, and its
evidence rows are shown, but the verdict is `inconclusive` with reason
`lane-descriptive-no-rule-v1`, displayed as "descriptive result, no verdict
rule in this release" rather than a fake judgment. This is an explicit
boundary (open question 3).

The Book Risk and Book Path Stress lanes are likewise descriptive audits of a
reported or hypothetical book. They are not idea kinds: nobody "proposes a
hypothesis" about a book they already hold.

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
  dispersion across unrelated Studies has no defensible meaning).
  This is the weakest cell of the design and is open question 4.

M is shown on every verdict page. It is not a gate by itself.

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
| `multiplicity` | factor, event | gate | M and adjusted level |
| `pbo` | strategy | gate when computed | slice C; `not-computed` until then |
| `stability-halves` | factor (folds), event (halves), strategy (halves) | gate | chronological split |
| `per-year` | event, strategy | context | per-year counts and signs |
| `baseline` | strategy, event | gate | benchmark, matched reference, or known style |
| `cost-adjusted` | strategy | gate | net of cost, turnover, cost drag, delay stress |
| `visible-test-audit` | factor, strategy | audit | test split; never a gate; shown only after a verdict exists |
| `holdout-status` | all | context | `none`, `bound`, `run`, then the Assessment label |
| `reproducibility` | all | gate | Harness identity, source/data/Judge hashes, verified load |
| `criteria-integrity` | all | gate | frozen hash matches; revision count; `revisedAfterFirstRun`; `loosenedAfterEvidence` |

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

## Routing and untestable ideas

| Idea kind | Lane (template) | Typical statement | Verdict support |
| --- | --- | --- | --- |
| `factor` | `ohlcv-factor-lab` (or the desk) | "20-day reversal predicts next-week returns across these assets" | Factor rules |
| `event` | `ohlcv-event-study-lab` | "After a -5% gap NVDA beats SPY over 5 bars" | Event rules |
| `strategy` | `ohlcv-portfolio-lab`, or `ohlcv-research-desk` when Factor evidence must feed it | "Trade this factor with these constraints after costs" | Strategy rules |
| `allocation` | `ohlcv-allocation-lab` | "ERC beats my fixed weights on risk" | descriptive only in v1 |

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

`untestable` is a framing result with an owner-visible reason, not a verdict.
It is kept in the graveyard so the same dead end is not rediscovered.

## CLI

New command group, discoverable through `aq capabilities` and covered by
`docs/CLI`:

```text
aq hypothesis add <path> --idea TEXT [--from-request N] [--kind factor|event|strategy|allocation] [--project ID] [--json]
aq hypothesis route <path> --id HID [--project ID] [--json]        # route + testability check
aq hypothesis freeze <path> --id HID [--project ID] [--json]
aq hypothesis revise <path> --id HID [--accept-loosening] [--project ID] [--json]
aq hypothesis show <path> --id HID [--project ID] [--json]          # frozen criteria + derived status + ledger
aq hypothesis list <path> [--project ID] [--status S] [--json]
aq hypothesis verdict <path> --id HID [--record] [--project ID] [--json]
aq hypothesis drop <path> --id HID --reason TEXT [--project ID] [--json]
aq hypothesis search <path> [--text T] [--kind K] [--asset A] [--verdict V] [--json]
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
| Many ideas, best one reported | M counts ideas with bound Runs, including dropped ones; multiplicity gate and display | Strategy-kind DSR is not recomputed across families (open question 4) |
| Post-hoc rewriting of the statement | statement is inside the hash; a different statement is a new revision with lineage | wording that is vague but frozen; `no-falsifiable-claim` guard helps |
| Agent self-grading | no setter for verdict status; verdict computed by Core; Verdict Record is a pure function of frozen evidence; Report prose cannot overwrite it | an Agent may still select which Hypotheses to create; M and the graveyard make that visible |
| Reusing the visible test split as confirmation | test is `audit` only, never a gate; only the external holdout confirms; `supported` always says "development evidence" | owners may over-read the audit row; its label says diagnostic |
| Holdout reuse | holdout stays Project/Dossier-level and one-shot; the Hypothesis page shows its state and never re-runs it | per-Hypothesis holdouts need one Hypothesis per Project (open question 6) |
| Silent method gaps | rows are `not-computed` or `n.a.` with reasons; PBO is never faked | the verdict sentence must carry the caveat so it is not skimmed away |
| Dropping failed ideas to avoid M | dropped-with-runs still count in M | an idea dropped before any run does not count; that is the intended boundary |
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

H1 to H7 are Core-only and testable without Studio. H8 depends on the Studio
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

- Allocation, Book Risk, and Path Stress have no verdict rules in v1.
- PBO is `not-computed` until slice C; the Strategy verdict says so.
- Hypothesis multiplicity for Strategy-kind DSR is disclosed, not recomputed.
- Holdout remains Project/Dossier-level; per-Hypothesis confirmation needs a
  separate design.
- No semantic idea search; the knowledge library is slice E.
- Core cannot authenticate who proposed or approved criteria.

## Open questions for the owner

| # | Question | Recommended default |
| --- | --- | --- |
| 1 | Should `supported` ever show without the words "development evidence"? | No. Always qualified; "confirmed out of time" only after a holdout Assessment persists. |
| 2 | Event lane default: Wilson lower bound above 0.5, N at least 30? | Yes. Matches the envelope guards already shipped. |
| 3 | Allocation, Book Risk, Path Stress: add rules later or keep descriptive only? | Keep descriptive; they answer "what is this book/allocation", not "does this idea hold". Revisit if you propose allocation ideas often. |
| 4 | Strategy kind across many Hypotheses: recompute DSR over pooled trials, or disclose M only? | Disclose M only in v1; pooled DSR across unrelated Studies is not statistically defensible. |
| 5 | Does a Hypothesis count toward M before its first Run? | No. Count when at least one Run is bound; dropped-after-run still counts. |
| 6 | One Hypothesis per Project when a holdout is needed? | Yes for holdout: create a dedicated target Project for the frozen candidate. Otherwise many Hypotheses per Project are fine. |
| 7 | Who may clear `loosenedAfterEvidence`? | Only an explicit `--accept-loosening` recorded as a caller claim, shown on the page. |
| 8 | Is an Independent Review required before `supported` can be recorded? | No (optional); the page lists attached Reviews. |
| 9 | Hypothesis file location: `hypotheses/<hid>/` inside the Project, or a Workspace-level folder? | Inside the Project (self-contained rule); the graveyard index is derived at Workspace level. |
| 10 | Should refutation use the point estimate (Shinka) or the interval (this design) for the Event lane? | Interval. A point estimate below 0.5 is almost always true for noise. |
