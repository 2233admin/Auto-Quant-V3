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

Studio shows the demo marker (`DEMO_DATA.md`) once per page, so the per-item
demo label the generator put before every title, note and log line is removed,
and user-facing prose is Chinese like the UI: templated texts (evaluator
feedback, failures, reasoning notes, prompt headers) are translated here, and the
agent-written library pages come from `overlay/library/`. Ids, file names and the
raw sources (hashed by the library manifest) are unchanged; every number is
still synthetic.

`tests/shinka_demo.py` builds a complete V3 Workspace from this fixture.
"""

import json
import re
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


LABEL = "DEMO · 演示数据，非真实研究"
_FAILURES = [
    (r"KeyError: 'volume' \(column not present in the frozen data\)", "KeyError: 'volume'（冻结数据中没有这一列）"),
    (r"look-ahead detected: positions on the first (\d+) bars changed when later bars were removed", r"检测到前视：删除后续 K 线后，前 \1 根 K 线的仓位发生了变化"),
    (r"evaluation timed out after ([\d.]+) s", r"评估在 \1 秒后超时"),
    (r"positions outside \[([^\]]+)\] \(max ([^)]+)\)", r"仓位超出 [\1]（最大 \2）"),
    (r"run_experiment returned NaN positions after the warm-up window", "run_experiment 在预热期之后返回了 NaN 仓位"),
]


def _strip(text):
    """Remove the generator's per-item demo label; the page-level notice says it once."""
    if not isinstance(text, str) or LABEL not in text:
        return text
    lines = [line for line in text.split("\n") if line.strip() not in (f"> {LABEL}", f"# {LABEL}", f"## {LABEL}") and not line.startswith(f"> {LABEL}:")]
    text = "\n".join(lines)
    for sep in (" · ", " — ", ": ", ". ", "."):
        text = text.replace(LABEL + sep, "")
    text = text.replace(f"[{LABEL}]", "[demo]").replace(LABEL, "")
    return re.sub(r"\n{3,}", "\n\n", text).lstrip("\n")


# Rule outputs and ledger notes the research layer wrote in English (verdict reasons, results.tsv notes).
_NUM = r"(-?[\d.]+)"
_LABELS = {"supported": "成立", "refuted": "被拒绝", "inconclusive": "证据不足", "confirmed": "已确认", "unconfirmed": "未确认"}
_RULES = [
    (rf"DSR {_NUM} >= {_NUM} over (\d+) trials; {_NUM}% of OOS sub-periods positive; beats buy-and-hold \({_NUM}\)",
     r"DSR \1 >= \2（共 \3 次试验）；验证段子区间 \4% 为正；胜过买入持有（\5）"),
    (rf"OOS Sharpe {_NUM} > 0 but DSR {_NUM} \(needs {_NUM}\), sub-period stability {_NUM}% \(needs {_NUM}%\) or PBO {_NUM} \(max {_NUM}\) falls short",
     r"验证段 Sharpe \1 > 0，但 DSR \2（需要 \3）、子区间稳定性 \4%（需要 \5%）或 PBO \6（上限 \7）未达标"),
    (rf"OOS Sharpe {_NUM} does not beat buy-and-hold \({_NUM}\)", r"验证段 Sharpe \1 没有胜过买入持有（\2）"),
    (rf"OOS Sharpe {_NUM} <= 0", r"验证段 Sharpe \1 <= 0"),
    (rf"(\d+) new programs, (\d+) total, best IS score {_NUM}, spend \$([\d.]+)", r"新增 \1 个程序，共 \2 个，样本内最佳 \3，花费 $\4"),
    (rf"lockbox Sharpe {_NUM}, DSR {_NUM}", r"封存段 Sharpe \1，DSR \2"),
    (r"^seed (\S+)$", r"种子程序 \1"),
]


def _rules(text):
    for pattern, zh in _RULES:
        text = re.sub(pattern, zh, text)
    text = re.sub(r"^rule says (\w+): ", lambda m: f"规则判定{_LABELS.get(m[1], m[1])}：", text)
    return re.sub(r"^(supported|refuted|inconclusive|confirmed|unconfirmed): ", lambda m: f"{_LABELS[m[1]]}：", text)


def _ledger(text):
    """results.tsv: the note column only."""
    rows = []
    for line in text.split("\n"):
        cells = line.split("\t")
        if len(cells) == 5 and cells[0] != "time":
            cells[4] = _rules(cells[4])
        rows.append("\t".join(cells))
    return "\n".join(rows)


def _zh(text):
    """Chinese for the generator's templated English prose, after the label is gone."""
    text = _strip(text)
    if not isinstance(text, str):
        return text
    text = re.sub(
        r"In-sample fold Sharpe: ([^(]+) \(mean ([-\d.]+)\)\. Annual return ([-\d.]+)%, max drawdown ([-\d.]+)%, mean turnover ([-\d.]+) per bar, costs ([-\d.]+) bps\.",
        lambda m: f"样本内各折 Sharpe：{m[1].strip().replace(', ', '、')}（均值 {m[2]}）。年化收益 {m[3]}%，最大回撤 {m[4]}%，平均每根 K 线换手 {m[5]}，成本 {m[6]} bps。",
        text,
    )
    if text.startswith("Evaluation failed: "):
        tail = text[len("Evaluation failed: "):]
        for pattern, zh in _FAILURES:
            tail = re.sub(pattern, zh, tail)
        text = "评估失败：" + tail
    text = re.sub(r"Synthetic reasoning note \(no model was called\)\. Plan: (.+?); keep the evaluator contract and the EVOLVE-BLOCK intact\.", r"合成的推理笔记（未调用任何模型）。计划：\1；保持评估器约定和 EVOLVE-BLOCK 不变。", text)
    text = re.sub(r"# Synthetic system prompt v(\d+); written by the demo generator and never sent to a model\.", r"# 合成的系统提示词 v\1；由演示生成器写出，从未发送给模型。", text)
    return text


def _deep(value):
    if isinstance(value, dict):
        return {k: _deep(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_deep(v) for v in value]
    value = _strip(value)
    return _rules(value) if isinstance(value, str) else value


def _rewrite(path):
    text = _zh(path.read_text(encoding="utf-8"))
    path.write_text(_ledger(text) if path.name == "results.tsv" else text, encoding="utf-8", newline="\n")


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
                kept = {k: _zh(v) for k, v in kept.items()}
                conn.execute("UPDATE programs SET metadata = ? WHERE id = ?", (json.dumps(kept, ensure_ascii=False), pid))
            for pid, feedback in conn.execute("SELECT id, text_feedback FROM programs").fetchall():
                conn.execute("UPDATE programs SET text_feedback = ? WHERE id = ?", (_zh(feedback), pid))
        else:
            for pid, text, description in conn.execute("SELECT id, prompt_text, description FROM system_prompts").fetchall():
                conn.execute("UPDATE system_prompts SET prompt_text = ?, description = ? WHERE id = ?", (_zh(text), _zh(description), pid))
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
            json.dumps(_deep(_relative(notebook, direction)), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        for text in TEXT:
            if (direction / text).is_file():
                shutil.copyfile(direction / text, research / text)
        shutil.copytree(direction / "hypotheses", research / "hypotheses")
        for path in [*(research / "hypotheses").glob("*.md"), *(research / t for t in TEXT)]:
            if path.is_file():
                _rewrite(path)
        shutil.copyfile(demo / "DEMO_DATA.md", research / "DEMO_DATA.md")
        for exp in sorted((direction / "experiments").glob("*/*")):
            target = research / "experiments" / exp.parent.name / exp.name
            target.mkdir(parents=True)
            if (exp / "results" / "meta").is_dir():
                shutil.copytree(exp / "results" / "meta", target / "results" / "meta")
                for note in (target / "results" / "meta").glob("*.txt"):
                    _rewrite(note)
            if (exp / "skeptic.md").is_file():
                shutil.copyfile(exp / "skeptic.md", target / "skeptic.md")
                _rewrite(target / "skeptic.md")
            for db, programs in (("programs.sqlite", True), ("prompts.sqlite", False)):
                if (exp / "results" / db).is_file():
                    _trim(exp / "results" / db, target / "results" / db, programs, (name, exp.parent.name, exp.name) in FULL)
        (out / project / "project.json").write_text(
            json.dumps({"name": project, "description": _strip(notebook["direction"])}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    lib = HERE / "library"
    shutil.rmtree(lib, ignore_errors=True)
    shutil.copytree(demo / "library", lib)
    shutil.copytree(HERE / "overlay" / "library", lib, dirs_exist_ok=True)
    shutil.copyfile(demo / "DEMO_DATA.md", lib / "DEMO_DATA.md")
    _lf(out, lib)


def _lf(*roots):
    """The repository checks text out with LF (.gitattributes), so the fixture is LF on disk too, and the
    library manifest hashes the LF raw sources it says were compiled (else a checkout shows them pending)."""
    import hashlib

    for root in roots:
        for path in root.rglob("*"):
            if path.is_file() and path.suffix in (".md", ".json", ".tsv", ".txt"):
                data = path.read_bytes()
                if b"\r\n" in data:
                    path.write_bytes(data.replace(b"\r\n", b"\n"))
    lib = roots[-1]
    manifest = json.loads((lib / "manifest.json").read_text(encoding="utf-8"))
    manifest = {rel: hashlib.sha256((lib / rel).read_bytes()).hexdigest() for rel in manifest}
    (lib / "manifest.json").write_bytes((json.dumps(manifest, indent=2) + "\n").encode())


if __name__ == "__main__":
    convert(Path(sys.argv[1]))
