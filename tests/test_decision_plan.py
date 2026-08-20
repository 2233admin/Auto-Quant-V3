from __future__ import annotations

import json
from datetime import datetime, timezone

import unittest

from autoquant.project_templates.ohlcv_portfolio_lab.decision_plan import (
    DecisionPlan,
    ExecutionEvidence,
    FactorState,
    OrderIntent,
    OrderLifecycleState,
    PortfolioFailure,
    ProtectionSpec,
    TargetPortfolio,
)


def _plan() -> DecisionPlan:
    timestamp = datetime(2026, 1, 2, tzinfo=timezone.utc)
    return DecisionPlan(
        decisionTimestamp=timestamp,
        factorState=FactorState(
            value=0.8,
            direction="long",
            rank=1,
            strength=0.8,
            coverage=1.0,
            forecastHorizon="1d",
            holdingHorizon="1d",
            marketContext={"regime": "calm"},
            uncertainty={"standardError": 0.1},
            invalidationDiagnostics={"valid": True},
            factorModelIdentity="factor-v1",
            inputTimestamp=timestamp,
        ),
        portfolioMandate={"id": "mandate-1"},
        preDecisionPortfolio={"weights": {"AAPL": 0.0}, "cash": 1.0},
        targetPortfolio=TargetPortfolio(
            completeWeights={"AAPL": 0.5},
            targetCash=0.5,
            targetGrossExposure=0.5,
            targetNetExposure=0.5,
            weightDeltas={"AAPL": 0.5},
            assetConstraints={"AAPL": {"cap": 0.6, "positionRole": "long-only"}},
            volatilityEvidence={"ownVolatility": 0.2},
            covarianceContribution={"AAPL": 0.1},
            concentrationEvidence={"hhi": 1.0},
            liquidityEvidence={"capacity": 100000.0},
            riskGovernorScale=1.0,
            stopDistance={"AAPL": 0.05},
            lossAtStopContribution={"AAPL": 0.025},
        ),
        orderIntents=(
            OrderIntent(
                orderId="order-1",
                asset="AAPL",
                side="buy",
                type="market",
                requestedWeight=0.5,
                requestedNotional=5000.0,
                resultingTargetWeight=0.5,
                activationTime=timestamp,
                timeInForce="DAY",
                expiry=timestamp,
            ),
        ),
        protectionRules={"required": True},
        expiryRules={"kind": "time"},
        planHorizon="1d",
        nextReviewTimestamp=timestamp,
        assumptions=("reference NAV is 10000",),
        unresolvedAmbiguities=(),
    )


class DecisionPlanTests(unittest.TestCase):
    def test_schema_constructs_and_exposes_literal_authority(self) -> None:
        plan = _plan()
        self.assertEqual(plan.tradingAuthority, "none")
        self.assertEqual(OrderLifecycleState.WORKING.value, "working")


    def test_trading_authority_cannot_be_supplied_or_changed(self) -> None:
        with self.assertRaises(TypeError):
            DecisionPlan(**{**_plan().__dict__, "tradingAuthority": "live"})
        with self.assertRaises((AttributeError, TypeError)):
            _plan().tradingAuthority = "live"  # type: ignore[misc]


    def test_tp_sl_children_are_bounded_by_parent_filled_quantity(self) -> None:
        with self.assertRaisesRegex(PortfolioFailure, "filled quantity"):
            OrderIntent(
                orderId="parent",
                asset="AAPL",
                side="buy",
                type="market",
                requestedWeight=1.0,
                requestedNotional=10000.0,
                resultingTargetWeight=1.0,
                activationTime=datetime(2026, 1, 2, tzinfo=timezone.utc),
                timeInForce="DAY",
                filledQuantity=4.0,
                takeProfit=ProtectionSpec(kind="take-profit", quantity=1.0, weight=5.0),
            )


    def test_lifecycle_has_exact_forward_and_terminal_states(self) -> None:
        self.assertEqual(
            [state.value for state in OrderLifecycleState],
            [
                "planned",
                "working",
                "triggered",
                "filled",
                "expired",
                "cancelled",
                "rejected",
            ],
        )


    def test_illegal_order_and_empty_plan_are_rejected(self) -> None:
        with self.assertRaisesRegex(PortfolioFailure, "side"):
            OrderIntent(
                orderId="bad",
                asset="AAPL",
                side="hold",  # type: ignore[arg-type]
                type="market",
                requestedWeight=0.0,
                requestedNotional=0.0,
                resultingTargetWeight=0.0,
                activationTime=datetime(2026, 1, 2, tzinfo=timezone.utc),
                timeInForce="DAY",
            )
        values = _plan().__dict__
        values["orderIntents"] = ()
        with self.assertRaisesRegex(PortfolioFailure, "OrderIntent"):
            DecisionPlan(**values)


    def test_evidence_json_round_trip(self) -> None:
        evidence = ExecutionEvidence(
            targetWeight=0.5,
            orderId="order-1",
            requestedQuantity=10.0,
            filledQuantity=4.0,
            protectedQuantity=4.0,
            actualWeight=0.2,
            returnValue=0.01,
            cost=0.0005,
            exitReason="take-profit",
        )
        encoded = json.dumps(evidence.to_dict())
        restored = ExecutionEvidence.from_dict(json.loads(encoded))
        self.assertEqual(restored, evidence)
