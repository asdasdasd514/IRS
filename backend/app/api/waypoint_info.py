"""API endpoints cho quản lý Waypoint & 3 phần thông tin chi tiết (MongoDB IRS)"""
from fastapi import APIRouter, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
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


# ==================== QUẢN LÝ WAYPOINT (CRUD) ====================

@router.get("", response_model=List[WaypointResponse])
async def list_waypoints(
    trip_id: Optional[str] = Query(None, description="Lọc theo mã chuyến đi"),
    school_id: Optional[str] = Query(None, description="Lọc theo mã trường THPT"),
    type: Optional[WaypointType] = Query(None, description="Lọc theo loại điểm dừng"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tên trường hoặc địa chỉ"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000)
):
    """
    Lấy danh sách điểm dừng (Waypoint), hỗ trợ lọc theo chuyến đi, mã trường, loại điểm dừng và tìm kiếm tên/địa chỉ.
    """
    db = get_database()
    query: dict = {}
    if trip_id:
        query["trip_id"] = trip_id
    if school_id:
        query["school_id"] = school_id
    if type:
        query["type"] = type.value if hasattr(type, "value") else str(type)
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}},
            {"school_id": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.waypoints.find(query).sort("visit_order", 1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    
    # Bổ sung thông tin từ waypoint_details nếu trên waypoint còn trống
    for wp in items:
        detail = await db.waypoint_details.find_one({"waypoint_id": wp.get("id")})
        if detail:
            for f in ["description", "image_url", "website", "representative_name", "representative_phone",
                      "principal_name", "principal_phone", "vice_principal_name", "vice_principal_phone",
                      "admissions_info", "notes"]:
                if detail.get(f) and not wp.get(f):
                    wp[f] = detail[f]

    return [WaypointResponse.model_validate(w) for w in items]


@router.post("", response_model=WaypointResponse, status_code=status.HTTP_201_CREATED)
async def create_waypoint(waypoint_data: WaypointCreate):
    """
    Thêm điểm dừng mới kèm đầy đủ thông tin trường:
    - Tên trường, Giới thiệu về trường, Ảnh, Website
    - Người đại diện / Hiệu trưởng, Phó hiệu trưởng
    - Thông tin tuyển sinh, số lượng học sinh khối 12, ghi chú...
    """
    db = get_database()
    wp_id = str(uuid.uuid4())
    now = datetime.utcnow()

    # Tính thứ tự ghé thăm nếu có gắn trip_id
    max_order = 0
    if waypoint_data.trip_id:
        cursor = db.waypoints.find({"trip_id": waypoint_data.trip_id})
        existing_wps = await cursor.to_list(length=1000)
        max_order = max([w.get("visit_order", 0) for w in existing_wps], default=0)

    wp_dict = waypoint_data.model_dump(exclude_unset=True)
    if "type" in wp_dict and hasattr(wp_dict["type"], "value"):
        wp_dict["type"] = wp_dict["type"].value

    # Tự động đồng bộ từ bảng danh mục trường THPT nếu có school_id
    if waypoint_data.school_id:
        school = await db.schools.find_one({"$or": [{"id": waypoint_data.school_id}, {"code": waypoint_data.school_id}]})
        if school:
            if not wp_dict.get("description"):
                wp_dict["description"] = school.get("description")
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
        "created_at": now,
        "updated_at": now
    }
    await db.waypoints.insert_one(wp_doc)

    # Đồng bộ sang collection waypoint_details
    detail_doc = {
        "id": str(uuid.uuid4()),
        "waypoint_id": wp_id,
        "description": wp_doc.get("description"),
        "image_url": wp_doc.get("image_url"),
        "website": wp_doc.get("website"),
        "representative_name": wp_doc.get("representative_name") or wp_doc.get("principal_name"),
        "representative_phone": wp_doc.get("representative_phone") or wp_doc.get("principal_phone"),
        "principal_name": wp_doc.get("principal_name"),
        "principal_phone": wp_doc.get("principal_phone"),
        "vice_principal_name": wp_doc.get("vice_principal_name"),
        "vice_principal_phone": wp_doc.get("vice_principal_phone"),
        "admissions_info": wp_doc.get("admissions_info"),
        "our_contact_person": None,
        "our_contact_role": None,
        "contact_process": None,
        "total_contact_attempts": 0,
        "notes": wp_doc.get("notes"),
        "created_at": now,
        "updated_at": now
    }
    await db.waypoint_details.insert_one(detail_doc)

    return WaypointResponse.model_validate(wp_doc)


@router.get("/{waypoint_id}", response_model=WaypointResponse)
async def get_waypoint(waypoint_id: str):
    """
    Lấy thông tin chi tiết một điểm dừng theo ID (kèm thông tin trường học đầy đủ).
    """
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    # Bổ sung thông tin từ waypoint_details nếu có
    detail = await db.waypoint_details.find_one({"waypoint_id": waypoint_id})
    if detail:
        for f in ["description", "image_url", "website", "representative_name", "representative_phone",
                  "principal_name", "principal_phone", "vice_principal_name", "vice_principal_phone",
                  "admissions_info", "notes"]:
            if detail.get(f) and not wp.get(f):
                wp[f] = detail[f]

    return WaypointResponse.model_validate(wp)


@router.patch("/{waypoint_id}", response_model=WaypointResponse)
async def update_waypoint(waypoint_id: str, waypoint_data: WaypointUpdate):
    """
    Cập nhật thông tin điểm dừng và thông tin trường học.
    """
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    update_dict = waypoint_data.model_dump(exclude_unset=True)
    if "type" in update_dict and hasattr(update_dict["type"], "value"):
        update_dict["type"] = update_dict["type"].value

    now = datetime.utcnow()
    update_dict["updated_at"] = now
    await db.waypoints.update_one({"id": waypoint_id}, {"$set": update_dict})

    # Đồng bộ cập nhật vào collection waypoint_details
    detail_fields = [
        "description", "image_url", "website", "representative_name", "representative_phone",
        "principal_name", "principal_phone", "vice_principal_name", "vice_principal_phone",
        "admissions_info", "notes"
    ]
    detail_updates = {k: v for k, v in update_dict.items() if k in detail_fields}
    if detail_updates:
        detail_updates["updated_at"] = now
        await db.waypoint_details.update_one(
            {"waypoint_id": waypoint_id},
            {"$set": detail_updates},
            upsert=True
        )

    updated_wp = await db.waypoints.find_one({"id": waypoint_id})
    return WaypointResponse.model_validate(updated_wp)


@router.delete("/{waypoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_waypoint(waypoint_id: str):
    """
    Xóa điểm dừng và tự động dọn dẹp các bảng con liên quan (details, visit logs, tickets, images).
    """
    db = get_database()
    wp = await db.waypoints.find_one({"id": waypoint_id})
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    await db.waypoints.delete_one({"id": waypoint_id})
    await db.waypoint_details.delete_many({"waypoint_id": waypoint_id})
    await db.waypoint_visit_logs.delete_many({"waypoint_id": waypoint_id})
    await db.waypoint_tickets.delete_many({"waypoint_id": waypoint_id})
    await db.waypoint_images.delete_many({"visit_log_id": waypoint_id})


# ==================== PHẦN 1: Thông tin chi tiết ====================
@router.get("/{waypoint_id}/detail", response_model=WaypointDetailResponse | None)
async def get_waypoint_detail(waypoint_id: str):
    db = get_database()
    detail = await db.waypoint_details.find_one({"waypoint_id": waypoint_id})
    return detail


@router.post("/{waypoint_id}/detail", response_model=WaypointDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_waypoint_detail(waypoint_id: str, detail_data: WaypointDetailCreate):

    db = get_database()
    waypoint = await db.waypoints.find_one({"id": waypoint_id})
    if not waypoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint not found")
    
    existing = await db.waypoint_details.find_one({"waypoint_id": waypoint_id})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Waypoint detail already exists. Use PATCH to update.")
    
    now = datetime.utcnow()
    detail_doc = {
        "id": str(uuid.uuid4()),
        "waypoint_id": waypoint_id,
        **detail_data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.waypoint_details.insert_one(detail_doc)
    return detail_doc


@router.patch("/{waypoint_id}/detail", response_model=WaypointDetailResponse)
async def update_waypoint_detail(waypoint_id: str, detail_data: WaypointDetailUpdate):
    db = get_database()
    detail = await db.waypoint_details.find_one({"waypoint_id": waypoint_id})
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint detail not found")
    
    update_dict = detail_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.utcnow()
    await db.waypoint_details.update_one({"waypoint_id": waypoint_id}, {"$set": update_dict})
    return await db.waypoint_details.find_one({"waypoint_id": waypoint_id})


# ==================== PHẦN 2: Lịch sử ghé thăm ====================
@router.get("/{waypoint_id}/visit-logs", response_model=list[VisitLogResponse])
async def get_visit_logs(waypoint_id: str):
    db = get_database()
    cursor = db.waypoint_visit_logs.find({"waypoint_id": waypoint_id}).sort("visit_date", -1)
    logs = await cursor.to_list(length=1000)

    for log in logs:
        img_cursor = db.waypoint_images.find({"visit_log_id": log["id"]}).sort("created_at", 1)
        log["images"] = await img_cursor.to_list(length=100)

    return logs


@router.post("/{waypoint_id}/visit-logs", response_model=VisitLogResponse, status_code=status.HTTP_201_CREATED)
async def create_visit_log(waypoint_id: str, log_data: VisitLogCreate):
    db = get_database()
    waypoint = await db.waypoints.find_one({"id": waypoint_id})
    if not waypoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint not found")
    
    now = datetime.utcnow()
    log_doc = {
        "id": str(uuid.uuid4()),
        "waypoint_id": waypoint_id,
        "visit_content": log_data.visit_content,
        "image_urls": log_data.image_urls,
        "visit_date": now,
        "created_at": now,
        "images": []
    }
    await db.waypoint_visit_logs.insert_one(log_doc)
    return log_doc


@router.patch("/visit-logs/{log_id}", response_model=VisitLogResponse)
async def update_visit_log(log_id: str, log_data: VisitLogUpdate):
    db = get_database()
    log = await db.waypoint_visit_logs.find_one({"id": log_id})
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit log not found")
    
    update_dict = log_data.model_dump(exclude_unset=True)
    await db.waypoint_visit_logs.update_one({"id": log_id}, {"$set": update_dict})
    
    updated_log = await db.waypoint_visit_logs.find_one({"id": log_id})
    img_cursor = db.waypoint_images.find({"visit_log_id": log_id}).sort("created_at", 1)
    updated_log["images"] = await img_cursor.to_list(length=100)
    return updated_log


@router.delete("/visit-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visit_log(log_id: str):
    db = get_database()
    log = await db.waypoint_visit_logs.find_one({"id": log_id})
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit log not found")
    
    await db.waypoint_images.delete_many({"visit_log_id": log_id})
    await db.waypoint_visit_logs.delete_one({"id": log_id})


# ==================== PHẦN 3: Phiếu thu ====================
@router.get("/{waypoint_id}/tickets", response_model=list[TicketResponse])
async def get_tickets(waypoint_id: str):
    db = get_database()
    cursor = db.waypoint_tickets.find({"waypoint_id": waypoint_id}).sort("collection_date", -1)
    return await cursor.to_list(length=1000)


@router.post("/{waypoint_id}/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(waypoint_id: str, ticket_data: TicketCreate):
    db = get_database()
    waypoint = await db.waypoints.find_one({"id": waypoint_id})
    if not waypoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint not found")
    
    now = datetime.utcnow()
    ticket_doc = {
        "id": str(uuid.uuid4()),
        "waypoint_id": waypoint_id,
        "visit_number": ticket_data.visit_number,
        "tickets_collected": ticket_data.tickets_collected,
        "notes": ticket_data.notes,
        "collection_date": now,
        "created_at": now
    }
    await db.waypoint_tickets.insert_one(ticket_doc)
    return ticket_doc


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(ticket_id: str, ticket_data: TicketUpdate):
    db = get_database()
    ticket = await db.waypoint_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    
    update_dict = ticket_data.model_dump(exclude_unset=True)
    await db.waypoint_tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    return await db.waypoint_tickets.find_one({"id": ticket_id})


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: str):
    db = get_database()
    ticket = await db.waypoint_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    await db.waypoint_tickets.delete_one({"id": ticket_id})
