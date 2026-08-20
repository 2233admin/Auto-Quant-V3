"""Typed, research-only decision plans and order realization evidence."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field, fields
from datetime import date, datetime
from enum import Enum
from typing import Any, Literal, Mapping

from autoquant.project_templates.ohlcv_portfolio_lab.portfolio_core import (
    PortfolioFailure,
)


class OrderLifecycleState(str, Enum):
    """The fixed causal order lifecycle published by the future bar kernel."""

    PLANNED = "planned"
    WORKING = "working"
    TRIGGERED = "triggered"
    FILLED = "filled"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


def _finite(value: object, name: str, *, non_negative: bool = False) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise PortfolioFailure("decision-plan.value", f"{name} must be numeric")
    number = float(value)
    if not math.isfinite(number) or (non_negative and number < 0.0):
        raise PortfolioFailure("decision-plan.value", f"{name} must be finite")
    return number


@dataclass(frozen=True)
class FactorState:
    """Factor information observed causally at one decision timestamp."""

    value: object
    direction: object
    rank: object
    strength: object
    coverage: object
    forecastHorizon: object
    holdingHorizon: object
    marketContext: Mapping[str, object]
    uncertainty: Mapping[str, object]
    invalidationDiagnostics: Mapping[str, object]
    factorModelIdentity: object
    inputTimestamp: object


@dataclass(frozen=True)
class TargetPortfolio:
    """The desired post-decision portfolio, distinct from orders and fills."""

    completeWeights: Mapping[str, float]
    targetCash: float
    targetGrossExposure: float
    targetNetExposure: float
    weightDeltas: Mapping[str, float]
    assetConstraints: Mapping[str, object]
    volatilityEvidence: Mapping[str, object]
    covarianceContribution: Mapping[str, object]
    concentrationEvidence: Mapping[str, object]
    liquidityEvidence: Mapping[str, object]
    riskGovernorScale: float
    stopDistance: Mapping[str, object]
    lossAtStopContribution: Mapping[str, object]

    def __post_init__(self) -> None:
        for name in (
            "targetCash",
            "targetGrossExposure",
            "targetNetExposure",
            "riskGovernorScale",
        ):
            _finite(getattr(self, name), name)
        if self.riskGovernorScale < 0.0:
            raise PortfolioFailure(
                "decision-plan.target-portfolio",
                "riskGovernorScale must be non-negative",
            )


@dataclass(frozen=True)
class ProtectionSpec:
    """A reduce-only TP or SL child attached to a parent order."""

    kind: Literal["take-profit", "stop-loss"]
    quantity: float
    weight: float | None = None
    trigger: float | None = None
    type: Literal["limit", "stop", "stop-limit"] | None = None

    def __post_init__(self) -> None:
        if self.kind not in {"take-profit", "stop-loss"}:
            raise PortfolioFailure("decision-plan.protection", "Unknown protection kind")
        _finite(self.quantity, "protection quantity", non_negative=True)
        if self.weight is not None:
            _finite(self.weight, "protection weight", non_negative=True)


@dataclass(frozen=True)
class OrderIntent:
    """A conditional research order intent; it has no external authority."""

    orderId: str
    asset: str
    side: Literal["buy", "sell"]
    type: Literal["market", "limit", "stop", "stop-limit"]
    requestedWeight: float
    requestedNotional: float
    resultingTargetWeight: float
    activationTime: object
    timeInForce: str
    expiry: object | None = None
    requestedQuantity: float | None = None
    limitTrigger: float | None = None
    stopTrigger: float | None = None
    parentId: str | None = None
    ocoGroup: str | None = None
    reduceOnly: bool = False
    filledQuantity: float = 0.0
    lifecycleState: OrderLifecycleState = OrderLifecycleState.PLANNED
    takeProfit: ProtectionSpec | None = None
    stopLoss: ProtectionSpec | None = None

    def __post_init__(self) -> None:
        if self.side not in {"buy", "sell"}:
            raise PortfolioFailure("decision-plan.order", "side must be buy or sell")
        if self.type not in {"market", "limit", "stop", "stop-limit"}:
            raise PortfolioFailure("decision-plan.order", "unknown order type")
        _finite(self.requestedWeight, "requestedWeight")
        _finite(self.requestedNotional, "requestedNotional", non_negative=True)
        _finite(self.resultingTargetWeight, "resultingTargetWeight")
        filled = _finite(self.filledQuantity, "filledQuantity", non_negative=True)
        requested = (
            _finite(self.requestedQuantity, "requestedQuantity", non_negative=True)
            if self.requestedQuantity is not None
            else _finite(self.requestedNotional, "requestedNotional", non_negative=True)
        )
        if filled > requested + 1e-12:
            raise PortfolioFailure(
                "decision-plan.order",
                "filledQuantity cannot exceed requested quantity",
            )
        for child in (self.takeProfit, self.stopLoss):
            if child is not None and (
                child.quantity > filled + 1e-12
                or (child.weight is not None and child.weight > filled + 1e-12)
            ):
                raise PortfolioFailure(
                    "decision-plan.protection",
                    "TP/SL child quantity cannot exceed parent filled quantity",
                )


@dataclass(frozen=True)
class DecisionPlan:
    """A complete research decision with conditional order intents only."""

    decisionTimestamp: object
    factorState: FactorState
    portfolioMandate: Mapping[str, object]
    preDecisionPortfolio: Mapping[str, object]
    targetPortfolio: TargetPortfolio
    orderIntents: tuple[OrderIntent, ...]
    protectionRules: Mapping[str, object]
    expiryRules: Mapping[str, object]
    planHorizon: object
    nextReviewTimestamp: object
    assumptions: tuple[str, ...]
    unresolvedAmbiguities: tuple[str, ...]
    tradingAuthority: Literal["none"] = field(default="none", init=False)

    def __post_init__(self) -> None:
        if not self.orderIntents:
            raise PortfolioFailure(
                "decision-plan.orders", "DecisionPlan requires an OrderIntent"
            )


@dataclass(frozen=True)
class ExecutionEvidence:
    """Structure for target/order/fill/protection/portfolio reconciliation."""

    targetWeight: float
    orderId: str
    requestedQuantity: float
    filledQuantity: float
    protectedQuantity: float
    actualWeight: float
    returnValue: float
    cost: float
    exitReason: str | None

    def __post_init__(self) -> None:
        requested = _finite(self.requestedQuantity, "requestedQuantity", non_negative=True)
        filled = _finite(self.filledQuantity, "filledQuantity", non_negative=True)
        protected = _finite(self.protectedQuantity, "protectedQuantity", non_negative=True)
        _finite(self.targetWeight, "targetWeight")
        _finite(self.actualWeight, "actualWeight")
        _finite(self.returnValue, "returnValue")
        _finite(self.cost, "cost", non_negative=True)
        if filled > requested + 1e-12 or protected > filled + 1e-12:
            raise PortfolioFailure(
                "decision-plan.evidence",
                "Evidence quantities must satisfy requested >= filled >= protected",
            )

    def to_dict(self) -> dict[str, object]:
        return asdict(self)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "ExecutionEvidence":
        names = {item.name for item in fields(cls)}
        if set(value) != names:
            raise PortfolioFailure("decision-plan.evidence", "Evidence fields do not match schema")
        return cls(**dict(value))
