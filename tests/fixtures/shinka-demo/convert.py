"""Convert the fork's seed-generated demo research workspace into this fixture.

The source is the workspace `shinka/research/webui/demo/build_demo_workspace.py`
writes in the ShinkaEvolve fork (four directions and a shared library, fixed
seed, no model called, every number synthetic). Each direction becomes the
`research/` directory of one AutoQuant Project; the library stays at the
Workspace level. Development CSVs, plots and task sources are left out; meta
files are kept. Program databases keep the columns the research and evolution
pages read (code, diff, feedback, public and private metrics, lineage) but drop
embeddings, and metadata keeps only the keys those pages and the cost rule read,
with long logs cut to their tails, so the fixture stays small.

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
# Columns blanked: embeddings and their projections (large, unused by the pages).
DROP = {"embedding", "embedding_pca_2d", "embedding_pca_3d"}
# Metadata the pages read (patch, model, timings, failure) and the cost rule reads (*cost*, _island flags).
META = {
    "patch_type", "patch_name", "patch_description", "model_name", "failure_reason", "system_prompt_id",
    "pipeline_started_at", "postprocess_finished_at", "sampling_seconds", "evaluation_seconds",
    "postprocess_seconds", "pipeline_seconds", "novelty_explanation",
}
TAILS = {"thought": 600, "stdout_log": 1200, "stderr_log": 1200}
# Experiments that keep every program's source and diff for the program inspector; the others drop them
# (the inspector then says no source was retained) to keep the fixture near 3 MB.
FULL = {("d1-momentum-regimes", "h001", "e01"), ("d2-overnight-gap", "h001", "e01")}
SOURCE = {"code", "code_diff"}
TEXT = ("program.md", "results.tsv", "CONFIRMATION.md", "ledger.json", "run-log.tsv")


def _trim(source: Path, target: Path, programs: bool, full: bool = True) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(source)) as src, closing(sqlite3.connect(target)) as dst:
        src.backup(dst)
    with closing(sqlite3.connect(target)) as conn:
        if programs:
            for _cid, name, _kind, notnull, _default, _pk in conn.execute("PRAGMA table_info(programs)").fetchall():
                if name in DROP or (not full and name in SOURCE):
                    conn.execute(f'UPDATE programs SET "{name}" = ?', ("" if notnull else None,))
            conn.execute("DELETE FROM generation_event_log")
            rows = conn.execute("SELECT id, metadata FROM programs").fetchall()
            for pid, metadata in rows:
                meta = json.loads(metadata or "{}")
                kept = {k: v for k, v in meta.items() if k.startswith("_") or "cost" in k or k in META}
                if full:
                    kept.update({k: str(meta[k])[-n:] for k, n in TAILS.items() if meta.get(k)})
                else:
                    kept.pop("novelty_explanation", None)
                    if kept.get("patch_description"):
                        kept["patch_description"] = str(kept["patch_description"])[:160]
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
            if (exp / "results" / "meta").is_dir():
                shutil.copytree(exp / "results" / "meta", target / "results" / "meta")
            if (exp / "skeptic.md").is_file():
                shutil.copyfile(exp / "skeptic.md", target / "skeptic.md")
            for db, programs in (("programs.sqlite", True), ("prompts.sqlite", False)):
                if (exp / "results" / db).is_file():
                    _trim(exp / "results" / db, target / "results" / db, programs, (name, exp.parent.name, exp.name) in FULL)
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
