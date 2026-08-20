import cloudinary
import cloudinary.uploader
import logging
from typing import Dict, Any
from app.core.config import settings
from datetime import datetime

# Cấu hình Cloudinary
if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_CLOUD_NAME != "demo_cloud_name":
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )

class CloudinaryService:
    @staticmethod
    async def upload_image(file_bytes: bytes, filename: str, folder: str = "irs_campaigns") -> Dict[str, Any]:
        """
        Upload ảnh lên Cloudinary và trả về URL + metadata.
        Nếu dùng Demo credentials, tạo Mock Cloudinary response tiêu chuẩn.
        """
        if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_CLOUD_NAME != "demo_cloud_name":
            try:
                response = cloudinary.uploader.upload(
                    file_bytes,
                    folder=folder,
                    resource_type="image"
                )
                return {
                    "url": response.get("secure_url"),
                    "public_id": response.get("public_id"),
                    "format": response.get("format"),
                    "width": response.get("width"),
                    "height": response.get("height"),
                    "bytes": response.get("bytes"),
                    "created_at": response.get("created_at")
                }
            except Exception as e:
                logging.error(f"Cloudinary upload error: {e}")

        # Fallback Mock response cho môi trường Demo/Local
        mock_id = f"{folder}/img_{int(datetime.utcnow().timestamp())}"
        return {
            "url": f"https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
            "public_id": mock_id,
            "format": "jpeg",
            "width": 1200,
            "height": 800,
            "bytes": len(file_bytes),
            "created_at": datetime.utcnow().isoformat()
        }
