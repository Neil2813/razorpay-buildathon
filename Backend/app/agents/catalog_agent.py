"""Catalog retrieval with deterministic eligibility filtering."""

from __future__ import annotations

from typing import Any, Iterable

from .state import TransactionState, audit_event


def _qualifies(product: dict[str, Any], intent: dict[str, Any]) -> bool:
    if not product.get("in_stock", True):
        return False
    category = intent.get("category")
    if category and str(product.get("category", "")).lower() not in {category.lower(), category.lower().rstrip("s")}:
        return False
    if intent.get("size") and intent["size"] not in {str(value).upper() for value in product.get("sizes", [])}:
        return False
    if intent.get("color") and str(product.get("color", "")).lower() != intent["color"].lower():
        return False
    return True


def run(state: TransactionState, catalog: Iterable[dict[str, Any]]) -> TransactionState:
    intent = state["intent"]
    budget = intent.get("budget_max")
    candidates = []
    for product in catalog:
        if not _qualifies(product, intent):
            continue
        candidate = dict(product)
        price = float(candidate["price"])
        candidate["match_reason"] = "Matches required catalog attributes"
        candidate["structured_policy_flags"] = {
            "within_stated_budget": budget is None or price <= float(budget),
            "in_stock": bool(candidate.get("in_stock", True)),
        }
        candidates.append(candidate)
    # Ranking occurs only within deterministic, real catalog rows.
    candidates.sort(key=lambda item: (not item["structured_policy_flags"]["within_stated_budget"], float(item["price"])))
    state["catalog_candidates"] = candidates
    audit_event(state, agent="catalog", decision_reason="Applied stock, category, size and colour filters before ranking.",
                inputs_summary={"intent": intent}, output_summary={"candidate_count": len(candidates)})
    return state
