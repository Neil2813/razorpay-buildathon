"""
Security Utilities for GlassBox Backend.
Includes HMAC-SHA256 Razorpay Webhook Verification, SSRF IP Protection, and Outbound Domain Allowlisting.
"""

import hashlib
import hmac
import ipaddress
import socket
from urllib.parse import urlparse

from app.core.config import settings

# Private / Internal IP ranges to block against SSRF attacks
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # Cloud metadata endpoint (AWS/GCP/Azure)
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def verify_razorpay_signature(payload_bytes: bytes, signature_header: str, webhook_secret: str) -> bool:
    """
    Verify Razorpay X-Razorpay-Signature header using HMAC-SHA256.
    Protects against unauthorized webhook forgery.
    """
    if not signature_header or not webhook_secret:
        return False

    expected_signature = hmac.new(
        key=webhook_secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_signature, signature_header)


def is_private_ip(ip_str: str) -> bool:
    """
    Check whether an IP address string falls within any blocked/private network range.
    """
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        return any(ip_obj in blocked_net for blocked_net in BLOCKED_IP_NETWORKS)
    except ValueError:
        return False


def is_ssrf_safe_url(url: str, allow_local_dev: bool = False) -> bool:
    """
    Validate an outbound URL to prevent SSRF (Server-Side Request Forgery).
    Blocks requests to private IPs, loopback, and cloud metadata endpoints (169.254.169.254).
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        # Attempt IP resolution
        try:
            ip_str = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip_str)
        except socket.gaierror:
            return False

        if allow_local_dev and (ip_obj.is_loopback or hostname in ("localhost", "127.0.0.1")):
            return True

        if is_private_ip(ip_str):
            return False

        return True
    except Exception:
        return False


def is_domain_allowed(url: str) -> bool:
    """
    Verify that an outbound URL's domain is on the explicit domain allowlist.
    Prevents data exfiltration and rogue endpoint calls.
    """
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return False

        allowed_domains = [d.lower() for d in settings.ALLOWED_OUTBOUND_DOMAINS]

        for domain in allowed_domains:
            if hostname == domain or hostname.endswith("." + domain):
                return True

        return False
    except Exception:
        return False
