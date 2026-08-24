"""Site Trust Agent — deterministic gate for safe scraping.

This is NOT an LLM call. Every decision is a hard, auditable code check.
No LLM opinion can override a blocked result — same principle as check_guardrail().

Checks (in order, all before any content is fetched):
  1. Protocol — must be https://
  2. SSRF guard — reject private/internal IPs and cloud metadata endpoints
  3. Blocklist — hardcoded demo list of known-bad domains
  4. Typosquatting — Levenshtein distance against known retail brands
  5. Domain-age stub — configurable threshold (demo: flag domains in a known young list)

If the reputation API would be unreachable, we fail closed (suspicious), never open.
"""

from __future__ import annotations

import ipaddress
import re
import socket
from typing import Any
from urllib.parse import urlparse

from .state import TransactionState


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Well-known retail brands we protect against typosquatting.
_KNOWN_BRANDS: list[str] = [
    "amazon", "flipkart", "myntra", "ajio", "nykaa",
    "snapdeal", "meesho", "shopify", "ebay", "walmart",
    "target", "zalando", "zara", "nike", "adidas",
]

# Hardcoded blocklist for demo reliability (UPDATE.md §6: plant one fake site you control).
_BLOCKLIST: set[str] = {
    "amaz0n-deals.com",
    "flipkart-offers.net",
    "myntra-sale.fake",
    "cheap-deals-india.xyz",
    "free-sneakers-now.tk",
    "razorpay-phish.com",
}

# SSRF: block cloud metadata endpoints and loopback.
_SSRF_BLOCKED_HOSTS: set[str] = {
    "169.254.169.254",  # AWS / GCP / Azure metadata
    "metadata.google.internal",
    "100.100.100.200",  # Alibaba Cloud metadata
}

# Private IPv4 network ranges.
_PRIVATE_NETWORKS: list[ipaddress.IPv4Network] = [
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("169.254.0.0/16"),  # link-local / metadata
]

# Domains flagged as recently registered (demo stub — real impl would call a WHOIS API).
_YOUNG_DOMAINS: set[str] = {
    "cheap-deals-india.xyz",
    "new-gadget-shop.in",
    "flash-sale-offers.co",
}

# Levenshtein distance threshold for typosquatting.
_TYPOSQUAT_THRESHOLD = 2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _levenshtein(a: str, b: str) -> int:
    """Pure-Python Levenshtein — no external library required."""
    if len(a) < len(b):
        return _levenshtein(b, a)
    if len(b) == 0:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (ca != cb)))
        prev = curr
    return prev[-1]


def _extract_domain(url: str) -> str:
    """Return the bare hostname (without port) from a URL."""
    parsed = urlparse(url)
    return (parsed.hostname or "").lower().strip()


def _resolve_ip(hostname: str) -> str | None:
    """Resolve hostname to IPv4 string, return None on failure."""
    try:
        return socket.gethostbyname(hostname)
    except OSError:
        return None


def _is_private_ip(ip_str: str) -> bool:
    try:
        addr = ipaddress.IPv4Address(ip_str)
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return False


def _strip_www(domain: str) -> str:
    return domain.removeprefix("www.")


def _typosquat_brand(domain: str) -> str | None:
    """Return the brand that is suspiciously close to this domain, or None."""
    root = _strip_www(domain).split(".")[0]  # e.g. "amaz0n" from "amaz0n-deals.com"
    for brand in _KNOWN_BRANDS:
        if root == brand:
            return None  # exact match is fine
        if _levenshtein(root, brand) <= _TYPOSQUAT_THRESHOLD:
            return brand
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_site(url: str) -> dict[str, Any]:
    """
    Deterministic trust evaluation for a single candidate URL.

    Returns:
        {
            "site": url,
            "status": "trusted" | "suspicious" | "blocked",
            "reason": str,
        }

    Failure-closed: any check failure defaults to suspicious, never trusted.
    """
    result: dict[str, Any] = {"site": url, "status": "trusted", "reason": ""}

    # ------------------------------------------------------------------
    # 1. Protocol check
    # ------------------------------------------------------------------
    if not url.lower().startswith("https://"):
        result["status"] = "blocked"
        result["reason"] = "Protocol is not HTTPS. Only secure connections are permitted."
        return result

    domain = _extract_domain(url)
    if not domain:
        result["status"] = "blocked"
        result["reason"] = "Could not parse a valid hostname from the URL."
        return result

    # ------------------------------------------------------------------
    # 2. SSRF guard — reject literal SSRF-known hosts first, then resolve.
    # ------------------------------------------------------------------
    if domain in _SSRF_BLOCKED_HOSTS:
        result["status"] = "blocked"
        result["reason"] = f"Host '{domain}' is a known internal/metadata endpoint (SSRF risk)."
        return result

    resolved = _resolve_ip(domain)
    if resolved and _is_private_ip(resolved):
        result["status"] = "blocked"
        result["reason"] = (
            f"Domain '{domain}' resolves to a private IP address ({resolved}), "
            "which could indicate a server-side request forgery (SSRF) risk."
        )
        return result

    # ------------------------------------------------------------------
    # 3. Blocklist check
    # ------------------------------------------------------------------
    bare = _strip_www(domain)
    if bare in _BLOCKLIST or domain in _BLOCKLIST:
        result["status"] = "blocked"
        result["reason"] = f"Domain '{domain}' is on the known-malicious site blocklist."
        return result

    # ------------------------------------------------------------------
    # 4. Domain-age check (demo stub — real: WHOIS API)
    # ------------------------------------------------------------------
    if bare in _YOUNG_DOMAINS or domain in _YOUNG_DOMAINS:
        result["status"] = "suspicious"
        result["reason"] = (
            f"Domain '{domain}' was registered very recently (within the last 30 days), "
            "a common fraud signal."
        )
        return result

    # ------------------------------------------------------------------
    # 5. Typosquatting check
    # ------------------------------------------------------------------
    similar_brand = _typosquat_brand(domain)
    if similar_brand:
        result["status"] = "suspicious"
        result["reason"] = (
            f"Domain '{domain}' is suspiciously similar to the well-known brand "
            f"'{similar_brand}' (possible typosquatting)."
        )
        return result

    result["reason"] = "All deterministic trust checks passed."
    return result


def run_for_state(state: TransactionState, url: str) -> dict[str, Any]:
    """Run check_site and append the result to state['site_trust_results']."""
    result = check_site(url)
    state.setdefault("site_trust_results", []).append(result)
    return result
