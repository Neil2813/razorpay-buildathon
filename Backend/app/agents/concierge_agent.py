"""Bounded intent extraction. It never sets a spend guardrail."""

from __future__ import annotations

import re
from typing import Any

from .groq_client import REASONING_MODEL, complete_json
from .state import TransactionState, audit_event


_CURRENCY_RE = re.compile(r"(?:₹|rs\.?|inr\s*)([\d,]+(?:\.\d+)?)", re.I)
_SIZE_RE = re.compile(r"\b(?:size\s*)?(xxs|xs|s|m|l|xl|xxl|\d{1,2})\b", re.I)


def parse_intent_fallback(message: str) -> dict[str, Any]:
    """Reliable no-network fallback used if a Groq structured call is unavailable."""
    text = message.strip()
    match = _CURRENCY_RE.search(text)
    budget = float(match.group(1).replace(",", "")) if match else None
    size_match = _SIZE_RE.search(text)
    category = next((word for word in ("shirt", "shoe", "shoes", "dress", "laptop", "phone", "bag")
                     if re.search(rf"\b{word}s?\b", text, re.I)), None)
    colours = ("black", "white", "blue", "red", "green", "brown", "pink", "yellow")
    colour = next((colour for colour in colours if re.search(rf"\b{colour}\b", text, re.I)), None)
    return {
        "category": category,
        "budget_max": budget,
        "size": size_match.group(1).upper() if size_match else None,
        "color": colour,
        "deadline": None,
        "needs_clarification": budget is None,
        "clarification_reason": "Please share your maximum budget so I can find a suitable item." if budget is None else None,
    }


def run(state: TransactionState) -> TransactionState:
    fallback = parse_intent_fallback(state["user_message"])
    llm_intent = complete_json(
        model=REASONING_MODEL,
        system=("Extract buyer intent as JSON with category, budget_max, size, color, deadline, "
                "needs_clarification. Never invent a budget."),
        user=state["user_message"],
    )
    # The fallback enforces required bounds even if an LLM responds malformed.
    intent = dict(fallback)
    if isinstance(llm_intent, dict):
        for key in ("category", "size", "color", "deadline"):
            if isinstance(llm_intent.get(key), str) or llm_intent.get(key) is None:
                intent[key] = llm_intent.get(key)
        candidate_budget = llm_intent.get("budget_max")
        if isinstance(candidate_budget, (int, float)) and candidate_budget > 0:
            intent["budget_max"] = float(candidate_budget)
    intent["needs_clarification"] = intent.get("budget_max") is None
    if intent["needs_clarification"]:
        intent["clarification_reason"] = fallback["clarification_reason"]
    state["intent"] = intent
    audit_event(state, agent="concierge", decision_reason="Parsed bounded buyer preferences.",
                inputs_summary={"message": state["user_message"]},
                output_summary={"intent": intent})
    return state
