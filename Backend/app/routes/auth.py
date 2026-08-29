"""
Authentication Routes (Register, Login, Me).
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.db.database import create_user, get_user_by_email, save_address
from app.schemas.auth import AuthTokenResponse, LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Registers a buyer, merchant_admin, or platform_admin user.",
)
def register(body: RegisterRequest):
    if body.role == "buyer":
        if not body.phone or not body.address_line1 or not body.address_city or not body.address_state or not body.address_pincode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="For buyers; name, phone, delivery address and PIN code are required during registration."
            )
    elif body.role == "merchant_admin":
        if not body.company_name or not body.warehouse_line1 or not body.warehouse_city or not body.warehouse_state or not body.warehouse_pincode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Merchant registration requires company name and primary warehouse address (line1, city, state, pincode)."
            )

    existing = get_user_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    pwd_hash, salt = hash_password(body.password)

    user = create_user(
        user_id=user_id,
        email=body.email,
        password_hash=pwd_hash,
        salt=salt,
        full_name=body.full_name,
        role=body.role,
        tenant_id=body.tenant_id,
    )

    if body.role == "buyer":
        save_address(user["user_id"], {
            "label": "Registration Address",
            "recipient_name": body.full_name,
            "phone": body.phone,
            "line1": body.address_line1,
            "line2": body.address_line2,
            "city": body.address_city,
            "state": body.address_state,
            "pincode": body.address_pincode,
            "is_default": True
        })
    elif body.role == "merchant_admin":
        from app.db.database import get_db_connection
        conn = get_db_connection()
        try:
            with conn:
                # 1. Update or Insert tenant record with Razorpay credentials and company name
                conn.execute("""
                    INSERT INTO tenants (tenant_id, name, company_name, support_email, support_phone, razorpay_key_id, razorpay_key_secret)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(tenant_id) DO UPDATE SET
                        company_name = excluded.company_name,
                        support_email = excluded.support_email,
                        support_phone = excluded.support_phone,
                        razorpay_key_id = COALESCE(excluded.razorpay_key_id, tenants.razorpay_key_id),
                        razorpay_key_secret = COALESCE(excluded.razorpay_key_secret, tenants.razorpay_key_secret)
                """, (body.tenant_id, body.company_name, body.company_name, body.support_email or body.email, body.support_phone, body.razorpay_key_id, body.razorpay_key_secret))

                # 2. Insert primary warehouse
                wh_id = f"wh_{uuid.uuid4().hex[:12]}"
                conn.execute("""
                    INSERT INTO warehouses (warehouse_id, tenant_id, name, line1, city, state, pincode)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (wh_id, body.tenant_id, f"{body.company_name} Main Warehouse", body.warehouse_line1, body.warehouse_city, body.warehouse_state, body.warehouse_pincode))

                # 3. Insert default delivery zone
                cov_type = body.coverage_type or "all_india"
                cov_val = "all" if cov_type == "all_india" else (body.coverage_value or body.warehouse_city or "all")
                zone_id = f"zone_{uuid.uuid4().hex[:12]}"
                conn.execute("""
                    INSERT INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (zone_id, body.tenant_id, cov_type, cov_val, body.shipping_fee or 0.0, body.delivery_days or 3))
        finally:
            conn.close()

    token_payload = {
        "sub": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "tenant_id": user["tenant_id"],
    }
    access_token = create_access_token(token_payload)

    user_res = UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        tenant_id=user["tenant_id"],
        created_at=str(user["created_at"]),
    )

    return AuthTokenResponse(
        access_token=access_token,
        expires_in_seconds=86400 * 7,
        user=user_res,
    )


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="User Login",
    description="Authenticates user credentials and returns JWT access token.",
)
def login(body: LoginRequest):
    user = get_user_by_email(body.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    is_valid = verify_password(body.password, user["password_hash"], user["salt"])
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token_payload = {
        "sub": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "tenant_id": user["tenant_id"],
    }
    access_token = create_access_token(token_payload)

    user_res = UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        tenant_id=user["tenant_id"],
        created_at=str(user["created_at"]),
    )

    return AuthTokenResponse(
        access_token=access_token,
        expires_in_seconds=86400 * 7,
        user=user_res,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user info",
    description="Returns current authenticated user details from Bearer token.",
)
def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        tenant_id=current_user["tenant_id"],
        created_at=str(current_user["created_at"]),
    )


@router.get(
    "/oauth/{provider}",
    summary="Get OAuth Login URL",
    description="Returns redirect URL for Supabase OAuth providers (e.g. google, github).",
)
def get_oauth_url(provider: str, redirect_to: str = "http://localhost:3000/auth/callback"):
    from app.db.database import get_supabase_client
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Supabase credentials not configured in environment.",
        )
    # Generate Supabase OAuth redirect URL
    url = f"{supabase.supabase_url}/auth/v1/authorize?provider={provider}&redirect_to={redirect_to}"
    return {"provider": provider, "url": url}

