# Workspace Factor redundancy diagnostics

- Status: `active`
- Updated: `2026-11-03`
- Related design: [[docs/design/factor-redundancy]], [[docs/design/factor-component-attribution]], [[docs/design/run-comparability]]

## Outcome

Issue #8: expose validation-only overlap and residual rank IC against comparable
Workspace factors in Core, aq JSON, the Factor workbench and library.

## Context

Historical Runs publish aggregate IC and quantiles but not factor/outcome pairs.
They must remain unavailable rather than reconstructing candidate or Judge output.

## Scope

- Publish validation-only factor/outcome pairs for future Factor Runs.
- Reuse protocol identities and component centered-rank residual mathematics.
- Preserve immutable verdicts, test visibility, historical evidence and baselines.
- No push, PR, trading action or mutation of the source proof Workspace.

## Acceptance

- [x] Verified artifacts, exact evaluation basis, latest successful source peers.
- [x] Core/CLI/Studio parity, bilingual catalogue, table and overlap line.
- [x] Synthetic regression coverage and all required verification commands executed.
- [x] Copied Workspace served read-only; Chinese/English 1440x900 boundary screenshots.
- [ ] Requested numeric momentum/reversal proof: historical Runs lack pairs and
  their dataset hashes differ; new coherent proof authority remains unapproved.
- [ ] Entire requested Python suite green: two failures also reproduce on HEAD.

## Work

- [x] Read issue and subsystem contracts; identify historical evidence gap.
- [x] Implement artifact publication and independent redundancy module.
- [x] Integrate Studio and document public contract.
- [x] Run checks, capture available proof and audit remaining gaps.

## Findings and decisions

- 2026-11-03: gh authentication returns 401; the connected GitHub reader works.
- 2026-11-03: old momentum/reversal Runs have no raw factor/outcome artifact.
  Requested permission for new proof-only Studies/Runs in the disposable copy.
- 2026-11-03: dataset id matches, but momentum dataset hash is
  `22dfc589c8ba80753f878effebceb1716d77a9931250261764cfd9719f169016` and
  reversal hash is `11c8b6612158f9f2cff6613b91355b8778823fbdbeecafcf64f521ecb337f2c6`.
  Exact content authority is retained rather than relaxed for screenshots.
- 2026-11-03: Browser Bridge skill delegated read-only capture to
  `/root/browser_proof`, with exclusive ownership of new Edge tab 445300433;
  root independently inspected workbench, library and peer-section screenshots.
- 2026-11-03: No third-party code copied; component rank residual math reused.
- 2026-11-03: `git add` and `git commit` failed creating the parent worktree's
  `index.lock` (permission denied). Changes remain uncommitted. Intended message:
  `D:/tmp/redundancy/commit-message.txt`, including the required Co-Authored-By.
- 2026-11-03: Cleanup of the temporary HEAD archive checkout and an accidental
  modal screenshot was rejected by automatic policy (`blocked by policy`).
- 2026-11-03: Attempted the required receipt comment on GitHub #8 through the
  connected GitHub tool. It was rejected: tool requires approval, approval
  policy is `never`. gh itself is unauthenticated (401). Local receipt retained
  at `D:/tmp/redundancy/issue-8-receipt.md`; remote tracker update is outstanding.

## Verification

Commands run at repository root unless stated. `UV_CACHE_DIR=D:/tmp/uv-cache`
was necessary because the host default `E:/cache/uv` is outside writable roots.

- `uv run python -m unittest tests.test_factor_redundancy`: exit 0, 13 tests.
  Includes two genuinely published immutable synthetic Runs, with opposite
  factor sources: correlation -1, residual rank IC 0, plus tamper rejection.
- `uv run python -m unittest tests.test_factor_redundancy tests.test_factor_explorer tests.test_studio tests.test_run_compare tests.test_studio_actions`:
  exit 1, 91 tests, 89 passed, 2 failed. Failures:
  `test_running_progress_is_mutable_then_replaced_by_terminal_campaign` and
  `test_real_cancel_kills_the_whole_process_tree`. Both reproduced in isolation
  on unchanged `git archive HEAD` at `0c8d414` (exit 1, 2/2 failed).
  Logs: `D:/tmp/redundancy/python-tests-final.log`,
  `D:/tmp/redundancy/baseline-regressions.log`.
- In `studio-app`: `npx tsc -b --noEmit`: exit 0.
- In `studio-app`: `npm run build`: exit 1, EPERM opening junctioned
  `node_modules/.vite-temp`. `npm run build -- --configLoader runner`: exit 0.
  No package script changed; generated serving bundle is included.
- `node studio-app/tests/run-idea-answer.cjs`: exit 0, 63/63 passed.
- In `studio-app`: `node scripts/ui-inventory.cjs --check`: exit 0, 0 strings.
- `code-intel sentrux check autoquant`: exit 0; coupling 116.51 -> 116.36,
  quality 0 -> 0, god files 41 -> 41. No baseline re-save.
- `code-intel sentrux check studio-app/src`: exit 0; coupling 59.48 -> 59.42,
  quality 9164 -> 9164, god files 3 -> 3. No baseline re-save.
- `uv run python scripts/check_doc_links.py`: exit 0, 1958 links resolve.
- `git diff --check`: exit 0. `factor_explorer.py`: 5246 -> 5245 lines.
- `uv run aq studio serve D:/tmp/redundancy/ws --port 8961`: served the copy;
  source `D:/tmp/aq-idea/ws-merge` was read only. No research was rerun there.
- `uv run aq run factor D:/tmp/redundancy/ws --project five-day-reversal --run run-20261101T085054286814Z-07d4dc2d243d --json`:
  exit 0; redundancy unavailable, reason `missing-validation-pairs`.
- Actual 1440x900 screenshots in `D:/tmp/redundancy/`:
  `workbench-zh-clean.png`, `peers-zh.png`, `library-zh.png`, `evidence-en.png`.
  Browser console: 0 errors. These prove unavailable states, not numeric overlap.

## Progress log

- 2026-11-03: Plan registered before implementation.

## Completion

Implementation is reviewable; numeric proof and host-wide green verification
remain outstanding. The plan stays active and no `done.flag` is written.
