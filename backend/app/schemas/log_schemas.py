from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid
from pydantic import BaseModel, Field, field_validator, field_serializer


def ensure_utc(v: Any) -> Any:
    if isinstance(v, datetime):
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
    return v


class LogSubActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str  # UPDATE_NAME, ADD_WAYPOINT, UPDATE_WAYPOINT, DELETE_WAYPOINT, CHECK_IN, ALLOCATE, etc.
    label: str   # Nhãn hiển thị tiếng Việt (VD: "Đổi tên chuyến đi", "Thêm điểm dừng", "Xóa điểm dừng")
    description: str  # Mô tả chi tiết hành động
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    details: Optional[Dict[str, Any]] = None

    @field_validator("timestamp", mode="before")
    @classmethod
    def val_timestamp(cls, v):
        return ensure_utc(v)

    @field_serializer("timestamp")
    def ser_timestamp(self, v: datetime, _info):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()


class SystemLogActor(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = "staff"


class SystemLogResponse(BaseModel):
    id: str
    action_type: str  # TRIP_EDIT_SESSION, CHECKIN_SESSION, ALLOCATION_SESSION, REPORT_SESSION
    title: str        # Tiêu đề phiên thao tác
    trip_id: Optional[str] = None
    trip_code: Optional[str] = None
    trip_name: Optional[str] = None
    actor: SystemLogActor = Field(default_factory=SystemLogActor)
    total_actions: int = 1
    category: Optional[str] = "TRIP"  # TRIP (Chuyến đi) hoặc SYSTEM (Hệ thống)
    activities: List[LogSubActivity] = []
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def val_dates(cls, v):
        return ensure_utc(v)

    @field_serializer("created_at", "updated_at")
    def ser_dates(self, v: datetime, _info):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()

    class Config:
        from_attributes = True


class SystemLogListResponse(BaseModel):
    total: int
    items: List[SystemLogResponse]

