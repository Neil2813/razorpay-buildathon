"""
Transaction Orchestrator Route.

POST /api/transaction/run  — Run the full 6-agent pipeline synchronously.
GET  /api/transaction/{session_id} — Replay a persisted transaction.
GET  /api/transaction/insights/{tenant_id} — Merchant revenue intelligence.
WS   /api/transaction/ws/{session_id} — Stream live agent events.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse

from app.agents import (
    concierge_agent, decision_agent, discovery_agent,
    ledger_agent, merchant_insights_agent, payment_execution_agent, risk_agent, site_trust_agent,
)
from app.agents.orchaestartor_langgraph import run_transaction
from app.agents.state import TransactionState, new_transaction_state
from app.auth.deps import get_current_user
from app.core.razorpay_gateway import get_gateway
from app.db.database import (
    checkpoint_transaction, get_tenant_ceiling, get_transaction_history, load_transaction_checkpoint, query_catalog,
)


from app.schemas.transaction import RunTransactionRequest, TransactionResponse

router = APIRouter(prefix="/transaction", tags=["Transaction Orchestrator"])


def _resolve_tenant_id(requested: str | None, current_user: dict) -> str:
    """
    Enforce tenant isolation. Non-admin users are strictly tied to their JWT tenant claim.
    Platform admins are permitted to override tenant_id explicitly.
    """
    if current_user.get("role") == "platform_admin" and requested:
        return requested
    return current_user.get("tenant_id", "demo_tenant")


@router.get(
    "/history/list",
    summary="Transaction History",
    description="Returns past transaction logs and audit summaries for the user's tenant.",
)
async def get_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    tenant_id = _resolve_tenant_id(None, current_user)
    history = get_transaction_history(tenant_id=tenant_id, limit=limit)
    return {"tenant_id": tenant_id, "history": history, "count": len(history)}

# In-memory broadcast registry: session_id -> list of connected WebSocket queues
_ws_queues: dict[str, list[asyncio.Queue]] = {}


async def _broadcast(session_id: str, event: dict[str, Any]) -> None:
    """Push a serialized agent event to all WebSocket listeners for this session."""
    for queue in _ws_queues.get(session_id, []):
        await queue.put(event)


def _run_with_streaming(
    request: RunTransactionRequest,
    current_user: dict,
    loop: asyncio.AbstractEventLoop | None = None,
) -> TransactionState:
    """
    Execute the transaction graph with async broadcast hooks at each checkpoint.
    Checkpoint writes are synchronous (SQLite); WebSocket push is done via
    loop.call_soon_threadsafe so we don't block the agent steps.
    """
    tenant_id = _resolve_tenant_id(request.tenant_id, current_user)
    catalog = query_catalog(tenant_id)
    guardrail_ceiling = get_tenant_ceiling(tenant_id)
    gateway = get_gateway(force_fail=request.force_payment_fail)

    # Build transaction payload from the chosen product price (populated mid-run)
    # Risk agent will receive real figures once the product is selected.
    transaction_payload: dict[str, Any] = {
        "type": "PAYMENT",
        "amount": 0,  # Populated before risk step from chosen product
        "old_balance_orig": 0,
        "new_balance_orig": 0,
        "old_balance_dest": 0,
        "new_balance_dest": 0,
    }

    session_id = request.session_id or ""
    last_sent_index = 0

    def checkpoint_and_broadcast(state: TransactionState) -> None:
        nonlocal last_sent_index
        audit_log = state.get("audit_log", [])
        new_events = audit_log[last_sent_index:]
        if new_events:
            last_sent_index = len(audit_log)
            if loop and session_id and session_id in _ws_queues:
                for event in new_events:
                    loop.call_soon_threadsafe(
                        lambda e=event: asyncio.create_task(_broadcast(session_id, {"type": "agent_event", **e}))
                    )

    ledger = ledger_agent.get_default_sqlite_ledger()
    state = run_transaction(
        tenant_id=tenant_id,
        user_message=request.user_message,
        catalog=catalog,
        guardrail_ceiling=guardrail_ceiling,
        transaction=transaction_payload,
        gateway=gateway,
        session_id=request.session_id,
        ledger=ledger,
        autonomy_mode=request.autonomy_mode,
        requested_sites=request.requested_sites,
        on_checkpoint=checkpoint_and_broadcast,
    )
    return state


@router.post(
    "/run",
    response_model=TransactionResponse,
    summary="Run Full Agent Pipeline",
    description=(
        "Runs the GLASSBOX 6-agent pipeline: Concierge → Catalog → Negotiation "
        "→ Risk → Payment → Audit. Returns the complete auditable transaction state."
    ),
)
async def run_transaction_endpoint(
    body: RunTransactionRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        loop = asyncio.get_event_loop()
        state = await loop.run_in_executor(None, lambda: _run_with_streaming(body, current_user, loop))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transaction pipeline failed: {exc}",
        )

    # Broadcast final state to any connected WebSocket listeners
    session_id = state.get("session_id", "")
    if session_id in _ws_queues:
        await _broadcast(session_id, {"type": "transaction_complete", "state": state})

    return TransactionResponse(
        session_id=state["session_id"],
        tenant_id=state["tenant_id"],
        payment_status=state["payment_status"],
        escalation_message=state.get("escalation_message"),
        chosen_product=state.get("chosen_product"),
        guardrail_ceiling=state.get("guardrail_ceiling"),
        guardrail_passed=state.get("guardrail_passed"),
        risk_score=state.get("risk_score"),
        risk_features=state.get("risk_features"),
        payment_attempts=state.get("payment_attempts", []),
        audit_log=state.get("audit_log", []),
        current_agent=state.get("current_agent", ""),
        requires_confirmation=state.get("requires_confirmation", False),
        catalog_candidates=state.get("catalog_candidates", []),
        autonomy_mode=state.get("autonomy_mode"),
        requested_sites=state.get("requested_sites"),
        discovered_candidates=state.get("discovered_candidates", []),
        site_trust_results=state.get("site_trust_results", []),
        trust_override=state.get("trust_override", False),
        sites_rejected_count=state.get("sites_rejected_count", 0),
    )


@router.get(
    "/{session_id}",
    response_model=TransactionResponse,
    summary="Replay Transaction",
    description="Load and replay a persisted transaction state from the ledger.",
)
async def get_transaction(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    tenant_id = _resolve_tenant_id(None, current_user)
    state = load_transaction_checkpoint(session_id, tenant_id)
    if not state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No transaction found for session_id={session_id} in tenant={tenant_id}.",
        )
    return TransactionResponse(
        session_id=state["session_id"],
        tenant_id=state["tenant_id"],
        payment_status=state["payment_status"],
        escalation_message=state.get("escalation_message"),
        chosen_product=state.get("chosen_product"),
        guardrail_ceiling=state.get("guardrail_ceiling"),
        guardrail_passed=state.get("guardrail_passed"),
        risk_score=state.get("risk_score"),
        risk_features=state.get("risk_features"),
        payment_attempts=state.get("payment_attempts", []),
        audit_log=state.get("audit_log", []),
        current_agent=state.get("current_agent", ""),
        requires_confirmation=state.get("requires_confirmation", False),
        catalog_candidates=state.get("catalog_candidates", []),
        autonomy_mode=state.get("autonomy_mode"),
        requested_sites=state.get("requested_sites"),
        discovered_candidates=state.get("discovered_candidates", []),
        site_trust_results=state.get("site_trust_results", []),
        trust_override=state.get("trust_override", False),
        sites_rejected_count=state.get("sites_rejected_count", 0),
    )


@router.get(
    "/insights/{tenant_id}",
    summary="Merchant Revenue Intelligence",
    description=(
        "Returns merchant revenue intelligence: AI buyer acceptance rates, "
        "top escalation reasons, SKU selection counts, and computed insights."
    ),
)
async def get_merchant_insights(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
):
    resolved_tenant_id = _resolve_tenant_id(tenant_id, current_user)
    from app.db.database import get_db_connection
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM audit_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 500;",
            (resolved_tenant_id,),
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    events = []
    for row in rows:
        event = dict(row)
        try:
            event["inputs_summary"] = json.loads(event.get("inputs_summary") or "{}")
            event["output_summary"] = json.loads(event.get("output_summary") or "{}")
        except Exception:
            pass
        events.append(event)

    insights = merchant_insights_agent.compute_insights(events)
    return {"tenant_id": resolved_tenant_id, "insights": insights, "event_count": len(events)}


@router.websocket("/ws/{session_id}")
async def transaction_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time agent event streaming with tenant isolation.

    The frontend connects to this before or during a /run call.
    Authentication can be passed via ?token=<jwt_token> query parameter.
    Events are pushed as JSON lines:
      {"type": "agent_event", "agent": "...", "decision_reason": "...", ...}
      {"type": "transaction_complete", "state": {...}}
    """
    await websocket.accept()
    
    # Resolve tenant_id from optional JWT query parameter
    tenant_id = "demo_tenant"
    token = websocket.query_params.get("token")
    if token:
        from app.auth.security import decode_access_token
        payload = decode_access_token(token)
        if payload and payload.get("tenant_id"):
            tenant_id = payload["tenant_id"]

    queue: asyncio.Queue = asyncio.Queue()
    _ws_queues.setdefault(session_id, []).append(queue)

    try:
        # First: replay any already-persisted events for this session scoped to tenant
        from app.db.database import load_transaction_checkpoint
        existing = load_transaction_checkpoint(session_id, tenant_id)
        if existing:
            for event in existing.get("audit_log", []):
                await websocket.send_json({"type": "agent_event", **event})

        # Then stream live events as they arrive
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                await websocket.send_json(event)
                if event.get("type") == "transaction_complete":
                    break
            except asyncio.TimeoutError:
                # Send a heartbeat ping to keep the connection alive
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        queues = _ws_queues.get(session_id, [])
        if queue in queues:
            queues.remove(queue)
        if not queues:
            _ws_queues.pop(session_id, None)
