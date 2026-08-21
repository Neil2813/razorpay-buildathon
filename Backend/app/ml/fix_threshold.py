"""Recompute the deployed hybrid-model threshold on the full dataset.

This uses the exact feature engineering and threshold-selection logic from
``train.py``. It cannot silently generate a threshold for the retired
single-XGBoost model.
"""

import os

import joblib
from sklearn.model_selection import train_test_split

from app.ml.train import find_threshold, load_data


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, "app", "model", "hybrid_model.joblib")
THRESHOLD_PATH = os.path.join(BASE_DIR, "app", "model", "threshold.txt")


def main() -> None:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Hybrid model not found: {MODEL_PATH}")
    X, y = load_data()
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    threshold = find_threshold(joblib.load(MODEL_PATH), X_test, y_test)
    with open(THRESHOLD_PATH, "w") as file:
        file.write(str(threshold))
    print(f"Saved hybrid-model threshold -> {THRESHOLD_PATH}")


if __name__ == "__main__":
    main()
