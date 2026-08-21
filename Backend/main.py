"""
GlassBox Risk Agent — FastAPI Service
"""

from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.ml.inference import predict_risk, get_model


# ---------------------------------------------------------------------------
# Lifespan: pre-load model on startup so first request is instant
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[startup] Pre-loading risk model...")
    try:
        get_model()
        print("[startup] Risk model loaded and ready.")
    except FileNotFoundError as e:
        print(f"[startup] WARNING: {e}")
        print("[startup] Server will start, but /api/risk/predict will return 503 until model is trained.")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="GlassBox Risk Agent API",
    description=(
        "Fraud risk scoring service powered by an XGBoost model "
        "trained on the PaySim synthetic mobile-money dataset."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
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
    risk_score: float = Field(..., description="Fraud probability (0–1)")
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    is_flagged: bool = Field(..., description="True if risk_score ≥ decision threshold")
    threshold: float = Field(..., description="Decision threshold used")
    top_features: list[FeatureContribution]
    explanation: str = Field(..., description="Human-readable risk summary")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "GlassBox Risk Agent API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.post(
    "/api/risk/predict",
    response_model=RiskPredictionResponse,
    tags=["Risk Agent"],
    summary="Predict fraud risk for a transaction",
    description=(
        "Accepts a single mobile-money transaction and returns a risk score, "
        "risk level, flagging decision, and top contributing features."
    ),
)
def predict(body: TransactionRequest):
    try:
        result = predict_risk(
            amount=body.amount,
            transaction_type=body.transaction_type,
            old_balance_orig=body.old_balance_orig,
            new_balance_orig=body.new_balance_orig,
            old_balance_dest=body.old_balance_dest,
            new_balance_dest=body.new_balance_dest,
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Model not available: {str(e)}. Run `python app/ml/train.py` first.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    return RiskPredictionResponse(**result)
