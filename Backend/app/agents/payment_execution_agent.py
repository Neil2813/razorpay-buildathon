"""Bounded payment execution. A gateway is injected for live/test integrations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from .groq_client import FAST_MODEL, complete_json
from .state import TransactionState, audit_event


class PaymentGateway(Protocol):
    def charge(self, *, amount: float, currency: str, receipt: str,
               idempotency_key: str) -> dict[str, Any]: ...


def prepare_idempotency_key(state: TransactionState) -> str:
    """Create a stable payment identity that survives retries and resumptions."""
    product = state.get("chosen_product") or {}
    key = state.get("idempotency_key") or f"{state['session_id']}:{product.get('product_id', 'product')}"
    state["idempotency_key"] = key
    return key


def run(state: TransactionState, gateway: PaymentGateway, *, currency: str = "INR",
        before_first_charge: Callable[[TransactionState], None] | None = None,
        after_attempt: Callable[[TransactionState], None] | None = None) -> TransactionState:
    """Create one approved Razorpay order; payment succeeds only after verification."""
    if not state.get("guardrail_passed") or state.get("requires_confirmation") or not state.get("buyer_approved"):
        state["payment_status"] = "escalated"
        audit_event(state, agent="payment", decision_reason="Payment blocked by deterministic guardrail or confirmation requirement.")
        return state
    product = state.get("chosen_product")
    if not product:
        state["payment_status"] = "escalated"
        state["escalation_message"] = "No product was selected, so no payment was attempted."
        audit_event(state, agent="payment", decision_reason="Payment blocked because there is no chosen product.")
        return state
    # Persist the key in state before the first external side effect. Retries and
    # a resumed graph invocation must reuse it rather than create another charge.
    idempotency_key = prepare_idempotency_key(state)
    if before_first_charge:
        before_first_charge(state)
    # Preserve the fixed two-attempt policy across a process restart.
    next_attempt = len(state["payment_attempts"]) + 1
    for attempt_number in range(next_attempt, 3):
        try:
            result = gateway.charge(
                amount=float(product.get("total_amount", product["price"])),
                currency=currency,
                receipt=state["session_id"],
                idempotency_key=idempotency_key,
            )
            status = str(result.get("status", "failed"))
            state["payment_attempts"].append({"attempt": attempt_number, "timestamp": datetime.now(timezone.utc).isoformat(), "status": status, "reason": result.get("reason"), "payment_id": result.get("payment_id")})
            if after_attempt:
                after_attempt(state)
            if status == "order_created":
                state["payment_status"] = "pending"
                state["razorpay_order_id"] = result.get("payment_id")
                state["razorpay_key_id"] = result.get("key_id")
                audit_event(state, agent="payment", decision_reason="Approved amount locked in a Razorpay order; awaiting buyer checkout and server-side signature verification.", output_summary={"attempts": attempt_number, "order_id": result.get("payment_id"), "idempotency_key_present": True, "payment_verified": False})
                return state
        except Exception as exc:
            state["payment_attempts"].append({"attempt": attempt_number, "timestamp": datetime.now(timezone.utc).isoformat(), "status": "failed", "reason": str(exc)})
            if after_attempt:
                after_attempt(state)
    state["payment_status"] = "escalated"
    fallback_message = "Payment could not be completed after one retry. No further charge will be attempted."
    phrasing = complete_json(model=FAST_MODEL, system="Return JSON {\"message\": string}. Explain a failed payment clearly, and state that no further charge will be attempted.", user=str(state["payment_attempts"]))
    state["escalation_message"] = phrasing.get("message", fallback_message) if isinstance(phrasing, dict) else fallback_message
    audit_event(state, agent="payment", decision_reason="Two payment attempts failed; fixed retry policy requires escalation.", output_summary={"attempts": len(state["payment_attempts"]), "idempotency_key_present": True})
    return state
