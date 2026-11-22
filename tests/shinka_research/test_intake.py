import contextlib
import hashlib
import importlib.util
import io
import json
import re
import sqlite3
from pathlib import Path

import pandas as pd
import pytest
import yaml

from autoquant.shinka_research import cli, grants, intake, intake_apply, intake_render, rules
from autoquant.shinka_research import intake_templates as templates
from autoquant.shinka_research.notebook import Notebook, Status
from autoquant.shinka_research.quant import QuantConfig, file_sha256, run_quant_eval
from autoquant.shinka_research.scaffold import freeze_plan

needs_engine = pytest.mark.skipif(
    importlib.util.find_spec("shinka") is None,
    reason="needs the ShinkaEvolve engine (uv sync --extra shinka-engine)",
)

LOOSE = {
    "dsr_supported": 0.5,
    "min_positive_fraction": 0.5,
    "n_subperiods": 2,
    "max_pbo": 0.9,
}


@pytest.fixture
def rich_bars(bars: pd.DataFrame) -> pd.DataFrame:
    """The shared fixture bars with the columns every template reads."""
    spread = bars["close"].pct_change().abs().fillna(0.0) + 0.002
    rich = bars.copy()
    rich["high"] = rich["close"] * (1 + spread)
    rich["low"] = rich["close"] * (1 - spread)
    rich["volume"] = 1000.0 + (rich["close"] * 7.0) % 500.0
    return rich


@pytest.fixture
def rich_csv(tmp_path: Path, rich_bars: pd.DataFrame) -> Path:
    path = tmp_path / "rich.csv"
    rich_bars.to_csv(path)
    return path


@pytest.fixture
def root(tmp_path: Path) -> Path:
    path = tmp_path / "direction"
    cli.main(["init", str(path), "--direction", "intake"])
    return path


def _set(draft: dict, path: str, value) -> dict:
    node = draft
    *parents, leaf = path.split(".")
    for part in parents:
        node = node.setdefault(part, {})
    node[leaf] = value
    return draft


def _draft(template: str = "us_equity.momentum_20d", **answers) -> dict:
    """A ready draft: every suggestion accepted, then the given answers."""
    draft = intake_render.suggested_draft(templates.TEMPLATES[template])
    for path, value in answers.items():
        _set(draft, path.replace("__", "."), value)
    return draft


def _write(tmp_path: Path, draft: dict, name: str = "spec.json") -> Path:
    path = tmp_path / name
    path.write_text(json.dumps(draft), encoding="utf-8")
    return path


def _apply(root: Path, spec: Path, data: Path, *extra: str) -> None:
    cli.main(["intake", "apply", str(root), "--spec", str(spec), "--data", str(data), *extra])


def _tree(root: Path) -> dict:
    """Every file under the direction with its hash, and every directory."""
    found = {}
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root).as_posix()
        if rel == ".research.lock":
            continue
        found[rel] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    return found


# ---- templates ------------------------------------------------------------


def test_templates_are_keyed_by_market_and_scenario(capsys) -> None:
    cli.main(["intake", "templates", "--json"])
    listing = json.loads(capsys.readouterr().out)["templates"]
    assert len(listing) >= 5
    assert len({t["id"] for t in listing}) == len(listing)
    for t in listing:
        assert t["id"] == f"{t['market']}.{t['scenario']}"
        assert t["market"] in templates.MARKETS
        assert "EVOLVE-BLOCK-START" in t["seed_program"]
        assert "def run_experiment(bars" in t["seed_program"]
        assert t["refutation_proposal"]
    assert len({t["scenario"] for t in listing}) >= 5


def test_templates_print_without_json(capsys) -> None:
    cli.main(["intake", "templates"])
    out = capsys.readouterr().out
    for template_id in templates.TEMPLATES:
        assert template_id in out


@needs_engine
@pytest.mark.parametrize("template_id", list(templates.TEMPLATES))
def test_every_seed_is_judged_correct_by_the_frozen_evaluator(
    tmp_path: Path, rich_csv: Path, template_id: str
) -> None:
    template = templates.TEMPLATES[template_id]
    seed = tmp_path / "initial.py"
    seed.write_text(intake_render.describe_template(template)["seed_program"], encoding="utf-8")
    cfg = QuantConfig(data_path=str(rich_csv))
    with contextlib.redirect_stdout(io.StringIO()):
        metrics, correct, error = run_quant_eval(str(seed), str(tmp_path / "out"), cfg)
    assert (correct, error) == (True, None)
    assert metrics["public"]["is_sharpe_mean"] == pytest.approx(metrics["combined_score"])


@needs_engine
def test_a_seed_with_position_limits_and_a_stop_is_still_correct(
    tmp_path: Path, rich_csv: Path
) -> None:
    resolved = intake.resolve(
        "cn_equity.ma_trend",
        _draft("cn_equity.ma_trend", risk_control__stop_loss_pct=0.03, sizing__max_position=0.5),
    )
    seed = tmp_path / "initial.py"
    seed.write_text(intake_render.seed_program(resolved.spec), encoding="utf-8")
    with contextlib.redirect_stdout(io.StringIO()):
        _, correct, error = run_quant_eval(
            str(seed), str(tmp_path / "out"), QuantConfig(data_path=str(rich_csv))
        )
    assert (correct, error) == (True, None)


def _module(source: str, tmp_path: Path):
    path = tmp_path / "seed_module.py"
    path.write_text(source, encoding="utf-8")
    spec = importlib.util.spec_from_file_location("seed_module", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_long_only_sizing_keeps_positions_inside_the_limits(
    tmp_path: Path, rich_bars: pd.DataFrame
) -> None:
    long_only = intake.resolve("cn_equity.mean_reversion", _draft("cn_equity.mean_reversion"))
    assert long_only.spec.sizing.mode == "long_only"
    low = _module(intake_render.seed_program(long_only.spec), tmp_path).run_experiment(rich_bars)
    assert low.min() >= 0.0 and low.max() == 1.0
    capped = intake.resolve(
        "crypto.ma_trend", _draft("crypto.ma_trend", sizing__max_position=0.4)
    )
    wide = _module(intake_render.seed_program(capped.spec), tmp_path).run_experiment(rich_bars)
    assert wide.min() == -0.4 and wide.max() == 0.4


def test_the_stop_goes_flat_until_the_signal_leaves_that_side(tmp_path: Path) -> None:
    resolved = intake.resolve("us_equity.momentum_20d", _draft(risk_control__stop_loss_pct=0.05))
    stop_out = _module(intake_render.seed_program(resolved.spec), tmp_path)._stop_out
    positions = pd.Series([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0])
    close = pd.Series([100.0, 101.0, 94.0, 94.0, 96.0, 97.0, 90.0])
    assert stop_out(positions, close, 0.05).tolist() == [1.0, 1.0, 0.0, 0.0, 0.0, -1.0, -1.0]


# ---- questions ------------------------------------------------------------


def test_questions_are_only_what_changes_the_meaning() -> None:
    res = intake.resolve("cn_equity.price_volume_corr", {})
    assert [q.field for q in res.questions] == [
        "market",
        "symbol",
        "signal.params.direction",
        "refutation",
        "backtest.cost_bps",
    ]
    assert all(q.default not in (None, "") for q in res.questions)
    assert not res.ready and res.spec is None
    assert {"sizing.mode", "sizing.max_position", "backtest.oos_fraction", "rule"} <= set(
        res.defaulted
    )
    assert not set(res.defaulted) & {q.field for q in res.questions}


def test_a_template_with_a_fixed_signal_does_not_ask_about_it() -> None:
    fields = [q.field for q in intake.resolve("crypto.ma_trend", {}).questions]
    assert fields == ["market", "symbol", "refutation", "backtest.cost_bps"]


def test_answered_questions_drop_out_and_the_draft_becomes_ready() -> None:
    answers = {"market": "crypto", "symbol": "BTCUSDT"}
    res = intake.resolve("crypto.ma_trend", answers)
    assert [q.field for q in res.questions] == ["refutation", "backtest.cost_bps"]
    assert res.answered == ["market", "symbol"]
    full = {**answers, "refutation": "Refuted if the holdout Sharpe is not positive.",
            "backtest": {"cost_bps": 12}}
    res = intake.resolve("crypto.ma_trend", full)
    assert res.ready and res.questions == []
    assert res.spec.backtest.cost_bps == 12 and res.spec.backtest.periods_per_year == 365
    assert res.spec.defaulted == res.defaulted
    assert "backtest.cost_bps" not in res.defaulted and "market" not in res.defaulted


def test_the_market_answer_moves_the_defaults_it_owns() -> None:
    crypto = intake.resolve("cn_equity.ma_trend", {"market": "crypto"})
    suggested = {q.field: q.default for q in crypto.questions}
    assert suggested["symbol"] == "BTCUSDT" and suggested["backtest.cost_bps"] == 10.0
    ready = intake.resolve("cn_equity.ma_trend", _draft("cn_equity.ma_trend", market="us_equity"))
    assert ready.spec.sizing.mode == "long_short" and ready.spec.backtest.periods_per_year == 252


def test_a_blank_refutation_is_still_a_question() -> None:
    res = intake.resolve("crypto.ma_trend", _draft("crypto.ma_trend", refutation="   "))
    assert [q.field for q in res.questions] == ["refutation"]


@pytest.mark.parametrize(
    ("draft", "message"),
    [
        ({"template": "nope"}, "unknown template"),
        ({"template": "crypto.ma_trend", "colour": 1}, "unknown field 'colour'"),
        ({"template": "crypto.ma_trend", "market": "mars"}, "market must be one of"),
        ({"template": "crypto.ma_trend", "signal": {"kind": "x"}}, "comes from the template"),
        ({"template": "crypto.ma_trend", "signal": {"params": {"speed": 3}}}, "not a parameter"),
        ({"template": "crypto.ma_trend", "signal": {"params": {"fast": 80, "slow": 60}}}, "shorter than slow"),
        ({"template": "crypto.ma_trend", "signal": {"params": {"fast": 1}}}, "within"),
        ({"template": "crypto.ma_trend", "signal": {"params": {"fast": 2.5}}}, "an integer"),
        ({"template": "cn_equity.price_volume_corr", "signal": {"params": {"direction": "up"}}}, "one of"),
        ({"template": "crypto.ma_trend", "risk_control": {"stop_loss_pct": 2}}, "stop_loss_pct"),
        ({"template": "crypto.ma_trend", "sizing": {"mode": "short_only"}}, "sizing.mode"),
        ({"template": "crypto.ma_trend", "backtest": {"n_folds": "3"}}, "n_folds"),
        ({"template": "crypto.ma_trend", "backtest": {"oos_fraction": 1.2}}, "oos_fraction"),
        ({"template": "crypto.ma_trend", "backtest": {"cost_bps": -1}}, "cost_bps"),
        ({"template": "crypto.ma_trend", "backtest": {"surprise": 1}}, "surprise"),
    ],
)
def test_a_bad_draft_is_refused_with_the_field_named(draft: dict, message: str) -> None:
    with pytest.raises(intake.IntakeError, match=re.escape(message)):
        intake.resolve(None, draft)


def test_a_template_flag_that_contradicts_the_draft_is_refused() -> None:
    with pytest.raises(intake.IntakeError, match="differs"):
        intake.resolve("crypto.ma_trend", {"template": "cn_equity.ma_trend"})


def test_the_questions_command_reads_a_draft_and_prints_json(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    spec = _write(tmp_path, {"template": "cn_equity.price_volume_corr", "symbol": "600519.SH"})
    cli.main(["intake", "questions", "--spec", str(spec), "--json"])
    report = json.loads(capsys.readouterr().out)
    assert report["ready"] is False and report["spec"] is None
    assert [q["field"] for q in report["questions"]] == [
        "market", "signal.params.direction", "refutation", "backtest.cost_bps",
    ]  # fmt: skip
    assert report["answered"] == ["symbol"]
    cli.main(["intake", "questions", "--template", "us_equity.momentum_20d"])
    assert "open question" in capsys.readouterr().out
    ready = _write(tmp_path, _draft(), "ready.json")
    cli.main(["intake", "questions", "--spec", str(ready), "--json"])
    report = json.loads(capsys.readouterr().out)
    assert report["ready"] is True and report["questions"] == []
    assert report["spec"]["template"] == "us_equity.momentum_20d"


# ---- apply: refusals --------------------------------------------------------


def _refused(root: Path, spec: Path, data: Path, message: str) -> None:
    before = _tree(root)
    nb = Notebook.load(root)
    with pytest.raises(SystemExit, match=message):
        _apply(root, spec, data)
    assert _tree(root) == before
    assert Notebook.load(root) == nb


def test_an_incomplete_spec_is_refused_with_its_open_questions(
    tmp_path: Path, root: Path, rich_csv: Path
) -> None:
    draft = _draft()
    del draft["symbol"]
    _refused(root, _write(tmp_path, draft), rich_csv, r"not ready.*\n\s+symbol")


@pytest.mark.parametrize("refutation", ["missing", "", "  \n"])
def test_a_missing_refutation_criterion_is_refused(
    tmp_path: Path, root: Path, rich_csv: Path, refutation: str
) -> None:
    draft = _draft()
    if refutation == "missing":
        del draft["refutation"]
    else:
        draft["refutation"] = refutation
    _refused(root, _write(tmp_path, draft), rich_csv, r"not ready.*\n\s+refutation")


@pytest.mark.parametrize(
    ("rule", "message"),
    [
        ({"kind": "bootstrap", "version": 1, "thresholds": {}}, "unknown rule bootstrap"),
        ({"kind": "dsr_pbo", "version": 2, "thresholds": LOOSE}, "unknown rule dsr_pbo v2"),
        ({"kind": "dsr_pbo", "version": 1, "thresholds": {"dsr_supported": 0.9}}, "missing"),
        ({"kind": "dsr_pbo", "version": 1, "thresholds": {**LOOSE, "extra": 1}}, "unknown extra"),
        ({"kind": "dsr_pbo", "version": 1, "thresholds": {**LOOSE, "max_pbo": 1.5}}, "max_pbo"),
        ({"kind": "dsr_pbo", "version": 1, "thresholds": {**LOOSE, "n_subperiods": 2.5}}, "n_subperiods"),
        ({"kind": "counterexample", "version": 1, "thresholds": {}}, "judged by dsr_pbo"),
    ],
)
def test_an_unknown_rule_or_wrong_thresholds_are_refused(
    tmp_path: Path, root: Path, rich_csv: Path, rule: dict, message: str
) -> None:
    spec = _write(tmp_path, _draft(rule=rule))
    _refused(root, spec, rich_csv, re.escape(message))


def test_the_agent_environment_cannot_apply(
    tmp_path: Path, root: Path, rich_csv: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(grants.AGENT_ENV, "1")
    _refused(root, _write(tmp_path, _draft()), rich_csv, "owner's to give")


def test_data_without_the_columns_the_template_reads_is_refused(
    tmp_path: Path, root: Path, bars_csv: Path
) -> None:
    spec = _write(tmp_path, _draft("futures.donchian_atr"))
    _refused(root, spec, bars_csv, r"no column high, low")
    spec = _write(tmp_path, _draft("cn_equity.price_volume_corr"), "pv.json")
    _refused(root, spec, bars_csv, r"no column volume")


def test_a_missing_data_file_is_refused(tmp_path: Path, root: Path) -> None:
    _refused(root, _write(tmp_path, _draft()), tmp_path / "absent.csv", "cannot read the data file")


def test_an_unreadable_spec_file_is_refused(tmp_path: Path, root: Path, rich_csv: Path) -> None:
    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    _refused(root, broken, rich_csv, "not valid JSON")
    listing = tmp_path / "list.json"
    listing.write_text("[1]", encoding="utf-8")
    _refused(root, listing, rich_csv, "must be a JSON object")


def test_an_intake_builds_quant_experiments_only(tmp_path: Path, rich_csv: Path) -> None:
    other = tmp_path / "open"
    cli.main(["init", str(other), "--direction", "x", "--domain", "open"])
    _refused(other, _write(tmp_path, _draft()), rich_csv, "builds quant experiments only")


# ---- apply: success -----------------------------------------------------------


def test_apply_freezes_a_plan_with_the_spec_in_the_checker_set(
    tmp_path: Path, root: Path, rich_csv: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    draft = _draft("cn_equity.price_volume_corr", refutation="Dropped if the holdout is flat.",
                   rule={"kind": "dsr_pbo", "version": 1, "thresholds": LOOSE})  # fmt: skip
    capsys.readouterr()
    _apply(root, _write(tmp_path, draft), rich_csv, "--json")
    applied = json.loads(capsys.readouterr().out)
    assert applied["hypothesis"] == "h001" and applied["experiment"] == "e01"

    spec_file = root / "hypotheses" / "h001.intake.json"
    text = spec_file.read_text(encoding="utf-8")
    assert text == json.dumps(json.loads(text), sort_keys=True, indent=2, ensure_ascii=False) + "\n"
    assert applied["spec_sha256"] == file_sha256(spec_file)
    stored = intake.IntakeSpec.model_validate_json(text)
    assert intake.spec_sha256(stored) == applied["spec_sha256"]

    nb = Notebook.load(root)
    hyp = nb.get("h001")
    exp = hyp.experiments[0]
    assert hyp.status is Status.selected
    plan = exp.plan
    assert plan is not None and plan.claim == "empirical" and plan.domain == "quant"
    assert plan.rule == rules.Rule(kind="dsr_pbo", version=1, thresholds=LOOSE)
    assert plan.checker.files == {
        "experiments/h001/e01/task/evaluate.py": exp.evaluator_hash,
        "hypotheses/h001.intake.json": applied["spec_sha256"],
    }
    assert plan.data.files == {"data/dev.csv": file_sha256(root / "data" / "dev.csv")}
    assert "Dropped if the holdout is flat." in plan.rationale
    assert applied["spec_sha256"] in plan.rationale

    body = (root / "hypotheses" / "h001.md").read_text()
    assert "Dropped if the holdout is flat." in body and "price_volume_corr" in body
    message = yaml.safe_load((root / "experiments/h001/e01/task/shinka.yaml").read_text())
    assert "Dropped if the holdout is flat." in message["evo"]["task_sys_msg"]
    seed = (root / "experiments/h001/e01/task/initial.py").read_text()
    assert "DIRECTION = 'divergence'" in seed and "LOWER = 0.0" in seed
    cfg = json.loads(
        re.search(r'r"""(.*?)"""', (root / "experiments/h001/e01/task/evaluate.py").read_text(), re.S)[1]
    )
    assert cfg["periods_per_year"] == 252.0 and cfg["cost_bps"] == 10.0
    assert "intake" in (root / "results.tsv").read_text()


def test_the_text_output_names_the_plan_and_what_was_defaulted(
    tmp_path: Path, root: Path, rich_csv: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    capsys.readouterr()
    _apply(root, _write(tmp_path, _draft()), rich_csv)
    out = capsys.readouterr().out
    assert "h001/e01 frozen: rule dsr_pbo v1" in out and "defaulted from the template" in out
    assert "sizing.mode" in out


def test_a_second_intake_reuses_the_directions_split(
    tmp_path: Path, root: Path, rich_csv: Path
) -> None:
    _apply(root, _write(tmp_path, _draft("us_equity.momentum_20d")), rich_csv)
    _apply(root, _write(tmp_path, _draft("futures.donchian_atr"), "b.json"), rich_csv)
    nb = Notebook.load(root)
    assert [h.id for h in nb.hypotheses] == ["h001", "h002"]
    assert all(h.experiments[0].plan is not None for h in nb.hypotheses)
    assert (root / "hypotheses" / "h002.intake.json").is_file()


def test_a_second_intake_on_other_data_or_another_split_is_refused(
    tmp_path: Path, root: Path, rich_csv: Path, rich_bars: pd.DataFrame
) -> None:
    _apply(root, _write(tmp_path, _draft()), rich_csv)
    other = tmp_path / "other.csv"
    rich_bars.iloc[:700].to_csv(other)
    _refused(root, _write(tmp_path, _draft(), "b.json"), other, "already uses other data")
    split = _write(tmp_path, _draft(backtest__lockbox_fraction=0.1), "c.json")
    _refused(root, split, rich_csv, "sealed at another fraction")


def test_a_second_intake_must_name_the_timestamp_column_the_split_used(
    tmp_path: Path, root: Path, rich_bars: pd.DataFrame
) -> None:
    both = tmp_path / "both.csv"
    rich_bars.assign(when=rich_bars.index).to_csv(both)
    _apply(root, _write(tmp_path, _draft()), both)
    stamp = _write(tmp_path, _draft(backtest__timestamp_col="when"), "d.json")
    _refused(root, stamp, both, "timestamp column")


def test_freeze_plan_will_not_replace_a_frozen_plan_or_freeze_a_missing_file(
    tmp_path: Path, root: Path, rich_csv: Path
) -> None:
    _apply(root, _write(tmp_path, _draft()), rich_csv)
    nb = Notebook.load(root)  # never saved: these are refusals
    exp = nb.get("h001").experiments[0]
    rule = rules.Rule(**intake.default_rule())
    with pytest.raises(ValueError, match="already has a frozen plan"):
        freeze_plan(
            root, nb, "h001", exp, checker=["hypotheses/h001.intake.json"], data=[],
            rule=rule, claim="empirical", rationale="again",
        )  # fmt: skip
    exp.plan = None
    with pytest.raises(FileNotFoundError, match="missing"):
        freeze_plan(
            root, nb, "h001", exp, checker=["hypotheses/absent.json"], data=[],
            rule=rule, claim="empirical", rationale="x",
        )  # fmt: skip
    with pytest.raises(ValueError, match="not a path inside the direction"):
        freeze_plan(
            root, nb, "h001", exp, checker=["../outside.json"], data=[],
            rule=rule, claim="empirical", rationale="x",
        )  # fmt: skip


# ---- apply: nothing half-written ----------------------------------------------


def _fail_after(monkeypatch: pytest.MonkeyPatch, owner, name: str) -> None:
    real = getattr(owner, name)

    def broken(*args, **kwargs):
        real(*args, **kwargs)
        raise RuntimeError(f"boom after {name}")

    monkeypatch.setattr(owner, name, broken)


FAILURE_POINTS = [
    (Notebook, "add_hypothesis"),
    (intake_apply, "prepare_data"),
    (intake_apply, "scaffold_experiment"),
    (intake_apply, "freeze_plan"),
]


@pytest.mark.parametrize(("owner", "name"), FAILURE_POINTS, ids=[n for _, n in FAILURE_POINTS])
def test_a_failure_in_the_middle_leaves_nothing_behind(
    tmp_path: Path, root: Path, rich_csv: Path, monkeypatch: pytest.MonkeyPatch, owner, name: str
) -> None:
    before, notebook = _tree(root), (root / "notebook.json").read_bytes()
    _fail_after(monkeypatch, owner, name)
    with pytest.raises(RuntimeError, match=f"boom after {name}"):
        _apply(root, _write(tmp_path, _draft()), rich_csv)
    assert _tree(root) == before
    assert (root / "notebook.json").read_bytes() == notebook
    assert not (root / "results.tsv").exists()
    monkeypatch.undo()
    _apply(root, _write(tmp_path, _draft()), rich_csv)  # and the direction still works
    assert Notebook.load(root).get("h001").experiments[0].plan is not None


@pytest.mark.parametrize(("owner", "name"), FAILURE_POINTS, ids=[n for _, n in FAILURE_POINTS])
def test_a_failed_second_intake_leaves_the_first_one_as_it_was(
    tmp_path: Path, root: Path, rich_csv: Path, monkeypatch: pytest.MonkeyPatch, owner, name: str
) -> None:
    _apply(root, _write(tmp_path, _draft()), rich_csv)
    before, notebook = _tree(root), (root / "notebook.json").read_bytes()
    _fail_after(monkeypatch, owner, name)
    with pytest.raises(RuntimeError, match=f"boom after {name}"):
        _apply(root, _write(tmp_path, _draft("futures.donchian_atr"), "b.json"), rich_csv)
    assert _tree(root) == before
    assert (root / "notebook.json").read_bytes() == notebook


# ---- the plan is what judges and what guards ------------------------------------


def _drift_files(root: Path) -> dict:
    task = root / "experiments" / "h001" / "e01" / "task"

    def message() -> None:
        config = task / "shinka.yaml"
        data = yaml.safe_load(config.read_text(encoding="utf-8"))
        data["evo"]["task_sys_msg"] += "\nAlso try leverage."
        config.write_text(yaml.safe_dump(data), encoding="utf-8")

    return {
        "intake": (lambda: (root / "hypotheses/h001.intake.json").write_text("{}\n"), "h001.intake.json"),
        "evaluator": (lambda: (task / "evaluate.py").write_text("# tampered\n"), "evaluate.py"),
        "data": (lambda: (root / "data/dev.csv").write_text("timestamp,close\n"), "dev.csv"),
        "message": (message, "shinka.yaml"),
    }


@pytest.mark.parametrize("command", ["probe", "run", "skeptic"])
@pytest.mark.parametrize("change", ["intake", "evaluator", "data", "message"])
def test_changing_a_frozen_file_refuses_the_next_command(
    tmp_path: Path, root: Path, rich_csv: Path, command: str, change: str
) -> None:
    _apply(root, _write(tmp_path, _draft()), rich_csv)
    tamper, name = _drift_files(root)[change]
    tamper()
    seed = root / "experiments/h001/e01/task/initial.py"
    argv = {
        "probe": ["probe", str(root), "h001", str(seed)],
        "run": ["run", str(root), "h001"],
        "skeptic": ["skeptic", str(root), "h001"],
    }[command]
    before = Notebook.load(root)
    with pytest.raises(RuntimeError, match=rf"{re.escape(name)}.*(changed|modified)"):
        cli.main(argv)
    assert Notebook.load(root) == before


@pytest.mark.parametrize("change", ["intake", "evaluator", "data", "message"])
def test_the_plan_alone_catches_each_frozen_file(
    tmp_path: Path, root: Path, rich_csv: Path, change: str
) -> None:
    """Even with the experiment's own hashes brought up to date, the plan
    refuses: it froze the spec, the evaluator, the data and the message too."""
    _apply(root, _write(tmp_path, _draft()), rich_csv)
    tamper, name = _drift_files(root)[change]
    tamper()
    with Notebook.edit(root) as nb:
        exp = nb.get("h001").experiments[0]
        exp.evaluator_hash = file_sha256(root / "experiments/h001/e01/task/evaluate.py")
        exp.data_hash = file_sha256(root / "data" / "dev.csv")
    seed = root / "experiments/h001/e01/task/initial.py"
    with pytest.raises(RuntimeError, match=rf"{re.escape(name)}.*changed since the plan was frozen"):
        cli.main(["probe", str(root), "h001", str(seed)])


def _fake_results(results_dir: Path, seed: str) -> None:
    results_dir.mkdir(parents=True)
    with sqlite3.connect(results_dir / "programs.sqlite") as conn:
        conn.execute(
            "CREATE TABLE programs (id TEXT, code TEXT, combined_score REAL, "
            "correct INTEGER, metadata TEXT)"
        )
        conn.executemany(
            "INSERT INTO programs VALUES (?, ?, ?, ?, '{}')",
            [("p0", seed, 0.3, 1), ("p1", seed.replace("LOOKBACK = 20", "LOOKBACK = 5"), 0.5, 1)],
        )
    conn.close()


@needs_engine
def test_skeptic_and_verdict_judge_from_the_plan_not_the_command_line(
    tmp_path: Path, root: Path, rich_csv: Path
) -> None:
    rule = {"kind": "dsr_pbo", "version": 1, "thresholds": LOOSE}
    _apply(root, _write(tmp_path, _draft(rule=rule)), rich_csv)
    task = root / "experiments" / "h001" / "e01" / "task"
    _fake_results(task.parent / "results", (task / "initial.py").read_text())
    with Notebook.edit(root) as nb:
        nb.get("h001").experiments[0].n_evaluated = 2

    with pytest.raises(SystemExit, match="--dsr"):
        cli.main(["skeptic", str(root), "h001", "--dsr", "0.95"])
    cli.main(["skeptic", str(root), "h001"])
    exp = Notebook.load(root).get("h001").experiments[0]
    assert exp.skeptic["thresholds"] == {
        "dsr_supported": 0.5, "min_positive_fraction": 0.5, "max_pbo": 0.9,
    }  # fmt: skip
    assert exp.skeptic["rule"]["kind"] == "dsr_pbo"
    assert "Rule: dsr_pbo v1 (frozen by the plan)" in (task.parent / "skeptic.md").read_text()
    label, reason = rules.judge(exp.plan.rule, {k: v for k, v in exp.skeptic.items() if k != "rule"})
    assert exp.skeptic["rule_label"] == label and exp.skeptic["rule_reason"] == reason

    cli.main(["verdict", str(root), "h001"])
    verdict = Notebook.load(root).get("h001").verdict
    assert verdict.label.value == label and verdict.reason == reason
