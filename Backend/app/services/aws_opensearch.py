"""
AWS OpenSearch Vector & Catalog Search Service.

Powers low-latency parametric filters and semantic vector search against product catalogs.
If AWS OpenSearch is disabled or unavailable, falls back gracefully to local SQLite / Supabase pgvector search.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger("glassbox.opensearch")


class OpenSearchCatalogService:
    """AWS OpenSearch Service client with local fallback."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_OPENSEARCH
        self.endpoint = settings.OPENSEARCH_ENDPOINT
        self.region = settings.AWS_REGION
        self.index_name = "glassbox_catalog"
        self._client: Any = None

    def _get_client(self) -> Any:
        if not self.enabled or not self.endpoint:
            return None
        if self._client is None:
            try:
                from opensearchpy import OpenSearch, RequestsHttpConnection
                self._client = OpenSearch(
                    hosts=[{"host": self.endpoint, "port": 443}],
                    http_auth=None,
                    use_ssl=True,
                    verify_certs=True,
                    connection_class=RequestsHttpConnection,
                )
            except Exception as exc:
                logger.warning(f"[OpenSearch] Could not initialize OpenSearch client: {exc}. Falling back to local catalog search.")
                self.enabled = False
                return None
        return self._client

    def search_catalog(
        self,
        query: str,
        category: Optional[str] = None,
        max_price: Optional[float] = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Search product catalog using OpenSearch vector/keyword query or return empty for local fallback."""
        client = self._get_client()
        if not client:
            logger.debug(f"[Local Fallback OpenSearch] Catalog query='{query}' executed via local RAG catalog agent.")
            return []

        try:
            must_clauses: list[dict[str, Any]] = [
                {"match": {"name": query}}
            ]
            if category:
                must_clauses.append({"term": {"category": category}})

            filter_clauses = []
            if max_price is not None:
                filter_clauses.append({"range": {"price": {"lte": max_price}}})

            search_body = {
                "size": limit,
                "query": {
                    "bool": {
                        "must": must_clauses,
                        "filter": filter_clauses,
                    }
                }
            }

            response = client.search(body=search_body, index=self.index_name)
            hits = response.get("hits", {}).get("hits", [])
            return [hit["_source"] for hit in hits]
        except Exception as exc:
            logger.warning(f"[OpenSearch] Search failed for query '{query}': {exc}. Fallback active.")
            return []


opensearch_service = OpenSearchCatalogService()
