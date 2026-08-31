"""
Razorpay Webhook API Endpoint.
Handles incoming payment event webhooks from Razorpay with HMAC-SHA256 signature verification.
"""

from fastapi import APIRouter, Header, HTTPException, Request
from app.core.config import settings
from app.core.security import verify_razorpay_signature

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post(
    "/razorpay",
    summary="Razorpay Webhook Handler",
    description="Processes Razorpay webhook events (e.g. payment.captured, payment.failed) after HMAC-SHA256 verification.",
)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
):
    payload_bytes = await request.body()

    # 1. Mandatory HMAC-SHA256 Signature Verification
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header.")

    # 2. Parse payload first (signature is over raw bytes, so safe to parse after)
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    # 3. Multi-tenant secret resolution:
    # In a multi-merchant setup each tenant may have their own Razorpay account
    # with a unique webhook secret. Resolve it from the order notes; fall back
    # to the platform-level secret for backward compatibility.
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET

    payload_data = event.get("payload", {})
    payment_entity = payload_data.get("payment", {}).get("entity", {})
    order_notes = payment_entity.get("notes") or {}
    order_id = payment_entity.get("order_id")

    if order_id:
        # Attempt to derive the tenant from the stored transaction state
        from app.db.database import get_transaction_by_order_id, get_db_connection
        tenant_state = get_transaction_by_order_id(order_id)
        if tenant_state:
            tenant_id_from_state = tenant_state.get("tenant_id")
            if tenant_id_from_state:
                try:
                    conn = get_db_connection()
                    row = conn.execute(
                        "SELECT razorpay_key_secret FROM tenants WHERE tenant_id = ?;",
                        (tenant_id_from_state,),
                    ).fetchone()
                    conn.close()
                    if row and row["razorpay_key_secret"]:
                        webhook_secret = row["razorpay_key_secret"]
                except Exception as exc:
                    print(f"[webhook] Failed to resolve tenant secret: {exc}")

    is_valid = verify_razorpay_signature(
        payload_bytes=payload_bytes,
        signature_header=x_razorpay_signature,
        webhook_secret=webhook_secret,
    )

    if not is_valid:
        print("[webhook] INVALID signature attempt rejected.")
        raise HTTPException(status_code=401, detail="Invalid Razorpay webhook signature.")

    # 4. Extract payment details from verified payload
    event_type = event.get("event", "unknown")
    print(f"[webhook] Verified Razorpay event received: {event_type}")

    payment_id = payment_entity.get("id")
    payment_status = payment_entity.get("status")

    # 5. Idempotent backend order fulfillment for payment.captured / order.paid
    # This handles the case where the buyer's browser disconnects before calling
    # /verify-payment, leaving funds captured but the order in "pending" state.
    fulfillment_result = None
    if event_type in ("payment.captured", "order.paid") and order_id:
        try:
            from app.db.database import get_transaction_by_order_id, checkpoint_transaction
            from app.db.database import create_fulfilment_order
            from app.agents.state import audit_event

            state = get_transaction_by_order_id(order_id)
            if state and state.get("payment_status") != "success":
                chosen_prod = state.get("chosen_product") or {}
                fulfilment_info = chosen_prod.get("fulfilment") or {}

                order = create_fulfilment_order(
                    session_id=state["session_id"],
                    tenant_id=state["tenant_id"],
                    product_id=chosen_prod.get("product_id"),
                    warehouse_id=fulfilment_info.get("warehouse_id"),
                    shipping_fee=fulfilment_info.get("shipping_fee", 0.0),
                    tax_amount=fulfilment_info.get("tax_amount", 0.0),
                    total_amount=chosen_prod.get("total_amount", 0.0),
                    delivery_address=state.get("delivery_address") or {},
                    delivery_days=fulfilment_info.get("delivery_days", 3),
                )

                state["payment_status"] = "success"
                audit_event(
                    state,
                    agent="payment",
                    decision_reason=(
                        f"Razorpay webhook ({event_type}) confirmed payment capture; "
                        "order fulfilled server-side (browser-independent path)."
                    ),
                    output_summary={
                        "order_id": order_id,
                        "payment_id": payment_id,
                        "payment_verified": True,
                        "fulfillment_source": "webhook",
                        "fulfilment_order": order,
                    },
                )
                checkpoint_transaction(state, from_event_index=len(state.get("audit_log", [])) - 1)
                fulfillment_result = order
                print(f"[webhook] Backend fulfillment completed for order_id={order_id}")
            elif state and state.get("payment_status") == "success":
                print(f"[webhook] Order already fulfilled (idempotent skip): order_id={order_id}")

        except RuntimeError as exc:
            # Inventory exhausted — log and surface without crashing the webhook endpoint
            print(f"[webhook] Fulfillment failed: {exc}")
            raise HTTPException(status_code=409, detail=str(exc))
        except Exception as exc:
            print(f"[webhook] Unexpected fulfillment error: {exc}")

    return {
        "status": "success",
        "verified": True,
        "event": event_type,
        "payment_id": payment_id,
        "order_id": order_id,
        "payment_status": payment_status,
        "fulfillment_triggered": fulfillment_result is not None,
    }
