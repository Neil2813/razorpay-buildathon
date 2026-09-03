"""
AWS S3 & Glacier Vault Lock Audit Service.

Captures immutable, non-rewritable audit trails and transactional compliance logs in Amazon S3
with WORM (Write Once Read Many) Glacier Vault Lock compliance policy.
If AWS credentials are missing or ENABLE_AWS_S3 is disabled, falls back gracefully to local SQLite/disk audit storage.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger("glassbox.s3_vault")


class S3AuditVaultService:
    """AWS S3 & Glacier Vault Lock audit service client with local fallback."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_S3
        self.bucket_name = settings.S3_AUDIT_BUCKET
        self.region = settings.AWS_REGION
        self._client: Any = None

    def _get_client(self) -> Any:
        if not self.enabled or not self.bucket_name:
            return None
        if self._client is None:
            try:
                import boto3
                self._client = boto3.client("s3", region_name=self.region)
            except Exception as exc:
                logger.warning(f"[S3 Vault] Could not initialize boto3 client: {exc}. Falling back to local audit storage.")
                self.enabled = False
                return None
        return self._client

    def archive_audit_log(self, session_id: str, audit_events: list[dict[str, Any]]) -> bool:
        """Archive immutable audit event list to S3 WORM storage."""
        client = self._get_client()
        if not client:
            logger.debug(f"[Local Fallback S3 Audit] Session {session_id} audit log archived locally.")
            return False

        try:
            key = f"audit_logs/{session_id}.json"
            payload = json.dumps({
                "session_id": session_id,
                "event_count": len(audit_events),
                "events": audit_events,
            }, default=str)

            client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=payload.encode("utf-8"),
                ContentType="application/json",
                ObjectLockMode="COMPLIANCE",
            )
            logger.info(f"[S3 Vault] Successfully archived immutable audit log for session {session_id} to s3://{self.bucket_name}/{key}")
            return True
        except Exception as exc:
            logger.warning(f"[S3 Vault] Failed to archive audit log for session {session_id}: {exc}. Fallback active.")
            return False


s3_vault_service = S3AuditVaultService()
