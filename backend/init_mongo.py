"""
Kịch bản khởi tạo và Migration cơ sở dữ liệu MongoDB (Database Name: IRS)
Thiết kế chuẩn hóa cho đề tài: "Phát triển Nền tảng Hỗ trợ Ra quyết định Lộ trình và Quản lý Chiến dịch Tuyển sinh Lưu động"

Chức năng:
- Khởi tạo đầy đủ cấu trúc các bảng (Collections) và Indexes tối ưu truy vấn.
- Không chèn dữ liệu mẫu (chiến dịch, trường học, chuyến đi, điểm dừng, báo cáo, nhật ký).
- Chỉ khởi tạo duy nhất 01 tài khoản Quản trị viên (Admin) mặc định để phục vụ xác thực hệ thống.
"""

import os
import sys
import asyncio
from datetime import datetime, timezone
import uuid
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Tối ưu encoding trên Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Tải cấu hình từ .env
load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "IRS")


def get_password_hash(password: str) -> str:
    """Băm mật khẩu sử dụng bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def init_mongo_database():
    print("=" * 70)
    print(f"🚀 [MongoDB Migration]: Đang kết nối tới MongoDB: {MONGODB_URL}")
    print(f"📁 [MongoDB Migration]: Database mục tiêu: '{DATABASE_NAME}'")
    print("=" * 70)

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    # Danh sách collections nghiệp vụ chuẩn hóa
    collections = [
        "users",
        "campaigns",
        "admission_trips",
        "schools",
        "waypoints",
        "waypoint_details",
        "waypoint_visit_logs",
        "waypoint_tickets",
        "waypoint_images",
        "trip_reports",
        "admissions_activities"
    ]

    print("\n[Bước 1/3]: Đang làm sạch và tái tạo các Collections (Bảng)...")
    existing_cols = await db.list_collection_names()
    for col in existing_cols:
        await db[col].drop()
        print(f"  - Đã dọn dẹp collection cũ: '{col}'")

    for col in collections:
        await db.create_collection(col)
        print(f"  + Khởi tạo collection mới: '{col}'")

    print("\n[Bước 2/3]: Đang thiết lập các Indexes & Ràng buộc toàn vẹn...")
    # 1. users
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", sparse=True)
    await db.users.create_index("role")
    await db.users.create_index("is_deleted")

    # 2. campaigns
    await db.campaigns.create_index("id", unique=True)
    await db.campaigns.create_index("status")
    await db.campaigns.create_index("is_deleted")
    await db.campaigns.create_index("created_at")

    # 3. admission_trips
    await db.admission_trips.create_index("id", unique=True)
    await db.admission_trips.create_index("campaign_id")
    await db.admission_trips.create_index("status")
    await db.admission_trips.create_index("is_deleted")
    await db.admission_trips.create_index("created_at")

    # 4. schools
    await db.schools.create_index("id", unique=True)
    await db.schools.create_index("code", unique=True)
    await db.schools.create_index("name")
    await db.schools.create_index("is_deleted")

    # 5. waypoints
    await db.waypoints.create_index("id", unique=True)
    await db.waypoints.create_index("trip_id")
    await db.waypoints.create_index("school_id")
    await db.waypoints.create_index("visit_order")
    await db.waypoints.create_index("is_deleted")

    # 6. waypoint_details
    await db.waypoint_details.create_index("waypoint_id", unique=True)
    await db.waypoint_details.create_index("is_deleted")

    # 7. waypoint_visit_logs
    await db.waypoint_visit_logs.create_index("id", unique=True)
    await db.waypoint_visit_logs.create_index("waypoint_id")
    await db.waypoint_visit_logs.create_index("is_deleted")

    # 8. waypoint_tickets
    await db.waypoint_tickets.create_index("id", unique=True)
    await db.waypoint_tickets.create_index("waypoint_id")
    await db.waypoint_tickets.create_index("is_deleted")

    # 9. waypoint_images
    await db.waypoint_images.create_index("id", unique=True)
    await db.waypoint_images.create_index("visit_log_id")
    await db.waypoint_images.create_index("is_deleted")

    # 10. trip_reports
    await db.trip_reports.create_index("id", unique=True)
    await db.trip_reports.create_index("trip_id")
    await db.trip_reports.create_index("is_deleted")

    # 11. admissions_activities
    await db.admissions_activities.create_index("id", unique=True)
    await db.admissions_activities.create_index("trip_id")
    await db.admissions_activities.create_index("waypoint_id")
    await db.admissions_activities.create_index("is_deleted")

    print("  + Đã tạo đầy đủ Unique Constraints và Query Indexes cho 11 collections.")

    print("\n[Bước 3/3]: Khởi tạo tài khoản Quản trị viên (Root Admin)...")
    now = datetime.now(timezone.utc)
    admin_id = str(uuid.uuid4())
    admin_user = {
        "id": admin_id,
        "username": "admin",
        "full_name": "Quản Trị Viên Hệ Thống",
        "email": "admin@admissions.edu.vn",
        "role": "admin",
        "phone": "0901234567",
        "avatar_url": None,
        "hashed_password": get_password_hash("admin123"),
        "is_admin": True,
        "is_active": True,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(admin_user)
    print("  + Đã tạo tài khoản quản trị mặc định: username='admin' / password='admin123'")

    print("\n" + "=" * 70)
    print("✅ [HOÀN TẤT MIGRATION MONGODB]:")
    print(f"   - Database: {DATABASE_NAME}")
    print(f"   - Số lượng Collections: {len(collections)} (đã cấu trúc sạch)")
    print(f"   - Dữ liệu mẫu: Không chèn bất kỳ chiến dịch, trường học hay điểm dừng mẫu nào.")
    print(f"   - Tài khoản đăng nhập ban đầu: admin / admin123")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(init_mongo_database())
