"""The workbench's own node tests (URL routes, restored-page actions) in the research gate."""

import shutil
import subprocess
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / "studio-shinka" / "app"


@pytest.mark.skipif(
    not (APP / "node_modules").exists() or shutil.which("node") is None,
    reason="needs node and `pnpm install` in studio-shinka/app",
)
def test_workbench_node_tests_pass() -> None:
    completed = subprocess.run(
        ["node", "--test"], cwd=APP, capture_output=True, text=True, timeout=120
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
