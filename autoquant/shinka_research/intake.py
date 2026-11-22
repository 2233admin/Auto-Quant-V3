"""Intake: from half an idea to a frozen quant experiment plan.

A person picks a template (``intake_templates``) and answers the few questions
that change what the test means: the market, the instrument, a choice the
template leaves open, the refutation criterion ("what result would make you
drop this?") and the cost. Everything else comes from the template and the
market and is listed as defaulted. ``IntakeSpec`` is the resolved, strict
record; ``apply_intake`` writes it beside the hypothesis, scaffolds the
experiment from it and freezes the experiment's plan with the spec file in the
checker set, so the existing drift check covers the spec like any other
frozen file.

The agent or the template proposes; the verdict rule is core's. The refutation
criterion is the owner's wording, kept for audit and shown to the mutation
model; the frozen rule decides.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictFloat,
    StrictInt,
    StrictStr,
    StringConstraints,
    ValidationError,
)

from autoquant.shinka_research.intake_templates import (
    MARKETS,
    REFUTATION_PROPOSAL,
    TEMPLATES,
    Param,
    Template,
)
from autoquant.shinka_research.rules import DSR_PBO, Rule
from autoquant.shinka_research.skeptic import Thresholds

INTAKE_VERSION = 1
INTAKE_SUFFIX = ".intake.json"

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ParamValue = StrictInt | StrictFloat | StrictStr
Market = Literal["cn_equity", "us_equity", "futures", "crypto"]

# What a draft may contain; the rest of the spec is the template's or computed.
DRAFT_KEYS = frozenset(
    {
        "template",
        "title",
        "market",
        "symbol",
        "signal",
        "sizing",
        "risk_control",
        "backtest",
        "refutation",
        "rule",
    }
)


class IntakeError(ValueError):
    """The draft cannot be turned into an experiment; the message says why."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)


class Signal(_Strict):
    kind: str
    description: Text
    params: dict[str, ParamValue]


class Sizing(_Strict):
    mode: Literal["long_only", "long_short"]
    max_position: float = Field(gt=0.0, le=1.0)


class RiskControl(_Strict):
    # Flat once the close is this fraction against the entry price; None: no stop.
    stop_loss_pct: float | None = Field(gt=0.0, lt=1.0)


class Backtest(_Strict):
    oos_fraction: float = Field(gt=0.0, lt=1.0)
    n_folds: int = Field(ge=1, le=20)
    cost_bps: float = Field(ge=0.0, le=1000.0)
    periods_per_year: float = Field(gt=0.0)
    lockbox_fraction: float = Field(gt=0.0, le=0.5)
    timestamp_col: Text


class IntakeSpec(_Strict):
    """The resolved intake: six request elements, the refutation criterion, the
    cost, and the verdict rule. This is what gets hashed and frozen."""

    version: Literal[1]
    template: str
    title: Text
    market: Market
    symbol: Text
    signal: Signal
    sizing: Sizing
    risk_control: RiskControl
    backtest: Backtest
    refutation: Text
    rule: Rule
    # Fields filled from the template and the market rather than given.
    defaulted: list[str]


def canonical_json(spec: IntakeSpec) -> str:
    """The spec as it is stored: sorted keys, fixed layout, trailing newline."""
    return (
        json.dumps(
            spec.model_dump(mode="json"), sort_keys=True, indent=2, ensure_ascii=False
        )
        + "\n"
    )


def spec_sha256(spec: IntakeSpec) -> str:
    return hashlib.sha256(canonical_json(spec).encode("utf-8")).hexdigest()


# ---- questions and merging ------------------------------------------------


@dataclass(frozen=True)
class Question:
    """A choice only the caller can make. ``default`` is a suggestion: the
    answer must still be given in the spec."""

    field: str
    prompt: str
    default: Any
    choices: Sequence[Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "field": self.field,
            "prompt": self.prompt,
            "default": self.default,
            "choices": list(self.choices) if self.choices is not None else None,
        }


@dataclass(frozen=True)
class Resolution:
    template: Template
    questions: list[Question]
    answered: list[str]
    defaulted: list[str]
    # The strict spec once nothing is open; None while questions remain.
    spec: IntakeSpec | None

    @property
    def ready(self) -> bool:
        return not self.questions

    def as_dict(self) -> dict[str, Any]:
        return {
            "template": self.template.id,
            "ready": self.ready,
            "questions": [q.as_dict() for q in self.questions],
            "answered": self.answered,
            "defaulted": self.defaulted,
            "spec": json.loads(canonical_json(self.spec)) if self.spec else None,
        }


def default_rule() -> dict[str, Any]:
    th = Thresholds()
    return {
        "kind": DSR_PBO,
        "version": 1,
        "thresholds": {
            "dsr_supported": th.dsr_supported,
            "min_positive_fraction": th.min_positive_fraction,
            "n_subperiods": th.n_subperiods,
            "max_pbo": th.max_pbo,
        },
    }


def _get(draft: Mapping[str, Any], path: str) -> Any:
    node: Any = draft
    for part in path.split("."):
        if not isinstance(node, Mapping) or part not in node:
            return None
        node = node[part]
    return node


def _given(draft: Mapping[str, Any], path: str) -> bool:
    value = _get(draft, path)
    if isinstance(value, str):
        return bool(value.strip())
    return value is not None


def _section(draft: Mapping[str, Any], name: str) -> Mapping[str, Any]:
    value = draft.get(name)
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise IntakeError(f"{name} must be an object")
    return value


def _check_param(param: Param, value: Any) -> Any:
    label = f"signal.params.{param.name}"
    if param.kind == "choice":
        if not isinstance(value, str) or value not in param.choices:
            raise IntakeError(f"{label} must be one of {', '.join(param.choices)}")
        return value
    number = isinstance(value, (int, float)) and not isinstance(value, bool)
    if param.kind == "int" and not (isinstance(value, int) and not isinstance(value, bool)):
        number = False
    if not number or not math.isfinite(value):
        raise IntakeError(f"{label} must be a{'n integer' if param.kind == 'int' else ' number'}")
    if not param.minimum <= value <= param.maximum:
        raise IntakeError(f"{label} must be within [{param.minimum:g}, {param.maximum:g}]")
    return float(value) if param.kind == "float" else value


def _signal_params(
    template: Template, draft: Mapping[str, Any]
) -> tuple[dict[str, Any], list[Question], list[str], list[str]]:
    signal = _section(draft, "signal")
    extra = sorted(set(signal) - {"params"})
    if extra:
        raise IntakeError(
            f"signal.{extra[0]} comes from the template; only signal.params can be given"
        )
    given = _section(signal, "params")
    known = {p.name: p for p in template.spec.params}
    unknown = sorted(set(given) - set(known))
    if unknown:
        raise IntakeError(
            f"signal.params.{unknown[0]} is not a parameter of {template.id}; "
            f"it has {', '.join(known)}"
        )
    values: dict[str, Any] = {}
    questions: list[Question] = []
    answered: list[str] = []
    defaulted: list[str] = []
    for param in template.spec.params:
        path = f"signal.params.{param.name}"
        if param.name in given and given[param.name] is not None:
            values[param.name] = _check_param(param, given[param.name])
            answered.append(path)
            continue
        values[param.name] = template.default(param)
        if param.open:
            questions.append(Question(path, param.description, values[param.name], param.choices))
        else:
            defaulted.append(path)
    problem = template.spec.check(values)
    if problem:
        raise IntakeError(f"signal.params: {problem}")
    return values, questions, answered, defaulted


def _errors(error: ValidationError) -> str:
    parts = []
    for item in error.errors():
        where = ".".join(str(p) for p in item["loc"]) or "spec"
        parts.append(f"{where}: {item['msg']}")
    return "; ".join(parts)


def resolve(template_id: str | None, draft: Mapping[str, Any]) -> Resolution:
    """Merge a template with the caller's answers.

    Raises ``IntakeError`` for an unknown template, an unknown or ill-typed
    field, or a value outside its bounds, whether or not the draft is
    complete. A complete, valid draft carries the strict ``spec``.
    """
    unknown = sorted(set(draft) - DRAFT_KEYS)
    if unknown:
        raise IntakeError(
            f"unknown field {unknown[0]!r}; a draft may hold {', '.join(sorted(DRAFT_KEYS))}"
        )
    named = draft.get("template")
    if template_id and named and template_id != named:
        raise IntakeError(f"--template {template_id} differs from the draft's {named}")
    tid = template_id or named
    if not tid:
        raise IntakeError(f"no template given; choose one of {', '.join(TEMPLATES)}")
    template = TEMPLATES.get(tid)
    if template is None:
        raise IntakeError(f"unknown template {tid!r}; choose one of {', '.join(TEMPLATES)}")

    questions: list[Question] = []
    answered: list[str] = []
    defaulted: list[str] = []

    market = template.market
    if _given(draft, "market"):
        market = draft["market"]
        if market not in MARKETS:
            raise IntakeError(f"market must be one of {', '.join(MARKETS)}")
        answered.append("market")
    else:
        questions.append(
            Question(
                "market",
                "Which market is this tested in? It sets the bars per year, the "
                "starting cost and whether the position may go short.",
                template.market,
                list(MARKETS),
            )
        )
    profile = MARKETS[market]

    if _given(draft, "symbol"):
        symbol = draft["symbol"]
        answered.append("symbol")
    else:
        symbol = profile.example_symbol
        questions.append(
            Question(
                "symbol",
                "Which instrument does your data file hold? It goes into the "
                "hypothesis and the frozen spec.",
                profile.example_symbol,
            )
        )

    params, param_questions, param_answered, param_defaulted = _signal_params(template, draft)
    questions += param_questions
    answered += param_answered
    defaulted += param_defaulted

    if _given(draft, "refutation"):
        refutation = draft["refutation"]
        answered.append("refutation")
    else:
        refutation = REFUTATION_PROPOSAL
        questions.append(
            Question(
                "refutation",
                "What result would make you drop this idea? It is kept in the "
                "frozen spec and shown to the mutation model; the verdict itself "
                "is decided by the frozen rule.",
                REFUTATION_PROPOSAL,
            )
        )

    backtest = dict(_section(draft, "backtest"))
    if _given(draft, "backtest.cost_bps"):
        answered.append("backtest.cost_bps")
    else:
        backtest.pop("cost_bps", None)
        backtest["cost_bps"] = profile.cost_bps
        questions.append(
            Question(
                "backtest.cost_bps",
                "Cost per unit of turnover in basis points (fees, spread, "
                "slippage). Cost decides whether most signals survive.",
                profile.cost_bps,
            )
        )
    for name, value in (
        ("oos_fraction", 0.3),
        ("n_folds", 3),
        ("periods_per_year", profile.periods_per_year),
        ("lockbox_fraction", 0.2),
        ("timestamp_col", "timestamp"),
    ):
        if backtest.get(name) is None:
            backtest[name] = value
            defaulted.append(f"backtest.{name}")

    sizing = dict(_section(draft, "sizing"))
    for name, value in (("mode", profile.sizing_mode), ("max_position", 1.0)):
        if sizing.get(name) is None:
            sizing[name] = value
            defaulted.append(f"sizing.{name}")

    risk = dict(_section(draft, "risk_control"))
    if "stop_loss_pct" not in risk:
        risk["stop_loss_pct"] = None
        defaulted.append("risk_control.stop_loss_pct")

    title = draft.get("title")
    if not (isinstance(title, str) and title.strip()):
        title = f"{template.spec.title} on {symbol}"
        defaulted.append("title")

    rule = draft.get("rule")
    if rule is None:
        rule = default_rule()
        defaulted.append("rule")
    elif not isinstance(rule, Mapping):
        raise IntakeError("rule must be an object")

    merged = {
        "version": INTAKE_VERSION,
        "template": template.id,
        "title": title,
        "market": market,
        "symbol": symbol,
        "signal": {
            "kind": template.scenario,
            "description": template.spec.signal,
            "params": params,
        },
        "sizing": sizing,
        "risk_control": risk,
        "backtest": backtest,
        "refutation": refutation,
        "rule": rule,
        "defaulted": defaulted,
    }
    try:
        spec = IntakeSpec.model_validate_json(json.dumps(merged), strict=True)
    except ValidationError as error:
        raise IntakeError(_errors(error)) from None
    except (TypeError, ValueError) as error:
        raise IntakeError(f"the draft is not valid JSON data ({error})") from None
    if spec.rule.kind != DSR_PBO:
        raise IntakeError(
            f"a quant intake is judged by {DSR_PBO}; rule {spec.rule.kind} needs "
            "checker evidence the quant skeptic does not gather"
        )
    return Resolution(
        template, questions, answered, defaulted, None if questions else spec
    )
