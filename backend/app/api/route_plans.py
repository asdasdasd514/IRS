"""
Route Plans API Endpoints - Quản lý Kế hoạch Lộ trình Định tuyến
Lưu trữ và truy vấn kết quả của thuật toán Dynamic Next-Hop Routing
"""

from typing import List, Optional
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_database
from app.schemas import RoutePlanCreate, RoutePlanResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/route-plans", tags=["Route Plans"])


@router.get("", response_model=List[RoutePlanResponse])
async def list_route_plans(
    campaign_id: Optional[str] = Query(None, description="Lọc theo mã chiến dịch"),
    trip_id: Optional[str] = Query(None, description="Lọc theo mã chuyến đi"),
    current_user: dict = Depends(get_current_user)
):
    """Lấy danh sách các kế hoạch định tuyến đã tính toán"""
    db = get_database()
    query = {"is_deleted": {"$ne": True}}
    if campaign_id:
        query["campaign_id"] = campaign_id
    if trip_id:
        query["trip_id"] = trip_id

    cursor = db.route_plans.find(query).sort("created_at", -1)
    plans = await cursor.to_list(length=100)
    for p in plans:
        p.pop("_id", None)
    return plans


@router.get("/{plan_id}", response_model=RoutePlanResponse)
async def get_route_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Xem chi tiết một kế hoạch định tuyến theo ID"""
    db = get_database()
    plan = await db.route_plans.find_one({"id": plan_id, "is_deleted": {"$ne": True}})
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch lộ trình")
    plan.pop("_id", None)
    return plan


@router.post("", response_model=RoutePlanResponse, status_code=status.HTTP_201_CREATED)
async def create_route_plan(
    plan_data: RoutePlanCreate,
    current_user: dict = Depends(get_current_user)
):
    """Lưu một kế hoạch lộ trình mới"""
    db = get_database()
    now = datetime.now(timezone.utc)
    plan_id = str(uuid.uuid4())

    plan_doc = {
        **plan_data.model_dump(),
        "id": plan_id,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.route_plans.insert_one(plan_doc)
    plan_doc.pop("_id", None)
    return plan_doc


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Xóa mềm kế hoạch định tuyến"""
    db = get_database()
    now = datetime.now(timezone.utc)
    res = await db.route_plans.update_one(
        {"id": plan_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch lộ trình")
