from __future__ import annotations

import csv
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

from autoquant.shell_launch import kill_process_tree, launch_shell_command
from tests.study_helpers import python_command

PARENT = """\
import subprocess, sys, time
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
print(child.pid, flush=True)
time.sleep(60)
"""


def _alive(pid: int) -> bool:
    if os.name == "nt":
        out = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
            # tasklist writes the console code page (GBK on a Chinese system), not UTF-8;
            # only the ASCII PID column is read, so undecodable bytes are replaced.
            capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
        ).stdout or ""
        # Exact PID column match (a substring test also matched memory figures).
        return any(len(row) > 1 and row[1] == str(pid) for row in csv.reader(out.splitlines()))
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


class ShellLaunchTests(unittest.TestCase):
    def test_script_path_with_spaces_and_unicode_round_trips_stdio(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / "dir with space" / "echo.py"
            script.parent.mkdir()
            script.write_text(
                "import os, sys\n"
                "data = sys.stdin.read()\n"
                "print(data + os.environ['PROBE'] + os.getcwd())\n",
                encoding="utf-8",
            )
            process = launch_shell_command(
                python_command(script),
                cwd=directory,
                env={**os.environ, "PROBE": "env-ok"},
            )
            stdout, _ = process.communicate("brief-é", timeout=30)
            self.assertEqual(process.returncode, 0)
            self.assertIn("brief-éenv-ok", stdout)
            self.assertIn(Path(directory).name, stdout)

    def test_kill_process_tree_ends_the_descendants(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / "parent.py"
            script.write_text(PARENT, encoding="utf-8")
            process = launch_shell_command(
                python_command(script), cwd=directory, env=dict(os.environ)
            )
            assert process.stdout is not None
            grandchild = int(process.stdout.readline())
            self.assertTrue(_alive(grandchild))
            kill_process_tree(process)
            process.communicate(timeout=30)
            deadline = time.monotonic() + 10
            while _alive(grandchild) and time.monotonic() < deadline:
                time.sleep(0.2)
            self.assertFalse(_alive(grandchild))


if __name__ == "__main__":
    unittest.main()
