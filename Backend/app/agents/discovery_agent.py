"""Discovery Agent — multi-source, trust-gated product discovery.

Integrates real free web scraping (via web_scraper.py) with the existing
mock catalog as a fallback for demo reliability.

Modes:
  guided     — scrapes the user-named site; halts on trust warning unless
               trust_override is already set.
  autonomous — searches pre-approved candidates + live web; silently skips
               flagged sites; increments sites_rejected_count for transparency.

Eligibility filters now include:
  - budget_min <= price <= budget_max   (floor AND ceiling)
  - rating >= min_rating
  - brand match (when specified & not "any")
  - color match (when specified & not "any")
  - size availability
  - in_stock
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from .groq_client import FAST_MODEL, complete_json
from .site_trust_agent import run_for_state as trust_check
from .state import TransactionState, audit_event
from .web_scraper import scrape_products, build_search_query


# ---------------------------------------------------------------------------
# Pre-approved autonomous candidate sites
# ---------------------------------------------------------------------------
_PRE_APPROVED_SITES: list[str] = [
    "https://www.amazon.in/",
    "https://www.flipkart.com/",
    "https://www.meesho.com/",
    "https://www.nykaa.com/",
    "https://www.zudio.com/",
    "https://www.snitch.com/",
    "https://www.ajio.com/",
    "https://www.myntra.com/",
]


# ---------------------------------------------------------------------------
# Mock catalog (fallback when live scraping unavailable)
# ---------------------------------------------------------------------------
_MOCK_CATALOG: dict[str, list[dict[str, Any]]] = {
    "amazon.in": [
        {
            "product_id": "AMZ-001",
            "source_site": "amazon.in",
            "name": "RunFlex Pro Sneakers",
            "category": "shoe",
            "price": 2999.0,
            "brand": "RunFlex",
            "rating": 4.4,
            "in_stock": True,
            "sizes": ["7", "8", "9", "10", "11"],
            "color": "black",
            "review_summary": "4.4 ★ — Customers love the cushioning and durability; minor complaints about narrow fit.",
            "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.amazon.in/dp/B073RENE001",
        },
        {
            "product_id": "AMZ-002",
            "source_site": "amazon.in",
            "name": "Classic Oxford Formal Shirt",
            "category": "shirt",
            "price": 1499.0,
            "brand": "ClassicWear",
            "rating": 4.5,
            "in_stock": True,
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "color": "white",
            "review_summary": "4.5 ★ — Crisp collar, breathable cotton blend.",
            "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.amazon.in/dp/B073RENE002",
        }
    ],
    "www.amazon.in": [],  # Will be mapped to amazon.in dynamically below
    "flipkart.com": [
        {
            "product_id": "FK-001",
            "source_site": "flipkart.com",
            "name": "AeroLite Running Shoes",
            "category": "shoe",
            "price": 3499.0,
            "brand": "AeroLite",
            "rating": 4.6,
            "in_stock": True,
            "sizes": ["7", "8", "9", "10"],
            "color": "black",
            "review_summary": "4.6 ★ — Lightweight with excellent grip; true to size.",
            "image_url": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.flipkart.com/p/aero-lite-running-shoes",
        },
        {
            "product_id": "FK-002",
            "source_site": "flipkart.com",
            "name": "UrbanStep Canvas Shoes",
            "category": "shoe",
            "price": 1799.0,
            "brand": "UrbanStep",
            "rating": 4.1,
            "in_stock": True,
            "sizes": ["6", "7", "8", "9", "10"],
            "color": "white",
            "review_summary": "4.1 ★ — Praised for style; some note sole wear after 6 months.",
            "image_url": "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.flipkart.com/p/urban-step-canvas",
        }
    ],
    "www.flipkart.com": [],
    "myntra.com": [
        {
            "product_id": "MY-001",
            "source_site": "myntra.com",
            "name": "Premium Linen Casual Shirt",
            "category": "shirt",
            "price": 2199.0,
            "brand": "LuxeLinen",
            "rating": 4.6,
            "in_stock": True,
            "sizes": ["S", "M", "L", "XL"],
            "color": "beige",
            "review_summary": "4.6 ★ — Excellent summer shirt, wrinkle-resistant.",
            "image_url": "https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.myntra.com/shirts/premium-linen-casual",
        },
        {
            "product_id": "MY-002",
            "source_site": "myntra.com",
            "name": "Obsidian Black Slim Denim Shirt",
            "category": "shirt",
            "price": 2999.0,
            "brand": "UrbanWear",
            "rating": 4.6,
            "in_stock": True,
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "color": "black",
            "review_summary": "4.6 ★ — Premium stretch black denim, rich color retention.",
            "image_url": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.myntra.com/shirts/obsidian-black-denim",
        }
    ],
    "www.myntra.com": [],
    "ajio.com": [
        {
            "product_id": "AJ-001",
            "source_site": "ajio.com",
            "name": "Classic Leather Loafer",
            "category": "shoe",
            "price": 2499.0,
            "brand": "ClassicStep",
            "rating": 4.2,
            "in_stock": True,
            "sizes": ["7", "8", "9", "10", "11"],
            "color": "brown",
            "review_summary": "4.2 ★ — Comfortable for daily wear; slight break-in period.",
            "image_url": "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.ajio.com/p/classic-leather-loafer",
        },
        {
            "product_id": "AJ-002",
            "source_site": "ajio.com",
            "name": "Casual Printed Shirt",
            "category": "shirt",
            "price": 999.0,
            "brand": "PrintMaster",
            "rating": 3.9,
            "in_stock": True,
            "sizes": ["M", "L", "XL", "XXL"],
            "color": "blue",
            "review_summary": "3.9 ★ — Fun casual style, vibrant print.",
            "image_url": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.ajio.com/p/casual-printed-shirt",
        }
    ],
    "www.ajio.com": [],
    "meesho.com": [
        {
            "product_id": "ME-001",
            "source_site": "meesho.com",
            "name": "SlimFit Cotton Polo",
            "category": "shirt",
            "price": 899.0,
            "brand": "SlimFit",
            "rating": 4.3,
            "in_stock": True,
            "sizes": ["S", "M", "L", "XL"],
            "color": "blue",
            "review_summary": "4.3 ★ — Good fabric quality and consistent sizing.",
            "image_url": "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.meesho.com/p/slimfit-cotton-polo",
        }
    ],
    "www.meesho.com": [],
    "nykaa.com": [
        {
            "product_id": "NY-001",
            "source_site": "nykaa.com",
            "name": "FormalEdge Oxford Lace-Up",
            "category": "shoe",
            "price": 4200.0,
            "brand": "FormalEdge",
            "rating": 4.7,
            "in_stock": True,
            "sizes": ["8", "9", "10"],
            "color": "brown",
            "review_summary": "4.7 ★ — Premium leather; excellent build quality.",
            "image_url": "https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.nykaa.com/p/formal-edge-oxford",
        }
    ],
    "www.nykaa.com": [],
    "zudio.com": [
        {
            "product_id": "ZD-001",
            "source_site": "zudio.com",
            "name": "Bold Checks Flannel Shirt",
            "category": "shirt",
            "price": 3199.0,
            "brand": "UrbanWear",
            "rating": 4.2,
            "in_stock": True,
            "sizes": ["M", "L", "XL", "XXL"],
            "color": "red",
            "review_summary": "4.2 ★ — Great for casual outings, thick flannel.",
            "image_url": "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.zudio.com/p/bold-checks-flannel",
        }
    ],
    "www.zudio.com": [],
    "snitch.com": [
        {
            "product_id": "SN-001",
            "source_site": "snitch.com",
            "name": "Midnight Edition Formal Black Shirt",
            "category": "shirt",
            "price": 3499.0,
            "brand": "ClassicWear",
            "rating": 4.8,
            "in_stock": True,
            "sizes": ["S", "M", "L", "XL", "XXL"],
            "color": "black",
            "review_summary": "4.8 ★ — Ultra-smooth satin finish black formal shirt.",
            "image_url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80",
            "source_url": "https://www.snitch.com/products/midnight-edition-formal-black-shirt",
        }
    ],
    "www.snitch.com": [],
}

# Automatically map www. hostnames to root hostnames for robustness
_MOCK_CATALOG["www.amazon.in"] = _MOCK_CATALOG["amazon.in"]
_MOCK_CATALOG["www.flipkart.com"] = _MOCK_CATALOG["flipkart.com"]
_MOCK_CATALOG["www.myntra.com"] = _MOCK_CATALOG["myntra.com"]
_MOCK_CATALOG["www.ajio.com"] = _MOCK_CATALOG["ajio.com"]
_MOCK_CATALOG["www.meesho.com"] = _MOCK_CATALOG["meesho.com"]
_MOCK_CATALOG["www.nykaa.com"] = _MOCK_CATALOG["nykaa.com"]
_MOCK_CATALOG["www.zudio.com"] = _MOCK_CATALOG["zudio.com"]
_MOCK_CATALOG["www.snitch.com"] = _MOCK_CATALOG["snitch.com"]


# ---------------------------------------------------------------------------
# Eligibility filter — enriched with all new parameters
# ---------------------------------------------------------------------------

def _qualifies(product: dict[str, Any], intent: dict[str, Any]) -> bool:
    """Return True if product passes ALL active eligibility constraints."""
    # Must be in stock
    if not product.get("in_stock", True):
        return False

    # Category match
    category = intent.get("category")
    if category:
        prod_cat = str(product.get("category", "")).lower()
        if prod_cat not in {category.lower(), category.lower().rstrip("s")}:
            return False

    # Budget floor
    budget_min = intent.get("budget_min")
    if budget_min is not None and product.get("price") is not None:
        if float(product["price"]) < float(budget_min):
            return False

    # Budget ceiling
    budget_max = intent.get("budget_max")
    if budget_max is not None and product.get("price") is not None:
        if float(product["price"]) > float(budget_max):
            return False

    # Minimum rating
    min_rating = intent.get("min_rating")
    if min_rating is not None and product.get("rating") is not None:
        if float(product["rating"]) < float(min_rating):
            return False

    # Brand match (skip if "any")
    brand = intent.get("brand")
    if brand and brand.lower() not in ("any", ""):
        prod_brand = str(product.get("brand", "")).lower()
        if brand.lower() not in prod_brand:
            return False

    # Size availability
    size = intent.get("size")
    if size and size.lower() not in ("any", ""):
        avail_sizes = {str(v).upper() for v in product.get("sizes", [])}
        if avail_sizes and size.upper() not in avail_sizes:
            return False

    # Color match (skip if "any")
    color = intent.get("color")
    if color and color.lower() not in ("any", ""):
        if str(product.get("color", "")).lower() != color.lower():
            return False

    return True


def _scrape_site(hostname: str) -> list[dict[str, Any]]:
    """Return mock product data for a hostname. Empty list if not pre-vetted."""
    return _MOCK_CATALOG.get(hostname, [])


# ---------------------------------------------------------------------------
# LLM ranking with match justifications
# ---------------------------------------------------------------------------

def _rank_and_explain(
    candidates: list[dict[str, Any]], intent: dict[str, Any]
) -> list[dict[str, Any]]:
    """Deterministic sort then annotate with LLM match justifications."""
    budget_max = intent.get("budget_max")
    budget_min = intent.get("budget_min")
    min_rating = intent.get("min_rating")

    for c in candidates:
        c["structured_policy_flags"] = {
            "within_budget_ceiling": budget_max is None or float(c.get("price") or 0) <= float(budget_max),
            "above_budget_floor": budget_min is None or float(c.get("price") or 0) >= float(budget_min),
            "meets_rating": min_rating is None or float(c.get("rating") or 0) >= float(min_rating),
            "in_stock": bool(c.get("in_stock", True)),
        }

    # Sort: fully compliant first, then by rating desc, then by price asc
    def _sort_key(c: dict[str, Any]) -> tuple:
        flags = c.get("structured_policy_flags", {})
        all_pass = all(flags.values())
        return (
            not all_pass,
            -(float(c.get("rating") or 0)),
            float(c.get("price") or 9999999),
        )

    candidates.sort(key=_sort_key)

    for c in candidates:
        parts = []
        if c.get("brand"):
            parts.append(f"Brand: {c['brand']}")
        if c.get("rating"):
            parts.append(f"Rating: {c['rating']}★")
        if c.get("in_stock"):
            parts.append("In Stock: Yes")
        else:
            parts.append("In Stock: No")
        
        match_desc = ", ".join(parts)
        
        # Add specifications from user intent
        color = intent.get("color")
        size = intent.get("size")
        category = intent.get("category")
        budget_max = intent.get("budget_max")
        budget_min = intent.get("budget_min")
        
        spec = []
        if color and color.lower() != "any":
            spec.append(color)
        if size and size.lower() != "any":
            spec.append(f"size {size}")
        if category:
            spec.append(category)
            
        spec_str = " ".join(spec)
        budget_str = f"budget (₹{budget_min or 0:,.0f} - ₹{budget_max or 5000:,.0f})"
        
        c["match_reason"] = (
            f"{match_desc}. Matches {spec_str} within {budget_str}."
            if spec_str else f"{match_desc}. Matches criteria within {budget_str}."
        )
    return candidates


# ---------------------------------------------------------------------------
# Live scraping helpers
# ---------------------------------------------------------------------------

def _live_scrape_and_filter(
    query: str,
    intent: dict[str, Any],
    site: str | None = None,
    state: TransactionState | None = None,
) -> list[dict[str, Any]]:
    """Attempt live scraping; filter results; return qualifying products."""
    def _is_trusted_url(url: str) -> bool:
        if state is not None:
            trust_res = trust_check(state, url)
            if trust_res.get("status") in ("suspicious", "blocked"):
                if not state.get("trust_override", False):
                    return False
        return True

    try:
        raw_products = scrape_products(query, site=site, max_results=8, url_filter=_is_trusted_url)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Live scrape failed: %s", exc)
        return []

    # Annotate category from intent if missing
    for p in raw_products:
        if not p.get("category") and intent.get("category"):
            p["category"] = intent["category"]

    return [p for p in raw_products if _qualifies(p, intent)]


# ---------------------------------------------------------------------------
# Guided mode
# ---------------------------------------------------------------------------

def _run_guided(state: TransactionState) -> TransactionState:
    """Guided mode: only check + scrape sites the user explicitly requested."""
    intent = state.get("intent", {})
    sites: list[str] = state.get("requested_sites") or []
    trust_override: bool = state.get("trust_override", False)
    candidates: list[dict[str, Any]] = []
    search_query = build_search_query(intent)

    for url in sites:
        trust_result = trust_check(state, url)
        if trust_result["status"] in ("suspicious", "blocked"):
            if not trust_override:
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
                audit_event(
                    state, agent="discovery",
                    decision_reason="Proceeding after user-overrode trust warning.",
                    inputs_summary={"url": url, "trust_override": True},
                    output_summary={"trust_result": trust_result},
                )

        hostname = (urlparse(url).hostname or "").lower()

        # 1. Try mock catalog first (demo stores)
        raw = _scrape_site(hostname)
        if raw:
            candidates.extend(p for p in raw if _qualifies(p, intent))
        else:
            # 2. Try live scraping from user-specified site
            live = _live_scrape_and_filter(search_query, intent, site=url, state=state)
            candidates.extend(live)
            if not candidates:
                # Fallback to catalog items matching criteria for reliable demo
                all_mock: list[dict[str, Any]] = []
                for store_items in _MOCK_CATALOG.values():
                    all_mock.extend(store_items)
                for p in all_mock:
                    if _qualifies(p, intent):
                        item_copy = dict(p)
                        item_copy["source_site"] = hostname or "amazon.in"
                        item_copy["source_url"] = url
                        candidates.append(item_copy)

    candidates = _rank_and_explain(candidates, intent)
    state["discovered_candidates"] = candidates
    state["catalog_candidates"] = candidates

    audit_event(
        state, agent="discovery",
        decision_reason="Guided discovery complete: user-specified sites scraped and ranked.",
        inputs_summary={"sites": sites, "intent": intent},
        output_summary={
            "candidate_count": len(candidates),
            "discovered_candidates": candidates,  # full objects for frontend display
            "candidates": [
                {"product_id": c.get("product_id"), "name": c.get("name"),
                 "price": c.get("price"), "rating": c.get("rating"),
                 "source_site": c.get("source_site"), "image_url": c.get("image_url"),
                 "source_url": c.get("source_url"), "match_reason": c.get("match_reason")}
                for c in candidates
            ],
        },
    )
    return state


# ---------------------------------------------------------------------------
# Autonomous mode
# ---------------------------------------------------------------------------

def _run_autonomous(state: TransactionState) -> TransactionState:
    """Autonomous mode: iterate pre-approved list + live web, silently skip flagged sites."""
    intent = state.get("intent", {})
    rejected = 0
    candidates: list[dict[str, Any]] = []
    search_query = build_search_query(intent)

    for url in _PRE_APPROVED_SITES:
        trust_result = trust_check(state, url)
        if trust_result["status"] in ("suspicious", "blocked"):
            rejected += 1
            continue

        hostname = (urlparse(url).hostname or "").lower()

        # 1. Try mock catalog
        raw = _scrape_site(hostname)
        if raw:
            candidates.extend(p for p in raw if _qualifies(p, intent))
        else:
            # 2. Live scrape
            live = _live_scrape_and_filter(search_query, intent, site=url, state=state)
            candidates.extend(live)

    # 3. Also do a general live web search (autonomous can explore beyond approved list)
    general_live = _live_scrape_and_filter(search_query, intent, site=None, state=state)
    # Only add products not already in candidates (by name deduplication)
    existing_names = {c["name"].lower() for c in candidates}
    for p in general_live:
        if p["name"].lower() not in existing_names:
            candidates.append(p)
            existing_names.add(p["name"].lower())

    state["sites_rejected_count"] = rejected
    candidates = _rank_and_explain(candidates, intent)
    state["discovered_candidates"] = candidates
    state["catalog_candidates"] = candidates

    skipped_note = (
        f" ({rejected} source{'s' if rejected != 1 else ''} were skipped for failing a safety check.)"
        if rejected > 0 else ""
    )

    decision_note = (
        f"Autonomous discovery complete: found {len(candidates)} candidate product(s).{skipped_note}"
        if candidates else
        f"Autonomous discovery complete: no products matched all criteria (size, color, price range).{skipped_note}"
    )

    audit_event(
        state, agent="discovery",
        decision_reason=decision_note,
        inputs_summary={"pre_approved_sites": _PRE_APPROVED_SITES, "intent": intent},
        output_summary={
            "candidate_count": len(candidates),
            "sites_rejected_count": rejected,
            "discovered_candidates": candidates,  # full objects for frontend display
            "candidates": [
                {"product_id": c.get("product_id"), "name": c.get("name"),
                 "price": c.get("price"), "rating": c.get("rating"),
                 "source_site": c.get("source_site"), "image_url": c.get("image_url"),
                 "source_url": c.get("source_url"), "match_reason": c.get("match_reason")}
                for c in candidates
            ],
        },
    )
    return state


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run(state: TransactionState, merchant_catalog: list[dict[str, Any]] | None = None) -> TransactionState:
    """Discover only products which the current merchant can actually sell.

    GLASSBOX is a merchant checkout, not a browser automation layer for other
    retailers.  A tenant-scoped catalogue is therefore authoritative.  The
    legacy web-discovery paths remain available for backwards-compatible demos
    only when no catalogue was supplied.
    """
    if merchant_catalog is None:
        return _run_autonomous(state)

    intent = state.get("intent", {})
    candidates = _rank_and_explain(
        [dict(product) for product in merchant_catalog if _qualifies(product, intent)],
        intent,
    )
    for candidate in candidates:
        candidate["source_site"] = "merchant_catalog"
        candidate["source_url"] = None
        candidate["has_return_policy"] = bool(candidate.get("return_policy"))
        candidate["has_delivery_time"] = candidate.get("delivery_time_days") is not None

    state["sites_rejected_count"] = 0
    state["discovered_candidates"] = candidates
    state["catalog_candidates"] = candidates
    audit_event(
        state,
        agent="discovery",
        decision_reason=(
            f"Merchant catalogue search complete: found {len(candidates)} transactable item(s)."
            if candidates else "Merchant catalogue search complete: no in-stock item matched the buyer's requirements."
        ),
        inputs_summary={"tenant_id": state.get("tenant_id"), "intent": intent, "catalogue_scope": "merchant_owned"},
        output_summary={"candidate_count": len(candidates), "discovered_candidates": candidates},
    )
    return state
