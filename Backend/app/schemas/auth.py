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
    phone: str | None = Field(default=None, example="9876543210")
    address_line1: str | None = Field(default=None, example="123 Main St")
    address_line2: str | None = Field(default=None, example="Apartment 4B")
    address_city: str | None = Field(default=None, example="Bengaluru")
    address_state: str | None = Field(default=None, example="Karnataka")
    address_pincode: str | None = Field(default=None, example="560001")

    # Merchant-specific details
    company_name: str | None = Field(default=None, example="Apex Store")
    support_email: str | None = Field(default=None, example="support@apex.com")
    support_phone: str | None = Field(default=None, example="080-12345678")
    warehouse_line1: str | None = Field(default=None, example="88 Commerce Park")
    warehouse_city: str | None = Field(default=None, example="Bengaluru")
    warehouse_state: str | None = Field(default=None, example="Karnataka")
    warehouse_pincode: str | None = Field(default=None, example="560001")
    coverage_type: str | None = Field(default="all_india", example="all_india")
    coverage_value: str | None = Field(default="all", example="all")
    shipping_fee: float | None = Field(default=0.0, example=50.0)
    delivery_days: int | None = Field(default=3, example=3)
    razorpay_key_id: str | None = Field(default=None, example="rzp_test_key")
    razorpay_key_secret: str | None = Field(default=None, example="secret_key")


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
