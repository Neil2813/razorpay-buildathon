"""
AWS Lambda Step Workers for Step Functions State Machine Execution.

Wraps each of the 6 agents into individual AWS Lambda handlers for serverless Step Functions execution.
Emits telemetry to AWS EventBridge after each agent node completion.
"""

from __future__ import annotations

from typing import Any

from app.agents import (
    concierge_agent, decision_agent, discovery_agent, ledger_agent,
    payment_execution_agent, risk_agent,
)
from app.services.aws_eventbridge import event_bridge


def concierge_step_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for Concierge Agent step."""
    state = dict(event)
    concierge_agent.run(state)
    if state.get("intent", {}).get("needs_clarification"):
        state["payment_status"] = "pending"
        state["escalation_message"] = state["intent"].get("clarification_reason")
    else:
        state["current_agent"] = "concierge"

    event_bridge.publish_event("GlassBox.Agent.Completed", {
        "session_id": state.get("session_id"),
        "tenant_id": state.get("tenant_id"),
        "agent": "concierge",
        "intent": state.get("intent"),
    })
    return state


def discovery_step_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for Discovery Agent step."""
    state = dict(event)
    catalog = state.get("catalog", [])
    discovery_agent.run(state, catalog)
    if not state.get("catalog_candidates") and state.get("payment_status") != "escalated":
        state["payment_status"] = "escalated"
        state["escalation_message"] = "I couldn't find an in-stock item matching those requirements."
    else:
        state["current_agent"] = "discovery"

    event_bridge.publish_event("GlassBox.Agent.Completed", {
        "session_id": state.get("session_id"),
        "tenant_id": state.get("tenant_id"),
        "agent": "discovery",
        "candidates_count": len(state.get("catalog_candidates", [])),
    })
    return state


def negotiation_step_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for Negotiation / Decision Agent step."""
    state = dict(event)
    guardrail_ceiling = state.get("guardrail_ceiling", 5000.0)
    decision_agent.run(state, guardrail_ceiling=guardrail_ceiling)
    if state.get("payment_status") != "escalated":
        state["current_agent"] = "negotiation"

    event_bridge.publish_event("GlassBox.Agent.Completed", {
        "session_id": state.get("session_id"),
        "tenant_id": state.get("tenant_id"),
        "agent": "negotiation",
        "chosen_product": state.get("chosen_product"),
        "guardrail_passed": state.get("guardrail_passed"),
    })
    return state


def risk_step_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for Risk Evaluation Agent step."""
    state = dict(event)
    product = state.get("chosen_product") or {}
    if not product:
        return state
    transaction = state.get("transaction", {})
    if product.get("price"):
        transaction["amount"] = float(product["price"])
    risk_agent.run(state, transaction)
    if state.get("payment_status") != "escalated":
        state["current_agent"] = "risk"

    event_bridge.publish_event("GlassBox.Risk.Evaluated", {
        "session_id": state.get("session_id"),
        "tenant_id": state.get("tenant_id"),
        "risk_score": state.get("risk_score"),
        "requires_confirmation": state.get("requires_confirmation"),
    })
    return state


def payment_step_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for Payment Execution Agent step."""
    state = dict(event)
    from app.core.razorpay_gateway import get_gateway
    gateway = get_gateway(tenant_id=state.get("tenant_id", "demo_tenant"))
    payment_execution_agent.run(state, gateway)
    if state.get("payment_status") != "escalated":
        state["current_agent"] = "payment"

    event_bridge.publish_event("GlassBox.Payment.Verified", {
        "session_id": state.get("session_id"),
        "tenant_id": state.get("tenant_id"),
        "payment_status": state.get("payment_status"),
        "razorpay_order_id": state.get("razorpay_order_id"),
    })
    return state


def ledger_step_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for Audit / Ledger Agent step."""
    state = dict(event)
    ledger_agent.finalize(state)
    state["current_agent"] = "ledger"

    event_bridge.publish_event("GlassBox.Audit.Logged", {
        "session_id": state.get("session_id"),
        "tenant_id": state.get("tenant_id"),
        "payment_status": state.get("payment_status"),
        "audit_events_count": len(state.get("audit_log", [])),
    })
    return state
