# Factor-to-Portfolio conversion

- Status: `active`
- Updated: `2026-11-03`
- Related design: [[docs/design/factor-to-portfolio-conversion]],
  [[docs/design/selection-adjusted-research-evidence]],
  [[docs/design/studio-local-actions]], and
  [[docs/design/research-program-orchestration]].

## Outcome

From a tested standalone `ohlcv-factor-lab` Project, "Build strategy" creates
a research desk whose Portfolio Study consumes that exact factor over the same
market data, without re-typing data or code, without defaulting any
caller-owned Portfolio fact, and with the source's counted trials continuing.
Issue: 2233admin/Auto-Quant-V3#18.

## Scope

### In scope

- Core `aq project from-factor` composing strict intake and desk construction.
- `factor-lineage.json` and inherited trials in every desk research family.
- Studio `strategy.build` conversion path with mandate dialog, exact preview,
  second confirmation and audit; Strategy workbench lineage and first governed
  Portfolio evaluation through the existing `session.start` action.

### Out of scope

- Adding a Portfolio Study to an existing desk.
- Changing the desk's Factor-to-Portfolio gate or any Judge.
- Per-asset caps in the Studio dialog (Core accepts them in the mandate).

## Acceptance

- [x] References recorded (source Project, anchor and all Factor Runs,
  candidate hashes, snapshot/market identity, mandate hash).
- [x] Source Project byte-identical before and after (unit test and e2e hash).
- [x] Inherited trial count exposed and counted by selection adjustment.
- [x] Every mandate field caller-provided; incomplete/unconfirmed refused.
- [x] Refusals: untested, changed source, different/unfindable data, actions off.
- [x] Studio preview, second confirmation, audit without secrets.
- [x] Browser walk from five-day-momentum to a first Portfolio verdict.

## Findings and decisions

- 2026-11-03 — The research desk requires 240 rows because of RL; the demo
  data has 180. Reused the frozen-holdout precedent of a lane-scoped 180-row
  floor for the required Factor/Portfolio lanes and recorded RL as
  insufficient instead of faking it.
- 2026-11-03 — `market_data_identity` keeps `template`/`studyId`; the new
  `snapshot_market_identity` additionally strips those two construction
  labels so a desk rebuilt from a Factor Lab can prove identical market data.
- 2026-11-03 — Inherited trials = distinct source hashes over all source
  Factor Runs (upper bound). A first desk Portfolio Run therefore reports
  `insufficient-successful-sharpe-trials` instead of a fresh-family pass.
- 2026-11-03 — The desk's own Factor gate is unchanged
  (`waiting-current-evidence`); Studio shows it beside the inherited evidence.

## Verification

- `uv run python -m unittest tests.<module>` (per module, host under memory
  pressure): test_factor_conversion 5 OK, test_studio_actions 46 OK,
  test_studio_strategy 7 OK, test_portfolio_explorer 22 OK, test_studies 11
  OK, test_intake 50 OK, test_factor_lab 16/17; the one failure
  (`test_bounded_researcher_keep_is_visible_in_studio`) fails identically on
  base `d744d6d`.
- `npx tsc -b --noEmit` 0; `npm run build` 0 (no EPERM);
  `node studio-app/tests/run-idea-answer.cjs` 72/72; `ui-inventory --check` 0.
- `code-intel sentrux check autoquant` 0 (coupling 116.51 -> 115.91);
  `code-intel sentrux check studio-app/src` 0 (59.48 -> 58.94).
- `uv run python scripts/check_doc_links.py` 0.
- Browser walk (Edge, 1440x900) on a scratch copy `D:\tmp\f2p\ws`: desk
  `five-day-momentum-strategy`; first Portfolio Run
  `run-20261103T091455755034Z-74716225459f` succeeded (validation net Sharpe
  31.14 on synthetic data); Studio verdict Inconclusive because the selection
  adjustment is `insufficient-successful-sharpe-trials` over 3 effective
  trials (1 own + 2 inherited). Source tree hash unchanged (294 files,
  `d0873ea3...`).

## Progress log

- 2026-11-03 — Plan created; Core, Studio, docs and tests implemented;
  end-to-end browser walk completed on a scratch Workspace copy.
