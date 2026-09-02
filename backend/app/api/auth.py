from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from datetime import datetime
import uuid

from app.core.database import get_database
from app.schemas.auth_schemas import (
    LoginRequest,
    Token,
    UserCreate,
    UserResponse
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    get_current_user,
    get_current_admin_user
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Đăng nhập"""
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Lấy thông tin user hiện tại"""
    return current_user


@router.post("/admin/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(get_current_admin_user)
):
    """Tạo tài khoản mới (chỉ admin)"""
    db = get_database()
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "hashed_password": get_password_hash(user_data.password),
        "is_admin": False,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    return user_doc


@router.get("/admin/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_admin_user)):
    """Liệt kê tất cả users (chỉ admin)"""
    db = get_database()
    cursor = db.users.find({})
    users = await cursor.to_list(length=1000)
    return users
