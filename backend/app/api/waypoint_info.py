"""
Unified Waypoint & Campaign Waypoint Management API
Tách bạch hoàn toàn:
- `waypoints`: Điểm dừng cố định / POI trên bản đồ.
- `campaign_waypoints`: Điểm dừng trong chiến dịch / chuyến đi (kèm visit_logs, tickets).
- `schools`: Toàn bộ hồ sơ trường học (Ban giám hiệu, mô tả, website, tuyển sinh).
"""

from fastapi import APIRouter, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
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
from app.services.school_counter_service import increment_school_tickets, decrement_school_tickets

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
        our_contact_person=school.get("our_contact_person") if school else None,
        our_contact_role=school.get("our_contact_role") if school else None,
        contact_process=school.get("contact_process") if school else None,
        total_contact_attempts=school.get("total_contact_attempts", school.get("total_visits", 0)) if school else 0,
        total_visits=school.get("total_visits", 0) if school else 0,
        total_tickets=school.get("total_tickets", 0) if school else 0,
        last_visited_at=school.get("last_visited_at") if school else None,
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
    """
    Lấy danh sách nhật ký ghé thăm của trường qua TẤT CẢ các chuyến đi:
    Hiển thị rõ ràng: Ngày ghé, Giờ tới, Mã chuyến đi (trip_code), Tên chuyến đi (trip_name),
    Trưởng đoàn (leader_name), Thành viên (members_names). Tuyệt đối không có tài xế.
    """
    db = get_database()
    wp, _ = await find_any_point(db, waypoint_id)
    if not wp:
        raise HTTPException(status_code=404, detail="Không tìm thấy điểm dừng")

    school_id = wp.get("school_id")

    # 1. Tìm tất cả các điểm dừng của trường này qua mọi chuyến đi (cả campaign_waypoints và waypoints)
    related_wps = []
    if school_id:
        cw_list = await db.campaign_waypoints.find({
            "$or": [{"school_id": school_id}, {"id": waypoint_id}],
            "is_deleted": {"$ne": True}
        }).to_list(length=500)
        legacy_list = await db.waypoints.find({
            "$or": [{"school_id": school_id}, {"id": waypoint_id}],
            "is_deleted": {"$ne": True}
        }).to_list(length=500)

        seen_ids = set()
        for item in cw_list + legacy_list:
            item_id = item.get("id")
            if item_id and item_id not in seen_ids:
                seen_ids.add(item_id)
                related_wps.append(item)

    if not related_wps:
        related_wps = [wp]

    trip_cache = {}
    async def get_trip_info(t_id):
        if not t_id:
            return None, None, None, None
        if t_id not in trip_cache:
            t = await db.admission_trips.find_one({"id": t_id})
            if not t:
                t = await db.campaigns.find_one({"id": t_id})
            if t:
                t_code = t.get("trip_code") or t.get("name")
                t_name = t.get("name")
                team = t.get("team") or {}
                leader_name = team.get("leader_name") if isinstance(team, dict) else getattr(team, "leader_name", None)
                raw_members = team.get("members", []) if isinstance(team, dict) else getattr(team, "members", [])
                members_list = []
                for m in raw_members:
                    if isinstance(m, dict) and m.get("name"):
                        members_list.append(m.get("name"))
                    elif hasattr(m, "name") and m.name:
                        members_list.append(m.name)
                    elif isinstance(m, str):
                        members_list.append(m)
                members_names = ", ".join(members_list) if members_list else None
                trip_cache[t_id] = (t_code, t_name, leader_name, members_names)
            else:
                trip_cache[t_id] = (None, None, None, None)
        return trip_cache[t_id]

    active_logs = []
    seen_log_ids = set()

    for item in related_wps:
        t_id = item.get("trip_id")
        t_code, t_name, leader_name, members_names = await get_trip_info(t_id)

        # Lấy các visit_logs đã tạo thủ công
        for log in item.get("visit_logs", []):
            if not log.get("is_deleted") and log.get("id") not in seen_log_ids:
                seen_log_ids.add(log.get("id"))
                log_copy = dict(log)
                log_copy["trip_id"] = t_id
                log_copy["trip_code"] = t_code
                log_copy["trip_name"] = t_name
                log_copy["leader_name"] = leader_name
                log_copy["members_names"] = members_names
                active_logs.append(log_copy)

        # Nếu điểm này đã check-in nhưng chưa có visit_log thủ công, tự sinh 1 bản ghi hiển thị chuyến đã ghé
        if item.get("is_visited") and not item.get("visit_logs"):
            auto_id = f"auto-visit-{item.get('id')}"
            if auto_id not in seen_log_ids:
                seen_log_ids.add(auto_id)
                v_date = item.get("visited_at") or item.get("updated_at") or item.get("created_at")
                
                time_str = ""
                if v_date:
                    if isinstance(v_date, str):
                        try:
                            v_date_dt = datetime.fromisoformat(v_date)
                        except Exception:
                            v_date_dt = None
                    else:
                        v_date_dt = v_date
                    if v_date_dt:
                        if v_date_dt.tzinfo is None:
                            v_date_dt = v_date_dt.replace(tzinfo=timezone.utc)
                        vn_dt = v_date_dt + timedelta(hours=7)
                        time_str = vn_dt.strftime("%H:%M ngày %d/%m/%Y")

                trip_desc = f" trong chuyến đi {t_code}" if t_code else (f" trong chuyến đi {t_name}" if t_name else "")
                
                if time_str:
                    content = f"Đoàn đã tới trường lúc {time_str}{trip_desc}"
                else:
                    content = f"Đoàn đã tới trường và check-in làm việc{trip_desc}"

                active_logs.append({
                    "id": auto_id,
                    "waypoint_id": item.get("id"),
                    "visit_content": content,
                    "visit_date": item.get("visited_at") or item.get("updated_at"),
                    "created_at": item.get("visited_at") or item.get("created_at"),
                    "images": [],
                    "trip_id": t_id,
                    "trip_code": t_code,
                    "trip_name": t_name,
                    "leader_name": leader_name,
                    "members_names": members_names
                })

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
    visit_date = log_data.visit_date or now
    log_id = str(uuid.uuid4())
    log_doc = {
        "id": log_id,
        "waypoint_id": waypoint_id,
        "visit_content": log_data.visit_content,
        "image_urls": log_data.image_urls,
        "visit_date": visit_date,
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

    # Đính kèm thông tin chuyến đi, trưởng đoàn, thành viên cho log trả về
    res_dict = dict(log_doc)
    t_id = wp.get("trip_id")
    if t_id:
        t = await db.admission_trips.find_one({"id": t_id})
        if not t:
            t = await db.campaigns.find_one({"id": t_id})
        if t:
            res_dict["trip_id"] = t_id
            res_dict["trip_code"] = t.get("trip_code") or t.get("name")
            res_dict["trip_name"] = t.get("name")
            team = t.get("team") or {}
            res_dict["leader_name"] = team.get("leader_name") if isinstance(team, dict) else getattr(team, "leader_name", None)
            raw_members = team.get("members", []) if isinstance(team, dict) else getattr(team, "members", [])
            members_list = []
            for m in raw_members:
                if isinstance(m, dict) and m.get("name"):
                    members_list.append(m.get("name"))
                elif hasattr(m, "name") and m.name:
                    members_list.append(m.name)
                elif isinstance(m, str):
                    members_list.append(m)
            res_dict["members_names"] = ", ".join(members_list) if members_list else None

    return VisitLogResponse.model_validate(res_dict)


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

    # Giải pháp 1 (Counter Cache): Tăng tổng số phiếu tuyển sinh đã thu thập của trường
    school_id = wp.get("school_id")
    if school_id and ticket_data.tickets_collected > 0:
        await increment_school_tickets(db, school_id, ticket_data.tickets_collected)

    return TicketResponse.model_validate(ticket_doc)


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: str):
    """Xóa mềm phiếu thu"""
    db = get_database()
    now = datetime.now(timezone.utc)

    # Lấy thông tin phiếu và trường trước khi xóa để giảm Counter Cache
    ticket_to_delete = None
    school_id = None
    wp = await db.campaign_waypoints.find_one({"tickets.id": ticket_id})
    if not wp:
        wp = await db.waypoints.find_one({"tickets.id": ticket_id})
    if wp:
        school_id = wp.get("school_id")
        for t in wp.get("tickets", []):
            if t.get("id") == ticket_id:
                ticket_to_delete = t
                break

    res = await db.campaign_waypoints.update_one(
        {"tickets.id": ticket_id},
        {"$set": {"tickets.$.is_deleted": True, "tickets.$.deleted_at": now, "updated_at": now}}
    )
    if res.matched_count == 0:
        await db.waypoints.update_one(
            {"tickets.id": ticket_id},
            {"$set": {"tickets.$.is_deleted": True, "tickets.$.deleted_at": now, "updated_at": now}}
        )

    # Giảm biến đếm Counter Cache trong bảng schools
    if school_id and ticket_to_delete and ticket_to_delete.get("tickets_collected", 0) > 0:
        await decrement_school_tickets(db, school_id, int(ticket_to_delete["tickets_collected"]))
