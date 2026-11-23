# Test baseline and known failures

The full suite (`uv run python -m unittest discover -s tests -v`) does not pass
on every platform yet. This document and its registry make the baseline
explicit, so that a regression is visible instead of being lost among
long-standing failures.

## Registry

`tests/known_failures.json` lists every test that still fails when rerun alone
on an idle machine, with its platform, category, cause and GitHub issue:

- `product-defect`: the product behaves wrongly on that platform (for example
  the external researcher driver starting `/bin/sh` on Windows, issue #19).
- `test-portability`: the test assumes one platform (CRLF checkouts, the POSIX
  virtual-environment layout), issue #20.
- `unexplained`: the cause is not known yet; it still needs an issue.

Recording a failure here does not accept it. Every entry points at an issue,
and the change that fixes a test removes its entry in the same commit.

Historical sample Projects may retain Judges pinned to immutable Run evidence.
`test_repository_workspace` excludes the sample Judge from fresh-template
parity and checks it byte-for-byte against the selected Run's
`inputs/judge-sources/judges/ohlcv_factor.py` snapshot. Fresh-project Judge
execution and diagnostics are covered by `test_factor_redundancy`.

## Checking a change

```bash
uv run python scripts/check_known_failures.py
```

The script runs the full suite, reruns every first-pass failure once in a
single process, and compares the persistent failures with the registry:

- exit 1 when a persistent failure is not registered (a new failure);
- registered tests that now pass are listed for removal;
- tests that failed only in the first pass are reported as resource flakes.
  On Windows a crowded machine makes subprocesses fail to start
  (`0xC0000142`, `STATUS_DLL_INIT_FAILED`), which then surfaces as
  "Cannot start a research Session from a failed baseline Run". On
  2026-11-03, 48 of 61 first-pass failures were of this kind.

`--log FILE` parses an existing `unittest -v` log instead of running the suite;
`--no-rerun` skips the isolation rerun.

## Watching a long run

The full suite takes 26 to 34 minutes on `ubuntu-latest` and has hit the 45 minute
timeout of the CI `regression` job twice (issue #39), so the script shows what it is
doing instead of printing only at the end:

- Live output: everything unittest writes is echoed as it happens, in the first
  pass and in the rerun. `test_x (...) ... ` appears when a test starts and `ok`,
  `FAIL` or `ERROR` when it ends, so a job cancelled by the timeout still shows the
  test it was in. Failure tracebacks appear at the end of each pass. Stdout and
  stderr of the child are read separately, so text a test prints to stdout can
  land a few lines away from the test's result line.
- Hang dump: the suite runs through `scripts/unittest_watchdog.py`, a wrapper
  around `python -m unittest` that takes the same arguments, discovery and exit
  codes. When no test starts or finishes for `--watchdog SECONDS` (default 300;
  `0` turns it off), Python's `faulthandler` dumps the stacks of all threads to
  stderr (`Timeout (0:05:00)!` followed by `File "...", line N in test_x`), and
  again every period while the run stays stuck. The dump interrupts the stuck
  test's half-written result line. It only reports; the test and the run go on.
  The countdown restarts between tests too, so a hang in discovery or in a class
  or module fixture is caught as well.
- Slow tests: a test that takes `--slow SECONDS` (default 30) or more is marked
  with a `[slow 41.2s] test_x (...)` line after its result. The summary after the
  verdict lists up to 15 of them, slowest first; rerun entries carry a `(rerun)`
  suffix. unittest's own `--durations` needs Python 3.12 and CI runs 3.11, so the
  wrapper measures from `startTest` to `stopTest` (test body, `setUp` and
  `tearDown`; class and module fixtures are not counted). A log parsed with `--log` lists
  only the markers it already contains.
- Defaults come from the environment variables `AUTOQUANT_TEST_WATCHDOG_SECONDS`
  and `AUTOQUANT_TEST_SLOW_SECONDS`; the flags win.

To diagnose a CI timeout, read the end of the `regression` log: the last
`test_x (...) ... ` fragment names the test that was running, and the last
`Timeout (...)!` dump shows where it was stuck.

`tests/test_check_known_failures.py` covers this behaviour with a small fake
suite: live output, the stack dump, the slow-test summary, and the unchanged exit
codes and known-failure semantics.

## Rules

- Do not add an entry to make a change pass. A new failure is fixed, or the
  change is held, unless the owner explicitly accepts it with an issue.
- Run the suite on an idle machine where possible; concurrent test runs,
  builds or agents inflate the first pass.
