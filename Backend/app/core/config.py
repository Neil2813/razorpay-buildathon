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

    # Database Configuration
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", os.path.join(BASE_DIR, "glassbox.db"))

    # Razorpay Integration Configuration
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mock_key")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "mock_secret")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "glassbox_webhook_secret_key")

    # Security & SSRF Protection
    ALLOWED_OUTBOUND_DOMAINS: list[str] = [
        "api.razorpay.com",
        "api.groq.com",
        "supabase.co",
        "127.0.0.1",
        "localhost",
    ]


settings = Settings()
