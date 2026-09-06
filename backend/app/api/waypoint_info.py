"""
Unified Waypoint & Campaign Waypoint Management API
Tách bạch hoàn toàn:
- `waypoints`: Điểm dừng cố định / POI trên bản đồ.
- `campaign_waypoints`: Điểm dừng trong chiến dịch / chuyến đi (kèm visit_logs, tickets).
- `schools`: Toàn bộ hồ sơ trường học (Ban giám hiệu, mô tả, website, tuyển sinh).
"""

from fastapi import APIRouter, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.core.database import get_database
from app.schemas import (
    WaypointType,
    WaypointCreate,
    WaypointUpdate,
    WaypointResponse,
    CampaignWaypointResponse,
    CampaignWaypointCreate,
    CampaignWaypointUpdate
)
from app.schemas.waypoint_schemas import (
    WaypointDetailCreate, WaypointDetailUpdate, WaypointDetailResponse,
    VisitLogCreate, VisitLogUpdate, VisitLogResponse,
    TicketCreate, TicketUpdate, TicketResponse
)
from app.services.trip_service import sync_waypoint_to_school

router = APIRouter(prefix="/waypoints", tags=["Waypoints"])


async def format_waypoint_response_async(db, wp: dict) -> WaypointResponse:
    """Định dạng waypoint và tự động populate thông tin trường từ schools"""
    doc = dict(wp)
    doc.pop("_id", None)
    if doc.get("school_id"):
        school = await db.schools.find_one({
            "$or": [{"id": doc["school_id"]}, {"code": doc["school_id"]}],
            "is_deleted": {"$ne": True}
        })
        if school:
            school.pop("_id", None)
            doc["school"] = school
    return WaypointResponse.model_validate(doc)


async def find_any_point(db, point_id: str):
    """Tìm điểm dừng trong campaign_waypoints hoặc waypoints"""
    wp = await db.campaign_waypoints.find_one({"id": point_id, "is_deleted": {"$ne": True}})
    is_campaign_wp = True
    if not wp:
        wp = await db.waypoints.find_one({"id": point_id, "is_deleted": {"$ne": True}})
        is_campaign_wp = False
    return wp, is_campaign_wp


# ==================== 1. QUẢN LÝ ĐIỂM DỪNG BẢN ĐỒ (WAYPOINTS) ====================

@router.get("", response_model=List[WaypointResponse])
async def list_waypoints(
    school_id: Optional[str] = Query(None, description="Lọc theo mã trường"),
    type: Optional[WaypointType] = Query(None, description="Lọc theo loại điểm dừng"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tên trường hoặc địa chỉ"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000)
):
    """Lấy danh sách các điểm dừng / POI trên bản đồ"""
    db = get_database()
    query: dict = {"is_deleted": {"$ne": True}}
    if school_id:
        query["school_id"] = school_id
    if type:
        query["type"] = type.value if hasattr(type, "value") else str(type)
    if search:
        search_regex = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"address": search_regex},
            {"school_id": search_regex}
        ]

    cursor = db.waypoints.find(query).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return [await format_waypoint_response_async(db, w) for w in items]


@router.post("", response_model=WaypointResponse, status_code=status.HTTP_201_CREATED)
async def create_waypoint(waypoint_data: WaypointCreate):
    """Thêm địa điểm / điểm dừng mới trên bản đồ"""
    db = get_database()
    wp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    wp_dict = waypoint_data.model_dump(exclude_unset=True)
    if "type" in wp_dict and hasattr(wp_dict["type"], "value"):
        wp_dict["type"] = wp_dict["type"].value

    # Tự động lấy tọa độ từ schools nếu có school_id mà thiếu
    if waypoint_data.school_id:
        school = await db.schools.find_one({
            "$or": [{"id": waypoint_data.school_id}, {"code": waypoint_data.school_id}],
            "is_deleted": {"$ne": True}
        })
        if school:
            if not wp_dict.get("name") or wp_dict.get("name") == "string":
                wp_dict["name"] = school.get("name", wp_dict.get("name"))
            if not wp_dict.get("address"):
                wp_dict["address"] = school.get("address")
            if not wp_dict.get("lat") and school.get("lat"):
                wp_dict["lat"] = school.get("lat")
            if not wp_dict.get("lng") and school.get("lng"):
                wp_dict["lng"] = school.get("lng")

    wp_doc = {
        **wp_dict,
        "id": wp_id,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.waypoints.insert_one(wp_doc)
    return await format_waypoint_response_async(db, wp_doc)


@router.patch("/{waypoint_id}", response_model=WaypointResponse)
async def update_waypoint(waypoint_id: str, waypoint_data: WaypointUpdate):
    """Cập nhật tọa độ, tên hoặc ghi chú của điểm dừng"""
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    update_dict = waypoint_data.model_dump(exclude_unset=True)
    if "type" in update_dict and hasattr(update_dict["type"], "value"):
        update_dict["type"] = update_dict["type"].value

    now = datetime.now(timezone.utc)
    update_dict["updated_at"] = now
    await db.waypoints.update_one({"id": waypoint_id}, {"$set": update_dict})

    updated_wp = await db.waypoints.find_one({"id": waypoint_id})
    return await format_waypoint_response_async(db, updated_wp)


@router.delete("/{waypoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_waypoint(waypoint_id: str):
    """Xóa mềm điểm dừng trên bản đồ"""
    db = get_database()
    now = datetime.now(timezone.utc)
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    await db.waypoints.update_one(
        {"id": waypoint_id},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )


# ==================== 2. THÔNG TIN CHI TIẾT TRƯỜNG HỌC (TỪ SCHOOLS) ====================

@router.get("/{waypoint_id}/detail", response_model=WaypointDetailResponse | None)
async def get_waypoint_detail(waypoint_id: str):
    """
    Xem chi tiết thông tin trường học:
    Truy vấn trực tiếp từ bảng `schools` theo `school_id` của điểm dừng.
    """
    db = get_database()
    wp, _ = await find_any_point(db, waypoint_id)
    if not wp:
        return None

    school_id = wp.get("school_id")
    school = None
    if school_id:
        school = await db.schools.find_one({
            "$or": [{"id": school_id}, {"code": school_id}],
            "is_deleted": {"$ne": True}
        })

    board = school.get("school_board") if school else {}
    return WaypointDetailResponse(
        id=wp.get("id"),
        waypoint_id=wp.get("id"),
        description=school.get("description") if school else None,
        image_url=school.get("image_url") if school else None,
        website=school.get("website") if school else None,
        representative_name=school.get("representative_name") if school else None,
        representative_phone=school.get("representative_phone") if school else None,
        principal_name=board.get("principal_name") if board else None,
        principal_phone=board.get("principal_phone") if board else None,
        vice_principal_name=board.get("vice_principal_name") if board else None,
        vice_principal_phone=board.get("vice_principal_phone") if board else None,
        admissions_info=school.get("admissions_info") if school else None,
        notes=wp.get("notes") or (school.get("notes") if school else None),
        created_at=wp.get("created_at"),
        updated_at=wp.get("updated_at")
    )


@router.patch("/{waypoint_id}/detail", response_model=WaypointDetailResponse)
async def update_waypoint_detail(waypoint_id: str, detail_data: WaypointDetailUpdate):
    """
    Cập nhật thông tin trường học:
    Cập nhật trực tiếp vào bảng `schools`, tách bạch hoàn toàn với bản đồ.
    """
    db = get_database()
    wp, is_cw = await find_any_point(db, waypoint_id)
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    school_id = wp.get("school_id")
    update_dict = detail_data.model_dump(exclude_unset=True)

    if school_id:
        await sync_waypoint_to_school(db, school_id, update_dict)

    # Nếu có cập nhật notes riêng của điểm dừng
    if "notes" in update_dict:
        col = db.campaign_waypoints if is_cw else db.waypoints
        await col.update_one({"id": waypoint_id}, {"$set": {"notes": update_dict["notes"]}})

    return await get_waypoint_detail(waypoint_id)


# ==================== 3. LỊCH SỬ GHÉ THĂM (VISIT LOGS) ====================

@router.get("/{waypoint_id}/visit-logs", response_model=List[VisitLogResponse])
async def get_visit_logs(waypoint_id: str):
    """Lấy danh sách nhật ký ghé thăm của điểm dừng"""
    db = get_database()
    wp, _ = await find_any_point(db, waypoint_id)
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    logs = wp.get("visit_logs", [])
    active_logs = [log for log in logs if not log.get("is_deleted")]
    active_logs.sort(key=lambda x: x.get("visit_date") or x.get("created_at") or datetime.min, reverse=True)
    return [VisitLogResponse.model_validate(log) for log in active_logs]


@router.post("/{waypoint_id}/visit-logs", response_model=VisitLogResponse, status_code=status.HTTP_201_CREATED)
async def create_visit_log(waypoint_id: str, log_data: VisitLogCreate):
    """Thêm nhật ký ghé thăm mới vào điểm dừng ($push)"""
    db = get_database()
    wp, is_cw = await find_any_point(db, waypoint_id)
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    now = datetime.now(timezone.utc)
    log_id = str(uuid.uuid4())
    log_doc = {
        "id": log_id,
        "waypoint_id": waypoint_id,
        "visit_content": log_data.visit_content,
        "image_urls": log_data.image_urls,
        "visit_date": now,
        "created_at": now,
        "images": [],
        "is_deleted": False
    }

    if log_data.image_urls:
        urls = [u.strip() for u in log_data.image_urls.split(",") if u.strip()]
        for u in urls:
            log_doc["images"].append({
                "id": str(uuid.uuid4()),
                "cloudinary_url": u,
                "created_at": now
            })

    col = db.campaign_waypoints if is_cw else db.waypoints
    await col.update_one(
        {"id": waypoint_id},
        {"$push": {"visit_logs": log_doc}, "$set": {"updated_at": now}}
    )
    return VisitLogResponse.model_validate(log_doc)


@router.delete("/visit-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visit_log(log_id: str):
    """Xóa mềm nhật ký ghé thăm"""
    db = get_database()
    now = datetime.now(timezone.utc)
    
    res = await db.campaign_waypoints.update_one(
        {"visit_logs.id": log_id},
        {"$set": {"visit_logs.$.is_deleted": True, "visit_logs.$.deleted_at": now, "updated_at": now}}
    )
    if res.matched_count == 0:
        await db.waypoints.update_one(
            {"visit_logs.id": log_id},
            {"$set": {"visit_logs.$.is_deleted": True, "visit_logs.$.deleted_at": now, "updated_at": now}}
        )


# ==================== 4. PHIẾU THU THÔNG TIN (TICKETS) ====================

@router.get("/{waypoint_id}/tickets", response_model=List[TicketResponse])
async def get_tickets(waypoint_id: str):
    """Lấy danh sách phiếu thu trực tiếp của điểm dừng"""
    db = get_database()
    wp, _ = await find_any_point(db, waypoint_id)
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    tickets = wp.get("tickets", [])
    active_tickets = [t for t in tickets if not t.get("is_deleted")]
    active_tickets.sort(key=lambda x: x.get("collection_date") or x.get("created_at") or datetime.min, reverse=True)
    return [TicketResponse.model_validate(t) for t in active_tickets]


@router.post("/{waypoint_id}/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(waypoint_id: str, ticket_data: TicketCreate):
    """Thêm phiếu thu mới vào điểm dừng ($push)"""
    db = get_database()
    wp, is_cw = await find_any_point(db, waypoint_id)
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    now = datetime.now(timezone.utc)
    ticket_id = str(uuid.uuid4())
    ticket_doc = {
        "id": ticket_id,
        "waypoint_id": waypoint_id,
        "visit_number": ticket_data.visit_number,
        "tickets_collected": ticket_data.tickets_collected,
        "notes": ticket_data.notes,
        "collection_date": now,
        "created_at": now,
        "is_deleted": False
    }

    col = db.campaign_waypoints if is_cw else db.waypoints
    await col.update_one(
        {"id": waypoint_id},
        {"$push": {"tickets": ticket_doc}, "$set": {"updated_at": now}}
    )
    return TicketResponse.model_validate(ticket_doc)


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: str):
    """Xóa mềm phiếu thu"""
    db = get_database()
    now = datetime.now(timezone.utc)
    res = await db.campaign_waypoints.update_one(
        {"tickets.id": ticket_id},
        {"$set": {"tickets.$.is_deleted": True, "tickets.$.deleted_at": now, "updated_at": now}}
    )
    if res.matched_count == 0:
        await db.waypoints.update_one(
            {"tickets.id": ticket_id},
            {"$set": {"tickets.$.is_deleted": True, "tickets.$.deleted_at": now, "updated_at": now}}
        )
