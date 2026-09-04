"""
File Upload API (MongoDB IRS Database)
Upload images and save to disk, store metadata in MongoDB
"""

import uuid
import asyncio
from pathlib import Path
from typing import List
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse

from app.core.database import get_database
from app.core.config import settings
from app.services.cloudinary_service import CloudinaryService

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR) / "waypoint_images"
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

CONTENT_TYPE_MAP = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
}


async def _write_file(path: Path, content: bytes):
    loop = asyncio.get_event_loop()
    def write():
        with open(path, "wb") as f:
            f.write(content)
    await loop.run_in_executor(None, write)


@router.post("/images/{visit_log_id}")
async def upload_images(
    visit_log_id: str,
    files: List[UploadFile] = File(...)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    db = get_database()
    image_ids = []
    
    for file in files:
        if not file.filename:
            raise HTTPException(status_code=400, detail="File has no filename")
        
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} too large. Max size: 10MB"
            )
        
        img_id = str(uuid.uuid4())
        saved_filename = f"{img_id}{file_ext}"
        saved_path = UPLOAD_DIR / saved_filename
        
        await _write_file(saved_path, content)
        
        relative_path = f"waypoint_images/{saved_filename}"
        content_type = CONTENT_TYPE_MAP.get(file_ext, 'image/jpeg')
        
        # Upload lên Cloudinary nếu có cấu hình
        cloudinary_res = None
        if CloudinaryService.is_available():
            try:
                cloudinary_res = await CloudinaryService.upload_image(
                    content,
                    filename=file.filename or saved_filename,
                    folder="irs_waypoint_images"
                )
            except Exception:
                pass

        image_doc = {
            "id": img_id,
            "visit_log_id": visit_log_id,
            "file_path": relative_path,
            "filename": file.filename,
            "content_type": content_type,
            "cloudinary_url": cloudinary_res.get("url") if cloudinary_res else None,
            "cloudinary_public_id": cloudinary_res.get("public_id") if cloudinary_res else None,
            "created_at": datetime.utcnow()
        }
        await db.waypoint_images.insert_one(image_doc)
        image_ids.append(img_id)
    
    return JSONResponse({
        "success": True,
        "image_ids": image_ids,
        "count": len(image_ids)
    })


@router.get("/images/{image_id}")
async def get_image(image_id: str):
    db = get_database()
    image = await db.waypoint_images.find_one({"id": image_id})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Ưu tiên chuyển hướng tới link Cloudinary CDN nếu có
    if image.get("cloudinary_url") and not image["cloudinary_url"].endswith("sample.jpg"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=image["cloudinary_url"])

    file_path = Path(settings.UPLOAD_DIR) / image["file_path"]
    if not file_path.exists():
        if image.get("cloudinary_url"):
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=image["cloudinary_url"])
        raise HTTPException(status_code=404, detail="Image file not found on disk")
    
    return FileResponse(
        path=file_path,
        media_type=image.get("content_type", "image/jpeg"),
        filename=image.get("filename")
    )


@router.delete("/images/{image_id}")
async def delete_image(image_id: str):
    db = get_database()
    image = await db.waypoint_images.find_one({"id": image_id, "is_deleted": {"$ne": True}})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        now = datetime.utcnow()
        await db.waypoint_images.update_one(
            {"id": image_id},
            {"$set": {"is_deleted": True, "deleted_at": now}}
        )
        return {"success": True, "message": "Image soft-deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

