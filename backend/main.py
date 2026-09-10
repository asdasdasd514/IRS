"""
IRS Mobile Admissions System - FastAPI Backend (MongoDB Database IRS)
Hệ thống Hỗ trợ Ra quyết định Lộ trình và Quản lý Chiến dịch Tuyển sinh Lưu động
"""

from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.router import api_router


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

# Chỉ đăng ký qua api_router (prefix /api chuẩn RESTful)
app.include_router(api_router)

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


@app.get("/api/cache/stats", tags=["Cache"])
async def get_cache_stats():
    """Xem thống kê tỷ lệ trúng cache (hit ratio), số lượng key và dung lượng bộ nhớ đệm"""
    from app.core.cache import (
        distance_matrix_cache,
        directions_cache,
        places_cache,
        maps_link_cache,
        api_response_cache
    )
    return {
        "status": "ok",
        "default_ttl_seconds": 300,
        "caches": {
            "distance_matrix": distance_matrix_cache.stats(),
            "directions": directions_cache.stats(),
            "places": places_cache.stats(),
            "maps_link": maps_link_cache.stats(),
            "api_response": api_response_cache.stats(),
        }
    }


@app.post("/api/cache/clear", tags=["Cache"])
async def clear_all_caches():
    """Làm sạch toàn bộ cache hệ thống"""
    from app.core.cache import (
        distance_matrix_cache,
        directions_cache,
        places_cache,
        maps_link_cache,
        api_response_cache
    )
    distance_matrix_cache.clear()
    directions_cache.clear()
    places_cache.clear()
    maps_link_cache.clear()
    api_response_cache.clear()
    return {"status": "ok", "message": "Đã làm sạch toàn bộ cache hệ thống"}


@app.get("/swagger", include_in_schema=False)
@app.get("/api/docs", include_in_schema=False)
async def swagger_redirect():
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
