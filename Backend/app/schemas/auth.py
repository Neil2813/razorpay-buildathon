"""
Pydantic Schemas for Auth API.
"""

from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., example="user@example.com")
    password: str = Field(..., min_length=6, example="secret123")
    full_name: str = Field(..., example="Jane Doe")
    role: Literal["buyer", "merchant_admin", "platform_admin"] = Field(default="buyer")
    tenant_id: str = Field(default="demo_tenant", example="demo_tenant")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., example="user@example.com")
    password: str = Field(..., example="secret123")


class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    tenant_id: str
    created_at: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserResponse
