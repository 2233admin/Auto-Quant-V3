"""In-process reader of the direction and workspace snapshots.

Shinka's standalone `aq shinka ui` server was removed in the V3 port (Studio
serves the snapshots now). These tests keep checking the snapshot builders'
contract through the same two reads the server made: the workspace overview,
and one direction selected by its directory name, with the library beside it.
"""

import json
import sqlite3
import urllib.parse
from pathlib import Path

from autoquant.shinka_research import library, ui


def request(workspace: Path, path: str) -> tuple[int, str]:
    url = urllib.parse.urlparse(path)
    root = Path(workspace).resolve()
    try:
        if url.path == "/api/workspace":
            payload = ui.workspace_snapshot(root)
        elif url.path == "/api/snapshot":
            ids = urllib.parse.parse_qs(url.query, keep_blank_values=True).get(
                "direction", []
            )
            if len(ids) != 1 or not ids[0].strip():
                return 400, "Specify exactly one nonblank direction"
            try:
                direction = ui._direction_root(root, ids[0])
            except FileNotFoundError:
                return 404, "Unknown direction"
            payload = ui.snapshot(
                direction, library_dir=root / library.LIBRARY_DIRNAME
            )
        else:
            return 404, "Not found"
    except (OSError, ValueError, sqlite3.Error) as error:
        return 500, f"Unable to read research data: {type(error).__name__}"
    return 200, json.dumps(payload, ensure_ascii=False, allow_nan=False)
