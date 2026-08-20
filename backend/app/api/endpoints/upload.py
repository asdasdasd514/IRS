from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.services.cloudinary_service import CloudinaryService
from app.models.schemas import ImageMetadataResponse
from app.db.mongodb import get_database

router = APIRouter()

@router.post("/image", response_model=ImageMetadataResponse)
async def upload_campaign_image(
    file: UploadFile = File(...),
    campaign_id: Optional[str] = Form(None)
):
    """
    Tải lên hình ảnh chiến dịch (sau khi client đã nén và chuyển HEIC -> JPEG).
    Cloudinary xử lý lưu trữ, MongoDB chỉ lưu URL và Metadata của ảnh.
    """
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="File rỗng")

    # Upload sang Cloudinary
    cloudinary_res = await CloudinaryService.upload_image(contents, file.filename or "image.jpg")

    # Lưu URL & Metadata vào MongoDB (nếu có campaign_id)
    if campaign_id:
        db = get_database()
        if db is not None:
            try:
                await db.campaigns.update_one(
                    {"_id": campaign_id},
                    {"$push": {"images": cloudinary_res}}
                )
            except Exception:
                pass

    return ImageMetadataResponse(**cloudinary_res)
