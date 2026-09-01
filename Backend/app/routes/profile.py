"""
Profile and Tenant Management Routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.deps import get_current_user, require_role
from app.db.database import (
    get_tenant,
    get_user_by_email,
    update_tenant_settings,
    update_user_profile,
)
from app.schemas.auth import UserResponse
from app.schemas.profile import (
    ProfileUpdateRequest,
    TenantResponse,
    TenantUpdateRequest,
)

router = APIRouter(prefix="/profile", tags=["Profile & Tenant"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get user profile",
    description="Returns current authenticated user's profile details.",
)
def get_profile(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        tenant_id=current_user["tenant_id"],
        created_at=str(current_user["created_at"]),
        card_number=current_user.get("card_number"),
        card_holder=current_user.get("card_holder"),
        card_expiry=current_user.get("card_expiry"),
        card_cvv=current_user.get("card_cvv"),
    )


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update user profile",
    description="Updates user's name, email, or payment card details.",
)
def update_profile(
    body: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if body.email and body.email.lower() != current_user["email"].lower():
        existing = get_user_by_email(body.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )

    updated = update_user_profile(
        user_id=current_user["user_id"],
        full_name=body.full_name,
        email=body.email,
        card_number=body.card_number,
        card_holder=body.card_holder,
        card_expiry=body.card_expiry,
        card_cvv=body.card_cvv,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile.",
        )

    return UserResponse(
        user_id=updated["user_id"],
        email=updated["email"],
        full_name=updated["full_name"],
        role=updated["role"],
        tenant_id=updated["tenant_id"],
        created_at=str(updated["created_at"]),
        card_number=updated.get("card_number"),
        card_holder=updated.get("card_holder"),
        card_expiry=updated.get("card_expiry"),
        card_cvv=updated.get("card_cvv"),
    )



@router.get(
    "/tenant",
    response_model=TenantResponse,
    summary="Get current tenant settings",
    description="Returns tenant information and spend ceiling.",
)
def get_tenant_info(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    tenant = get_tenant(tenant_id)

    if not tenant:
        return TenantResponse(
            tenant_id=tenant_id,
            name=f"Tenant {tenant_id}",
            unattended_spend_ceiling=5000.0,
            created_at="",
        )

    return TenantResponse(
        tenant_id=tenant["tenant_id"],
        name=tenant["name"],
        unattended_spend_ceiling=tenant["unattended_spend_ceiling"],
        created_at=str(tenant.get("created_at", "")),
    )


@router.patch(
    "/tenant",
    response_model=TenantResponse,
    summary="Update tenant settings (Spend Ceiling)",
    description="Updates merchant spend ceiling or tenant name. Requires merchant_admin or platform_admin role.",
)
def update_tenant(
    body: TenantUpdateRequest,
    current_user: dict = Depends(require_role(["merchant_admin", "platform_admin"])),
):
    tenant_id = current_user["tenant_id"]
    updated = update_tenant_settings(
        tenant_id=tenant_id,
        name=body.name,
        unattended_spend_ceiling=body.unattended_spend_ceiling,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found.",
        )

    return TenantResponse(
        tenant_id=updated["tenant_id"],
        name=updated["name"],
        unattended_spend_ceiling=updated["unattended_spend_ceiling"],
        created_at=str(updated.get("created_at", "")),
    )
