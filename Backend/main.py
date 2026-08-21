"""
GlassBox Risk Agent -- FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.health import router as health_router
from app.routes.risk import router as risk_router
from app.routes.webhooks import router as webhooks_router

try:
    from app.ml.inference import get_model
    HAS_ML = True
except (ImportError, ModuleNotFoundError):
    HAS_ML = False
    def get_model():
        print("[startup] ML dependencies not available. Skipping model pre-loading.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load ML model during startup for zero cold-start latency."""
    print("[startup] Pre-loading risk model...")
    try:
        get_model()
        if HAS_ML:
            print("[startup] Risk model loaded and ready.")
        else:
            print("[startup] Server started in rule-based fallback mode (no ML dependencies).")
    except FileNotFoundError as e:
        print(f"[startup] WARNING: {e}")
        print("[startup] Server started, but /api/risk/predict will use rule-based fallback until model is trained.")
    yield


def create_app() -> FastAPI:
    """Application factory for FastAPI service."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=(
            "Fraud risk scoring service powered by an XGBoost model "
            "trained on the PaySim synthetic mobile-money dataset."
        ),
        version=settings.VERSION,
        lifespan=lifespan,
    )

    # Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include Routers
    app.include_router(health_router)
    app.include_router(risk_router, prefix=settings.API_V1_STR)
    app.include_router(webhooks_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
