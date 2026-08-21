"""
Risk Assessment API Routes.
"""

from fastapi import APIRouter, HTTPException
from app.schemas.risk import TransactionRequest, RiskPredictionResponse

try:
    from app.ml.inference import predict_risk
    HAS_ML = True
except (ImportError, ModuleNotFoundError):
    HAS_ML = False
    from app.agents.risk_agent import predict_risk_fallback as predict_risk

router = APIRouter(prefix="/risk", tags=["Risk Agent"])


@router.post(
    "/predict",
    response_model=RiskPredictionResponse,
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
        # If the model file itself isn't found but ML dependencies exist, we can also fallback gracefully
        if not HAS_ML:
            raise HTTPException(
                status_code=503,
                detail=f"Model not available: {str(e)}. Run `python app/ml/train.py` first.",
            )
        # Otherwise run fallback to keep API functional
        from app.agents.risk_agent import predict_risk_fallback
        result = predict_risk_fallback(
            amount=body.amount,
            transaction_type=body.transaction_type,
            old_balance_orig=body.old_balance_orig,
            new_balance_orig=body.new_balance_orig,
            old_balance_dest=body.old_balance_dest,
            new_balance_dest=body.new_balance_dest,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    return RiskPredictionResponse(**result)
