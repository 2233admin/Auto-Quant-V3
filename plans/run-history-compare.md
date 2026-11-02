# Run history and same-baseline comparison

- Status: `active` (implementation complete; integrated into main)
- Updated: `2026-11-03`
- Issue: https://github.com/2233admin/Auto-Quant-V3/issues/6
- Related design: [[docs/design/run-comparability]]

## Outcome

Browse immutable Runs across the Workspace, filter and sort them, and compare
two verified measurements only under the same evaluation authority.

## Acceptance and work

- [x] Core history projection and strict comparability with mismatch tests.
- [x] Bounded read endpoints with test-audit gating and no research mutations.
- [x] Bilingual history filters, selection reasons, metrics, figures and facts.
- [x] Run all required checks and record exact results and environment limitations.
- [x] Browser evidence on the copied Workspace.

## Findings and decisions

- Reuse immutable RunResult and Experiment verdicts; standalone Runs retain their
  Core execution status instead of receiving an invented scientific verdict.
- Require exact Study identity; no implicit cross-Study equivalence registry.
- Keep missing protocol authority explicit and refuse comparison conservatively.
- GitHub CLI authentication fails (401); connected GitHub can read issue #6.

## Verification

All commands run from the repository root unless a working directory is named.
Python commands used `UV_CACHE_DIR=D:/tmp/compare/uv-cache` because the host's
configured `E:/cache/uv` is outside this session's writable roots.

- `uv run python -m unittest tests.test_run_compare tests.test_run_history`:
  exit 0, 19 tests passed.
- `uv run python -m unittest tests.test_run_compare tests.test_run_history tests.test_studio_actions tests.test_studio tests.test_factor_explorer`:
  exit 1, 87 tests, 85 passed and two pre-existing environment failures.
  `test_real_cancel_kills_the_whole_process_tree` cannot observe its child because
  Windows `tasklist /FI "PID eq ..." /NH` returns Access denied. The progress
  campaign test depends on the existing `/bin/sh` execution path, unavailable on
  this Windows host. Neither test nor its unrelated execution implementation was
  modified or skipped. The isolated progress-test retry also failed.
- In `studio-app`, `npx tsc -b --noEmit`: exit 0.
- In `studio-app`, `npm run build`: exit 1, EPERM writing Vite's temporary
  configuration into junctioned node_modules. The authorized
  `npm run build -- --configLoader runner`: exit 0, 204 modules transformed;
  package.json scripts unchanged.
- `node studio-app/tests/run-idea-answer.cjs`: exit 0, 48 tests passed,
  including eight new comparison tests.
- In `studio-app`, `node scripts/ui-inventory.cjs --check`: exit 0,
  zero uncovered strings.
- `code-intel sentrux check autoquant`: exit 0, god files 41 -> 41,
  coupling 119.39 -> 117.26; no baseline edits.
- `code-intel sentrux check studio-app/src`: exit 0, god files 3 -> 3,
  coupling 59.42 -> 58.99, max_cc constraint 20 retained; no baseline edits.
- `uv run python scripts/check_doc_links.py`: exit 0, 1938 links resolved.
- Installed Playwright and Edge: `python D:/tmp/compare/browser_check.py`,
  exit 0. Served a copy of `D:/tmp/aq-idea/ws-merge` at `D:/tmp/compare/ws`
  using `uv run aq studio serve D:/tmp/compare/ws --port 8931`. Checked
  27 real Runs, object/lane/verdict/Project/date/search filters, sorting,
  comparable selection and navigation, refused selection and direct-route
  refusal, Chinese default, English, and no script errors or horizontal overflow.
  Six 1440x900 screenshots and browser-results.json are under D:/tmp/compare.

## Completion

Implementation and verification are retained locally for issue #6. No research
was executed in the browser evidence Workspace. `autoquant/runs.py`, PLANS.md,
structural baselines and package.json scripts are unchanged. The two
environment-dependent tests remain an explicit verification limit.

Local delivery is blocked: both `git add` and `git commit` fail because Git cannot
create `D:/projects/.worktrees/aqv2-fork/.git/worktrees/aqv3-compare/index.lock`.
`icacls` confirms an explicit write-deny entry on this worktree's Git metadata;
the restriction was not changed or bypassed. HEAD remains `2357ca6`. The intended
commit message with the requested co-author trailer is retained at
`D:/tmp/compare/commit-message.txt`. No push or PR was attempted.

A receipt comment to existing issue #6 was attempted through the connected
GitHub tool after the CLI returned 401. The tool rejected the write because
approval is required while this session's approval policy is `never`; the
comment was not published. No completion flag is written while the requested
local commit remains outstanding. Issue acceptance belongs to the owner.
