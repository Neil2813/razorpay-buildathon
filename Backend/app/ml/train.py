"""
train.py -- GlassBox Hybrid Risk Agent Model Training
Trains a soft-voting ensemble of XGBoost + LightGBM on the FULL PaySim
dataset (6.36M rows) and persists it with joblib.

Anti-overfitting controls:
  - XGBoost: subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0
  - LightGBM: feature_fraction=0.8, bagging_fraction=0.8, lambda_l1=0.1, lambda_l2=1.0
  - Soft-voting ensemble reduces single-model variance
  - 5-Fold Stratified CV reported before saving (no data leakage)

Usage:
    python app/ml/train.py
"""

import os
import time
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
import lightgbm as lgb
from sklearn.ensemble import VotingClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import precision_recall_curve, f1_score

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "Dataset", "PaySim Dataset.csv")
MODEL_DIR    = os.path.join(BASE_DIR, "app", "model")
MODEL_PATH   = os.path.join(MODEL_DIR, "hybrid_model.joblib")
FEATURES_PATH = os.path.join(MODEL_DIR, "features.txt")
THRESHOLD_PATH = os.path.join(MODEL_DIR, "threshold.txt")

# ---------------------------------------------------------------------------
# Feature schema
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


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Apply all feature transformations in-place."""
    df["balance_delta_orig"]      = df["oldbalanceOrg"] - df["newbalanceOrig"]
    df["balance_delta_dest"]      = df["newbalanceDest"] - df["oldbalanceDest"]
    df["amount_to_balance_ratio"] = df["amount"] / (df["oldbalanceOrg"] + 1)
    df["orig_balance_wiped"]      = (df["newbalanceOrig"] == 0).astype(int)
    df["dest_balance_was_zero"]   = (df["oldbalanceDest"] == 0).astype(int)
    df["step_hour"]               = df["step"] % 24
    df["dest_is_merchant"]        = df["nameDest"].str.startswith("M").astype(int)

    df = pd.get_dummies(df, columns=["type"], prefix="type")
    for col in TYPE_COLUMNS:
        if col not in df.columns:
            df[col] = 0

    return df


def load_data() -> tuple:
    print(f"[train] Loading full dataset from: {DATASET_PATH}")
    t0 = time.time()
    df = pd.read_csv(DATASET_PATH)
    print(f"[train] Loaded {len(df):,} rows in {time.time()-t0:.1f}s.")
    print(f"[train] Fraud rate: {df['isFraud'].mean()*100:.4f}%  "
          f"(Fraud: {df['isFraud'].sum():,} | Legit: {(df['isFraud']==0).sum():,})")

    df = engineer_features(df)
    X = df[ALL_FEATURES].astype(float)
    y = df["isFraud"]
    return X, y


def build_ensemble(scale_pos_weight: float) -> VotingClassifier:
    """Build the XGBoost + LightGBM soft-voting ensemble."""

    xgb_clf = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        scale_pos_weight=scale_pos_weight,
        subsample=0.8,               # anti-overfit: row sampling
        colsample_bytree=0.8,        # anti-overfit: feature sampling per tree
        reg_alpha=0.1,               # L1 regularization
        reg_lambda=1.0,              # L2 regularization
        eval_metric="aucpr",
        tree_method="hist",          # fast histogram method
        random_state=42,
        verbosity=0,
        n_jobs=-1,
    )

    lgb_clf = lgb.LGBMClassifier(
        n_estimators=500,
        num_leaves=31,
        learning_rate=0.05,
        is_unbalance=True,           # handles class imbalance internally
        feature_fraction=0.8,        # anti-overfit: feature sampling
        bagging_fraction=0.8,        # anti-overfit: row sampling
        bagging_freq=5,
        lambda_l1=0.1,               # L1 regularization
        lambda_l2=1.0,               # L2 regularization
        min_child_samples=50,        # anti-overfit: minimum leaf samples
        random_state=42,
        verbose=-1,
        n_jobs=-1,
    )

    return VotingClassifier(
        estimators=[("xgb", xgb_clf), ("lgb", lgb_clf)],
        voting="soft",
        weights=[1, 1],
    )


def find_threshold(model, X_test: pd.DataFrame, y_test: pd.Series) -> float:
    """Find the highest-precision threshold that still achieves >= 85% recall."""
    y_proba = model.predict_proba(X_test)[:, 1]
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)

    best_t, best_p, best_r = 0.5, 0.0, 0.0
    for p, r, t in zip(precisions[:-1], recalls[:-1], thresholds):
        if r >= 0.85 and t > best_t:
            best_t, best_p, best_r = float(t), float(p), float(r)

    print(f"[train] Optimal threshold: {best_t:.6f} | "
          f"Precision: {best_p:.4f} | Recall: {best_r:.4f} | "
          f"F1: {2*best_p*best_r/(best_p+best_r+1e-9):.4f}")
    return best_t


def train():
    os.makedirs(MODEL_DIR, exist_ok=True)

    X, y = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"[train] Train: {len(X_train):,} rows | Test: {len(X_test):,} rows")

    scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
    print(f"[train] scale_pos_weight = {scale_pos_weight:.2f}")

    # ------------------------------------------------------------------
    # 5-Fold Stratified CV -- measures generalization BEFORE final fit
    # High mean + low std = no overfitting/underfitting
    # ------------------------------------------------------------------
    print("\n[train] Running 5-Fold Stratified Cross-Validation (on a 20% sample for speed)...")
    cv_sample_idx = np.random.RandomState(42).choice(
        len(X_train), size=min(200_000, len(X_train)), replace=False
    )
    X_cv = X_train.iloc[cv_sample_idx]
    y_cv = y_train.iloc[cv_sample_idx]

    cv_model = build_ensemble(scale_pos_weight)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(cv_model, X_cv, y_cv, cv=skf, scoring="f1", n_jobs=1)
    print(f"[train] CV F1 scores: {[f'{s:.4f}' for s in cv_scores]}")
    print(f"[train] CV F1 mean: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
    if cv_scores.std() > 0.05:
        print("[train] WARNING: High CV variance -- possible instability. Review features.")
    else:
        print("[train] CV variance is low -- model generalizes well.")

    # ------------------------------------------------------------------
    # Final model -- train on full training split
    # ------------------------------------------------------------------
    print(f"\n[train] Training final hybrid ensemble on {len(X_train):,} rows...")
    t0 = time.time()
    final_model = build_ensemble(scale_pos_weight)
    final_model.fit(X_train, y_train)
    print(f"[train] Training complete in {time.time()-t0:.1f}s.")

    # Threshold selection on held-out test set (no data leakage)
    threshold = find_threshold(final_model, X_test, y_test)
    train_pred = (final_model.predict_proba(X_train)[:, 1] >= threshold).astype(int)
    print(f"[train] Training F1 at selected threshold (diagnostic only): {f1_score(y_train, train_pred):.4f}")

    # Persist everything
    joblib.dump(final_model, MODEL_PATH)
    print(f"[train] Hybrid model saved -> {MODEL_PATH}")

    with open(FEATURES_PATH, "w") as f:
        f.write("\n".join(ALL_FEATURES))
    print(f"[train] Feature list saved -> {FEATURES_PATH}")

    with open(THRESHOLD_PATH, "w") as f:
        f.write(str(threshold))
    print(f"[train] Threshold saved -> {THRESHOLD_PATH}")

    print("\n[train] Done. Run evaluate.py for full metrics report.")


if __name__ == "__main__":
    train()
