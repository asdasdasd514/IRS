from fastapi import APIRouter
from app.api import auth, trips, upload, waypoint_info

api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router)
api_router.include_router(trips.router)
api_router.include_router(upload.router)
api_router.include_router(waypoint_info.router)
