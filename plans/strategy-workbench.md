# Strategy workbench and build from factor

- Status: `active`
- Updated: `2026-11-03`
- Related design: [[docs/design/studio-information-architecture]], [[docs/design/studio-local-actions]], [[docs/design/portfolio-decision-explorer]]
- Execution tracker: GitHub 2233admin/Auto-Quant-V3#7.

## Outcome

Give each Portfolio Project a Strategy workbench with Backtest, Versions,
Tuning and Analyses, and expose only truthful Factor-to-Portfolio routes.

## Context

The Portfolio page already projects immutable evidence. The Strategy library
does not open an object workbench. The oversized Portfolio explorer must shrink
before adding the workbench. Template fit contracts require a research desk
for Factor-to-Portfolio work; standalone Factor Labs cannot be converted by
pretending that a Portfolio scaffold binds their evidence.

## Scope

Read-model extraction, Strategy navigation and evidence tabs, and the narrow
local action supported by existing Core commands. No Judge changes, fabricated
results, automatic optimization, push or PR.

## Acceptance

- [x] Extract cohesive Portfolio projections without changing JSON bytes;
  keep new modules below 800 lines and preserve old imports.
- [x] Provide bilingual Strategy tabs, published-data lifecycle, Run comparison,
  adjusted-only tuning evidence, and Project-confined analysis links.
- [x] Show Factor build eligibility, exact CLI guidance, confirmed/audited
  execution where Core supports it, and explicit refusal otherwise.
- [ ] Pass specified Python, frontend, structural and document checks; record
  1440x900 browser screenshots and any environmental limitations.

## Work

- [x] Baseline tests and sample payload, then pure extraction and repeat proof.
- [x] Strategy workbench and honest build route with regression tests.
- [x] Design docs, browser verification and final audit.

## Findings and decisions

- 2026-11-03: `gh issue view` returns 401; GitHub connector successfully read #7.
- 2026-11-03: Use `UV_CACHE_DIR=D:/tmp/uv-cache` because the host default
  `E:/cache/uv` is outside the writable sandbox.
- 2026-11-03: Template discovery requires `ohlcv-research-desk` for downstream
  Factor evidence. Do not use `ohlcv-portfolio-lab` as a conversion shortcut.
- 2026-11-03: Extracted performance/viability/path projection and common strict
  primitives. `portfolio_explorer.py` shrank from 10,555 to 9,815 lines; new
  modules are 665 and 129 lines. Old imports and every sample JSON byte remain.
- 2026-11-03: Existing coordinated desks may start the already-defined Portfolio
  Study only after Core admission. This creates a Session/worktree and possibly
  a counted baseline, not a new Project or Study. Standalone conversion remains
  disabled. Realized-volatility factors cannot be relabelled as return factors.
- 2026-11-03: The sample has four Portfolio Runs whose selected pair differs in
  Study authority; the shared comparison correctly refuses with that field.
  Its Analyses tab is genuinely empty (the retained sample has no RL baseline).
- 2026-11-03: Core has no cell-level neighborhood adjustment. Tuning exposes
  only scope and the exact base-family deflated-Sharpe evidence. The embedded
  Backtest hides the old raw neighborhood tab, including legacy tab-hash entry.
- 2026-11-03: A test run overlapped a bundle rebuild and observed a stale Harness
  baseline. That verification was discarded; a fresh complete suite was started
  after freezing all source and bundle bytes.
- 2026-11-03: GitHub connector comment requires approval, but this environment
  has approval policy `never`. `gh` also lacks authentication (401). No tracker
  write was claimed; a receipt is retained outside the repository for replay.

## Verification

Commands use `UV_CACHE_DIR=D:/tmp/uv-cache` and `TEMP=TMP=D:/tmp`.
Exact logs and browser evidence are retained under `D:/tmp/strategy/`.

| Command / proof | Result |
| --- | --- |
| Before extraction: `uv run python -m unittest tests.test_portfolio_explorer tests.test_studio` | 32 tests, exit 1; 31 pass, one existing Campaign progress failure |
| After pure extraction: same command | 32 tests, exit 1; same existing failure, no new failure |
| `uv run python D:/tmp/strategy/verify-payload.py` | Exit 0; 210,104 identical bytes; SHA-256 `37a72a30d1c8cd403ce297dc08f9b912f10cd901f09fd89c861f0f8cba2c6188` |
| Exact comparison anchor | `sample-research-desk`, Portfolio Run `run-20260802T024637192531Z-c704a397cdb5` |
| `uv run python -m unittest tests.test_portfolio_explorer tests.test_studio_actions tests.test_studio tests.test_run_compare tests.test_run_history tests.test_studio_strategy` | Frozen source: 104 tests in 371.697 seconds, 102 pass, 2 environmental failures, 0 errors; exit 1 |
| New `tests.test_studio_strategy` alone | 7 tests pass, exit 0; includes real sample projection and synthetic action transport/confirmation/audit fixtures |
| `npx tsc -b --noEmit` from `studio-app` | Exit 0 |
| `npm run build` | Exit 1: EPERM writing config through junctioned `node_modules` |
| `npm run build -- --configLoader runner` | Exit 0; package scripts unchanged |
| `node studio-app/tests/run-idea-answer.cjs` | 56 tests pass, exit 0 |
| `node scripts/ui-inventory.cjs --check` from `studio-app` | Exit 0; zero raw strings |
| `code-intel sentrux check autoquant` | Exit 0; coupling 119.39 to 116.51; god files 41 to 41 |
| `code-intel sentrux check studio-app/src` | Exit 0; coupling 59.42 to 59.41; god files 3 to 3 |
| `uv run python scripts/check_doc_links.py` | Exit 0; 1,947 links resolve before this verification table update |
| Installed Edge Playwright browser walk | 1440x900; Chinese four tabs, one English Backtest, Factor and library disabled build paths; zero page errors |

The before/after Campaign failure is caused by `/bin/sh` being hardcoded in the
existing external Researcher launcher; Windows reports `WinError 2`. The real
process-tree cancellation test also cannot query its own child: `tasklist /FI
"PID eq <own-pid>" /NH` returns exit 1, `ERROR: Access denied`. These are retained
environmental verification gaps, not skipped or replaced with mocks. The action
catalog expectation was updated for the newly registered `strategy.build`.

Browser artifacts: `strategy-backtest-zh.png`, `strategy-versions-zh.png`,
`strategy-tuning-zh.png`, `strategy-analyses-zh.png`, `strategy-backtest-en.png`,
`build-strategy-disabled-zh.png`, `strategies-build-disabled-zh.png`, and
`browser-walk.json`. The scratch copy uses port 8942 with actions enabled;
its standalone Factor cannot truthfully demonstrate an enabled conversion.
The repository sample uses read-only port 8941. Neither fixture was evaluated,
promoted, converted or given fabricated analysis Runs for the screenshots.

## Progress log

- 2026-11-03: Plan registered before implementation; baseline checks started.
- 2026-11-03: Implementation, frontend checks, structural gates and browser
  inspection complete. Frozen-source Python verification confirms 102/104
  pass with only the two reproduced environmental failures. Seven new Strategy
  tests and 56 frontend tests pass. Full-green acceptance remains explicitly open.
- 2026-11-03: Stopped only the task's two recorded server PID trees. Automatic
  policy refused both a checked and an explicit-literal recursive scratch
  cleanup; `D:/tmp/strategy/ws` remains for inspection. No original Workspace,
  fixed Judge or retained sample evidence was changed.

## Completion

Implementation is delivered for review. This plan remains active until the
full required Python suite can pass in a host with its required process/shell
capabilities; screenshots do not constitute owner acceptance.
