"""scripts/check_known_failures.py: live output, hang dump, slow-test summary, exit codes.

The runs use a tiny fake `tests` package in a temporary directory, so they do not
touch the real suite and finish in a few seconds.
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
from pathlib import Path
from types import ModuleType
from unittest import mock

PROJECT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS = PROJECT_DIR / "scripts"

FAKE_TESTS = textwrap.dedent(
    """
    import os
    import time
    import unittest


    class FakeTests(unittest.TestCase):
        def test_always_fails(self):
            self.fail("fake failure")

        def test_fast(self):
            pass

        def test_sleeps_past_the_watchdog(self):
            time.sleep(float(os.environ.get("FAKE_SLEEP", "0")))
    """
)
FAILING = "test_fake.FakeTests.test_always_fails"
SLEEPING = "test_fake.FakeTests.test_sleeps_past_the_watchdog"


def load_script(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(f"_aq_{name}", SCRIPTS / f"{name}.py")
    if spec is None or spec.loader is None:
        raise AssertionError(f"cannot load scripts/{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TimedOutput(io.StringIO):
    """Stdout stand-in that remembers when each piece of text arrived."""

    def __init__(self) -> None:
        super().__init__()
        self.chunks: list[tuple[float, str]] = []

    def write(self, text: str) -> int:
        self.chunks.append((time.monotonic(), text))
        return super().write(text)

    def first_seen(self, needle: str) -> float:
        for moment, text in self.chunks:
            if needle in text:
                return moment
        raise AssertionError(f"{needle!r} was never written:\n{self.getvalue()}")


class FakeSource:
    """A chunked byte stream with the read1 the pump uses."""

    def __init__(self, *chunks: bytes) -> None:
        self.chunks = list(chunks)

    def read1(self, size: int) -> bytes:
        return self.chunks.pop(0) if self.chunks else b""


class CheckKnownFailuresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.script = load_script("check_known_failures")
        cls.runner = load_script("unittest_watchdog")

    def setUp(self) -> None:
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name)
        (self.root / "tests").mkdir()
        (self.root / "tests" / "__init__.py").write_text("", encoding="utf-8")
        (self.root / "tests" / "test_fake.py").write_text(FAKE_TESTS, encoding="utf-8")
        patches = (
            mock.patch.object(self.script, "ROOT", self.root),
            mock.patch.object(self.script, "REGISTRY", self.root / "tests" / "known_failures.json"),
            mock.patch.dict(os.environ, {"FAKE_SLEEP": "0"}),
        )
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def register(self, *ids: str) -> None:
        entries = [{"id": test, "platform": "all", "category": "unexplained", "cause": "fake", "issue": 0} for test in ids]
        (self.root / "tests" / "known_failures.json").write_text(json.dumps({"failures": entries}), encoding="utf-8")

    def check(self, *arguments: str) -> tuple[int, TimedOutput, float]:
        out = TimedOutput()
        with contextlib.redirect_stdout(out):
            code = self.script.main(list(arguments))
        return code, out, time.monotonic()

    def write_log(self, text: str) -> str:
        path = self.root / "unittest.log"
        path.write_text(textwrap.dedent(text).lstrip(), encoding="utf-8")
        return str(path)

    def test_hung_looking_test_streams_and_dumps_stacks_without_killing_the_run(self) -> None:
        self.register(FAILING)
        with mock.patch.dict(os.environ, {"FAKE_SLEEP": "1.6"}):
            code, out, finished = self.check("--watchdog", "0.5", "--slow", "1.0")
        text = out.getvalue()

        # The first test line reached stdout well before the run ended: output is live.
        self.assertGreaterEqual(finished - out.first_seen("test_always_fails ("), 1.5, text)
        # The stack dump of the stuck test was streamed while it ran, not at the end.
        self.assertGreaterEqual(out.first_seen("Ran 3 tests") - out.first_seen("Timeout ("), 0.5, text)
        self.assertRegex(text, re.compile(r'Timeout \([^)]*\)!.*?File ".*test_fake\.py", line \d+ in test_sleeps_past_the_watchdog', re.DOTALL))
        # The watchdog only reports: the slow test still passes and the verdict is unchanged.
        # The dump lands inside the half-written result line; "ok" follows it, so the run was not killed.
        self.assertRegex(text, rf"(?s)test_sleeps_past_the_watchdog \(.*{SLEEPING}\) \.\.\. Timeout \(.*\nok\n")
        self.assertIn("tests run: 3; first pass failures: 1; persistent after rerun: 1; known: 1", text)
        self.assertEqual(code, 0)
        # The slow test is marked after its result and listed again in the summary.
        self.assertRegex(text, rf"(?m)^\[slow \d+\.\d+s\] test_sleeps_past_the_watchdog \(.*{SLEEPING}\)$")
        self.assertRegex(text, r"(?m)^slow tests, slowest first:\n +\d+\.\d+s  test_sleeps_past_the_watchdog")

    def test_unregistered_failure_exits_one_and_a_registered_one_does_not(self) -> None:
        self.register()
        code, out, _ = self.check("--watchdog", "0")
        text = out.getvalue()
        self.assertEqual(code, 1, text)
        self.assertIn(f"NEW failures:\n  {FAILING}\n", text)
        self.assertIn("tests run: 3; first pass failures: 1; persistent after rerun: 1; known: 0", text)
        self.assertIn("== rerun: 1 first-pass failures in one process", text)
        # The traceback of the failure is now visible in the run output.
        self.assertIn("AssertionError: fake failure", text)
        # Watchdog off and nothing slow: no stack dump and no slow-test block.
        self.assertNotIn("Timeout (", text)
        self.assertNotIn("slow tests", text)

        self.register(FAILING)
        code, out, _ = self.check("--watchdog", "0")
        self.assertEqual(code, 0, out.getvalue())
        self.assertNotIn("NEW failures", out.getvalue())

    def test_no_rerun_skips_the_isolation_pass(self) -> None:
        self.register(FAILING)
        code, out, _ = self.check("--watchdog", "0", "--no-rerun")
        self.assertEqual(code, 0, out.getvalue())
        self.assertNotIn("== rerun", out.getvalue())

    def test_log_mode_keeps_the_known_failure_semantics(self) -> None:
        log = self.write_log(
            f"""
            test_always_fails (tests.{FAILING}) ... FAIL
            test_fast (tests.test_fake.FakeTests.test_fast) ... ok

            ======================================================================
            FAIL: test_always_fails (tests.{FAILING})
            ----------------------------------------------------------------------
            Ran 2 tests in 0.1s

            FAILED (failures=1)
            """
        )
        self.register(FAILING)
        code, out, _ = self.check("--log", log, "--no-rerun")
        self.assertEqual(code, 0, out.getvalue())
        self.assertEqual(out.getvalue().splitlines()[0], "tests run: 2; first pass failures: 1; persistent after rerun: 1; known: 1")
        self.assertNotIn("slow tests", out.getvalue())

        self.register()
        code, out, _ = self.check("--log", log, "--no-rerun")
        self.assertEqual(code, 1, out.getvalue())
        self.assertIn(f"NEW failures:\n  {FAILING}\n", out.getvalue())

        self.register(FAILING, "test_fake.FakeTests.test_fast")
        code, out, _ = self.check("--log", log, "--no-rerun")
        self.assertEqual(code, 0, out.getvalue())
        self.assertIn("known failures now passing; remove them:\n  test_fake.FakeTests.test_fast\n", out.getvalue())

    def test_log_without_a_summary_line_is_an_error(self) -> None:
        log = self.write_log("test_fast (tests.test_fake.FakeTests.test_fast) ... ok\n")
        self.register()
        with self.assertRaises(SystemExit) as raised:
            self.check("--log", log)
        self.assertIn("did not report a 'Ran N tests' line", str(raised.exception))

    def test_slow_markers_in_a_log_are_summarised_slowest_first_and_capped(self) -> None:
        markers = "".join(f"[slow {seconds}.5s] test_{seconds} (tests.test_fake.FakeTests.test_{seconds})\n" for seconds in range(30, 50))
        log = self.write_log("Ran 20 tests in 99s\n\nOK\n" + markers)
        self.register()
        code, out, _ = self.check("--log", log)
        lines = out.getvalue().splitlines()
        self.assertEqual(code, 0)
        listed = lines[lines.index("slow tests, slowest first:") + 1 :]
        self.assertEqual(len(listed), self.script.SLOW_LISTED + 1)
        self.assertTrue(listed[0].strip().startswith("49.5s  test_49"), listed[0])
        self.assertEqual(listed[-1], "  ... and 5 more")

    def test_runner_exit_code_follows_unittest(self) -> None:
        def run(*selection: str) -> int:
            return subprocess.run(
                [sys.executable, str(SCRIPTS / "unittest_watchdog.py"), *selection, "-v"],
                cwd=self.root,
                capture_output=True,
                check=False,
            ).returncode

        self.assertEqual(run("discover", "-s", "tests"), 1)
        self.assertEqual(run("tests.test_fake.FakeTests.test_fast"), 0)

    def test_pump_translates_newlines_and_multibyte_text_across_chunks(self) -> None:
        parts: list[str] = []
        echoed = io.StringIO()
        with contextlib.redirect_stdout(echoed):
            self.script.pump(FakeSource(b"ok\r", b"\nsl\xc3", b"\xa9ep\n"), parts, self.script.threading.Lock())
        expected = "ok\nsl\N{LATIN SMALL LETTER E WITH ACUTE}ep\n"
        self.assertEqual("".join(parts), expected)
        self.assertEqual(echoed.getvalue(), expected)

    def test_pump_keeps_draining_when_stdout_is_gone(self) -> None:
        class BrokenStdout(io.StringIO):
            def write(self, text: str) -> int:
                raise BrokenPipeError("stdout closed")

        parts: list[str] = []
        with contextlib.redirect_stdout(BrokenStdout()):
            self.script.pump(FakeSource(b"one\n", b"two\n"), parts, self.script.threading.Lock())
        self.assertEqual("".join(parts), "one\ntwo\n")

    def test_echo_survives_a_stdout_that_cannot_encode_the_text(self) -> None:
        raw = io.BytesIO()
        narrow = io.TextIOWrapper(raw, encoding="ascii", newline="\n")
        with contextlib.redirect_stdout(narrow):
            self.script.echo("sl\N{LATIN SMALL LETTER E WITH ACUTE}ep\n")
        self.assertEqual(raw.getvalue(), b"sl?ep\n")

    def test_script_and_runner_agree_on_their_settings(self) -> None:
        for name in ("WATCHDOG_ENV", "SLOW_ENV", "DEFAULT_WATCHDOG_SECONDS", "DEFAULT_SLOW_SECONDS"):
            self.assertEqual(getattr(self.script, name), getattr(self.runner, name), name)


if __name__ == "__main__":
    unittest.main()
