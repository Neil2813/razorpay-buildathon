"""Bounded intent extraction. It never sets a spend guardrail."""

from __future__ import annotations

import re
from typing import Any

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
    intent = parse_intent_fallback(state["user_message"])
    state["intent"] = intent
    audit_event(state, agent="concierge", decision_reason="Parsed bounded buyer preferences.",
                inputs_summary={"message": state["user_message"]},
                output_summary={"intent": intent})
    return state
