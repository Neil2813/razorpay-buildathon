"""
Pydantic Schemas for Risk Assessment API.
"""

from typing import Literal
from pydantic import BaseModel, Field


class TransactionRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount (must be > 0)", example=50000.0)
    transaction_type: Literal["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"] = Field(
        ..., alias="type", description="Transaction type", example="TRANSFER"
    )
    old_balance_orig: float = Field(..., ge=0, description="Sender's balance before transaction", example=70000.0)
    new_balance_orig: float = Field(..., ge=0, description="Sender's balance after transaction", example=0.0)
    old_balance_dest: float = Field(..., ge=0, description="Recipient's balance before transaction", example=0.0)
    new_balance_dest: float = Field(..., ge=0, description="Recipient's balance after transaction", example=50000.0)

    model_config = {"populate_by_name": True}


class FeatureContribution(BaseModel):
    feature: str
    label: str
    importance: float
    value: float


class RiskPredictionResponse(BaseModel):
    risk_score: float = Field(..., description="Fraud probability (0-1)")
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    is_flagged: bool = Field(..., description="True if risk_score >= decision threshold")
    threshold: float = Field(..., description="Decision threshold used")
    top_features: list[FeatureContribution]
    explanation: str = Field(..., description="Human-readable risk summary")
