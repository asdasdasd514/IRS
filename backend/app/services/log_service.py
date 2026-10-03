"""
Log Service (IRS MongoDB Database)
Quản lý lịch sử thao tác hệ thống theo mô hình Session / Grouped Audit Log:
- 1 Log Cha đại diện cho phiên thao tác (giúp nhẹ database)
- Mảng con 'activities' chứa tập hợp các hành động chi tiết trong đợt đó
"""

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

from app.core.database import get_database

logger = logging.getLogger(__name__)


def extract_actor_info(user: Optional[dict]) -> dict:
    if not user:
        return {
            "user_id": "system",
            "username": "system",
            "full_name": "Hệ thống tự động",
            "role": "system"
        }

    return {
        "user_id": str(user.get("id") or user.get("_id") or "unknown"),
        "username": user.get("username") or "user",
        "full_name": user.get("full_name") or user.get("name") or user.get("username") or "Cán bộ thực địa",
        "role": user.get("role") or ("admin" if user.get("is_admin") else "staff")
    }


async def log_trip_activity(
    action_type: str,
    session_title: str,
    sub_action: str,
    sub_label: str,
    description: str,
    trip_id: str,
    trip_name: Optional[str] = None,
    trip_code: Optional[str] = None,
    actor_user: Optional[dict] = None,
    details: Optional[Dict[str, Any]] = None,
    time_window_minutes: int = 30
) -> dict:
    """
    Ghi nhật ký thao tác chuyến đi theo mô hình Cha - Con:
    - Nếu trong vòng time_window_minutes (mặc định 30p) cùng user thao tác cùng loại trên chuyến đi này,
      sẽ tự động gộp (append) vào Log Cha gần nhất.
    - Nếu không tìm thấy hoặc khác loại, tạo mới 1 Log Cha.
    """
    try:
        db = get_database()
        if db is None:
            logger.warning("Database not connected, cannot save log")
            return {}

        now = datetime.now(timezone.utc)
        actor = extract_actor_info(actor_user)
        user_id = actor["user_id"]

        # Nếu chưa truyền trip_name/trip_code, thử truy vấn nhanh từ admission_trips
        if (not trip_name or not trip_code) and trip_id:
            trip_doc = await db.admission_trips.find_one({"id": trip_id}, {"name": 1, "trip_code": 1})
            if trip_doc:
                trip_name = trip_name or trip_doc.get("name")
                trip_code = trip_code or trip_doc.get("trip_code")

        sub_activity = {
            "id": str(uuid.uuid4()),
            "action": sub_action,
            "label": sub_label,
            "description": description,
            "timestamp": now,
            "details": details or {}
        }

        # Kiểm tra Log Cha gần nhất trong khung thời gian time_window_minutes
        threshold = now - timedelta(minutes=time_window_minutes)
        query = {
            "action_type": action_type,
            "trip_id": trip_id,
            "actor.user_id": user_id,
            "updated_at": {"$gte": threshold}
        }

        existing_session = await db.system_logs.find_one(query, sort=[("updated_at", -1)])

        if existing_session:
            # GOM VÀO LOG CHA HIỆN TẠI (Tập con activities)
            update_fields = {
                "updated_at": now,
            }
            if trip_name:
                update_fields["trip_name"] = trip_name
            if trip_code:
                update_fields["trip_code"] = trip_code

            await db.system_logs.update_one(
                {"id": existing_session["id"]},
                {
                    "$push": {"activities": sub_activity},
                    "$inc": {"total_actions": 1},
                    "$set": update_fields
                }
            )
            logger.info(f"Appended sub-activity '{sub_action}' to session log {existing_session['id']}")
            return {**existing_session, "total_actions": existing_session.get("total_actions", 1) + 1}
        else:
            # TẠO MỚI LOG CHA (Khởi tạo phiên thao tác)
            session_id = str(uuid.uuid4())
            new_log_doc = {
                "id": session_id,
                "category": "TRIP",
                "action_type": action_type,
                "title": session_title,
                "trip_id": trip_id,
                "trip_code": trip_code,
                "trip_name": trip_name or "Chuyến đi thực địa",
                "actor": actor,
                "total_actions": 1,
                "activities": [sub_activity],
                "created_at": now,
                "updated_at": now,
                "is_deleted": False
            }

            await db.system_logs.insert_one(new_log_doc)
            logger.info(f"Created new session log {session_id} for trip {trip_id}")
            return new_log_doc

    except Exception as e:
        logger.error(f"Error logging trip activity: {e}", exc_info=True)
        return {}


async def log_system_activity(
    action_type: str,
    session_title: str,
    sub_action: str,
    sub_label: str,
    description: str,
    actor_user: Optional[dict] = None,
    details: Optional[Dict[str, Any]] = None,
    time_window_minutes: int = 30
) -> dict:
    """
    Ghi nhật ký hoạt động hệ thống (Đăng nhập, Quản lý tài khoản, Chiến dịch, Cài đặt).
    Tự động gom nhóm nếu cùng user thao tác liên tiếp trong phiên.
    """
    try:
        db = get_database()
        if db is None:
            return {}

        now = datetime.now(timezone.utc)
        actor = extract_actor_info(actor_user)
        user_id = actor["user_id"]

        sub_activity = {
            "id": str(uuid.uuid4()),
            "action": sub_action,
            "label": sub_label,
            "description": description,
            "timestamp": now,
            "details": details or {}
        }

        threshold = now - timedelta(minutes=time_window_minutes)
        query = {
            "category": "SYSTEM",
            "action_type": action_type,
            "actor.user_id": user_id,
            "updated_at": {"$gte": threshold}
        }

        existing_session = await db.system_logs.find_one(query, sort=[("updated_at", -1)])

        if existing_session:
            await db.system_logs.update_one(
                {"id": existing_session["id"]},
                {
                    "$push": {"activities": sub_activity},
                    "$inc": {"total_actions": 1},
                    "$set": {"updated_at": now}
                }
            )
            return {**existing_session, "total_actions": existing_session.get("total_actions", 1) + 1}
        else:
            session_id = str(uuid.uuid4())
            new_log_doc = {
                "id": session_id,
                "category": "SYSTEM",
                "action_type": action_type,
                "title": session_title,
                "trip_id": None,
                "trip_code": None,
                "trip_name": "Hệ thống chung",
                "actor": actor,
                "total_actions": 1,
                "activities": [sub_activity],
                "created_at": now,
                "updated_at": now,
                "is_deleted": False
            }
            await db.system_logs.insert_one(new_log_doc)
            return new_log_doc
    except Exception as e:
        logger.error(f"Error in log_system_activity: {e}", exc_info=True)
        return {}


async def get_system_logs(
    trip_id: Optional[str] = None,
    action_type: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
) -> List[dict]:
    """Lấy danh sách các Log Cha có phân trang và bộ lọc"""
    db = get_database()
    query: Dict[str, Any] = {"is_deleted": {"$ne": True}}

    if category:
        query["category"] = category

def format_log_item(log: dict) -> dict:
    if not log:
        return log
    log.pop("_id", None)
    if "created_at" in log and isinstance(log["created_at"], datetime) and log["created_at"].tzinfo is None:
        log["created_at"] = log["created_at"].replace(tzinfo=timezone.utc)
    if "updated_at" in log and isinstance(log["updated_at"], datetime) and log["updated_at"].tzinfo is None:
        log["updated_at"] = log["updated_at"].replace(tzinfo=timezone.utc)
    if "activities" in log and isinstance(log["activities"], list):
        for act in log["activities"]:
            if "timestamp" in act and isinstance(act["timestamp"], datetime) and act["timestamp"].tzinfo is None:
                act["timestamp"] = act["timestamp"].replace(tzinfo=timezone.utc)
    return log


async def count_system_logs(
    trip_id: Optional[str] = None,
    action_type: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None
) -> int:
    """Đếm tổng số bản ghi Log Cha theo bộ lọc"""
    db = get_database()
    query: Dict[str, Any] = {"is_deleted": {"$ne": True}}

    if category:
        query["category"] = category

    if trip_id:
        query["trip_id"] = trip_id

    if action_type:
        query["action_type"] = action_type
    else:
        # Bỏ qua hoàn toàn các log đăng nhập / phiên đăng nhập (AUTH_SESSION)
        query["action_type"] = {"$nin": ["AUTH_SESSION"]}

    if user_id:
        query["actor.user_id"] = user_id

    if search:
        s = search.strip()
        escaped_s = re.escape(s)
        query["$or"] = [
            {"title": {"$regex": escaped_s, "$options": "i"}},
            {"trip_name": {"$regex": escaped_s, "$options": "i"}},
            {"trip_code": {"$regex": escaped_s, "$options": "i"}},
            {"actor.full_name": {"$regex": escaped_s, "$options": "i"}},
            {"actor.username": {"$regex": escaped_s, "$options": "i"}},
            {"activities.description": {"$regex": escaped_s, "$options": "i"}},
            {"activities.label": {"$regex": escaped_s, "$options": "i"}},
            {"activities.action": {"$regex": escaped_s, "$options": "i"}}
        ]

    return await db.system_logs.count_documents(query)


async def get_system_logs(
    trip_id: Optional[str] = None,
    action_type: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
) -> List[dict]:
    """Lấy danh sách các Log Cha có phân trang và bộ lọc"""
    db = get_database()
    query: Dict[str, Any] = {"is_deleted": {"$ne": True}}

    if category:
        query["category"] = category

    if trip_id:
        query["trip_id"] = trip_id

    if action_type:
        query["action_type"] = action_type
    else:
        # Bỏ qua hoàn toàn các log đăng nhập / phiên đăng nhập (AUTH_SESSION)
        query["action_type"] = {"$nin": ["AUTH_SESSION"]}

    if user_id:
        query["actor.user_id"] = user_id

    if search:
        s = search.strip()
        escaped_s = re.escape(s)
        query["$or"] = [
            {"title": {"$regex": escaped_s, "$options": "i"}},
            {"trip_name": {"$regex": escaped_s, "$options": "i"}},
            {"trip_code": {"$regex": escaped_s, "$options": "i"}},
            {"actor.full_name": {"$regex": escaped_s, "$options": "i"}},
            {"actor.username": {"$regex": escaped_s, "$options": "i"}},
            {"activities.description": {"$regex": escaped_s, "$options": "i"}},
            {"activities.label": {"$regex": escaped_s, "$options": "i"}},
            {"activities.action": {"$regex": escaped_s, "$options": "i"}}
        ]

    cursor = db.system_logs.find(query).sort("updated_at", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    return [format_log_item(log) for log in logs]


async def get_trip_logs(trip_id: str) -> List[dict]:
    """Lấy toàn bộ lịch sử chỉnh sửa / thao tác của riêng chuyến đi này"""
    db = get_database()
    cursor = db.system_logs.find(
        {"trip_id": trip_id, "is_deleted": {"$ne": True}}
    ).sort("updated_at", -1)
    logs = await cursor.to_list(length=200)
    return [format_log_item(log) for log in logs]

