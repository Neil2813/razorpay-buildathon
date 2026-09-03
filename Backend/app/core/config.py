"""
Core configuration settings for GlassBox Backend.
"""

import os
from pathlib import Path
from pydantic import BaseModel

# Load .env from the project root before any os.getenv() calls are evaluated.
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(dotenv_path=_env_path, override=False)
except ImportError:
    pass  # python-dotenv not installed; rely on OS environment being pre-set

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

    # AWS Architecture & Feature Flags 
    ENABLE_AWS_SERVERLESS: bool = os.getenv("ENABLE_AWS_SERVERLESS", "false").lower() in ("true", "1")
    ENABLE_AWS_STEP_FUNCTIONS: bool = os.getenv("ENABLE_AWS_STEP_FUNCTIONS", "false").lower() in ("true", "1")
    ENABLE_AWS_EVENTBRIDGE: bool = os.getenv("ENABLE_AWS_EVENTBRIDGE", "false").lower() in ("true", "1")
    ENABLE_AWS_DYNAMODB: bool = os.getenv("ENABLE_AWS_DYNAMODB", "false").lower() in ("true", "1")
    ENABLE_AWS_OPENSEARCH: bool = os.getenv("ENABLE_AWS_OPENSEARCH", "false").lower() in ("true", "1")
    ENABLE_AWS_S3: bool = os.getenv("ENABLE_AWS_S3", "false").lower() in ("true", "1")
    ENABLE_AWS_ELASTICACHE: bool = os.getenv("ENABLE_AWS_ELASTICACHE", "false").lower() in ("true", "1")
    ENABLE_AWS_SQS: bool = os.getenv("ENABLE_AWS_SQS", "false").lower() in ("true", "1")
    ENABLE_AWS_WAF: bool = os.getenv("ENABLE_AWS_WAF", "false").lower() in ("true", "1")

    # AWS Resource & Endpoint Configuration
    AWS_REGION: str = os.getenv("AWS_REGION", "ap-south-1")
    AWS_EVENTBUS_NAME: str = os.getenv("AWS_EVENTBUS_NAME", "glassbox-events")
    AWS_STEP_FUNCTIONS_ARN: str = os.getenv("AWS_STEP_FUNCTIONS_ARN", "")
    DYNAMODB_TABLE_NAME: str = os.getenv("DYNAMODB_TABLE_NAME", "glassbox_transactions")
    OPENSEARCH_ENDPOINT: str = os.getenv("OPENSEARCH_ENDPOINT", "")
    S3_AUDIT_BUCKET: str = os.getenv("S3_AUDIT_BUCKET", "glassbox-audit-vault-logs")
    ELASTICACHE_REDIS_URL: str = os.getenv("ELASTICACHE_REDIS_URL", "")
    SQS_QUEUE_URL: str = os.getenv("SQS_QUEUE_URL", "")
    SQS_DLQ_URL: str = os.getenv("SQS_DLQ_URL", "")
    CLOUDFRONT_DOMAIN: str = os.getenv("CLOUDFRONT_DOMAIN", "")


settings = Settings()
