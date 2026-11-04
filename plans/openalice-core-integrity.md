# OpenAlice adaptation part 3: Core integrity, bars and handoff

- Status: `active`
- Updated: `2026-11-04`
- Related design: [[docs/design/desk-trial-families]],
  [[docs/design/core-trial-gate]], [[docs/design/research-handoff]],
  [[docs/design/openalice-bars-acquisition]], [[docs/design/openalice-hosting]].
- Tracking: <https://github.com/2233admin/Auto-Quant-V3/issues/23>

## Outcome

A desk hosted in OpenAlice keeps its integrity rules when OpenAlice's own Agent
drives `aq`: repeated delegation of one question accumulates one desk-wide trial
count, counted trials pass a Core budget and acknowledgement gate, OpenAlice
bars enter with their exact barIds, and every result can be handed back as a
versioned `handoff.json`.

## Scope

### In scope

- Desk trial-family ledger, fingerprint, declarations, desk-wide counting in
  selection adjustment.
- Core trial gate (`--confirm-trial`, desk budget policy, stable refusal codes),
  shared by CLI, Studio actions and the Assistant.
- `acquire-openalice-bars` Workspace Skill with a recorded fixture.
- `aq handoff`, schema V1, AGENTS.md handoff instructions.
- `aq orient --json` `deskResearch`; `aq capabilities --summary` rows.

### Out of scope

- Studio frontend (`studio-app/`), hidden in hosted mode by a separate change.
- OpenAlice-side changes (`delegate-autoquant` Skill, template pin).
- A live `alice` CLI run.

## Acceptance

- [x] Two Projects asking the same question share one family and count.
- [x] A restyled question in a renamed Project joins; another horizon does not.
- [x] Desk-inherited trials turn a synthetic Supported Factor Inconclusive.
- [x] Registration is idempotent; reads never write.
- [x] Budget refusal and cross-Project `--confirm-trial` path, with stable codes.
- [x] OpenAlice fixture packages into a dataset strict intake and `aq validate` accept.
- [x] `aq handoff` writes a schema-valid `handoff.json` for an Inconclusive Run;
      missing validity refuses; no OrderIntent invented.
- [x] Full suite against the known-failure baseline, doc links, Sentrux check.

## Work

- [x] `autoquant/trial_families.py`, `selection.py` desk inheritance.
- [x] `autoquant/trial_gate.py`, CLI wiring, Studio actions gate.
- [x] Skill, fixture, `market_data_identity` barId identity.
- [x] `autoquant/handoff.py`, `research_verdict.py`, schema file.
- [x] Design notes, AGENTS.md, CLI/PROJECT_FORMAT docs.
- [x] Scripted end-to-end scratch desk (`D:\tmp\alice-core\e2e.py`).

## Findings

- `aq-python` re-executes through `os.execv`, which on Windows splits
  arguments containing spaces (for example `--terms "a b"`); bundled Skill
  scripts with spaced arguments must be run through `uv run python` there.
  Pre-existing; not changed here.

## Verification

Recorded in the commit messages and the issue #23 comment.
