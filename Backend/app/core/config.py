"""
Core configuration settings for GlassBox Backend.
"""

from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "GlassBox Risk Agent API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # CORS Configuration
    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()
