"""
FastAPI authentication dependencies for RBAC and JWT token verification.
"""

from typing import Any, Callable
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.security import decode_access_token
from app.db.database import get_user_by_id

security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security_bearer),
) -> dict[str, Any]:
    """
    FastAPI dependency to extract and verify the current authenticated user from Bearer token.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    user = get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
        )

    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security_bearer),
) -> dict[str, Any] | None:
    """
    FastAPI dependency for UAP/ACP-compliant open endpoints.

    Returns the authenticated user dict if a valid Bearer token is provided.
    Returns None silently if no token is present or the token is invalid.
    Does NOT raise HTTP 401 — allows unauthenticated AI buyer agents to
    discover the product catalog and _agentMeta policy flags freely.
    """
    if not credentials or not credentials.credentials:
        return None

    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        return None

    return get_user_by_id(payload["sub"])


def require_role(allowed_roles: list[str]) -> Callable:
    """
    FastAPI dependency factory enforcing Role-Based Access Control (RBAC).
    """

    def role_checker(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role = current_user.get("role", "buyer")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role in {allowed_roles}, but found '{user_role}'.",
            )
        return current_user

    return role_checker

