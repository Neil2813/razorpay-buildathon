"""Product selection with a code-enforced spend ceiling + dynamic revenue growth engine.

After selecting the primary product, if the buyer has budget headroom below the
spend ceiling the engine identifies the highest-rated complementary category
(e.g. shirt → hat, shoe → sock), calculates a dynamic bundle discount (10–15 %),
and attaches an `upsell_offer` to state for the frontend to render.

The spend guardrail is re-applied to the bundle total — the LLM cannot override it.
"""

from __future__ import annotations

import logging
import time

from .groq_client import FAST_MODEL, REASONING_MODEL, complete_json
from .state import TransactionState, audit_event
from app.db.database import get_tenant_max_upsell_discount

logger = logging.getLogger("glassbox.decision")


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


def _compute_discount(upsell_item: dict, primary_price: float, ceiling: float, max_discount_pct: float = 15.0) -> dict:
    """
    Compute the dynamic discount for the upsell bundle.
    Discount is bounded so:
      (a) the bundle total never exceeds the spend ceiling, AND
      (b) the discount never exceeds the merchant's configured max_upsell_discount_pct
          (prevents automated margin erosion below the merchant's profit floor).
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

    # Hard cap at merchant-configured max — protects gross margin
    discount_pct = min(discount_pct, max_discount_pct)
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

    # Pre-rank by composite score: product_rating (60%) + normalised avg merchant rating (40%).
    # Only pass the top 5 to the LLM — reduces noise and forces explicit comparison.
    def _composite_score(p: dict) -> float:
        prod_rating = float(p.get("rating") or 0)
        # merchant_avg_rating may be set by discovery agent on the product dict
        merchant_rating = float(p.get("merchant_avg_rating") or prod_rating)
        return prod_rating * 0.6 + merchant_rating * 0.4

    ranked = sorted(candidates, key=_composite_score, reverse=True)
    top5 = ranked[:5]

    # Ask LLM to pick the best product_id AND explain why over the others
    _t0 = time.perf_counter()
    proposal = complete_json(
        model=REASONING_MODEL,
        system=(
            "You are an autonomous shopping agent. You have been given the top 5 candidate products."
            " Select the single best product_id based on: (1) buyer preferences (color, size, brand, price range),"
            " (2) highest individual product rating, (3) best value within budget."
            "\n\nReturn JSON: {\"product_id\": string, \"selection_reason\": string}."
            "\nselection_reason MUST be 2-3 sentences explaining SPECIFICALLY why you chose this product over"
            " each of the other candidate options. Explicitly mention why you rejected the others"
            " (e.g., lower rating, wrong gender, higher price, wrong style). Cite product names, ratings, prices."
        ),
        user=str({"intent": state["intent"], "top5_candidates": top5}),
    )
    _elapsed = time.perf_counter() - _t0
    if proposal is None:
        logger.warning(
            "[DECISION] 🟡 LLM product selection FAILED (%.3fs) — falling back to top-ranked candidate. "
            "No AI reasoning will be shown for this selection.",
            _elapsed,
        )
    else:
        logger.info("[DECISION] ✅ LLM product selection completed (%.3fs).", _elapsed)

    chosen_id = (proposal or {}).get("product_id")
    selection_reason = (proposal or {}).get(
        "selection_reason",
        "Best match for your specified requirements."
    )

    chosen = next(
        (item for item in top5 if item.get("product_id") == chosen_id),
        top5[0],
    )
    # If the LLM didn't give a reason, generate a fallback explanation
    if not selection_reason or not isinstance(selection_reason, str):
        others = [p["name"] for p in top5 if p.get("product_id") != chosen.get("product_id")][:3]
        parts = []
        if chosen.get("rating"):
            parts.append(f"highest rating of {chosen['rating']}")
        if chosen.get("price"):
            parts.append(f"price {chosen['price']:,.0f} within budget")
        if others:
            parts.append(f"chosen over {', '.join(others)}")
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
        # Fetch the merchant-configured max discount from the database.
        # This prevents the engine from automatically discounting below the
        # merchant's profit floor to force items under the spend ceiling.
        merchant_max_discount = get_tenant_max_upsell_discount(state["tenant_id"])

        upsell_item = _find_upsell(chosen, candidates, state["guardrail_ceiling"])
        if upsell_item:
            discount_info = _compute_discount(
                upsell_item, price, state["guardrail_ceiling"],
                max_discount_pct=merchant_max_discount,
            )
            # Re-enforce the spend ceiling against the full bundle total.
            bundle_within_ceiling = discount_info["within_ceiling"] and discount_info["bundle_total"] <= state["guardrail_ceiling"]
            if bundle_within_ceiling:
                # Ask LLM for a brief, persuasive upsell pitch (soft signal only — not a decision)
                _t1 = time.perf_counter()
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
                if pitch is None:
                    logger.warning(
                        "[DECISION] 🟡 Upsell pitch LLM FAILED (%.3fs) — using hardcoded fallback pitch string.",
                        time.perf_counter() - _t1,
                    )
                else:
                    logger.info("[DECISION] ✅ Upsell pitch generated (%.3fs).", time.perf_counter() - _t1)
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
                    # Track whether buyer accepted. Agents reading the audit log
                    # can verify mandate compliance from this field.
                    "buyer_accepted": state.get("accept_upsell", False),
                }
                state["upsell_offer"] = upsell_offer

                # CRITICAL: Only merge the bundle total into chosen_product when
                # the buyer (or buyer's delegated agent) has EXPLICITLY opted in.
                # Default False — the upsell_offer is a PROPOSAL, not an automatic charge.
                if state.get("accept_upsell"):
                    chosen["total_amount"] = discount_info["bundle_total"]
                    chosen["upsell_accepted"] = True
                    chosen["upsell_product"] = upsell_item.get("name")
                    state["chosen_product"] = chosen

    if not passed:
        state["payment_status"] = "escalated"
        state["escalation_message"] = (
            f"This item exceeds your ₹{state['guardrail_ceiling']:,.2f} unattended limit; "
            "I need your explicit confirmation to proceed."
        )

    audit_event(
        state, agent="negotiation",
        decision_reason=f"Decision Agent: {selection_reason}",
        output_summary={
            "product_id": chosen.get("product_id"),
            "chosen_product": chosen,           # full product for frontend
            "selection_reason": selection_reason,
            "top5_candidates_count": len(top5),
            "all_candidates_count": len(candidates),
            "price": price,
            "ceiling": state["guardrail_ceiling"],
            "guardrail_passed": passed,
            # Revenue Growth Engine output
            "upsell_offer": upsell_offer,
            "upsell_triggered": upsell_offer is not None,
            "upsell_accepted": bool(state.get("accept_upsell")) and upsell_offer is not None,
            "revenue_lift_inr": upsell_offer["revenue_lift_inr"] if upsell_offer and state.get("accept_upsell") else 0.0,
            "upsell_discount_applied": upsell_offer["discount_pct"] if upsell_offer else None,
        },
    )
    return state
