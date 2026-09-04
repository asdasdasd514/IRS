"""
School API Endpoints - Quản lý Danh mục Trường THPT Mục tiêu Tuyển sinh
"""

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_database
from app.schemas import SchoolCreate, SchoolResponse
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
    schools = await cursor.to_list(length=200)
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
        {"$set": {"is_deleted": True, "deleted_at": now}}
    )


@router.post("", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
async def create_school(
    school_data: SchoolCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    now = datetime.now(timezone.utc)
    school_id = school_data.id or school_data.code
    
    existing = await db.schools.find_one({"code": school_data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Mã trường này đã tồn tại trong hệ thống")

    school_doc = {
        "id": school_id,
        **school_data.model_dump(),
        "created_at": now
    }
    school_doc["id"] = school_id
    await db.schools.insert_one(school_doc)
    return school_doc
