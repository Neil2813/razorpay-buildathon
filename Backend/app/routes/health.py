"""
Health check routes.
"""

from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/")
def root():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}


@router.get("/health")
def health():
    architecture_mode = (
        "AWS Serverless (CloudFront + Step Functions + EventBridge)"
        if settings.ENABLE_AWS_SERVERLESS
        else "Local Fallback (FastAPI + LangGraph + SQLite)"
    )
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "architecture_mode": architecture_mode,
        "aws_features": {
            "aws_serverless_enabled": settings.ENABLE_AWS_SERVERLESS,
            "aws_step_functions_enabled": settings.ENABLE_AWS_STEP_FUNCTIONS,
            "aws_eventbridge_enabled": settings.ENABLE_AWS_EVENTBRIDGE,
            "cloudfront_domain": settings.CLOUDFRONT_DOMAIN or "Localhost / Direct Origin",
            "region": settings.AWS_REGION,
        },
    }
