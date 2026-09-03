# GlassBox Frontend - AI Agentic Commerce UI

This is the frontend application for the **GLASSBOX** agentic commerce system. It provides a real-time, conversational interface for buyers to interact with the LangGraph multi-agent backend, as well as a comprehensive dashboard for merchants to view insights and manage tenant configurations.

> **Deployment Status:** The frontend runs locally via Vite for local development & demonstration, connecting to the local FastAPI backend (`http://localhost:8000`). For production deployment, it targets cloud static web hosting (AWS CloudFront CDN / S3) configured to interface with AWS API Gateway WebSocket and REST endpoints.

## Technology Stack

- **Framework:** React 19, Vite 8, TypeScript 5.6
- **Styling:** Tailwind CSS 4, Shadcn UI
- **Routing & State:** React Router DOM 6, Custom WebSocket Hooks
- **Icons & Animations:** Lucide React, Framer Motion

## Features

- **Live Agent Status Rail:** Real-time WebSocket connection to the backend to display the exact status of the 6-agent transaction pipeline (Concierge → Catalog → Negotiation → Risk → Payment → Audit).
- **Conversational Checkout:** A chat-like interface where buyers can state their purchasing intent in natural language.
- **Merchant Dashboard:** Secure area for merchants (using JWT auth) to view AI buyer acceptance rates, top escalation reasons, and manage spend ceilings.
- **Responsive Design:** Fully responsive UI built with Tailwind CSS and Shadcn UI components.

## Environment Configuration

### Local Development (`Frontend/.env`)
```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/api/transaction/ws
```

### AWS Production Target (`Frontend/.env.production`)
```env
VITE_API_URL=https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/prod/api
VITE_WS_URL=wss://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/prod/api/transaction/ws
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm, yarn, or pnpm

### Installation
```powershell
cd Frontend
npm install
```

### Running the Development Server
```powershell
npm run dev
```
The application will be available at `http://localhost:5173`.

### Connecting to the Backend
Ensure the FastAPI backend is running on `http://localhost:8000` (or as configured in `.env`). The frontend uses this URL for REST API calls and WebSocket connections to stream agent events in real time (<300ms latency).
