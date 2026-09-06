"""
School API Endpoints - Quản lý Danh mục Trường THPT Mục tiêu Tuyển sinh
Hồ sơ trường học lưu trữ tập trung, chuẩn hóa: Ban giám hiệu, mô tả, tuyển sinh, liên hệ, website.
"""

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_database
from app.schemas import SchoolCreate, SchoolUpdate, SchoolResponse
from app.services.auth_service import get_current_user

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

    cursor = db.schools.find(query).sort("code", 1)
    schools = await cursor.to_list(length=500)
    return schools


@router.get("/{school_id}", response_model=SchoolResponse)
async def get_school(school_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    school = await db.schools.find_one({
        "$or": [{"id": school_id}, {"code": school_id}],
        "is_deleted": {"$ne": True}
    })
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")
    return school


@router.post("", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
async def create_school(
    school_data: SchoolCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    now = datetime.now(timezone.utc)
    school_id = school_data.id or school_data.code
    
    existing = await db.schools.find_one({"code": school_data.code, "is_deleted": {"$ne": True}})
    if existing:
        raise HTTPException(status_code=400, detail="Mã trường này đã tồn tại trong hệ thống")

    school_doc = {
        **school_data.model_dump(exclude_unset=True),
        "id": school_id,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    school_doc["id"] = school_id
    await db.schools.insert_one(school_doc)
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
    school = await db.schools.find_one({
        "$or": [{"id": school_id}, {"code": school_id}],
        "is_deleted": {"$ne": True}
    })
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")

    update_dict = school_data.model_dump(exclude_unset=True)
    if "school_board" in update_dict and update_dict["school_board"] is not None:
        # Giữ lại các trường cũ trong school_board nếu không bị ghi đè
        current_board = school.get("school_board") or {}
        update_dict["school_board"] = {**current_board, **update_dict["school_board"]}

    update_dict["updated_at"] = now
    await db.schools.update_one(
        {"id": school["id"]},
        {"$set": update_dict}
    )

    updated_school = await db.schools.find_one({"id": school["id"]})
    return updated_school


@router.delete("/{school_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_school(school_id: str, current_user: dict = Depends(get_current_user)):
    """Xóa mềm trường học khỏi danh mục"""
    db = get_database()
    now = datetime.now(timezone.utc)
    school = await db.schools.find_one({
        "$or": [{"id": school_id}, {"code": school_id}],
        "is_deleted": {"$ne": True}
    })
    if not school:
        raise HTTPException(status_code=404, detail="Không tìm thấy trường học")
    await db.schools.update_one(
        {"id": school["id"]},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
