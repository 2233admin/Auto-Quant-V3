# Studio mods: features as modules on a fixed host

Status: proposed, owner direction 2026-11-01. The architecture is borrowed from Claude Code mods (a small module with one
`register` entry, a host-provided service object, event hooks that chain, slots that the host places, host-held state,
`validate` and `test` commands, hot reload, and a folder or repository as the unit of distribution). Studio does not run
Claude Code mods; it adopts the shape.

Related: [[docs/design/studio-information-architecture]] decides which object owns which function;
[[docs/design/studio-workbench-kit]] provides the components mods render with;
[[docs/design/studio-local-actions]] is the only way a mod acts on the Workspace.

## Why

Studio functions are scattered across pages that follow Core lanes, so adding or moving a function means editing several
pages, and the look drifts between them. A mod owns one function end to end and plugs into slots that the host places
consistently. The fixed host owns the shell, the data access, the action layer and every rule that must not drift. That
also gives a place to put new quantitative factor tools (turnover, factor correlation, IC decay, neutralisation checks)
without touching other features.

## Contract

A mod is a folder:

```
factor-test/
├── studio-mod.json        manifest
├── index.ts               exports register(on, options)  (exactly one module)
├── types.d.ts             declared state and slot props
└── tests/*.test.ts        run by `aq studio mod test`
```

Manifest fields: `name`, `version`, `description`, `studio` (minimum host contract version), `objects` (object kinds it
contributes to: factor, strategy, run, tuning, workspace), `slots` (slots it renders into), `actions` (action ids it may
request from the catalog), `data` (read scopes it needs), and `state` (declared keys with types). Validation fails on any
undeclared slot, action, scope or state key.

Entry point:

```ts
export function register(on: On, options: ModOptions) {
  on('slot.render', { slot: 'workbench.right.tab', object: 'factor' }, ($, e, next) => {
    // $ is the host service object; e is plain data; next defers to the next mod and then the host
    return next(e)
  })
}
```

### Host services (`$`)

| Service | Purpose |
| --- | --- |
| `$.ui` | resolve kit components (`PaneCard`, `ChartCard`, `MetricGrid`, `VerdictBar`, `StatusLine`, `ActionRow`, `FactChips`), `toast`, `openDialog`, `navigate` |
| `$.data` | read-only access to the verified snapshot, Project, Run and Factor diagnostics; test and holdout fields appear only when their audit exists |
| `$.actions` | catalog, preview and create for allowlisted actions; the confirm dialog, trial count and audit log are host-owned |
| `$.state` | host-held state per mod, survives hot reload; declared keys only |
| `$.store` | per-viewer conveniences (remembered tab, filter); wraps browser storage with failure handling |
| `$.clock` | time source, so tests are deterministic |

Mods have no DOM, no network, no file system and no process access. Everything goes through `$`.

### Slots

The host places slots; a mod never positions itself.

| Slot | Where | Typical contribution |
| --- | --- | --- |
| `rail.nav` | sidebar navigation | a nav entry for an object library |
| `rail.new` | sidebar creation control | the New factor entry |
| `library.toolbar`, `library.filter`, `library.card` | an object library page | primary New button, filter tabs with counts, card body |
| `workbench.left.tab` | left editor card | Factor, History, Parameters |
| `workbench.left.footer` | pinned row under the editor | trial note |
| `workbench.actions` | action chips under the run selector | Parameters, Open diagnostics, Export, Build strategy |
| `workbench.status` | one status line | analysis complete, stages, duration |
| `workbench.verdict` | verdict bar | answer and one-line clause |
| `workbench.chart` | chart card | group cumulative return, Rank IC |
| `workbench.metrics` | metric card | validation and long-short tiles |
| `workbench.right.tab` | tabs under the result | Evidence, Stability, Checks, IC, Groups, Turnover |
| `page` | a whole page | Settings, Attention, lane pages |

### Events

`slot.render`, `workspace.load`, `object.open`, `run.select`, `action.preview`, `job.progress`, `job.complete`. A hook may
observe, add to what the next hook sees, or answer for its slot. It may deny an action request with a visible reason. It
may not rewrite action arguments or any published number, and it may not produce a verdict.

## Rules the host enforces

1. **Core is authority.** Verdicts, trial counts, test visibility and holdout state come from Core through `$.data`; mods
   display them and cannot change them. A mod that tries to compute a verdict fails validation.
2. **Visibility.** `$.data` removes test and holdout fields until their audit exists, so a mod cannot leak them by mistake.
3. **Actions.** A mod lists the action ids it may request; the host shows the existing confirm dialog, the trial count and
   writes the audit record. Mods never build commands.
4. **One primary button per card, disabled needs a reason.** Kit types enforce this; mods render with kit components only.
5. **Trust.** Built-in mods ship in the repository. Workspace mods are loaded only from `<workspace>/.autoquant/studio-mods/`
   and only when the server starts with `--allow-mods`, because a mod runs with the page's access.

## Built-in mods (the migration)

| Mod | Contributes |
| --- | --- |
| `factors` | rail.nav, library for factors, New factor dialog |
| `factor-test` | workbench left editor, run flow, verdict, chart, metrics |
| `factor-evidence` | right tabs: Evidence, Checks, Stability, Provenance |
| `factor-history` | History tab, naming and restoring versions (needs Core support) |
| `strategies` | strategy library and workbench: Backtest, Versions, Tuning, Analyses |
| `runs` | run history, filters, Compare |
| `tuning` | tuning tasks |
| `lane-book-risk`, `lane-path-stress`, `lane-allocation`, `lane-rl`, `lane-event-study` | lane pages and analysis tabs |
| `settings`, `attention` | pages |

New factor-research tools become mods once Core publishes their data: `ic-decay`, `turnover`, `factor-correlation`,
`neutralisation-checks`. A mod can add presentation only; a new measurement still needs a Core explorer field first.

## Tooling

- `aq studio mod validate <dir>`: manifest, declared slots, actions, scopes and state, and a scan for forbidden calls.
- `aq studio mod test <dir>`: runs `tests/*.test.ts` against the host with a fixture snapshot and the fake clock.
- `aq studio serve --mod-dir <dir>`: loads one extra mod and hot reloads it on save.

## Build order

1. Write the host: registry, slot renderer, `$` services, manifest validation. No visible change.
2. Move `factor-test` and `factors` into mods behind the host and prove the pages are unchanged.
3. Move the remaining built-ins; delete the page-per-lane routes as each moves.
4. Add `validate`, `test` and `--mod-dir`.
5. Add the first new mod that needs fresh Core data (turnover or IC decay) to prove the extension path.

## Non-goals

Running Claude Code mods, a public marketplace, mods that run on the server, and any mod that changes Core results.
