"""
AWS SQS & Dead Letter Queue (DLQ) Message Queue Service.

Buffers failed execution events, asynchronous telemetry, and routes exhausted retry payloads into an SQS DLQ.
If AWS SQS is disabled or unavailable, falls back gracefully to a local in-memory Queue.
"""

from __future__ import annotations

import json
import logging
import queue
from typing import Any

from app.core.config import settings

logger = logging.getLogger("glassbox.sqs")


class SQSQueueService:
    """AWS SQS & DLQ service client with local queue fallback."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_SQS
        self.queue_url = settings.SQS_QUEUE_URL
        self.dlq_url = settings.SQS_DLQ_URL
        self.region = settings.AWS_REGION
        self._client: Any = None
        self._local_queue: queue.Queue[dict[str, Any]] = queue.Queue()

    def _get_client(self) -> Any:
        if not self.enabled or not self.queue_url:
            return None
        if self._client is None:
            try:
                import boto3
                self._client = boto3.client("sqs", region_name=self.region)
            except Exception as exc:
                logger.warning(f"[SQS] Could not initialize boto3 client: {exc}. Falling back to local in-memory queue.")
                self.enabled = False
                return None
        return self._client

    def send_message(self, message_body: dict[str, Any], is_dlq: bool = False) -> bool:
        """Send message to SQS main queue or SQS Dead Letter Queue (DLQ)."""
        client = self._get_client()
        target_url = self.dlq_url if is_dlq and self.dlq_url else self.queue_url

        if not client or not target_url:
            self._local_queue.put(message_body)
            target_name = "DLQ" if is_dlq else "MainQueue"
            logger.debug(f"[Local Fallback SQS] Message added to local in-memory {target_name}.")
            return True

        try:
            client.send_message(
                QueueUrl=target_url,
                MessageBody=json.dumps(message_body, default=str),
            )
            target_name = "DLQ" if is_dlq else "Queue"
            logger.info(f"[SQS] Sent message to AWS SQS {target_name}: {target_url}")
            return True
        except Exception as exc:
            logger.warning(f"[SQS] Failed to send message to SQS: {exc}. Local queue fallback active.")
            self._local_queue.put(message_body)
            return False


sqs_service = SQSQueueService()
