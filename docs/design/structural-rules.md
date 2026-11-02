# Structural rules and the Code Intel gate

Status: active since 2026-11-03. Owner: repository maintainers.

AutoQuant uses the Code Intel Pipeline's built-in Sentrux engine
(`sentrux-native`, 2.2.0 when introduced) as a structural ratchet. The rules
are deliberately conservative: the tree as of 2026-11-03 passes, and the gate
fails only when a change makes structure worse than the saved baseline. It
stops new debt; it does not demand that existing debt be paid first.

## Governed scopes

The engine reads `<scope>/.sentrux/rules.toml` (static rules) and
`<scope>/.sentrux/baseline.json` (the saved ratchet). The two files stay
separate: rules are hand-written policy, the baseline is written only by the
engine.

| Scope | Files measured | Rules | Baseline |
| --- | --- | --- | --- |
| `autoquant/` (Python Core) | 99 | `autoquant/.sentrux/rules.toml` | `autoquant/.sentrux/baseline.json` |
| `studio-app/src/` (Studio frontend) | 137 | `studio-app/src/.sentrux/rules.toml` | `studio-app/src/.sentrux/baseline.json` |

Everything else — `projects/` research artefacts, `tests/`, `scripts/`,
`studio-app/node_modules` and other build output — is outside both scopes and
therefore not governed. Hidden directories (including `.sentrux` itself) are
never measured.

`autoquant/.sentrux/` sits inside the Python package, so it is excluded from
the Harness source hash in `autoquant/runs.py` and from the wheel in
`pyproject.toml`. Re-saving a baseline never changes the Harness identity that
Runs record (see [[docs/design/distribution-build-identity]]).

## What the gate enforces

Baseline ratchet (evaluated by `check` and `gate`):

- **No new god files.** A god file has more than 800 non-empty lines, or more
  than 25 functions with more than 400 non-empty lines. The baseline records
  every current god file by path (41 in `autoquant/`, 3 in `studio-app/src/`);
  any god file whose path is not listed fails `god_files_increased`. New
  files must therefore stay under 800 lines. A rename counts as a new path.
- **No coupling increase** (`coupling_increased`): import lines per file × 10
  may not rise above the saved value.
- **No quality regression** (`quality_degraded`): the engine's aggregate
  quality signal may not fall.
- **No new import cycles** (`cycles_increased`).

Static rules (evaluated by `check` and `check_rules`):

| Scope | Rule | Measured 2026-11-03 |
| --- | --- | --- |
| `autoquant/` | `max_coupling = 120.0` | 119.39 |
| `studio-app/src/` | `max_coupling = 60.0` | 59.05 |
| `studio-app/src/` | `max_cc = 20` (branch density per function, per file) | 20 |
| both | `no_god_files = false` (god files are gated by the baseline instead) | 41 / 3 |

## Intended rules the engine cannot express yet

These are recorded so nobody assumes they are enforced:

- **Package boundaries.** "`autoquant/` must not import from `studio-app`" and
  "`studio-app/src` must not reach into `autoquant` source" cannot be written:
  the engine's `boundary` and `layer` table arrays only resolve Rust
  `use crate::` edges. Today
  neither direction has an import edge; the only coupling is the HTTP read
  model and the built bundle served from `autoquant/studio_app/`. Check by
  hand when touching either side; both commands must print nothing (rg exit
  code 1):

  ```bash
  rg -n "^\s*(from|import)\s+\S*studio[-_]app" autoquant --glob '*.py'
  rg -n "from ['\"][./]*autoquant" studio-app/src
  ```

- **Excluding the generated bundle.** `autoquant/studio_app/` is the built
  Studio bundle. The file gate has no user exclude setting, so its single JS
  file is measured inside the `autoquant/` scope. It is not a god file (60
  lines) but it dominates the complexity metric (657), which is why
  `autoquant/` sets no `max_cc`. A rebuild that changes its import or quality
  profile can move the `autoquant/` ratchet; if that happens, re-baseline in
  the same commit as the rebuild and say so.
- **"Oversized files must not grow."** The ratchet compares god-file
  identities, not per-file line counts, so a grandfathered file such as
  `autoquant/portfolio_explorer.py` (10,555 lines) can still grow without
  failing. Shrinking it is tracked in [[plans/product-maturity-roadmap]].
- **Cycles in Python/TypeScript.** `max_cycles` resolves Rust modules only, so
  it is not set; `cycles_increased` in the baseline is the only cycle signal.

## Running the gate locally

Requires the Code Intel Pipeline CLI on `PATH` (`code-intel`). From the
repository root:

```bash
code-intel sentrux check autoquant        # rules + baseline ratchet; exit 0 = pass
code-intel sentrux check studio-app/src
code-intel sentrux check_rules autoquant  # static rules only
code-intel sentrux gate autoquant         # baseline ratchet only
```

A failing check exits 1 and names the rule and the offending files, for
example `God files: 41 -> 42; new since baseline: <file> (loc 900, functions
0; rule: loc>800)`.

For an Agent editing session, the pipeline's session wrapper records a
session-local snapshot under `<scope>/.sentrux/agent-sessions/` (and
`<scope>/.sentrux/cache/`, both git-ignored) and compares against it at the
end; it does not touch the committed `baseline.json`:

```powershell
& "$env:CODE_INTEL_HOME/legacy/Invoke-SentruxAgentTool.ps1" session_start autoquant
& "$env:CODE_INTEL_HOME/legacy/Invoke-SentruxAgentTool.ps1" session_end autoquant
```

## Re-baselining

`code-intel sentrux gate_save <scope>` rewrites `baseline.json`. Do it only
deliberately, in the same commit as the change that justifies it, and state
why in the commit message:

- after splitting a god file (the gate prints "N god file(s) no longer over
  threshold" as a reminder to tighten);
- after an accepted, explained metric movement (for example a Studio bundle
  rebuild).

Never re-baseline to hide a new god file or a real regression. Loosening a
static rule in `rules.toml` follows the same rule.
