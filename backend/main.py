"""
IRS Mobile Admissions System - FastAPI Backend (MongoDB Database IRS)
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
from app.api import auth, waypoint_info, upload, trips


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title=settings.APP_NAME,
    description="Hệ thống định tuyến tuyển sinh với thuật toán Dynamic Next-Hop Routing (MongoDB IRS)",
    version="1.0.0",
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

# Thêm routes với prefix /api và không prefix để khớp với tất cả request
app.include_router(api_router)
app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(waypoint_info.router)
app.include_router(upload.router)

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/")
async def root():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "database": settings.DATABASE_NAME,
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "database": "IRS"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
