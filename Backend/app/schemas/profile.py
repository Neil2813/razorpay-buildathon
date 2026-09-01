"""
Pydantic Schemas for Profile API.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, example="Jane Smith")
    email: Optional[EmailStr] = Field(None, example="janesmith@example.com")
    card_number: Optional[str] = Field(None, example="4532 8920 1192 4892")
    card_holder: Optional[str] = Field(None, example="Jane Smith")
    card_expiry: Optional[str] = Field(None, example="12/28")
    card_cvv: Optional[str] = Field(None, example="882")


class TenantResponse(BaseModel):
    tenant_id: str
    name: str
    unattended_spend_ceiling: float
    created_at: str


class TenantUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, example="Apex Athletics Pro")
    unattended_spend_ceiling: Optional[float] = Field(None, ge=0, example=4500.0)
