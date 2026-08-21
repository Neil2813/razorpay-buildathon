"""
evaluate.py -- GlassBox Risk Agent Model Evaluation
Loads the trained model and produces honest, judge-ready metrics.

Usage:
    python app/ml/evaluate.py
"""

import os
import pandas as pd
import numpy as np
import xgboost as xgb
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend -- safe for all environments
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    confusion_matrix, classification_report,
    precision_recall_curve, auc,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "Dataset", "PaySim Dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "app", "model", "risk_model.json")
THRESHOLD_PATH = os.path.join(BASE_DIR, "app", "model", "threshold.txt")
FEATURES_PATH = os.path.join(BASE_DIR, "app", "model", "features.txt")
PLOT_PATH = os.path.join(BASE_DIR, "app", "model", "pr_curve.png")

TYPE_COLUMNS = [
    "type_CASH_IN", "type_CASH_OUT", "type_DEBIT",
    "type_PAYMENT", "type_TRANSFER",
]
BASE_FEATURES = [
    "amount", "oldbalanceOrg", "newbalanceOrig",
    "oldbalanceDest", "newbalanceDest",
    "balance_delta_orig", "balance_delta_dest",
    "amount_to_balance_ratio", "orig_balance_wiped",
    "dest_balance_was_zero",
]


def load_test_data():
    """Reproduce same split as train.py to get the same held-out test set."""
    print("[evaluate] Loading dataset...")
    df = pd.read_csv(DATASET_PATH)

    fraud = df[df.isFraud == 1]
    nonfraud = df[df.isFraud == 0].sample(n=300_000, random_state=42)
    df = pd.concat([fraud, nonfraud]).sample(frac=1, random_state=42).reset_index(drop=True)

    df["balance_delta_orig"] = df["oldbalanceOrg"] - df["newbalanceOrig"]
    df["balance_delta_dest"] = df["newbalanceDest"] - df["oldbalanceDest"]
    df["amount_to_balance_ratio"] = df["amount"] / (df["oldbalanceOrg"] + 1)
    df["orig_balance_wiped"] = (df["newbalanceOrig"] == 0).astype(int)
    df["dest_balance_was_zero"] = (df["oldbalanceDest"] == 0).astype(int)
    df = pd.get_dummies(df, columns=["type"], prefix="type")

    for col in TYPE_COLUMNS:
        if col not in df.columns:
            df[col] = 0

    all_features = BASE_FEATURES + TYPE_COLUMNS
    X = df[all_features].astype(float)
    y = df["isFraud"]

    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    return X_test, y_test, all_features


def evaluate():
    if not os.path.exists(MODEL_PATH):
        print(f"[evaluate] ERROR: Model not found at {MODEL_PATH}. Run train.py first.")
        return

    # Load model
    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH)

    # Load threshold
    threshold = 0.5
    if os.path.exists(THRESHOLD_PATH):
        with open(THRESHOLD_PATH) as f:
            threshold = float(f.read().strip())
    print(f"[evaluate] Using decision threshold: {threshold:.4f}")

    # Load test data
    X_test, y_test, feature_names = load_test_data()
    print(f"[evaluate] Test set: {len(X_test):,} rows | Fraud: {y_test.sum():,}")

    # Predictions
    y_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_proba >= threshold).astype(int)

    # --- Core Metrics ---
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    tn, fp, fn, tp = cm.ravel()

    precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)
    pr_auc = auc(recalls, precisions)

    print("\n" + "="*60)
    print("  GlassBox Risk Agent -- Evaluation Results")
    print("="*60)
    print(f"  Decision Threshold : {threshold:.4f}")
    print(f"  Precision          : {precision:.4f}  ({precision*100:.1f}%)")
    print(f"  Recall             : {recall:.4f}  ({recall*100:.1f}%)")
    print(f"  F1 Score           : {f1:.4f}")
    print(f"  PR-AUC             : {pr_auc:.4f}")
    print(f"\n  Confusion Matrix:")
    print(f"    True Negatives  (TN) : {tn:,}")
    print(f"    False Positives (FP) : {fp:,}  <- flagged incorrectly (friction cost)")
    print(f"    False Negatives (FN) : {fn:,}  <- missed fraud (risk exposure)")
    print(f"    True Positives  (TP) : {tp:,}")
    print(f"\n  False Positive Rate    : {fp/(fp+tn)*100:.2f}% of legit txns flagged")
    print(f"  False Negative Rate    : {fn/(fn+tp)*100:.2f}% of fraud missed")
    print("\n  Full Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Legit", "Fraud"]))

    # --- Feature Importances ---
    importances = pd.Series(model.feature_importances_, index=feature_names).sort_values(ascending=False)
    print("  Top 5 Feature Importances (for Risk Agent explanations):")
    for fname, score in importances.head(5).items():
        print(f"    {fname:<35} {score:.4f}")

    # --- Threshold Sweep Table ---
    print("\n  Threshold Sweep (for demo tuning):")
    print(f"  {'Threshold':>12} {'Precision':>12} {'Recall':>12} {'F1':>12}")
    for p, r, t in zip(precisions, recalls, thresholds):
        if r <= 0.99 and r >= 0.70 and (r * 10) % 1 < 0.05:
            _y = (y_proba >= t).astype(int)
            _f1 = f1_score(y_test, _y)
            print(f"  {t:>12.4f} {p:>12.4f} {r:>12.4f} {_f1:>12.4f}")

    # --- PR Curve Plot ---
    plt.figure(figsize=(8, 5))
    plt.plot(recalls, precisions, color="#7C3AED", linewidth=2, label=f"PR-AUC = {pr_auc:.4f}")
    plt.axvline(x=recall, color="#EF4444", linestyle="--", alpha=0.7,
                label=f"Chosen threshold (recall={recall:.2f})")
    plt.scatter([recall], [precision], color="#EF4444", s=80, zorder=5)
    plt.xlabel("Recall", fontsize=12)
    plt.ylabel("Precision", fontsize=12)
    plt.title("Precision-Recall Curve -- GlassBox Risk Agent", fontsize=13)
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(PLOT_PATH, dpi=150)
    print(f"\n[evaluate] PR curve saved -> {PLOT_PATH}")

    # --- Demo-day writeup snippet ---
    n_total = len(X_test)
    fp_rate_pct = round(fp / (fp + tn) * 100, 1)
    print("\n" + "-"*60)
    print("  Demo-day writeup (paste into README/deck):")
    print("-"*60)
    print(f"""
  "Trained on a synthetic dataset (PaySim, ~{n_total:,} test samples after
  balancing), our model achieves {precision*100:.1f}% precision and
  {recall*100:.1f}% recall on a held-out test set. At our chosen decision
  threshold ({threshold:.2f}), approximately {fp_rate_pct}% of flagged
  transactions are false positives -- a deliberate tradeoff favoring high
  fraud capture at the cost of some added friction, appropriate for a
  demonstration system and not tuned for production deployment."
""")
    print("="*60)


if __name__ == "__main__":
    evaluate()
