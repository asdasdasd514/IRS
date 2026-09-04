"""
User Management API - Quản lý tài khoản người dùng (Admin & Staff)
"""

from typing import List, Optional
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_database
from app.schemas.auth_schemas import (
    UserRole,
    UserCreate,
    UserUpdate,
    UserResponse
)
from app.services.auth_service import (
    get_password_hash,
    get_current_admin_user,
    get_current_user
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    role: Optional[UserRole] = Query(None, description="Lọc theo vai trò (admin, staff)"),
    is_active: Optional[bool] = Query(None, description="Lọc theo trạng thái hoạt động"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo username, họ tên, email, sđt"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Lấy danh sách người dùng trong hệ thống (Chỉ Admin).
    Tự động loại trừ các tài khoản đã bị xóa mềm.
    """
    db = get_database()
    query = {"is_deleted": {"$ne": True}}

    if role:
        query["role"] = role.value
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        search_regex = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"username": search_regex},
            {"full_name": search_regex},
            {"email": search_regex},
            {"phone": search_regex}
        ]

    cursor = db.users.find(query).sort("created_at", -1).skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)
    
    # Chuẩn hóa role và is_admin cho các bản ghi cũ
    for u in users:
        if "role" not in u:
            u["role"] = UserRole.ADMIN if u.get("is_admin") else UserRole.STAFF
        if "is_admin" not in u:
            u["is_admin"] = (u.get("role") == UserRole.ADMIN)

    return users


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Tạo tài khoản người dùng mới (Chỉ Admin).
    Hỗ trợ gán vai trò admin hoặc staff.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    # 1. Kiểm tra trùng lặp username
    existing_user = await db.users.find_one({
        "username": user_data.username,
        "is_deleted": {"$ne": True}
    })
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{user_data.username}' đã tồn tại trong hệ thống"
        )

    # 2. Kiểm tra trùng lặp email nếu có cung cấp
    if user_data.email:
        existing_email = await db.users.find_one({
            "email": user_data.email,
            "is_deleted": {"$ne": True}
        })
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{user_data.email}' đã được sử dụng bởi tài khoản khác"
            )

    user_id = str(uuid.uuid4())
    is_admin = (user_data.role == UserRole.ADMIN)
    
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "avatar_url": user_data.avatar_url,
        "role": user_data.role.value,
        "hashed_password": get_password_hash(user_data.password),
        "is_admin": is_admin,
        "is_active": True,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }

    await db.users.insert_one(user_doc)
    return user_doc


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_detail(
    user_id: str,
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Xem chi tiết thông tin một người dùng (Chỉ Admin).
    """
    db = get_database()
    user = await db.users.find_one({
        "$or": [{"id": user_id}, {"username": user_id}],
        "is_deleted": {"$ne": True}
    })
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng"
        )
    
    if "role" not in user:
        user["role"] = UserRole.ADMIN if user.get("is_admin") else UserRole.STAFF
    if "is_admin" not in user:
        user["is_admin"] = (user.get("role") == UserRole.ADMIN)

    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Cập nhật thông tin người dùng (Chỉ Admin).
    Cho phép đổi thông tin cá nhân, vai trò, kích hoạt/khóa tài khoản, đặt lại mật khẩu.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    user = await db.users.find_one({
        "$or": [{"id": user_id}, {"username": user_id}],
        "is_deleted": {"$ne": True}
    })
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng"
        )

    target_id = user.get("id")
    current_admin_id = current_admin.get("id")

    # Bảo vệ tài khoản: Không cho phép admin tự khóa hoặc tự hạ quyền chính mình
    if current_admin_id and target_id == current_admin_id:
        if user_update.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bạn không thể tự vô hiệu hóa tài khoản quản trị của chính mình"
            )
        if user_update.role and user_update.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bạn không thể tự hạ quyền quản trị viên của chính mình"
            )

    update_dict = {}
    if user_update.full_name is not None:
        update_dict["full_name"] = user_update.full_name
    if user_update.phone is not None:
        update_dict["phone"] = user_update.phone
    if user_update.avatar_url is not None:
        update_dict["avatar_url"] = user_update.avatar_url
    if user_update.is_active is not None:
        update_dict["is_active"] = user_update.is_active

    if user_update.email is not None:
        # Kiểm tra trùng email nếu đổi
        if user_update.email != user.get("email"):
            existing_email = await db.users.find_one({
                "email": user_update.email,
                "is_deleted": {"$ne": True},
                "id": {"$ne": target_id}
            })
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{user_update.email}' đã được sử dụng bởi tài khoản khác"
                )
        update_dict["email"] = user_update.email

    if user_update.role is not None:
        update_dict["role"] = user_update.role.value
        update_dict["is_admin"] = (user_update.role == UserRole.ADMIN)

    if user_update.password:
        update_dict["hashed_password"] = get_password_hash(user_update.password)

    if update_dict:
        update_dict["updated_at"] = now
        await db.users.update_one({"id": target_id}, {"$set": update_dict})

    updated_user = await db.users.find_one({"id": target_id})
    if "role" not in updated_user:
        updated_user["role"] = UserRole.ADMIN if updated_user.get("is_admin") else UserRole.STAFF
    if "is_admin" not in updated_user:
        updated_user["is_admin"] = (updated_user.get("role") == UserRole.ADMIN)

    return updated_user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: str,
    current_admin: dict = Depends(get_current_admin_user)
):
    """
    Xóa mềm người dùng (Chỉ Admin).
    Chuyển cờ is_deleted = True, lưu deleted_at và vô hiệu hóa tài khoản (is_active = False).
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    user = await db.users.find_one({
        "$or": [{"id": user_id}, {"username": user_id}],
        "is_deleted": {"$ne": True}
    })
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng"
        )

    target_id = user.get("id")
    current_admin_id = current_admin.get("id")

    # Bảo vệ an toàn: Admin không được tự xóa chính mình
    if current_admin_id and target_id == current_admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự xóa tài khoản quản trị của chính mình"
        )

    # Thực hiện xóa mềm
    await db.users.update_one(
        {"id": target_id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": now,
            "is_active": False,
            "updated_at": now
        }}
    )

    return {
        "success": True,
        "message": f"Tài khoản '{user.get('username')}' đã được xóa mềm thành công",
        "deleted_user_id": target_id
    }
