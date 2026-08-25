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
            "You are an autonomous shopping agent. Select the single best product from the candidates list. "
            "Primary Selection Criteria: Combine the user's specific choice preferences (color, size, brand, price range) "
            "with the highest product rating and review count (most stars and votes).\n\n"
            "Return JSON: {\"product_id\": string, \"selection_reason\": string}.\n"
            "selection_reason MUST be 2-3 sentences explaining exactly why this product was chosen, and "
            "explicitly compare it with the other candidate options (for example, explain that you chose it "
            "over Option X because of its higher rating of Y★ or better price compatibility). Mention specific names, "
            "brands, ratings, and prices of the rejected options to justify the choice. Be specific, clear, and trace-backed."
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
