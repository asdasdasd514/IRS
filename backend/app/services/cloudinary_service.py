import cloudinary
import cloudinary.uploader
import logging
from typing import Dict, Any, Optional
from app.core.config import settings
from datetime import datetime

logger = logging.getLogger(__name__)


def configure_cloudinary() -> bool:
    """Cấu hình Cloudinary từ settings hoặc environment variable."""
    cloud_name = getattr(settings, "CLOUDINARY_CLOUD_NAME", "")
    api_key = getattr(settings, "CLOUDINARY_API_KEY", "")
    api_secret = getattr(settings, "CLOUDINARY_API_SECRET", "")

    if cloud_name and cloud_name != "demo_cloud_name" and api_key and api_secret:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        return True

    cloudinary_url = getattr(settings, "CLOUDINARY_URL", "")
    if cloudinary_url:
        import os
        os.environ["CLOUDINARY_URL"] = cloudinary_url
        cloudinary.reset_config()
        return True

    return False



# Nạp cấu hình Cloudinary nếu có sẵn
_is_ready = configure_cloudinary()


class CloudinaryService:
    @staticmethod
    def is_available() -> bool:
        """Kiểm tra xem Cloudinary đã được cấu hình đầy đủ chưa."""
        return configure_cloudinary()

    @staticmethod
    async def upload_image(file_bytes: bytes, filename: str, folder: str = "irs_campaigns") -> Dict[str, Any]:
        """
        Upload ảnh lên Cloudinary và trả về URL + metadata.
        Nếu dùng Demo credentials hoặc chưa đủ config, tạo Mock Cloudinary response tiêu chuẩn.
        """
        if CloudinaryService.is_available():
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
                logger.error(f"Cloudinary upload error: {e}")

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

