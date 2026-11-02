# Studio data intake verification

Date: 2026-11-03. Issue: https://github.com/2233admin/Auto-Quant-V3/issues/5.
Baseline: `58adaf582eac2713bff5f369f0886dd7c9cc92f1`.

## Surface and acceptance

- `aq data check` and `data.check` share deterministic, network-free diagnostics.
- Existing intake.py remains byte-for-byte unchanged at 5,268 lines.
- PLANS.md is untouched, as explicitly requested by the owner.
- Wizard follows the checked-in workbench kit, type roles, state catalogue,
  six-pixel controls and one primary action. Static and parameterized copy
  uses the existing English/Chinese localization entry points.
- Technical/browser checks below are evidence, not owner visual acceptance.

## Commands

| Command (repository root unless stated) | Exit | Result |
| --- | --- | --- |
| `uv run python -m unittest tests.test_data_quality tests.test_studio_data tests.test_studio_actions tests.test_studio_assistant tests.test_intake tests.test_ohlcv -v` | 0 | 149 tests in 584.951 seconds |
| `uv run python -m unittest tests.test_data_quality tests.test_studio_data` | 0 | Final focused rerun: 32 tests, including empty asset tables, non-object options and V5 hourly horizon wording |
| `uv run python -m unittest tests.test_cli.AgentCliTests.test_capabilities_describe_every_public_command -v` | 0 | 1 test |
| `cd studio-app; npx tsc -b --noEmit` | 0 | Type checking passed |
| `cd studio-app; npm run build` | 0 | Vite built 195 modules; no EPERM and no configLoader fallback |
| `node studio-app/tests/run-idea-answer.cjs` | 0 | 32 tests, including 3 new intake UI tests |
| `cd studio-app; node scripts/ui-inventory.cjs --check` | 0 | 0 raw strings, 0 files |
| `uv run python scripts/check_doc_links.py` | 0 | 1,863 documentation double-links |
| `git diff --check` | 0 | No whitespace errors |
| `uv run aq workspace init D:/tmp/intake/ws` | 0 | Absent scratch Workspace created |
| `uv run python D:/tmp/intake/stage-fixtures.py` | 0 | Clean and deliberately bad synthetic sets |
| `uv run aq studio serve D:/tmp/intake/ws --allow-actions --port 8921` | long-running | Owned PID recorded in `D:/tmp/intake/server.pid` |
| `node D:/tmp/intake/browser-check.cjs clean-factor-reviewed` | 0 | Both real wizard journeys, both entry points, confirmation, strict bind and locale switch |
| `node D:/tmp/intake/state-check.cjs` | 0 | Read-only, empty, loading and error states; owned state servers stopped |

The Windows shell's npm/npx shims were invoked through PowerShell; no packages
or browsers were installed and package.json scripts were not changed.
`designer-pipeline doctor --root D:/projects/.worktrees/aqv3-intake --json`
also returned exit 0 (`ready`). No design package was initialized or imported.

## Browser proof

Used the already installed Playwright at
`D:/projects/design-pipeline/node_modules/playwright` with installed Microsoft
Edge, version `156.0.4314.58`, a new context and exact 1440 x 900 CSS viewport,
deviceScaleFactor 1. The first Orca exploration revealed that its desktop
screenshot size did not follow viewport emulation; those acceptance images
were replaced with actual Edge captures at the requested dimensions.

All retained screenshots are under `D:/tmp/intake/`:

1. `01-source-zh.png` — staged candidates and the Chinese default.
2. `02-mapping-zh.png` — detected column mappings and declared market clock.
3. `03-bad-quality-zh.png` — duplicate/order failures, seven missing bars,
   one long gap, one zero-volume bar and one 40% price jump.
4. `04-bad-examples-zh.png` — expandable original duplicate example.
5. `05-clean-quality-zh.png` — clean prices/bars; unknown universe coverage
   honestly warns instead of claiming a fully known universe.
6. `06-confirm-zh.png` — exact argv, request/package, command hash,
   separate acknowledgement and disabled-confirm reason.
7. `07-bound-zh.png` — successful strict Project intake.
8. `08-bound-en.png` — same success state after the language control switches.
9. `09-read-only-zh.png` — actions off, visible reason and enable command;
   the staging endpoint returns HTTP 404.
10. `10-empty-zh.png` — no staged files and refresh guidance.
11. `11-loading-zh.png` — delayed real quality action uses the shared loader.
12. `12-error-zh.png` — invalid frequency gives a visible error and original
    diagnostic, without bypassing strict intake.

The clean and bad sets each start with four synthetic assets and 185 weekday
observations. Defects are injected into AAA only. Neither set uses network or
real market claims. The clean Project retains strict request and normalized
snapshot files; no Run or Session was created. Repeated UI acceptance created
separate scratch-only targets; the final one is `clean-factor-reviewed`.
`browser-evidence.json` records the viewport, browser version, zero page errors,
report hashes and asset counts; `quality-reports.json` retains both reports.
Working data and screenshots intentionally remain available for inspection.

## Corrections and bounded limitations

- Initial browser traversal found that the New factor modal stayed open after
  navigation. Its wizard link now closes the dialog; both entry paths passed.
- Intake second confirmation initially hid the stale-preview error in the
  old idea flow. Freshness is again checked before the new acknowledgement gate.
- The existing Windows process-cancellation test attempted UTF-8 decoding of
  tasklist's localized output. It now tests ASCII PID bytes without decoding.
- An earlier 149-test run had one `session.harness-stale` failure because the
  agent changed Harness/bundle files while it was running. That receipt is
  retained as failed. A frozen-source rerun is the acceptance run above.
- Final new-module review tightened rejection of empty asset-column tables
  and non-object options and corrected V5 request prose to its actual bar
  interval. The same 32 new-module tests passed again after these changes;
  existing intake, OHLCV normalization and frontend sources were unchanged.
- The repository-wide `uv run python -m unittest discover -s tests -v` was
  attempted, then bounded after 130 completed cases (128 pass, 2 fail), exit 1.
  The command-inventory expectation was updated and its focused test passes.
  The other failure is the unchanged external research driver invoking
  `/bin/sh` on Windows. `autoquant/research.py` matches baseline 58adaf5 and
  `/bin/sh` does not exist. Its independent reproduction remains failed;
  this task does not claim a passing complete repository suite or change that
  unrelated process-launch contract. Only the recorded owned test PID tree
  was stopped.
- Raw CSV package construction is daily V1; existing packages retain V1–V6
  Core contracts. Diagnostic success does not guarantee strict intake success.
  Delisted coverage, provider identity, adjustment and terms remain unauthenticated
  declarations. No real market/provider acquisition, trading, push or PR was done.

## Cleanup

Stopped the owned 8921 server tree (final root PID 33576), temporary read-only/
empty servers on 8922/8923, and the bounded full-suite tree rooted at PID 26596.
The owned Orca page was closed. Edge instances closed in each script's finally
block. Verified zero listening sockets on ports 8921, 8922 and 8923. Removed
exploratory screenshots and moved initial test receipts into the retained
`D:/tmp/intake/` proof directory. The requested scratch Workspaces, synthetic
staging and twelve final screenshots remain available for owner inspection.
