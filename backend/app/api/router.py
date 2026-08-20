from fastapi import APIRouter
from app.api.endpoints import auth, campaigns, routes, upload

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Admissions Campaigns"])
api_router.include_router(routes.router, prefix="/routes", tags=["Route Optimization & Distance Matrix"])
api_router.include_router(upload.router, prefix="/upload", tags=["Cloudinary Image Upload"])
