# GlassBox Backend - Risk Agent & API Service

This is the backend service for the GlassBox agentic commerce system, primarily featuring the **Risk Agent**. It is built using **FastAPI** for high-performance, asynchronous API routing and uses a state-of-the-art **Hybrid Machine Learning Ensemble** for real-time fraud detection.

## 🏗️ Architecture & Design Choices

### 1. Modular FastAPI Architecture
The backend is structured for production readiness, scalability, and maintainability.
*   **`main.py` as an Application Factory:** The entry point is kept clean, handling only app initialization, lifespan events (like loading the ML model into memory on startup), and router inclusion.
*   **Separation of Concerns:** Routes (`app/routes`), schemas for data validation (`app/schemas`), core configuration (`app/core`), and machine learning logic (`app/ml`) are strictly isolated.
*   **Zero Cold-Start Latency:** The ML model is loaded into memory during the FastAPI lifespan startup event. This ensures that the very first API request (and all subsequent ones) are served instantly without waiting for disk I/O or model deserialization.

### 2. Hybrid ML Model (XGBoost + LightGBM)
Instead of relying on a single algorithm, the Risk Agent utilizes a **Soft-Voting Ensemble** combining **XGBoost** and **LightGBM**.

**Why this choice?**
*   **Reduced Variance & Overfitting:** Synthetic datasets (like PaySim) often contain sharp, artificial decision boundaries. A single tree model can easily overfit these artifacts. By combining depth-wise tree growth (XGBoost) and leaf-wise histogram binning (LightGBM), the ensemble smooths out these boundaries.
*   **Robustness on Imbalanced Data:** Financial fraud datasets are notoriously imbalanced (e.g., < 0.2% fraud). Combining different algorithms with their respective class-weighting strategies prevents a single algorithm's bias from dominating.
*   **Full Dataset Utilization:** LightGBM's histogram binning allows it to train on the entire 6.36 million row dataset extremely fast, allowing us to leverage all available data rather than relying on sampling techniques.
*   **Anti-Overfitting Controls:** The training pipeline employs 5-Fold Stratified Cross-Validation, L1/L2 regularization, feature sub-sampling, and row sub-sampling to guarantee the model generalizes well to unseen data.

## 🚀 Getting Started

### Prerequisites
*   Python 3.11+
*   Virtual Environment (recommended)

### 1. Setup Environment
```powershell
cd d:\RazorPay\Backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Dataset
Ensure the PaySim dataset is placed at the correct location:
`d:\RazorPay\Backend\Dataset\PaySim Dataset.csv`

### 3. Model Training (One-time setup)
The backend requires a trained model artifact (`hybrid_model.joblib`) to run. The training script will process all 6.36 million rows, select the optimal threshold, and save the model.

```powershell
# Train the hybrid ensemble on the full dataset (takes ~10-20 mins)
python app/ml/train.py

# Evaluate the trained model on a held-out test set
python app/ml/evaluate.py
```
*Note: Once trained, the model is saved to `app/model/`. The backend will load this artifact directly. You do not need to retrain the model when restarting the server.*

### 4. Run the Server
Start the FastAPI server using Uvicorn. The `--reload` flag is useful for development.

```powershell
uvicorn main:app --reload --port 8000
```

## 🔌 API Endpoints

Once the server is running, you can access the interactive API documentation at:
*   **Swagger UI:** `http://localhost:8000/docs`
*   **ReDoc:** `http://localhost:8000/redoc`

### `POST /api/risk/predict`
Predicts the fraud risk for a given transaction.

**Request Body:**
```json
{
  "type": "TRANSFER",
  "amount": 70000,
  "old_balance_orig": 70000,
  "new_balance_orig": 0,
  "old_balance_dest": 0,
  "new_balance_dest": 70000
}
```

**Response:**
```json
{
  "risk_score": 0.999988,
  "risk_level": "MEDIUM",
  "is_flagged": false,
  "threshold": 0.999993,
  "top_features": [
    {
      "feature": "balance_delta_orig",
      "label": "Change in sender's balance",
      "importance": 0.7757,
      "value": 70000.0
    }
    // ... other features
  ],
  "explanation": "[CLEAR] - Risk score 100.00% (below threshold 1.00). Top signal: Change in sender's balance = 70000.00.",
  "model": "XGBoost+LightGBM Hybrid Ensemble"
}
```

### `GET /health`
Basic health check endpoint to verify the service is running.

## 📁 Directory Structure

```text
Backend/
├── main.py                     # FastAPI application factory and entry point
├── requirements.txt            # Python dependencies
├── Dataset/                    # Raw dataset folder
├── app/
│   ├── core/                   # Core configurations (CORS, settings)
│   ├── ml/                     # Machine learning pipelines
│   │   ├── train.py            # Training script (XGBoost + LightGBM)
│   │   ├── evaluate.py         # Evaluation and metrics script
│   │   └── inference.py        # Model loading and prediction logic
│   ├── model/                  # Saved model artifacts (.joblib, threshold, etc.)
│   ├── routes/                 # API route definitions
│   └── schemas/                # Pydantic data validation schemas
```
