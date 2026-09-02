"""ML-backed risk node with safe deterministic rule-based fallback when ML dependencies/artifacts are missing."""

from __future__ import annotations

import logging
from typing import Any
from .state import TransactionState, audit_event

logger = logging.getLogger("glassbox.risk")

# Safe import wrapper to prevent runtime crashes if ML dependencies are missing
try:
    from app.ml.inference import predict_risk
    HAS_ML = True
except (ImportError, ModuleNotFoundError):
    HAS_ML = False
    predict_risk = None


def predict_risk_fallback(
    amount: float,
    transaction_type: str,
    old_balance_orig: float,
    new_balance_orig: float,
    old_balance_dest: float,
    new_balance_dest: float,
    step: int = 1,
    dest_name: str = "C0000000",
) -> dict[str, Any]:
    """Rule-based risk scoring fallback that mimics the trained hybrid ensemble's decision logic."""
    is_transfer = transaction_type == "TRANSFER"
    is_cash_out = transaction_type == "CASH_OUT"
    balance_delta_orig = old_balance_orig - new_balance_orig
    # orig_balance_wiped is a PaySim fraud signal designed for bank wire transfers
    # where a sender drains their account entirely. For e-commerce PAYMENT transactions
    # the old/new balances are always 0 (not tracked), so (new_balance_orig == 0) would
    # evaluate to True for EVERY purchase — producing a systematic false-positive bias.
    # Suppress this feature for PAYMENT type to prevent wrongful escalation.
    is_payment = transaction_type == "PAYMENT"
    orig_balance_wiped = 0 if is_payment else int(new_balance_orig == 0)


    # Mimic hybrid model key features:
    # High risk when TRANSFER/CASH_OUT completely drains the sender's account for larger amounts.
    score = 0.01
    if is_transfer or is_cash_out:
        if orig_balance_wiped and balance_delta_orig > 0:
            score += 0.50
        if amount > 100000:
            score += 0.40
        elif amount > 20000:
            score += 0.25

    score = min(max(score, 0.0), 1.0)
    top_features = [
        {
            "feature": "balance_delta_orig",
            "label": "Change in sender's balance",
            "importance": 0.7757,
            "value": float(balance_delta_orig),
        },
        {
            "feature": "orig_balance_wiped",
            "label": "Sender's balance completely drained",
            "importance": 0.0685,
            "value": float(orig_balance_wiped),
        },
        {
            "feature": "type_" + transaction_type,
            "label": f"Transaction type: {transaction_type}",
            "importance": 0.0557,
            "value": 1.0,
        },
    ]

    explanation = (
        f"[FALLBACK] - Risk score {score:.2%}. "
        f"Top signal (Fallback Rule): Change in sender's balance = {balance_delta_orig:.2f}."
    )

    return {
        "risk_score": round(score, 6),
        "top_features": top_features,
        "explanation": explanation,
        "model": "Rule-based Risk Engine (Fallback)",
    }


def run(state: TransactionState, transaction: dict[str, Any], *, confirmation_threshold: float = 0.8) -> TransactionState:
    amount = float(transaction.get("amount", 0))
    transaction_type = transaction.get("type", "PAYMENT")
    old_balance_orig = float(transaction.get("old_balance_orig", amount))
    new_balance_orig = float(transaction.get("new_balance_orig", 0))
    old_balance_dest = float(transaction.get("old_balance_dest", 0))
    new_balance_dest = float(transaction.get("new_balance_dest", amount))
    step = int(transaction.get("step", 1))
    dest_name = str(transaction.get("dest_name", "M0000000"))

    result = None
    source = "local_ensemble"

    # Attempt ML inference first
    if HAS_ML and predict_risk is not None:
        try:
            result = predict_risk(
                amount=amount,
                transaction_type=transaction_type,
                old_balance_orig=old_balance_orig,
                new_balance_orig=new_balance_orig,
                old_balance_dest=old_balance_dest,
                new_balance_dest=new_balance_dest,
                step=step,
                dest_name=dest_name,
            )
        except Exception as exc:
            print(f"[risk_agent] ML inference failed: {exc}. Falling back to rule-based logic.")

    # Fallback if ML module/inference is unavailable
    if result is None:
        logger.warning(
            "[RISK] 🟡 ML inference unavailable — using rule-based fallback scorer. "
            "Risk evaluation will be deterministic (not learned). "
            "Train the model and set up ml/inference.py to enable full ML scoring."
        )
        result = predict_risk_fallback(
            amount=amount,
            transaction_type=transaction_type,
            old_balance_orig=old_balance_orig,
            new_balance_orig=new_balance_orig,
            old_balance_dest=old_balance_dest,
            new_balance_dest=new_balance_dest,
            step=step,
            dest_name=dest_name,
        )
        source = "rule_based_fallback"
    else:
        logger.info("[RISK] ✅ ML inference completed successfully (source=%s).", source)

    risk_score = result["risk_score"]
    state["risk_score"] = risk_score

    # Determine threshold used by the prediction engine
    actual_threshold = result.get("threshold", confirmation_threshold)

    # Align the explanation text exactly with the evaluated threshold
    flag_str = "[FLAGGED]" if risk_score > actual_threshold else "[CLEAR]"
    explanation = (
        f"{flag_str} - Risk score {risk_score:.2%} "
        f"({'above' if risk_score > actual_threshold else 'below'} threshold {actual_threshold:.2%}). "
        f"Top signal: {result['top_features'][0]['label']} = {result['top_features'][0]['value']:.2f}."
    )

    state["risk_features"] = {
        "top_features": result["top_features"],
        "model": result["model"],
        "source": source,
        "explanation": explanation,
        "threshold": actual_threshold,
    }

    if risk_score > actual_threshold:
        state["requires_confirmation"] = True
        state["payment_status"] = "escalated"
        state["escalation_message"] = (
            f"This order needs confirmation: risk score {risk_score:.2%} "
            f"exceeds the {actual_threshold:.0%} review threshold."
        )
        decision_reason = "Risk Agent: Transaction flagged for human review."
    else:
        state["requires_confirmation"] = False
        decision_reason = "Risk Agent: All security measures have been passed."

    audit_event(
        state,
        agent="risk",
        decision_reason=decision_reason,
        output_summary={
            "risk_score": risk_score,
            "risk_level": result.get("risk_level", "LOW"),
            "threshold": confirmation_threshold,
            "requires_confirmation": state["requires_confirmation"],
            "model_source": source,
        },
    )
    return state
