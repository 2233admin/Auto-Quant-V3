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

## Rules

- Do not add an entry to make a change pass. A new failure is fixed, or the
  change is held, unless the owner explicitly accepts it with an issue.
- Run the suite on an idle machine where possible; concurrent test runs,
  builds or agents inflate the first pass.
