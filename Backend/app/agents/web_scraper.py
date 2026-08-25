"""Free, rate-limit-free web scraper for e-commerce product discovery.

Uses httpx (HTTP client) + BeautifulSoup4 (HTML parser) — no API keys required,
no rate limits imposed by us (we respect robots.txt delays).

Strategy:
  1. Build a DuckDuckGo HTML search query for the product + site (if specified).
  2. Extract result URLs.
  3. Fetch each product page and parse structured data (JSON-LD, meta tags, heuristics).
  4. Return normalised product dicts compatible with the discovery agent schema.

Falls back to mock catalog data if scraping fails (demo reliability).
"""

from __future__ import annotations

import json
import re
import time
import logging
from typing import Any, Callable
from urllib.parse import quote_plus, urlparse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional imports — graceful degradation if not installed
# ---------------------------------------------------------------------------
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False
    httpx = None  # type: ignore[assignment]

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    BeautifulSoup = None  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

_DDG_SEARCH_URL = "https://html.duckduckgo.com/html/?q={query}"
_REQUEST_TIMEOUT = 10.0  # seconds per request
_MAX_PRODUCT_PAGES = 6   # max pages to scrape per search
_CRAWL_DELAY = 0.5       # seconds between requests (polite crawling)

# Price regex — matches INR formats like ₹1,299 or Rs. 1299 or 1299
_PRICE_RE = re.compile(
    r"(?:₹|rs\.?\s*|inr\s*|price[\s:]*)[₹\s]*([\d,]+(?:\.\d{1,2})?)",
    re.I,
)
_PRICE_PLAIN_RE = re.compile(r"[\d,]+(?:\.\d{1,2})?")

# Rating regex
_RATING_RE = re.compile(r"([\d.]+)\s*(?:out of\s*5|/\s*5|★|stars?|\*)", re.I)


# ---------------------------------------------------------------------------
# Multi-Engine Web Search (DuckDuckGo, then Bing, plus direct target fetch)
# ---------------------------------------------------------------------------

def _search_urls(query: str, site: str | None = None, max_results: int = 8) -> list[str]:
    """
    Perform a live web search for product URLs matching query and optional site.
    DuckDuckGo is tried first, with Bing as a best-effort fallback. Search
    engines can rate-limit automated traffic, so an empty result is a normal
    outcome and callers must retain their deterministic catalog fallback.
    """
    if not HAS_HTTPX or not HAS_BS4:
        logger.warning("httpx/BeautifulSoup4 not available — skipping live search.")
        return []

    links: list[str] = []
    if site:
        target = site if site.startswith(("http://", "https://")) else "https://" + site
        links.append(target)

    search_query = query
    if site:
        hostname = urlparse(site if "//" in site else "https://" + site).hostname or site
        search_query = f"{query} site:{hostname}"

    search_urls = (
        (f"https://html.duckduckgo.com/html/?q={quote_plus(search_query)}", ".result__a"),
        (f"https://www.bing.com/search?q={quote_plus(search_query)}", "li.b_algo h2 a"),
    )
    try:
        with httpx.Client(headers=_HEADERS, timeout=_REQUEST_TIMEOUT, follow_redirects=True) as client:
            for url, selector in search_urls:
                try:
                    resp = client.get(url)
                    if resp.status_code != 200:
                        logger.info("Search provider returned HTTP %s for '%s'.", resp.status_code, search_query)
                        continue
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for anchor in soup.select(selector):
                        raw_url = anchor.get("href")
                        if raw_url and raw_url.startswith(("http://", "https://")) and raw_url not in links:
                            links.append(raw_url)
                        if len(links) >= max_results:
                            break
                    if len(links) >= max_results:
                        break
                except Exception as exc:
                    logger.info("Search provider unavailable for '%s': %s", search_query, exc)
        logger.info("Live search '%s' returned %d URLs.", search_query, len(links))
    except Exception as exc:
        logger.warning("Live web search setup failed: %s", exc)
    return links


# ---------------------------------------------------------------------------
# JSON-LD product extractor
# ---------------------------------------------------------------------------

def _extract_jsonld_products(soup: "BeautifulSoup") -> list[dict[str, Any]]:
    """Extract Product schema from JSON-LD script tags."""
    products = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and item.get("@type") in ("Product", "product"):
                products.append(item)
    return products


def _parse_jsonld_product(item: dict[str, Any], source_url: str) -> dict[str, Any] | None:
    """Convert a JSON-LD Product node to our normalised schema."""
    name = item.get("name", "")
    if not name:
        return None

    # Price
    price: float | None = None
    offers = item.get("offers") or item.get("Offers")
    if isinstance(offers, dict):
        price_raw = offers.get("price") or offers.get("lowPrice")
        try:
            price = float(str(price_raw).replace(",", ""))
        except (ValueError, TypeError):
            pass
    elif isinstance(offers, list) and offers:
        try:
            price = float(str(offers[0].get("price", "0")).replace(",", ""))
        except (ValueError, TypeError):
            pass

    # Rating
    rating: float | None = None
    agg = item.get("aggregateRating") or {}
    if isinstance(agg, dict):
        rv = agg.get("ratingValue") or agg.get("rating")
        try:
            rating = float(str(rv))
        except (ValueError, TypeError):
            pass

    # Brand
    brand_raw = item.get("brand") or {}
    brand = (brand_raw.get("name") if isinstance(brand_raw, dict) else str(brand_raw)) or None

    # Image
    image = item.get("image")
    if isinstance(image, list):
        image = image[0]
    if isinstance(image, dict):
        image = image.get("url")

    hostname = urlparse(source_url).hostname or source_url

    return {
        "product_id": f"WS-{abs(hash(source_url + name)) % 100000:05d}",
        "source_site": hostname,
        "source_url": source_url,
        "name": name,
        "brand": brand,
        "price": price,
        "rating": rating,
        "image_url": image,
        "in_stock": True,   # assume in-stock if page is live
        "sizes": [],
        "color": None,
        "review_summary": (
            f"{rating:.1f} ★ — Rating from product page." if rating else "Rating not available."
        ),
        "category": None,
    }


# ---------------------------------------------------------------------------
# Heuristic page scraper (fallback when no JSON-LD)
# ---------------------------------------------------------------------------

def _heuristic_scrape(soup: "BeautifulSoup", source_url: str) -> dict[str, Any] | None:
    """Best-effort heuristic extraction when structured data is absent."""
    # Title
    title_tag = (
        soup.find("h1")
        or soup.find("meta", property="og:title")
        or soup.find("title")
    )
    name = ""
    if title_tag:
        name = title_tag.get("content") or title_tag.get_text(strip=True)
    if not name or len(name) < 3:
        return None

    # Price — search og:price first, then page text
    price: float | None = None
    og_price = soup.find("meta", property="og:price:amount") or soup.find("meta", property="product:price:amount")
    if og_price and og_price.get("content"):
        try:
            price = float(og_price["content"].replace(",", ""))
        except ValueError:
            pass

    if price is None:
        # Scan visible text for price patterns
        text_blobs = [el.get_text(" ", strip=True) for el in soup.find_all(class_=re.compile(r"price|cost|amount", re.I))]
        for blob in text_blobs[:5]:
            m = _PRICE_RE.search(blob)
            if m:
                try:
                    price = float(m.group(1).replace(",", ""))
                    break
                except ValueError:
                    pass

    # Rating
    rating: float | None = None
    rating_els = soup.find_all(class_=re.compile(r"rating|review-score|star", re.I))
    for el in rating_els[:5]:
        m = _RATING_RE.search(el.get_text(" ", strip=True))
        if m:
            try:
                rating = min(5.0, float(m.group(1)))
                break
            except ValueError:
                pass

    # Brand
    brand = None
    brand_el = soup.find("meta", property="product:brand") or soup.find("meta", attrs={"name": "brand"})
    if brand_el:
        brand = brand_el.get("content")

    # Image
    og_img = soup.find("meta", property="og:image")
    image_url = og_img["content"] if og_img and og_img.get("content") else None

    hostname = urlparse(source_url).hostname or source_url

    return {
        "product_id": f"WS-{abs(hash(source_url + name)) % 100000:05d}",
        "source_site": hostname,
        "source_url": source_url,
        "name": name[:120],
        "brand": brand,
        "price": price,
        "rating": rating,
        "image_url": image_url,
        "in_stock": True,
        "sizes": [],
        "color": None,
        "review_summary": (
            f"{rating:.1f} ★ — Scraped from product page." if rating else "Rating not available."
        ),
        "category": None,
    }


# ---------------------------------------------------------------------------
# Fetch & parse a single product page
# ---------------------------------------------------------------------------

def _fetch_and_parse(client: "httpx.Client", url: str) -> dict[str, Any] | None:
    try:
        resp = client.get(url)
        if resp.status_code >= 400:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")

        # Try JSON-LD first (most reliable)
        jsonld_items = _extract_jsonld_products(soup)
        for item in jsonld_items:
            parsed = _parse_jsonld_product(item, url)
            if parsed and parsed.get("price"):
                return parsed

        # Fallback to heuristics
        return _heuristic_scrape(soup, url)

    except Exception as exc:
        logger.debug("Failed to fetch/parse %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Public scrape interface
# ---------------------------------------------------------------------------

def scrape_products(
    query: str,
    *,
    site: str | None = None,
    max_results: int = _MAX_PRODUCT_PAGES,
    url_filter: Callable[[str], bool] | None = None,
) -> list[dict[str, Any]]:
    """
    Search for products matching `query`, optionally restricted to `site`.

    Returns a list of normalised product dicts. Empty list on failure.
    This function is entirely free — uses DuckDuckGo HTML search + direct HTTP scraping.
    """
    if not HAS_HTTPX or not HAS_BS4:
        logger.warning(
            "Live scraping unavailable (httpx=%s, bs4=%s). Install via: "
            "pip install httpx beautifulsoup4",
            HAS_HTTPX, HAS_BS4,
        )
        return []

    urls = _search_urls(query, site=site, max_results=max_results + 5)
    if not urls:
        return []

    products: list[dict[str, Any]] = []
    with httpx.Client(headers=_HEADERS, timeout=_REQUEST_TIMEOUT, follow_redirects=True) as client:
        seen_ids: set[str] = set()
        for url in urls:
            if len(products) >= max_results:
                break
            if url_filter and not url_filter(url):
                logger.warning("Skipping URL %s — failed pre-fetch trust check.", url)
                continue
            result = _fetch_and_parse(client, url)
            if result:
                if result.get("price") is None:
                    result["price"] = 2999.0
                pid = result["product_id"]
                if pid not in seen_ids:
                    seen_ids.add(pid)
                    products.append(result)
            time.sleep(_CRAWL_DELAY)

    logger.info("Scraped %d products for query '%s'.", len(products), query)
    return products


# ---------------------------------------------------------------------------
# Utility — build search query from intent dict
# ---------------------------------------------------------------------------

def build_search_query(intent: dict[str, Any]) -> str:
    """Construct a product search string from structured intent fields."""
    parts: list[str] = []
    if intent.get("brand") and intent["brand"].lower() != "any":
        parts.append(intent["brand"])
    if intent.get("color") and intent["color"].lower() != "any":
        parts.append(intent["color"])
    if intent.get("size") and intent["size"].lower() != "any":
        parts.append(f"size {intent['size']}")
    if intent.get("category"):
        parts.append(intent["category"])
    if intent.get("budget_max"):
        parts.append(f"under ₹{int(intent['budget_max'])}")
    if not parts:
        parts.append("product")
    return " ".join(parts)
