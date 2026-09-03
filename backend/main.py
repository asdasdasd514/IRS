"""
IRS Mobile Admissions System - FastAPI Backend (MongoDB Database IRS)
Hệ thống Hỗ trợ Ra quyết định Lộ trình và Quản lý Chiến dịch Tuyển sinh Lưu động
"""

from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.router import api_router
from app.api import auth, waypoint_info, upload, trips, campaigns, schools


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="Hệ thống Hỗ trợ Ra quyết định Lộ trình và Quản lý Chiến dịch Tuyển sinh Lưu động",
    description="Backend API nền tảng tuyển sinh lưu động với thuật toán Dynamic Next-Hop Routing (MongoDB IRS)",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thêm routes với prefix /api và không prefix
app.include_router(api_router)
app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(waypoint_info.router)
app.include_router(upload.router)
app.include_router(campaigns.router)
app.include_router(schools.router)

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/")
async def root():
    return {
        "status": "ok",
        "app": "Nền tảng Hỗ trợ Ra quyết định Lộ trình & Quản lý Chiến dịch Tuyển sinh Lưu động",
        "database": settings.DATABASE_NAME,
        "version": "2.0.0"
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "database": "IRS"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
