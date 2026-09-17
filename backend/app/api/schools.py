"""
School API Endpoints - Quản lý Danh mục Trường THPT Mục tiêu Tuyển sinh
Hồ sơ trường học lưu trữ tập trung, chuẩn hóa: Ban giám hiệu, mô tả, tuyển sinh, liên hệ, website.
"""

import uuid
import re
import unicodedata
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile

from app.core.database import get_database
from app.schemas import SchoolCreate, SchoolUpdate, SchoolResponse
from app.services.auth_service import get_current_user
from app.services.cloudinary_service import CloudinaryService

router = APIRouter(prefix="/schools", tags=["Schools"])


@router.get("", response_model=List[SchoolResponse])
async def list_schools(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {"is_deleted": {"$ne": True}}
    if search:
        search_regex = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"code": search_regex},
            {"address": search_regex}
        ]

    cursor = db.schools.find(query).sort("created_at", -1)
    schools = await cursor.to_list(length=500)
    return schools


from bson import ObjectId


def get_school_filter(school_id: str):
    or_clauses = [{"id": school_id}, {"code": school_id}]
    if ObjectId.is_valid(school_id):
        or_clauses.append({"_id": ObjectId(school_id)})
    return {"$or": or_clauses, "is_deleted": {"$ne": True}}


@router.get("/{school_id}", response_model=SchoolResponse)
async def get_school(school_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    school = await db.schools.find_one(get_school_filter(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")
    if "id" not in school or not school["id"]:
        school["id"] = str(school["_id"])
    return school


@router.post("", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
async def create_school(
    school_data: SchoolCreate,
    current_user: dict = Depends(get_current_user)
):
    import uuid
    db = get_database()
    now = datetime.now(timezone.utc)
    
    code = school_data.code.strip() if school_data.code and school_data.code.strip() else f"SCH-{uuid.uuid4().hex[:6].upper()}"
    school_id = school_data.id or str(uuid.uuid4())
    
    existing = await db.schools.find_one({"code": code, "is_deleted": {"$ne": True}})
    if existing:
        raise HTTPException(status_code=400, detail="Mã trường này đã tồn tại trong hệ thống")

    dumped = school_data.model_dump(exclude_unset=True)
    dumped["code"] = code
    dumped["id"] = school_id

    # Đồng bộ trường học và ban giám hiệu
    p_name = dumped.get("principal_name")
    p_phone = dumped.get("principal_phone")
    board = dumped.get("school_board") or {}
    if p_name and "principal_name" not in board:
        board["principal_name"] = p_name
    if p_phone and "principal_phone" not in board:
        board["principal_phone"] = p_phone
    if board:
        dumped["school_board"] = board

    school_doc = {
        **dumped,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.schools.insert_one(school_doc)

    # Tự động tạo/đồng bộ địa điểm Waypoint trên bản đồ để các chuyến đi có thể sử dụng ngay
    waypoint_doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": school_doc.get("name"),
        "address": school_doc.get("address"),
        "lat": float(school_doc["lat"]),
        "lng": float(school_doc["lng"]),
        "type": "SCHOOL",
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.waypoints.insert_one(waypoint_doc)

    return school_doc


@router.patch("/{school_id}", response_model=SchoolResponse)
async def update_school(
    school_id: str,
    school_data: SchoolUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Cập nhật thông tin chi tiết trường học (Ban giám hiệu, liên hệ, ảnh, tuyển sinh)"""
    db = get_database()
    now = datetime.now(timezone.utc)
    school = await db.schools.find_one(get_school_filter(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")

    update_dict = school_data.model_dump(exclude_unset=True)
    if "school_board" in update_dict and update_dict["school_board"] is not None:
        # Giữ lại các trường cũ trong school_board nếu không bị ghi đè
        current_board = school.get("school_board") or {}
        update_dict["school_board"] = {**current_board, **update_dict["school_board"]}

    update_dict["updated_at"] = now
    await db.schools.update_one(
        {"_id": school["_id"]},
        {"$set": update_dict}
    )

    updated_school = await db.schools.find_one({"_id": school["_id"]})
    if "id" not in updated_school or not updated_school["id"]:
        updated_school["id"] = str(updated_school["_id"])
    return updated_school


@router.delete("/{school_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_school(school_id: str, current_user: dict = Depends(get_current_user)):
    """Xóa mềm trường học khỏi danh mục"""
    db = get_database()
    now = datetime.now(timezone.utc)
    school = await db.schools.find_one(get_school_filter(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")
    await db.schools.update_one(
        {"_id": school["_id"]},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )


def slugify_folder_name(text: str) -> str:
    """Tạo tên thư mục chuẩn hóa không dấu cho Cloudinary từ tên trường"""
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    text = re.sub(r'[^\w\s-]', '', text).strip()
    text = re.sub(r'[-\s]+', '_', text)
    return text or "school_media"


@router.post("/{school_id}/upload-image")
async def upload_school_image(
    school_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload ảnh lên Cloudinary vào thư mục mang tên trường học và lưu vào Kho ảnh của trường"""
    db = get_database()
    school = await db.schools.find_one(get_school_filter(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")

    school_name = school.get("name", "Truong_Hoc")
    folder = f"schools/{slugify_folder_name(school_name)}"

    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ảnh quá lớn (tối đa 15MB)")

    # Upload lên Cloudinary
    upload_res = await CloudinaryService.upload_image(
        content,
        filename=file.filename or "image.jpg",
        folder=folder
    )
    image_url = upload_res.get("url")

    # Lưu vào kho ảnh (media_library & images) của trường trong MongoDB
    image_item = {
        "id": str(uuid.uuid4()),
        "url": image_url,
        "public_id": upload_res.get("public_id"),
        "filename": file.filename or "image.jpg",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.schools.update_one(
        {"_id": school["_id"]},
        {
            "$addToSet": {"images": image_url},
            "$push": {"media_library": image_item}
        }
    )

    return {
        "success": True,
        "url": image_url,
        "public_id": upload_res.get("public_id"),
        "filename": file.filename,
        "folder": folder
    }


@router.get("/{school_id}/media-library")
async def get_school_media_library(
    school_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lấy danh sách toàn bộ ảnh trong kho ảnh của trường học"""
    db = get_database()
    school = await db.schools.find_one(get_school_filter(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")

    images_set = set()
    media_list = []

    # 1. Từ media_library đã lưu
    for m in school.get("media_library", []):
        if m.get("url") and m["url"] not in images_set:
            images_set.add(m["url"])
            media_list.append(m)

    # 2. Từ mảng images
    for u in school.get("images", []):
        if isinstance(u, str) and u not in images_set:
            images_set.add(u)
            media_list.append({
                "id": str(uuid.uuid4()),
                "url": u,
                "filename": u.split("/")[-1].split("?")[0] if "/" in u else "image.jpg",
                "created_at": school.get("updated_at", datetime.now(timezone.utc)).isoformat() if hasattr(school.get("updated_at"), "isoformat") else str(school.get("updated_at", ""))
            })

    # 3. Từ banner_url & image_url
    for u in [school.get("banner_url"), school.get("image_url")]:
        if u and u not in images_set:
            images_set.add(u)
            media_list.append({
                "id": str(uuid.uuid4()),
                "url": u,
                "filename": "banner_image",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

    return media_list


@router.delete("/{school_id}/media-library/{image_id}")
async def delete_school_media_image(
    school_id: str,
    image_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Xóa ảnh khỏi kho ảnh của trường học"""
    db = get_database()
    school = await db.schools.find_one(get_school_filter(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")

    target_url = None
    for m in school.get("media_library", []):
        if m.get("id") == image_id or m.get("url") == image_id:
            target_url = m.get("url")
            break

    update_ops: dict = {
        "$pull": {"media_library": {"$or": [{"id": image_id}, {"url": image_id}]}}
    }
    if target_url:
        update_ops["$pull"]["images"] = target_url
    else:
        update_ops["$pull"]["images"] = image_id

    await db.schools.update_one({"_id": school["_id"]}, update_ops)
    return {"success": True, "message": "Đã xóa ảnh khỏi kho"}
