"""
School Counter Service - Quản lý và đồng bộ Counter Cache cho collection `schools`
Tự động duy trì 3 trường số liệu tổng hợp trong mỗi tài liệu trường học:
- `total_visits`: Tổng số lần đã ghé thăm trường từ trước tới nay
- `total_tickets`: Tổng số phiếu tuyển sinh đã thu thập được từ trước tới nay
- `last_visited_at`: Thời điểm ghé thăm gần nhất
"""
import logging
from datetime import datetime, timezone
from app.core.database import get_database

logger = logging.getLogger(__name__)


async def increment_school_visit(db, school_id: str, visited_time: datetime = None):
    """Tăng biến đếm tổng số lần ghé thăm cho trường học (O(1) Atomic)"""
    if not school_id:
        return
    now = datetime.now(timezone.utc)
    v_time = visited_time or now
    await db.schools.update_one(
        {"$or": [{"id": school_id}, {"code": school_id}], "is_deleted": {"$ne": True}},
        {
            "$inc": {"total_visits": 1},
            "$set": {"last_visited_at": v_time, "updated_at": now}
        }
    )


async def decrement_school_visit(db, school_id: str):
    """Giảm biến đếm khi hoàn tác check-in"""
    if not school_id:
        return
    now = datetime.now(timezone.utc)
    await db.schools.update_one(
        {"$or": [{"id": school_id}, {"code": school_id}], "is_deleted": {"$ne": True}},
        {
            "$inc": {"total_visits": -1},
            "$set": {"updated_at": now}
        }
    )
    # Đảm bảo không âm
    await db.schools.update_one(
        {"$or": [{"id": school_id}, {"code": school_id}], "total_visits": {"$lt": 0}},
        {"$set": {"total_visits": 0}}
    )


async def increment_school_tickets(db, school_id: str, tickets_count: int):
    """Tăng biến đếm tổng số phiếu tuyển sinh thu thập được (O(1) Atomic)"""
    if not school_id or tickets_count <= 0:
        return
    now = datetime.now(timezone.utc)
    await db.schools.update_one(
        {"$or": [{"id": school_id}, {"code": school_id}], "is_deleted": {"$ne": True}},
        {
            "$inc": {"total_tickets": tickets_count},
            "$set": {"updated_at": now}
        }
    )


async def decrement_school_tickets(db, school_id: str, tickets_count: int):
    """Giảm biến đếm khi xóa phiếu thu"""
    if not school_id or tickets_count <= 0:
        return
    now = datetime.now(timezone.utc)
    await db.schools.update_one(
        {"$or": [{"id": school_id}, {"code": school_id}], "is_deleted": {"$ne": True}},
        {
            "$inc": {"total_tickets": -tickets_count},
            "$set": {"updated_at": now}
        }
    )
    # Đảm bảo không âm
    await db.schools.update_one(
        {"$or": [{"id": school_id}, {"code": school_id}], "total_tickets": {"$lt": 0}},
        {"$set": {"total_tickets": 0}}
    )


async def sync_all_school_counters():
    """
    Quét và tính toán lại chính xác 100% các biến đếm total_visits, total_tickets, last_visited_at
    cho toàn bộ trường học trong collection `schools`.
    Chạy khi khởi động hoặc gọi thủ công qua API.
    """
    db = get_database()
    if db is None:
        logger.warning("Database chưa sẵn sàng để đồng bộ Counter Cache")
        return 0

    schools = await db.schools.find({"is_deleted": {"$ne": True}}).to_list(length=3000)
    synced_count = 0

    for s in schools:
        school_id = s.get("id") or str(s.get("_id"))
        school_code = s.get("code")

        match_or = []
        if school_id:
            match_or.append({"school_id": school_id})
        if school_code:
            match_or.append({"school_id": school_code})

        if not match_or:
            continue

        query = {"$or": match_or, "is_deleted": {"$ne": True}}

        cw_items = await db.campaign_waypoints.find(query).to_list(length=1000)
        w_items = await db.waypoints.find(query).to_list(length=1000)
        all_points = cw_items + w_items

        total_visits = 0
        total_tickets = 0
        last_visited_at = None

        seen_point_ids = set()
        for pt in all_points:
            pt_id = pt.get("id")
            if pt_id in seen_point_ids:
                continue
            seen_point_ids.add(pt_id)

            logs = [l for l in pt.get("visit_logs", []) if not l.get("is_deleted")]
            if pt.get("is_visited"):
                total_visits += max(1, len(logs))
            elif len(logs) > 0:
                total_visits += len(logs)

            if pt.get("visited_at"):
                v_time = pt.get("visited_at")
                if not last_visited_at or v_time > last_visited_at:
                    last_visited_at = v_time

            for l in logs:
                l_time = l.get("visit_date") or l.get("created_at")
                if l_time and (not last_visited_at or l_time > last_visited_at):
                    last_visited_at = l_time

            tickets = [t for t in pt.get("tickets", []) if not t.get("is_deleted")]
            for t in tickets:
                total_tickets += int(t.get("tickets_collected", 0))
                t_time = t.get("collection_date") or t.get("created_at")
                if t_time and (not last_visited_at or t_time > last_visited_at):
                    last_visited_at = t_time

        await db.schools.update_one(
            {"_id": s["_id"]},
            {
                "$set": {
                    "total_visits": total_visits,
                    "total_tickets": total_tickets,
                    "last_visited_at": last_visited_at,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        synced_count += 1

    logger.info(f"✅ [Counter Cache]: Đã đồng bộ số liệu cho {synced_count} trường học thành công.")
    return synced_count
