"""
AWS ElastiCache (Redis / DAX) Session Cache Service.

Provides sub-millisecond session state caching to reduce p99 turn latencies for conversational agents.
If AWS ElastiCache is disabled or unavailable, falls back gracefully to an in-memory dictionary cache.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger("glassbox.elasticache")


class ElastiCacheSessionService:
    """AWS ElastiCache (Redis) session service client with local in-memory fallback."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_ELASTICACHE
        self.redis_url = settings.ELASTICACHE_REDIS_URL
        self._client: Any = None
        self._local_cache: dict[str, Any] = {}

    def _get_client(self) -> Any:
        if not self.enabled or not self.redis_url:
            return None
        if self._client is None:
            try:
                import redis
                self._client = redis.Redis.from_url(self.redis_url, decode_responses=True)
            except Exception as exc:
                logger.warning(f"[ElastiCache] Could not initialize Redis client: {exc}. Falling back to local memory cache.")
                self.enabled = False
                return None
        return self._client

    def set_session(self, session_id: str, data: dict[str, Any], ttl_seconds: int = 3600) -> bool:
        """Set session state in ElastiCache Redis or local memory fallback."""
        client = self._get_client()
        if not client:
            self._local_cache[session_id] = data
            logger.debug(f"[Local Fallback ElastiCache] Session {session_id} cached in memory.")
            return True

        try:
            client.setex(name=f"gb:session:{session_id}", time=ttl_seconds, value=json.dumps(data, default=str))
            return True
        except Exception as exc:
            logger.warning(f"[ElastiCache] Failed to set session {session_id}: {exc}. Fallback active.")
            self._local_cache[session_id] = data
            return False

    def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        """Get session state from ElastiCache Redis or local memory fallback."""
        client = self._get_client()
        if not client:
            return self._local_cache.get(session_id)

        try:
            val = client.get(f"gb:session:{session_id}")
            if val:
                return json.loads(val)
            return None
        except Exception as exc:
            logger.warning(f"[ElastiCache] Failed to get session {session_id}: {exc}. Fallback active.")
            return self._local_cache.get(session_id)


elasticache_service = ElastiCacheSessionService()
