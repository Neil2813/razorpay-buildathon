"""
Core configuration settings for GlassBox Backend.
"""

import os
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Settings(BaseModel):
    PROJECT_NAME: str = "GlassBox Risk Agent API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # CORS Configuration
    CORS_ORIGINS: list[str] = ["*"]

    # Database & Supabase Configuration
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", os.path.join(BASE_DIR, "glassbox.db"))
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "glassbox_jwt_secret_key_change_in_production_32bytes")


    # Razorpay Integration Configuration
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mock_key")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "mock_secret")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "glassbox_webhook_secret_key")

    # SerpAPI Configuration
    SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "")

    # Security & SSRF Protection
    ALLOWED_OUTBOUND_DOMAINS: list[str] = [
        "api.razorpay.com",
        "api.groq.com",
        "serpapi.com",
        "supabase.co",
        "127.0.0.1",
        "localhost",
    ]

    # AWS Architecture & Serverless Configuration (Local Fallback by Default)
    ENABLE_AWS_SERVERLESS: bool = os.getenv("ENABLE_AWS_SERVERLESS", "false").lower() in ("true", "1")
    ENABLE_AWS_STEP_FUNCTIONS: bool = os.getenv("ENABLE_AWS_STEP_FUNCTIONS", "false").lower() in ("true", "1")
    ENABLE_AWS_EVENTBRIDGE: bool = os.getenv("ENABLE_AWS_EVENTBRIDGE", "false").lower() in ("true", "1")
    AWS_REGION: str = os.getenv("AWS_REGION", "ap-south-1")
    AWS_EVENTBUS_NAME: str = os.getenv("AWS_EVENTBUS_NAME", "glassbox-events")
    AWS_STEP_FUNCTIONS_ARN: str = os.getenv("AWS_STEP_FUNCTIONS_ARN", "")
    CLOUDFRONT_DOMAIN: str = os.getenv("CLOUDFRONT_DOMAIN", "")


settings = Settings()
