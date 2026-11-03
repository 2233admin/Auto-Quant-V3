# Factor-to-Portfolio conversion

Status: V1 implemented.

Related: [[docs/design/research-program-orchestration]],
[[docs/design/cross-study-factor-dependencies]],
[[docs/design/research-intake-and-dataset-snapshots]],
[[docs/design/request-bound-portfolio-mandates]],
[[docs/design/caller-owned-portfolio-research-policy]],
[[docs/design/selection-adjusted-research-evidence]],
[[docs/design/research-selection-integrity]],
[[docs/design/frozen-external-holdout-challenge]], and
[[docs/design/studio-local-actions]].

## Purpose

A tested standalone `ohlcv-factor-lab` answers a Factor question only. Portfolio
work belongs in `ohlcv-research-desk`. Before this contract a user had to leave
Studio, rebuild a desk by hand, re-type data and code, and silently restart
trial counting. `aq project from-factor` makes the route one Core command:

```text
tested standalone Factor Lab (read only)
  + caller-confirmed strategy mandate
  + the exact source dataset package
→ new research desk: same candidate bytes, same market data, caller mandate,
  factor-lineage.json with every reference and the inherited trial count
```

The source Project and its Runs are never written. Conversion runs no Study;
the first Portfolio evaluation is the ordinary governed `session start` on the
desk's Portfolio Study.

## Command

```bash
aq project from-factor <workspace> <source-project> <new-project> \
  --mandate <strategy-mandate.json> [--dataset <package.json>] [--name NAME] --json
```

It composes existing functions only: strict source intake loading, Run and
Study readers, research-family projection, strict `prepare_project_intake`
with the research-desk template, and transactional `create_project`.

### Source admission

The source must be a request-bound `ohlcv-factor-lab` with
`factorPolicy.outcome = forward-return`. Its latest Factor Run (any Study whose
objective is `validation_mean_ic` and whose editable surface is `factors/**`)
must have succeeded, and the current editable source hash must equal that
Run's `subject.sourceHash`. Stable refusal codes:

| Code | Meaning |
| --- | --- |
| `conversion.not-factor-lab` | not a request-bound standalone Factor Lab |
| `conversion.risk-outcome` | a realized-volatility forecast has no return meaning |
| `conversion.source-not-tested` | no Factor Run, or the latest one failed |
| `conversion.source-changed` | candidate changed after its latest Run |
| `conversion.data-not-reusable` | exact package not found under Workspace staging |
| `conversion.data-mismatch` | supplied package is not the tested market data |
| `conversion.mandate` | mandate incomplete, unconfirmed, or inconsistent |
| `conversion.target-exists` | the new Project id exists |

### Caller-owned mandate

`autoquant-strategy-mandate` V1 has exactly `schemaVersion`, `kind`,
`question`, `direction`, `positionRoles`, `benchmarkPolicy`,
`portfolioPolicy`, and `callerConfirmed`. Every field is required:

- `positionRoles` names every source request asset (`long-only`,
  `short-only`, `two-sided`, `context-only`); at least one is tradable;
- `direction` must equal what the roles imply (`long`, `short`,
  `long-short`);
- `benchmarkPolicy` is one explicit caller form (cash, asset, fixed weights);
- `portfolioPolicy` is the complete request policy (gross, caps, volatility
  ceiling, base cost, no-trade band, reference NAV, decision schedule);
- `callerConfirmed` must be `true`.

Core never fills an omitted field. The composed desk request therefore
carries explicit roles, benchmark and policy, so the derived Portfolio Mandate
records `caller-supplied` sources rather than `reference-default` or
`direction-default`. The lineage records `callerProvidedFields` and an empty
`defaultsApplied`. Factor policy, horizon policy and asset descriptions are
the source caller's authority and are carried unchanged; Portfolio position
permission never changes the Factor population.

### Same market data

The source snapshot is verified against its intake hash. The package manifest
is either supplied or found under `<workspace>/staging` by the snapshot's
`packageManifestHash` (bounded walk, no links). Strict intake must then
reproduce every per-asset source hash. After materialization the desk snapshot
must have the same `snapshot_market_identity` as the source: the snapshot
manifest with request-only fields (as in `market_data_identity`) and the two
construction labels `template`/`studyId` removed. Any mismatch aborts the
transactional creation.

Desk intake uses the lane-scoped floor already established by the frozen
holdout desk: 180 daily rows for the required Factor and Portfolio lanes. The
optional governed RL Judge keeps its own 240-row floor. When the data is
shorter, the lineage records `marketData.rlLane.sufficient = false` and Studio
says RL cannot run here; RL is never offered as if it could succeed.

### Exact source

Every file of the source Factor Study's editable closure is copied byte for
byte before any Study identity is created; scaffold files outside that closure
are removed. Construction fails unless the desk's `factors/**` closure hash
equals the source Run's `subject.sourceHash`, so the desk Factor and Portfolio
Studies start from the exact tested source.

## Lineage file

`factor-lineage.json` (`autoquant-factor-lineage`, V1) at the desk root is
written once inside construction and read strictly. It records:

- `source`: Project id, template, request hash, Factor policy, anchor Run (id,
  Study, result hash, family id, qualification stage, selection-adjustment
  status), every source Factor Run (id, Study, status, source hash, result
  hash), and a tree digest of the source Project excluding its cache;
- `candidate`: paths, file hashes, source hash, target source hash;
- `marketData`: source/target snapshot hashes, package manifest hash and path,
  source/target market identity, observation count, intake floor and RL lane
  sufficiency;
- `trials`: `inheritedSourceTrials`, the source Project's distinct Factor
  source count, and every source family with its own unique count;
- `mandate`: SHA-256 of the mandate bytes, caller-provided fields and the
  empty defaults list;
- `authority: evidence-by-reference`, `tradingAuthority: none`.

A malformed or present-but-unreadable lineage fails closed; it is never
ignored, because ignoring it would reset the trial count.

## Continued trial counting

The desk's fixed families are new (different dataset hash, dependencies and
Judges), but the selection is not fresh. `inheritedSourceTrials` is the number
of distinct candidate source hashes among all source Factor Runs, a
conservative upper bound that is at least every source family's own count.

For a Project with lineage, every research-family projection gains
`inheritedSourceTrials`, `effectiveSourceTrials = uniqueSourceTrials +
inherited`, and an `inheritance` block (lineage hash, source Project, source
family ids). Selection adjustment uses the effective count: Factor Bonferroni
multiplies by it, and Portfolio DSR uses it as `N`. Inherited Factor searches
carry no Portfolio Sharpe, so a first desk Portfolio Run with `N > 1` and one
successful Sharpe honestly reports `insufficient-successful-sharpe-trials`
instead of a fresh-family pass. Projects without lineage keep their exact
historical projection, so earlier Reports and Dossiers still verify.

Studio Session-start and evaluation trial numbers use the same effective
count.

## Desk program and gates

Conversion does not alter the coordinated program. The desk's own
Factor-to-Portfolio gate stays `waiting-current-evidence` until the desk's
Factor lane has its own current Run and Report. Studio shows that gate next to
the inherited source evidence and offers the existing governed Portfolio
`session.start` as the first evaluation; the gate remains research
prioritization only, exactly as before, and only the Judge decides the Run.

## Studio action

`strategy.build` keeps one id with two Core paths:

- a Project with a coordinated program uses the unchanged admitted-desk
  Portfolio Session start;
- a Project without a program previews `aq project from-factor` when the
  source is convertible, and otherwise shows the exact refusal.

The browser shows displayed starting values (long-only roles, equal-weight
tradable benchmark, daily cadence, 10 bps cost and the documented reference
risk values) that the user must explicitly confirm; the confirmation checkbox
is reset whenever a fact changes. Preview runs every Core check without
writing, returns the exact argv, mandate, composed request, inherited trial
count and command hash. Launch requires `confirm`, the unchanged hash and
`secondConfirm`; it writes the mandate to
`.autoquant/strategy-mandates/<new-id>.json` (confined, no links) and runs the
command under the new Project's job slot, so no lease file is created inside
the source. The audit record holds Project ids, source Run/hash, mandate hash,
inherited trials and caller fields; never the token. After success Studio
opens `?view=strategy&id=<new-id>` at lifecycle Defined.

## Invariants

1. The source Project tree is byte-identical before and after conversion.
2. No caller-owned Portfolio fact is defaulted by Core or Studio.
3. The desk's candidate closure hash equals the tested source Run's hash.
4. The desk's market identity equals the source's, or nothing is created.
5. Inherited trials are visible in every desk family projection and enter
   selection adjustment; they are never reset silently.
6. Conversion creates no Run, Session, verdict, admission or trading
   authority.

## Known limits

- Only aligned single-snapshot sources whose package is retained under
  Workspace staging (or supplied explicitly) are convertible.
- The inherited count is a distinct-source upper bound; it is not an estimate
  of effective independent trials.
- The mandate covers the request's Portfolio policy fields; per-asset caps
  beyond the global cap are passed as an empty map in V1 Studio.
- Adding a Portfolio Study to an existing desk is not part of V1.
