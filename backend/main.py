import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.db.mongodb import connect_to_mongo, close_mongo_connection

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Nền tảng Hỗ trợ Ra quyết định Lộ trình và Quản lý Chiến dịch Tuyển sinh Lưu động (FastAPI + MongoDB + Cloudinary + SerpAPI Google Maps)",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup / Shutdown Events
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

# Include API Router
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "title": settings.PROJECT_NAME,
        "status": "running",
        "docs": "/docs",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
