"""Shared, auditable state for the GlassBox transaction graph."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, TypedDict
from uuid import uuid4


PaymentStatus = Literal["pending", "success", "failed", "escalated"]


class TransactionState(TypedDict, total=False):
    tenant_id: str
    session_id: str
    user_message: str
    intent: dict[str, Any]
    catalog_candidates: list[dict[str, Any]]
    chosen_product: dict[str, Any] | None
    guardrail_ceiling: float
    guardrail_passed: bool
    risk_score: float | None
    risk_features: dict[str, Any] | None
    payment_attempts: list[dict[str, Any]]
    payment_status: PaymentStatus
    escalation_message: str | None
    audit_log: list[dict[str, Any]]
    current_agent: str
    requires_confirmation: bool


def new_transaction_state(*, tenant_id: str, user_message: str, session_id: str | None = None) -> TransactionState:
    """Create the only supported initial state for a buyer transaction."""
    return TransactionState(
        tenant_id=tenant_id,
        session_id=session_id or str(uuid4()),
        user_message=user_message,
        intent={},
        catalog_candidates=[],
        chosen_product=None,
        guardrail_passed=False,
        risk_score=None,
        risk_features=None,
        payment_attempts=[],
        payment_status="pending",
        escalation_message=None,
        audit_log=[],
        current_agent="",
        requires_confirmation=False,
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
