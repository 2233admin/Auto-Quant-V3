#!/usr/bin/env python3
"""Run `python -m unittest` with a no-progress watchdog and slow-test markers.

Usage (the arguments are handed to unittest unchanged):
    python scripts/unittest_watchdog.py discover -s tests -v

Environment:
    AUTOQUANT_TEST_WATCHDOG_SECONDS  dump every thread's stack to stderr when no test
                                     starts or finishes for this long, and again every
                                     period while the run stays stuck; the run is never
                                     killed. 0 disables it. Default 300.
    AUTOQUANT_TEST_SLOW_SECONDS      after a test that took at least this long, write
                                     a `[slow 42.3s] <test>` line. Default 30.

scripts/check_known_failures.py runs the suite through this file.
"""

from __future__ import annotations

import faulthandler
import os
import sys
import time
import unittest

WATCHDOG_ENV = "AUTOQUANT_TEST_WATCHDOG_SECONDS"
SLOW_ENV = "AUTOQUANT_TEST_SLOW_SECONDS"
DEFAULT_WATCHDOG_SECONDS = 300.0
DEFAULT_SLOW_SECONDS = 30.0


def seconds_from_env(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        raise SystemExit(f"{name} must be a number of seconds, got {raw!r}") from None
    if value < 0:
        raise SystemExit(f"{name} must not be negative, got {raw!r}")
    return value


class WatchdogResult(unittest.TextTestResult):
    """TextTestResult that re-arms the watchdog at every test boundary and marks slow tests."""

    watchdog_seconds = DEFAULT_WATCHDOG_SECONDS
    slow_seconds = DEFAULT_SLOW_SECONDS

    @classmethod
    def arm(cls) -> None:
        """Restart the countdown; faulthandler replaces a pending timer on every call."""

        if cls.watchdog_seconds > 0:
            faulthandler.dump_traceback_later(
                cls.watchdog_seconds, repeat=True, file=sys.__stderr__ or sys.stderr
            )

    def startTest(self, test: unittest.TestCase) -> None:
        self._started = time.monotonic()
        self.arm()
        super().startTest(test)

    def stopTest(self, test: unittest.TestCase) -> None:
        super().stopTest(test)
        # Keep watching the gap before the next test: class and module fixtures run there.
        self.arm()
        elapsed = time.monotonic() - self._started
        if elapsed >= self.slow_seconds:
            self.stream.writeln(f"[slow {elapsed:.1f}s] {test}")
            self.stream.flush()


class WatchdogRunner(unittest.TextTestRunner):
    resultclass = WatchdogResult


def main(argv: list[str] | None = None) -> int:
    WatchdogResult.watchdog_seconds = seconds_from_env(
        WATCHDOG_ENV, DEFAULT_WATCHDOG_SECONDS
    )
    WatchdogResult.slow_seconds = seconds_from_env(SLOW_ENV, DEFAULT_SLOW_SECONDS)
    arguments = list(sys.argv[1:] if argv is None else argv)
    # Output goes to a pipe: make print() lines from tests arrive while the test runs.
    sys.stdout.reconfigure(line_buffering=True)
    # `python -m unittest` puts the working directory first on sys.path; a script puts its own directory.
    sys.path[0] = os.getcwd()
    WatchdogResult.arm()  # covers discovery and imports before the first test
    try:
        program = unittest.main(
            module=None,
            argv=["python -m unittest", *arguments],
            testRunner=WatchdogRunner,
            exit=False,
        )
    finally:
        faulthandler.cancel_dump_traceback_later()
    return 0 if program.result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
