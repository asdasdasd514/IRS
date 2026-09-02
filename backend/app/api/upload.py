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
        
        image_doc = {
            "id": img_id,
            "visit_log_id": visit_log_id,
            "file_path": relative_path,
            "filename": file.filename,
            "content_type": content_type,
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
    
    file_path = Path(settings.UPLOAD_DIR) / image["file_path"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk")
    
    return FileResponse(
        path=file_path,
        media_type=image.get("content_type", "image/jpeg"),
        filename=image.get("filename")
    )


@router.delete("/images/{image_id}")
async def delete_image(image_id: str):
    db = get_database()
    image = await db.waypoint_images.find_one({"id": image_id})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        file_path = Path(settings.UPLOAD_DIR) / image["file_path"]
        if file_path.exists():
            file_path.unlink()
        
        await db.waypoint_images.delete_one({"id": image_id})
        return {"success": True, "message": "Image deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
