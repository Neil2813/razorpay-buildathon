"""
fix_threshold.py -- Recomputes and saves the correct decision threshold.
Run once from D:\\RazorPay\\Backend:
    python app/ml/fix_threshold.py
"""
import os
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_recall_curve

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_PATH = os.path.join(BASE_DIR, "Dataset", "PaySim Dataset.csv")
MODEL_PATH  = os.path.join(BASE_DIR, "app", "model", "risk_model.json")
THRESHOLD_PATH = os.path.join(BASE_DIR, "app", "model", "threshold.txt")

BASE_FEATURES = [
    "amount","oldbalanceOrg","newbalanceOrig","oldbalanceDest","newbalanceDest",
    "balance_delta_orig","balance_delta_dest","amount_to_balance_ratio",
    "orig_balance_wiped","dest_balance_was_zero",
]
TYPE_COLUMNS = ["type_CASH_IN","type_CASH_OUT","type_DEBIT","type_PAYMENT","type_TRANSFER"]

print("Loading dataset...")
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
X = df[BASE_FEATURES + TYPE_COLUMNS].astype(float)
y = df["isFraud"]
_, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print("Loading model...")
model = xgb.XGBClassifier()
model.load_model(MODEL_PATH)
y_proba = model.predict_proba(X_test)[:, 1]

# precision_recall_curve returns points in *decreasing* recall order
# (lowest threshold = recall 1.0, highest threshold = recall ~0.0)
# We want the HIGHEST threshold where recall is still >= 0.85
# i.e. the best-precision point that still catches >=85% of fraud.
precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)

print("\nThreshold sweep near 85% recall:")
best_t = 0.5
best_p = 0.0
best_r = 0.0

# Zip skips the last precision/recall point (no corresponding threshold)
for p, r, t in zip(precisions[:-1], recalls[:-1], thresholds):
    if r >= 0.85:
        # Keep updating -- we want the highest threshold (best precision)
        # that still satisfies recall >= 0.85
        if t > best_t or best_t == 0.5:
            best_t = t
            best_p = p
            best_r = r

print(f"  Best threshold: {best_t:.6f} | Precision: {best_p:.4f} | Recall: {best_r:.4f}")
print(f"  F1: {2*best_p*best_r/(best_p+best_r):.4f}")

with open(THRESHOLD_PATH, "w") as f:
    f.write(str(best_t))
print(f"\nSaved -> {THRESHOLD_PATH}")
