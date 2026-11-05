"""A research direction is a V3 Project: `aq shinka` resolves Projects to
``<project>/research/`` and the library to ``<workspace>/library/``."""

import json
from pathlib import Path

import pytest

from autoquant.shinka_research import cli, project
from autoquant.shinka_research.notebook import Notebook
from autoquant.workspace import create_project, initialize_workspace


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    root = tmp_path / "desk"
    initialize_workspace(root)
    create_project(root, "momentum-desk", description="Momentum research")
    return root


def _init(*argv: str) -> None:
    cli.main(["init", *argv, "--direction", "Daily momentum regimes"])


def test_init_attaches_research_state_to_an_existing_project(workspace: Path) -> None:
    _init(str(workspace), "--project", "momentum-desk")
    research = workspace / "projects" / "momentum-desk" / "research"
    assert Notebook.load(research).direction == "Daily momentum regimes"
    assert (research / "program.md").is_file()
    assert "data/" in (research / ".gitignore").read_text(encoding="utf-8")
    # The library is Workspace-level, not inside the Project.
    assert (workspace / "library" / "raw").is_dir()
    assert not (workspace / "projects" / "momentum-desk" / "library").exists()
    with pytest.raises(SystemExit, match="already has a notebook"):
        _init(str(workspace / "projects" / "momentum-desk"))


def test_every_form_of_the_project_reaches_the_same_notebook(
    workspace: Path, tmp_path: Path, monkeypatch, capsys
) -> None:
    project_dir = workspace / "projects" / "momentum-desk"
    _init(str(project_dir))
    monkeypatch.chdir(workspace)
    forms = [
        ["momentum-desk"],
        [str(project_dir)],
        [str(project_dir / "research")],
        [str(workspace), "--project", "momentum-desk"],
    ]
    for form in forms:
        target = project.resolve(*form[:1], form[2] if len(form) == 3 else None)
        assert target.root == project_dir.resolve() / "research"
        assert target.library == workspace.resolve() / "library"
        assert target.project == project_dir.resolve()
    body = tmp_path / "h.md"
    body.write_text("Claim: vol-scaled momentum keeps a positive Sharpe.\n")
    cli.main(
        ["hypothesis", "add", "momentum-desk", "--title", "vol-scaled", "--file", str(body)]
    )
    capsys.readouterr()
    cli.main(["status", str(project_dir)])
    assert "h001" in capsys.readouterr().out


def test_init_can_create_the_project_through_v3(workspace: Path) -> None:
    with pytest.raises(SystemExit, match="Unknown Workspace Project"):
        _init(str(workspace), "--project", "gap-study")
    _init(str(workspace), "--project", "gap-study", "--create-project")
    created = workspace / "projects" / "gap-study"
    manifest = json.loads((created / "autoquant.json").read_text(encoding="utf-8"))
    assert manifest["id"] == "gap-study"
    assert manifest["description"] == "Daily momentum regimes"
    assert (created / "research" / "notebook.json").is_file()


def test_library_and_watch_work_at_workspace_level(
    workspace: Path, tmp_path: Path, capsys
) -> None:
    _init(str(workspace), "--project", "momentum-desk")
    note = tmp_path / "paper.md"
    note.write_text("A source.\n", encoding="utf-8")
    cli.main(["library", "add", str(workspace), str(note)])
    assert (workspace / "library" / "raw" / "paper.md").is_file()
    capsys.readouterr()
    cli.main(["library", "pending", str(workspace / "projects" / "momentum-desk")])
    assert capsys.readouterr().out.split() == ["raw/paper.md"]
    roots, named = project.watch_roots(workspace)
    assert named and [name for name, _ in roots] == ["momentum-desk"]


def test_a_bare_directory_stays_a_direction_with_its_parent_library(
    tmp_path: Path,
) -> None:
    root = tmp_path / "loose" / "d1"
    _init(str(root))
    assert (root / "notebook.json").is_file()
    assert not (root / ".gitignore").exists()
    assert (tmp_path / "loose" / "library").is_dir()
    with pytest.raises(SystemExit, match="--project needs a Workspace"):
        project.resolve(root, "momentum-desk")
