"""
Unified Waypoint Management API - Kiến trúc Document-Oriented tối ưu NoSQL
Toàn bộ thông tin trường học, chi tiết tuyển sinh, lịch sử ghé thăm (visit_logs)
và phiếu thu (tickets) được lưu trữ tập trung, nguyên tử trong collection `waypoints`.
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
)
from app.schemas.waypoint_schemas import (
    WaypointDetailCreate, WaypointDetailUpdate, WaypointDetailResponse,
    VisitLogCreate, VisitLogUpdate, VisitLogResponse,
    TicketCreate, TicketUpdate, TicketResponse
)

router = APIRouter(prefix="/waypoints", tags=["Waypoints"])


def format_waypoint_response(wp: dict) -> WaypointResponse:
    """Helper định dạng document waypoint trả về chuẩn response"""
    if "visit_logs" not in wp:
        wp["visit_logs"] = []
    else:
        wp["visit_logs"] = [v for v in wp["visit_logs"] if not v.get("is_deleted")]

    if "tickets" not in wp:
        wp["tickets"] = []
    else:
        wp["tickets"] = [t for t in wp["tickets"] if not t.get("is_deleted")]

    wp["total_tickets"] = sum(t.get("tickets_collected", 0) for t in wp["tickets"])

    return WaypointResponse.model_validate(wp)


# ==================== 1. QUẢN LÝ WAYPOINT (CRUD) ====================

@router.get("", response_model=List[WaypointResponse])
async def list_waypoints(
    trip_id: Optional[str] = Query(None, description="Lọc theo mã chuyến đi"),
    school_id: Optional[str] = Query(None, description="Lọc theo mã trường"),
    type: Optional[WaypointType] = Query(None, description="Lọc theo loại điểm dừng"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tên trường hoặc địa chỉ"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000)
):
    """
    Lấy danh sách điểm dừng (đã bao gồm đầy đủ thông tin trường, lịch sử và phiếu thu).
    Chỉ cần 1 truy vấn duy nhất, tốc độ cực nhanh.
    """
    db = get_database()
    query: dict = {"is_deleted": {"$ne": True}}
    if trip_id:
        query["trip_id"] = trip_id
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

    cursor = db.waypoints.find(query).sort("visit_order", 1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return [format_waypoint_response(w) for w in items]


@router.post("", response_model=WaypointResponse, status_code=status.HTTP_201_CREATED)
async def create_waypoint(waypoint_data: WaypointCreate):
    """
    Thêm điểm dừng mới với cấu trúc thống nhất:
    - Tự động snapshot thông tin từ danh mục schools nếu có school_id.
    - Khởi tạo mảng visit_logs và tickets rỗng, sẵn sàng phục vụ đợt tuyển sinh.
    """
    db = get_database()
    wp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Tính thứ tự ghé thăm nếu gắn theo chuyến đi
    max_order = 0
    if waypoint_data.trip_id:
        cursor = db.waypoints.find({"trip_id": waypoint_data.trip_id, "is_deleted": {"$ne": True}})
        existing_wps = await cursor.to_list(length=1000)
        max_order = max([w.get("visit_order", 0) for w in existing_wps], default=0)

    wp_dict = waypoint_data.model_dump(exclude_unset=True)
    if "type" in wp_dict and hasattr(wp_dict["type"], "value"):
        wp_dict["type"] = wp_dict["type"].value

    # Tự động đồng bộ từ bảng schools nếu có school_id
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
            if not wp_dict.get("description"):
                wp_dict["description"] = school.get("description")
            if not wp_dict.get("website"):
                wp_dict["website"] = school.get("website")
            if not wp_dict.get("image_url"):
                wp_dict["image_url"] = school.get("image_url")
            if not wp_dict.get("admissions_info"):
                wp_dict["admissions_info"] = school.get("admissions_info")
            if school.get("school_board"):
                sb = school["school_board"]
                if not wp_dict.get("principal_name"):
                    wp_dict["principal_name"] = sb.get("principal_name")
                if not wp_dict.get("principal_phone"):
                    wp_dict["principal_phone"] = sb.get("principal_phone")
                if not wp_dict.get("vice_principal_name"):
                    wp_dict["vice_principal_name"] = sb.get("vice_principal_name")
                if not wp_dict.get("vice_principal_phone"):
                    wp_dict["vice_principal_phone"] = sb.get("vice_principal_phone")

    wp_doc = {
        **wp_dict,
        "id": wp_id,
        "visit_order": max_order + 1 if waypoint_data.trip_id else None,
        "is_visited": False,
        "visited_at": None,
        "visit_logs": [],
        "tickets": [],
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }

    await db.waypoints.insert_one(wp_doc)
    return format_waypoint_response(wp_doc)


@router.get("/{waypoint_id}", response_model=WaypointResponse)
async def get_waypoint(waypoint_id: str):
    """
    Lấy thông tin chi tiết một điểm dừng theo ID (trả về toàn bộ trường học, nhật ký và phiếu thu).
    """
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")
    return format_waypoint_response(wp)


@router.patch("/{waypoint_id}", response_model=WaypointResponse)
async def update_waypoint(waypoint_id: str, waypoint_data: WaypointUpdate):
    """
    Cập nhật thông tin điểm dừng và trường học trực tiếp trên collection waypoints.
    """
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
    return format_waypoint_response(updated_wp)


@router.delete("/{waypoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_waypoint(waypoint_id: str):
    """
    Xóa mềm điểm dừng: 01 câu lệnh nguyên tử, tự động bảo vệ an toàn toàn bộ nhật ký và phiếu thu.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    await db.waypoints.update_one(
        {"id": waypoint_id},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )


# ==================== 2. ENDPOINTS TƯƠNG THÍCH: THÔNG TIN CHI TIẾT ====================

@router.get("/{waypoint_id}/detail", response_model=WaypointDetailResponse | None)
async def get_waypoint_detail(waypoint_id: str):
    """
    Endpoint tương thích ngược: Trả về thông tin trường chi tiết trực tiếp từ document waypoint.
    """
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        return None

    return WaypointDetailResponse(
        id=wp.get("id"),
        waypoint_id=wp.get("id"),
        description=wp.get("description"),
        image_url=wp.get("image_url"),
        website=wp.get("website"),
        representative_name=wp.get("representative_name"),
        representative_phone=wp.get("representative_phone"),
        principal_name=wp.get("principal_name"),
        principal_phone=wp.get("principal_phone"),
        vice_principal_name=wp.get("vice_principal_name"),
        vice_principal_phone=wp.get("vice_principal_phone"),
        admissions_info=wp.get("admissions_info"),
        our_contact_person=wp.get("our_contact_person"),
        our_contact_role=wp.get("our_contact_role"),
        contact_process=wp.get("contact_process"),
        total_contact_attempts=wp.get("total_contact_attempts", 0),
        notes=wp.get("notes"),
        created_at=wp.get("created_at"),
        updated_at=wp.get("updated_at")
    )


@router.patch("/{waypoint_id}/detail", response_model=WaypointDetailResponse)
async def update_waypoint_detail(waypoint_id: str, detail_data: WaypointDetailUpdate):
    """
    Endpoint tương thích ngược: Cập nhật thông tin trường chi tiết trực tiếp vào document waypoint.
    """
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    now = datetime.now(timezone.utc)
    update_dict = detail_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = now
    await db.waypoints.update_one({"id": waypoint_id}, {"$set": update_dict})

    updated_wp = await db.waypoints.find_one({"id": waypoint_id})
    return WaypointDetailResponse(
        id=updated_wp.get("id"),
        waypoint_id=updated_wp.get("id"),
        description=updated_wp.get("description"),
        image_url=updated_wp.get("image_url"),
        website=updated_wp.get("website"),
        representative_name=updated_wp.get("representative_name"),
        representative_phone=updated_wp.get("representative_phone"),
        principal_name=updated_wp.get("principal_name"),
        principal_phone=updated_wp.get("principal_phone"),
        vice_principal_name=updated_wp.get("vice_principal_name"),
        vice_principal_phone=updated_wp.get("vice_principal_phone"),
        admissions_info=updated_wp.get("admissions_info"),
        our_contact_person=updated_wp.get("our_contact_person"),
        our_contact_role=updated_wp.get("our_contact_role"),
        contact_process=updated_wp.get("contact_process"),
        total_contact_attempts=updated_wp.get("total_contact_attempts", 0),
        notes=updated_wp.get("notes"),
        created_at=updated_wp.get("created_at"),
        updated_at=updated_wp.get("updated_at")
    )


# ==================== 3. LỊCH SỬ GHÉ THĂM (VISIT LOGS - EMBEDDED) ====================

@router.get("/{waypoint_id}/visit-logs", response_model=List[VisitLogResponse])
async def get_visit_logs(waypoint_id: str):
    """Lấy danh sách nhật ký ghé thăm trực tiếp từ mảng nhúng của waypoint"""
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    logs = wp.get("visit_logs", [])
    active_logs = [log for log in logs if not log.get("is_deleted")]
    # Sắp xếp mới nhất trước
    active_logs.sort(key=lambda x: x.get("visit_date") or x.get("created_at") or datetime.min, reverse=True)
    return [VisitLogResponse.model_validate(log) for log in active_logs]


@router.post("/{waypoint_id}/visit-logs", response_model=VisitLogResponse, status_code=status.HTTP_201_CREATED)
async def create_visit_log(waypoint_id: str, log_data: VisitLogCreate):
    """Thêm nhật ký ghé thăm mới vào mảng visit_logs của waypoint ($push)"""
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
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

    # Đưa ảnh nếu có truyền URL ảnh ban đầu
    if log_data.image_urls:
        urls = [u.strip() for u in log_data.image_urls.split(",") if u.strip()]
        for u in urls:
            log_doc["images"].append({
                "id": str(uuid.uuid4()),
                "cloudinary_url": u,
                "created_at": now
            })

    await db.waypoints.update_one(
        {"id": waypoint_id},
        {"$push": {"visit_logs": log_doc}, "$set": {"updated_at": now}}
    )
    return VisitLogResponse.model_validate(log_doc)


@router.patch("/visit-logs/{log_id}", response_model=VisitLogResponse)
async def update_visit_log(log_id: str, log_data: VisitLogUpdate):
    """Cập nhật nội dung nhật ký ghé thăm"""
    db = get_database()
    wp = await db.waypoints.find_one({"visit_logs.id": log_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký ghé thăm")

    update_dict = log_data.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)
    set_ops = {f"visit_logs.$.{k}": v for k, v in update_dict.items()}
    set_ops["updated_at"] = now

    await db.waypoints.update_one({"visit_logs.id": log_id}, {"$set": set_ops})

    updated_wp = await db.waypoints.find_one({"visit_logs.id": log_id})
    target_log = next((l for l in updated_wp.get("visit_logs", []) if l.get("id") == log_id), None)
    return VisitLogResponse.model_validate(target_log)


@router.delete("/visit-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visit_log(log_id: str):
    """Xóa mềm nhật ký ghé thăm"""
    db = get_database()
    now = datetime.now(timezone.utc)
    wp = await db.waypoints.find_one({"visit_logs.id": log_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký ghé thăm")

    await db.waypoints.update_one(
        {"visit_logs.id": log_id},
        {"$set": {"visit_logs.$.is_deleted": True, "visit_logs.$.deleted_at": now, "updated_at": now}}
    )


# ==================== 4. PHIẾU THU THÔNG TIN (TICKETS - EMBEDDED) ====================

@router.get("/{waypoint_id}/tickets", response_model=List[TicketResponse])
async def get_tickets(waypoint_id: str):
    """Lấy danh sách phiếu thu trực tiếp từ mảng nhúng của waypoint"""
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    tickets = wp.get("tickets", [])
    active_tickets = [t for t in tickets if not t.get("is_deleted")]
    active_tickets.sort(key=lambda x: x.get("collection_date") or x.get("created_at") or datetime.min, reverse=True)
    return [TicketResponse.model_validate(t) for t in active_tickets]


@router.post("/{waypoint_id}/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(waypoint_id: str, ticket_data: TicketCreate):
    """Thêm đợt phiếu thu mới vào mảng tickets của waypoint ($push)"""
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
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

    await db.waypoints.update_one(
        {"id": waypoint_id},
        {"$push": {"tickets": ticket_doc}, "$set": {"updated_at": now}}
    )
    return TicketResponse.model_validate(ticket_doc)


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(ticket_id: str, ticket_data: TicketUpdate):
    """Cập nhật thông tin phiếu thu"""
    db = get_database()
    wp = await db.waypoints.find_one({"tickets.id": ticket_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu thu")

    update_dict = ticket_data.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)
    set_ops = {f"tickets.$.{k}": v for k, v in update_dict.items()}
    set_ops["updated_at"] = now

    await db.waypoints.update_one({"tickets.id": ticket_id}, {"$set": set_ops})

    updated_wp = await db.waypoints.find_one({"tickets.id": ticket_id})
    target_ticket = next((t for t in updated_wp.get("tickets", []) if t.get("id") == ticket_id), None)
    return TicketResponse.model_validate(target_ticket)


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: str):
    """Xóa mềm phiếu thu"""
    db = get_database()
    now = datetime.now(timezone.utc)
    wp = await db.waypoints.find_one({"tickets.id": ticket_id, "is_deleted": {"$ne": True}})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu thu")

    await db.waypoints.update_one(
        {"tickets.id": ticket_id},
        {"$set": {"tickets.$.is_deleted": True, "tickets.$.deleted_at": now, "updated_at": now}}
    )
