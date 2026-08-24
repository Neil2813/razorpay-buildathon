"""LangGraph transaction graph orchestration.

Uses LangGraph StateGraph with explicit agent nodes, conditional router edges,
and state checkpointing.
"""

from __future__ import annotations

from typing import Any, Iterable

try:
    from langgraph.graph import StateGraph, START, END
    from langchain_core.runnables import RunnableConfig
    HAS_LANGGRAPH = True
except ImportError:
    HAS_LANGGRAPH = False
    StateGraph = None
    START = "START"
    END = "END"
    RunnableConfig = Any

from . import concierge_agent, decision_agent, discovery_agent, ledger_agent, payment_execution_agent, risk_agent
from .state import TransactionState, new_transaction_state


# ---------------------------------------------------------------------------
# LangGraph Node Functions
# ---------------------------------------------------------------------------

def concierge_node(state: TransactionState, config: RunnableConfig) -> dict[str, Any]:
    """Concierge Agent node: Parse natural language intent."""
    if not state.get("current_agent"):
        concierge_agent.run(state)
        if state.get("intent", {}).get("needs_clarification"):
            state["payment_status"] = "escalated"
            state["escalation_message"] = state["intent"].get("clarification_reason")
        checkpoint_cb = config.get("configurable", {}).get("checkpoint_cb")
        if checkpoint_cb:
            checkpoint_cb(state)
    return dict(state)


def discovery_node(state: TransactionState, config: RunnableConfig) -> dict[str, Any]:
    """Discovery Agent node: multi-source, trust-gated product discovery."""
    discovery_agent.run(state)
    # discovery_agent sets payment_status="escalated" on trust-warning halt (guided mode).
    # Only set the generic "no results" escalation if NOT already escalated for another reason.
    if (
        not state.get("catalog_candidates")
        and state.get("payment_status") != "escalated"
    ):
        state["payment_status"] = "escalated"
        state["escalation_message"] = "I couldn't find an in-stock item matching those requirements."
    checkpoint_cb = config.get("configurable", {}).get("checkpoint_cb")
    if checkpoint_cb:
        checkpoint_cb(state)
    return dict(state)


def negotiation_node(state: TransactionState, config: RunnableConfig) -> dict[str, Any]:
    """Negotiation/Decision Agent node: Choose product & evaluate spend ceiling."""
    guardrail_ceiling = config.get("configurable", {}).get("guardrail_ceiling", 5000.0)
    decision_agent.run(state, guardrail_ceiling=guardrail_ceiling)
    checkpoint_cb = config.get("configurable", {}).get("checkpoint_cb")
    if checkpoint_cb:
        checkpoint_cb(state)
    return dict(state)


def risk_node(state: TransactionState, config: RunnableConfig) -> dict[str, Any]:
    """Risk Agent node: ML risk evaluation & threshold check."""
    transaction = config.get("configurable", {}).get("transaction", {})
    product = state.get("chosen_product") or {}
    if product.get("price"):
        transaction["amount"] = float(product["price"])
    risk_agent.run(state, transaction)
    checkpoint_cb = config.get("configurable", {}).get("checkpoint_cb")
    if checkpoint_cb:
        checkpoint_cb(state)
    return dict(state)


def payment_node(state: TransactionState, config: RunnableConfig) -> dict[str, Any]:
    """Payment Execution Agent node: Razorpay charge with single retry policy."""
    gateway = config.get("configurable", {}).get("gateway")
    checkpoint_cb = config.get("configurable", {}).get("checkpoint_cb")
    if gateway is None:
        state["payment_status"] = "escalated"
        state["escalation_message"] = "A payment gateway is required before a charge can be attempted."
        if checkpoint_cb:
            checkpoint_cb(state)
        return dict(state)

    payment_execution_agent.run(
        state,
        gateway,
        before_first_charge=checkpoint_cb,
        after_attempt=checkpoint_cb,
    )
    if checkpoint_cb:
        checkpoint_cb(state)
    return dict(state)


def ledger_node(state: TransactionState, config: RunnableConfig) -> dict[str, Any]:
    """Audit/Ledger Agent node: Finalize and lock state."""
    ledger_agent.finalize(state)
    checkpoint_cb = config.get("configurable", {}).get("checkpoint_cb")
    if checkpoint_cb:
        checkpoint_cb(state)
    return dict(state)


# ---------------------------------------------------------------------------
# LangGraph Conditional Routers (Pure Edges)
# ---------------------------------------------------------------------------

def route_after_concierge(state: TransactionState) -> str:
    if state.get("intent", {}).get("needs_clarification") or state.get("payment_status") == "escalated":
        return "ledger"
    return "discovery"


def route_after_discovery(state: TransactionState) -> str:
    # Escalated can mean: trust-warning halt, no results, or resume-after-override handled.
    if not state.get("catalog_candidates") or state.get("payment_status") == "escalated":
        return "ledger"
    return "negotiation"


def route_after_negotiation(state: TransactionState) -> str:
    if not state.get("guardrail_passed") or state.get("payment_status") == "escalated":
        return "ledger"
    return "risk"


def route_after_risk(state: TransactionState) -> str:
    if state.get("requires_confirmation") or state.get("payment_status") == "escalated":
        return "ledger"
    return "payment"


# ---------------------------------------------------------------------------
# StateGraph Compilation
# ---------------------------------------------------------------------------

def _build_transaction_graph() -> Any:
    if not HAS_LANGGRAPH:
        return None

    workflow = StateGraph(TransactionState)

    # Add Nodes
    workflow.add_node("concierge", concierge_node)
    workflow.add_node("discovery", discovery_node)   # replaces "catalog" node
    workflow.add_node("negotiation", negotiation_node)
    workflow.add_node("risk", risk_node)
    workflow.add_node("payment", payment_node)
    workflow.add_node("ledger", ledger_node)

    # Add Edges
    workflow.add_edge(START, "concierge")

    workflow.add_conditional_edges(
        "concierge",
        route_after_concierge,
        {"discovery": "discovery", "ledger": "ledger"},
    )
    workflow.add_conditional_edges(
        "discovery",
        route_after_discovery,
        {"negotiation": "negotiation", "ledger": "ledger"},
    )
    workflow.add_conditional_edges(
        "negotiation",
        route_after_negotiation,
        {"risk": "risk", "ledger": "ledger"},
    )
    workflow.add_conditional_edges(
        "risk",
        route_after_risk,
        {"payment": "payment", "ledger": "ledger"},
    )

    workflow.add_edge("payment", "ledger")
    workflow.add_edge("ledger", END)

    return workflow.compile()


_app_graph = None


def get_transaction_graph() -> Any:
    global _app_graph
    if _app_graph is None and HAS_LANGGRAPH:
        _app_graph = _build_transaction_graph()
    return _app_graph


def run_transaction(
    *,
    tenant_id: str,
    user_message: str,
    catalog: Iterable[dict[str, Any]],
    guardrail_ceiling: float,
    transaction: dict[str, Any],
    gateway: payment_execution_agent.PaymentGateway | None = None,
    session_id: str | None = None,
    ledger: ledger_agent.SQLiteLedger | None = None,
    # Autonomy fields (UPDATE.md §2) — passed through state but declared here for
    # callers that want to pre-seed them without a Concierge turn.
    autonomy_mode: str | None = None,
    requested_sites: list[str] | None = None,
) -> TransactionState:
    """Run a purchase request through the compiled LangGraph StateGraph."""
    ledger = ledger or ledger_agent.get_default_sqlite_ledger()
    existing_state = None
    if session_id:
        from app.db.database import load_transaction_checkpoint
        existing_state = load_transaction_checkpoint(session_id, tenant_id)

    state: TransactionState = existing_state or new_transaction_state(
        tenant_id=tenant_id, user_message=user_message, session_id=session_id
    )
    # Seed autonomy state from caller (non-destructive — existing state wins).
    if autonomy_mode and not state.get("autonomy_mode"):
        state["autonomy_mode"] = autonomy_mode  # type: ignore[assignment]
    if requested_sites and not state.get("requested_sites"):
        state["requested_sites"] = requested_sites

    # A terminal durable checkpoint is the source of truth on duplicate/resume calls.
    if existing_state and state.get("payment_status") in {"success", "escalated"}:
        return state

    event_index = len(state.get("audit_log", []))

    def checkpoint(current_state: TransactionState) -> None:
        nonlocal event_index
        event_index = ledger.checkpoint(current_state, from_index=event_index)

    graph = get_transaction_graph()

    if graph is not None:
        config = {
            "configurable": {
                "catalog": list(catalog),     # kept for backward compat; discovery_agent uses mock
                "guardrail_ceiling": guardrail_ceiling,
                "transaction": transaction,
                "gateway": gateway,
                "checkpoint_cb": checkpoint,
            }
        }
        final_state = graph.invoke(state, config=config)
        return final_state

    # Pure Python Fallback if LangGraph is not available
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
        discovery_agent.run(state)   # replaces: catalog_agent.run(state, catalog)
        checkpoint(state)
    # Trust-warning halt — guided mode, awaiting user response.
    if state["current_agent"] == "discovery" and state.get("payment_status") == "escalated":
        ledger_agent.finalize(state)
        checkpoint(state)
        return state
    if state["current_agent"] == "discovery":
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
