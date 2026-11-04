# Core trial gate

Status: implemented (V3, OpenAlice adaptation part 3).

Related: [[docs/design/desk-trial-families]], [[docs/design/studio-assistant]],
[[docs/design/agent-cli-contract]], [[docs/design/openalice-hosting]].

## Why it is in Core

Per-trial confirmation and a trial budget used to exist only inside the Studio
Assistant. Hosted in OpenAlice, the Agent that actually runs research is
OpenAlice's native Agent calling `aq` directly, so those safeguards bound
nobody. They now live in `autoquant/trial_gate.py` and bind every caller of
`aq`; Studio and the Assistant call the same functions.

## Gated commands

`aq run execute`, `aq session start`, `aq experiment evaluate` and
`aq research run`, for any Study with a non-empty editable surface (fixed
descriptive Studies without editable source are not selection trials and are
not gated). Before the command runs, Core evaluates, in order:

| Refusal code | When |
| --- | --- |
| `trial-gate.policy-invalid` | the desk policy file exists but is malformed |
| `trial-gate.ledger-invalid` | a trial-family ledger file is malformed |
| `trial-gate.family-declaration-required` | the Study's question has an undeclared possible related family |
| `trial-gate.budget-exhausted` | counted trials in the family's window plus the planned trials exceed the budget |
| `trial-gate.confirmation-required` | `--confirm-trial` was not passed |

Refusals are ordinary CLI error envelopes (exit 1) whose `error.code` is the
stable code above, with one issue at path `trialGate` and the full gate state
(family id, budget, used, remaining, window start, next trial number,
related families) in `context.trialGate`. `--confirm-trial` acknowledges
spending the trial; it never overrides a budget or declaration refusal.
`aq research run` plans `--max-turns` trials, so the remaining budget must
cover the whole Campaign.

After the command (success or failure) its Project's Runs are registered in
the desk ledger.

## Budget

Policy file: optional `autoquant-research-policy.json` at the Workspace root,
tracked in Git:

```json
{
  "schemaVersion": 1,
  "kind": "autoquant-research-policy",
  "trialBudget": {"maxCountedTrialsPerFamily": 20, "windowDays": 30}
}
```

Absent means the default **20 counted trials per trial family per rolling 30
days**, desk-wide (every Project in the family counts). Rationale: at `N = 20`
the family-wise Factor threshold needs a raw HAC p-value of at most 0.0025,
beyond which further variants of the same question mostly spend the
selection budget rather than improve the evidence; 30 days matches a monthly
host cron cadence, so a scheduled re-delegation cannot reset it by waiting a
week. Raising the budget is a reviewed edit of a tracked file, not an Agent
flag. The window counts each desk trial once, at its first completion.

## Studio and the Assistant

Studio's `session.start` and `experiment.evaluate` previews call the Core gate
before any confirmation and refuse with the same code. The human Studio
confirmation (and the Assistant's per-action confirmation) is what adds
`--confirm-trial` to the exact argv, and Core enforces again when the command
runs. The Assistant keeps its owner-chosen per-conversation trial cap as an
additional, narrower limit; the desk budget is authoritative.

## External holdout custody

When AutoQuant is hosted, the external holdout is held by the host
(OpenAlice) and is never placed in the desk: not in staging, not in a
Project, not in a Study. An Agent working in the desk can read every desk
file, so a holdout inside it is not a holdout. AQ records only what the host
reports: the holdout digest and the audit result, through
`aq handoff --external-holdout-digest SHA256 --external-holdout-status
pending|passed|failed|inconclusive`, which writes `custody: host` and
`heldInDesk: false` into `handoff.json`. The frozen in-desk Holdout challenge
([[docs/design/frozen-external-holdout-challenge]]) remains available to a
standalone desk; it is a later-period challenge, not a host-held sample.

## Invariants

1. No Agent can spend a counted trial without an explicit acknowledgement.
2. No flag raises the budget; only the tracked desk policy does.
3. Studio, the Assistant and the CLI share one gate implementation.
