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
    UserRole
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash
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

    # Ghi nhật ký hệ thống: Đăng nhập thành công
    try:
        from app.services.log_service import log_system_activity
        client_ip = request.client.host if request.client else "unknown"
        await log_system_activity(
            action_type="AUTH_SESSION",
            session_title="Phiên làm việc người dùng",
            sub_action="LOGIN_SUCCESS",
            sub_label="Đăng nhập",
            description=f"Tài khoản '{user.get('full_name') or user.get('username')}' ({user.get('role', 'user')}) đăng nhập vào hệ thống",
            actor_user=user,
            details={"ip": client_ip}
        )
    except Exception as log_err:
        logger.warning(f"Error logging login activity: {log_err}")

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

    try:
        from app.services.log_service import log_system_activity
        role_label = "Quản trị viên" if is_admin else "Cán bộ thực địa"
        await log_system_activity(
            action_type="USER_SESSION",
            session_title="Quản lý tài khoản người dùng",
            sub_action="CREATE_USER",
            sub_label="Đăng ký tài khoản",
            description=f"Tài khoản mới '{user_doc['username']}' ({user_doc['full_name']}) vừa đăng ký vào hệ thống với vai trò {role_label}",
            actor_user=user_doc,
            details={"user_id": user_id, "username": user_doc["username"], "role": user_doc["role"]}
        )
    except Exception as log_err:
        pass

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
