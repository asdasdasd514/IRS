from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- User & Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    role: Optional[str] = "staff"  # "admin" or "staff"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str

# --- Admissions Campaign & School Schemas ---
class Location(BaseModel):
    lat: float
    lng: float
    address: str

class HighSchoolTarget(BaseModel):
    school_name: str
    address: str
    location: Location
    estimated_students: int
    priority: int = 1 # 1: High, 2: Medium, 3: Low
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None

class CampaignBase(BaseModel):
    title: str
    description: Optional[str] = None
    region: str
    start_date: datetime
    end_date: datetime
    targets: List[HighSchoolTarget] = []
    budget: float = 0.0
    status: str = "planning"  # "planning", "active", "completed"

class CampaignCreate(CampaignBase):
    pass

class CampaignOut(CampaignBase):
    id: str
    images: List[Dict[str, Any]] = []  # [{ url, public_id, created_at }]
    created_at: datetime

# --- Route Optimization & Distance Matrix Schemas ---
class RouteRequest(BaseModel):
    origin: Location
    waypoints: List[Location]
    mode: Optional[str] = "driving"

class DistanceMatrixRequest(BaseModel):
    origins: List[str]
    destinations: List[str]

class RouteResponse(BaseModel):
    total_distance_km: float
    total_duration_minutes: float
    optimized_waypoints: List[Dict[str, Any]]
    polyline_overview: Optional[str] = None
    cached: bool = False

# --- Cloudinary Upload Schemas ---
class ImageMetadataResponse(BaseModel):
    url: str
    public_id: str
    format: str
    width: int
    height: int
    bytes: int
    created_at: str
