"""Shared, auditable state for the GlassBox transaction graph."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, TypedDict
from uuid import uuid4


PaymentStatus = Literal["pending", "success", "failed", "escalated"]


# ---------------------------------------------------------------------------
# Intent sub-schema (kept as a plain dict[str, Any] in state for flexibility,
# but documented here for reference):
#
#   category       : str | None         — e.g. "shirt", "shoe"
#   budget_min     : float | None       — floor price (₹)
#   budget_max     : float | None       — ceiling price (₹)
#   brand          : str | None         — e.g. "Nike"
#   color          : str | None         — e.g. "blue"
#   size           : str | None         — e.g. "M", "9"
#   min_rating     : float | None       — minimum star rating (0–5)
#   deadline       : str | None
#   needs_clarification : bool
#   clarification_reason: str | None
#   missing_parameters  : list[str]     — params still to be collected
# ---------------------------------------------------------------------------


class TransactionState(TypedDict, total=False):
    tenant_id: str
    session_id: str
    user_message: str
    intent: dict[str, Any]
    # --- Autonomy & Discovery (UPDATE.md §1) ---
    autonomy_mode: Literal["guided", "autonomous"] | None
    requested_sites: list[str] | None          # guided mode only
    discovered_candidates: list[dict[str, Any]] # pre-trust-filter site+product+review_summary
    site_trust_results: list[dict[str, Any]]    # {site, status, reason} per site checked
    trust_override: bool                        # user explicitly continued past a warning
    sites_rejected_count: int                   # how many sources were silently skipped (autonomous)
    # --- Existing fields (unchanged) ---
    catalog_candidates: list[dict[str, Any]]
    chosen_product: dict[str, Any] | None
    guardrail_ceiling: float
    guardrail_passed: bool
    risk_score: float | None
    risk_features: dict[str, Any] | None
    payment_attempts: list[dict[str, Any]]
    idempotency_key: str | None
    payment_status: PaymentStatus
    escalation_message: str | None
    audit_log: list[dict[str, Any]]
    current_agent: str
    requires_confirmation: bool
    buyer_approved: bool
    razorpay_order_id: str | None
    razorpay_key_id: str | None
    delivery_address: dict[str, Any] | None
    fulfilment: dict[str, Any] | None
    # --- Revenue Growth Engine (Upsell & Cross-Sell) ---
    upsell_offer: dict[str, Any] | None  # complement item bundle proposal


def new_transaction_state(*, tenant_id: str, user_message: str, session_id: str | None = None) -> TransactionState:
    """Create the only supported initial state for a buyer transaction."""
    return TransactionState(
        tenant_id=tenant_id,
        session_id=session_id or str(uuid4()),
        user_message=user_message,
        intent={},
        # Autonomy & Discovery defaults
        autonomy_mode=None,
        requested_sites=None,
        discovered_candidates=[],
        site_trust_results=[],
        trust_override=False,
        sites_rejected_count=0,
        # Existing defaults
        catalog_candidates=[],
        chosen_product=None,
        guardrail_passed=False,
        risk_score=None,
        risk_features=None,
        payment_attempts=[],
        idempotency_key=None,
        payment_status="pending",
        escalation_message=None,
        audit_log=[],
        current_agent="",
        requires_confirmation=False,
        buyer_approved=False,
        delivery_address=None,
        fulfilment=None,
        upsell_offer=None,
    )


def audit_event(state: TransactionState, *, agent: str, decision_reason: str,
                inputs_summary: dict[str, Any] | None = None,
                output_summary: dict[str, Any] | None = None) -> dict[str, Any]:
    """Append an immutable-style structured event. Existing events are never changed."""
    event = {
        "event_id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": agent,
        "inputs_summary": inputs_summary or {},
        "output_summary": output_summary or {},
        "decision_reason": decision_reason,
    }
    state.setdefault("audit_log", []).append(event)
    state["current_agent"] = agent
    return event
