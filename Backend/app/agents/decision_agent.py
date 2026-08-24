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

    # Ask LLM to pick the best product_id AND explain why
    proposal = complete_json(
        model=REASONING_MODEL,
        system=(
            "You are a shopping agent. Choose the single best product from the candidates that best "
            "satisfies the buyer's intent. Return JSON: "
            '{"product_id": string, "selection_reason": string}. '
            "selection_reason must be 1-2 sentences explaining: why this product was chosen over others "
            "(mention specific attributes like rating, price, colour, brand). Be specific, not generic."
        ),
        user=str({"intent": state["intent"], "candidates": candidates}),
    )

    chosen_id = (proposal or {}).get("product_id")
    selection_reason = (proposal or {}).get(
        "selection_reason",
        "Best match for your specified requirements."
    )

    chosen = next(
        (item for item in candidates if item.get("product_id") == chosen_id),
        candidates[0],
    )
    # If the LLM didn't give a reason, generate a fallback explanation
    if not selection_reason or not isinstance(selection_reason, str):
        parts = []
        if chosen.get("rating"):
            parts.append(f"highest rating of {chosen['rating']}★")
        if chosen.get("price"):
            parts.append(f"price ₹{chosen['price']:,.0f} within your budget")
        if chosen.get("brand"):
            parts.append(f"brand: {chosen['brand']}")
        selection_reason = f"Selected for {', '.join(parts)}." if parts else "Best match for your requirements."

    chosen["selection_reason"] = selection_reason
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

    audit_event(
        state, agent="negotiation",
        decision_reason="Code compared selected product price against tenant ceiling.",
        output_summary={
            "product_id": chosen.get("product_id"),
            "chosen_product": chosen,           # full product for frontend
            "selection_reason": selection_reason,
            "all_candidates_count": len(candidates),
            "price": price,
            "ceiling": state["guardrail_ceiling"],
            "guardrail_passed": passed,
        },
    )
    return state
