from pydantic import BaseModel, Field, field_serializer, field_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timezone
from enum import Enum


# Enums
class TripStatus(str, Enum):
    ASSIGNED = "assigned"
    ACTIVE = "active"
    IN_PROGRESS = "in_progress"
    DEPLOYED = "deployed"
    PAUSED = "paused"
    COMPLETED = "completed"


class WaypointType(str, Enum):
    SCHOOL = "SCHOOL"
    HQ = "HQ"
    REST_STOP = "REST_STOP"


class CampaignStatus(str, Enum):
    PLANNING = "planning"
    ASSIGNED = "assigned"
    DEPLOYED = "deployed"
    IN_PROGRESS = "in_progress"
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"


class CampaignDestination(BaseModel):
    id: Optional[str] = None
    school_id: Optional[str] = None
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    lat: float
    lng: float
    order: Optional[int] = None
    priority: Optional[int] = None
    distance_text: Optional[str] = None
    duration_text: Optional[str] = None
    distance_meters: Optional[float] = None
    duration_seconds: Optional[float] = None
    notes: Optional[str] = None
    preferred_time: Optional[str] = None
    preferred_visit_time: Optional[str] = None
    visit_duration_minutes: Optional[int] = None
    assigned_staff: Optional[List[dict]] = None
    leg_geometry: Optional[List[List[float]]] = None

    class Config:
        extra = "ignore"


# Đoàn công tác / Phân công nhân sự
class TripTeamMember(BaseModel):
    id: Optional[str] = None
    name: str
    role: str = "Cán bộ tuyển sinh"
    phone: Optional[str] = None
    email: Optional[str] = None

    class Config:
        extra = "ignore"


class TripTeam(BaseModel):
    leader_name: Optional[str] = None
    leader_phone: Optional[str] = None
    members_count: int = 1
    members: List[Union[TripTeamMember, str]] = []
    stop_assignments: Optional[dict] = None
    vehicle_plate: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("members", mode="before")
    @classmethod
    def normalize_members(cls, v):
        if not v:
            return []
        normalized = []
        for m in v:
            if isinstance(m, str):
                normalized.append(TripTeamMember(name=m))
            elif isinstance(m, dict):
                normalized.append(TripTeamMember(**m))
            elif isinstance(m, TripTeamMember):
                normalized.append(m)
        return normalized

    class Config:
        extra = "ignore"


# Campaign Schemas (Chiến dịch Tuyển sinh)
class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: CampaignStatus = CampaignStatus.PLANNING
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None
    team: Optional[TripTeam] = None # Đoàn công tác / Phân công nhân sự
    destinations: List[CampaignDestination] = [] # Danh sách các trường / địa điểm dự kiến
    start_point: Optional[dict] = None

    class Config:
        extra = "ignore"


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CampaignStatus] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None
    team: Optional[TripTeam] = None
    destinations: Optional[List[CampaignDestination]] = None
    start_point: Optional[dict] = None
    route_geometry: Optional[List[List[float]]] = None
    polyline: Optional[str] = None
    estimated_distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    estimated_duration_text: Optional[str] = None

    class Config:
        extra = "ignore"


class CampaignAllocationRequest(BaseModel):
    trip_id: Optional[str] = None
    team: Optional[TripTeam] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    destinations: Optional[List[dict]] = None
    start_point: Optional[dict] = None


class CampaignResponse(CampaignBase):
    id: str
    manager_id: Optional[str] = None
    deployed_trip_id: Optional[str] = None # ID chuyến đi được tạo sau khi triển khai
    total_destinations: int = 0
    estimated_distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    estimated_duration_text: Optional[str] = None
    start_point: Optional[dict] = None
    route_geometry: Optional[List[List[float]]] = None
    polyline: Optional[str] = None
    route_legs: Optional[List[dict]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        extra = "ignore"


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
    code: Optional[str] = None # Mã trường (ví dụ: BK-HN, THPT-CT-01)
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    description: Optional[str] = None # Giới thiệu trường
    website: Optional[str] = None # Website trường
    image_url: Optional[str] = None # Ảnh đại diện
    banner_url: Optional[str] = None # Ảnh bìa trường
    theme: Optional[dict] = None # Tùy chỉnh màu sắc / theme
    blocks: Optional[List[dict]] = None # Danh sách các khối nội dung tùy biến (Page Builder)
    images: List[str] = [] # Bộ sưu tập ảnh
    representative_name: Optional[str] = None # Người đại diện
    representative_phone: Optional[str] = None # SĐT đại diện
    contact_phone: Optional[str] = None # SĐT liên hệ chính của trường (Hotline)
    contact_email: Optional[str] = None # Email liên hệ chính của trường (Contract_Email)
    principal_name: Optional[str] = None
    principal_phone: Optional[str] = None
    vice_principal_name: Optional[str] = None
    vice_principal_phone: Optional[str] = None
    school_board: Optional[SchoolBoard] = None
    notes: Optional[str] = None
    google_map_url: Optional[str] = None # Link Google Maps trực tiếp đến địa điểm
    field_notes: Optional[List[dict]] = None
    total_visits: int = 0  # Tổng số lần đã ghé qua từ trước tới nay (Counter Cache)
    total_tickets: int = 0  # Tổng số phiếu tuyển sinh đã thu thập được từ trước tới nay
    last_visited_at: Optional[datetime] = None  # Thời điểm ghé gần nhất


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
    banner_url: Optional[str] = None
    theme: Optional[dict] = None
    blocks: Optional[List[dict]] = None
    images: Optional[List[str]] = None
    representative_name: Optional[str] = None
    representative_phone: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    principal_name: Optional[str] = None
    principal_phone: Optional[str] = None
    vice_principal_name: Optional[str] = None
    vice_principal_phone: Optional[str] = None
    school_board: Optional[SchoolBoard] = None
    notes: Optional[str] = None
    google_map_url: Optional[str] = None
    field_notes: Optional[List[dict]] = None
    total_visits: Optional[int] = None
    total_tickets: Optional[int] = None
    last_visited_at: Optional[datetime] = None


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
    google_map_url: Optional[str] = None # Link Google Maps trực tiếp đến địa điểm
    school_id: Optional[str] = None # Mã trường tham chiếu (nếu là trường học)
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    type: WaypointType = WaypointType.SCHOOL
    notes: Optional[str] = None


class WaypointCreate(WaypointBase):
    pass


class WaypointUpdate(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    google_place_id: Optional[str] = None
    google_map_url: Optional[str] = None
    school_id: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    type: Optional[WaypointType] = None
    notes: Optional[str] = None


class WaypointResponse(WaypointBase):
    id: str
    visit_order: Optional[int] = 1
    priority: Optional[int] = None
    preferred_visit_time: Optional[str] = None
    visit_duration_minutes: Optional[int] = None
    is_visited: bool = False
    visited_at: Optional[datetime] = None
    school: Optional[SchoolResponse] = None # Thông tin chi tiết trường tham chiếu từ schools
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        extra = "allow"


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
    priority: Optional[int] = None
    preferred_visit_time: Optional[str] = None
    visit_duration_minutes: Optional[int] = None
    is_visited: bool = False
    visited_at: Optional[datetime] = None
    notes: Optional[str] = None


class CampaignWaypointCreate(CampaignWaypointBase):
    pass


class CampaignWaypointUpdate(BaseModel):
    visit_order: Optional[int] = None
    priority: Optional[int] = None
    preferred_visit_time: Optional[str] = None
    visit_duration_minutes: Optional[int] = None
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
    priority: Optional[int] = None
    preferred_visit_time: Optional[str] = None
    visit_duration_minutes: Optional[int] = None
    school_id: Optional[str] = None
    waypoint_id: Optional[str] = None
    name: str
    lat: float
    lng: float
    address: Optional[str] = None
    distance_meters: Optional[Union[int, float]] = None
    duration_seconds: Optional[Union[int, float]] = None


class RoutePlanBase(BaseModel):
    campaign_id: Optional[str] = None
    trip_id: Optional[str] = None
    name: str
    algorithm: str = "Dynamic Next-Hop Routing"
    start_lat: float
    start_lng: float
    start_name: Optional[str] = None
    total_destinations: int = 0
    total_distance_meters: Union[int, float] = 0
    estimated_distance_km: float = 0.0
    total_duration_seconds: Union[int, float] = 0
    estimated_duration_minutes: Union[int, float] = 0
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
class TripBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    campaign_id: Optional[str] = None
    trip_code: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    team: Optional[TripTeam] = None
    estimated_distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    destinations: Optional[List[Any]] = None
    start_point: Optional[dict] = None
    route_geometry: Optional[List[Any]] = None
    polyline: Optional[str] = None


class TripCreate(TripBase):
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    team: Optional[TripTeam] = None
    waypoints: List[WaypointCreate] = []


class TripUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[Union[TripStatus, str]] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    team: Optional[TripTeam] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class TripResponse(TripBase):
    id: str
    status: Union[TripStatus, str] = TripStatus.ACTIVE
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
    status: Union[TripStatus, str] = TripStatus.ACTIVE
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
    duration_seconds: Union[int, float]
    duration_text: str
    distance_meters: Union[int, float]
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
    trip_code: Optional[str] = None
    trip_name: Optional[str] = None
    leader_name: Optional[str] = None
    campaign_id: Optional[str] = None
    status: Optional[str] = None
    trip_status: Optional[str] = None
    trip_created_at: Optional[datetime] = None
    start_point: Optional[dict] = None
    assigned_staff: Optional[List[dict]] = None
    report_content: str
    total_schools: int = 0
    schools_visited: int = 0
    total_tickets: int = 0
    schools_data: Optional[List[dict]] = None
    rest_stops_data: Optional[List[dict]] = None
    created_at: Optional[datetime] = None

    @field_serializer('created_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    @field_serializer('trip_created_at', when_used='json')
    def serialize_trip_dt(self, dt: Optional[datetime]) -> Optional[str]:
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


# ==========================================
# KHẢO SÁT TUYỂN SINH QUA MÃ QR (SURVEY SCHEMAS)
# ==========================================

DEFAULT_MAJORS_LIST = [
    "Công nghệ thông tin",
    "Kỹ thuật phần mềm",
    "Quản trị kinh doanh",
    "Marketing",
    "Thiết kế đồ họa",
    "Ngôn ngữ Anh",
    "Kế toán - Tài chính",
    "Logistics & Quản lý chuỗi cung ứng"
]


class SurveyQuestionSchema(BaseModel):
    id: str
    type: str = "text"  # text, textarea, radio, checkbox, dropdown
    title: str
    description: Optional[str] = None
    required: bool = False
    options: Optional[List[str]] = Field(default_factory=list)
    placeholder: Optional[str] = None
    is_core: Optional[bool] = False


class SurveyConfigSchema(BaseModel):
    title: str = "Khảo Sát Nguyện Vọng Tuyển Sinh 2026"
    description: Optional[str] = "Vui lòng để lại thông tin để nhận tư vấn học bổng và chỉ tiêu tuyển sinh mới nhất."
    questions: Optional[List[SurveyQuestionSchema]] = Field(default_factory=list)
    majors: Optional[List[str]] = Field(default_factory=lambda: list(DEFAULT_MAJORS_LIST))
    fields_enabled: Optional[Dict[str, bool]] = Field(default_factory=lambda: {
        "student_name": True,
        "phone": True,
        "grade": True,
        "email": False,
        "notes": True
    })
    is_custom: Optional[bool] = False
    school_id: Optional[str] = None
    school_name: Optional[str] = None


class PublicSurveySubmitRequest(BaseModel):
    trip_id: str
    waypoint_id: str
    student_name: str
    phone: str
    grade: Optional[str] = None
    interested_majors: Optional[List[str]] = Field(default_factory=list)
    answers: Optional[Dict[str, Any]] = Field(default_factory=dict)
    notes: Optional[str] = None


class SurveyResponseItem(BaseModel):
    id: str
    trip_id: Optional[str] = None
    trip_name: Optional[str] = None
    waypoint_id: Optional[str] = None
    school_id: Optional[str] = None
    school_name: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    student_name: str
    phone: str
    grade: Optional[str] = ""
    interested_majors: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""
    source: Optional[str] = "QR_ONLINE"
    created_at: Optional[str] = None



