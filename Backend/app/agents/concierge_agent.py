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

# Params required per mode
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
    raw = raw.strip().rstrip("/")
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
        return float(s.replace(",", ""))
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# Core intent extraction
# ---------------------------------------------------------------------------

def parse_intent_fallback(message: str) -> dict[str, Any]:
    """Reliable no-network fallback — extracts as many parameters as possible via regex."""
    text = message.strip()

    # Budget range ("between 1000 and 4000")
    budget_min: float | None = None
    budget_max: float | None = None

    range_match = _CURRENCY_RANGE_RE.search(text)
    if range_match:
        v1 = _extract_number(range_match.group(1))
        v2 = _extract_number(range_match.group(2))
        if v1 is not None and v2 is not None:
            budget_min, budget_max = sorted([v1, v2])

    if budget_max is None:
        max_match = _CURRENCY_RE.search(text)
        if max_match:
            val_str = max_match.group(1) or max_match.group(2)
            budget_max = _extract_number(val_str)

    if budget_min is None:
        floor_match = _FLOOR_RE.search(text)
        if floor_match:
            budget_min = _extract_number(floor_match.group(1))

    # Size
    size_match = _SIZE_RE.search(text)
    size = size_match.group(1).upper() if size_match else None

    # Category
    category = next(
        (word for word in ("shirt", "shoe", "shoes", "dress", "laptop", "phone", "bag", "jeans", "jacket", "trouser", "pant", "skirt", "kurta")
         if re.search(rf"\b{word}s?\b", text, re.I)),
        None,
    )

    # Colour
    colours = ("black", "white", "blue", "red", "green", "brown", "pink", "yellow", "grey", "gray", "orange", "purple", "navy", "beige")
    color = next((c for c in colours if re.search(rf"\b{c}\b", text, re.I)), None)

    # Brand
    brand_match = _BRAND_RE.search(text)
    brand = brand_match.group(1).title() if brand_match else None
    if _ANY_RE.search(text) and brand is None:
        brand = "any"

    # Rating
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
        "deadline": None,
        "needs_clarification": False,
        "clarification_reason": None,
        "missing_parameters": [],
    }


# ---------------------------------------------------------------------------
# Parameter validation
# ---------------------------------------------------------------------------

def _find_missing_params(intent: dict[str, Any], mode: str) -> list[str]:
    """Return list of parameter keys that are still unset/None."""
    required = _GUIDED_REQUIRED if mode == "guided" else _AUTONOMOUS_REQUIRED
    missing = []
    for param in required:
        val = intent.get(param)
        if val is None or val == "":
            missing.append(param)
        elif param == "requested_sites":
            # Check the state field, not intent — sites live separately
            pass  # handled in run() directly
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
    """
    If the transaction is currently blocked on a trust warning, interpret the
    latest user message as a Continue / Restart decision.
    """
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
# Clarification continuation handler
# ---------------------------------------------------------------------------

def _handle_clarification_response(state: TransactionState) -> bool:
    """
    If the agent was waiting for parameter clarification, try to extract the
    supplied answers from the new user message and merge them into existing intent.

    Returns True if this turn was a clarification response (caller should re-run validation).
    """
    intent = state.get("intent", {})
    missing = intent.get("missing_parameters", [])
    if not missing:
        return False

    # Parse the new message and merge any newly provided fields into existing intent
    new_intent = parse_intent_fallback(state["user_message"])
    changed = False
    for key in missing:
        if key == "requested_sites":
            # sites are handled separately in run()
            continue
        new_val = new_intent.get(key)
        if new_val is not None:
            intent[key] = new_val
            changed = True

    state["intent"] = intent
    return changed or bool(missing)  # always re-run validation if we were waiting


# ---------------------------------------------------------------------------
# Main run()
# ---------------------------------------------------------------------------

def run(state: TransactionState) -> TransactionState:
    """Parse intent, enforce parameter checklists, and ask for what's missing."""

    # ------------------------------------------------------------------
    # 0. Check if this is a trust-override response turn.
    # ------------------------------------------------------------------
    if _handle_trust_override_response(state):
        return state

    # ------------------------------------------------------------------
    # 1. Determine if we are continuing a clarification conversation.
    # ------------------------------------------------------------------
    is_clarification_turn = _handle_clarification_response(state)

    # ------------------------------------------------------------------
    # 2. Parse product intent (fresh or merge into existing).
    # ------------------------------------------------------------------
    if not is_clarification_turn:
        # Fresh message — full extraction
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
        intent = dict(fallback)
        if isinstance(llm_intent, dict):
            for key in ("category", "size", "color", "deadline", "brand"):
                if isinstance(llm_intent.get(key), str) or llm_intent.get(key) is None:
                    intent[key] = llm_intent.get(key)
            for key in ("budget_min", "budget_max", "min_rating"):
                candidate = llm_intent.get(key)
                if isinstance(candidate, (int, float)) and candidate >= 0:
                    intent[key] = float(candidate)
        intent["needs_clarification"] = False
        intent["missing_parameters"] = []
        state["intent"] = intent
    else:
        intent = state["intent"]

    # ------------------------------------------------------------------
    # 3. Determine autonomy_mode.
    # ------------------------------------------------------------------
    existing_mode = state.get("autonomy_mode")
    if not existing_mode:
        llm_intent_raw = None
        if not is_clarification_turn:
            llm_intent_raw = complete_json(
                model=REASONING_MODEL,
                system=(
                    "Extract ONLY the autonomy_mode from user message. "
                    "Return JSON: {\"autonomy_mode\": \"guided\" | \"autonomous\" | null}"
                ),
                user=state["user_message"],
            )
        llm_mode = llm_intent_raw.get("autonomy_mode") if isinstance(llm_intent_raw, dict) else None
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

    mode = state["autonomy_mode"]

    # ------------------------------------------------------------------
    # 4. Handle requested_sites for guided mode (merge from new message).
    # ------------------------------------------------------------------
    if mode == "guided" and not state.get("requested_sites"):
        sites: list[str] = _extract_sites_from_message(state["user_message"])
        if sites:
            state["requested_sites"] = sites

    # ------------------------------------------------------------------
    # 5. Strict parameter checklist — mode-specific.
    # ------------------------------------------------------------------
    missing_params = _find_missing_params(intent, mode)

    # For guided mode, also check requested_sites separately (not in intent dict)
    if mode == "guided" and not state.get("requested_sites"):
        if "requested_sites" not in missing_params:
            missing_params.append("requested_sites")

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
    # 6. All parameters present — proceed.
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
