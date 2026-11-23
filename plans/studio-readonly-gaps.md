# Studio read-only gaps

- Status: `active`
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

- [ ] The Factor page lists, per prediction asset, the published input coverage and factor coverage, and states plainly when the Run published none.
- [ ] `aq project intake --template ohlcv-factor-lab --quantiles 5` and the Studio intake action freeze the same Study judge. Leaving the option out or choosing 3 leaves the Study bytes unchanged. Other values and other templates are refused.
- [x] `?view=projects` renders the Projects page. The information architecture does not place it in the sidebar, so it is reached by URL only.
- [ ] The Factor frontier series is published by the server, the browser holds no quantile or expected-maximum code, and a test pins the server values to the numbers the former browser code produced on the same ledgers.
- [ ] The Strategy page draws a server frontier for a Portfolio Run with at least two successful trials and otherwise shows a not-computed state with the reason and no line.
- [ ] Every new string exists in `zh-CN` and English, and the Studio gates and Python tests named in Verification pass.

## Work

- [x] Server frontier module, Core `expected_maximum_z`, snapshot and Strategy evidence wiring, Python tests, browser tests and the browser fixture.
- [ ] Quantile count through Core, the Studio action and the intake form.
- [ ] Factor coverage section.
- [x] Projects route, its page mount and the tests, with the information-architecture and Studio guide updates.
- [ ] Documentation updates and the final verification.

## Findings and decisions

- 2026-11-23 — The frontier is published beside the frozen evidence, in `noiseFrontier` on the Project snapshot and on the Strategy evidence. `build_selection_adjustment` output is embedded in frozen Session and Report evidence and its schema is closed, so nothing was added to it.
- 2026-11-23 — The browser used its own Acklam quantile and compared the selected IC with its own pass line. The server uses the exact normal quantile and publishes Core's `passes` verdict. On the four pinned ledgers the two implementations agree to better than 1e-8 and give the same verdict.
- 2026-11-23 — The brief called `?view=projects` a bug. The information architecture and a test documented it as an alias of the Factors library, and the Projects table (the old Ideas home) had no route. The route now opens that table, which is the only page listing every Project of the Workspace in every lane. Every caller that meant the Factors library (brand, top-bar mark, breadcrumbs, back links) now links to `?view=factors`. The sidebar is unchanged.
- 2026-11-23 — A Portfolio Run with one trial, or trials with identical Sharpe values, has no measured spread, so the Strategy frontier is not computed. Drawing a flat zero line would claim a noise scale Core never measured.

## Verification

- Pending.

## Progress log

- 2026-11-23 — Plan created. Frontier work landed first.
- 2026-11-23 — Projects route and page mount landed.

## Completion

Not complete.
