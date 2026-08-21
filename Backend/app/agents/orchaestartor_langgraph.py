"""Deterministic transaction graph orchestration.

The historic filename is preserved for compatibility. Routing uses plain code so
it can be wrapped by LangGraph without handing policy decisions to an LLM.
"""

from __future__ import annotations

from typing import Any, Iterable

from . import catalog_agent, concierge_agent, decision_agent, ledger_agent, payment_execution_agent, risk_agent
from .state import TransactionState, new_transaction_state


def run_transaction(*, tenant_id: str, user_message: str, catalog: Iterable[dict[str, Any]], guardrail_ceiling: float, transaction: dict[str, Any], gateway: payment_execution_agent.PaymentGateway | None = None, session_id: str | None = None) -> TransactionState:
    """Run a purchase request through the guarded graph and return its full audit trail."""
    state = new_transaction_state(tenant_id=tenant_id, user_message=user_message, session_id=session_id)
    concierge_agent.run(state)
    if state["intent"].get("needs_clarification"):
        state["payment_status"] = "escalated"
        state["escalation_message"] = state["intent"]["clarification_reason"]
        return ledger_agent.finalize(state)
    catalog_agent.run(state, catalog)
    decision_agent.run(state, guardrail_ceiling=guardrail_ceiling)
    if not state["guardrail_passed"]:
        return ledger_agent.finalize(state)
    risk_agent.run(state, transaction)
    if state.get("requires_confirmation"):
        return ledger_agent.finalize(state)
    if gateway is None:
        state["payment_status"] = "escalated"
        state["escalation_message"] = "A payment gateway is required before a charge can be attempted."
        return ledger_agent.finalize(state)
    payment_execution_agent.run(state, gateway)
    return ledger_agent.finalize(state)
