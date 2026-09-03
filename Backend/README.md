# GlassBox Backend - AI Agentic Commerce Service

This is the backend service for the **GLASSBOX** agentic commerce system. It provides a robust, multi-tenant FastAPI backend that powers a 6-agent LangGraph orchestration, secure JWT authentication, local SQLite persistence, and a state-of-the-art Hybrid Machine Learning Risk Engine for real-time fraud detection.

## Architecture & Features

![System Architecture](../Diagrams/Architecture.png)
### 1. LangGraph Multi-Agent System (The Virtual Brain)

![Multi-Agent Architecture](../Diagrams/MultiAgentArchitecture.png)

The core of the transaction process is handled by a suite of specialized agents working sequentially and securely:
*   **Concierge Agent:** Parses natural language intent into structured boundaries.
*   **Catalog Agent (RAG):** Retrieves candidate products using deterministic eligibility filtering.
*   **Negotiation Agent:** Selects the best product and strictly enforces tenant-configured spend ceilings (a deterministic check that the LLM cannot override).
*   **Risk Agent (ML):** Scores transactions using a trained Hybrid Ensemble (XGBoost + LightGBM). Features a **graceful rule-based fallback** if ML dependencies are missing.
*   **Payment Agent:** Executes Razorpay test-mode API calls with a strict, non-configurable single-retry policy.
*   **Audit/Ledger Agent:** An always-on observer that writes immutable, replayable event logs for every state transition to power the knowledge graph and merchant insights.

### 2. Multi-Tenancy, RBAC & Authentication
*   **JWT Auth:** Zero-dependency, standards-compliant HS256 JWT access tokens.
*   **Password Hashing:** NIST-recommended PBKDF2-HMAC-SHA256 with unique salts.
*   **Roles:** Distinct roles for `buyer`, `merchant_admin`, and `platform_admin`.
*   **Tenant Isolation:** All database tables and spend ceilings are scoped to `tenant_id`.

### 3. Deep Security Layer
*   **Webhook Signature Verification:** Enforces HMAC-SHA256 validation against `X-Razorpay-Signature` to block forged webhook payloads.
*   **SSRF Protection:** Validates all outbound URLs to block requests to private/internal IPs, loopbacks, and cloud metadata endpoints (e.g., AWS `169.254.169.254`).
*   **Domain Allowlisting:** Explicitly limits outbound API calls to approved domains (e.g., `api.razorpay.com`, `api.groq.com`).

### 4. Zero Cold-Start Hybrid ML Pipeline
*   **XGBoost + LightGBM Soft-Voting:** Combines depth-wise tree growth with leaf-wise histogram binning to prevent overfitting on synthetic PaySim artifacts.
*   **Instant Load:** The `.joblib` model artifact is loaded instantly into memory during the FastAPI lifespan startup event.
*   **Safe Fallback:** If the environment lacks ML dependencies (like `xgboost` or `lightgbm`), the API automatically falls back to a deterministic rule-based risk calculator without crashing.

### Evaluation caveat: PaySim is synthetic

PaySim fraud examples contain a near-deterministic balance-drain signature by design, particularly for `TRANSFER` and `CASH_OUT` transactions. This can produce unusually high separability and PR-AUC; it is not evidence of production-grade fraud detection. The model is presented as a demonstration trained on synthetic data, with held-out metrics reported transparently.

`hybrid_model.joblib` is the only deployed model artifact. Any legacy `risk_model.json` file is historical and must not be used for inference or threshold generation.

---

## Getting Started

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

### 2. Database Initialization & Seeding
The backend uses a local SQLite database (`glassbox.db`).
```powershell
# Create tables (Users, Tenants, Catalog, Transactions, Audit)
python app/db/database.py

# Seed demo tenant and test catalog items
python app/db/seed.py
```

### 3. Model Training (One-time setup - Optional)
If you want to train the ML model from scratch on the 6.36 million row PaySim dataset:
```powershell
# Requires dataset at: Backend/Dataset/PaySim Dataset.csv
python app/ml/train.py
python app/ml/evaluate.py
```

### 4. Run the Server
```powershell
uvicorn main:app --reload --port 8000
```
API Documentation available at `http://localhost:8000/docs`.

---

## Core API Endpoints

### Auth & Profile (`/api/auth`, `/api/profile`)
*   `POST /api/auth/register` - Create user (`buyer` or `merchant_admin`).
*   `POST /api/auth/login` - Authenticate and receive JWT.
*   `GET /api/auth/oauth/{provider}` - Get Supabase OAuth redirect URL (Google, GitHub).
*   `GET /api/profile/me` - View current user profile.
*   `PATCH /api/profile/tenant` - Update spend ceilings (Requires `merchant_admin`).

### Transaction Orchestrator (`/api/transaction`)
*   `POST /api/transaction/run` - **The main endpoint.** Runs the complete 6-agent GLASSBOX pipeline (Concierge → Catalog → Negotiation → Risk → Payment → Audit) from a natural language buyer intent. Returns the full auditable transaction state.
    - Set `force_payment_fail: true` in the request body to trigger the **demo failure script** (decline → one retry → escalate).
*   `GET /api/transaction/{session_id}` - Replay/fetch a persisted transaction by session ID.
*   `GET /api/transaction/insights/{tenant_id}` - Merchant revenue intelligence: AI buyer acceptance rates, top escalation reasons, SKU selection counts.
*   `WS /api/transaction/ws/{session_id}` - **WebSocket endpoint.** Connect before or during a `/run` call to stream live agent events in real-time (<300ms latency).

### Risk (`/api/risk`)
*   `POST /api/risk/predict` - Scores a transaction using the Hybrid ML model (or rule-based fallback). Returns risk score, threshold, and top feature importances.

### Webhooks (`/api/webhooks`)
*   `POST /api/webhooks/razorpay` - Receives payment events. Requires valid HMAC-SHA256 `X-Razorpay-Signature`.

---

## Directory Structure

```text
Backend/
├── main.py                     # FastAPI application factory
├── glassbox.db                 # SQLite database (auto-generated)
├── app/
│   ├── agents/                 # LangGraph Multi-Agent Nodes (Concierge, Risk, etc.)
│   ├── auth/                   # JWT & PBKDF2 Security primitives
│   ├── core/                   # Settings, SSRF protection, Webhook security
│   ├── db/                     # SQLite schema and seeding scripts
│   ├── ml/                     # Hybrid XGBoost+LightGBM Training & Inference
│   ├── routes/                 # FastAPI routers (Auth, Profile, Risk, Webhooks)
│   └── schemas/                # Pydantic validation schemas
```
