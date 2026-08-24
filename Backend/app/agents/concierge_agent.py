"""Bounded intent extraction with strict parameter clarification.

Parameter checklists (never proceeds to discovery until ALL required params collected):

  GUIDED mode (7 params):
    1. budget_min   — floor price
    2. budget_max   — ceiling price
    3. brand        — specific brand or "any"
    4. color        — colour preference or "any"
    5. size         — clothing/shoe size
    6. min_rating   — minimum star rating (0–5)
    7. requested_sites — website(s) to check

  AUTONOMOUS mode (4 params):
    1. size
    2. color
    3. budget_max (ceiling)
    4. budget_min (floor)

Guardrail preserved: Concierge records only what the user said.
It never sets guardrail_ceiling or decides trust — those remain downstream code decisions.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from .groq_client import REASONING_MODEL, complete_json
from .state import TransactionState, audit_event


# ---------------------------------------------------------------------------
# Parameter labels for user-facing messages
# ---------------------------------------------------------------------------

_PARAM_LABELS: dict[str, str] = {
    "budget_min":      "floor price (e.g. ₹500)",
    "budget_max":      "ceiling / max price (e.g. ₹4000)",
    "brand":           "brand preference (or type 'any')",
    "color":           "colour preference (or type 'any')",
    "size":            "size (e.g. M, L, 9, 10)",
    "min_rating":      "minimum star rating out of 5 (e.g. 4)",
    "requested_sites": "website to shop from (e.g. myntra.com)",
}

_GUIDED_REQUIRED: list[str] = ["budget_min", "budget_max", "brand", "color", "size", "min_rating", "requested_sites"]
_AUTONOMOUS_REQUIRED: list[str] = ["size", "color", "budget_max", "budget_min"]


# ---------------------------------------------------------------------------
# Compiled regexes
# ---------------------------------------------------------------------------

_CURRENCY_RE = re.compile(
    r"(?:₹|rs\.?|inr|under|below|max|budget|ceiling|upto|up to)\s*(?:price|cost|amount)?\s*([\d,]+(?:\.\d+)?)"
    r"|([\d,]+(?:\.\d+)?)\s*(?:inr|rs\.?|rupees)",
    re.I,
)
_CURRENCY_RANGE_RE = re.compile(
    r"(?:between|from)\s*(?:₹|rs\.?\s*|inr\s*)?([ \d,]+)\s*(?:to|and|-)\s*(?:₹|rs\.?\s*|inr\s*)?([ \d,]+)",
    re.I,
)
_FLOOR_RE = re.compile(
    r"(?:above|over|min(?:imum)?|floor|atleast|at least|starting|from)\s*(?:price|budget|cost|amount)?\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d+)?)",
    re.I,
)
_SIZE_RE = re.compile(r"\b(?:size\s*)?(xxs|xs|s|m|l|xl|xxl|\d{1,2})\b", re.I)
_RATING_RE = re.compile(
    r"(?:min(?:imum)?\s*)?(?:rating|rated|stars?)\s*(?:of\s*)?([\d.]+)"
    r"|([\d.]+)\s*(?:star|★|rating)",
    re.I,
)
_BRAND_RE = re.compile(
    r"\b(nike|adidas|puma|reebok|levis|zara|h&m|allen solly|peter england|van heusen|"
    r"raymond|arrow|louis philippe|wrangler|gap|tommy hilfiger|calvin klein|gucci|"
    r"armani|myntra|ajio|amazon|flipkart)\b",
    re.I,
)

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

_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?"
    r"(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+"
    r"[a-zA-Z]{2,6}(?:/[^\s]*)?",
    re.I,
)

_CONTINUE_RE = re.compile(r"\b(continue|proceed|yes|ok|go ahead|allow|override|anyway)\b", re.I)
_RESTART_RE = re.compile(r"\b(restart|start over|different site|try again|no|cancel|stop)\b", re.I)

_ANY_RE = re.compile(r"\b(any|anything|no preference|doesn.t matter|don.t care|whatever)\b", re.I)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalise_url(raw: str) -> str:
    raw = raw.strip().rstrip("/.").rstrip(".")
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


def _detect_autonomy_mode(message: str) -> str | None:
    if _GUIDED_KEYWORDS_RE.search(message):
        return "guided"
    if _AUTONOMOUS_KEYWORDS_RE.search(message):
        return "autonomous"
    return None


def _extract_sites_from_message(message: str) -> list[str]:
    raw_matches = _URL_RE.findall(message)
    return [_normalise_url(m) for m in raw_matches]


def _extract_number(s: str) -> float | None:
    try:
        return float(str(s).replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# Core intent extraction
# ---------------------------------------------------------------------------

def parse_intent_fallback(message: str) -> dict[str, Any]:
    """Reliable no-network fallback — extracts as many parameters as possible via regex."""
    text = message.strip()

    budget_min: float | None = None
    budget_max: float | None = None

    floor_match = _FLOOR_RE.search(text)
    if floor_match:
        budget_min = _extract_number(floor_match.group(1))

    range_match = _CURRENCY_RANGE_RE.search(text)
    if range_match:
        v1 = _extract_number(range_match.group(1))
        v2 = _extract_number(range_match.group(2))
        if v1 is not None and v2 is not None:
            budget_min, budget_max = sorted([v1, v2])

    if budget_max is None and not floor_match:
        max_match = _CURRENCY_RE.search(text)
        if max_match:
            val_str = max_match.group(1) or max_match.group(2)
            budget_max = _extract_number(val_str)

    size_match = _SIZE_RE.search(text)
    size = size_match.group(1).upper() if size_match else None

    category = next(
        (word for word in ("shirt", "shoe", "shoes", "dress", "laptop", "phone", "bag", "jeans", "jacket", "trouser", "pant", "skirt", "kurta")
         if re.search(rf"\b{word}s?\b", text, re.I)),
        None,
    )

    colours = ("black", "white", "blue", "red", "green", "brown", "pink", "yellow", "grey", "gray", "orange", "purple", "navy", "beige")
    color = next((c for c in colours if re.search(rf"\b{c}\b", text, re.I)), None)

    brand_match = _BRAND_RE.search(text)
    brand = None
    if brand_match:
        matched_b = brand_match.group(1).title()
        # If it's a retailer platform name (amazon, flipkart, myntra, ajio) and appears in a URL or 'from/on/site' context, it's a store site, not a clothing brand
        if matched_b.lower() in ("amazon", "flipkart", "myntra", "ajio"):
            if re.search(rf"\bbrand\s*{matched_b}\b", text, re.I):
                brand = matched_b
            else:
                brand = None
        else:
            brand = matched_b

    if _ANY_RE.search(text) and brand is None:
        brand = "any"

    rating_match = _RATING_RE.search(text)
    min_rating: float | None = None
    if rating_match:
        val = rating_match.group(1) or rating_match.group(2)
        try:
            min_rating = float(val)
        except (ValueError, TypeError):
            pass

    return {
        "category": category,
        "budget_min": budget_min,
        "budget_max": budget_max,
        "brand": brand,
        "color": color,
        "size": size,
        "min_rating": min_rating,
    }


# ---------------------------------------------------------------------------
# Parameter validation
# ---------------------------------------------------------------------------

def _find_missing_params(intent: dict[str, Any], mode: str, state: TransactionState | None = None) -> list[str]:
    """Return list of parameter keys that are still unset/None."""
    required = _GUIDED_REQUIRED if mode == "guided" else _AUTONOMOUS_REQUIRED
    missing = []
    for param in required:
        if param == "requested_sites":
            has_sites = (state and state.get("requested_sites")) or intent.get("requested_sites")
            if not has_sites:
                missing.append(param)
            continue
        val = intent.get(param)
        if val is None or val == "":
            missing.append(param)
    return missing


def _build_clarification_message(missing: list[str]) -> str:
    """Build a friendly, ordered clarification prompt for the missing params."""
    if len(missing) == 1:
        label = _PARAM_LABELS.get(missing[0], missing[0])
        return f"Just one more thing — could you tell me your **{label}**?"
    lines = ["I still need a few details before I search:"]
    for i, key in enumerate(missing, 1):
        label = _PARAM_LABELS.get(key, key)
        lines.append(f"  {i}. **{label}**")
    lines.append("\nPlease reply with these details and I'll get searching right away! 🔍")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Trust warning response handler
# ---------------------------------------------------------------------------

def _handle_trust_override_response(state: TransactionState) -> bool:
    if state.get("payment_status") != "escalated":
        return False
    msg = (state.get("escalation_message") or "")
    if "safety check" not in msg:
        return False

    user_msg = state.get("user_message", "")

    if _RESTART_RE.search(user_msg):
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

    return False


# ---------------------------------------------------------------------------
# Main run()
# ---------------------------------------------------------------------------

def run(state: TransactionState) -> TransactionState:
    """Parse intent accumulatively across turns, enforce parameter checklists, and execute."""

    # ------------------------------------------------------------------
    # 0. Check if this is a trust-override response turn.
    # ------------------------------------------------------------------
    if _handle_trust_override_response(state):
        return state

    # ------------------------------------------------------------------
    # 1. Accumulate product intent non-destructively across turns.
    # ------------------------------------------------------------------
    existing_intent = dict(state.get("intent", {}))
    fallback = parse_intent_fallback(state["user_message"])

    llm_intent = complete_json(
        model=REASONING_MODEL,
        system=(
            "Extract buyer intent as JSON with keys: "
            "category, budget_min (floor price as number or null), "
            "budget_max (ceiling price as number or null), "
            "brand (string or null), color (string or null), "
            "size (string or null), min_rating (float 0-5 or null), "
            "deadline (string or null), "
            "autonomy_mode (one of: guided, autonomous, or null), "
            "requested_sites (list of URLs/domain names, or null). "
            "If a single price is given (e.g. 'shirt of 4000 rupees'), set budget_max to that value and budget_min to null. "
            "Never invent a budget. Never set guardrail_ceiling."
        ),
        user=state["user_message"],
    )

    # Merge fallback regex extraction non-destructively
    for key in ("category", "size", "color", "brand", "min_rating"):
        val = fallback.get(key)
        if val is not None:
            existing_intent[key] = val

    if fallback.get("budget_min") is not None:
        existing_intent["budget_min"] = fallback["budget_min"]
    if fallback.get("budget_max") is not None and "minimum budget" not in state["user_message"].lower() and "floor" not in state["user_message"].lower():
        existing_intent["budget_max"] = fallback["budget_max"]

    # Merge LLM extraction non-destructively
    if isinstance(llm_intent, dict):
        for key in ("category", "size", "color", "brand"):
            cand = llm_intent.get(key)
            if isinstance(cand, str) and cand.strip() and cand.lower() != "null":
                existing_intent[key] = cand
        if isinstance(llm_intent.get("budget_min"), (int, float)) and llm_intent["budget_min"] >= 0:
            existing_intent["budget_min"] = float(llm_intent["budget_min"])
        if isinstance(llm_intent.get("budget_max"), (int, float)) and llm_intent["budget_max"] >= 0:
            # Don't overwrite existing budget_max if user explicitly specified floor/minimum budget in this message
            if not (existing_intent.get("budget_max") and ("minimum budget" in state["user_message"].lower() or "floor" in state["user_message"].lower() or "above" in state["user_message"].lower())):
                existing_intent["budget_max"] = float(llm_intent["budget_max"])
        if isinstance(llm_intent.get("min_rating"), (int, float)) and llm_intent["min_rating"] >= 0:
            existing_intent["min_rating"] = float(llm_intent["min_rating"])

    intent = existing_intent
    intent["needs_clarification"] = False
    intent["missing_parameters"] = []
    state["intent"] = intent

    # ------------------------------------------------------------------
    # 2. Determine autonomy_mode.
    # ------------------------------------------------------------------
    existing_mode = state.get("autonomy_mode")
    if not existing_mode:
        llm_mode = llm_intent.get("autonomy_mode") if isinstance(llm_intent, dict) else None
        if llm_mode in ("guided", "autonomous"):
            state["autonomy_mode"] = llm_mode
        else:
            detected = _detect_autonomy_mode(state["user_message"])
            if detected:
                state["autonomy_mode"] = detected
            else:
                intent["needs_clarification"] = True
                intent["clarification_reason"] = (
                    "Would you like to run in **Autonomous Mode** (let me find & buy automatically) "
                    "or **Guided Mode** (tell me which site to check)? "
                    "Please select your preferred mode below."
                )
                intent["missing_parameters"] = ["autonomy_mode"]
                state["intent"] = intent
                audit_event(
                    state, agent="concierge",
                    decision_reason="Autonomy mode unknown — asking user to choose mode.",
                    inputs_summary={"message": state["user_message"]},
                    output_summary={"missing_parameters": ["autonomy_mode"], "autonomy_mode": None},
                )
                return state

    mode = state.get("autonomy_mode", "autonomous")

    # ------------------------------------------------------------------
    # 3. Handle requested_sites for guided mode (merge from new message or state).
    # ------------------------------------------------------------------
    if mode == "guided":
        if not state.get("requested_sites"):
            sites: list[str] = _extract_sites_from_message(state["user_message"])
            if not sites and isinstance(llm_intent, dict) and isinstance(llm_intent.get("requested_sites"), list):
                sites = [_normalise_url(s) for s in llm_intent["requested_sites"] if isinstance(s, str)]
            if sites:
                state["requested_sites"] = sites
        if state.get("requested_sites"):
            intent["requested_sites"] = state["requested_sites"]

    # If size, budget_min, and budget_max are provided, default optional parameters (color, brand) to "any"
    if intent.get("size") and intent.get("budget_min") is not None and intent.get("budget_max") is not None:
        if not intent.get("color"):
            intent["color"] = "any"
        if not intent.get("brand"):
            intent["brand"] = "any"

    missing_params = _find_missing_params(intent, mode, state=state)

    if missing_params:
        clarification_msg = _build_clarification_message(missing_params)
        intent["needs_clarification"] = True
        intent["clarification_reason"] = clarification_msg
        intent["missing_parameters"] = missing_params
        state["intent"] = intent

        audit_event(
            state, agent="concierge",
            decision_reason=f"Missing required parameters for {mode} mode — asking user.",
            inputs_summary={"message": state["user_message"], "mode": mode},
            output_summary={
                "missing_parameters": missing_params,
                "clarification": clarification_msg,
                "intent_so_far": {
                    k: intent.get(k)
                    for k in ("category", "budget_min", "budget_max", "brand", "color", "size", "min_rating")
                },
            },
        )
        return state

    # ------------------------------------------------------------------
    # 5. All parameters present — proceed to discovery.
    # ------------------------------------------------------------------
    intent["needs_clarification"] = False
    intent["clarification_reason"] = None
    intent["missing_parameters"] = []
    state["intent"] = intent

    audit_event(
        state, agent="concierge",
        decision_reason="All required parameters collected — proceeding to discovery.",
        inputs_summary={"message": state["user_message"]},
        output_summary={
            "intent": {
                k: intent.get(k)
                for k in ("category", "budget_min", "budget_max", "brand", "color", "size", "min_rating")
            },
            "autonomy_mode": mode,
            "requested_sites": state.get("requested_sites"),
        },
    )
    return state
