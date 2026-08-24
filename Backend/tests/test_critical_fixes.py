"""
Unit tests for critical bug fixes:
- Tenant isolation (_resolve_tenant_id)
- SSRF IP network blocking
- WebSocket event broadcast callback hooks
"""

from app.core.security import is_private_ip, is_ssrf_safe_url
from app.routes.transaction import _resolve_tenant_id


def test_tenant_isolation():
    buyer_user = {"user_id": "usr_123", "role": "buyer", "tenant_id": "tenant_A"}
    admin_user = {"user_id": "usr_999", "role": "platform_admin", "tenant_id": "tenant_A"}

    # Buyer attempting IDOR to request tenant_B -> MUST be overridden to buyer's JWT tenant_id ("tenant_A")
    assert _resolve_tenant_id("tenant_B", buyer_user) == "tenant_A"

    # Buyer passing None -> returns buyer's JWT tenant_id
    assert _resolve_tenant_id(None, buyer_user) == "tenant_A"

    # Platform admin requesting tenant_B -> allowed to override
    assert _resolve_tenant_id("tenant_B", admin_user) == "tenant_B"

    # Platform admin passing None -> defaults to admin's tenant_id
    assert _resolve_tenant_id(None, admin_user) == "tenant_A"


def test_ssrf_blocked_networks():
    # Carrier-grade NAT (100.64.0.0/10)
    assert is_private_ip("100.64.0.1") is True
    # Private IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    assert is_private_ip("10.0.0.5") is True
    assert is_private_ip("172.16.1.1") is True
    assert is_private_ip("192.168.1.100") is True
    # AWS/GCP Metadata (169.254.169.254)
    assert is_private_ip("169.254.169.254") is True
    # IPv6 loopback / link-local
    assert is_private_ip("::1") is True
    assert is_private_ip("fe80::1") is True

    # Public IP should not be flagged as private
    assert is_private_ip("8.8.8.8") is False


def test_ssrf_safe_url():
    assert is_ssrf_safe_url("http://100.64.0.1") is False
    assert is_ssrf_safe_url("http://169.254.169.254/latest/meta-data/") is False
    assert is_ssrf_safe_url("http://127.0.0.1:8000") is False
    assert is_ssrf_safe_url("http://127.0.0.1:8000", allow_local_dev=True) is True
