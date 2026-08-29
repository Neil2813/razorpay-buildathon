"""
Razorpay test-mode payment gateway implementation.

Injects into the Payment Execution Agent via the PaymentGateway Protocol.
Enforces a hard-coded single-retry policy — any retry count above 2 is
rejected by the agent, not by this gateway.
"""

from __future__ import annotations

import os
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen
import base64
import json

from app.core.config import settings


class RazorpayGateway:
    """Live Razorpay test-mode gateway. Implements the PaymentGateway Protocol."""

    BASE_URL = "https://api.razorpay.com/v1"

    def __init__(self, key_id: str | None = None, key_secret: str | None = None) -> None:
        self.key_id = key_id or settings.RAZORPAY_KEY_ID
        self.key_secret = key_secret or settings.RAZORPAY_KEY_SECRET

    def _auth_header(self) -> str:
        credentials = f"{self.key_id}:{self.key_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.BASE_URL}{path}"
        body = json.dumps(payload).encode()
        req = Request(
            url,
            data=body,
            headers={
                "Authorization": self._auth_header(),
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=15) as response:
                return json.loads(response.read().decode())
        except URLError as exc:
            raise RuntimeError(f"Razorpay API error: {exc}") from exc

    def charge(
        self,
        *,
        amount: float,
        currency: str = "INR",
        receipt: str,
        idempotency_key: str,
    ) -> dict[str, Any]:
        """
        Create a Razorpay order in test mode.

        Razorpay amount is in paise (1 INR = 100 paise).
        Returns a payment order, not a successful payment.  The browser must
        complete Razorpay Checkout and the server must verify its signature.
        """
        amount_paise = int(amount * 100)
        payload = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt[:40],  # Razorpay max 40 chars
            "notes": {"idempotency_key": idempotency_key},
        }
        try:
            response = self._post("/orders", payload)
            order_id = response.get("id", "")
            rp_status = response.get("status", "")
            if order_id and rp_status in ("created", "paid"):
                return {
                    "status": "order_created",
                    "payment_id": order_id,
                    "key_id": self.key_id,
                    "reason": f"Razorpay order created in test mode. Status: {rp_status}",
                }
            return {
                "status": "failed",
                "payment_id": None,
                "reason": f"Unexpected Razorpay response: status={rp_status}",
            }
        except RuntimeError as exc:
            return {"status": "failed", "payment_id": None, "reason": str(exc)}


class MockFailGateway:
    """
    A deterministic gateway that always returns 'failed'.
    Used in the demo script (§2.5) to demonstrate graceful escalation.
    Injects controlled failure without touching live credentials.
    """

    def charge(self, *, amount: float, currency: str, receipt: str, idempotency_key: str) -> dict[str, Any]:
        return {
            "status": "failed",
            "payment_id": None,
            "reason": "Card declined (test mode — MockFailGateway always declines).",
        }


def get_gateway(*, force_fail: bool = False) -> RazorpayGateway | MockFailGateway:
    """
    Return the appropriate gateway instance.
    - If force_fail=True, returns MockFailGateway (for demo failure script).
    - If RAZORPAY_KEY_ID is a real test key, uses RazorpayGateway.
    """
    if force_fail:
        return MockFailGateway()
    return RazorpayGateway()
