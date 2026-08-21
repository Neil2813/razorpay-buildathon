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


settings = Settings()
