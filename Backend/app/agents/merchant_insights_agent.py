"""Asynchronous merchant insight calculations over recorded audit events."""

from __future__ import annotations

from collections import Counter
from typing import Any, Iterable


def compute_insights(events: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Compute only traceable facts; callers may phrase them with an LLM separately."""
    rows = list(events)
    negotiations = [e for e in rows if e.get("agent") == "negotiation"]
    payments = [e for e in rows if e.get("agent") == "payment"]
    selected = [e.get("output_summary", {}).get("product_id") for e in negotiations]
    selected = [item for item in selected if item]
    successful = sum(e.get("output_summary", {}).get("payment_id") is not None for e in payments)
    escalation_reasons = Counter(e.get("decision_reason", "Unknown") for e in rows if "escalat" in e.get("decision_reason", "").lower())
    return {"transaction_event_count": len(rows), "selected_sku_counts": dict(Counter(selected)), "payment_success_count": successful, "payment_attempt_event_count": len(payments), "top_escalation_reasons": dict(escalation_reasons.most_common(3)), "sample_size_note": f"Based on {len(rows)} logged events."}
