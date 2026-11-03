# Full Factor tear sheet

- Status: `active`
- Updated: `2026-11-03`
- Issue: https://github.com/2233admin/Auto-Quant-V3/issues/9
- Related design: [[docs/design/factor-diagnostics]], [[docs/design/factor-evidence-explorer]], [[docs/design/study-run-evidence]]

## Outcome

New Factor Runs publish versioned 3/5/10-group returns, turnover, cost disclosure,
rank persistence and complete request-bounded IC decay. Studio renders only verified,
visible published evidence. Historical Studies and Runs retain their bytes.

## Context and scope

The fixed legacy tertile artifacts and verdict stay unchanged. New computation and
readers live in separate modules. The actual checkout Judge began at 2,666 lines
(the brief quoted 2,657); it now meets the stricter 2,657-line cap. The Factor
Explorer remains 5,245 lines. Existing Projects own their pinned Judge
copies: only newly constructed Projects/Studies that explicitly use the new Judge
receive this artifact. Harness runtime changes receive a new runtime hash.

## Acceptance

- [x] Freeze and validate quantile count, preserving absent/default 3 identity.
- [x] Publish all split diagnostics with sparse/short-sample and cost boundaries.
- [x] Verify/project versioned artifact; historical absence is explicit.
- [x] Show six bilingual FigureCards in the Factor Evidence tab with test gating.
- [x] Compare independent reference formulas within 1e-9 and test malformed evidence.
- [x] Prove sample Study/Run identity; regenerate no checked-in immutable Run.
- [x] Execute every requested check and capture the exact caller-specified scratch source.
- [ ] Full acceptance: resolve the pre-existing POSIX-shell test environment and obtain authenticated real-market proof. The supplied source is explicitly synthetic.

## Work

- [x] Core contracts, standalone computation, Judge integration and reader.
- [x] Studio, catalogue, design documentation and attribution.
- [x] Deterministic parity, regressions, caller-source proof and completion audit.

## Findings and decisions

- 2026-11-03 — Issue read with GitHub connector after required gh command returned HTTP 401.
- 2026-11-03 — Minimum group membership N=1, necessary for the caller's five-asset
  proof; singleton groups are disclosed. Groups with fewer members are refused,
  never filled. Short sample means fewer than 20 usable bar observations per statistic.
- 2026-11-03 — Retain Core split purging, average-tie Spearman, unannualized units
  and HAC inference. The additional diagnostics do not enter selection or verdicts.
- 2026-11-03 — No checked-in fixture, Study, immutable Run or pinned Judge was
  regenerated/relocked. All 441 sample files, including 19 Run result files and
  three Study manifests, retain identical SHA-256. All three absent quantile
  fields retain effective default 3 and exact serialization. Only the template
  Judge changes hash; existing Project-local Judge copies remain untouched.
- 2026-11-03 — The scratch copy retains every old Run and Judge. New Study
  `ohlcv-factor-tearsheet-proof` freezes five groups and separately copied
  `judges/ohlcv_factor_tearsheet.py`. Two engineering Runs preserve initial and
  final Harness closures; no hypothesis, candidate or numerical authority was
  tuned between them. Final Run: `run-20261103T010315924818Z-474ddb4d826c`.
- 2026-11-03 — The caller-specified five-asset source has dataset id
  `synthetic-daily-demo` and deterministic synthetic OHLCV. Copy/proof succeeded,
  but it cannot truthfully be called real-market evidence. No invented data
  provenance or transaction costs were substituted.

## Verification

All logs and screenshots are under `D:/tmp/tearsheet/`.

| Exact command / condition | Exit | Evidence |
| --- | --- | --- |
| `uv run python -m unittest tests.test_factor_tearsheet tests.test_factor_explorer tests.test_factor_redundancy tests.test_factor_lab tests.test_studio tests.test_run_compare tests.test_studies -v` | 1 | 84 tests, 82 pass, two existing `/bin/sh`-dependent failures; `python-tests-final.log` |
| `uv run python -m unittest tests.test_factor_tearsheet -v` | 0 | 9 pass, including independent 5/10-bin parity within 1e-9; `parity-final.log` |
| Same two failing test methods on a clean archive of `46801c2` | 1 | 2 tests, same external-researcher failures; `baseline-platform-tests.log`; host has no `/bin/sh` |
| `cd studio-app; npx tsc -b --noEmit` | 0 | `typecheck.log` |
| `cd studio-app; npm run build` | 1 | junctioned `node_modules/.vite-temp` EPERM; `build.log` |
| `cd studio-app; npm run build -- --configLoader runner` | 0 | `build-final.log`; package scripts unchanged |
| `node studio-app/tests/run-idea-answer.cjs` | 0 | 67 pass; `frontend-tests.log` |
| `cd studio-app; node scripts/ui-inventory.cjs --check` | 0 | 0 untranslated strings; `ui-inventory.log` |
| `code-intel sentrux check autoquant` | 0 | coupling 116.51 -> 115.22, quality 0 -> 0, god files 41 -> 41; `gate-core.log` |
| `code-intel sentrux check studio-app/src` | 0 | coupling 59.48 -> 58.55, quality 9164 -> 9171, god files 3 -> 3; `gate-studio.log` |
| `uv run python scripts/check_doc_links.py` | 0 | 1971 links at this checkpoint; final count recorded in `doc-links.log` |
| `git diff --exit-code HEAD -- projects/sample-research-desk` | 0 | `fixture-identity.json`, all 441 hashes match |
| `aq study create ... --quantiles 5`, `aq run execute ...` through `uv run` | 0 / 0 | exact CLI construction and final result in `proof-study.json`, `proof-run-final.json` |
| `uv run aq studio serve D:/tmp/tearsheet/ws --port 8971` and installed Edge / Playwright | 0 | six rendered figures, Chinese + English + old-not-published screenshots, console errors 0 |

Validation (35 primary bars): Q1..Q5 means = -0.004379560710384538,
-0.0021488620867539778, 0.0003466318469090021, 0.0015042119595994028,
0.003820107396330303. Gross spread mean = 0.008199668106714842;
net = null (no cost model). Per-group turnover = 0.08823529411764706,
0.17647058823529413, 0.23529411764705882, 0.23529411764705882,
0.08823529411764706 (34 transitions each); equal-group mean = 0.1647058823529412.
IC at horizon 1 = 0.8085714285714284, at H=5 = 0.6258064516129029.

Visual inspection and limitations: [[plans/full-factor-tear-sheet-qa]]. The plan
remains Active for owner acceptance of the explicit environment/data-source gaps.

## Progress log

- 2026-11-03 — Registered before implementation.
- 2026-11-03 — Implementation, numerical tests, scratch Run and bilingual browser
  evidence delivered. `git add` and `git commit` both returned 128 because the
  sandbox cannot create the owning repository's worktree `index.lock`. Changes
  remain uncommitted; intended message is UTF-8 without BOM at
  `D:/tmp/tearsheet/commit-message.txt`, ending in the requested Codex co-author.
  No push or PR was attempted. Issue #9 receipt write was rejected by the
  connector's `approval policy: never`; gh authentication also returns 401.
  No remote tracker write occurred. Local receipt retained for the supervisor
  at `D:/tmp/tearsheet/issue-9-receipt.md`.
- 2026-11-03 — Task-owned Studio process IDs 13204, 34728, 17904 and 40052
  were stopped by exact PID; no port-8971 listener remained. Automatic approval
  review rejected the temporary baseline/cache cleanup command with `blocked
  by policy`; these generated scratch directories remain under `D:/tmp/tearsheet`.
