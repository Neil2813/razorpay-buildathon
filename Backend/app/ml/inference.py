"""
inference.py — GlassBox Risk Agent Inference Engine
Loads the trained XGBoost model and exposes predict_risk().

This module is imported directly by the FastAPI service (main.py).
Zero network dependency — pure local inference.
"""

import os
from typing import Literal
import numpy as np
import pandas as pd
import xgboost as xgb

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, "app", "model", "risk_model.json")
THRESHOLD_PATH = os.path.join(BASE_DIR, "app", "model", "threshold.txt")

# ---------------------------------------------------------------------------
# Feature schema — must match train.py exactly
# ---------------------------------------------------------------------------
BASE_FEATURES = [
    "amount", "oldbalanceOrg", "newbalanceOrig",
    "oldbalanceDest", "newbalanceDest",
    "balance_delta_orig", "balance_delta_dest",
    "amount_to_balance_ratio", "orig_balance_wiped",
    "dest_balance_was_zero",
]
TYPE_COLUMNS = [
    "type_CASH_IN", "type_CASH_OUT", "type_DEBIT",
    "type_PAYMENT", "type_TRANSFER",
]
ALL_FEATURES = BASE_FEATURES + TYPE_COLUMNS

# ---------------------------------------------------------------------------
# Feature explanation labels (human-readable for demo)
# ---------------------------------------------------------------------------
FEATURE_LABELS = {
    "amount":                  "Transaction amount",
    "oldbalanceOrg":           "Sender's balance before transaction",
    "newbalanceOrig":          "Sender's balance after transaction",
    "oldbalanceDest":          "Recipient's balance before transaction",
    "newbalanceDest":          "Recipient's balance after transaction",
    "balance_delta_orig":      "Change in sender's balance",
    "balance_delta_dest":      "Change in recipient's balance",
    "amount_to_balance_ratio": "Amount relative to sender's balance",
    "orig_balance_wiped":      "Sender's balance completely drained",
    "dest_balance_was_zero":   "Recipient had zero balance before",
    "type_CASH_IN":            "Transaction type: CASH_IN",
    "type_CASH_OUT":           "Transaction type: CASH_OUT",
    "type_DEBIT":              "Transaction type: DEBIT",
    "type_PAYMENT":            "Transaction type: PAYMENT",
    "type_TRANSFER":           "Transaction type: TRANSFER",
}

# ---------------------------------------------------------------------------
# Module-level model + threshold (loaded once at import time)
# ---------------------------------------------------------------------------
_model: xgb.XGBClassifier | None = None
_threshold: float = 0.5


def _load_model():
    global _model, _threshold

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run `python app/ml/train.py` first."
        )

    _model = xgb.XGBClassifier()
    _model.load_model(MODEL_PATH)

    if os.path.exists(THRESHOLD_PATH):
        with open(THRESHOLD_PATH) as f:
            _threshold = float(f.read().strip())

    print(f"[inference] Model loaded. Threshold: {_threshold:.4f}")


def get_model() -> xgb.XGBClassifier:
    """Lazy-load the model (called on first request)."""
    global _model
    if _model is None:
        _load_model()
    return _model


# ---------------------------------------------------------------------------
# Raw transaction → feature vector
# ---------------------------------------------------------------------------
TransactionType = Literal["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]


def build_features(
    amount: float,
    transaction_type: TransactionType,
    old_balance_orig: float,
    new_balance_orig: float,
    old_balance_dest: float,
    new_balance_dest: float,
) -> pd.DataFrame:
    """
    Convert a raw transaction into the full feature vector expected by the model.
    Returns a single-row DataFrame with all ALL_FEATURES columns.
    """
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
        # One-hot type columns
        "type_CASH_IN":   int(transaction_type == "CASH_IN"),
        "type_CASH_OUT":  int(transaction_type == "CASH_OUT"),
        "type_DEBIT":     int(transaction_type == "DEBIT"),
        "type_PAYMENT":   int(transaction_type == "PAYMENT"),
        "type_TRANSFER":  int(transaction_type == "TRANSFER"),
    }
    return pd.DataFrame([row], columns=ALL_FEATURES).astype(float)


# ---------------------------------------------------------------------------
# Main public interface
# ---------------------------------------------------------------------------
def predict_risk(
    amount: float,
    transaction_type: TransactionType,
    old_balance_orig: float,
    new_balance_orig: float,
    old_balance_dest: float,
    new_balance_dest: float,
) -> dict:
    """
    Predict fraud risk for a single transaction.

    Returns:
        {
            "risk_score":    float,            # Raw fraud probability (0-1)
            "risk_level":    "LOW"|"MEDIUM"|"HIGH",
            "is_flagged":    bool,             # True if risk_score >= threshold
            "threshold":     float,
            "top_features":  list[dict],       # Top 3 contributing risk features
            "explanation":   str,              # One-line human-readable summary
        }
    """
    model = get_model()
    X = build_features(
        amount, transaction_type,
        old_balance_orig, new_balance_orig,
        old_balance_dest, new_balance_dest,
    )

    risk_score = float(model.predict_proba(X)[0][1])
    is_flagged = risk_score >= _threshold

    # Risk level bucketing
    if risk_score < 0.3:
        risk_level = "LOW"
    elif risk_score < _threshold:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    # Top contributing features from global model importances
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1][:3]
    top_features = [
        {
            "feature":     ALL_FEATURES[i],
            "label":       FEATURE_LABELS[ALL_FEATURES[i]],
            "importance":  round(float(importances[i]), 4),
            "value":       round(float(X.iloc[0, i]), 4),
        }
        for i in sorted_idx
    ]

    # Human-readable explanation for the Risk Agent
    flag_str = "[FLAGGED]" if is_flagged else "[CLEAR]"
    explanation = (
        f"{flag_str} - Risk score {risk_score:.2%} "
        f"({'above' if is_flagged else 'below'} threshold {_threshold:.2f}). "
        f"Top signal: {top_features[0]['label']} = {top_features[0]['value']:.2f}."
    )

    return {
        "risk_score":   round(risk_score, 6),
        "risk_level":   risk_level,
        "is_flagged":   is_flagged,
        "threshold":    round(_threshold, 6),
        "top_features": top_features,
        "explanation":  explanation,
    }
