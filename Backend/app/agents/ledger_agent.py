"""Durable ledger adapter and append-only event helpers."""

from __future__ import annotations

from copy import deepcopy
import logging
import time
from typing import Any

from .groq_client import REASONING_MODEL, complete_json
from .state import TransactionState, audit_event

logger = logging.getLogger("glassbox.ledger")


class SQLiteLedger:
    """Write-ahead SQLite checkpoint store used by the transaction graph."""
    def __init__(self) -> None:
        from app.db.database import init_db
        init_db()

    def checkpoint(self, state: TransactionState, *, from_index: int = 0) -> int:
        from app.db.database import checkpoint_transaction
        return checkpoint_transaction(state, from_event_index=from_index)


_default_sqlite_ledger: SQLiteLedger | None = None


def get_default_sqlite_ledger() -> SQLiteLedger:
    """Create the process-wide durable ledger once, rather than per request."""
    global _default_sqlite_ledger
    if _default_sqlite_ledger is None:
        _default_sqlite_ledger = SQLiteLedger()
    return _default_sqlite_ledger


class InMemoryLedger:
    """Ephemeral repository retained solely for isolated unit tests."""
    def __init__(self) -> None:
        self._events: list[dict[str, Any]] = []

    def persist(self, event: dict[str, Any]) -> None:
        self._events.append(deepcopy(event))

    def by_tenant(self, tenant_id: str) -> list[dict[str, Any]]:
        return [event for event in self._events if event.get("tenant_id") == tenant_id]


def persist_new_events(state: TransactionState, ledger: InMemoryLedger, *, from_index: int = 0) -> int:
    """Persist audit events before any optional UI/WebSocket broadcast."""
    for event in state.get("audit_log", [])[from_index:]:
        ledger.persist({**event, "tenant_id": state["tenant_id"], "session_id": state["session_id"]})
    return len(state.get("audit_log", []))


def finalize(state: TransactionState) -> TransactionState:
    """Lock the transaction ledger with a deterministic, unambiguous final status."""
    status = state.get("payment_status", "pending")

    if status == "success":
        final_label = "Transaction Complete"
    elif status == "escalated":
        final_label = "Transaction Escalated for Human Review"
    elif status == "pending":
        # Pending means awaiting buyer confirmation (risk passed, not yet approved or paid)
        final_label = "Awaiting Buyer Approval"
    else:
        final_label = "Transaction Escalated for Human Review"

    audit_event(
        state,
        agent="ledger",
        decision_reason=final_label,
        output_summary={"payment_status": status, "final_label": final_label},
    )
    return state

