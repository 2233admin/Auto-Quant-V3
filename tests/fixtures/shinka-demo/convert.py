"""Convert the fork's seed-generated demo research workspace into this fixture.

The source is the workspace `shinka/research/webui/demo/build_demo_workspace.py`
writes in the ShinkaEvolve fork (four directions and a shared library, fixed
seed, no model called, every number synthetic). Each direction becomes the
`research/` directory of one AutoQuant Project; the library stays at the
Workspace level. Development CSVs, plots, meta files and task sources are left
out; program databases keep only the columns the read model uses (code and
private metrics are blanked) so the fixture stays small.

    python tests/fixtures/shinka-demo/convert.py <demo-workspace-dir>

`tests/shinka_demo.py` builds a complete V3 Workspace from this fixture.
"""

import json
import shutil
import sqlite3
import sys
from contextlib import closing
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECTS = {
    "d1-momentum-regimes": "momentum-regimes",
    "d2-overnight-gap": "overnight-gap",
    "d3-volume-shock": "volume-shock",
    "d4-short-reversal": "short-reversal",
}
KEEP = {"id", "timestamp", "generation", "correct", "combined_score", "metadata"}
TEXT = ("program.md", "results.tsv", "CONFIRMATION.md", "ledger.json", "run-log.tsv")


def _trim(source: Path, target: Path, programs: bool) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(source)) as src, closing(sqlite3.connect(target)) as dst:
        src.backup(dst)
    with closing(sqlite3.connect(target)) as conn:
        if programs:
            for _cid, name, kind, notnull, _default, _pk in conn.execute("PRAGMA table_info(programs)").fetchall():
                if name in KEEP or kind.upper() not in ("TEXT", ""):
                    continue
                conn.execute(f'UPDATE programs SET "{name}" = ?', ("" if notnull else None,))
            conn.execute("DELETE FROM generation_event_log")
            # Only what the cost rule and the island-copy filter read.
            rows = conn.execute("SELECT id, metadata FROM programs").fetchall()
            for pid, metadata in rows:
                meta = json.loads(metadata or "{}")
                kept = {k: v for k, v in meta.items() if k.startswith("_") or "cost" in k}
                conn.execute("UPDATE programs SET metadata = ? WHERE id = ?", (json.dumps(kept), pid))
        conn.commit()
        conn.execute("PRAGMA journal_mode=DELETE")
        conn.execute("VACUUM")


def _relative(value, direction: Path):
    """Absolute paths of the source machine become research-relative POSIX paths."""
    if isinstance(value, dict):
        return {k: _relative(v, direction) for k, v in value.items()}
    if isinstance(value, list):
        return [_relative(v, direction) for v in value]
    if isinstance(value, str) and (":\\" in value or value.startswith("/")) and direction.name in value:
        return value.replace("\\", "/").split(f"/{direction.name}/", 1)[1]
    return value


def convert(demo: Path) -> None:
    out = HERE / "projects"
    shutil.rmtree(out, ignore_errors=True)
    for name, project in PROJECTS.items():
        direction = demo / name
        research = out / project / "research"
        research.mkdir(parents=True)
        notebook = json.loads((direction / "notebook.json").read_text(encoding="utf-8"))
        (research / "notebook.json").write_text(
            json.dumps(_relative(notebook, direction), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        for text in TEXT:
            if (direction / text).is_file():
                shutil.copyfile(direction / text, research / text)
        shutil.copytree(direction / "hypotheses", research / "hypotheses")
        shutil.copyfile(demo / "DEMO_DATA.md", research / "DEMO_DATA.md")
        for exp in sorted((direction / "experiments").glob("*/*")):
            target = research / "experiments" / exp.parent.name / exp.name
            target.mkdir(parents=True)
            if (exp / "skeptic.md").is_file():
                shutil.copyfile(exp / "skeptic.md", target / "skeptic.md")
            for db, programs in (("programs.sqlite", True), ("prompts.sqlite", False)):
                if (exp / "results" / db).is_file():
                    _trim(exp / "results" / db, target / "results" / db, programs)
        (out / project / "project.json").write_text(
            json.dumps({"name": project, "description": notebook["direction"]}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    lib = HERE / "library"
    shutil.rmtree(lib, ignore_errors=True)
    shutil.copytree(demo / "library", lib)
    shutil.copyfile(demo / "DEMO_DATA.md", lib / "DEMO_DATA.md")


if __name__ == "__main__":
    convert(Path(sys.argv[1]))
