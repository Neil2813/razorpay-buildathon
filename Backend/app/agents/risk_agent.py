"""ML-backed risk node. Threshold routing is deterministic."""

from __future__ import annotations

from typing import Any

from app.ml.inference import predict_risk
from .state import TransactionState, audit_event


def run(state: TransactionState, transaction: dict[str, Any], *, confirmation_threshold: float = 0.8) -> TransactionState:
    result = predict_risk(
        amount=float(transaction["amount"]), transaction_type=transaction.get("type", "PAYMENT"),
        old_balance_orig=float(transaction.get("old_balance_orig", transaction["amount"])),
        new_balance_orig=float(transaction.get("new_balance_orig", 0)),
        old_balance_dest=float(transaction.get("old_balance_dest", 0)),
        new_balance_dest=float(transaction.get("new_balance_dest", transaction["amount"])),
        step=int(transaction.get("step", 1)), dest_name=str(transaction.get("dest_name", "M0000000")),
    )
    state["risk_score"] = result["risk_score"]
    state["risk_features"] = {"top_features": result["top_features"], "model": result["model"], "source": "local"}
    if result["risk_score"] > confirmation_threshold:
        state["requires_confirmation"] = True
        state["payment_status"] = "escalated"
        state["escalation_message"] = f"This order needs confirmation: risk score {result['risk_score']:.2%} exceeds the {confirmation_threshold:.0%} review threshold."
    audit_event(state, agent="risk", decision_reason="Local trained hybrid model scored transaction; code applied review threshold.",
                output_summary={"risk_score": result["risk_score"], "threshold": confirmation_threshold,
                                "requires_confirmation": state["requires_confirmation"]})
    return state
