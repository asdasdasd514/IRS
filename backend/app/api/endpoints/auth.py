from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import UserRegister, UserLogin, Token, UserOut
from app.core.security import get_password_hash, verify_password, create_access_token
from app.db.mongodb import get_database

router = APIRouter()

# In-memory users DB fallback if MongoDB is offline in dev
MOCK_USERS_DB = {}

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister):
    db = get_database()
    
    hashed_pwd = get_password_hash(user_in.password)
    user_dict = {
        "id": f"usr_{len(MOCK_USERS_DB) + 1}",
        "email": user_in.email,
        "hashed_password": hashed_pwd,
        "full_name": user_in.full_name,
        "role": user_in.role or "staff"
    }

    if db is not None:
        try:
            existing = await db.users.find_one({"email": user_in.email})
            if existing:
                raise HTTPException(status_code=400, detail="Email đã được sử dụng")
            res = await db.users.insert_one(user_dict)
            user_dict["id"] = str(res.inserted_id)
        except Exception:
            pass

    MOCK_USERS_DB[user_in.email] = user_dict
    return UserOut(
        id=user_dict["id"],
        email=user_dict["email"],
        full_name=user_dict["full_name"],
        role=user_dict["role"]
    )

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    user = MOCK_USERS_DB.get(credentials.email)
    
    db = get_database()
    if db is not None:
        try:
            db_user = await db.users.find_one({"email": credentials.email})
            if db_user:
                user = db_user
        except Exception:
            pass

    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác"
        )

    access_token = create_access_token(subject=user["email"])
    return Token(access_token=access_token, token_type="bearer")
