# As-of alternative features

Status: proposed. Design only; no product code implements it. Date:
2026-11-23. Recovered from the OpenSpec change `as-of-alt-factor` on the V2
fork branch `experiment/engine-stitch-sandbox` (`4e6cd4c`, 2026-08-20), which
was never merged. The sandbox code on that branch (AKQuant sidecar, Studio
marks on the retired `studio_assets` shell) is not carried over.

## Purpose

AutoQuant Factor research reads an OHLCV panel only. A question that needs a
point-in-time alternative feature (fundamentals, flows, sentiment, macro
slots, open interest) has no honest place to attach it. The routing table in
[[docs/design/hypothesis-and-idea-verdict]] therefore marks such ideas
`untestable` with reason `data-non-ohlcv`, and
[[docs/design/product-capability-map]] lists point-in-time data as missing.

This design gives an Agent a file-backed way to join point-in-time features
to a locked decision clock and inspect untrusted association. The join's
numbers are not promoted into Core evidence. It is the smallest step that
makes the join itself correct and testable before any Core lane trusts it.

Stitching a price engine (Hikyuu, qteasy, AKQuant) does not create this
contract: those products are price engines and solve a different problem.

## Scope

In scope:

- a feature table keyed by `asset` and `as_of`;
- a backward-only as-of join onto a locked decision clock;
- an association artifact labelled untrusted, with no authority;
- an optional local query accelerator that never becomes the record.

Out of scope (non-goals):

- any change to Core `panel-v2`, intake, Study, Judge, Session, Run, Report
  or Studio contracts;
- an `aq` command or a Core snapshot schema in this step;
- a database as the research record (ClickHouse, QuestDB as authority);
- importing price engines into `autoquant/`;
- turning `data-non-ohlcv` into a testable route. That needs a later design
  that promotes a verified join into a Core lane with its own Judge rules.

## Invariants

1. **Rows declare asset and knowable time.** A feature row has `asset`,
   `as_of`, `name` and a numeric `value`. `as_of` is the instant the value
   became knowable (publication or revision time), not the period it
   describes. A file with a row that lacks `as_of`, or whose `as_of` is not a
   timestamp, is rejected whole, and no association output is written.
2. **Join is backward only.** Each decision bar takes, per asset and feature
   name, the latest row with `as_of <= bar timestamp`. A later `as_of` is
   never used.
3. **Missing stays missing.** No forward-fill, back-fill, interpolation or
   invented value. A bar with no eligible row gets an empty cell and the run
   continues.
4. **Output has no authority.** Every association artifact declares itself
   untrusted experiment output, with `authority: none`. It carries no Run,
   Judge, Report, selection or trading authority.
5. **Files are the authority.** The durable inputs are the feature file and
   the locked decision-clock file. An optional local QuestDB may speed up
   as-of queries. The same join must be reproducible from the files with no
   database running, and rows present only in the database never reach the
   artifact.
6. **Price engines stay out.** The join code imports none of `autoquant`
   Core internals, `hikyuu`, `qteasy` or `akquant`.

## Flow

```text
feature file (asset, as_of, name, value)  ─┐
                                           ├─ backward as-of join ─▶ association artifact
locked decision clock (asset, timestamp) ─┘                          (kind: untrusted, authority: none)
```

Worked cases the tests must pin:

| Bar | Feature rows for that asset | Joined value |
| --- | --- | --- |
| 2024-01-10 | `as_of=2024-01-09` | the 2024-01-09 value |
| 2024-01-10 | only `as_of=2024-01-11` | empty |
| any | none with `as_of <= timestamp` | empty, run continues |
| any | a row missing `as_of` anywhere in the file | file rejected, no output |

## Verification

Acceptance for the first implementation:

- one test per invariant and per worked case above;
- the join run twice, with and without the optional database, gives
  byte-identical artifacts;
- a source scan proves invariant 6.

## Change checklist

- Keep `as_of` meaning "knowable at", and say so wherever the field appears.
- Any step that lets a Core lane read joined features is a new design with
  its own Judge rules and its own `untestable` reason-code updates; it does
  not extend this one silently.
- Never present an association figure from this path as a verdict or as
  Factor evidence.

## Known gaps

- No revision history: a feature revised after publication needs one row per
  revision, each with its own `as_of`. The file format does not yet say how
  to mark a revision.
- No intake, dataset snapshot or content lock for the feature file. Until
  one exists, the artifact must record the feature file's hash.
- No Hypothesis route. `data-non-ohlcv` stays `untestable` until a Core
  lane consumes the join.
