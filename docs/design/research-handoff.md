# Research handoff (`handoff.json`)

Status: implemented, schema version 1. Schema file:
[research-handoff.schema.json](research-handoff.schema.json) (also
`aq schema research-handoff`).

Related: [[docs/design/desk-trial-families]], [[docs/design/core-trial-gate]],
[[docs/design/idea-verdict-card]], [[docs/design/order-native-portfolio-decisions]],
[[docs/design/run-bound-research-reports]], [[docs/design/program-research-dossiers]].

## Purpose

OpenAlice's `delegate-autoquant` Skill consumes the AutoQuant Agent's plain
text handoff: Project id and absolute root, evidence ids, the
validation / visible-test / external-holdout distinction, assumptions,
unsupported claims, trading authority none, and a final line
`Primary deliverable directory: <absolute path>`. `handoff.json` is the
machine-readable projection of exactly that contract, so a host can consume
research without parsing prose. It is a regenerable projection of verified
evidence, not evidence itself, and it carries no trading authority.

## Command

```bash
aq handoff <path> [--project ID] (--run ID | --report ID | --dossier ID) \
  --valid-from YYYY-MM-DD --valid-until YYYY-MM-DD --review-date YYYY-MM-DD \
  [--assumption TEXT]... [--unsupported-claim TEXT]... \
  [--external-holdout-digest SHA256 --external-holdout-status STATUS] --json
```

It writes `<project>/handoffs/<subject-id>/handoff.json` and that directory
is the **primary deliverable directory**. Report and Dossier bundles are
content-locked (their manifests hash every file), so adding a file inside
them would make them fail verification; the handoff directory instead names
the bundle as `subject.evidenceDirectory`. Re-running the command replaces
the file atomically.

The validity window and review date are caller-owned: missing any of the
three refuses with `handoff.validity-required`; nothing is defaulted.

## Fields (V1)

| Field | Content |
| --- | --- |
| `schemaVersion`, `kind` | `1`, `autoquant-research-handoff` |
| `desk.rootDir`, `project.id`, `project.rootDir` | absolute desk root, Project id and root |
| `primaryDeliverableDirectory` | absolute handoff directory |
| `subject` | `run`/`report`/`dossier`, id, absolute bundle directory |
| `verdicts[]` | one per anchor Run: Study, Run, status, objective value, the selection adjustment (status/method/passes/reason), research family id and effective trial count, and the Core verdict `word` with `policy` and `reasons` |
| `evidence` | Run, Experiment, Report ids and the Dossier id |
| `splits.lanes[]` | validation role `selection`; visible test role and whether its audit is visible; `metricsIncluded: false` |
| `splits.externalHoldout` | `custody` (`host` or `not-supplied`), `heldInDesk: false`, digest, `auditStatus` |
| `trialFamilies[]` | desk trial family id, desk-wide count, other-Project trials, declaration state |
| `instruments[]` | symbol and OpenAlice `barId` when the snapshot records one, else `null` |
| `decisions[]` | `targetWeights` (Portfolio mechanical book) and `orderIntents` (artifact references) only when the Run publishes them, else `null` with `source: not-in-evidence` |
| `validity` | caller `validFrom`, `validUntil`, `reviewDate` |
| `assumptions`, `unsupportedClaims` | Agent/caller statements |
| `tradingAuthority` | always `none` |

## Verdict rules

- Words come from `autoquant/research_verdict.py`, the same rule the Studio
  idea card uses: `Supported`, `Inconclusive`, `Could not be tested`. There
  is no `Refuted`. Only Factor objectives (`validation_mean_ic`) have a
  verdict policy today; other objectives report `word: null` with reason
  `no-core-verdict-policy-for-objective-<metric>` rather than inventing one.
- For a Report or Dossier the selection adjustment is the frozen one
  published in the Report, so the handoff states the verdict exactly as it
  was produced; for a Run it is the live desk-aware adjustment.
- Inconclusive round-trips with its reasons (for example
  `diagnosis-raw-statistical-evidence-weak`,
  `selection-adjustment-does-not-pass`).
- Test metrics never enter the file; only whether a test audit is visible.

## Plain-text ending

The Agent's plain-text handoff still ends with
`Primary deliverable directory: <absolute path>` and names the
`handoff.json` path (see `AGENTS.md`). `aq handoff` prints that line.

## Change rules

Adding a required field or changing a meaning increments `schemaVersion`
and keeps a reader for V1. The checked-in schema file must equal
`RESEARCH_HANDOFF_JSON_SCHEMA` (tested).
