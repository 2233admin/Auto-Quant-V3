"""Verified Portfolio performance, friction and sampled growth projections."""

from __future__ import annotations

import math
from bisect import bisect_right
from typing import Any

import pandas as pd

from .intervals import annualization_periods
from .project_templates.ohlcv_portfolio_lab.portfolio_core import performance_metrics
from .portfolio_projection import (
    BREAK_EVEN_COST_SEARCH_MAX_BPS, STRATEGY_VIABILITY_METHOD, ParsedDaily,
    _fail, _finite, _sample_indices, _split_for,
)


def _reconcile_performance_metrics(
    observed: dict[str, Any],
    expected: dict[str, Any],
    path: str,
) -> None:
    reconciliation_fields = {
        "observations",
        "total_return",
        "annual_return",
        "annual_volatility",
        "sharpe",
        "sortino",
        "maximum_drawdown",
        "calmar",
        "expected_shortfall_95",
        "positive_rate",
        "benchmark_beta",
        "active_annual_return",
        "tracking_error",
        "information_ratio",
    }
    if not reconciliation_fields.issubset(observed):
        _fail(
            path,
            "portfolio.viability-performance",
            "Performance metrics omit fields required for ledger reconciliation",
        )
    for key in reconciliation_fields:
        expected_value = expected[key]
        observed_value = _finite(observed.get(key), f"{path}/{key}")
        if not math.isclose(
            observed_value,
            float(expected_value),
            rel_tol=0.0,
            abs_tol=1e-9,
        ):
            _fail(
                f"{path}/{key}",
                "portfolio.viability-performance",
                "Performance metric differs from the reconstructed ledger",
            )



def _project_performance(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "observations": int(value["observations"]),
        "totalReturn": float(value["total_return"]),
        "annualReturn": float(value["annual_return"]),
        "annualVolatility": float(value["annual_volatility"]),
        "sharpe": float(value["sharpe"]),
        "sortino": float(value["sortino"]),
        "maximumDrawdown": float(value["maximum_drawdown"]),
        "calmar": float(value["calmar"]),
        "expectedShortfall95": float(value["expected_shortfall_95"]),
        "positiveRate": float(value["positive_rate"]),
        "activeAnnualReturn": float(value["active_annual_return"]),
        "informationRatio": float(value["information_ratio"]),
    }



def _break_even_cost(
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    gross_total_return = math.prod(
        1.0 + row["gross_return"] for row in rows
    ) - 1.0
    traded = sum(row["traded_notional"] for row in rows)
    if gross_total_return <= 0.0:
        return {
            "status": "gross-non-positive",
            "bps": None,
            "searchMaximumBps": BREAK_EVEN_COST_SEARCH_MAX_BPS,
        }
    if traded <= 1e-12:
        return {
            "status": "no-turnover",
            "bps": None,
            "searchMaximumBps": BREAK_EVEN_COST_SEARCH_MAX_BPS,
        }

    def compounded(cost_bps: float) -> float | None:
        growth = 1.0
        for row in rows:
            net_return = (
                row["gross_return"]
                - row["traded_notional"] * cost_bps / 10_000.0
            )
            if net_return <= -1.0:
                return None
            growth *= 1.0 + net_return
        return growth - 1.0

    upper_return = compounded(BREAK_EVEN_COST_SEARCH_MAX_BPS)
    if upper_return is not None and upper_return > 0.0:
        return {
            "status": "above-search-bound",
            "bps": None,
            "searchMaximumBps": BREAK_EVEN_COST_SEARCH_MAX_BPS,
        }
    lower = 0.0
    upper = BREAK_EVEN_COST_SEARCH_MAX_BPS
    for _ in range(80):
        middle = (lower + upper) / 2.0
        value = compounded(middle)
        if value is None or value <= 0.0:
            upper = middle
        else:
            lower = middle
    return {
        "status": "available",
        "bps": (lower + upper) / 2.0,
        "searchMaximumBps": BREAK_EVEN_COST_SEARCH_MAX_BPS,
    }



def _temporal_viability(rows: list[dict[str, Any]]) -> dict[str, Any]:
    monthly: dict[str, float] = {}
    for row in rows:
        month = row["timestamp"][:7]
        monthly[month] = (
            (1.0 + monthly.get(month, 0.0))
            * (1.0 + row["net_return"])
            - 1.0
        )
    ordered_months = sorted(monthly.items())
    best_month = max(ordered_months, key=lambda item: (item[1], item[0]))
    worst_month = min(ordered_months, key=lambda item: (item[1], item[0]))

    growth = 1.0
    peak = 1.0
    underwater_start: str | None = None
    current_bars = 0
    maximum_bars = 0
    maximum_start: str | None = None
    maximum_end: str | None = None
    for row in rows:
        growth *= 1.0 + row["net_return"]
        if growth >= peak - 1e-12:
            peak = max(peak, growth)
            underwater_start = None
            current_bars = 0
            continue
        if underwater_start is None:
            underwater_start = row["timestamp"]
        current_bars += 1
        if current_bars > maximum_bars:
            maximum_bars = current_bars
            maximum_start = underwater_start
            maximum_end = row["timestamp"]

    best_day_count = min(5, len(rows))
    best_days = sorted(
        rows,
        key=lambda row: (row["net_return"], row["timestamp"]),
        reverse=True,
    )[:best_day_count]
    best_dates = {row["timestamp"] for row in best_days}
    total_absolute = sum(abs(row["net_return"]) for row in rows)
    best_absolute = sum(abs(row["net_return"]) for row in best_days)
    without_best = math.prod(
        1.0 + row["net_return"]
        for row in rows
        if row["timestamp"] not in best_dates
    ) - 1.0
    return {
        "months": len(ordered_months),
        "positiveNetMonthRate": (
            sum(value > 0.0 for _, value in ordered_months)
            / len(ordered_months)
        ),
        "bestNetMonth": {
            "month": best_month[0],
            "return": best_month[1],
        },
        "worstNetMonth": {
            "month": worst_month[0],
            "return": worst_month[1],
        },
        "maximumUnderwaterBars": maximum_bars,
        "maximumUnderwaterStart": maximum_start,
        "maximumUnderwaterEnd": maximum_end,
        "currentUnderwaterBars": current_bars,
        "bestDayCount": best_day_count,
        "bestDaysAbsoluteReturnShare": (
            best_absolute / total_absolute
            if total_absolute > 1e-12
            else 0.0
        ),
        "netTotalReturnWithoutBestDays": without_best,
    }



def _strategy_viability_projection(
    result: dict[str, Any],
    daily: ParsedDaily,
    splits: dict[str, Any],
) -> dict[str, Any]:
    metrics = result["metrics"]
    portfolio = metrics.get("portfolio")
    implementation = metrics.get("implementation")
    factor = metrics.get("factor")
    robustness = metrics.get("robustness")
    if not all(
        isinstance(value, dict)
        for value in (portfolio, implementation, factor, robustness)
    ):
        _fail(
            "RunResult/metrics",
            "portfolio.viability",
            "Strategy viability requires factor, portfolio, implementation, and robustness metrics",
        )
    cost_stress = robustness.get("cost_stress")
    extra_delay = robustness.get("extra_delay")
    if not isinstance(cost_stress, dict) or not isinstance(extra_delay, dict):
        _fail(
            "RunResult/metrics/robustness",
            "portfolio.viability",
            "Strategy viability requires fixed cost and delay stress evidence",
        )

    active_cost_bps: list[float] = []
    for index, row in enumerate(daily.rows):
        traded = row["traded_notional"]
        cost = row["cost"]
        if traded <= 1e-12:
            if cost > 1e-12:
                _fail(
                    f"portfolio-daily:{index + 2}/cost",
                    "portfolio.viability-cost",
                    "A zero-trade row cannot carry implementation cost",
                )
            continue
        active_cost_bps.append(cost / traded * 10_000.0)
    if not active_cost_bps or any(
        not math.isclose(
            value,
            active_cost_bps[0],
            rel_tol=0.0,
            abs_tol=1e-9,
        )
        for value in active_cost_bps
    ):
        _fail(
            "portfolio-daily/cost",
            "portfolio.viability-cost",
            "Daily implementation cost must use one fixed per-notional bps rate",
        )
    base_cost_bps = active_cost_bps[0]
    mandate = metrics.get("portfolio_mandate")
    implementation_policy = (
        mandate.get("implementationPolicy")
        if isinstance(mandate, dict)
        else None
    )
    declared_base_cost = (
        implementation_policy.get("baseCostBps")
        if isinstance(implementation_policy, dict)
        else None
    )
    if (
        not isinstance(declared_base_cost, (int, float))
        or isinstance(declared_base_cost, bool)
        or not math.isclose(
            base_cost_bps,
            float(declared_base_cost),
            rel_tol=0.0,
            abs_tol=1e-9,
        )
    ):
        _fail(
            "portfolio-daily/cost",
            "portfolio.viability-cost",
            "Daily implementation cost differs from the Portfolio Mandate",
        )

    split_output: dict[str, Any] = {}
    for split_name in ("validation", "test"):
        split = splits[split_name]
        rows = [
            row
            for row in daily.rows
            if split["start"] <= row["timestamp"] <= split["signalEnd"]
        ]
        if not rows:
            _fail(
                f"portfolio-daily/{split_name}",
                "portfolio.viability",
                "Strategy viability split contains no daily rows",
            )
        benchmark_returns = pd.Series(
            [row["benchmark_return"] for row in rows],
            index=pd.to_datetime([row["timestamp"] for row in rows]),
            dtype=float,
        )
        reconstructed = {
            "gross": performance_metrics(
                pd.Series(
                    [row["gross_return"] for row in rows],
                    index=benchmark_returns.index,
                    dtype=float,
                ),
                benchmark_returns,
            ),
            "net": performance_metrics(
                pd.Series(
                    [row["net_return"] for row in rows],
                    index=benchmark_returns.index,
                    dtype=float,
                ),
                benchmark_returns,
            ),
            "benchmark": performance_metrics(
                benchmark_returns,
                benchmark_returns,
            ),
        }
        for layer in ("gross", "net"):
            raw_layer = portfolio.get(split_name, {}).get(layer)
            if not isinstance(raw_layer, dict):
                _fail(
                    f"RunResult/metrics/portfolio/{split_name}/{layer}",
                    "portfolio.viability",
                    "Portfolio performance layer must be an object",
                )
            _reconcile_performance_metrics(
                raw_layer,
                reconstructed[layer],
                f"RunResult/metrics/portfolio/{split_name}/{layer}",
            )

        raw_implementation = implementation.get(split_name)
        if not isinstance(raw_implementation, dict):
            _fail(
                f"RunResult/metrics/implementation/{split_name}",
                "portfolio.viability",
                "Implementation split must be an object",
            )
        expected_implementation = {
            "annualized_one_way_turnover": (
                sum(row["one_way_turnover"] for row in rows)
                / len(rows)
                * annualization_periods(
                    [row["timestamp"] for row in rows]
                )
            ),
            "total_cost_drag": sum(row["cost"] for row in rows),
            "rebalance_rate": (
                sum(row["rebalanced"] for row in rows) / len(rows)
            ),
            "no_trade_rate": (
                sum(not row["rebalanced"] for row in rows) / len(rows)
            ),
        }
        for key, expected_value in expected_implementation.items():
            if not math.isclose(
                _finite(
                    raw_implementation.get(key),
                    f"RunResult/metrics/implementation/{split_name}/{key}",
                ),
                expected_value,
                rel_tol=0.0,
                abs_tol=1e-9,
            ):
                _fail(
                    f"RunResult/metrics/implementation/{split_name}/{key}",
                    "portfolio.viability-implementation",
                    "Implementation metric differs from the reconstructed ledger",
                )

        raw_factor = factor.get(split_name)
        if not isinstance(raw_factor, dict):
            _fail(
                f"RunResult/metrics/factor/{split_name}",
                "portfolio.viability",
                "Factor split must be an object",
            )
        projected_stress: list[dict[str, Any]] = []
        for cost_bps in dict.fromkeys(
            (0.0, base_cost_bps, max(25.0, 2.0 * base_cost_bps))
        ):
            key = f"{cost_bps:g}bps"
            raw_stress = cost_stress.get(key, {}).get(split_name)
            if not isinstance(raw_stress, dict):
                _fail(
                    f"RunResult/metrics/robustness/cost_stress/{key}/{split_name}",
                    "portfolio.viability-cost-stress",
                    "Fixed cost stress layer must be an object",
                )
            reconstructed_stress = performance_metrics(
                pd.Series(
                    [
                        row["gross_return"]
                        - row["traded_notional"] * cost_bps / 10_000.0
                        for row in rows
                    ],
                    index=benchmark_returns.index,
                    dtype=float,
                ),
                benchmark_returns,
            )
            _reconcile_performance_metrics(
                raw_stress,
                reconstructed_stress,
                "RunResult/metrics/robustness/cost_stress/"
                f"{key}/{split_name}",
            )
            projected_stress.append(
                {
                    "costBps": cost_bps,
                    "totalReturn": reconstructed_stress["total_return"],
                    "annualReturn": reconstructed_stress["annual_return"],
                    "netSharpe": reconstructed_stress["sharpe"],
                }
            )

        raw_delay = extra_delay.get(split_name)
        if not isinstance(raw_delay, dict):
            _fail(
                f"RunResult/metrics/robustness/extra_delay/{split_name}",
                "portfolio.viability-delay",
                "Extra-delay stress layer must be an object",
            )
        delay_projection = {
            "totalReturn": _finite(
                raw_delay.get("total_return"),
                f"RunResult/metrics/robustness/extra_delay/{split_name}/total_return",
            ),
            "annualReturn": _finite(
                raw_delay.get("annual_return"),
                f"RunResult/metrics/robustness/extra_delay/{split_name}/annual_return",
            ),
            "netSharpe": _finite(
                raw_delay.get("sharpe"),
                f"RunResult/metrics/robustness/extra_delay/{split_name}/sharpe",
            ),
        }
        total_one_way_turnover = sum(
            row["one_way_turnover"] for row in rows
        )
        gross_arithmetic = sum(row["gross_return"] for row in rows)
        net_arithmetic = sum(row["net_return"] for row in rows)
        split_output[split_name] = {
            "role": splits[split_name]["role"],
            "factorRankIc": _finite(
                raw_factor.get("mean_rank_ic"),
                f"RunResult/metrics/factor/{split_name}/mean_rank_ic",
            ),
            "gross": _project_performance(reconstructed["gross"]),
            "net": _project_performance(reconstructed["net"]),
            "benchmark": _project_performance(
                reconstructed["benchmark"]
            ),
            "friction": {
                "baseCostBps": base_cost_bps,
                "totalCostDrag": expected_implementation[
                    "total_cost_drag"
                ],
                "annualizedOneWayTurnover": expected_implementation[
                    "annualized_one_way_turnover"
                ],
                "grossToNetTotalReturnWedge": (
                    reconstructed["gross"]["total_return"]
                    - reconstructed["net"]["total_return"]
                ),
                "grossToNetAnnualReturnWedge": (
                    reconstructed["gross"]["annual_return"]
                    - reconstructed["net"]["annual_return"]
                ),
                "grossToNetSharpeDelta": (
                    reconstructed["net"]["sharpe"]
                    - reconstructed["gross"]["sharpe"]
                ),
                "grossReturnPerOneWayTurnoverBps": (
                    gross_arithmetic / total_one_way_turnover * 10_000.0
                    if total_one_way_turnover > 1e-12
                    else None
                ),
                "netReturnPerOneWayTurnoverBps": (
                    net_arithmetic / total_one_way_turnover * 10_000.0
                    if total_one_way_turnover > 1e-12
                    else None
                ),
                "breakEvenCost": _break_even_cost(rows),
            },
            "costStress": projected_stress,
            "extraDelay": {
                **delay_projection,
                "netSharpeDelta": (
                    delay_projection["netSharpe"]
                    - reconstructed["net"]["sharpe"]
                ),
            },
            "temporal": _temporal_viability(rows),
        }

    validation = split_output["validation"]
    if validation["factorRankIc"] <= 0.0:
        stage = "factor-edge-absent"
        focus = "factor-signal"
        explanation = (
            "Validation rank IC is non-positive; revisit causal features, "
            "sign, and forecast horizon before portfolio tuning."
        )
    elif validation["gross"]["sharpe"] <= 0.0:
        stage = "factor-not-monetized"
        focus = "signal-to-portfolio"
        explanation = (
            "Validation rank IC is positive but gross portfolio Sharpe is "
            "non-positive; inspect state thresholds, breadth, sizing, and "
            "constraint interaction before cost tuning."
        )
    elif validation["net"]["sharpe"] <= 0.0:
        stage = "cost-fragile"
        focus = "turnover-and-execution"
        explanation = (
            "Gross validation Sharpe is positive but post-cost Sharpe is "
            "non-positive; investigate holding persistence, no-trade bands, "
            "and turnover efficiency."
        )
    else:
        stage = "post-cost-edge-positive"
        focus = "robustness-capacity-and-external-holdout"
        explanation = (
            "Validation post-cost Sharpe is positive; prioritize temporal, "
            "parameter, capacity, and fresh external-holdout robustness."
        )
    return {
        "method": STRATEGY_VIABILITY_METHOD,
        "authority": "research-prioritization-only",
        "tradingAuthority": "none",
        "diagnosis": {
            "selectionSplit": "validation",
            "testEntersDiagnosis": False,
            "stage": stage,
            "iterationFocus": focus,
            "explanation": explanation,
        },
        "validation": validation,
        "test": split_output["test"],
    }



def _path_projection(
    daily: ParsedDaily,
    weights: dict[str, dict[str, float]],
    splits: dict[str, Any],
    split_names: list[str],
    point_limit: int,
) -> dict[str, Any]:
    net_growth = 1.0
    gross_growth = 1.0
    benchmark_growth = 1.0
    peak = 1.0
    full: list[dict[str, Any]] = []
    maximum_drawdown = 0.0
    maximum_drawdown_index = 0
    maximum_turnover_index = 0
    total_cost = 0.0
    total_turnover = 0.0
    rebalances = 0
    for index, row in enumerate(daily.rows):
        gross_growth *= 1.0 + row["gross_return"]
        net_growth *= 1.0 + row["net_return"]
        benchmark_growth *= 1.0 + row["benchmark_return"]
        peak = max(peak, net_growth)
        drawdown = net_growth / peak - 1.0
        total_cost += row["cost"]
        total_turnover += row["one_way_turnover"]
        rebalances += int(row["rebalanced"])
        if drawdown < maximum_drawdown:
            maximum_drawdown = drawdown
            maximum_drawdown_index = index
        if (
            row["one_way_turnover"]
            > daily.rows[maximum_turnover_index]["one_way_turnover"]
        ):
            maximum_turnover_index = index
        full.append(
            {
                "timestamp": row["timestamp"],
                "split": _split_for(row["timestamp"], splits, split_names),
                "netGrowth": net_growth,
                "grossGrowth": gross_growth,
                "benchmarkGrowth": benchmark_growth,
                "drawdown": drawdown,
                "grossExposure": row["gross_exposure"],
                "netExposure": row["net_exposure"],
                "cashWeight": row["cash_weight"],
                "oneWayTurnover": row["one_way_turnover"],
                "cost": row["cost"],
                "rebalanced": row["rebalanced"],
                "executedRiskForecastAnnualized": row[
                    "executed_risk_forecast_annualized"
                ],
                "executionRiskCeilingAnnualized": row[
                    "execution_risk_ceiling_annualized"
                ],
                "riskRebalanceOverride": row[
                    "risk_rebalance_override"
                ],
                "weights": weights[row["timestamp"]],
            }
        )
    anchors = {
        0,
        len(full) - 1,
        maximum_drawdown_index,
        maximum_turnover_index,
    }
    for split in splits.values():
        for boundary in ("start", "signalEnd", "end"):
            position = bisect_right(daily.dates, split[boundary]) - 1
            if position >= 0:
                anchors.add(position)
            next_position = position + 1
            if next_position < len(daily.dates):
                anchors.add(next_position)
    selected = _sample_indices(len(full), point_limit, anchors)
    return {
        "totalRows": len(full),
        "sampledRows": len(selected),
        "pointLimit": point_limit,
        "sampling": "deterministic-even-with-accounting-anchors",
        "summary": {
            "netTotalReturn": net_growth - 1.0,
            "grossTotalReturn": gross_growth - 1.0,
            "benchmarkTotalReturn": benchmark_growth - 1.0,
            "maximumDrawdown": maximum_drawdown,
            "maximumDrawdownAt": full[maximum_drawdown_index]["timestamp"],
            "maximumOneWayTurnover": daily.rows[maximum_turnover_index][
                "one_way_turnover"
            ],
            "maximumOneWayTurnoverAt": full[maximum_turnover_index]["timestamp"],
            "totalOneWayTurnover": total_turnover,
            "totalCost": total_cost,
            "rebalanceDays": rebalances,
        },
        "points": [full[index] for index in selected],
    }



