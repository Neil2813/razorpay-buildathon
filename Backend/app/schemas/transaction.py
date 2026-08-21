"""
Pydantic Schemas for the Transaction Orchestrator API.
"""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class RunTransactionRequest(BaseModel):
    user_message: str = Field(
        ...,
        example="Find me running shoes under Rs. 4000, size 9.",
        description="Natural language buyer intent.",
    )
    tenant_id: str = Field(default="demo_tenant")
    session_id: str | None = Field(
        default=None,
        description="Resume an existing transaction. Omit to start a new session.",
    )
    force_payment_fail: bool = Field(
        default=False,
        description="For demo: force payment to fail (triggers the decline → retry → escalate script).",
    )


class AuditEventResponse(BaseModel):
    event_id: str
    timestamp: str
    agent: str
    decision_reason: str
    inputs_summary: dict[str, Any]
    output_summary: dict[str, Any]


class TransactionResponse(BaseModel):
    session_id: str
    tenant_id: str
    payment_status: Literal["pending", "success", "failed", "escalated"]
    escalation_message: str | None = None
    chosen_product: dict[str, Any] | None = None
    guardrail_ceiling: float | None = None
    guardrail_passed: bool | None = None
    risk_score: float | None = None
    risk_features: dict[str, Any] | None = None
    payment_attempts: list[dict[str, Any]] = []
    audit_log: list[AuditEventResponse] = []
    current_agent: str = ""
    requires_confirmation: bool = False
    catalog_candidates: list[dict[str, Any]] = []
