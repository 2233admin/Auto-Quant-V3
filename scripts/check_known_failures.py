"""Compare a full unittest run with the recorded known-failure baseline.

Usage:
    uv run python scripts/check_known_failures.py            # run the suite
    uv run python scripts/check_known_failures.py --log FILE  # parse an existing -v log

Failures from the first pass are rerun once in a single process, so tests that
only failed because a crowded machine could not start a subprocess do not count.
Exit 1 when a persistent failure is not listed in tests/known_failures.json.
Listed entries that now pass are reported so the change that fixed them can
remove them.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "tests" / "known_failures.json"
RESULT = re.compile(r"^(\w+) \(([\w.]+)\)(?:.*)? \.\.\. (FAIL|ERROR)$", re.MULTILINE)
SUMMARY = re.compile(r"^(?:FAIL|ERROR): (\w+) \(([\w.]+)\)", re.MULTILINE)
RAN = re.compile(r"^Ran (\d+) tests? in ", re.MULTILINE)


def failing_ids(log: str) -> set[str]:
    """Test ids (module.Class.test, without the tests. prefix) that failed or errored."""

    ids = set()
    for name, qualified in SUMMARY.findall(log) + [(m[0], m[1]) for m in RESULT.findall(log)]:
        dotted = qualified if qualified.endswith("." + name) else f"{qualified}.{name}"
        ids.add(dotted.removeprefix("tests."))
    return ids


def tests_ran(log: str) -> int:
    """Number of tests the log reports; raises when the run never reached unittest's summary."""

    found = RAN.findall(log)
    if not found:
        raise SystemExit("unittest did not report a 'Ran N tests' line; the suite did not run:\n" + log[-2000:])
    return int(found[-1])


def run_unittest(arguments: list[str]) -> str:
    completed = subprocess.run(
        [sys.executable, "-m", "unittest", *arguments, "-v"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return completed.stdout + completed.stderr


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--log", type=Path, help="existing `unittest discover -v` log to parse instead of running the suite")
    parser.add_argument("--no-rerun", action="store_true", help="do not rerun first-pass failures in isolation")
    options = parser.parse_args()

    known = {entry["id"]: entry for entry in json.loads(REGISTRY.read_text(encoding="utf-8"))["failures"]}
    log = options.log.read_text(encoding="utf-8", errors="replace") if options.log else run_unittest(["discover", "-s", "tests"])
    ran = tests_ran(log)
    first = failing_ids(log)
    persistent = first
    if first and not options.no_rerun:
        rerun = run_unittest(sorted("tests." + test for test in first))
        tests_ran(rerun)
        persistent = failing_ids(rerun)

    flaky = sorted(first - persistent)
    new = sorted(persistent - known.keys())
    fixed = sorted(known.keys() - persistent)
    print(f"tests run: {ran}; first pass failures: {len(first)}; persistent after rerun: {len(persistent)}; known: {len(known)}")
    for label, tests in (("passed on rerun (resource flakes)", flaky), ("NEW failures", new), ("known failures now passing; remove them", fixed)):
        if tests:
            print(f"{label}:")
            for test in tests:
                print(f"  {test}")
    return 1 if new else 0


if __name__ == "__main__":
    raise SystemExit(main())
