"""
train.py -- GlassBox Risk Agent Model Training
Trains an XGBoost fraud classifier on the PaySim dataset.

Usage:
    python app/ml/train.py            # Fast mode: sampled non-fraud rows (300k)
    python app/ml/train.py --full     # Full mode: all 6.36M rows (15-30 mins)
"""

import argparse
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import xgboost as xgb

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "Dataset", "PaySim Dataset.csv")
MODEL_DIR = os.path.join(BASE_DIR, "app", "model")
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.json")
FEATURES_PATH = os.path.join(MODEL_DIR, "features.txt")
THRESHOLD_PATH = os.path.join(MODEL_DIR, "threshold.txt")

# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------
BASE_FEATURES = [
    "amount", "oldbalanceOrg", "newbalanceOrig",
    "oldbalanceDest", "newbalanceDest",
    "balance_delta_orig", "balance_delta_dest",
    "amount_to_balance_ratio", "orig_balance_wiped",
    "dest_balance_was_zero",
]

# All possible type one-hot columns (guarantees consistent schema)
TYPE_COLUMNS = [
    "type_CASH_IN", "type_CASH_OUT", "type_DEBIT",
    "type_PAYMENT", "type_TRANSFER",
]


def load_and_engineer(dataset_path: str, sample: bool = True) -> tuple:
    """
    Load the PaySim CSV and engineer features.
    Returns (X, y, feature_names).
    """
    print(f"[train] Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    print(f"[train] Loaded {len(df):,} rows. Fraud rate: {df['isFraud'].mean()*100:.4f}%")

    if sample:
        fraud = df[df.isFraud == 1]
        nonfraud = df[df.isFraud == 0].sample(n=300_000, random_state=42)
        df = pd.concat([fraud, nonfraud]).sample(frac=1, random_state=42).reset_index(drop=True)
        print(f"[train] Sampled to {len(df):,} rows ({len(fraud):,} fraud + 300,000 non-fraud).")
    else:
        print(f"[train] Using full dataset ({len(df):,} rows).")

    # --- Feature Engineering ---
    df["balance_delta_orig"] = df["oldbalanceOrg"] - df["newbalanceOrig"]
    df["balance_delta_dest"] = df["newbalanceDest"] - df["oldbalanceDest"]
    df["amount_to_balance_ratio"] = df["amount"] / (df["oldbalanceOrg"] + 1)
    df["orig_balance_wiped"] = (df["newbalanceOrig"] == 0).astype(int)
    df["dest_balance_was_zero"] = (df["oldbalanceDest"] == 0).astype(int)

    # One-hot encode transaction type -- this is the "category risk" signal
    df = pd.get_dummies(df, columns=["type"], prefix="type")

    # Ensure all type columns exist (handles missing types in sampled data)
    for col in TYPE_COLUMNS:
        if col not in df.columns:
            df[col] = 0

    all_features = BASE_FEATURES + TYPE_COLUMNS
    X = df[all_features].astype(float)
    y = df["isFraud"]

    return X, y, all_features


def train(sample: bool = True):
    os.makedirs(MODEL_DIR, exist_ok=True)

    X, y, feature_names = load_and_engineer(DATASET_PATH, sample=sample)

    print(f"[train] Class distribution -- Fraud: {y.sum():,} | Non-fraud: {(y==0).sum():,}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"[train] Train: {len(X_train):,} rows | Test: {len(X_test):,} rows")

    scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
    print(f"[train] scale_pos_weight = {scale_pos_weight:.2f}")

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr",
        random_state=42,
        verbosity=1,
    )

    print("[train] Training XGBoost model...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    model.save_model(MODEL_PATH)
    print(f"[train] Model saved -> {MODEL_PATH}")

    # Save feature list for inference schema validation
    with open(FEATURES_PATH, "w") as f:
        f.write("\n".join(feature_names))
    print(f"[train] Feature list saved -> {FEATURES_PATH}")

    # Quick threshold selection at ~85% recall (saved for inference)
    # precision_recall_curve returns points in decreasing recall order.
    # We iterate all points and keep the HIGHEST threshold where recall >= 0.85
    # -- this gives the best precision while still catching >=85% of fraud.
    from sklearn.metrics import precision_recall_curve
    y_proba = model.predict_proba(X_test)[:, 1]
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)

    chosen_threshold = 0.5
    chosen_p = 0.0
    chosen_r = 0.0
    for p, r, t in zip(precisions[:-1], recalls[:-1], thresholds):
        if r >= 0.85 and t > chosen_threshold:
            chosen_threshold = float(t)
            chosen_p = float(p)
            chosen_r = float(r)
    print(f"[train] Threshold at >=85% recall -> {chosen_threshold:.4f} | Precision: {chosen_p:.4f} | Recall: {chosen_r:.4f}")

    with open(THRESHOLD_PATH, "w") as f:
        f.write(str(chosen_threshold))
    print(f"[train] Threshold saved -> {THRESHOLD_PATH}")
    print("\n[train] Training complete. Run evaluate.py for full metrics.")

    return model, X_test, y_test, feature_names


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train GlassBox Risk Agent model.")
    parser.add_argument(
        "--full", action="store_true",
        help="Train on full dataset (~6.36M rows). Slow (15-30 min). Default: sampled mode."
    )
    args = parser.parse_args()
    train(sample=not args.full)
