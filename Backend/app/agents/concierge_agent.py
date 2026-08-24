"""Bounded intent extraction. It never sets a spend guardrail.

UPDATE.md §2 — Concierge now also:
  1. Detects autonomy_mode (guided / autonomous) from the user message.
  2. Extracts requested_sites when in guided mode.
  3. Asks follow-up clarification questions if either piece is missing.
  4. Handles "continue" / "restart" responses after a site trust warning.

Guardrail preserved: the Concierge records only what the user said.
It never sets guardrail_ceiling or decides trust — those remain downstream code decisions.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from .groq_client import REASONING_MODEL, complete_json
from .state import TransactionState, audit_event


# ---------------------------------------------------------------------------
# Compiled regexes
# ---------------------------------------------------------------------------

_CURRENCY_RE = re.compile(
    r"(?:₹|rs\.?|inr|under|below|max|budget)\s*([\d,]+(?:\.\d+)?)"
    r"|([\d,]+(?:\.\d+)?)\s*(?:inr|rs\.?|rupees)",
    re.I,
)
_SIZE_RE = re.compile(r"\b(?:size\s*)?(xxs|xs|s|m|l|xl|xxl|\d{1,2})\b", re.I)

# Patterns that suggest the user wants guided / autonomous mode.
_GUIDED_KEYWORDS_RE = re.compile(
    r"\b(guide|guided|specific site|choose site|pick site|tell you which|let me pick|"
    r"check this site|i.ll tell you|i want to guide|which site)\b",
    re.I,
)
_AUTONOMOUS_KEYWORDS_RE = re.compile(
    r"\b(autonomous|automatic|auto|handle it|handle this|on your own|by yourself|"
    r"completely|independently|you decide|choose for me|find it yourself)\b",
    re.I,
)

# URL / site name extraction from free text.
_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?"
    r"(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}"
    r"(?:/[^\s]*)?",
    re.I,
)

# Trust-warning response patterns.
_CONTINUE_RE = re.compile(r"\b(continue|proceed|yes|ok|go ahead|allow|override|anyway)\b", re.I)
_RESTART_RE = re.compile(r"\b(restart|start over|different site|try again|no|cancel|stop)\b", re.I)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalise_url(raw: str) -> str:
    """Ensure a URL has a scheme so downstream checks work correctly."""
    raw = raw.strip().rstrip("/")
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


def parse_intent_fallback(message: str) -> dict[str, Any]:
    """Reliable no-network fallback used if a Groq structured call is unavailable."""
    text = message.strip()
    match = _CURRENCY_RE.search(text)
    budget = None
    if match:
        val_str = match.group(1) or match.group(2)
        if val_str:
            budget = float(val_str.replace(",", ""))
    size_match = _SIZE_RE.search(text)
    category = next(
        (word for word in ("shirt", "shoe", "shoes", "dress", "laptop", "phone", "bag")
         if re.search(rf"\b{word}s?\b", text, re.I)),
        None,
    )
    colours = ("black", "white", "blue", "red", "green", "brown", "pink", "yellow")
    colour = next((c for c in colours if re.search(rf"\b{c}\b", text, re.I)), None)
    return {
        "category": category,
        "budget_max": budget,
        "size": size_match.group(1).upper() if size_match else None,
        "color": colour,
        "deadline": None,
        "needs_clarification": budget is None,
        "clarification_reason": (
            "Please share your maximum budget so I can find a suitable item."
            if budget is None else None
        ),
    }


def _detect_autonomy_mode(message: str) -> str | None:
    """Return 'guided', 'autonomous', or None (unknown)."""
    if _GUIDED_KEYWORDS_RE.search(message):
        return "guided"
    if _AUTONOMOUS_KEYWORDS_RE.search(message):
        return "autonomous"
    return None


def _extract_sites_from_message(message: str) -> list[str]:
    """Pull URLs / site names out of free text."""
    raw_matches = _URL_RE.findall(message)
    return [_normalise_url(m) for m in raw_matches]


# ---------------------------------------------------------------------------
# Trust warning response handler
# ---------------------------------------------------------------------------

def _handle_trust_override_response(state: TransactionState) -> bool:
    """
    If the transaction is currently blocked on a trust warning, interpret the
    latest user message as a Continue / Restart decision.

    Returns True if this turn was consumed by trust-override handling
    (the caller should skip normal intent parsing).
    """
    if state.get("payment_status") != "escalated":
        return False
    # Only intercept if escalation was due to a trust warning.
    msg = (state.get("escalation_message") or "")
    if "safety check" not in msg:
        return False

    user_msg = state.get("user_message", "")

    if _RESTART_RE.search(user_msg):
        # Clear discovery-related state so Concierge restarts from scratch.
        state["autonomy_mode"] = None
        state["requested_sites"] = None
        state["site_trust_results"] = []
        state["payment_status"] = "pending"
        state["escalation_message"] = None
        audit_event(
            state, agent="concierge",
            decision_reason="User chose to restart after site trust warning.",
            inputs_summary={"message": user_msg},
            output_summary={"action": "restart", "autonomy_mode": None},
        )
        return True

    if _CONTINUE_RE.search(user_msg):
        state["trust_override"] = True
        state["payment_status"] = "pending"
        state["escalation_message"] = None
        audit_event(
            state, agent="concierge",
            decision_reason="User overrode site trust warning — trust_override=True recorded.",
            inputs_summary={"message": user_msg},
            output_summary={"action": "continue", "trust_override": True, "user_overrode_trust_warning": True},
        )
        return True

    # Ambiguous — re-surface the warning.
    return False


# ---------------------------------------------------------------------------
# Main run()
# ---------------------------------------------------------------------------

def run(state: TransactionState) -> TransactionState:
    """Parse intent, determine autonomy mode, and ask for missing information."""

    # ------------------------------------------------------------------
    # 0. Check if this is a trust-override response turn.
    # ------------------------------------------------------------------
    if _handle_trust_override_response(state):
        return state  # routing continues from wherever state.current_agent left off

    # ------------------------------------------------------------------
    # 1. Parse product intent (unchanged from base spec).
    # ------------------------------------------------------------------
    fallback = parse_intent_fallback(state["user_message"])
    llm_intent = complete_json(
        model=REASONING_MODEL,
        system=(
            "Extract buyer intent as JSON with keys: "
            "category, budget_max, size, color, deadline, needs_clarification, "
            "autonomy_mode (one of: guided, autonomous, or null), "
            "requested_sites (list of URLs/domain names, or null). "
            "Never invent a budget. Never set guardrail_ceiling."
        ),
        user=state["user_message"],
    )
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

    # ------------------------------------------------------------------
    # 2. Determine autonomy_mode.
    # ------------------------------------------------------------------
    # Prefer existing state value (set on a previous turn), then LLM extraction,
    # then regex keyword detection, then prompt for it.
    existing_mode = state.get("autonomy_mode")
    if not existing_mode:
        # Try LLM extraction first.
        llm_mode = llm_intent.get("autonomy_mode") if isinstance(llm_intent, dict) else None
        if llm_mode in ("guided", "autonomous"):
            state["autonomy_mode"] = llm_mode
        else:
            # Fallback: regex detection.
            detected = _detect_autonomy_mode(state["user_message"])
            if detected:
                state["autonomy_mode"] = detected
            else:
                # Must ask — surface a clarification rather than guessing.
                intent["needs_clarification"] = True
                intent["clarification_reason"] = (
                    "Do you want me to handle this completely on my own (autonomous), "
                    "or would you like to guide me — for example, by telling me which site to check? "
                    "Reply 'autonomous' to let me decide, or 'guided' to specify a site."
                )
                state["intent"] = intent
                audit_event(
                    state, agent="concierge",
                    decision_reason="Autonomy mode unknown — asking user.",
                    inputs_summary={"message": state["user_message"]},
                    output_summary={"autonomy_mode": None},
                )
                return state

    # ------------------------------------------------------------------
    # 3. If guided mode, collect requested_sites.
    # ------------------------------------------------------------------
    if state.get("autonomy_mode") == "guided" and not state.get("requested_sites"):
        # Try LLM extraction.
        llm_sites = llm_intent.get("requested_sites") if isinstance(llm_intent, dict) else None
        sites: list[str] = []
        if isinstance(llm_sites, list):
            sites = [_normalise_url(s) for s in llm_sites if isinstance(s, str)]
        if not sites:
            sites = _extract_sites_from_message(state["user_message"])
        if sites:
            state["requested_sites"] = sites
        else:
            # Must ask.
            intent["needs_clarification"] = True
            intent["clarification_reason"] = (
                "Which site(s) would you like me to check? "
                "Please share the URL or domain name (e.g. www.somestore.com)."
            )
            state["intent"] = intent
            audit_event(
                state, agent="concierge",
                decision_reason="Guided mode selected but no sites provided — asking user.",
                inputs_summary={"message": state["user_message"]},
                output_summary={"autonomy_mode": "guided", "requested_sites": None},
            )
            return state

    # ------------------------------------------------------------------
    # 4. Audit and return.
    # ------------------------------------------------------------------
    audit_event(
        state, agent="concierge",
        decision_reason="Parsed bounded buyer preferences, autonomy mode and sites confirmed.",
        inputs_summary={"message": state["user_message"]},
        output_summary={
            "intent": intent,
            "autonomy_mode": state.get("autonomy_mode"),
            "requested_sites": state.get("requested_sites"),
        },
    )
    return state
