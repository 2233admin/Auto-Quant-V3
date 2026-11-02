# Immutable Run history and comparability

Status: implemented for issue #6.

Related: [[docs/STUDIO]], [[docs/design/studio-information-architecture]],
[[docs/design/session-decision-matrix]], and
[[docs/design/research-selection-integrity]].

A Run is an immutable measurement, not an editable research object. History
includes all verified Runs across Projects, objects and lanes, including failed
Runs and old measurements. Its verdict is the retained Core Experiment word
when one exists; a direct or baseline Run without an Experiment retains its
Core execution status. History does not manufacture a scientific verdict or
borrow the latest object's verdict for an older Run.

`autoquant/run_compare.py` owns the shared protocol check. Both Runs must have
the same object kind, lane, exact Study id/hash, Judge/program/dependency hashes,
dataset id and content hash, complete split windows, research horizon, cost
contract and objective. Candidate source hashes may differ: that is the change
being measured. Study equivalence is not inferred; this version has no explicit
equivalent-protocol registry. Even across Projects, matching dataset names or
Study names alone cannot establish equivalence.

All differing fields are returned as `not-comparable` reasons. Missing required
authority also refuses comparison, even when both values are missing. Factor
measurements have no cost model; strategy measurements with an unknown cost
contract are refused. A cost identity hashes the entire recorded implementation
policy, preserving rates and execution assumptions rather than trusting a label.
Custom analysis lanes without recorded split/horizon authority remain in history
but cannot establish an equivalent baseline.

`GET /api/v1/runs?offset=0&limit=200` returns at most 200 rows per page, with a
total, provenance and diagnostics. Studio loads all pages before filtering and
sorting, so facets do not silently cover only the first page. Workspace/Session
diagnostics remain visible without hiding independent verified Runs. Invalid Run
evidence follows the existing snapshot diagnostic contract. All identity reads
use the verified Run reader, never raw unverified JSON. Project-restricted Studio
instances retain their source restriction.

`GET /api/v1/run-compare?project=P&a=A&b=B[&projectB=Q]` rechecks protocol authority
on the server. Refusal publishes facts and reasons without delta rows or figures;
selecting the same exact Run twice is also refused. Source ownership is explicit
for both Runs. Neither endpoint executes research or changes evidence.

History's numeric headline is an explicitly validation-scoped objective; unknown
scope and non-finite values are unavailable. Factor comparison allow-lists only
the selected summaries and bounded published cumulative points. The shared
two-part audit gate requires an actual test audit and `visible-diagnostic` role
before any test number or point is serialized, and the browser applies testGate
again. Paired test metric rows require both audits. Test windows remain protocol
facts and are checked even when numerical audits are hidden.

Compare shows subject minus baseline, with a plus or minus glyph for every finite
delta. Only the primary validation delta receives sign colour; all other values
remain neutral. Catalogue help defines every metric. Paired figures use grey for
baseline and one accent for subject, retain published timestamps and never fill
observations. Cumulative groups are gross research diagnostics with overlapping
forward-return limitations, not executed Portfolio wealth. Deltas do not select,
promote, rewrite verdicts or provide independent holdout confirmation.
