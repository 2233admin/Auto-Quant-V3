"""What an intake spec turns into: the seed program, the hypothesis text and
the catalogue entry `aq shinka intake templates` lists."""

from __future__ import annotations

from typing import Any

from autoquant.shinka_research.intake import IntakeSpec, resolve
from autoquant.shinka_research.intake_templates import (
    MARKETS,
    REFUTATION_PROPOSAL,
    TEMPLATES,
    Template,
    render_seed,
)


def position_limits(spec: IntakeSpec) -> tuple[float, float]:
    top = spec.sizing.max_position
    return (0.0 if spec.sizing.mode == "long_only" else -top), top


def seed_program(spec: IntakeSpec) -> str:
    lower, upper = position_limits(spec)
    return render_seed(
        TEMPLATES[spec.template],
        spec.signal.params,
        title=spec.title,
        lower=lower,
        upper=upper,
        stop_loss_pct=spec.risk_control.stop_loss_pct,
    )


def render_hypothesis(spec: IntakeSpec) -> str:
    """The hypothesis body: the six elements, the test and what refutes it."""
    lower, upper = position_limits(spec)
    th = spec.rule.thresholds
    market = MARKETS[spec.market]
    sizing = "long-only" if spec.sizing.mode == "long_only" else "long-short"
    stop = spec.risk_control.stop_loss_pct
    params = ", ".join(f"{k}={v}" for k, v in spec.signal.params.items())
    bt = spec.backtest
    return "\n".join(
        [
            "## Statement",
            f"{spec.signal.description} Tested on {spec.symbol} ({market.label}); "
            f"the effect survives {bt.cost_bps:g} bps of cost per unit of turnover.",
            "",
            "## Request elements",
            f"- Market: {spec.market}",
            f"- Symbol: {spec.symbol}",
            f"- Signal: {spec.signal.kind} ({params})",
            f"- Position sizing: {sizing}, positions within [{lower:g}, {upper:g}]",
            "- Risk control: "
            + (
                f"flat once the close is {stop:.1%} against the entry price"
                if stop
                else "none"
            ),
            f"- Backtest: out-of-sample {bt.oos_fraction:.0%}, {bt.n_folds} in-sample "
            f"folds, {bt.cost_bps:g} bps cost, {bt.periods_per_year:g} bars a year, "
            f"lockbox {bt.lockbox_fraction:.0%}",
            "",
            "## Test",
            f"Evolve a causal position rule seeded with the {spec.signal.kind} signal. "
            "Score on in-sample walk-forward Sharpe after costs; judge on the "
            "untouched out-of-sample holdout. The position limits and the stop sit "
            "outside the evolved block and stay as written.",
            "",
            "## Supported if",
            f"Rule {spec.rule.kind} v{spec.rule.version}: out-of-sample Sharpe is "
            "positive and beats buy-and-hold, the deflated Sharpe ratio is at least "
            f"{th['dsr_supported']:g}, at least {th['min_positive_fraction']:.0%} of "
            f"{int(th['n_subperiods'])} holdout sub-periods are positive, and the "
            f"probability of backtest overfitting is at most {th['max_pbo']:g}.",
            "",
            "## Refuted if",
            spec.refutation,
            "",
            "## Risks",
            "Regime dependence; turnover eating the edge; overfitting the in-sample folds.",
        ]
    )


def _set(draft: dict[str, Any], path: str, value: Any) -> None:
    node = draft
    *parents, leaf = path.split(".")
    for part in parents:
        node = node.setdefault(part, {})
    node[leaf] = value


def suggested_draft(template: Template) -> dict[str, Any]:
    """A draft that accepts every suggestion the template makes: what a person
    in a hurry would send. It is ready by construction."""
    draft: dict[str, Any] = {"template": template.id}
    for question in resolve(template.id, {}).questions:
        _set(draft, question.field, question.default)
    return draft


def describe_template(template: Template) -> dict[str, Any]:
    """The catalogue entry as `intake templates --json` lists it, with the
    seed program its suggested draft produces."""
    market = MARKETS[template.market]
    suggested = resolve(template.id, suggested_draft(template))
    return {
        "id": template.id,
        "market": template.market,
        "scenario": template.scenario,
        "title": template.spec.title,
        "signal": template.spec.signal,
        "columns": ["timestamp", *template.spec.columns],
        "params": [
            {
                "name": p.name,
                "kind": p.kind,
                "default": template.default(p),
                "description": p.description,
                "minimum": p.minimum,
                "maximum": p.maximum,
                "choices": list(p.choices),
                "open": p.open,
            }
            for p in template.spec.params
        ],
        "defaults": {
            "sizing_mode": market.sizing_mode,
            "periods_per_year": market.periods_per_year,
            "cost_bps": market.cost_bps,
        },
        "refutation_proposal": REFUTATION_PROPOSAL,
        "suggested_draft": suggested_draft(template),
        "seed_program": seed_program(suggested.spec),
    }
