from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.database import get_database
from app.schemas.auth_schemas import (
    LoginRequest,
    RegisterRequest,
    Token,
    UserResponse,
    UserRole,
    ChangePasswordRequest,
    UpdateProfileRequest
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: Optional[OAuth2PasswordRequestForm] = Depends(lambda: None)
):
    """
    Đăng nhập bằng Tên đăng nhập (Username) HOẶC Email và Mật khẩu.
    Hỗ trợ cả JSON body lẫn Form data (OAuth2).
    """
    content_type = request.headers.get("content-type", "")
    username = ""
    password = ""

    if "application/json" in content_type:
        body = await request.json()
        username = body.get("username", "")
        password = body.get("password", "")
    else:
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập đầy đủ tài khoản/email và mật khẩu"
        )

    user = await authenticate_user(username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.get("is_deleted", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị xóa khỏi hệ thống"
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa"
        )

    access_token = create_access_token(data={"sub": user["username"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(register_data: RegisterRequest):
    """
    Đăng ký tài khoản người dùng mới (IRS).
    Hỗ trợ phân quyền (Admin / Staff) và tự động tạo mã JWT Access Token.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Không thể kết nối cơ sở dữ liệu")

    now = datetime.now(timezone.utc)
    raw_username = register_data.username.strip()

    # 1. Kiểm tra username đã tồn tại chưa
    existing_user = await db.users.find_one({
        "username": raw_username,
        "is_deleted": {"$ne": True}
    })
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{raw_username}' đã được sử dụng"
        )

    # 2. Kiểm tra email đã tồn tại chưa (nếu có cung cấp)
    clean_email = register_data.email.strip() if register_data.email else None
    if clean_email:
        existing_email = await db.users.find_one({
            "email": clean_email,
            "is_deleted": {"$ne": True}
        })
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' đã được liên kết với tài khoản khác"
            )

    user_id = str(uuid.uuid4())
    is_admin = (register_data.role == UserRole.ADMIN)

    user_doc = {
        "id": user_id,
        "username": raw_username,
        "email": clean_email,
        "full_name": register_data.full_name.strip() if register_data.full_name else raw_username,
        "phone": register_data.phone.strip() if register_data.phone else None,
        "avatar_url": None,
        "role": register_data.role.value,
        "hashed_password": get_password_hash(register_data.password),
        "is_admin": is_admin,
        "is_active": True,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }

    await db.users.insert_one(user_doc)

    # Tự động cấp mã Token sau khi đăng ký
    access_token = create_access_token(data={"sub": user_doc["username"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_doc
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Lấy thông tin hồ sơ của user hiện tại đang đăng nhập"""
    return current_user


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Đổi mật khẩu người dùng hiện tại.
    Yêu cầu mật khẩu cũ chính xác và mật khẩu mới >= 6 ký tự.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Không thể kết nối cơ sở dữ liệu")

    # Xác thực mật khẩu cũ
    if not verify_password(data.current_password, current_user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác"
        )

    # Kiểm tra mật khẩu mới không trùng mật khẩu cũ
    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng với mật khẩu hiện tại"
        )

    now = datetime.now(timezone.utc)
    new_hashed_password = get_password_hash(data.new_password)

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "hashed_password": new_hashed_password,
            "updated_at": now
        }}
    )

    try:
        from app.services.log_service import log_system_activity
        await log_system_activity(
            action_type="USER_SESSION",
            session_title="Bảo mật tài khoản",
            sub_action="CHANGE_PASSWORD",
            sub_label="Đổi mật khẩu",
            description=f"Người dùng '{current_user.get('username')}' đã thay đổi mật khẩu thành công",
            actor_user=current_user,
            details={"username": current_user.get("username")}
        )
    except Exception:
        pass

    return {
        "success": True,
        "message": "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn."
    }


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Cập nhật thông tin hồ sơ của tài khoản đang đăng nhập (họ tên, email, sđt, avatar).
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Không thể kết nối cơ sở dữ liệu")

    now = datetime.now(timezone.utc)
    update_fields = {}

    if profile_data.full_name is not None:
        update_fields["full_name"] = profile_data.full_name.strip()
    if profile_data.phone is not None:
        update_fields["phone"] = profile_data.phone.strip()
    if profile_data.avatar_url is not None:
        update_fields["avatar_url"] = profile_data.avatar_url

    if profile_data.email is not None:
        new_email = profile_data.email.strip()
        if new_email and new_email != current_user.get("email"):
            # Kiểm tra email đã có người dùng khác dùng chưa
            existing = await db.users.find_one({
                "email": new_email,
                "id": {"$ne": current_user["id"]},
                "is_deleted": {"$ne": True}
            })
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{new_email}' đã được liên kết với tài khoản khác"
                )
        update_fields["email"] = new_email or None

    if update_fields:
        update_fields["updated_at"] = now
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_fields})

    updated_user = await db.users.find_one({"id": current_user["id"]})
    return updated_user



@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Đổi mật khẩu người dùng hiện tại.
    Yêu cầu mật khẩu cũ chính xác và mật khẩu mới >= 6 ký tự.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Không thể kết nối cơ sở dữ liệu")

    # Xác thực mật khẩu cũ
    if not verify_password(data.current_password, current_user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác"
        )

    # Kiểm tra mật khẩu mới không trùng mật khẩu cũ
    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng với mật khẩu hiện tại"
        )

    now = datetime.now(timezone.utc)
    new_hashed_password = get_password_hash(data.new_password)

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "hashed_password": new_hashed_password,
            "updated_at": now
        }}
    )

    try:
        from app.services.log_service import log_system_activity
        await log_system_activity(
            action_type="USER_SESSION",
            session_title="Bảo mật tài khoản",
            sub_action="CHANGE_PASSWORD",
            sub_label="Đổi mật khẩu",
            description=f"Người dùng '{current_user.get('username')}' đã thay đổi mật khẩu thành công",
            actor_user=current_user,
            details={"username": current_user.get("username")}
        )
    except Exception:
        pass

    return {
        "success": True,
        "message": "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn."
    }


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Cập nhật thông tin hồ sơ của tài khoản đang đăng nhập (họ tên, email, sđt, avatar).
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Không thể kết nối cơ sở dữ liệu")

    now = datetime.now(timezone.utc)
    update_fields = {}

    if profile_data.full_name is not None:
        update_fields["full_name"] = profile_data.full_name.strip()
    if profile_data.phone is not None:
        update_fields["phone"] = profile_data.phone.strip()
    if profile_data.avatar_url is not None:
        update_fields["avatar_url"] = profile_data.avatar_url

    if profile_data.email is not None:
        new_email = profile_data.email.strip()
        if new_email and new_email != current_user.get("email"):
            # Kiểm tra email đã có người dùng khác dùng chưa
            existing = await db.users.find_one({
                "email": new_email,
                "id": {"$ne": current_user["id"]},
                "is_deleted": {"$ne": True}
            })
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{new_email}' đã được liên kết với tài khoản khác"
                )
        update_fields["email"] = new_email or None

    if update_fields:
        update_fields["updated_at"] = now
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_fields})

    updated_user = await db.users.find_one({"id": current_user["id"]})
    return updated_user
