import importlib.util
from pathlib import Path

import pandas as pd
import pytest

REPO = Path(__file__).resolve().parents[2]
EXAMPLE = REPO / "examples" / "shinka_quant_research"


@pytest.fixture(autouse=True)
def _outside_the_agent_environment():
    """Tests start as the owner's manual commands, whatever shell runs them;
    those about the agent environment set the marker themselves. Its own
    patcher, so a test's `monkeypatch.undo()` does not bring the marker back."""
    with pytest.MonkeyPatch.context() as patch:
        patch.delenv("SHINKA_RESEARCH_AGENT", raising=False)
        yield


def _load_example_module(name: str):
    spec = importlib.util.spec_from_file_location(name, EXAMPLE / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def bars() -> pd.DataFrame:
    return _load_example_module("make_data").make_bars(n=800, seed=1)


@pytest.fixture
def bars_csv(tmp_path: Path, bars: pd.DataFrame) -> Path:
    path = tmp_path / "bars.csv"
    bars.to_csv(path)
    return path


@pytest.fixture
def example_dir() -> Path:
    return EXAMPLE


def pytest_ignore_collect(collection_path, config):
    """The research layer is an optional extra: without its dependencies there is
    nothing here to collect (tests that need the engine skip on their own)."""
    for module in ("yaml", "psutil", "pydantic", "scipy"):
        if importlib.util.find_spec(module) is None:
            return True
    return None


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """A test that reached for the (optional) engine and found it missing is a skip."""
    outcome = yield
    report = outcome.get_result()
    if call.excinfo is not None and call.excinfo.typename == "EngineNotInstalled":
        report.outcome = "skipped"
        report.longrepr = (str(item.path), item.location[1] or 0, "Skipped: needs the ShinkaEvolve engine")


# These evaluate or launch programs through the engine's ``run_shinka_eval`` in
# a child process, so without the engine they cannot run (the failure is in the
# child, not an in-process EngineNotInstalled).
_ENGINE_MODULES = {"test_lockbox_pbo", "test_plan_rules", "test_quant", "test_runs"}
_ENGINE_TESTS = {
    "test_generated_evaluator_runs",
    "test_probe_shows_public_metrics_only",
    "test_skeptic_and_verdict_cli",
    "test_a_long_evaluation_does_not_hold_the_direction",
}


def pytest_collection_modifyitems(config, items):
    if importlib.util.find_spec("shinka") is not None:
        return
    skip = pytest.mark.skip(reason="needs the ShinkaEvolve engine (uv sync --extra shinka-engine)")
    for item in items:
        if item.path.stem in _ENGINE_MODULES or item.originalname in _ENGINE_TESTS:
            item.add_marker(skip)
