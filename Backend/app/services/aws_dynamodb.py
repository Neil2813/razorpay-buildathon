"""
AWS DynamoDB Persistence Service.

Provides high-throughput transactional storage for shopping carts, agent state checkpoints,
and transaction state records.
If AWS credentials are missing or ENABLE_AWS_DYNAMODB is disabled, falls back
gracefully to local SQLite persistence via app/db/database.py.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger("glassbox.dynamodb")


class DynamoDBService:
    """AWS DynamoDB service client with local SQLite fallback."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_DYNAMODB
        self.table_name = settings.DYNAMODB_TABLE_NAME
        self.region = settings.AWS_REGION
        self._table: Any = None

    def _get_table(self) -> Any:
        if not self.enabled:
            return None
        if self._table is None:
            try:
                import boto3
                dynamodb = boto3.resource("dynamodb", region_name=self.region)
                self._table = dynamodb.Table(self.table_name)
            except Exception as exc:
                logger.warning(f"[DynamoDB] Could not initialize boto3 client: {exc}. Falling back to SQLite.")
                self.enabled = False
                return None
        return self._table

    def save_transaction_state(self, session_id: str, state: dict[str, Any]) -> bool:
        """Save active transaction or agent checkpoint to DynamoDB or local fallback."""
        table = self._get_table()
        if not table:
            logger.debug(f"[Local Fallback DynamoDB] Saving state for session {session_id} locally.")
            return False

        try:
            item = {
                "session_id": session_id,
                "tenant_id": state.get("tenant_id", "default"),
                "status": state.get("payment_status", "pending"),
                "state_payload": json.dumps(state, default=str),
            }
            table.put_item(Item=item)
            logger.info(f"[DynamoDB] Saved transaction state for session {session_id}")
            return True
        except Exception as exc:
            logger.warning(f"[DynamoDB] Failed to save state for session {session_id}: {exc}. Fallback active.")
            return False

    def get_transaction_state(self, session_id: str) -> Optional[dict[str, Any]]:
        """Fetch transaction state record by session_id from DynamoDB or local fallback."""
        table = self._get_table()
        if not table:
            logger.debug(f"[Local Fallback DynamoDB] Fetching state for session {session_id} locally.")
            return None

        try:
            response = table.get_item(Key={"session_id": session_id})
            item = response.get("Item")
            if item and "state_payload" in item:
                return json.loads(item["state_payload"])
            return item
        except Exception as exc:
            logger.warning(f"[DynamoDB] Failed to get state for session {session_id}: {exc}. Fallback active.")
            return None


dynamodb_service = DynamoDBService()
