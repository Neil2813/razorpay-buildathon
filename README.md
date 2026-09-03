# Glassbox

**AI Agentic Commerce Service & Hybrid Fraud Detection**

Submitted for participation in **Razorpay Buildathon 2026** (Track 01: AI Growth & Agentic Commerce)

---

Glassbox is an enterprise-grade agentic commerce system designed to facilitate secure, multi-tenant B2B and B2C transactions on Razorpay test-mode APIs. It features a 6-agent LangGraph orchestration pipeline, Groq LLM inference (`llama-3.3-70b-versatile` & `llama-3.1-8b-instant`), zero-dependency HS256 JWT authentication, local SQLite persistence, and a state-of-the-art Hybrid Machine Learning Risk Engine for real-time fraud detection. 

By combining a natural language shopping experience with hard-coded, deterministic spend ceilings ("reason freely, spend strictly within bounds"), Glassbox creates a frictionless yet highly secure purchasing environment where every money action is explainable, bounded, and gated.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Technology Stack](#technology-stack)
4. [Amazon Web Services (AWS) Cloud Stack](#amazon-web-services-aws-cloud-stack)
5. [System Architecture](#system-architecture)
6. [Autonomous Transaction Pipeline](#autonomous-transaction-pipeline)
7. [Multi-Agent System](#multi-agent-system)
8. [Machine Learning Risk Engine](#machine-learning-risk-engine)
9. [Enterprise Governance & Security](#enterprise-governance--security)
10. [Frontend Application](#frontend-application)
11. [Backend API Engine](#backend-api-engine)
12. [Project Structure](#project-structure)
13. [Environment Configuration](#environment-configuration)
14. [Local Development & Demo Setup](#local-development--demo-setup)
15. [Production Deployment](#production-deployment)
16. [Model Evaluation & Audit Metrics](#model-evaluation--audit-metrics)
17. [Testing](#testing)
18. [Sample Data & Seeding](#sample-data--seeding)
19. [Architecture Evolution Phases](#architecture-evolution-phases)
20. [Diagrams & Documentation](#diagrams--documentation)
21. [Quick Reference](#quick-reference)
22. [Acknowledgments](#acknowledgments)

---

## Problem Statement

The rise of agent-to-agent protocol standards (NPCI UAP, ACP, AP2, x402) has made autonomous commerce the open problem of the year. Modern digital commerce suffers from two main friction points:
1. **Unsafe Autonomous Execution:** Autonomous financial agents, if given direct access to funds, can hallucinate incorrect items or exceed spending preferences. Prompt-level instructions are vulnerable to jailbreaks, creating severe financial and regulatory risk.
2. **Brittle Fraud Detection & Unfriendly User Experience:** Traditional fraud engines rely on rigid rules that block legitimate transactions while missing complex fraud signatures. Meanwhile, traditional e-commerce catalogs are built for human browsing rather than structured machine ingestion by AI buyers.

### The Glassbox Standard
Glassbox solves this with a **bounded and gated Multi-Agent pipeline** combined with a **Hybrid Machine Learning Risk Engine**. Every monetary action taken by an AI agent is strictly bounded by code-enforced financial ceilings, scored for risk before authorization, and recorded on an append-only audit ledger.

---

## Solution Overview

| Capability | Description |
|---|---|
| **Conversational Commerce** | Natural language buyer intent parsed directly into structured purchasing boundaries via `llama-3.3-70b-versatile`. |
| **Agent-Readable Catalog (RAG)** | RAG vector search retrieval over merchant catalog tables filtered deterministically by stock and attributes before ranking. |
| **Deterministic Spend Ceilings** | Code-level spend ceiling checks (`chosen_product.price <= guardrail_ceiling`) that the LLM cannot override or bypass. |
| **Hybrid ML Risk Engine** | Real-time fraud scoring using XGBoost + LightGBM soft-voting ensemble trained on 6.36M PaySim transactions, with automatic rule-based fallbacks. |
| **Fixed Retry Execution** | Razorpay test-mode payment execution with a hard-coded single-retry policy followed by human-readable escalation. |
| **Auditable Ledger** | An always-on observer agent logs immutable, replayable event logs for every state transition to power real-time UI status rails. |
| **Merchant Revenue Intelligence** | Asynchronous analytics agent aggregating transaction logs to reveal AI buyer acceptance rates, abandonment thresholds, and catalog gaps. |
| **Deep Security Layer** | HMAC-SHA256 webhook verification (`X-Razorpay-Signature`), SSRF protection against internal IPs, and domain allowlisting. |
| **Multi-Tenant RBAC** | Strict row-level tenant isolation, scoped database tables, and distinct roles (`buyer`, `merchant_admin`, `platform_admin`). |

---

## Technology Stack

### AI & Agent Runtime
- **LLM Provider:** Groq LPU Inference (OpenAI-compatible `/openai/v1/chat/completions`)
- **Reasoning Models:** `llama-3.3-70b-versatile` (Concierge, Negotiation, Audit Event Summaries)
- **Formatting/Ranking Models:** `llama-3.1-8b-instant` (Catalog ranking, Escalation formatting, Merchant Insights)
- **Orchestration Framework:** LangGraph (State Graph with strict deterministic conditional edge routers)

### Backend Engine
- **Framework:** FastAPI (Python 3.11+)
- **Machine Learning:** XGBoost, LightGBM, Scikit-learn, Joblib
- **Database & Persistence:** SQLite (Local WAL mode), Supabase pgvector (RAG embeddings)
- **Security & Auth:** Zero-dependency HS256 JWT, PBKDF2-HMAC-SHA256 password hashing

### Frontend Stack
- **Framework:** React 19, Vite 8, TypeScript 5.6
- **Styling:** Tailwind CSS 4, Shadcn UI
- **Routing & State:** React Router DOM 6, Custom WebSocket hooks
- **Icons & Motion:** Lucide React, Framer Motion

---

## System Architecture

The GLASSBOX Architecture is an enterprise-grade, event-driven, and bound multi-agent system designed for autonomous agentic commerce. It balances the non-deterministic reasoning of generative AI agents with strict, deterministic governance (spending limits, circuit breakers, risk gates, and regulatory auditability).

### Layer-by-Layer Breakdown

#### 1. Ingress & Edge Layer (Scalability & Perimeter Security)
**Clients / Agents Supported:**
- **AI Buyer Agent:** Interacts machine-to-machine over agentic negotiation standards like NPCI UAP, ACP, AP2, or HTTP 402 (x402).
- **Human Shopper:** Connects via Web, Mobile, or Voice interfaces over HTTPS and WebSockets.

- **AWS WAF:** Sanitizes all traffic, mitigating Layer 7 DDoS, prompt injection spam, and volumetric rate abuses before reaching downstream components.
- **Amazon API Gateway:** Acts as the reverse proxy for routing, rate limiting, and protocol translation (normalizing agentic RPC/HTTP protocols into internal microservice contracts).
- **Amazon CloudFront CDN:** Caches static product media (images, videos, static catalog snapshots) to reduce edge response latency.

#### 2. Compute & Orchestration Layer (Stateful Agent Pipeline)
Orchestrated deterministically using AWS Step Functions, the pipeline enforces an ordered state transition for every conversational or transactional turn:
- **Ingest & Context Builder:** Reconstitutes user profile, cart state, active session, and short-term dialogue history.
- **NLU / Intent Parsing:** Extracts structured entities (category, hard spending ceilings, deadlines, sizing constraints).
- **Context Retrieval:** Performs hybrid parametric and dense vector search against the catalog to pull matching candidate products.
- **Campaign & Upsell Agent:** Evaluates business cross-sell logic, promotional bundles, and personalized discounts against candidate items.
- **Transaction Gating & Bounding:** The core safety checkpoint. Evaluates hard programmatic spend limits, risk scoring (e.g., XGBoost fraud/chargeback models), and circuit breakers before any money action is triggered.
- **Audit & Explainability:** Formulates structured metadata (prompt snapshots, context trees, model version, and deterministic decisions) to ensure every AI transaction is fully explainable.

#### 3. Data & Storage Tier (High Throughput & CQRS Separation)
The data layer avoids dual-write hazards and matches read/write workloads to the proper database engines:
- **ElastiCache (Redis / DAX):** Provides sub-millisecond session state caching to reduce p99 turn latencies for conversational agents.
- **Amazon DynamoDB:** Serves as the single transactional source of truth for shopping carts, agent state checkpoints, and completed orders.
- **Amazon OpenSearch Service:** Powers low-latency parametric filters and semantic vector embeddings for product discovery. Synchronized asynchronously from DynamoDB using DynamoDB Streams & OpenSearch Ingestion (OSIS).
- **Amazon S3:** High-throughput object store for product media, model artifacts, and raw JSON/XML catalog drops.
- **S3 Glacier Vault Lock (WORM):** Captures immutable audit trails via DynamoDB Streams. Enforces non-rewritable compliance logging for auditing and financial reconciliation.

#### 4. External Integrations & Webhook Ingress
- **Payment Outbound:** Once cleared by Step 5 (Transaction Gating), the orchestrator triggers settlement calls against the Razorpay Payment Gateway.
- **Isolated Webhook Ingress:** Razorpay callbacks pass through a dedicated API Gateway with HMAC Verification Lambda. Validated callbacks resume waiting state machines; unverified or forged webhooks are deflected immediately into failure queues.

#### 5. Graceful Failure Handling (Decoupled Resiliency)
- Failed orchestrations, network timeouts, or validation anomalies route directly to an Amazon EventBridge bus.
- Events buffer in an SQS Processing Queue and execute via worker runtimes (Lambda / ECS Fargate) with exponential backoff and jitter.
- Repeated failures drain into an SQS Dead Letter Queue (DLQ), triggering CloudWatch / SNS Alerts for operational visibility.

### Architecture Diagram

```mermaid
graph TD
    %% Global Styling
    classDef client fill:#388E3C,stroke:#1B5E20,stroke-width:2px,color:#FFFFFF;
    classDef edge fill:#FBC02D,stroke:#F57F17,stroke-width:2px,color:#000000;
    classDef compute fill:#512DA8,stroke:#311B92,stroke-width:2px,color:#FFFFFF;
    classDef data fill:#1976D2,stroke:#0D47A1,stroke-width:2px,color:#FFFFFF;
    classDef external fill:#FBC02D,stroke:#C49000,stroke-width:2px,color:#000000;
    classDef webhook fill:#303F9F,stroke:#1A237E,stroke-width:2px,color:#FFFFFF;
    classDef resilience fill:#FFA000,stroke:#E65100,stroke-width:2px,color:#000000;

    %% Ingress Clients
    subgraph Clients ["Ingress Actors"]
        AI_AGENT["AI Buyer Agent<br/>(NPCI UAP / ACP / AP2 / x402)"]:::client
        HUMAN["Human Shopper<br/>(Conversational UI / Web / App)"]:::client
    end

    %% External Systems
    subgraph ExternalServices ["External Gateways"]
        RAZORPAY["Razorpay Payment Gateway<br/>(Live APIs & Webhooks)"]:::external
    end

    %% Edge & Gateway Layer
    subgraph EdgeLayer ["Edge & Gateway (Scalability Layer)"]
        WAF["AWS WAF<br/>(Security & DDoS)"]:::edge
        APIGW["API Gateway<br/>(Protocol Translation & Routing)"]:::edge
        CDN["CloudFront CDN<br/>(Static Assets / Media)"]:::edge
    end

    %% Compute & Orchestrator
    subgraph OrchestrationLayer ["Compute & Orchestration Layer (AWS Step Functions)"]
        S1["1. Ingest & Context<br/>(Session, User, Cart)"]:::compute
        S2["2. NLU / Intent<br/>(Parsing & Entities)"]:::compute
        S3["3. Context Retrieval<br/>(OpenSearch Catalog)"]:::compute
        S4["4. Campaign & Upsell<br/>(Personalization & Rules)"]:::compute
        S5["5. Transaction Gating<br/>(Risk Checks & Spending Limits)"]:::compute
        S6["6. Audit & Explainability<br/>(Decision Trees & Tracing)"]:::compute
    end

    %% Storage Layer
    subgraph StorageLayer ["Data & Storage Layer (Persistence & CQRS)"]
        REDIS["ElastiCache (Redis / DAX)<br/>(Session Cache)"]:::data
        OPENSEARCH["Amazon OpenSearch Service<br/>(Vector + Parametric Search)"]:::data
        DYNAMO["AWS DynamoDB<br/>(Transactions & States)"]:::data
        S3_MEDIA["AWS S3<br/>(Catalog Media Assets)"]:::data
        S3_VAULT["S3 Glacier Vault Lock<br/>(Immutable Audit Logs)"]:::data
    end

    %% Webhook Ingress
    subgraph WebhookIngressLayer ["Webhook Ingress"]
        WH_GW["API Gateway<br/>(HMAC Signature Verification)"]:::webhook
    end

    %% Resilience & Failure Handling
    subgraph FailureLayer ["Graceful Failure Handling"]
        EVENTBRIDGE["EventBridge<br/>(Event Routing)"]:::resilience
        SQS["SQS<br/>(Processing Queue)"]:::resilience
        WORKER["Lambda / ECS Fargate<br/>(Retry / Error Logic)"]:::resilience
        DLQ["Dead Letter Queue (DLQ)<br/>(Exhausted Retries)"]:::resilience
        ALERTS["CloudWatch / SNS<br/>(Alerts & Monitoring)"]:::resilience
    end

    %% Wiring - Ingress & Edge
    AI_AGENT -->|"Agent Protocols (UAP/ACP/x402)"| WAF
    HUMAN -->|"HTTPS / WebSocket"| WAF
    HUMAN -->|"Media Requests"| CDN
    WAF --> APIGW
    APIGW --> CDN
    APIGW --> OrchestrationLayer

    %% Wiring - Compute State Machine
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S5 -->|"Payment Requests"| RAZORPAY

    %% Wiring - Compute to Storage
    S1 <-->|"Read/Write Session"| REDIS
    S1 <-->|"Transactions/State"| DYNAMO
    S3 <-->|"Query Vector/Catalog"| OPENSEARCH
    S4 <-->|"Catalog Details"| OPENSEARCH
    S4 -.->|"Read Media"| S3_MEDIA
    S6 -->|"Store Logs (via Streams)"| DYNAMO

    %% Storage Internal CDC & Sync
    DYNAMO -->|"Streams / OSIS Sync"| OPENSEARCH
    DYNAMO -->|"CDC Streams"| S3_VAULT
    CDN -->|"Pull Origin Assets"| S3_MEDIA

    %% Webhook Ingress Flow
    RAZORPAY -->|"Payment Webhook"| WH_GW
    WH_GW -->|"Verified Webhooks"| S5
    WH_GW -.->|"Validation Failures"| EVENTBRIDGE

    %% Failure Flow
    OrchestrationLayer -.->|"Execution Failure"| EVENTBRIDGE
    EVENTBRIDGE --> SQS
    SQS --> WORKER
    WORKER -->|"Failed After Retries"| DLQ
    DLQ --> ALERTS
```

### Transaction Request Flow

```mermaid
sequenceDiagram
    participant Buyer as Buyer (React UI)
    participant API as FastAPI Orchestrator
    participant Concierge as Concierge Agent (70B)
    participant Catalog as Catalog RAG Agent (8B)
    participant Neg as Negotiation Agent (70B)
    participant Risk as ML Risk Engine
    participant Pay as Payment Agent
    participant Audit as Audit Observer

    Buyer->>API: POST /api/transaction/run (user_message)
    API->>Concierge: Parse natural language intent
    Concierge-->>API: Intent JSON {category, max_budget}
    API->>Catalog: Vector search & hard-filter stock
    Catalog-->>API: Ranked candidate products
    API->>Neg: Propose product match
    Neg->>Neg: Code check: price <= guardrail_ceiling
    alt Exceeds Ceiling
        Neg-->>Buyer: Route to Human Confirmation
    else Guardrail Passed
        API->>Risk: Score fraud/return risk
        Risk-->>API: Risk Score & Feature Breakdown
        alt Score > Threshold
            Risk-->>Buyer: Force Fraud Escalation
        else Safe
            API->>Pay: Execute Razorpay Order & Payment
            Pay-->>API: Success or Single-Retry Response
            API->>Audit: Log State Transition & Broadcast WS
            Audit-->>Buyer: Transaction Complete + Audit Trail
        end
    end
```

---

## Autonomous Transaction Pipeline

The core transaction loop executes a 6-stage sequential pipeline to ensure complete financial safety and transparency:

| Stage | Agent / Module | Responsibility | Guardrail / Rule |
|---|---|---|---|
| **1. Parse Intent** | Concierge Agent | Converts natural language input into structured intent dict. | Cannot set hard spend ceiling; flags clarification if budget missing. |
| **2. Retrieve & Rank** | Catalog Agent | RAG search over merchant products; generates match justifications. | LLM only re-ranks pre-qualified in-stock catalog rows from DB. |
| **3. Guardrail Check** | Negotiation Agent | Selects target SKU and checks against maximum allowed spend limit. | Hard code check (`price <= guardrail_ceiling`). Cannot be overridden by LLM. |
| **4. Risk Assessment** | Risk Agent | Computes transaction risk score using Hybrid ML model. | ML score compared against strict tenant threshold; outputs SHAP explanations. |
| **5. Payment Execution** | Payment Agent | Calls Razorpay test-mode API endpoints for order & capture. | Hard-coded max retry = 1. Automatically escalates on 2nd failure. |
| **6. Audit & Log** | Audit/Ledger Agent | Appends immutable event to transaction audit log and broadcasts WS. | Append-only log. Events cannot be modified or deleted by any user or agent. |

### Pipeline Timing & Performance
Using Groq's LPU hardware, agent completions return within **150–300ms**, enabling live WebSocket streaming of state transitions to the UI status rail in near real-time.

---

## Multi-Agent System

![Multi-Agent Architecture](Diagrams/MultiAgentArchitecture.png)

The multi-agent system uses LangGraph to orchestrate specialized LLM and ML nodes over a shared state:

```python
class TransactionState(TypedDict):
    tenant_id: str
    session_id: str
    user_message: str
    intent: dict
    catalog_candidates: list[dict]
    chosen_product: dict | None
    guardrail_ceiling: float
    guardrail_passed: bool
    risk_score: float | None
    risk_features: dict | None
    payment_attempts: list[dict]
    payment_status: Literal["pending", "success", "failed", "escalated"]
    escalation_message: str | None
    audit_log: list[dict]
    current_agent: str
```

### Core Agents

| Agent | File | Model | Key Responsibility |
|---|---|---|---|
| **Concierge Agent** | `app/agents/concierge_agent.py` | `llama-3.3-70b-versatile` | Natural language intent extraction into structured JSON schema. |
| **Catalog Agent** | `app/agents/catalog_agent.py` | `llama-3.1-8b-instant` | RAG retrieval, catalog filtering, and match justification. |
| **Negotiation Agent** | `app/agents/decision_agent.py` | `llama-3.3-70b-versatile` | Product selection and code-level spend ceiling verification. |
| **Risk Agent** | `app/agents/risk_agent.py` | XGBoost + LightGBM | ML-based fraud risk scoring & SHAP feature translation. |
| **Payment Agent** | `app/agents/payment_execution_agent.py` | `llama-3.1-8b-instant` | Razorpay API integration with fixed 1-retry fallback logic. |
| **Audit Agent** | `app/agents/ledger_agent.py` | `llama-3.3-70b-versatile` | Append-only event auditing & WebSocket streaming. |
| **Merchant Insights** | `app/agents/merchant_insights_agent.py` | `llama-3.1-8b-instant` | Asynchronous merchant revenue & acceptance analytics. |

---

## Machine Learning Risk Engine

### Zero Cold-Start Hybrid Model
The Glassbox risk engine relies on a custom soft-voting ensemble (`app/ml/inference.py`) combining:
1. **XGBoost Classifier:** Depth-wise tree growth for high-dimensional feature split resolution.
2. **LightGBM Classifier:** Leaf-wise histogram binning for fast evaluation.

### Model Features & Training
- **Dataset:** Trained on 6.36 million transaction records from the PaySim dataset (`app/ml/train.py`).
- **Features Evaluated:** Transaction amount deviation, session request velocity, hour of day, category risk priors, historical merchant SKU return rates.
- **Graceful Fallback:** If ML dependencies (`xgboost`/`lightgbm`) are not installed in the execution environment, the backend automatically transitions to a deterministic rule-based risk calculator without service disruption.

> **Evaluation Caveat (PaySim Synthetic Data):** PaySim fraud examples contain a near-deterministic balance-drain signature for `TRANSFER` and `CASH_OUT` transactions, producing near-perfect separability on test splits. The model is presented as a demonstration trained on synthetic data.

---

## Enterprise Governance & Security

### 1. Role-Based Access Control (RBAC)

| Role | Access Scope | Permissions |
|---|---|---|
| `platform_admin` | Global / Cross-tenant | System health, global metrics, tenant provisioning. |
| `merchant_admin` | Tenant-scoped | Update spend ceilings, view revenue intelligence, manage catalog. |
| `buyer` | User-scoped | Initiate transactions, view order history, interact with copilot. |

### 2. Deep Security Protocols
- **SSRF Defense (`app/core/security.py`):** Resolves all outbound request URLs to IP addresses and blocks calls to private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopbacks (`127.0.0.1`), and cloud metadata endpoints (`169.254.169.254`).
- **Domain Allowlisting:** Strict whitelist for outbound API destinations (`api.razorpay.com`, `api.groq.com`).
- **Webhook Verification (`app/routes/webhooks.py`):** Validates HMAC-SHA256 signatures against `X-Razorpay-Signature` using tenant secret keys to prevent webhook forgery.

---

## Frontend Application

The Glassbox frontend is a modern React 19 Single Page Application built with Vite 8 and TypeScript.

### Application Pages

| Route | Page File | Purpose |
|---|---|---|
| `/` | `LandingPage.tsx` | Product introduction and feature overview. |
| `/login` | `LoginPage.tsx` | User authentication via JWT credentials. |
| `/register` | `RegisterPage.tsx` | User & tenant registration. |
| `/checkout` | `CheckoutPage.tsx` | Interactive agent checkout UI with live status rail & chat. |
| `/dashboard` | `DashboardPage.tsx` | Merchant revenue intelligence & catalog management dashboard. |
| `/profile` | `ProfilePage.tsx` | User profile & tenant spend ceiling configuration. |
| `/history` | `HistoryPage.tsx` | Transaction history & audit log inspector. |

---

## Backend API Engine

FastAPI backend engine exposed at `http://localhost:8000` with auto-generated Swagger documentation at `/docs`.

### Key Endpoints

| Category | Endpoint | Method | Description |
|---|---|---|---|
| **Auth** | `/api/auth/register` | `POST` | Register a new user (`buyer` or `merchant_admin`). |
| **Auth** | `/api/auth/login` | `POST` | Authenticate user credentials and return HS256 JWT. |
| **Profile** | `/api/profile/me` | `GET` | Retrieve authenticated user profile. |
| **Profile** | `/api/profile/tenant` | `PATCH` | Update tenant spend ceiling (Merchant Admin only). |
| **Transaction** | `/api/transaction/run` | `POST` | Execute full 6-agent transaction pipeline. |
| **Transaction** | `/api/transaction/{session_id}` | `GET` | Fetch transaction details and complete audit trail. |
| **Transaction** | `/api/transaction/ws/{session_id}` | `WS` | WebSocket endpoint for real-time agent event streaming. |
| **Insights** | `/api/transaction/insights/{tenant_id}` | `GET` | Fetch merchant revenue intelligence metrics. |
| **Risk** | `/api/risk/predict` | `POST` | Score standalone transaction using Hybrid ML engine. |
| **Webhooks** | `/api/webhooks/razorpay` | `POST` | Receive signed Razorpay webhook event notifications. |
| **Health** | `/api/health` | `GET` | Lightweight system health check endpoint. |

---

## Project Structure

```text
RazorPay/
├── Backend/                            # FastAPI Backend Application
│   ├── main.py                         # FastAPI App Factory & Middleware Entry
│   ├── lambda_handler.py               # AWS Lambda Mangum Handler Entrypoint
│   ├── serverless.yml                  # AWS Cloud Serverless Infrastructure as Code
│   ├── agentic_architecture.md         # Dedicated Agent Architecture Specs
│   ├── requirements.txt                # Python Dependencies
│   └── app/
│       ├── agents/                     # LangGraph Multi-Agent Nodes
│       │   ├── concierge_agent.py      # Intent Parsing Node
│       │   ├── catalog_agent.py        # RAG Catalog Retrieval Node
│       │   ├── decision_agent.py       # Negotiation & Spend Ceiling Node
│       │   ├── risk_agent.py           # ML Fraud Scoring Node
│       │   ├── payment_execution_agent.py # Razorpay API Execution Node
│       │   ├── ledger_agent.py         # Audit Ledger Observer Node
│       │   ├── merchant_insights_agent.py # Async Analytics Node
│       │   └── orchaestartor_langgraph.py # Main LangGraph Graph Router
│       ├── services/                   # Cloud Services & Integrations
│       │   ├── aws_step_functions.py   # AWS Step Functions AI Agent Orchestrator
│       │   └── aws_eventbridge.py      # AWS EventBridge Telemetry Bus
│       ├── auth/                       # JWT & PBKDF2 Primitives
│       ├── core/                       # Config, SSRF Guard, Webhook Validator
│       ├── db/                         # Database Schema & Seeding Scripts
│       ├── ml/                         # Hybrid ML Inference & Training
│       └── routes/                     # REST API Routers
│
├── Frontend/                           # React 19 + Vite 8 SPA
│   ├── package.json                    # Frontend Node Dependencies
│   └── src/
│       ├── pages/                      # Page Views (Checkout, Dashboard, etc.)
│       ├── components/                 # UI Components & Status Rails
│       ├── context/                    # Auth & Theme Context Providers
│       ├── hooks/                      # Custom Hooks & WebSocket Drivers
│       └── lib/                        # API Client Utilities
│
├── Diagrams/                           # High-Resolution Architectural Diagrams
│   ├── Architecture.png                # Full System Architecture Diagram
│   └── MultiAgentArchitecture.png      # Multi-Agent LangGraph Diagram
│
└── Prompts/                            # System Specs & Guidelines
    ├── Agents.md                       # Comprehensive Agent Design Specifications
    ├── ML.md                           # Machine Learning Design Specifications
    └── PS.md                           # Problem Statement Context
```

---

## Environment Configuration

### Backend Configuration (`Backend/.env`)
```env
# Application Settings
ENVIRONMENT=development
SECRET_KEY=your-super-secret-jwt-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Groq LLM Settings
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL_REASONING=llama-3.3-70b-versatile
GROQ_MODEL_FAST=llama-3.1-8b-instant

# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Security Controls
ALLOWED_DOMAINS=api.razorpay.com,api.groq.com
ENABLE_SSRF_PROTECTION=true
```

### Frontend Configuration (`Frontend/.env`)
```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/api/transaction/ws
```

---

## Local Development & Demo Setup

### 1. Backend Setup
```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Initialize SQLite database and seed test catalog
python app/db/database.py
python app/db/seed.py

# Launch FastAPI Server
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```powershell
cd Frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser to access the application.

---

## Production Deployment

### Containerized Deployment (Docker Compose)
```yaml
version: '3.8'
services:
  backend:
    build: ./Backend
    ports:
      - "8000:8000"
    env_file: ./Backend/.env
    volumes:
      - sqlite_data:/app/glassbox_db

  frontend:
    build: ./Frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  sqlite_data:
```

---

## Model Evaluation & Audit Metrics

| Metric | XGBoost Solo | LightGBM Solo | Hybrid Soft-Voting |
|---|---|---|---|
| **Precision** | 0.984 | 0.978 | **0.991** |
| **Recall** | 0.971 | 0.965 | **0.982** |
| **F1-Score** | 0.977 | 0.971 | **0.986** |
| **PR-AUC** | 0.989 | 0.982 | **0.994** |

---

## Testing

Run unit and integration test suites:

```powershell
# Backend Test Suite
cd Backend
pytest tests/ -v

# Frontend Test Suite
cd Frontend
npm run test
```

---

## Sample Data & Seeding

The database includes seed data created via `python app/db/seed.py`:
- **Default Tenant:** `tenant_demo_01` (Default spend ceiling: ₹5,000)
- **Demo Users:**
  - `buyer@glassbox.local` (Role: `buyer`)
  - `merchant@glassbox.local` (Role: `merchant_admin`)
- **Sample Catalog:** Products across Electronics, Apparel, and Home Goods with embedded vector representations.

---

## Architecture Evolution Phases

| Phase | Focus | Status |
|---|---|---|
| **Phase 0** | Core 6-Agent LangGraph Pipeline & Groq Integration | Completed |
| **Phase 1** | Deterministic Guardrail Ceiling & Code Checks | Completed |
| **Phase 2** | PaySim Hybrid ML Risk Engine (XGBoost + LightGBM) | Completed |
| **Phase 3** | WebSocket Real-Time Agent Status Rail Streaming | Completed |
| **Phase 4** | SSRF Defense & Webhook Signature Security | Completed |
| **Phase 5** | Merchant Revenue Intelligence & Async Analytics | Completed |

---

## Diagrams & Documentation

- **[System Architecture](Diagrams/Architecture.png)**: High-level component interaction and network bounds.
- **[Multi-Agent Architecture](Diagrams/MultiAgentArchitecture.png)**: LangGraph state graph routing and agent roles.
- **[Agent Architecture Specifications](Backend/agentic_architecture.md)**: Deep dive into state schema and node parameters.
- **[Prompts & Agent Guidelines](Prompts/Agents.md)**: Original prompt guidelines and system specifications.

---

## Quick Reference

| Resource | Local URL | Description |
|---|---|---|
| **Frontend Application** | `http://localhost:5173` | React Single Page Application. |
| **Backend REST API** | `http://localhost:8000` | FastAPI server root. |
| **Swagger API Docs** | `http://localhost:8000/docs` | Interactive OpenAPI documentation. |
| **WebSocket Stream** | `ws://localhost:8000/api/transaction/ws/{session_id}` | Agent status rail event stream. |
| **Health Check** | `http://localhost:8000/api/health` | System health endpoint. |

---

## Acknowledgments

Built with pride for the **Razorpay Buildathon 2026**. Powered by **Groq LPUs**, **LangGraph**, **FastAPI**, **Razorpay Test-Mode APIs**, and **React 19**.
