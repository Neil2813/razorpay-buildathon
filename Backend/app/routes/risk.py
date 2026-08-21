"""
Risk Assessment API Routes with safe ML and rule-based fallback handling.
"""

from fastapi import APIRouter, HTTPException
from app.schemas.risk import TransactionRequest, RiskPredictionResponse

try:
    from app.ml.inference import predict_risk
    HAS_ML = True
except (ImportError, ModuleNotFoundError):
    HAS_ML = False
    predict_risk = None

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
    result = None
    
    # Attempt ML inference if dependencies are present
    if HAS_ML and predict_risk is not None:
        try:
            result = predict_risk(
                amount=body.amount,
                transaction_type=body.transaction_type,
                old_balance_orig=body.old_balance_orig,
                new_balance_orig=body.new_balance_orig,
                old_balance_dest=body.old_balance_dest,
                new_balance_dest=body.new_balance_dest,
            )
        except (FileNotFoundError, ImportError, ModuleNotFoundError) as e:
            print(f"[routes/risk] ML prediction failed on loading/dependencies: {e}. Using fallback.")
        except Exception as e:
            print(f"[routes/risk] ML prediction failed on runtime error: {e}. Using fallback.")

    # Fallback to rule-based risk agent logic if ML inference failed or was unavailable
    if result is None:
        try:
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
            raise HTTPException(
                status_code=500,
                detail=f"Inference and fallback both failed: {str(e)}",
            )

    return RiskPredictionResponse(**result)
