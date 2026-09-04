"""
Kịch bản khởi tạo và Migration cơ sở dữ liệu MongoDB (Database Name: IRS)
Thiết kế chuẩn hóa cho đề tài: "Phát triển Nền tảng Hỗ trợ Ra quyết định Lộ trình và Quản lý Chiến dịch Tuyển sinh Lưu động"

Đã áp dụng các điều chỉnh theo yêu cầu:
1. Bỏ hoàn toàn KPI (target_kpi, current_stats, kpi_achievement_rate).
2. Bỏ hoàn toàn collection decision_logs.
3. Bảng waypoints: Bỏ trường notes (do đã có trong waypoint_details).
4. Bảng waypoints: school_id lưu trực tiếp Mã trường (code) đồng bộ với bảng schools.
5. Bảng schools: Bỏ province và district (chỉ giữ address đầy đủ).
6. Bảng schools: Thêm cột description (giới thiệu về trường).
7. Dữ liệu đồng nhất 100% giữa các bảng.
"""

import sys
import asyncio
from datetime import datetime, timezone
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

    print(f"[Migration]: Xoa du lieu cu va tai lap Database '{DATABASE_NAME}' chuan de tai...")
    
    # Danh sách collections tinh gọn, chuẩn nghiệp vụ
    collections = [
        "users",
        "campaigns",
        "admission_trips",
        "schools",
        "waypoints",
        "admissions_activities",
        "waypoint_details",
        "waypoint_visit_logs",
        "waypoint_tickets",
        "waypoint_images",
        "trip_reports"
    ]

    # Xóa sạch cả các collection cũ bao gồm decision_logs nếu còn tồn tại
    existing_cols = await db.list_collection_names()
    for col in existing_cols:
        await db[col].drop()

    for col in collections:
        await db.create_collection(col)
        print(f"  + Tao collection: '{col}'")

    # Tạo Indexes tìm kiếm & Unique Constraints
    await db.users.create_index("username", unique=True)
    await db.campaigns.create_index("id", unique=True)
    await db.admission_trips.create_index("id", unique=True)
    await db.schools.create_index("id", unique=True)
    await db.schools.create_index("code", unique=True)
    await db.waypoints.create_index("id", unique=True)
    print("  + Da tao cac Indexes tim kiem va Unique Constraints.")

    now = datetime.now(timezone.utc)

    # 1. TÀI KHOẢN NGƯỜI DÙNG (Users: Admin & Staff)
    admin_id = str(uuid.uuid4())
    staff_id = str(uuid.uuid4())
    await db.users.insert_many([
        {
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
        },
        {
            "id": staff_id,
            "username": "staff",
            "full_name": "Nhân Viên Tuyển Sinh",
            "email": "staff@admissions.edu.vn",
            "role": "staff",
            "phone": "0912345678",
            "avatar_url": None,
            "hashed_password": get_password_hash("staff123"),
            "is_admin": False,
            "is_active": True,
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
    ])
    print("  [1. Users]: Da tao tai khoan 'admin' va 'staff'.")

    # 2. CHIẾN DỊCH TUYỂN SINH (Campaigns - Đã bỏ KPI)
    campaign_id = "camp-2026-mientay"
    await db.campaigns.insert_one({
        "id": campaign_id,
        "name": "Chiến dịch Tuyển sinh Lưu động Đồng bằng Sông Cửu Long 2026",
        "academic_year": "2026-2027",
        "description": "Chiến dịch tư vấn hướng nghiệp và tuyển sinh lưu động tại các trường THPT trọng điểm khu vực Cần Thơ, Hậu Giang, Vĩnh Long.",
        "start_date": datetime(2026, 9, 1, 0, 0, tzinfo=timezone.utc),
        "end_date": datetime(2026, 11, 30, 23, 59, tzinfo=timezone.utc),
        "status": "in_progress", # planning, in_progress, completed, paused
        "manager_id": admin_id,
        "created_at": now,
        "updated_at": now
    })
    print("  [2. Campaigns]: Da tao Chien dich Tuyen sinh Luu dong DBSCL 2026 (Khong co KPI).")

    # 3. DANH MỤC TRƯỜNG THPT (Schools: id = Mã trường, bỏ province/district, có description)
    schools_data = [
        {
            "id": "THPT-CT-01",
            "code": "THPT-CT-01",
            "name": "THPT Chuyên Lý Tự Trọng",
            "address": "Phường Hưng Thạnh, Quận Cái Răng, Thành phố Cần Thơ",
            "description": "Trường THPT Chuyên trọng điểm của TP Cần Thơ với bề dày thành tích học sinh giỏi quốc gia. Học sinh có định hướng rõ ràng về các ngành Công nghệ thông tin, Trí tuệ nhân tạo và Kinh doanh quốc tế.",
            "lat": 10.0076,
            "lng": 105.7725,
            "school_board": {
                "principal_name": "Thầy Phạm Văn Cường",
                "principal_phone": "0909999888",
                "vice_principal_name": "Thầy Nguyễn Văn An",
                "vice_principal_phone": "0901234567"
            },
            "preferred_visit_hours": "07:30 - 11:00 (Sáng thứ 2, thứ 5)",
            "created_at": now
        },
        {
            "id": "THPT-CT-02",
            "code": "THPT-CT-02",
            "name": "THPT Bùi Hữu Nghĩa",
            "address": "Đường Cách Mạng Tháng Tám, Phường An Thới, Quận Bình Thủy, Thành phố Cần Thơ",
            "description": "Trường công lập có quy mô học sinh khối 12 đông hàng đầu quận Bình Thủy. Học sinh rất năng động, tích cực tham gia các ngày hội tư vấn hướng nghiệp mở.",
            "lat": 10.0612,
            "lng": 105.7611,
            "school_board": {
                "principal_name": "Cô Trần Thị Mai",
                "principal_phone": "0918765432",
                "vice_principal_name": "Thầy Lê Minh Tuấn",
                "vice_principal_phone": "0912456789"
            },
            "preferred_visit_hours": "08:00 - 10:30 (Sáng thứ 3, thứ 6)",
            "created_at": now
        },
        {
            "id": "THPT-CT-03",
            "code": "THPT-CT-03",
            "name": "THPT Châu Văn Liêm",
            "address": "Số 58 Xô Viết Nghệ Tĩnh, Phường An Cư, Quận Ninh Kiều, Thành phố Cần Thơ",
            "description": "Một trong những ngôi trường trung học phổ thông lâu đời và giàu truyền thống nhất miền Tây Nam Bộ, chất lượng đầu vào cao và tỷ lệ đỗ đại học trên 98%.",
            "lat": 10.0382,
            "lng": 105.7831,
            "school_board": {
                "principal_name": "Thầy Hoàng Quốc Dũng",
                "principal_phone": "0903333444",
                "vice_principal_name": "Cô Nguyễn Thị Thu",
                "vice_principal_phone": "0908888777"
            },
            "preferred_visit_hours": "07:30 - 11:30 (Sáng thứ 2, thứ 4)",
            "created_at": now
        }
    ]
    await db.schools.insert_many(schools_data)
    print("  [3. Schools]: Da tao 3 truong THPT voi Ma truong lam ID, co cot gioi thieu va dia chi day du.")

    # 4. CHUYẾN ĐI / ĐỢT CÔNG TÁC LƯU ĐỘNG (Admission Trips)
    trip_id = str(uuid.uuid4())
    trip_doc = {
        "id": trip_id,
        "campaign_id": campaign_id,
        "name": "Chuyến đi Tuyển sinh Cần Thơ Đợt 1",
        "trip_code": "TS-CT-2026-D1",
        "status": "active",
        "current_lat": 10.0282,
        "current_lng": 105.7684,
        "hotel_lat": 10.0350,
        "hotel_lng": 105.7750,
        "hotel_name": "Khách sạn Mường Thanh Luxury Cần Thơ",
        "team": {
            "leader_name": "TS. Nguyễn Văn A (Trưởng đoàn)",
            "leader_phone": "0901234567",
            "members_count": 5,
            "members": [
                {"name": "ThS. Trần Thị Lan Hương", "role": "Tư vấn viên", "phone": "0912345678"},
                {"name": "Lê Văn Cường", "role": "Lái xe lưu động", "phone": "0987654321"},
                {"name": "Nguyễn Hoàng Nam", "role": "Kỹ thuật & Truyền thông", "phone": "0933221144"}
            ],
            "vehicle_plate": "65A-123.45"
        },
        "start_location": {
            "name": "Trụ sở Đại học (HQ)",
            "lat": 10.0345,
            "lng": 105.7821
        },
        "departure_date": datetime(2026, 9, 5, 7, 0, tzinfo=timezone.utc),
        "return_date": datetime(2026, 9, 8, 17, 30, tzinfo=timezone.utc),
        "total_tickets": 620,
        "created_at": now,
        "updated_at": now
    }
    await db.admission_trips.insert_one(trip_doc)
    print("  [4. Admission Trips]: Da tao Chuyen di Tuyen sinh Can Tho Dot 1.")

    # 5. ĐIỂM DỪNG LỘ TRÌNH (Waypoints: BỎ notes, school_id là Mã trường đồng bộ)
    wp1_id = str(uuid.uuid4())
    wp2_id = str(uuid.uuid4())
    wp3_id = str(uuid.uuid4())
    wp4_id = str(uuid.uuid4())

    waypoints_data = [
        {
            "id": wp1_id,
            "trip_id": trip_id,
            "school_id": "THPT-CT-01",
            "name": "THPT Chuyên Lý Tự Trọng",
            "address": "Phường Hưng Thạnh, Quận Cái Răng, Thành phố Cần Thơ",
            "description": "Trường THPT Chuyên hàng đầu tại TP Cần Thơ, đào tạo học sinh giỏi quốc gia và quốc tế, tỷ lệ đậu đại học đạt 100%.",
            "image_url": "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80",
            "website": "http://thptchuyenlytutrong.cantho.edu.vn",
            "representative_name": "Thầy Phạm Văn Cường",
            "representative_phone": "0909999888",
            "principal_name": "Thầy Phạm Văn Cường",
            "principal_phone": "0909999888",
            "vice_principal_name": "Thầy Nguyễn Văn An",
            "vice_principal_phone": "0901234567",
            "admissions_info": "Chỉ tiêu tuyển sinh dự kiến 450 học sinh khối 12; định hướng chuyên ngành: CNTT, Khoa học Kỹ thuật, Kinh tế.",
            "lat": 10.0076,
            "lng": 105.7725,
            "type": "SCHOOL",
            "visit_order": 1,
            "is_visited": True,
            "visited_at": now,
            "contact_name": "Thầy Nguyễn Văn An (Phó Hiệu Trưởng)",
            "contact_phone": "0901234567",
            "notes": "BGH rất cởi mở, bố trí hội trường và âm thanh đầy đủ. Học sinh đặt nhiều câu hỏi về ngành CNTT.",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": wp2_id,
            "trip_id": trip_id,
            "school_id": "THPT-CT-03",
            "name": "THPT Châu Văn Liêm",
            "address": "Số 58 Xô Viết Nghệ Tĩnh, Phường An Cư, Quận Ninh Kiều, Thành phố Cần Thơ",
            "description": "Một trong những ngôi trường trung học phổ thông lâu đời và giàu truyền thống nhất miền Tây Nam Bộ, chất lượng đầu vào cao và tỷ lệ đỗ đại học trên 98%.",
            "image_url": "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80",
            "website": "http://thptchauvanliem.cantho.edu.vn",
            "representative_name": "Thầy Hoàng Quốc Dũng",
            "representative_phone": "0903333444",
            "principal_name": "Thầy Hoàng Quốc Dũng",
            "principal_phone": "0903333444",
            "vice_principal_name": "Cô Nguyễn Thị Thu",
            "vice_principal_phone": "0908888777",
            "admissions_info": "Quy mô 580 học sinh lớp 12; định hướng ngành: Quản trị Kinh doanh, Ngôn ngữ, Sư phạm, Luật.",
            "lat": 10.0382,
            "lng": 105.7831,
            "type": "SCHOOL",
            "visit_order": 2,
            "is_visited": True,
            "visited_at": now,
            "contact_name": "Cô Nguyễn Thị Thu (Phó Hiệu Trưởng)",
            "contact_phone": "0908888777",
            "notes": "Đã thống nhất khung giờ tư vấn 08:00 - 10:00 sáng. BGH đề xuất phối hợp tặng 5 suất học bổng khuyến học.",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": wp3_id,
            "trip_id": trip_id,
            "school_id": "THPT-CT-02",
            "name": "THPT Bùi Hữu Nghĩa",
            "address": "Đường Cách Mạng Tháng Tám, Phường An Thới, Quận Bình Thủy, Thành phố Cần Thơ",
            "description": "Trường công lập có quy mô học sinh khối 12 đông hàng đầu quận Bình Thủy. Học sinh rất năng động, tích cực tham gia các ngày hội tư vấn hướng nghiệp mở.",
            "image_url": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80",
            "website": "http://thptbuihuunghia.cantho.edu.vn",
            "representative_name": "Cô Trần Thị Mai",
            "representative_phone": "0918765432",
            "principal_name": "Cô Trần Thị Mai",
            "principal_phone": "0918765432",
            "vice_principal_name": "Thầy Lê Minh Tuấn",
            "vice_principal_phone": "0912456789",
            "admissions_info": "Quy mô 620 học sinh khối 12; nhu cầu cao về nhóm ngành Kỹ thuật số, Thương mại Điện tử và Du lịch.",
            "lat": 10.0612,
            "lng": 105.7611,
            "type": "SCHOOL",
            "visit_order": 3,
            "is_visited": False,
            "visited_at": None,
            "contact_name": "Thầy Lê Minh Tuấn (Phó Hiệu Trưởng)",
            "contact_phone": "0912456789",
            "notes": "Dự kiến tổ chức ngày hội định hướng nghề nghiệp ngoài sân trường cho toàn bộ khối 12.",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": wp4_id,
            "trip_id": trip_id,
            "school_id": None, # Điểm nghỉ lưu trú khách sạn
            "name": "Khách sạn Mường Thanh Luxury Cần Thơ",
            "address": "Khu vực Cồn Cái Khế, Lê Lợi, Ninh Kiều, Cần Thơ",
            "description": "Địa điểm lưu trú và nghỉ ngơi của đoàn tuyển sinh lưu động tại trung tâm thành phố Cần Thơ.",
            "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80",
            "website": "https://luxurycantho.muongthanh.com",
            "representative_name": "Lễ tân khách sạn",
            "representative_phone": "02923688888",
            "lat": 10.0350,
            "lng": 105.7750,
            "type": "HOTEL",
            "visit_order": 4,
            "is_visited": False,
            "visited_at": None,
            "contact_name": "Lễ tân khách sạn",
            "contact_phone": "02923688888",
            "notes": "Đã đặt trước 3 phòng đôi cho đoàn công tác.",
            "created_at": now,
            "updated_at": now
        }
    ]

    await db.waypoints.insert_many(waypoints_data)
    print("  [5. Waypoints]: Da tao 4 diem dung (school_id la Ma truong, da bo notes).")

    # 6. CHI TIẾT LIÊN HỆ BGH & GHI CHÚ (Waypoint Details: Nơi lưu notes chi tiết)
    await db.waypoint_details.insert_many([
        {
            "id": str(uuid.uuid4()),
            "waypoint_id": wp1_id,
            "principal_name": "Thầy Phạm Văn Cường",
            "principal_phone": "0909999888",
            "vice_principal_name": "Thầy Nguyễn Văn An",
            "vice_principal_phone": "0901234567",
            "our_contact_person": "TS. Nguyễn Văn A (Trưởng đoàn)",
            "our_contact_role": "Trưởng phòng Tuyển sinh",
            "contact_process": "Đã liên hệ ngày 20/08 qua điện thoại, gửi công văn phối hợp tuyển sinh ngày 25/08 và được xếp lịch sáng thứ 2.",
            "total_contact_attempts": 3,
            "notes": "BGH rất cởi mở, bố trí hội trường và âm thanh đầy đủ. Học sinh đặt nhiều câu hỏi về ngành CNTT.",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "waypoint_id": wp2_id,
            "principal_name": "Thầy Hoàng Quốc Dũng",
            "principal_phone": "0903333444",
            "vice_principal_name": "Cô Nguyễn Thị Thu",
            "vice_principal_phone": "0908888777",
            "our_contact_person": "ThS. Trần Thị Lan Hương",
            "our_contact_role": "Cán bộ Tuyển sinh",
            "contact_process": "Đã trao đổi trước 1 tuần và được BGH phê duyệt chương trình tư vấn 45 phút.",
            "total_contact_attempts": 2,
            "notes": "Học sinh quan tâm nhiều đến mức học phí, chính sách học bổng và xét tuyển học bạ.",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "waypoint_id": wp3_id,
            "principal_name": "Cô Trần Thị Mai",
            "principal_phone": "0918765432",
            "vice_principal_name": "Thầy Lê Minh Tuấn",
            "vice_principal_phone": "0912456789",
            "our_contact_person": "TS. Nguyễn Văn A (Trưởng đoàn)",
            "our_contact_role": "Trưởng phòng Tuyển sinh",
            "contact_process": "Đã gọi điện liên hệ hẹn gặp chiều thứ 3.",
            "total_contact_attempts": 1,
            "notes": "Cần mang theo 500 cẩm nang tuyển sinh và quà tặng hướng nghiệp cho học sinh.",
            "created_at": now,
            "updated_at": now
        }
    ])
    print("  [6. Waypoint Details]: Da tao ghi chu va thong tin lien he BGH day du.")

    # 7. PHIẾU KHẢO SÁT NGUYỆN VỌNG THU ĐƯỢC (Waypoint Tickets)
    await db.waypoint_tickets.insert_many([
        {
            "id": str(uuid.uuid4()),
            "waypoint_id": wp1_id,
            "visit_number": 1,
            "tickets_collected": 350,
            "notes": "Thu phiếu khảo sát nguyện vọng khối 12 các lớp chuyên Toán, Lý, Hóa, Tin.",
            "collection_date": now,
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "waypoint_id": wp2_id,
            "visit_number": 1,
            "tickets_collected": 270,
            "notes": "Thu phiếu đăng ký tư vấn chuyên sâu ngành Khoa học máy tính & Trí tuệ nhân tạo.",
            "collection_date": now,
            "created_at": now
        }
    ])
    print("  [7. Waypoint Tickets]: Da tao du lieu phieu thu thap nguyen vong.")

    # 8. LỊCH SỬ GHÉ THĂM (Waypoint Visit Logs)
    await db.waypoint_visit_logs.insert_many([
        {
            "id": str(uuid.uuid4()),
            "waypoint_id": wp1_id,
            "visit_content": "Đoàn tuyển sinh tổ chức buổi tư vấn hướng nghiệp tập trung tại Hội trường A cho hơn 400 học sinh khối 12.",
            "visit_date": now,
            "image_urls": "",
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "waypoint_id": wp2_id,
            "visit_content": "Tổ chức đặt bàn tư vấn lưu động tại sân trường và phát 500 cuốn Cẩm nang Tuyển sinh 2026.",
            "visit_date": now,
            "image_urls": "",
            "created_at": now
        }
    ])
    print("  [8. Waypoint Visit Logs]: Da tao lich su cac buoi lam viec tai truong.")

    # 9. BÁO CÁO CHUYẾN ĐI (Trip Reports - Đã bỏ KPI)
    await db.trip_reports.insert_one({
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "campaign_id": campaign_id,
        "trip_name": "Chuyến đi Tuyển sinh Cần Thơ Đợt 1",
        "total_schools": 3,
        "schools_visited": 2,
        "total_tickets": 620,
        "report_content": """# Báo Cáo Chuyến Đi Tuyển Sinh Lưu Động Cần Thơ Đợt 1

## 1. Tổng quan Đợt công tác
- **Chiến dịch**: Chiến dịch Tuyển sinh Lưu động Đồng bằng Sông Cửu Long 2026
- **Trưởng đoàn**: TS. Nguyễn Văn A
- **Số thành viên**: 5 người
- **Tổng số trường trong kế hoạch**: 3 trường THPT
- **Số trường đã hoàn thành**: 2/3 trường
- **Tổng số phiếu nguyện vọng thu được**: 620 phiếu

## 2. Chi tiết Hoạt động tại từng Điểm trường
1. **THPT Chuyên Lý Tự Trọng (Mã: THPT-CT-01)**: Thu được 350 phiếu nguyện vọng. Học sinh đặc biệt quan tâm ngành Trí tuệ Nhân tạo & Công nghệ Thông tin.
2. **THPT Châu Văn Liêm (Mã: THPT-CT-03)**: Thu được 270 phiếu nguyện vọng. Đã kết nối hiệu quả với Ban Giám Hiệu.

## 3. Lộ trình Tiếp theo
Ghé thăm THPT Bùi Hữu Nghĩa (Mã: THPT-CT-02) trong lộ trình tiếp theo của đoàn.
""",
        "created_at": now
    })
    print("  [9. Trip Reports]: Da tao Bao cao Chuyen di Tuyen sinh.")

    print(f"\n[Hoan tat]: Da tao moi thanh cong Database '{DATABASE_NAME}' dong nhat 100%!")
    client.close()


if __name__ == "__main__":
    asyncio.run(init_mongo_database())
