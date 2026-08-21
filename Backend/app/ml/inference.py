"""
inference.py -- GlassBox Hybrid Risk Agent Inference Engine
Loads the trained XGBoost+LightGBM ensemble from disk (once, at import time)
and exposes predict_risk() -- zero re-training, zero network dependency.
"""

import os
from typing import Literal
import numpy as np
import pandas as pd
import joblib

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH    = os.path.join(BASE_DIR, "app", "model", "hybrid_model.joblib")
THRESHOLD_PATH = os.path.join(BASE_DIR, "app", "model", "threshold.txt")

# ---------------------------------------------------------------------------
# Feature schema -- must match train.py exactly
# ---------------------------------------------------------------------------
BASE_FEATURES = [
    "amount", "oldbalanceOrg", "newbalanceOrig",
    "oldbalanceDest", "newbalanceDest",
    "balance_delta_orig", "balance_delta_dest",
    "amount_to_balance_ratio", "orig_balance_wiped",
    "dest_balance_was_zero", "step_hour", "dest_is_merchant",
]
TYPE_COLUMNS = [
    "type_CASH_IN", "type_CASH_OUT", "type_DEBIT",
    "type_PAYMENT", "type_TRANSFER",
]
ALL_FEATURES = BASE_FEATURES + TYPE_COLUMNS

# ---------------------------------------------------------------------------
# Human-readable feature labels (surfaced in API response for explainability)
# ---------------------------------------------------------------------------
FEATURE_LABELS = {
    "amount":                  "Transaction amount",
    "oldbalanceOrg":           "Sender balance before",
    "newbalanceOrig":          "Sender balance after",
    "oldbalanceDest":          "Recipient balance before",
    "newbalanceDest":          "Recipient balance after",
    "balance_delta_orig":      "Change in sender balance",
    "balance_delta_dest":      "Change in recipient balance",
    "amount_to_balance_ratio": "Amount vs sender balance ratio",
    "orig_balance_wiped":      "Sender balance fully drained",
    "dest_balance_was_zero":   "Recipient had zero balance",
    "step_hour":               "Hour of day (diurnal risk cycle)",
    "dest_is_merchant":        "Recipient is a merchant",
    "type_CASH_IN":   "Type: CASH_IN",
    "type_CASH_OUT":  "Type: CASH_OUT",
    "type_DEBIT":     "Type: DEBIT",
    "type_PAYMENT":   "Type: PAYMENT",
    "type_TRANSFER":  "Type: TRANSFER",
}

# ---------------------------------------------------------------------------
# Module-level singleton -- loaded ONCE, reused for every request
# ---------------------------------------------------------------------------
_model = None
_threshold: float = 0.5


def _load_model():
    global _model, _threshold
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Hybrid model not found at {MODEL_PATH}. "
            "Run `python app/ml/train.py` first."
        )
    _model = joblib.load(MODEL_PATH)
    if os.path.exists(THRESHOLD_PATH):
        with open(THRESHOLD_PATH) as f:
            _threshold = float(f.read().strip())
    print(f"[inference] Hybrid model loaded. Threshold: {_threshold:.6f}")


def get_model():
    """Lazy-load and return the ensemble (called once at startup)."""
    if _model is None:
        _load_model()
    return _model


# ---------------------------------------------------------------------------
# Feature builder
# ---------------------------------------------------------------------------
TransactionType = Literal["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]


def build_features(
    amount: float,
    transaction_type: TransactionType,
    old_balance_orig: float,
    new_balance_orig: float,
    old_balance_dest: float,
    new_balance_dest: float,
    step: int = 1,
    dest_name: str = "C0000000",
) -> pd.DataFrame:
    """Convert a raw transaction dict into the full ALL_FEATURES vector."""
    row = {
        "amount":                  amount,
        "oldbalanceOrg":           old_balance_orig,
        "newbalanceOrig":          new_balance_orig,
        "oldbalanceDest":          old_balance_dest,
        "newbalanceDest":          new_balance_dest,
        "balance_delta_orig":      old_balance_orig - new_balance_orig,
        "balance_delta_dest":      new_balance_dest - old_balance_dest,
        "amount_to_balance_ratio": amount / (old_balance_orig + 1),
        "orig_balance_wiped":      int(new_balance_orig == 0),
        "dest_balance_was_zero":   int(old_balance_dest == 0),
        "step_hour":               step % 24,
        "dest_is_merchant":        int(dest_name.startswith("M")),
        "type_CASH_IN":   int(transaction_type == "CASH_IN"),
        "type_CASH_OUT":  int(transaction_type == "CASH_OUT"),
        "type_DEBIT":     int(transaction_type == "DEBIT"),
        "type_PAYMENT":   int(transaction_type == "PAYMENT"),
        "type_TRANSFER":  int(transaction_type == "TRANSFER"),
    }
    return pd.DataFrame([row], columns=ALL_FEATURES).astype(float)


# ---------------------------------------------------------------------------
# Get combined feature importances from both sub-models
# ---------------------------------------------------------------------------
def _get_ensemble_importances() -> np.ndarray:
    """Average feature importances from XGBoost and LightGBM sub-models."""
    named = dict(_model.named_estimators_)
    xgb_imp = named["xgb"].feature_importances_
    lgb_imp  = named["lgb"].feature_importances_
    return (xgb_imp + lgb_imp) / 2.0


# ---------------------------------------------------------------------------
# Public inference API
# ---------------------------------------------------------------------------
def predict_risk(
    amount: float,
    transaction_type: TransactionType,
    old_balance_orig: float,
    new_balance_orig: float,
    old_balance_dest: float,
    new_balance_dest: float,
    step: int = 1,
    dest_name: str = "C0000000",
) -> dict:
    """
    Score a single transaction for fraud risk.

    Returns:
        {
            "risk_score":    float (0-1),
            "risk_level":    "LOW" | "MEDIUM" | "HIGH",
            "is_flagged":    bool,
            "threshold":     float,
            "top_features":  list[dict],
            "explanation":   str,
            "model":         str,
        }
    """
    get_model()
    X = build_features(
        amount, transaction_type,
        old_balance_orig, new_balance_orig,
        old_balance_dest, new_balance_dest,
        step, dest_name,
    )

    risk_score = float(_model.predict_proba(X)[0][1])
    is_flagged  = risk_score >= _threshold

    if risk_score < 0.3:
        risk_level = "LOW"
    elif risk_score < _threshold:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    # Ensemble-averaged importances
    importances = _get_ensemble_importances()
    sorted_idx  = np.argsort(importances)[::-1][:3]
    top_features = [
        {
            "feature":    ALL_FEATURES[i],
            "label":      FEATURE_LABELS[ALL_FEATURES[i]],
            "importance": round(float(importances[i]), 4),
            "value":      round(float(X.iloc[0, i]), 4),
        }
        for i in sorted_idx
    ]

    flag_str = "[FLAGGED]" if is_flagged else "[CLEAR]"
    explanation = (
        f"{flag_str} - Risk score {risk_score:.2%} "
        f"({'above' if is_flagged else 'below'} threshold {_threshold:.4f}). "
        f"Top signal: {top_features[0]['label']} = {top_features[0]['value']:.2f}."
    )

    return {
        "risk_score":   round(risk_score, 6),
        "risk_level":   risk_level,
        "is_flagged":   is_flagged,
        "threshold":    round(_threshold, 6),
        "top_features": top_features,
        "explanation":  explanation,
        "model":        "XGBoost+LightGBM Hybrid Ensemble",
    }
