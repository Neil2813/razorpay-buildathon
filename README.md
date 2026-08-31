# Glassbox

**AI Agentic Commerce Service & Hybrid Fraud Detection**

---

Glassbox is an agentic commerce system designed to facilitate secure, multi-tenant B2B or B2C transactions. It provides a robust FastAPI backend that powers a 6-agent LangGraph orchestration, secure JWT authentication, local SQLite persistence, and a state-of-the-art Hybrid Machine Learning Risk Engine for real-time fraud detection. By combining a natural language shopping experience with deterministic rules and predictive ML modeling, Glassbox creates a frictionless yet highly secure purchasing environment.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Transaction Pipeline](#transaction-pipeline)
6. [Multi-Agent System](#multi-agent-system)
7. [Machine Learning Risk Engine](#machine-learning-risk-engine)
8. [Enterprise Governance & Security](#enterprise-governance--security)
9. [Frontend Application](#frontend-application)
10. [Backend API Engine](#backend-api-engine)
11. [Project Structure](#project-structure)
12. [Environment Configuration](#environment-configuration)
13. [Local Development](#local-development)

---

## Problem Statement

Modern digital commerce often suffers from disjointed user experiences and rigid rule-based fraud systems that block legitimate transactions while missing sophisticated fraud. Businesses struggle to balance the need for conversational, AI-driven purchasing experiences with strict corporate spend controls and high-precision risk assessment.

Glassbox addresses this by introducing a multi-agent orchestration pipeline that parses intent, filters eligible catalog items, enforces deterministic spend ceilings, and scores risk dynamically before routing to the Razorpay payment gateway.

---

## Solution Overview

| Capability | Description |
|---|---|
| **Conversational Commerce** | Natural language intent parsed directly into structured purchasing boundaries. |
| **Hybrid ML Risk Engine** | Real-time fraud scoring using XGBoost + LightGBM soft-voting, with graceful rule-based fallbacks. |
| **Deterministic Spend Ceilings**| LLM cannot override hard-coded tenant spending limits, ensuring compliance. |
| **Auditable Ledger** | An always-on observer agent logs immutable, replayable event logs for every state transition. |
| **Multi-Tenancy** | Strict row-level tenant isolation, scoped database tables, and distinct user roles (`buyer`, `merchant_admin`, `platform_admin`). |

---

## Technology Stack

### Backend Stack
- **Framework:** FastAPI (Python 3.11+)
- **AI/Orchestration:** LangGraph
- **Database:** SQLite
- **Machine Learning:** XGBoost, LightGBM, Scikit-learn
- **Security:** JWT (HS256), PBKDF2-HMAC-SHA256 Password Hashing

### Frontend Stack
- **Framework:** React 19, Vite 8, TypeScript
- **Styling:** Tailwind CSS 4, Shadcn UI
- **Routing & State:** React Router DOM
- **Icons & Animation:** Lucide React, Framer Motion

---

## System Architecture

Glassbox uses a decoupled architecture. The React SPA frontend communicates with a Python FastAPI backend. The backend manages a SQLite database and orchestrates external API calls to Razorpay (for payments) and Groq (for LLM inference). 

The backend architecture uses a strict multi-agent pipeline where deterministic checks (like spend limits) bound non-deterministic LLM generations.

---

## Transaction Pipeline

The core transaction loop follows a sequential 6-agent process to ensure safe and accurate checkout experiences:

1. **Concierge Agent:** Parses natural language intent.
2. **Catalog Agent:** RAG-based candidate product retrieval.
3. **Negotiation Agent:** Selects the optimal product and enforces spend ceilings.
4. **Risk Agent:** Executes Hybrid ML scoring (or rule-based fallback).
5. **Payment Agent:** Fires Razorpay test-mode API calls.
6. **Audit/Ledger Agent:** Logs state transitions into the SQLite database.

---

## Multi-Agent System

The LangGraph system forms the "Virtual Brain" of Glassbox. 

- **Concierge:** Understands user needs and sets boundaries.
- **Catalog:** Retrieves products based on deterministic filters.
- **Negotiation:** Responsible for matching needs to catalog items without exceeding limits.
- **Risk:** Leverages trained ML models to approve or flag transactions.
- **Payment:** A strict executor with non-configurable retry logic.
- **Ledger:** Provides a read-only audit trail for transparency.

---

## Machine Learning Risk Engine

### Zero Cold-Start Hybrid Pipeline
The Risk Agent utilizes a pre-trained `.joblib` model artifact loaded instantly into memory on startup.

- **Soft-Voting Ensemble:** Combines XGBoost (depth-wise tree growth) with LightGBM (leaf-wise histogram binning) to avoid overfitting on synthetic data.
- **Graceful Fallback:** If ML dependencies fail to load, the API auto-reverts to a deterministic rule-based calculator.

*Note on Evaluation:* The model is trained on synthetic PaySim datasets, which have deterministic balance-drain signatures. This serves as a demonstration of the pipeline architecture.

---

## Enterprise Governance & Security

- **Multi-Tenant Isolation:** Database tables and spend ceilings are scoped strictly to `tenant_id`.
- **Role-Based Access Control:** `buyer`, `merchant_admin`, and `platform_admin` roles.
- **Webhook Security:** HMAC-SHA256 validation against `X-Razorpay-Signature` to block forged Razorpay webhooks.
- **SSRF Protection:** Blocks outbound requests to private IPs, loopbacks, and cloud metadata endpoints.
- **Domain Allowlisting:** API calls are restricted to approved domains (e.g., `api.razorpay.com`, `api.groq.com`).

---

## Frontend Application

Built with React 19 and Vite, styled with Tailwind CSS 4 and Shadcn UI. 

**Key Features:**
- **Real-Time Updates:** Capable of connecting to backend WebSockets (`/api/transaction/ws/{session_id}`) to stream live agent events in real-time.
- **Dashboard UI:** Displays merchant revenue intelligence, buyer acceptance rates, and SKU selections.

---

## Backend API Engine

**FastAPI 0.135+** · **Python 3.11+**

### Core Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate and receive JWT |
| `POST` | `/api/transaction/run` | Main endpoint: runs the 6-agent pipeline |
| `GET` | `/api/transaction/{session_id}` | Fetch a persisted transaction |
| `WS` | `/api/transaction/ws/{id}` | WebSocket stream for live agent events |
| `POST` | `/api/risk/predict` | Score a transaction using the Hybrid ML model |
| `POST` | `/api/webhooks/razorpay` | Receives payment events |

---

## Project Structure

```
Glassbox/
├── Backend/                     # FastAPI application
│   ├── app/                     # Source Code
│   │   ├── agents/              # LangGraph Multi-Agent Nodes
│   │   ├── auth/                # JWT & PBKDF2 Security primitives
│   │   ├── core/                # Settings & Webhook security
│   │   ├── db/                  # SQLite schema and seeding scripts
│   │   ├── ml/                  # Hybrid XGBoost+LightGBM Training
│   │   ├── routes/              # FastAPI routers
│   │   └── schemas/             # Pydantic validation schemas
│   ├── Dataset/                 # PaySim Dataset storage
│   ├── main.py                  # API Entry Point
│   ├── requirements.txt         
│   └── README.md
│
├── Frontend/                    # React SPA
│   ├── src/                     # Source Code
│   ├── public/                  
│   ├── package.json             
│   ├── vite.config.js
│   └── README.md
│
└── README.md                    # This File
```

---

## Environment Configuration

Both Backend and Frontend environments are required to run Glassbox locally.

**Backend (`Backend/.env`)**
Requires configuration for Razorpay API keys, Groq API keys, and JWT secrets.

**Frontend (`Frontend/.env`)**
Requires API URL mapping to the backend (e.g., `VITE_API_BASE=http://localhost:8000`).

---

## Local Development

### 1. Setup Backend
```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Initialize Database (SQLite)
```powershell
python app/db/database.py
python app/db/seed.py
```

### 3. Run Backend
```powershell
uvicorn main:app --reload --port 8000
```

### 4. Run Frontend
```powershell
cd ../Frontend
npm install
npm run dev
```

The frontend will be accessible at the Vite default port (typically `http://localhost:5173`) and the API docs at `http://localhost:8000/docs`.
