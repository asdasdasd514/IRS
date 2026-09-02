from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List
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


# Waypoint Schemas
class WaypointBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    google_place_id: Optional[str] = None
    address: Optional[str] = None
    type: WaypointType = WaypointType.SCHOOL
    notes: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None


class WaypointCreate(WaypointBase):
    pass


class WaypointUpdate(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None
    is_visited: Optional[bool] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None


class WaypointResponse(WaypointBase):
    id: str
    trip_id: str
    visit_order: Optional[int] = None
    is_visited: bool = False
    visited_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @field_serializer('visited_at', 'created_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True


# Trip Schemas
class TripBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class TripCreate(TripBase):
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    hotel_lat: Optional[float] = None
    hotel_lng: Optional[float] = None
    hotel_name: Optional[str] = None
    waypoints: List[WaypointCreate] = []


class TripUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[TripStatus] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    hotel_lat: Optional[float] = None
    hotel_lng: Optional[float] = None
    hotel_name: Optional[str] = None


class TripResponse(TripBase):
    id: str
    status: TripStatus = TripStatus.ACTIVE
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    hotel_lat: Optional[float] = None
    hotel_lng: Optional[float] = None
    hotel_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    waypoints: List[WaypointResponse] = []
    
    total_waypoints: int = 0
    visited_count: int = 0

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


# Report Schemas
class ReportCreate(BaseModel):
    created_at: Optional[datetime] = None


class ReportResponse(BaseModel):
    id: str
    trip_id: str
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


# Report Job Schemas
class ReportJobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportJobResponse(BaseModel):
    job_id: str
    trip_id: str
    status: ReportJobStatus
    progress: int = 0
    result_report_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer('created_at', 'updated_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True
