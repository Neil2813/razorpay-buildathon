"""
AWS EventBridge Telemetry & Event Bus Service.

Publishes transaction lifecycle and AI agent execution events to AWS EventBridge.
If AWS credentials are missing or ENABLE_AWS_EVENTBRIDGE is disabled, falls back
gracefully to local SQLite/console telemetry.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger("glassbox.eventbridge")


class EventBridgePublisher:
    """AWS EventBridge client with local fallback handling."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_EVENTBRIDGE
        self.bus_name = settings.AWS_EVENTBUS_NAME
        self.region = settings.AWS_REGION
        self._client: Any = None

    def _get_client(self) -> Any:
        if not self.enabled:
            return None
        if self._client is None:
            try:
                import boto3
                self._client = boto3.client("events", region_name=self.region)
            except Exception as exc:
                logger.warning(f"[EventBridge] Could not initialize boto3 client: {exc}. Falling back to local logging.")
                self.enabled = False
                return None
        return self._client

    def publish_event(self, event_type: str, detail: dict[str, Any], source: str = "glassbox.agent") -> bool:
        """
        Publish a structured event to AWS EventBridge.
        
        Event types:
        - GlassBox.Transaction.Started
        - GlassBox.Agent.Completed
        - GlassBox.Risk.Evaluated
        - GlassBox.Payment.Verified
        - GlassBox.Audit.Logged
        """
        client = self._get_client()
        if not client:
            logger.debug(f"[Local Fallback Event] type={event_type} detail_keys={list(detail.keys())}")
            return False

        try:
            response = client.put_events(
                Entries=[
                    {
                        "Source": source,
                        "DetailType": event_type,
                        "Detail": json.dumps(detail, default=str),
                        "EventBusName": self.bus_name,
                    }
                ]
            )
            failed_count = response.get("FailedEntryCount", 0)
            if failed_count > 0:
                logger.warning(f"[EventBridge] Failed to publish event {event_type}: {response.get('Entries')}")
                return False
            logger.info(f"[EventBridge] Event published successfully: {event_type}")
            return True
        except Exception as exc:
            logger.warning(f"[EventBridge] Exception when publishing event {event_type}: {exc}. Fallback active.")
            return False


event_bridge = EventBridgePublisher()
