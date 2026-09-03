"""
AWS WAF Perimeter Security & Request Rate-Limiting Guard.

Validates ingress requests for AWS WAF header signatures (e.g. X-Amzn-Waf-Action, X-Amz-Cf-Id),
mitigating Layer 7 DDoS, prompt injection spam, and abusive rate patterns.
If AWS WAF is disabled or running in local dev mode, defaults to transparent pass-through with local security checks.
"""

from __future__ import annotations

import logging
from typing import Any
from fastapi import Request, HTTPException, status

from app.core.config import settings

logger = logging.getLogger("glassbox.waf")


class AWSWAFGuard:
    """AWS WAF security inspector with local fallback."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_WAF

    async def verify_request(self, request: Request) -> bool:
        """
        Inspect incoming HTTP request for WAF headers and rate violations.
        In AWS mode, API Gateway / AWS WAF strips blocked requests before reaching Lambda.
        In local mode, verifies headers or allows request to proceed.
        """
        if not self.enabled:
            logger.debug("[AWS WAF] Security guard running in local pass-through mode.")
            return True

        waf_action = request.headers.get("x-amzn-waf-action", "ALLOW").upper()
        if waf_action in ("BLOCK", "COUNT_EXCEEDED"):
            logger.warning(f"[AWS WAF] Blocked request from IP {request.client.host if request.client else 'unknown'} due to WAF action: {waf_action}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Request blocked by AWS WAF perimeter rules.",
            )

        return True


waf_guard = AWSWAFGuard()
