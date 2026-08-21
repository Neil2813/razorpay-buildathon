"""
Risk Assessment API Routes.
"""

from fastapi import APIRouter, HTTPException
from app.ml.inference import predict_risk
from app.schemas.risk import TransactionRequest, RiskPredictionResponse

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
        raise HTTPException(
            status_code=503,
            detail=f"Model not available: {str(e)}. Run `python app/ml/train.py` first.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    return RiskPredictionResponse(**result)
