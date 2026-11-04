"""Lazy access to the ShinkaEvolve engine (``shinka``), which AutoQuant does not vendor.

Only the parts of the research layer that read or launch evolution runs need it
(run cost, run analysis, the web UI, ``run_shinka_eval``). Everything else loads
without it.
"""

from __future__ import annotations

import importlib
from types import ModuleType

ENGINE_HINT = (
    "this needs the ShinkaEvolve engine, which AutoQuant does not vendor. "
    "Install it with `pip install shinka-evolve` (or `uv sync --extra shinka-engine`)."
)


class EngineNotInstalled(ImportError):
    """The ShinkaEvolve engine is required here but is not installed."""


def require_engine(module: str) -> ModuleType:
    """Import ``module`` (e.g. ``shinka.database.cost``) or say how to get the engine."""
    try:
        return importlib.import_module(module)
    except ModuleNotFoundError as error:
        if error.name and error.name.split(".")[0] == "shinka":
            raise EngineNotInstalled(f"{module}: {ENGINE_HINT}") from error
        raise
