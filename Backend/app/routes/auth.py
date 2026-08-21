"""
Authentication Routes (Register, Login, Me).
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.db.database import create_user, get_user_by_email
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
