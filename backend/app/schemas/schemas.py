from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum


# Enums
class TripStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class WaypointType(str, Enum):
    SCHOOL = "SCHOOL"
    HOTEL = "HOTEL"
    HQ = "HQ"
    REST_STOP = "REST_STOP"


class CampaignStatus(str, Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAUSED = "paused"


# Campaign Schemas (Chiến dịch Tuyển sinh)
class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    academic_year: str = "2026-2027"
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: CampaignStatus = CampaignStatus.IN_PROGRESS


class CampaignCreate(CampaignBase):
    pass


class CampaignResponse(CampaignBase):
    id: str
    manager_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# School Schemas (Danh mục Trường THPT mục tiêu)
class SchoolBoard(BaseModel):
    principal_name: Optional[str] = None
    principal_phone: Optional[str] = None
    vice_principal_name: Optional[str] = None
    vice_principal_phone: Optional[str] = None


class SchoolBase(BaseModel):
    id: str # Mã trường (ví dụ: ĐH-BKHN, THPT-CT-01)
    code: str # Mã trường
    name: str
    address: str
    description: Optional[str] = None # Giới thiệu về trường
    lat: float
    lng: float
    school_board: Optional[SchoolBoard] = None
    preferred_visit_hours: Optional[str] = None


class SchoolCreate(BaseModel):
    id: Optional[str] = None
    code: str
    name: str
    address: str
    description: Optional[str] = None
    lat: float
    lng: float
    school_board: Optional[SchoolBoard] = None
    preferred_visit_hours: Optional[str] = None


class SchoolResponse(SchoolBase):
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Waypoint Schemas (Điểm dừng lộ trình & Thông tin trường học)
class WaypointBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    google_place_id: Optional[str] = None
    school_id: Optional[str] = None # Mã trường
    address: Optional[str] = None
    type: WaypointType = WaypointType.SCHOOL
    trip_id: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    
    # Thông tin chi tiết trường học & tuyển sinh
    description: Optional[str] = None # Phần giới thiệu về trường
    image_url: Optional[str] = None # Ảnh đại diện / ảnh trường
    images: List[str] = [] # Danh sách ảnh
    website: Optional[str] = None # Website của trường
    representative_name: Optional[str] = None # Người đại diện
    representative_phone: Optional[str] = None # Số điện thoại người đại diện
    principal_name: Optional[str] = None # Hiệu trưởng / Giám đốc
    principal_phone: Optional[str] = None # Số điện thoại Hiệu trưởng
    vice_principal_name: Optional[str] = None # Phó hiệu trưởng / Phó giám đốc
    vice_principal_phone: Optional[str] = None # Số điện thoại Phó hiệu trưởng
    admissions_info: Optional[str] = None # Thông tin tuyển sinh (chỉ tiêu, khối thi, ghi chú tuyển sinh)
    notes: Optional[str] = None # Ghi chú thêm
    our_contact_person: Optional[str] = None
    our_contact_role: Optional[str] = None
    contact_process: Optional[str] = None
    total_contact_attempts: int = 0


class WaypointCreate(WaypointBase):
    pass


class WaypointUpdate(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    google_place_id: Optional[str] = None
    school_id: Optional[str] = None
    address: Optional[str] = None
    type: Optional[WaypointType] = None
    trip_id: Optional[str] = None
    visit_order: Optional[int] = None
    is_visited: Optional[bool] = None
    visited_at: Optional[datetime] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    website: Optional[str] = None
    representative_name: Optional[str] = None
    representative_phone: Optional[str] = None
    principal_name: Optional[str] = None
    principal_phone: Optional[str] = None
    vice_principal_name: Optional[str] = None
    vice_principal_phone: Optional[str] = None
    admissions_info: Optional[str] = None
    notes: Optional[str] = None
    our_contact_person: Optional[str] = None
    our_contact_role: Optional[str] = None
    contact_process: Optional[str] = None
    total_contact_attempts: Optional[int] = None


class WaypointResponse(WaypointBase):
    id: str
    trip_id: Optional[str] = None
    visit_order: Optional[int] = None
    is_visited: bool = False
    visited_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    visit_logs: List[dict] = []
    tickets: List[dict] = []
    total_tickets: int = 0

    @field_serializer('visited_at', 'created_at', 'updated_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True



# Trip Schemas (Đợt/Chuyến xe Tuyển sinh)
class TripTeamMember(BaseModel):
    name: str
    role: str
    phone: Optional[str] = None


class TripTeam(BaseModel):
    leader_name: Optional[str] = None
    leader_phone: Optional[str] = None
    members_count: int = 1
    members: List[TripTeamMember] = []
    vehicle_plate: Optional[str] = None


class TripBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    campaign_id: Optional[str] = None
    trip_code: Optional[str] = None


class TripCreate(TripBase):
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    hotel_lat: Optional[float] = None
    hotel_lng: Optional[float] = None
    hotel_name: Optional[str] = None
    team: Optional[TripTeam] = None
    waypoints: List[WaypointCreate] = []


class TripUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[TripStatus] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    hotel_lat: Optional[float] = None
    hotel_lng: Optional[float] = None
    hotel_name: Optional[str] = None
    team: Optional[TripTeam] = None


class TripResponse(TripBase):
    id: str
    status: TripStatus = TripStatus.ACTIVE
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    hotel_lat: Optional[float] = None
    hotel_lng: Optional[float] = None
    hotel_name: Optional[str] = None
    team: Optional[TripTeam] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    waypoints: List[WaypointResponse] = []
    
    total_waypoints: int = 0
    visited_count: int = 0
    total_tickets: int = 0

    class Config:
        from_attributes = True


class TripListResponse(TripBase):
    id: str
    status: TripStatus = TripStatus.ACTIVE
    total_waypoints: int = 0
    visited_count: int = 0
    school_count: int = 0
    school_visited_count: int = 0
    total_tickets: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Next-Hop Schemas
class NextHopRequest(BaseModel):
    current_lat: float = Field(..., ge=-90, le=90)
    current_lng: float = Field(..., ge=-180, le=180)


class NextHopCandidate(BaseModel):
    waypoint: WaypointResponse
    duration_seconds: int
    duration_text: str
    distance_meters: int
    distance_text: str
    is_recommended: bool = False


class NextHopResponse(BaseModel):
    recommended: Optional[NextHopCandidate] = None
    alternatives: List[NextHopCandidate] = []
    total_unvisited: int = 0
    message: str = ""


# Check-in Schemas
class CheckInRequest(BaseModel):
    waypoint_id: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    remote: bool = False
    visited_at: Optional[datetime] = None


class CheckInResponse(BaseModel):
    success: bool
    waypoint: WaypointResponse
    message: str


# Direction Schemas
class DirectionRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float


class DirectionResponse(BaseModel):
    polyline: str
    duration_text: str
    distance_text: str
    steps: List[dict] = []


# Report Schemas (Đã bỏ KPI)
class ReportCreate(BaseModel):
    created_at: Optional[datetime] = None


class ReportResponse(BaseModel):
    id: str
    trip_id: str
    campaign_id: Optional[str] = None
    report_content: str
    total_schools: int = 0
    schools_visited: int = 0
    total_tickets: int = 0
    created_at: Optional[datetime] = None

    @field_serializer('created_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    
    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    id: str
    trip_id: str
    campaign_id: Optional[str] = None
    trip_name: str
    total_schools: int = 0
    schools_visited: int = 0
    total_tickets: int = 0
    created_at: Optional[datetime] = None

    @field_serializer('created_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    
    class Config:
        from_attributes = True


