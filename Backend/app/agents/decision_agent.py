"""Product selection with a code-enforced spend ceiling + dynamic revenue growth engine.

After selecting the primary product, if the buyer has budget headroom below the
spend ceiling the engine identifies the highest-rated complementary category
(e.g. shirt → hat, shoe → sock), calculates a dynamic bundle discount (10–15 %),
and attaches an `upsell_offer` to state for the frontend to render.

The spend guardrail is re-applied to the bundle total — the LLM cannot override it.
"""

from __future__ import annotations

from .groq_client import FAST_MODEL, REASONING_MODEL, complete_json
from .state import TransactionState, audit_event


# ---------------------------------------------------------------------------
# Category complement map — deterministic, no LLM influence
# ---------------------------------------------------------------------------

_COMPLEMENTS: dict[str, list[str]] = {
    "shoe":   ["sock", "hat", "shirt"],
    "shirt":  ["hat", "pants", "shoe"],
    "pants":  ["shirt", "shoe", "hat"],
    "hat":    ["shirt", "shoe", "pants"],
    "sock":   ["shoe", "pants"],
}

_UPSELL_DISCOUNT_PCT = 10  # base bundle discount %
_UPSELL_MAX_HEADROOM_RATIO = 0.90  # upsell item price must be ≤ 90 % of headroom


def check_guardrail(price: float, ceiling: float) -> bool:
    """Pure, testable control. No LLM output can influence this check."""
    return price <= ceiling


# ---------------------------------------------------------------------------
# Dynamic upsell engine (pure deterministic selection, LLM explains only)
# ---------------------------------------------------------------------------

def _find_upsell(
    primary: dict,
    candidates: list[dict],
    ceiling: float,
) -> dict | None:
    """
    Identify the best complement item that fits within the remaining budget headroom.

    Rules (all deterministic — LLM cannot influence the eligibility check):
      1. Complement category must be in the mapping for the primary's category.
      2. Candidate must be in-stock.
      3. Discounted price ≤ (ceiling − primary_price) × _UPSELL_MAX_HEADROOM_RATIO.
      4. Never the same product_id as the chosen primary.
    """
    primary_price = float(primary.get("total_amount", primary.get("price", 0)))
    headroom = ceiling - primary_price
    if headroom <= 0:
        return None

    primary_cat = str(primary.get("category", "")).lower()
    complement_cats = _COMPLEMENTS.get(primary_cat, [])
    if not complement_cats:
        return None

    max_upsell_price = headroom * _UPSELL_MAX_HEADROOM_RATIO

    eligible = [
        c for c in candidates
        if (
            c.get("product_id") != primary.get("product_id")
            and str(c.get("category", "")).lower() in complement_cats
            and bool(c.get("in_stock", True))
            and float(c.get("price", 0)) <= max_upsell_price
        )
    ]

    if not eligible:
        return None

    # Rank by rating desc, then price desc (higher price = more revenue)
    eligible.sort(key=lambda x: (-(x.get("rating") or 0), -float(x.get("price", 0))))
    return eligible[0]


def _compute_discount(upsell_item: dict, primary_price: float, ceiling: float) -> dict:
    """
    Compute the dynamic discount for the upsell bundle.
    Discount is bounded so the bundle total never exceeds the spend ceiling.
    """
    upsell_price = float(upsell_item.get("price", 0))
    bundle_full = primary_price + upsell_price

    # Increase discount to fit within ceiling if needed
    if bundle_full > ceiling:
        # Solve: primary_price + upsell_price * (1 - d) <= ceiling
        required_discount = 1 - (ceiling - primary_price) / upsell_price
        discount_pct = max(_UPSELL_DISCOUNT_PCT, int(required_discount * 100) + 1)
    else:
        discount_pct = _UPSELL_DISCOUNT_PCT

    discount_pct = min(discount_pct, 30)  # hard cap: never > 30 %
    discounted_price = round(upsell_price * (1 - discount_pct / 100), 2)
    bundle_total = round(primary_price + discounted_price, 2)
    revenue_lift = round(discounted_price, 2)  # incremental revenue from upsell

    return {
        "original_price": upsell_price,
        "discount_pct": discount_pct,
        "discounted_price": discounted_price,
        "bundle_total": bundle_total,
        "revenue_lift_inr": revenue_lift,
        "within_ceiling": bundle_total <= ceiling,
    }


# ---------------------------------------------------------------------------
# Main negotiation run function
# ---------------------------------------------------------------------------

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
    price = float(chosen.get("total_amount", chosen["price"]))
    state["fulfilment"] = chosen.get("fulfilment")
    passed = check_guardrail(price, state["guardrail_ceiling"])
    state["chosen_product"] = chosen
    state["guardrail_passed"] = passed
    state["requires_confirmation"] = not passed

    # ---------------------------------------------------------------------------
    # Dynamic Revenue Growth Engine — Upsell & Cross-Sell
    # (Only runs when primary item passes guardrail; headroom ≥ 0)
    # ---------------------------------------------------------------------------
    upsell_offer: dict | None = None
    if passed:
        upsell_item = _find_upsell(chosen, candidates, state["guardrail_ceiling"])
        if upsell_item:
            discount_info = _compute_discount(upsell_item, price, state["guardrail_ceiling"])
            # Re-enforce the spend ceiling against the full bundle total.
            # The initial guardrail only checked the primary product price; without
            # this second check a discounted bundle could silently exceed the ceiling
            # and charge the buyer above their unattended spend limit.
            bundle_within_ceiling = discount_info["within_ceiling"] and discount_info["bundle_total"] <= state["guardrail_ceiling"]
            if bundle_within_ceiling:
                # Ask LLM for a brief, persuasive upsell pitch (soft signal only — not a decision)
                pitch = complete_json(
                    model=FAST_MODEL,
                    system=(
                        "Write a 1-sentence upsell pitch for bundling a complement product. "
                        "Return JSON: {\"pitch\": string}. "
                        "Be friendly, concise, and mention the discount and revenue saving."
                    ),
                    user=str({
                        "primary": {"name": chosen.get("name"), "price": price},
                        "complement": {"name": upsell_item.get("name"), "original_price": discount_info["original_price"]},
                        "discount_pct": discount_info["discount_pct"],
                        "discounted_price": discount_info["discounted_price"],
                    }),
                )
                upsell_pitch = (pitch or {}).get(
                    "pitch",
                    f"Bundle with {upsell_item.get('name')} and save {discount_info['discount_pct']}%!"
                )

                upsell_offer = {
                    "product_id": upsell_item.get("product_id"),
                    "name": upsell_item.get("name"),
                    "category": upsell_item.get("category"),
                    "color": upsell_item.get("color"),
                    "rating": upsell_item.get("rating"),
                    "original_price": discount_info["original_price"],
                    "discount_pct": discount_info["discount_pct"],
                    "discounted_price": discount_info["discounted_price"],
                    "bundle_total": discount_info["bundle_total"],
                    "revenue_lift_inr": discount_info["revenue_lift_inr"],
                    "pitch": upsell_pitch,
                    "within_ceiling": True,
                }
                state["upsell_offer"] = upsell_offer


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
            # Revenue Growth Engine output
            "upsell_offer": upsell_offer,
            "upsell_triggered": upsell_offer is not None,
            "revenue_lift_inr": upsell_offer["revenue_lift_inr"] if upsell_offer else 0.0,
            "upsell_discount_applied": upsell_offer["discount_pct"] if upsell_offer else None,
        },
    )
    return state
