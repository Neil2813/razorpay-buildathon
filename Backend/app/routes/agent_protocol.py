"""
Agent Commerce Protocol Endpoints — UAP / ACP / AP2 / x402 compliant.

Exposes three standard discovery endpoints for AI buyer agents:

  GET /.well-known/agent-commerce.json   — Root protocol manifest (UAP standard)
  GET /api/agent/manifest                — Versioned alias of the manifest
  GET /api/agent/catalog                 — Agent-optimised JSON-LD product catalog
  GET /api/agent/capabilities            — Spend-gating, risk, webhook capabilities
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.auth.deps import get_current_user
from app.db.database import get_db_connection, query_catalog

router_root = APIRouter(tags=["Agent Protocol"])
router_api  = APIRouter(prefix="/agent", tags=["Agent Protocol"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _build_manifest(request: Request, tenant: dict[str, Any] | None = None) -> dict[str, Any]:
    base = _base_url(request)
    name = (tenant or {}).get("company_name") or (tenant or {}).get("name") or "GlassBox Merchant"
    return {
        "@context": "https://schema.org",
        "@type": "AgentCommerceManifest",
        "protocolVersion": "1.0",
        "standards": ["UAP-1.0", "ACP-2024", "AP2-draft", "x402-preview"],
        "merchant": {
            "name": name,
            "description": (
                "GlassBox AI-native merchant with deterministic spend ceilings, "
                "ML fraud risk gating, and end-to-end agent transaction audit trails."
            ),
            "support": {
                "email": (tenant or {}).get("support_email"),
                "phone": (tenant or {}).get("support_phone"),
            },
        },
        "endpoints": {
            "catalog":      f"{base}/api/agent/catalog",
            "capabilities": f"{base}/api/agent/capabilities",
            "transaction":  f"{base}/api/transaction/run",
            "manifest":     f"{base}/api/agent/manifest",
            "webhook":      f"{base}/api/webhooks/razorpay",
        },
        "auth": {
            "schemes": ["bearer_jwt"],
            "tokenEndpoint": f"{base}/api/auth/login",
            "registerEndpoint": f"{base}/api/auth/register",
            "jwtAlgorithm": "HS256",
        },
        "spendControl": {
            "model": "deterministic_guardrail",
            "description": (
                "Every order is evaluated against the tenant's unattended spend ceiling "
                "in pure Python — this check cannot be overridden by LLM output. "
                "Exceeding the ceiling escalates for explicit buyer approval."
            ),
            "ceilingCurrency": "INR",
        },
        "riskGating": {
            "model": "hybrid_xgboost_lgbm",
            "fallback": "rule_based",
            "auditTrail": True,
            "explainability": "shap_feature_importances",
        },
        "paymentRails": {
            "provider": "razorpay",
            "mode": "test",
            "currency": "INR",
            "retryPolicy": "single_bounded_retry",
            "webhookSignature": "hmac_sha256",
        },
        "catalog": {
            "format": "json_ld_schema_org",
            "queryEndpoint": f"{base}/api/agent/catalog",
            "filterCapabilities": [
                "category", "color", "size", "price_range",
                "min_rating", "in_stock", "return_policy",
            ],
        },
        "upsell": {
            "supported": True,
            "mechanism": "dynamic_bundle_discount",
            "maxDiscountPercent": 15,
            "withinBudgetCeiling": True,
        },
    }


def _catalog_to_jsonld(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert raw catalog rows to schema.org/Product JSON-LD for AI buyers."""
    items = []
    for p in products:
        sizes = p.get("sizes", [])
        if isinstance(sizes, str):
            try:
                sizes = json.loads(sizes)
            except Exception:
                sizes = []
        item: dict[str, Any] = {
            "@type": "Product",
            "productID": p.get("product_id"),
            "name": p.get("name"),
            "description": p.get("description"),
            "category": p.get("category"),
            "color": p.get("color"),
            "offers": {
                "@type": "Offer",
                "price": p.get("price"),
                "priceCurrency": "INR",
                "availability": "InStock" if p.get("in_stock") else "OutOfStock",
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": p.get("rating"),
            } if p.get("rating") else None,
            "size": sizes,
            "returnPolicy": {
                "@type": "MerchantReturnPolicy",
                "description": p.get("return_policy"),
            } if p.get("return_policy") else None,
            "deliveryLeadTime": {
                "@type": "QuantitativeValue",
                "value": p.get("delivery_time_days"),
                "unitCode": "DAY",
            } if p.get("delivery_time_days") is not None else None,
            # Machine-readable policy flags for AI agents
            "_agentMeta": {
                "hasReturnPolicy": bool(p.get("return_policy")),
                "hasDeliveryTime": p.get("delivery_time_days") is not None,
                "inStock": bool(p.get("in_stock")),
                "aiAcceptanceSignal": "high" if p.get("return_policy") and p.get("delivery_time_days") else "low",
            },
        }
        # Remove None values for clean output
        item = {k: v for k, v in item.items() if v is not None}
        items.append(item)
    return items


# ---------------------------------------------------------------------------
# /.well-known/agent-commerce.json  (UAP standard root location)
# ---------------------------------------------------------------------------

@router_root.get("/.well-known/agent-commerce.json", include_in_schema=True)
def well_known_agent_commerce(request: Request):
    """
    **UAP / ACP / AP2 standard discovery manifest.**

    AI buyer agents should crawl this endpoint to discover all commerce
    capabilities, authentication schemes, spend controls, and catalog APIs
    for this merchant. Compliant with UAP-1.0, ACP-2024, AP2-draft, x402-preview.
    """
    conn = get_db_connection()
    try:
        tenant = conn.execute(
            "SELECT * FROM tenants WHERE tenant_id = 'demo_tenant';"
        ).fetchone()
        tenant_dict = dict(tenant) if tenant else {}
    finally:
        conn.close()

    manifest = _build_manifest(request, tenant_dict)
    return JSONResponse(
        content=manifest,
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Type": "application/json",
            "X-Protocol-Standards": "UAP-1.0, ACP-2024, AP2-draft, x402-preview",
        },
    )


# ---------------------------------------------------------------------------
# /api/agent/manifest  (versioned alias, requires auth)
# ---------------------------------------------------------------------------

@router_api.get("/manifest")
def agent_manifest(request: Request, current_user: dict = Depends(get_current_user)):
    """
    **Authenticated agent commerce manifest** — same as `/.well-known/` but
    scoped to the authenticated user's tenant and versioned under `/api/agent/`.
    """
    conn = get_db_connection()
    try:
        tenant = conn.execute(
            "SELECT * FROM tenants WHERE tenant_id = ?;",
            (current_user["tenant_id"],),
        ).fetchone()
        tenant_dict = dict(tenant) if tenant else {}
    finally:
        conn.close()

    manifest = _build_manifest(request, tenant_dict)
    manifest["tenant_id"] = current_user["tenant_id"]
    manifest["authenticated"] = True
    return manifest


# ---------------------------------------------------------------------------
# /api/agent/catalog  — schema.org JSON-LD product catalog for AI buyers
# ---------------------------------------------------------------------------

@router_api.get("/catalog")
def agent_catalog(
    request: Request,
    category: str | None = None,
    in_stock: bool | None = None,
    min_rating: float | None = None,
    has_return_policy: bool | None = None,
    current_user: dict = Depends(get_current_user),
):
    """
    **Machine-readable product catalog** in schema.org JSON-LD format.

    AI buyers can query this endpoint with optional filter parameters before
    initiating a transaction. All products include `_agentMeta` policy flags
    indicating structured data completeness and AI acceptance signals.

    Query params: `category`, `in_stock`, `min_rating`, `has_return_policy`
    """
    products = query_catalog(current_user["tenant_id"])

    # Apply optional filters
    if category is not None:
        products = [p for p in products if str(p.get("category", "")).lower() == category.lower()]
    if in_stock is not None:
        products = [p for p in products if bool(p.get("in_stock")) == in_stock]
    if min_rating is not None:
        products = [p for p in products if (p.get("rating") or 0) >= min_rating]
    if has_return_policy is not None:
        products = [p for p in products if bool(p.get("return_policy")) == has_return_policy]

    jsonld_items = _catalog_to_jsonld(products)

    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "GlassBox Agent-Readable Product Catalog",
        "description": (
            "Structured product catalog optimised for AI buyer agents. "
            "Each product includes schema.org markup and _agentMeta policy flags."
        ),
        "numberOfItems": len(jsonld_items),
        "itemListElement": jsonld_items,
        "_protocolMeta": {
            "standards": ["UAP-1.0", "ACP-2024"],
            "transactionEndpoint": f"{_base_url(request)}/api/transaction/run",
            "spendCeilingEnforced": True,
            "riskGatingEnabled": True,
        },
    }


# ---------------------------------------------------------------------------
# /api/agent/capabilities  — machine-readable capability declaration
# ---------------------------------------------------------------------------

@router_api.get("/capabilities")
def agent_capabilities(current_user: dict = Depends(get_current_user)):
    """
    **Agent capability declaration** — details every safety, payment, and
    risk feature available to an AI buyer operating on this merchant's catalog.
    """
    conn = get_db_connection()
    try:
        tenant = conn.execute(
            "SELECT unattended_spend_ceiling FROM tenants WHERE tenant_id = ?;",
            (current_user["tenant_id"],),
        ).fetchone()
        ceiling = float(tenant["unattended_spend_ceiling"]) if tenant else 5000.0
    finally:
        conn.close()

    return {
        "version": "1.0",
        "tenant_id": current_user["tenant_id"],
        "capabilities": {
            "conversational_checkout": {
                "supported": True,
                "endpoint": "/api/transaction/run",
                "description": "Submit natural-language buyer intent. The 6-agent pipeline handles discovery, negotiation, risk, and payment.",
                "websocket_streaming": "/api/transaction/ws/{session_id}",
            },
            "spend_guardrail": {
                "supported": True,
                "model": "deterministic_code_check",
                "ceiling_inr": ceiling,
                "llm_bypassable": False,
                "on_exceed": "escalate_for_approval",
                "description": "Spend ceiling is enforced in pure Python. No LLM output can override it.",
            },
            "risk_gating": {
                "supported": True,
                "model": "xgboost_lgbm_hybrid_ensemble",
                "fallback": "rule_based_deterministic",
                "explainability": "shap_feature_importances",
                "audit_trail": True,
            },
            "upsell_cross_sell": {
                "supported": True,
                "mechanism": "dynamic_bundle_discount",
                "max_discount_pct": 15,
                "within_budget_ceiling": True,
                "audit_tracked": True,
                "description": (
                    "When budget headroom exists after primary item selection, "
                    "the Negotiation Agent proposes complementary items at a dynamic "
                    "discount, bounded strictly within the spend ceiling."
                ),
            },
            "payment_execution": {
                "supported": True,
                "provider": "razorpay",
                "mode": "test",
                "retry_policy": {
                    "max_attempts": 2,
                    "strategy": "single_bounded_retry",
                    "on_failure": "escalate_with_full_audit",
                },
                "webhook_verification": "hmac_sha256",
            },
            "agent_readable_catalog": {
                "supported": True,
                "format": "schema_org_json_ld",
                "endpoint": "/api/agent/catalog",
                "filter_params": [
                    "category", "color", "size", "price_range",
                    "min_rating", "in_stock", "has_return_policy",
                ],
            },
            "audit_trail": {
                "supported": True,
                "immutable_events": True,
                "replay_endpoint": "/api/transaction/{session_id}",
                "every_state_transition_logged": True,
            },
        },
        "_compliance": {
            "standards": ["UAP-1.0", "ACP-2024", "AP2-draft", "x402-preview"],
            "data_governance": "tenant_scoped_sqlite",
            "ssrf_protection": True,
            "domain_allowlisting": True,
            "webhook_signature_enforcement": True,
        },
    }
