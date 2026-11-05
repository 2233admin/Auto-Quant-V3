"""Build a V3 Workspace carrying the synthetic Shinka demo research.

Every Project's `research/` directory and the Workspace `library/` come from
`tests/fixtures/shinka-demo/` (converted from the fork's seed-generated demo;
see its `convert.py`). Each carries `DEMO_DATA.md`, which Studio shows as a
synthetic-data notice. No number in it is a real research result.

    python -m tests.shinka_demo D:/tmp/aqv3-shinka-demo-ws
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from autoquant.workspace import create_project, initialize_workspace

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "shinka-demo"


def build(target: str | Path) -> Path:
    root = Path(target).absolute()
    initialize_workspace(root, name="Shinka research demo (synthetic)")
    for source in sorted((FIXTURE / "projects").iterdir()):
        meta = json.loads((source / "project.json").read_text(encoding="utf-8"))
        create_project(root, source.name, name=meta["name"], description=meta["description"])
        shutil.copytree(source / "research", root / "projects" / source.name / "research")
    shutil.copytree(FIXTURE / "library", root / "library")
    return root


if __name__ == "__main__":
    print(build(sys.argv[1]))
