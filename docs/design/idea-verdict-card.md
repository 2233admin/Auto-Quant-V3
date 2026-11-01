# Idea-first Factor verdict card

Status: a bounded Studio development-evidence slice. Related contracts:
[[docs/design/studio-local-actions]], [[docs/design/hypothesis-and-idea-verdict]],
[[docs/design/research-selection-integrity]], [[docs/design/factor-diagnostics]],
[[docs/design/research-intake-and-dataset-snapshots]].

Ideas creates a dedicated Project with the caller's original question in its
description and research.md, using an allowlisted `aq project create` argv.
The Factor workbench opens before any Run exists. It binds a caller-selected
staged daily V1 package through `aq project intake`, including an explicit
prediction population and primary forward-return horizon. Unselected assets
are context. The fixed additional five-bar diagnostic (twenty when primary is
five) is displayed before binding and has no selection authority. This slice
accepts only a decision-signal ranking claim; it does not translate arbitrary
prose into an executable scientific hypothesis.

The first candidate is authored explicitly, never silently taken from the
template demonstrator. A small expression entry produces the ordinary pandas
candidate API, with the existing CodeField available for Python. Saving uses
the local action layer's compare-and-swap guard. The initial canonical file
can be saved only after intake and before any Run or Session exists. Later
edits use the existing Session candidate save, check and evaluate operations.
The first `session.start` runs Core's preflight before the baseline. A failed
guard spends no trial and is not research evidence. A failed Run remains a
counted immutable execution. Confirmation always discloses trial N of M;
these are the existing ledger counts, not a newly introduced search budget.

The card uses four words, with deliberately limited reach. Supported means
the existing Core projection publishes the exact `decision-signal-positive`
diagnosis for the declared forward-return claim and the Session's
selectionAdjustment for that exact Run passes (a Session's leader adjustment
must never be reused for a different candidate). It is qualified as development evidence, never
confirmation. Inconclusive means an applicable completed diagnosis does not
establish that claim, or the trial adjustment is absent or does not pass.
Non-positive IC and failure to qualify for Portfolio are not falsification.
Refuted is reserved for an explicit Core refutation protocol; no current
diagnosis in this slice permits it. Could not be tested means the attempt
failed execution/preflight, or an applicable Factor protocol is unavailable.
Studio computes no significance test, threshold, portfolio verdict or new
scientific decision. The detailed Factor page now also avoids “Does not hold”
for failed qualification.

Each result repeats the original question, names the validation range and
retained trial count, and displays the question SHA-256. The action's started
audit record stores the exact UTF-8 question hash, original text, fixed wording, policy id
`factor-idea-development-v1`, and any later Experiment hypothesis and hash.
The question is fixed in this UI at creation, before the first Run starts.
A different original question creates another dedicated Project. A later
candidate explanation is visibly a trial-family note; it neither rewrites
the original question nor resets or removes any Core trial. The operational
audit is not immutable research evidence and cannot authorize a verdict.

Test visibility uses the shared `testGate.ts` predicate: both an actual audit
and `visible-diagnostic` protocol role are necessary. No test or holdout metric
is needed for this card. The flow never opens a holdout, and explicitly says
that sealed-tail intake and confirmation are not built. The full H1-H17 Core
Hypothesis object, frozen success/refutation criteria, immutable Verdict
Records, semantic validation of prose versus candidate, cross-idea family
correction, and hidden-tail implementation remain proposed in
[[docs/design/hypothesis-and-idea-verdict]]. A stored text hash does not claim
those capabilities.

Staged packages must be under the served Workspace's staging directory.
Discovery ignores links and rejects escaped asset paths; strict Core intake
still validates the full package. With no supported package, Studio shows an
exact PowerShell command to copy a complete manifest-and-CSV directory into
staging. Studio never downloads or manufactures market data. Other package
versions remain available through CLI intake, not this first-idea form.
