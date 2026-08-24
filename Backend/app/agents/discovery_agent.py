"""Discovery Agent — multi-source, trust-gated product discovery.

Replaces the single-catalog CatalogAgent from the base spec. All trust filtering
happens in code (via SiteTrustAgent) before the LLM ever sees any data.

Modes:
  guided     — only fetches from user-named sites; halts on trust warning unless
               trust_override is already set.
  autonomous — searches pre-approved candidates; silently skips flagged sites;
               increments sites_rejected_count for transparency.

The LLM (FAST_MODEL) is used only for ranking/match justifications among items
that have ALREADY passed deterministic eligibility + trust checks.
"""

from __future__ import annotations

from typing import Any

from .groq_client import FAST_MODEL, complete_json
from .site_trust_agent import run_for_state as trust_check
from .state import TransactionState, audit_event


# ---------------------------------------------------------------------------
# Pre-approved autonomous candidate sites (UPDATE.md §3)
# Vet these before demo day. Keep small & reliable.
# ---------------------------------------------------------------------------
_PRE_APPROVED_SITES: list[str] = [
    "https://demo-store.glassbox.dev",    # pre-vetted clean mock store
    "https://shop.glassbox-demo.in",      # pre-vetted clean mock store
    "https://amaz0n-deals.com",           # deliberately planted suspicious site (§6)
]


# ---------------------------------------------------------------------------
# Mock scraper (UPDATE.md §6 — demo reliability over live scraping)
# ---------------------------------------------------------------------------
_MOCK_CATALOG: dict[str, list[dict[str, Any]]] = {
    "demo-store.glassbox.dev": [
        {
            "product_id": "DG-001",
            "source_site": "demo-store.glassbox.dev",
            "name": "RunFlex Pro Sneakers",
            "category": "shoe",
            "price": 2999.0,
            "in_stock": True,
            "sizes": ["7", "8", "9", "10", "11"],
            "color": "black",
            "review_summary": "4.4 ★ — Customers love the cushioning and durability; minor complaints about narrow fit.",
        },
        {
            "product_id": "DG-002",
            "source_site": "demo-store.glassbox.dev",
            "name": "UrbanStep Canvas Shoes",
            "category": "shoe",
            "price": 1799.0,
            "in_stock": True,
            "sizes": ["6", "7", "8", "9", "10"],
            "color": "white",
            "review_summary": "4.1 ★ — Praised for style; some note sole wear after 6 months.",
        },
        {
            "product_id": "DG-003",
            "source_site": "demo-store.glassbox.dev",
            "name": "FormalEdge Oxford Lace-Up",
            "category": "shoe",
            "price": 4200.0,
            "in_stock": False,
            "sizes": ["8", "9", "10"],
            "color": "brown",
            "review_summary": "4.7 ★ — Premium leather; excellent build quality. Currently out of stock.",
        },
        {
            "product_id": "DG-T01",
            "source_site": "demo-store.glassbox.dev",
            "name": "SlimFit Cotton Polo",
            "category": "shirt",
            "price": 899.0,
            "in_stock": True,
            "sizes": ["S", "M", "L", "XL"],
            "color": "blue",
            "review_summary": "4.3 ★ — Good fabric quality and consistent sizing.",
        },
    ],
    "shop.glassbox-demo.in": [
        {
            "product_id": "GB-101",
            "source_site": "shop.glassbox-demo.in",
            "name": "AeroLite Running Shoes",
            "category": "shoe",
            "price": 3499.0,
            "in_stock": True,
            "sizes": ["7", "8", "9", "10"],
            "color": "black",
            "review_summary": "4.6 ★ — Lightweight with excellent grip; true to size.",
        },
        {
            "product_id": "GB-102",
            "source_site": "shop.glassbox-demo.in",
            "name": "Classic Leather Loafer",
            "category": "shoe",
            "price": 2499.0,
            "in_stock": True,
            "sizes": ["7", "8", "9", "10", "11"],
            "color": "brown",
            "review_summary": "4.2 ★ — Comfortable for daily wear; slight break-in period.",
        },
        {
            "product_id": "GB-T01",
            "source_site": "shop.glassbox-demo.in",
            "name": "Premium Linen Shirt",
            "category": "shirt",
            "price": 1299.0,
            "in_stock": True,
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "color": "white",
            "review_summary": "4.5 ★ — Breathable fabric, great for summer.",
        },
    ],
    # The malicious site has no products — it fails trust before we ever reach here.
}


# ---------------------------------------------------------------------------
# Deterministic eligibility filter (same rules as the original CatalogAgent)
# ---------------------------------------------------------------------------

def _qualifies(product: dict[str, Any], intent: dict[str, Any]) -> bool:
    if not product.get("in_stock", True):
        return False
    category = intent.get("category")
    if category and str(product.get("category", "")).lower() not in {
        category.lower(), category.lower().rstrip("s")
    }:
        return False
    if intent.get("size") and intent["size"] not in {
        str(v).upper() for v in product.get("sizes", [])
    }:
        return False
    if intent.get("color") and str(product.get("color", "")).lower() != intent["color"].lower():
        return False
    return True


def _scrape_site(hostname: str) -> list[dict[str, Any]]:
    """Return mock product data for a hostname. Empty list if not pre-vetted."""
    return _MOCK_CATALOG.get(hostname, [])


def _rank_and_explain(
    candidates: list[dict[str, Any]], intent: dict[str, Any]
) -> list[dict[str, Any]]:
    """Apply deterministic sort then annotate with LLM match justifications."""
    budget = intent.get("budget_max")
    for c in candidates:
        c["structured_policy_flags"] = {
            "within_stated_budget": budget is None or float(c["price"]) <= float(budget),
            "in_stock": bool(c.get("in_stock", True)),
        }
    candidates.sort(
        key=lambda c: (
            not c["structured_policy_flags"]["within_stated_budget"],
            float(c["price"]),
        )
    )
    for c in candidates:
        phrasing = complete_json(
            model=FAST_MODEL,
            system='Write JSON: {"reason": string}. Explain a product match using only supplied facts.',
            user=str({"intent": intent, "product": c}),
        )
        c["match_reason"] = (
            phrasing.get("reason", "Matches required attributes.")
            if isinstance(phrasing, dict)
            else "Matches required attributes."
        )
    return candidates


# ---------------------------------------------------------------------------
# Guided mode
# ---------------------------------------------------------------------------

def _run_guided(state: TransactionState) -> TransactionState:
    """Guided mode: only check + scrape sites the user explicitly requested."""
    intent = state.get("intent", {})
    sites: list[str] = state.get("requested_sites") or []
    trust_override: bool = state.get("trust_override", False)
    candidates: list[dict[str, Any]] = []

    for url in sites:
        trust_result = trust_check(state, url)
        if trust_result["status"] in ("suspicious", "blocked"):
            if not trust_override:
                # Halt. Surface the warning back to the user via escalation_message.
                state["payment_status"] = "escalated"
                state["escalation_message"] = (
                    f"⚠️ This site failed a safety check: {trust_result['reason']} "
                    f"Would you like to restart with a different site, or continue anyway?\n"
                    f"Reply 'continue' to proceed (risk noted) or 'restart' to choose a different site."
                )
                audit_event(
                    state, agent="discovery",
                    decision_reason="Halted: guided-mode site failed trust check, awaiting user decision.",
                    inputs_summary={"url": url},
                    output_summary={"trust_result": trust_result},
                )
                return state
            else:
                # User explicitly overrode — proceed but flag downstream events.
                audit_event(
                    state, agent="discovery",
                    decision_reason="Proceeding after user-overrode trust warning.",
                    inputs_summary={"url": url, "trust_override": True},
                    output_summary={"trust_result": trust_result},
                )

        from urllib.parse import urlparse
        hostname = (urlparse(url).hostname or "").lower()
        raw = _scrape_site(hostname)
        candidates.extend(p for p in raw if _qualifies(p, intent))

    candidates = _rank_and_explain(candidates, intent)
    state["discovered_candidates"] = candidates
    state["catalog_candidates"] = candidates  # keeps downstream agents compatible

    audit_event(
        state, agent="discovery",
        decision_reason="Guided discovery complete: user-specified sites scraped and ranked.",
        inputs_summary={"sites": sites, "intent": intent},
        output_summary={
            "candidate_count": len(candidates),
            "candidates": [
                {"product_id": c.get("product_id"), "name": c.get("name"), "price": c.get("price"),
                 "source_site": c.get("source_site")}
                for c in candidates
            ],
        },
    )
    return state


# ---------------------------------------------------------------------------
# Autonomous mode
# ---------------------------------------------------------------------------

def _run_autonomous(state: TransactionState) -> TransactionState:
    """Autonomous mode: iterate pre-approved list, silently skip flagged sites."""
    intent = state.get("intent", {})
    rejected = 0
    candidates: list[dict[str, Any]] = []

    for url in _PRE_APPROVED_SITES:
        trust_result = trust_check(state, url)
        if trust_result["status"] in ("suspicious", "blocked"):
            rejected += 1
            # Silently skip — no user interruption in autonomous mode.
            continue

        from urllib.parse import urlparse
        hostname = (urlparse(url).hostname or "").lower()
        raw = _scrape_site(hostname)
        candidates.extend(p for p in raw if _qualifies(p, intent))

    state["sites_rejected_count"] = rejected
    candidates = _rank_and_explain(candidates, intent)
    state["discovered_candidates"] = candidates
    state["catalog_candidates"] = candidates  # keeps downstream agents compatible

    skipped_note = (
        f" ({rejected} source{'s' if rejected != 1 else ''} were skipped for failing a safety check.)"
        if rejected > 0 else ""
    )

    audit_event(
        state, agent="discovery",
        decision_reason=f"Autonomous discovery complete.{skipped_note}",
        inputs_summary={"pre_approved_sites": _PRE_APPROVED_SITES, "intent": intent},
        output_summary={
            "candidate_count": len(candidates),
            "sites_rejected_count": rejected,
            "candidates": [
                {"product_id": c.get("product_id"), "name": c.get("name"), "price": c.get("price"),
                 "source_site": c.get("source_site")}
                for c in candidates
            ],
        },
    )
    return state


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run(state: TransactionState) -> TransactionState:
    """Route to the appropriate discovery mode based on autonomy_mode."""
    mode = state.get("autonomy_mode")
    if mode == "guided":
        return _run_guided(state)
    elif mode == "autonomous":
        return _run_autonomous(state)
    else:
        # Safety fallback: treat as autonomous if mode is somehow unset.
        return _run_autonomous(state)
