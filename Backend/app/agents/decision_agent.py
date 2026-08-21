"""Product selection with a code-enforced spend ceiling."""

from __future__ import annotations

from .groq_client import REASONING_MODEL, complete_json
from .state import TransactionState, audit_event


def check_guardrail(price: float, ceiling: float) -> bool:
    """Pure, testable control. No LLM output can influence this check."""
    return price <= ceiling


def run(state: TransactionState, *, guardrail_ceiling: float) -> TransactionState:
    state["guardrail_ceiling"] = float(guardrail_ceiling)
    candidates = state.get("catalog_candidates", [])
    if not candidates:
        state["payment_status"] = "escalated"
        state["escalation_message"] = "I couldn't find an in-stock item matching those requirements."
        audit_event(state, agent="negotiation", decision_reason="No eligible catalog candidates; payment is unavailable.")
        return state
    proposal = complete_json(model=REASONING_MODEL, system="Choose the best product_id from the supplied candidates. Return JSON {\"product_id\": string}. Do not propose another product.", user=str({"intent": state["intent"], "candidates": candidates}))
    chosen = next((item for item in candidates if item.get("product_id") == (proposal or {}).get("product_id")), candidates[0])
    price = float(chosen["price"])
    passed = check_guardrail(price, state["guardrail_ceiling"])
    state["chosen_product"] = chosen
    state["guardrail_passed"] = passed
    state["requires_confirmation"] = not passed
    if not passed:
        state["payment_status"] = "escalated"
        state["escalation_message"] = (
            f"This item exceeds your ₹{state['guardrail_ceiling']:,.2f} unattended limit; "
            "I need your explicit confirmation to proceed."
        )
    audit_event(state, agent="negotiation",
                decision_reason="Code compared selected product price against tenant ceiling.",
                output_summary={"product_id": chosen.get("product_id"), "price": price,
                                "ceiling": state["guardrail_ceiling"], "guardrail_passed": passed})
    return state
