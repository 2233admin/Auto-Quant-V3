"""A Shinka research direction is an AutoQuant Project (owner decision 2026-11-05).

The Shinka modules keep their file formats; only the root they are given
changes. A Project's notebook, hypotheses, experiments and results ledger live
under ``<project>/research/``; the raw -> wiki -> log library is Workspace-level
at ``<workspace>/library/``::

    <workspace>/
      library/                      raw/, wiki/, index.md, log.md, manifest.json
      projects/<id>/
        autoquant.json, research.md ...   the ordinary Project
        research/                         the Shinka notebook (this module)
          notebook.json, program.md, results.tsv, ledger.json, run-log.tsv
          hypotheses/<hid>.md
          experiments/<hid>/<eid>/{task,results,skeptic.md}
          data/dev.csv                    git-ignored development split

`resolve` turns a command's directory argument into that layout. A directory
that is neither a Project nor a Workspace stays a bare direction directory
whose library is its parent's ``library/`` (the layout the ported tests and a
standalone direction use).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from autoquant.workspace import (
    PROJECT_MANIFEST,
    WORKSPACE_MANIFEST,
    AutoQuantValidationError,
    create_project,
    list_workspace_projects,
    load_project,
    load_workspace,
    resolve_project_directory,
)

from . import library
from .notebook import NOTEBOOK_FILENAME

RESEARCH_DIRNAME = "research"

# Local working files of a direction: the development split is market data
# (Project data is never ordinary Git state), and the rest is lock, lease,
# cursor and SQLite journal state.
GITIGNORE = """\
# Shinka research working state (see docs/shinka-research/PORT.md)
data/
.watch/
*.lock
.work.json
*.sqlite-shm
*.sqlite-wal
"""

_PROJECT_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


@dataclass(frozen=True)
class Target:
    """Where one direction's state lives."""

    root: Path
    library: Path
    project: Optional[Path] = None
    workspace: Optional[Path] = None


def research_root(project_root: Path) -> Path:
    return Path(project_root) / RESEARCH_DIRNAME


def has_research(project_root: Path) -> bool:
    return (research_root(project_root) / NOTEBOOK_FILENAME).is_file()


def workspace_library(workspace_root: Path) -> Path:
    return Path(workspace_root) / library.LIBRARY_DIRNAME


def _is_v3(path: Path) -> bool:
    return (path / PROJECT_MANIFEST).is_file() or (path / WORKSPACE_MANIFEST).is_file()


def _workspace_of(project_root: Path) -> Optional[Path]:
    """The Workspace whose effective Projects directory holds this Project:
    an ancestor first, then the current directory (a local override may
    place Projects outside the Workspace tree)."""
    candidates = [*project_root.parents, Path.cwd().resolve()]
    for candidate in candidates:
        if not (candidate / WORKSPACE_MANIFEST).is_file():
            continue
        try:
            if load_workspace(candidate).projects_dir == project_root.parent:
                return candidate
        except AutoQuantValidationError:
            continue
    return None


def _project_target(project_root: Path, workspace: Optional[Path]) -> Target:
    project_root = load_project(project_root).root_dir
    workspace = workspace or _workspace_of(project_root)
    if workspace is None:
        raise SystemExit(
            f"Cannot find the Workspace that lists Project {project_root.name}; "
            "pass the Workspace directory and --project ID"
        )
    return Target(
        research_root(project_root),
        workspace_library(workspace),
        project_root,
        workspace,
    )


def resolve(
    argument: str | Path,
    project_id: Optional[str] = None,
    *,
    create: bool = False,
    description: str = "",
) -> Target:
    """A command's directory argument: a Workspace (with ``--project`` or its
    default Project), a Project directory, a Project's ``research/``
    directory, a bare Project id when the current directory is a Workspace,
    or a bare direction directory. ``create`` makes a missing ``--project``
    in a Workspace as a blank Project through V3's own creation path."""
    raw = str(argument)
    path = Path(raw).expanduser().absolute()
    if (
        not path.exists()
        and project_id is None
        and _PROJECT_ID.fullmatch(raw)
        and (Path.cwd() / WORKSPACE_MANIFEST).is_file()
    ):
        path, project_id = Path.cwd().absolute(), raw
    try:
        if (
            path.name == RESEARCH_DIRNAME
            and project_id is None
            and (path.parent / PROJECT_MANIFEST).is_file()
        ):
            return _project_target(path.parent.resolve(), None)
        if not _is_v3(path):
            if project_id is not None:
                raise SystemExit(f"--project needs a Workspace directory: {path}")
            return Target(path, library.library_root(path))
        workspace = path.resolve() if (path / WORKSPACE_MANIFEST).is_file() else None
        if create and workspace is not None and project_id is not None:
            projects = load_workspace(workspace).projects_dir
            if not (projects / project_id).exists():
                create_project(workspace, project_id, description=description)
        return _project_target(resolve_project_directory(path, project_id), workspace)
    except AutoQuantValidationError as error:
        raise SystemExit("; ".join(issue.message for issue in error.issues)) from None


def attach(target: Target) -> None:
    """Make a Project's ``research/`` directory, with its ignore rules."""
    target.root.mkdir(parents=True, exist_ok=True)
    if target.project is not None:
        ignore = target.root / ".gitignore"
        if not ignore.exists():
            ignore.write_text(GITIGNORE, encoding="utf-8")


def library_for(argument: str | Path, project_id: Optional[str] = None) -> Path:
    """The library a `library` command works on: a Workspace's own, a
    Project's Workspace library, a bare direction's parent library, or
    ``<dir>/library`` for any other bare directory."""
    path = Path(argument).expanduser().absolute()
    if project_id is None and (path / WORKSPACE_MANIFEST).is_file():
        return workspace_library(path.resolve())
    target = resolve(argument, project_id)
    if target.project is not None or (path / NOTEBOOK_FILENAME).exists():
        return target.library
    return path / library.LIBRARY_DIRNAME


def watch_roots(
    argument: str | Path, project_id: Optional[str] = None
) -> Tuple[List[Tuple[str, Path]], bool]:
    """The directions `watch` visits, each with the name it prints, and
    whether the names are printed: one direction, every Project with research
    in a Workspace, or every direction directory below a bare directory."""
    path = Path(argument).expanduser().absolute()
    if project_id is None and (path / WORKSPACE_MANIFEST).is_file():
        try:
            listed = list_workspace_projects(path)
        except AutoQuantValidationError as error:
            raise SystemExit(str(error)) from None
        return [
            (item.id, research_root(Path(item.path)))
            for item in listed
            if has_research(Path(item.path))
        ], True
    target = resolve(argument, project_id)
    if target.project is not None or (target.root / NOTEBOOK_FILENAME).exists():
        return [(target.root.name, target.root)], False
    root = target.root.resolve()
    return [
        (child.name, child)
        for child in sorted(root.iterdir())
        if (child / NOTEBOOK_FILENAME).exists()
    ], True
