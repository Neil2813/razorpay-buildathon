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
    autonomy_mode: Literal["guided", "autonomous"] | None = Field(
        default=None,
        description="Buyer autonomy mode preference.",
    )
    requested_sites: list[str] | None = Field(
        default=None,
        description="Target site URLs or domains for guided mode.",
    )
    buyer_approved: bool = Field(
        default=False,
        description="Explicit approval for the already selected merchant SKU and its exact amount.",
    )
    address_id: str | None = Field(default=None, description="Buyer delivery address selected for fulfilment.")
    accept_upsell: bool = Field(
        default=False,
        description=(
            "Explicit opt-in for the upsell bundle offer presented in a prior response. "
            "Pass True only when the buyer agent has been explicitly delegated to purchase "
            "complementary items. Default False ensures upsells are proposals, never automatic charges."
        ),
    )


class AuditEventResponse(BaseModel):
    event_id: str
    timestamp: str
    agent: str
    decision_reason: str
    inputs_summary: dict[str, Any]
    output_summary: dict[str, Any]


class VerifyPaymentRequest(BaseModel):
    session_id: str
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


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
    autonomy_mode: Literal["guided", "autonomous"] | None = None
    requested_sites: list[str] | None = None
    discovered_candidates: list[dict[str, Any]] = []
    site_trust_results: list[dict[str, Any]] = []
    trust_override: bool = False
    sites_rejected_count: int = 0
    buyer_approved: bool = False
    razorpay_order_id: str | None = None
    razorpay_key_id: str | None = None
    delivery_address: dict[str, Any] | None = None
    fulfilment: dict[str, Any] | None = None
    upsell_offer: dict[str, Any] | None = None  # Revenue Growth Engine bundle proposal
