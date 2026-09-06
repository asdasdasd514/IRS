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
    HQ = "HQ"
    REST_STOP = "REST_STOP"


class CampaignStatus(str, Enum):
    PLANNING = "planning"
    DEPLOYED = "deployed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAUSED = "paused"


class CampaignDestination(BaseModel):
    id: Optional[str] = None
    school_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    notes: Optional[str] = None
    preferred_time: Optional[str] = None


# Campaign Schemas (Chiến dịch Tuyển sinh)
class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: CampaignStatus = CampaignStatus.PLANNING
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None
    destinations: List[CampaignDestination] = [] # Danh sách các trường / địa điểm dự kiến


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CampaignStatus] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None
    destinations: Optional[List[CampaignDestination]] = None


class CampaignResponse(CampaignBase):
    id: str
    manager_id: Optional[str] = None
    deployed_trip_id: Optional[str] = None # ID chuyến đi được tạo sau khi triển khai
    total_destinations: int = 0
    estimated_distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampaignDeployResponse(BaseModel):
    campaign: CampaignResponse
    trip: dict
    total_destinations: int
    optimized_order: List[str]
    estimated_distance_km: float
    message: str


# School Schemas (Hồ sơ Trường THPT mục tiêu - Nguồn dữ liệu gốc)
class SchoolBoard(BaseModel):
    principal_name: Optional[str] = None
    principal_phone: Optional[str] = None
    vice_principal_name: Optional[str] = None
    vice_principal_phone: Optional[str] = None


class SchoolBase(BaseModel):
    id: Optional[str] = None
    code: str # Mã trường (ví dụ: BK-HN, THPT-CT-01)
    name: str
    address: str
    lat: float
    lng: float
    description: Optional[str] = None # Giới thiệu trường
    website: Optional[str] = None # Website trường
    image_url: Optional[str] = None # Ảnh đại diện
    images: List[str] = [] # Bộ sưu tập ảnh
    admissions_info: Optional[str] = None # Thông tin tuyển sinh
    representative_name: Optional[str] = None # Người đại diện
    representative_phone: Optional[str] = None # SĐT đại diện
    school_board: Optional[SchoolBoard] = None
    notes: Optional[str] = None


class SchoolCreate(SchoolBase):
    pass


class SchoolUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    description: Optional[str] = None
    website: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    admissions_info: Optional[str] = None
    representative_name: Optional[str] = None
    representative_phone: Optional[str] = None
    school_board: Optional[SchoolBoard] = None
    notes: Optional[str] = None


class SchoolResponse(SchoolBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Waypoint Schemas (Điểm dừng / Địa điểm cố định trên Bản đồ - Tinh giản)
class WaypointBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    google_place_id: Optional[str] = None
    school_id: Optional[str] = None # Mã trường tham chiếu (nếu là trường học)
    address: Optional[str] = None
    type: WaypointType = WaypointType.SCHOOL
    notes: Optional[str] = None


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
    notes: Optional[str] = None


class WaypointResponse(WaypointBase):
    id: str
    school: Optional[SchoolResponse] = None # Thông tin chi tiết trường tham chiếu từ schools
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Campaign Waypoint Schemas (Các trường/điểm sẽ đi trong Chiến dịch / Chuyến đi)
class CampaignWaypointBase(BaseModel):
    campaign_id: str
    trip_id: Optional[str] = None
    school_id: Optional[str] = None
    waypoint_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    type: WaypointType = WaypointType.SCHOOL
    visit_order: int = 1
    is_visited: bool = False
    visited_at: Optional[datetime] = None
    notes: Optional[str] = None


class CampaignWaypointCreate(CampaignWaypointBase):
    pass


class CampaignWaypointUpdate(BaseModel):
    visit_order: Optional[int] = None
    is_visited: Optional[bool] = None
    visited_at: Optional[datetime] = None
    notes: Optional[str] = None
    trip_id: Optional[str] = None


class CampaignWaypointResponse(CampaignWaypointBase):
    id: str
    visit_logs: List[dict] = []
    tickets: List[dict] = []
    total_tickets: int = 0
    school: Optional[SchoolResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer('visited_at', 'created_at', 'updated_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True


# Route Plan Schemas (Kết quả Định tuyến Dynamic Next-Hop Routing)
class RoutePlanDestination(BaseModel):
    order: int
    school_id: Optional[str] = None
    waypoint_id: Optional[str] = None
    name: str
    lat: float
    lng: float
    address: Optional[str] = None
    distance_meters: Optional[int] = None
    duration_seconds: Optional[int] = None


class RoutePlanBase(BaseModel):
    campaign_id: Optional[str] = None
    trip_id: Optional[str] = None
    name: str
    algorithm: str = "Dynamic Next-Hop Routing"
    start_lat: float
    start_lng: float
    start_name: Optional[str] = None
    total_destinations: int = 0
    total_distance_meters: int = 0
    estimated_distance_km: float = 0.0
    total_duration_seconds: int = 0
    estimated_duration_minutes: int = 0
    destinations: List[RoutePlanDestination] = []
    polyline: Optional[str] = None
    status: str = "applied" # applied, draft, archived


class RoutePlanCreate(RoutePlanBase):
    pass


class RoutePlanResponse(RoutePlanBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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
    team: Optional[TripTeam] = None
    waypoints: List[WaypointCreate] = []


class TripUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[TripStatus] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    team: Optional[TripTeam] = None


class TripResponse(TripBase):
    id: str
    status: TripStatus = TripStatus.ACTIVE
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    team: Optional[TripTeam] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    waypoints: List[Any] = []
    
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
    waypoint: Any
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
    waypoint: Optional[Any] = None
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


