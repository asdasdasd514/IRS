from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    STAFF = "staff"


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole = UserRole.STAFF


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole = UserRole.STAFF
    is_admin: bool = False
    is_active: bool = True
    is_deleted: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[str] = None
