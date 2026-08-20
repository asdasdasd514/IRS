import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "IRS Mobile Admissions Platform API"
    ENV: str = "development"
    PORT: int = 8000
    
    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "irs_admissions_db"
    
    # JWT
    JWT_SECRET_KEY: str = "irs_super_secret_jwt_key_2026_admissions_platform"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200
    
    # External APIs
    SERPAPI_KEY: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:4173"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
