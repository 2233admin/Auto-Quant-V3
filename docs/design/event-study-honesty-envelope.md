# Event Study honesty envelope

Status: implemented for the Price Event Study (slice A of
[[plans/shinka-research-methods-and-frontend-merge]]).

Related: [[docs/design/ohlcv-price-event-study]],
[[docs/design/selection-adjusted-research-evidence]],
[[docs/design/studio-observation-surface]], and [[docs/CLI]].

## Scope

This document owns the statistical envelope that every rate in an Event Study
result carries. It answers one question for a human or Agent reading a result:

> How many observations stand behind this percentage, how uncertain is it, and
> does it hold up across time?

It does not change the Study contract, the Judge, any Run, or any artifact. It
does not turn a descriptive result into a causal claim or grant authority.

Method referenced from the conditional-frequency statistics of the open-source
Edge Stats project (MIT). The implementation in `autoquant/event_envelope.py`
is independent Python; no code or product name is carried over.

## Why

The Event Study report already stores a bare `positiveRate` and a normal
approximation for means. A bare rate invites over-reading, above all with the
handful of events a rare opening gap produces. The envelope enforces one rule:

**No code path outputs a rate without its sample size.** A rate is always
`{n, successes, guard, estimate, ci95}`. When the guard withholds the estimate,
the counts remain visible and `estimate` and `ci95` are null.

## Where it lives

`autoquant/event_explorer.py` already re-derives every population, distribution,
and the conclusion from the verified immutable ledger. The envelope is one more
read-side projection of that same verified ledger:

```text
immutable Run artifacts → strict re-derivation → envelope projection
```

Consequences:

- Run schemas, report bytes, input hashes, and the Judge are unchanged. Every
  existing Run stays readable and byte-identical; old Runs gain the envelope
  when read.
- The diagnostics kind is the same. One required field, `envelope`, is added to
  the diagnostics projection and its JSON schema. Consumers that ignore unknown
  fields are unaffected.
- The envelope is recomputed on every read. It is not stored and cannot drift
  from the ledger.

## Population

Rates use the **primary non-overlapping** events (`primaryEligible`), the only
population whose return intervals do not overlap. Raw complete events overlap by
construction under `keep-first-until-exit` and are not given intervals. The
unconditional same-asset reference is reported with its N and hit rate but never
an interval: its observations overlap heavily (one per aligned entry date over
a multi-bar holding window), so a binomial interval would overstate certainty.
It carries `intervalWithheldReason: "overlapping-observations"`.

Independence is still an approximation even for primary events, because
volatility clusters. The disclaimer says so.

## Envelope fields

`diagnostics.envelope`:

| Field | Meaning |
| --- | --- |
| `method` | `wilson-honesty-envelope-v1` |
| `confidenceLevel` | `0.95` (two-sided, `z = 1.959963984540054`) |
| `population` | `primary-non-overlapping-events` |
| `guards` | `{warnBelow: 30, withholdBelow: 10}` |
| `outcomes.primaryPositiveReturn` | asset return > 0 among primary events |
| `outcomes.primaryPositiveExcess` | asset minus matched reference return > 0 |
| `unconditionalPositiveReturn` | N and hit rate, no interval |
| `returnDistribution`, `excessDistribution` | N, mean, min, max, p10/p25/p50/p75/p90 |
| `disclaimer` | fixed text, shown with every envelope |

Each outcome is a rate plus `stability` and `perYear`.

### Wilson interval

For `k` successes in `n` trials, `p = k/n`, and `z² = 3.8414588…`:

```text
center = (p + z²/(2n)) / (1 + z²/n)
half   = z · sqrt(p(1-p)/n + z²/(4n²)) / (1 + z²/n)
CI     = [max(0, center-half), min(1, center+half)]
```

Hand-checked values pinned in `tests/test_event_envelope.py`: 8/10 gives
`[0.4902, 0.9433]`, 0/10 gives `[0, 0.2775]`, 5/10 gives `[0.2366, 0.7634]`,
and 24/30 gives `[0.6269, 0.9049]`.

### Guards

| N | `guard` | estimate and CI |
| --- | --- | --- |
| `< 10` | `withheld` | null (counts only) |
| `10 … 29` | `small-sample` | shown, flagged |
| `≥ 30` | `ok` | shown |

The floors are fixed constants, not Study fields. They are independent of the
Study's frozen `minimumEvents`, which still decides only the existing
`insufficient-events` conclusion. A Study with `minimumEvents = 8` can therefore
conclude `observed-advantage` at N = 8 while the envelope withholds the hit
rate; both are shown and neither hides the other. Making the floors Study fields
would change the frozen Study authority and is out of scope.

### Stability split

Primary events in chronological order are split at `n // 2`: the first half
holds the first `n // 2` events, the second half the rest. Each half is a rate
under the same guard. `agree` is true when the two Wilson intervals overlap,
false when they do not, and null when either half is withheld. A stable-looking
overall rate that flips between halves is a warning, not a finding.

### Per-year counts

Primary events are bucketed by the calendar year of `eventTimestamp`. Each year
is a rate under the same guard, so most years of a rare event show counts only.

### Return distribution

Fixed quantiles of the primary asset and excess returns: p10, p25, p50, p75,
p90, plus N, mean, minimum, and maximum. Empty populations return `n = 0` with
null statistics.

## Surfaces

- `aq run event-study <path> --run <id> --json` returns `envelope`. The text
  form prints each rate with N, hits, and interval, plus the stability line and
  the disclaimer. The old bare hit-rate line was replaced.
- Studio snapshot `eventStudyExplorer.envelope` carries the same object. The
  Event Study page at `/projects/<id>/event-study` draws it: result cards with
  the N and an interval bar, the stability split, per-year chips, and the
  drill-down list of the events behind every number.

## Visibility

The Event Study consumes the whole aligned dataset and grants no selection
role, so there is no hidden split to protect. Nothing in the envelope reads
holdout, test, or any value outside the verified immutable ledger.

## Not in this slice

Recency window, free query DSL, session bar charts, and macro event calendars
from the reference project are tracked in
[[plans/shinka-research-methods-and-frontend-merge]].
