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

    is_valid = verify_razorpay_signature(
        payload_bytes=payload_bytes,
        signature_header=x_razorpay_signature,
        webhook_secret=settings.RAZORPAY_WEBHOOK_SECRET,
    )

    if not is_valid:
        print("[webhook] INVALID signature attempt rejected.")
        raise HTTPException(status_code=401, detail="Invalid Razorpay webhook signature.")

    # 2. Parse verified payload
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    event_type = event.get("event", "unknown")
    print(f"[webhook] Verified Razorpay event received: {event_type}")

    # 3. Process event safely
    payload_data = event.get("payload", {})
    payment_entity = payload_data.get("payment", {}).get("entity", {})
    payment_id = payment_entity.get("id")
    order_id = payment_entity.get("order_id")
    status = payment_entity.get("status")

    return {
        "status": "success",
        "verified": True,
        "event": event_type,
        "payment_id": payment_id,
        "order_id": order_id,
        "payment_status": status,
    }
