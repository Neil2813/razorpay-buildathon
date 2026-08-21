"""Deterministic transaction graph orchestration.

The historic filename is preserved for compatibility. Routing uses plain code so
it can be wrapped by LangGraph without handing policy decisions to an LLM.
"""

from __future__ import annotations

from typing import Any, Iterable

from . import catalog_agent, concierge_agent, decision_agent, ledger_agent, payment_execution_agent, risk_agent
from .state import TransactionState, new_transaction_state


def run_transaction(*, tenant_id: str, user_message: str, catalog: Iterable[dict[str, Any]], guardrail_ceiling: float, transaction: dict[str, Any], gateway: payment_execution_agent.PaymentGateway | None = None, session_id: str | None = None, ledger: ledger_agent.SQLiteLedger | None = None) -> TransactionState:
    """Run a purchase request through the guarded graph and return its full audit trail."""
    ledger = ledger or ledger_agent.get_default_sqlite_ledger()
    existing_state = None
    if session_id:
        from app.db.database import load_transaction_checkpoint
        existing_state = load_transaction_checkpoint(session_id, tenant_id)
    state: TransactionState = existing_state or new_transaction_state(
        tenant_id=tenant_id, user_message=user_message, session_id=session_id
    )
    # A terminal durable checkpoint is the source of truth on duplicate/resume calls.
    if existing_state and state["payment_status"] in {"success", "escalated"}:
        return state
    event_index = len(state.get("audit_log", []))

    def checkpoint(current_state: TransactionState) -> None:
        nonlocal event_index
        event_index = ledger.checkpoint(current_state, from_index=event_index)

    if not state.get("current_agent"):
        concierge_agent.run(state)
        checkpoint(state)
    if state["current_agent"] == "concierge" and state["intent"].get("needs_clarification"):
        state["payment_status"] = "escalated"
        state["escalation_message"] = state["intent"]["clarification_reason"]
        ledger_agent.finalize(state)
        checkpoint(state)
        return state
    if state["current_agent"] == "concierge":
        catalog_agent.run(state, catalog)
        checkpoint(state)
    if state["current_agent"] == "catalog":
        decision_agent.run(state, guardrail_ceiling=guardrail_ceiling)
        checkpoint(state)
    if state["current_agent"] == "negotiation" and not state["guardrail_passed"]:
        ledger_agent.finalize(state)
        checkpoint(state)
        return state
    if state["current_agent"] == "negotiation":
        risk_agent.run(state, transaction)
        checkpoint(state)
    if state["current_agent"] == "risk" and state.get("requires_confirmation"):
        ledger_agent.finalize(state)
        checkpoint(state)
        return state
    if gateway is None:
        state["payment_status"] = "escalated"
        state["escalation_message"] = "A payment gateway is required before a charge can be attempted."
        ledger_agent.finalize(state)
        checkpoint(state)
        return state
    payment_execution_agent.run(state, gateway, before_first_charge=checkpoint, after_attempt=checkpoint)
    checkpoint(state)
    ledger_agent.finalize(state)
    checkpoint(state)
    return state
