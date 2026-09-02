"""
Kịch bản khởi tạo và Migration dữ liệu sang MongoDB (Database Name: IRS)
Tạo Collections, Index độc nhất và Dữ liệu mẫu (Admin User + Admission Trips + Waypoints).
"""

import sys
import asyncio
from datetime import datetime
import uuid
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

# Tối ưu encoding trên Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "IRS"


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def init_mongo_database():
    print(f"[Migration]: Dang ket noi toi MongoDB ({MONGODB_URL})...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    print(f"[Migration]: Tao va kiem tra cac Collections trong database '{DATABASE_NAME}'...")
    collections = [
        "users",
        "admission_trips",
        "waypoints",
        "waypoint_details",
        "waypoint_visit_logs",
        "waypoint_tickets",
        "waypoint_images",
        "trip_reports",
        "report_jobs"
    ]
    
    existing_cols = await db.list_collection_names()
    for col in collections:
        if col not in existing_cols:
            await db.create_collection(col)
            print(f"  + Tao collection: '{col}'")

    # Tạo Unique Index cho Username
    await db.users.create_index("username", unique=True)
    print("  + Tao Unique Index cho 'username' trong collection 'users'")

    # 1. Tạo tài khoản Admin mặc định nếu chưa có
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id,
            "username": "admin",
            "hashed_password": get_password_hash("admin123"),
            "is_admin": True,
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        print("  [User Admin]: Da tao tai khoan 'admin' (password: 'admin123')")

    # 2. Tạo chuyến đi mẫu nếu chưa có dữ liệu
    trip_count = await db.admission_trips.count_documents({})
    if trip_count == 0:
        trip_id = str(uuid.uuid4())
        now = datetime.utcnow()

        trip_doc = {
            "id": trip_id,
            "name": "Tuyen sinh Dong Nai & Can Tho Dot 1",
            "status": "active",
            "current_lat": 10.0282,
            "current_lng": 105.7684,
            "hotel_lat": 10.0350,
            "hotel_lng": 105.7750,
            "hotel_name": "Khach san Muong Thanh Can Tho",
            "created_at": now,
            "updated_at": now
        }
        await db.admission_trips.insert_one(trip_doc)

        waypoints_data = [
            {
                "id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "name": "THPT Chuyen Ly Tu Trong",
                "address": "Phuong Hung Thanh, Quan Cai Rang, Can Tho",
                "lat": 10.0076,
                "lng": 105.7725,
                "type": "SCHOOL",
                "visit_order": 1,
                "is_visited": True,
                "visited_at": now,
                "notes": "Da gap Hieu pho va trao doi lich hoi thao tuyen sinh",
                "contact_name": "Thay Nguyen Van A",
                "contact_phone": "0901234567",
                "created_at": now
            },
            {
                "id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "name": "THPT Bui Huu Nghia",
                "address": "Duong An Thoi, Binh Thuy, Can Tho",
                "lat": 10.0612,
                "lng": 105.7611,
                "type": "SCHOOL",
                "visit_order": 2,
                "is_visited": False,
                "visited_at": None,
                "notes": "Can mang theo 500 cam nang tuyen sinh",
                "contact_name": "Co Tran Thi B",
                "contact_phone": "0918765432",
                "created_at": now
            },
            {
                "id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "name": "Khach san Muong Thanh Can Tho",
                "address": "Khu vuc Con Cai Khe, Le Loi, Ninh Kieu, Can Tho",
                "lat": 10.0350,
                "lng": 105.7750,
                "type": "HOTEL",
                "visit_order": 3,
                "is_visited": False,
                "visited_at": None,
                "notes": "Diem me nghi ngơi doan tuyen sinh",
                "contact_name": "Le tan",
                "contact_phone": "02923688888",
                "created_at": now
            }
        ]
        await db.waypoints.insert_many(waypoints_data)

        wp1_id = waypoints_data[0]["id"]
        await db.waypoint_details.insert_one({
            "id": str(uuid.uuid4()),
            "waypoint_id": wp1_id,
            "principal_name": "Thay Pham Van C",
            "principal_phone": "0909999888",
            "vice_principal_name": "Thay Nguyen Van A",
            "vice_principal_phone": "0901234567",
            "our_contact_person": "Nguyen Van D (Truong doan)",
            "our_contact_role": "Can bo Tuyen sinh",
            "contact_process": "Da trao doi ngay 15/08 va thong nhat to chuc tu van sang thu 2",
            "total_contact_attempts": 3,
            "notes": "Truong ho tro am thanh hoi truong",
            "created_at": now,
            "updated_at": now
        })

        await db.waypoint_tickets.insert_one({
            "id": str(uuid.uuid4()),
            "waypoint_id": wp1_id,
            "visit_number": 1,
            "tickets_collected": 350,
            "notes": "Thu phieu dang ky nguyen vong lop 12",
            "collection_date": now,
            "created_at": now
        })

        print("  [Mock Data]: Da chen chuyen di tuyen sinh mau va cac diem truong vao MongoDB!")

    print(f"\n[Hoan tat]: Da tao thanh cong Database '{DATABASE_NAME}' trong MongoDB!")
    client.close()


if __name__ == "__main__":
    asyncio.run(init_mongo_database())
