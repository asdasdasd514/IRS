from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.services.auth_service import get_current_user
from app.services import log_service
from app.schemas.log_schemas import SystemLogResponse, SystemLogListResponse

router = APIRouter(prefix="/logs", tags=["system-logs"])


@router.get("", response_model=SystemLogListResponse)
async def list_logs(
    trip_id: Optional[str] = Query(None, description="Lọc theo ID chuyến đi"),
    action_type: Optional[str] = Query(None, description="Lọc theo loại hành động"),
    category: Optional[str] = Query(None, description="Lọc theo TRIP hoặc SYSTEM"),
    user_id: Optional[str] = Query(None, description="Lọc theo ID người thực hiện"),
    search: Optional[str] = Query(None, description="Tìm kiếm từ khóa"),
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Số lượng mỗi trang"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy danh sách nhật ký hệ thống gom nhóm theo phiên (Log Cha - Con)
    Hỗ trợ tìm kiếm, phân trang và bộ lọc chi tiết
    """
    skip = (page - 1) * page_size
    items = await log_service.get_system_logs(
        trip_id=trip_id,
        action_type=action_type,
        category=category,
        user_id=user_id,
        search=search,
        limit=page_size,
        skip=skip
    )
    total = await log_service.count_system_logs(
        trip_id=trip_id,
        action_type=action_type,
        category=category,
        user_id=user_id,
        search=search
    )

    return SystemLogListResponse(
        total=total,
        items=[SystemLogResponse.model_validate(item) for item in items]
    )


@router.get("/trips/{trip_id}", response_model=List[SystemLogResponse])
async def get_trip_history(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy toàn bộ lịch sử chỉnh sửa và triển khai của riêng một chuyến đi
    """
    items = await log_service.get_trip_logs(trip_id)
    return [SystemLogResponse.model_validate(item) for item in items]
