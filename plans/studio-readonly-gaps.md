# Studio read-only gaps

- Status: `completed`
- Updated: `2026-11-23`
- Related design: [[docs/design/studio-information-architecture]], [[docs/design/full-factor-tear-sheet]], [[docs/design/panda-display-gap-matrix]], [[docs/STUDIO]].

## Outcome

Five visible gaps between the Studio and evidence Core already publishes are closed without a new statistic, a changed verdict or a changed frozen byte. The Factor page shows how much input data each asset had. A new idea can freeze 3, 5 or 10 groups through the same Core path as the CLI. The Projects page opens from its own address. The "selection and noise" frontier on the Factor page and on the Strategy page is computed by the server from Core's closed form, and the browser only draws it.

## Context

Studio presents and never computes statistics or verdicts. Three places broke or bent that rule or hid evidence that was already in the snapshot. The Factor frontier recovered a standard error and evaluated normal quantiles in the browser. The Factor diagnostics already carried per-asset input coverage that no page drew. The Projects route fell back to the Factors library because `?view=projects` was not a recognised view. The quantile count could only be chosen from the CLI.

## Scope

### In scope

- A compact coverage section on the Factor page, drawn from `coverage` and `inputAvailability.byAsset` of the existing Factor diagnostics.
- A `--quantiles` option on `aq project intake`, the same option in the Studio intake action, and a 3, 5 or 10 selector in the idea workbench intake form.
- A routable Projects page.
- A server-side `noiseFrontier` read-model field for the Factor ledger and for the exact Portfolio Run behind a Strategy, rendered by the Factor and Strategy pages.

### Out of scope

- Changing `build_selection_adjustment` output or any Session, Report, Run or Judge bytes.
- A new statistic, a new verdict or a new pass rule.
- Moving other browser-side arithmetic (rolling IC means, HAC standard error of a published summary) to the server.
- Pushing, opening a pull request or committing the rebuilt Studio bundle.

## Acceptance

- [x] The Factor page lists, per prediction asset, the published input coverage and factor coverage, and states plainly when the Run published none.
- [x] `aq project intake --template ohlcv-factor-lab --quantiles 5` and the Studio intake action freeze the same Study judge. Leaving the option out leaves the Study bytes unchanged, and the idea form leaves it out for the default 3. Other values and other templates are refused.
- [x] `?view=projects` renders the Projects page. The information architecture does not place it in the sidebar, so it is reached by URL only.
- [x] The Factor frontier series is published by the server, the browser holds no quantile or expected-maximum code, and a test pins the server values to the numbers the former browser code produced on the same ledgers.
- [x] The Strategy page draws a server frontier for a Portfolio Run with at least two successful trials and otherwise shows a not-computed state with the reason and no line.
- [x] Every new string exists in `zh-CN` and English, and the Studio gates and Python tests named in Verification pass.

## Work

- [x] Server frontier module, Core `expected_maximum_z`, snapshot and Strategy evidence wiring, Python tests, browser tests and the browser fixture.
- [x] Quantile count through Core, the Studio action and the intake form.
- [x] Factor coverage section.
- [x] Projects route, its page mount and the tests, with the information-architecture and Studio guide updates.
- [x] Documentation updates and the final verification.

## Findings and decisions

- 2026-11-23 — The frontier is published beside the frozen evidence, in `noiseFrontier` on the Project snapshot and on the Strategy evidence. `build_selection_adjustment` output is embedded in frozen Session and Report evidence and its schema is closed, so nothing was added to it.
- 2026-11-23 — The browser used its own Acklam quantile and compared the selected IC with its own pass line. The server uses the exact normal quantile and publishes Core's `passes` verdict. On the four pinned ledgers the two implementations agree to better than 1e-8 and give the same verdict.
- 2026-11-23 — The brief called `?view=projects` a bug. The information architecture and a test documented it as an alias of the Factors library, and the Projects table (the old Ideas home) had no route. The route now opens that table, which is the only page listing every Project of the Workspace in every lane. Every caller that meant the Factors library (brand, top-bar mark, breadcrumbs, back links) now links to `?view=factors`. The sidebar is unchanged.
- 2026-11-23 — The count can only be frozen at `project.intake`: `project.create` writes a blank Factor scaffold with no dataset, and the intake step rebuilds the Study. The Studio form therefore carries the selector on its data-binding step, not in the New idea dialog. Core owns the rule (`quantile_intake_issues`): the Study's set 3, 5, 10, one asset per group in the universe, and, for a cross-sectional population, one prediction asset per group, which the Study cannot see before the first Run and which would otherwise fail the first Run. The Studio server calls the same function.
- 2026-11-23 — Found, not fixed: the Studio job lease leaves `.autoquant/studio-research.lock` inside the Project before it spawns `aq project intake`. Core's pristine-scaffold check counts any extra file as work, so hydrating a Project created by `project.create` is refused with `project.intake-scaffold-modified` (reproduced with a probe that adds only that file). The Studio test therefore removes the file before running the previewed command. On Windows the directory swap would also meet the open lock. This predates this plan and is independent of the quantile count.
- 2026-11-23 — The Factor payload already carried what the view needs: `inputAvailability.byAsset` (bars, first and last bar, input coverage, factor coverage per asset) and the older `coverage` list. No server change was made. The table sits in the Stability tab as `sec-coverage`. A Run with neither field gets the empty state, and a Run with only `coverage` gets a factor-coverage column and a note that input coverage was not published.
- 2026-11-23 — A Portfolio Run with one trial, or trials with identical Sharpe values, has no measured spread, so the Strategy frontier is not computed. Drawing a flat zero line would claim a noise scale Core never measured.

## Verification

Run on `3700635` in `D:/projects/.worktrees/aqv3-fe-a`, 2026-11-23. The host was shared with other long test runs, so a few subprocess-timing tests timed out in the combined run and were rerun alone.

| Command | Exit | Result |
| --- | --- | --- |
| `uv run python -m unittest tests.test_studio tests.test_studio_actions tests.test_studio_data tests.test_studio_strategy tests.test_studio_frontier tests.test_selection tests.test_intake tests.test_intake_quantiles tests.test_studies tests.test_factor_tearsheet tests.test_factor_explorer tests.test_documentation tests.test_cli tests.test_studio_host tests.test_studio_cache tests.test_studio_factor_references` | 1 | 232 ran, 228 pass, 4 errors: two 5 s `studio serve` start-up timeouts, two 20 s job waits. All four are load timeouts. |
| The same four tests alone (`test_managed_cli_fails_when_injected_port_is_occupied`, `test_managed_cli_subprocess_rejects_conflicting_explicit_port`, `test_enabled_snapshot_carries_token_and_gates_hold`, `test_end_to_end_real_evaluate_through_studio`) | 0 | 4 pass in 24 s |
| `uv run python scripts/check_doc_links.py` | 0 | 2126 documentation double-links resolve |
| `cd studio-app; pnpm run typecheck` | 0 | `tsc -b --noEmit` clean |
| `cd studio-app; pnpm run check:i18n` | 0 | 0 untranslated strings, 104 Core enums, 0 missing |
| `cd studio-app; pnpm run test:ui` | 0 | 130 pass, 0 fail |
| `cd studio-app; pnpm run build` | 0 | built; the rebuilt `autoquant/studio_app` was discarded with `git checkout -- autoquant/studio_app` and is not committed |

New tests: `tests/test_studio_frontier.py` (11), `tests/test_intake_quantiles.py` (7), one Studio action test in `tests/test_studio_actions.py`, key pins in `tests/test_factor_explorer.py`, and in `studio-app/tests` `noise-frontier` (7), `projects-route` (3), `quantile-select` (4), `factor-coverage` (6).

## Progress log

- 2026-11-23 — Plan created. Frontier work landed first.
- 2026-11-23 — Projects route and page mount landed.
- 2026-11-23 — Quantile count landed.
- 2026-11-23 — Factor coverage section landed.

## Completion

All acceptance items are met and the checks above are recorded. The built Studio bundle in `autoquant/studio_app` is not part of these commits; CI rebuilds it and compares. The Studio job lease defect in Findings is separate work.
