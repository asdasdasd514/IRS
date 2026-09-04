"""Schemas cho 3 phần thông tin waypoint"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ==================== IMAGE SCHEMA ====================
class ImageResponse(BaseModel):
    id: str
    filename: Optional[str] = None
    content_type: Optional[str] = None
    cloudinary_url: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ==================== PHẦN 1: Thông tin chi tiết ====================
class WaypointDetailBase(BaseModel):
    description: Optional[str] = None # Giới thiệu về trường
    image_url: Optional[str] = None # Ảnh trường
    website: Optional[str] = None # Website trường
    representative_name: Optional[str] = None # Người đại diện
    representative_phone: Optional[str] = None # SĐT người đại diện
    principal_name: Optional[str] = None # Hiệu trưởng
    principal_phone: Optional[str] = None
    vice_principal_name: Optional[str] = None # Phó hiệu trưởng
    vice_principal_phone: Optional[str] = None
    admissions_info: Optional[str] = None # Thông tin tuyển sinh
    our_contact_person: Optional[str] = None
    our_contact_role: Optional[str] = None
    contact_process: Optional[str] = None
    total_contact_attempts: int = 0
    notes: Optional[str] = None


class WaypointDetailCreate(WaypointDetailBase):
    pass


class WaypointDetailUpdate(BaseModel):
    description: Optional[str] = None
    image_url: Optional[str] = None
    website: Optional[str] = None
    representative_name: Optional[str] = None
    representative_phone: Optional[str] = None
    principal_name: Optional[str] = None
    principal_phone: Optional[str] = None
    vice_principal_name: Optional[str] = None
    vice_principal_phone: Optional[str] = None
    admissions_info: Optional[str] = None
    our_contact_person: Optional[str] = None
    our_contact_role: Optional[str] = None
    contact_process: Optional[str] = None
    total_contact_attempts: Optional[int] = None
    notes: Optional[str] = None



class WaypointDetailResponse(WaypointDetailBase):
    id: str
    waypoint_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ==================== PHẦN 2: Lịch sử ghé thăm ====================
class VisitLogBase(BaseModel):
    visit_content: str
    image_urls: Optional[str] = None


class VisitLogCreate(VisitLogBase):
    pass


class VisitLogUpdate(BaseModel):
    visit_content: Optional[str] = None
    image_urls: Optional[str] = None


class VisitLogResponse(VisitLogBase):
    id: str
    waypoint_id: str
    visit_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    images: List[ImageResponse] = []
    
    class Config:
        from_attributes = True


# ==================== PHẦN 3: Phiếu thu ====================
class TicketBase(BaseModel):
    visit_number: int
    tickets_collected: int = 0
    notes: Optional[str] = None


class TicketCreate(TicketBase):
    pass


class TicketUpdate(BaseModel):
    visit_number: Optional[int] = None
    tickets_collected: Optional[int] = None
    notes: Optional[str] = None


class TicketResponse(TicketBase):
    id: str
    waypoint_id: str
    collection_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
