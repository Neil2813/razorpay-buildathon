"""Durable ledger adapter and append-only event helpers."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .state import TransactionState, audit_event


class InMemoryLedger:
    """Small repository for demos/tests; replace with a durable DB adapter in deployment."""
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
    audit_event(state, agent="ledger", decision_reason="Transaction graph finished; audit log remains append-only.", output_summary={"payment_status": state["payment_status"]})
    return state
