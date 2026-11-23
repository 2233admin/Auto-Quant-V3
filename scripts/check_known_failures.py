"""Compare a full unittest run with the recorded known-failure baseline.

Usage:
    uv run python scripts/check_known_failures.py            # run the suite
    uv run python scripts/check_known_failures.py --log FILE  # parse an existing -v log
    uv run python scripts/check_known_failures.py --watchdog 120 --slow 10

Failures from the first pass are rerun once in a single process, so tests that
only failed because a crowded machine could not start a subprocess do not count.
Exit 1 when a persistent failure is not listed in tests/known_failures.json.
Listed entries that now pass are reported so the change that fixed them can
remove them.

While a pass runs, everything unittest writes is echoed as it happens, so a hung
job shows the test it is stuck in. The suite runs through scripts/unittest_watchdog.py:
when no test starts or finishes for --watchdog seconds, every thread's stack is
dumped to stderr (the run keeps going), and tests that take at least --slow
seconds are listed again after the result.
"""

from __future__ import annotations

import argparse
import codecs
import io
import json
import os
import re
import subprocess
import sys
import threading
from pathlib import Path
from typing import IO

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "tests" / "known_failures.json"
RUNNER = Path(__file__).with_name("unittest_watchdog.py")
SUITE = ["discover", "-s", "tests"]
WATCHDOG_ENV = "AUTOQUANT_TEST_WATCHDOG_SECONDS"
SLOW_ENV = "AUTOQUANT_TEST_SLOW_SECONDS"
DEFAULT_WATCHDOG_SECONDS = 300.0
DEFAULT_SLOW_SECONDS = 30.0
SLOW_LISTED = 15
RESULT = re.compile(r"^(\w+) \(([\w.]+)\)(?:.*)? \.\.\. (FAIL|ERROR)$", re.MULTILINE)
SUMMARY = re.compile(r"^(?:FAIL|ERROR): (\w+) \(([\w.]+)\)", re.MULTILINE)
RAN = re.compile(r"^Ran (\d+) tests? in ", re.MULTILINE)
SLOW = re.compile(r"^\[slow (\d+(?:\.\d+)?)s\] (.+)$", re.MULTILINE)


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


def slow_tests(log: str) -> list[tuple[float, str]]:
    """(seconds, test) pairs the runner marked slow, slowest first."""

    return sorted(((float(seconds), test) for seconds, test in SLOW.findall(log)), reverse=True)


def echo(text: str) -> None:
    try:
        sys.stdout.write(text)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or "ascii"
        sys.stdout.write(text.encode(encoding, "replace").decode(encoding))
    sys.stdout.flush()


def pump(stream: IO[bytes], parts: list[str], lock: threading.Lock) -> None:
    """Echo a child pipe as chunks arrive, even half a line, and keep the text for the parser."""

    # Same newline translation text=True gave the old capture: the regexes anchor on "\n".
    decoder = io.IncrementalNewlineDecoder(codecs.getincrementaldecoder("utf-8")(errors="replace"), translate=True)
    echoing = True
    while True:
        chunk = stream.read1(65536)
        text = decoder.decode(chunk, final=not chunk)
        if text:
            parts.append(text)
            if echoing:
                try:
                    with lock:
                        echo(text)
                except (OSError, ValueError):
                    # stdout is gone (`| head`, closed): keep draining so the child never blocks on a full pipe.
                    echoing = False
        if not chunk:
            return


def run_unittest(arguments: list[str], *, watchdog: float, slow: float) -> str:
    """Run unittest in a child process, echoing its output live; returns stdout then stderr."""

    environment = {**os.environ, WATCHDOG_ENV: str(watchdog), SLOW_ENV: str(slow)}
    out: list[str] = []
    err: list[str] = []
    lock = threading.Lock()
    with subprocess.Popen(
        [sys.executable, str(RUNNER), *arguments, "-v"],
        cwd=ROOT,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ) as process:
        try:
            pumps = [
                threading.Thread(target=pump, args=(process.stdout, out, lock), daemon=True),
                threading.Thread(target=pump, args=(process.stderr, err, lock), daemon=True),
            ]
            for thread in pumps:
                thread.start()
            for thread in pumps:
                thread.join()
            process.wait()
        finally:
            if process.poll() is None:
                process.kill()
    return "".join(out) + "".join(err)


def seconds(value: str) -> float:
    try:
        number = float(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a number of seconds: {value!r}") from None
    if number < 0:
        raise argparse.ArgumentTypeError(f"must not be negative: {value!r}")
    return number


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--log", type=Path, help="existing `unittest discover -v` log to parse instead of running the suite")
    parser.add_argument("--no-rerun", action="store_true", help="do not rerun first-pass failures in isolation")
    parser.add_argument(
        "--watchdog",
        type=seconds,
        default=os.environ.get(WATCHDOG_ENV) or str(DEFAULT_WATCHDOG_SECONDS),
        metavar="SECONDS",
        help=f"dump all thread stacks to stderr when no test starts or finishes for this long; 0 disables (default {DEFAULT_WATCHDOG_SECONDS:g}, env {WATCHDOG_ENV})",
    )
    parser.add_argument(
        "--slow",
        type=seconds,
        default=os.environ.get(SLOW_ENV) or str(DEFAULT_SLOW_SECONDS),
        metavar="SECONDS",
        help=f"list tests that take at least this long in the final summary (default {DEFAULT_SLOW_SECONDS:g}, env {SLOW_ENV})",
    )
    options = parser.parse_args(argv)

    known = {entry["id"]: entry for entry in json.loads(REGISTRY.read_text(encoding="utf-8"))["failures"]}
    rerun = ""
    if options.log:
        log = options.log.read_text(encoding="utf-8", errors="replace")
    else:
        print(f"== first pass: unittest {' '.join(SUITE)} (watchdog {options.watchdog:g}s, slow >= {options.slow:g}s)", flush=True)
        log = run_unittest(SUITE, watchdog=options.watchdog, slow=options.slow)
    ran = tests_ran(log)
    first = failing_ids(log)
    persistent = first
    if first and not options.no_rerun:
        print(f"== rerun: {len(first)} first-pass failures in one process", flush=True)
        rerun = run_unittest(sorted("tests." + test for test in first), watchdog=options.watchdog, slow=options.slow)
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
    slow = sorted(slow_tests(log) + [(took, f"{test} (rerun)") for took, test in slow_tests(rerun)], reverse=True)
    if slow:
        print("slow tests, slowest first:")
        for took, test in slow[:SLOW_LISTED]:
            print(f"  {took:7.1f}s  {test}")
        if len(slow) > SLOW_LISTED:
            print(f"  ... and {len(slow) - SLOW_LISTED} more")
    return 1 if new else 0


if __name__ == "__main__":
    raise SystemExit(main())
