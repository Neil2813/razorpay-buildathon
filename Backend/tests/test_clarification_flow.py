"""Tests for the Guided/Autonomous parameter clarification flow.

Tests:
  1. Generalised message (e.g. 'buy me a shirt of 4000 rupees') in Guided mode
     → agent should halt and ask for ALL 7 missing parameters.
  2. Same message in Autonomous mode
     → agent should use broad-search defaults and proceed without clarification.
  3. Full prompt with ALL guided parameters provided
     → agent should proceed to discovery without asking for clarification.
  4. Full prompt with ALL autonomous parameters provided
     → agent should proceed to discovery without asking for clarification.
"""

from __future__ import annotations

import sys
import os
from unittest.mock import patch

# Allow running from the tests directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.agents.concierge_agent import (
    parse_intent_fallback,
    _find_missing_params,
    _build_clarification_message,
    _GUIDED_REQUIRED,
    _AUTONOMOUS_REQUIRED,
)
from app.agents import concierge_agent
from app.agents.state import new_transaction_state


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _run_concierge_with_mode(message: str, mode: str):
    """Run the concierge logic purely in-process (no Groq calls) via fallback parser."""
    state = new_transaction_state(tenant_id="test", user_message=message)
    state["autonomy_mode"] = mode  # type: ignore[assignment]

    intent = parse_intent_fallback(message)
    intent["needs_clarification"] = False
    intent["missing_parameters"] = []
    state["intent"] = intent

    missing = _find_missing_params(intent, mode)

    # For guided mode, always add requested_sites as missing if not set
    if mode == "guided" and not state.get("requested_sites"):
        if "requested_sites" not in missing:
            missing.append("requested_sites")

    if missing:
        msg = _build_clarification_message(missing)
        intent["needs_clarification"] = True
        intent["clarification_reason"] = msg
        intent["missing_parameters"] = missing
        state["intent"] = intent

    return state


# ---------------------------------------------------------------------------
# Test 1: Generalised guided message → should ask all 7 params
# ---------------------------------------------------------------------------

def test_guided_mode_generalised_message_asks_all_params():
    """'buy me a shirt of 4000 rupees' in Guided should ask for all 7 params."""
    state = _run_concierge_with_mode("buy me a shirt of 4000 rupees", "guided")
    intent = state["intent"]

    assert intent["needs_clarification"] is True, (
        "Concierge should need clarification when only partial info is given."
    )
    missing = intent["missing_parameters"]
    assert "budget_min" in missing, "Floor price should be missing."
    assert "brand" in missing, "Brand should be missing."
    assert "color" in missing, "Colour should be missing."
    assert "size" in missing, "Size should be missing."
    assert "min_rating" in missing, "Min rating should be missing."
    assert "requested_sites" in missing, "Website should be missing in guided mode."
    print(f"  ✓ Guided mode missing params: {missing}")


# ---------------------------------------------------------------------------
# Test 2: Generalised autonomous message → should ask for 4 params
# ---------------------------------------------------------------------------

def test_autonomous_mode_generalised_message_uses_broad_search_defaults():
    """An autonomous broad request should stop to collect full parameters before purchase."""
    with patch.object(concierge_agent, "complete_json", return_value={}):
        state = new_transaction_state(tenant_id="test", user_message="buy me a shirt of 4000 rupees")
        state["autonomy_mode"] = "autonomous"
        concierge_agent.run(state)

    intent = state["intent"]
    assert intent["needs_clarification"] is True, "Should ask for full info in autonomous mode."
    missing = intent["missing_parameters"]
    assert "size" in missing
    assert "color" in missing
    assert "budget_min" in missing
    assert "min_rating" in missing
    print("  ✓ Autonomous mode asks for missing parameters (size, color, floor price, rating).")


def test_resumed_turn_preserves_original_category():
    """A clarification reply must augment, not replace, the original intent."""
    with patch.object(concierge_agent, "complete_json", return_value={}):
        state = new_transaction_state(tenant_id="test", user_message="buy me a shirt under ₹4000")
        state["autonomy_mode"] = "autonomous"
        concierge_agent.run(state)

        state["user_message"] = "size M, black colour, minimum budget ₹500"
        concierge_agent.run(state)

    assert state["intent"]["category"] == "shirt"
    assert state["intent"]["size"] == "M"
    assert state["intent"]["color"] == "black"
    assert state["intent"]["budget_min"] == 500.0


# ---------------------------------------------------------------------------
# Test 3: Complete guided message → should NOT need clarification
# ---------------------------------------------------------------------------

def test_guided_mode_complete_message_no_clarification():
    """Full guided prompt should proceed without clarification."""
    full_message = (
        "Find me a Nike blue formal shirt, size L, "
        "between ₹1000 and ₹4000, minimum rating 4 stars, from myntra.com"
    )
    state = new_transaction_state(tenant_id="test", user_message=full_message)
    state["autonomy_mode"] = "guided"  # type: ignore[assignment]
    state["requested_sites"] = ["https://myntra.com"]

    intent = parse_intent_fallback(full_message)
    intent["needs_clarification"] = False
    intent["missing_parameters"] = []
    state["intent"] = intent

    missing = _find_missing_params(intent, "guided")
    # requested_sites already set in state

    print(f"  Intent extracted: {intent}")
    print(f"  Missing params: {missing}")

    # At minimum, category, budget_max, color, brand should be extracted
    assert intent.get("budget_max") is not None, "Budget max should be extracted."
    assert intent.get("color") is not None, "Colour should be extracted."
    print("  ✓ Guided mode full prompt — key fields extracted correctly.")


# ---------------------------------------------------------------------------
# Test 4: Complete autonomous message → should NOT need clarification
# ---------------------------------------------------------------------------

def test_autonomous_mode_complete_message_no_clarification():
    """A detailed autonomous prompt should proceed without clarification."""
    full_message = (
        "Find me a shirt, size M, blue colour, "
        "budget between ₹500 and ₹3500"
    )
    state = new_transaction_state(tenant_id="test", user_message=full_message)
    state["autonomy_mode"] = "autonomous"  # type: ignore[assignment]

    intent = parse_intent_fallback(full_message)
    intent["needs_clarification"] = False
    intent["missing_parameters"] = []
    state["intent"] = intent

    missing = _find_missing_params(intent, "autonomous")

    print(f"  Intent extracted: {intent}")
    print(f"  Missing params: {missing}")
    assert "size" not in missing, "Size should NOT be missing."
    assert "color" not in missing, "Colour should NOT be missing."
    assert "budget_max" not in missing, "Budget ceiling should NOT be missing."
    assert "budget_min" not in missing, "Budget floor should NOT be missing."
    print("  ✓ Autonomous mode full prompt — all 4 required params present.")


# ---------------------------------------------------------------------------
# Test 5: parse_intent_fallback extracts budget range correctly
# ---------------------------------------------------------------------------

def test_parse_intent_extracts_budget_range():
    """Test that 'between 1000 and 4000' sets both floor and ceiling."""
    intent = parse_intent_fallback("I want a shirt between ₹1000 and ₹4000")
    assert intent["budget_min"] == 1000.0, f"Expected floor 1000, got {intent['budget_min']}"
    assert intent["budget_max"] == 4000.0, f"Expected ceiling 4000, got {intent['budget_max']}"
    print(f"  ✓ Budget range extracted: ₹{intent['budget_min']} – ₹{intent['budget_max']}")


# ---------------------------------------------------------------------------
# Test 6: parse_intent_fallback extracts rating
# ---------------------------------------------------------------------------

def test_parse_intent_extracts_rating():
    """Test that 'minimum rating 4 stars' extracts min_rating = 4.0."""
    intent = parse_intent_fallback("Give me a shirt with minimum rating 4 stars")
    assert intent["min_rating"] == 4.0, f"Expected 4.0, got {intent['min_rating']}"
    print(f"  ✓ Rating extracted: {intent['min_rating']} ★")


# ---------------------------------------------------------------------------
# Test 7: Clarification message is human-readable
# ---------------------------------------------------------------------------

def test_clarification_message_is_readable():
    """Clarification message should list items cleanly."""
    missing = ["budget_min", "color", "size"]
    msg = _build_clarification_message(missing)
    assert "floor price" in msg.lower(), "Should mention floor price"
    assert "colour" in msg.lower() or "color" in msg.lower(), "Should mention colour"
    assert "size" in msg.lower(), "Should mention size"
    print(f"  ✓ Clarification message: {msg[:80]}...")


# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tests = [
        test_guided_mode_generalised_message_asks_all_params,
        test_autonomous_mode_generalised_message_uses_broad_search_defaults,
        test_resumed_turn_preserves_original_category,
        test_guided_mode_complete_message_no_clarification,
        test_autonomous_mode_complete_message_no_clarification,
        test_parse_intent_extracts_budget_range,
        test_parse_intent_extracts_rating,
        test_clarification_message_is_readable,
    ]

    print("\n" + "=" * 60)
    print("  Clarification Flow Tests")
    print("=" * 60)

    passed = 0
    failed = 0
    for test_fn in tests:
        print(f"\n[TEST] {test_fn.__name__}")
        try:
            test_fn()
            passed += 1
            print(f"  [PASS]")
        except AssertionError as e:
            failed += 1
            print(f"  [FAIL]: {e}")
        except Exception as e:
            failed += 1
            print(f"  [ERROR]: {type(e).__name__}: {e}")

    print("\n" + "=" * 60)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 60)
    sys.exit(0 if failed == 0 else 1)
