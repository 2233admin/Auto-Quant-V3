from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

from autoquant.python_runner import interpreter_command, main


class PythonRunnerTests(unittest.TestCase):
    def test_interpreter_command_uses_the_harness_python(self) -> None:
        self.assertEqual(
            interpreter_command(["script.py", "--flag"]),
            [sys.executable, "script.py", "--flag"],
        )

    def test_main_requires_a_python_target(self) -> None:
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            self.assertEqual(main([]), 2)
        self.assertIn("usage: aq-python", stderr.getvalue())

    def test_main_runs_the_harness_python_and_returns_its_exit_code(self) -> None:
        completed = mock.Mock(returncode=3)
        with mock.patch("autoquant.python_runner.subprocess.run", return_value=completed) as run:
            self.assertEqual(main(["script.py", "--flag"]), 3)
        run.assert_called_once_with([sys.executable, "script.py", "--flag"], check=False)

    def test_arguments_with_spaces_and_non_ascii_survive_aq_python(self) -> None:
        script = "import json, sys; sys.stdout.buffer.write(json.dumps(sys.argv[1:], ensure_ascii=True).encode())"
        root = Path(__file__).resolve().parents[1]
        completed = subprocess.run(
            [sys.executable, "-c", "import sys; from autoquant.python_runner import main; sys.exit(main(sys.argv[1:]))",
             "-c", script, "--terms", "a b", "--note", "中文 参数", 'x"y z'],
            capture_output=True, cwd=root, env={**os.environ, "PYTHONPATH": str(root)},
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(json.loads(completed.stdout), ["--terms", "a b", "--note", "中文 参数", 'x"y z'])

    def test_exit_code_is_propagated_through_a_real_process(self) -> None:
        self.assertEqual(main(["-c", "raise SystemExit(7)"]), 7)


if __name__ == "__main__":
    unittest.main()
