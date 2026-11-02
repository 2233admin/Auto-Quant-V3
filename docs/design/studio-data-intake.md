# Studio data intake and diagnostic quality

The data intake wizard is `?view=data-intake`, reachable from the Factors
library's **Import data** action and the **New factor** dialog. It uses the
existing Studio local action gates described in [[docs/design/studio-local-actions]].

## Authority and read boundary

`aq data check PATH --json` and `data.check` call the same deterministic,
network-free diagnostic module. CSV loading and strict OHLCV validation are
imported from intake; column coercion is shared with its normalizer. Diagnostic
coercion retains original row order, duplicates and invalid values. Strict
intake does not become permissive, and `autoquant/intake.py` remains unchanged.

Report V1 (`autoquant-data-quality-report`) includes source/options hash,
per-asset row counts and observed ranges, checks with `pass`/`warn`/`fail`,
counts and at most five first examples, plus summary checks. Reports are
diagnostics, not immutable research evidence or proof of strict-intake success.
Malformed individual tables remain inspectable. Invalid package manifests and
escaped source paths are rejected before data access.

Missing-bar denominators use an explicitly named exchange calendar (including
holidays, early closes and session breaks), explicit `weekdays`, or `24/7`.
Bounds default to each asset's observed span; options may fix `start`/`end`.
No listing-history edge is inferred. Unknown/provider-observed calendars have
an unknown rate and a warning, rather than a fabricated expected grid. Native
V5 UTC market claims alone do not identify an exchange calendar; an explicit
per-asset `assetMarkets` declaration can supply that diagnostic authority.
Alignment compares UTC instants and exact scheduled closes, never fills an
observed-only panel. A long gap means possible suspension or missing data,
never a verified cause. Jump thresholds use absolute adjacent observed close
returns. Raw prices may reflect corporate actions; adjustment claims remain
unauthenticated. Jump diagnostics use the first row at each timestamp when
duplicate rows exist; duplicates still fail and no source bytes are repaired.
Universe coverage is explicitly `unknown`,
`currently-listed-only` or `contains-delisted`, independently of price data.

## Staging and writes

Token-protected `GET /api/v1/data-sources` lists only Workspace staging folders
with direct CSV children and existing package manifests. `?path=...` returns
bounded column detection and four original sample rows. There is no upload,
download, arbitrary filesystem picker, provider lookup or network route.
All paths and all referenced assets reject traversal, symlinks and Windows
junctions, including links that stay inside staging. Actions-off mode shows
the shared read-only state and its enable command; no staging route exists.

`data.check` is synchronous and read-only: neither confirmation nor an audit
write is required. `project.intake` preview computes mapping, content hashes,
quality, request, package and exact argv without creating files. Failing
checks block this wizard's intake preview. Warnings remain visible and do not
override strict Core rules. Intake requires both `confirm=true` and
`secondConfirm=true` and a current `commandHash`. Source bytes, declarations,
target id and existing Project fingerprint contribute to freshness.

On confirmation, mapped daily CSV sets are serialized into a content-addressed
`staging/wizard-<hash>/` bundle, together with request, package and transformation
audit. Original files stay unchanged; no fill, deduplication, price adjustment
or invented retrieval timestamp occurs. Exclusive creation refuses conflicting
bundle bytes. The audited job then invokes ordinary `aq project intake` with
the exact displayed argv. Core owns normalized data snapshots and atomic new
Project construction or pristine-scaffold hydration. A failed intake can retain
its staging working files and failed job audit; it cannot imply a bound Project.
Existing packages retain their exact manifest and relative source root.

Raw CSV packaging supports V1 daily session date labels. Existing V1–V6
contracts retain their Core restrictions, including V5/V6's single prediction
asset and observed timestamps. This route is Factor-only and starts no Run,
Session, selection, holdout or trading action. New Project question, prediction
population, horizon and provenance declarations are explicit. Existing pristine
Factor Projects retain their original question and maintained research brief.

See [[docs/CLI]], [[docs/STUDIO]], [[docs/OPERATOR_GUIDE]] and
[[docs/design/research-intake-and-dataset-snapshots]].
