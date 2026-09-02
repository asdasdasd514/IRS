from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "IRS Mobile Admissions System"
    DEBUG: bool = True
    PORT: int = 8000
    SECRET_KEY: str = "irs_super_secret_jwt_key_2026_admissions_platform"
    JWT_SECRET_KEY: str = "irs_super_secret_jwt_key_2026_admissions_platform"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200
    
    # Database MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "IRS"
    
    # SerpAPI (for Google Maps)
    SERPAPI_KEY: str = ""
    
    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:4173,http://localhost:3000"
    
    # Upload
    UPLOAD_DIR: str = "uploads"
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
