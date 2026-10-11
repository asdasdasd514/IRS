"""
API Quản lý Ghi chú Thực địa Tuyển sinh (Field Notes Management)
Hỗ trợ ghi chú nhanh từ Bản đồ chuyến đi và Quản lý tập trung toàn bộ ghi chú
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from fastapi import APIRouter, HTTPException, Query, status, Response
from pydantic import BaseModel, Field
from app.core.database import get_database

router = APIRouter(prefix="/notes", tags=["Field Notes"])


class CreateNoteRequest(BaseModel):
    trip_id: Optional[str] = None
    trip_name: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    school_id: Optional[str] = None
    school_name: Optional[str] = None
    waypoint_id: Optional[str] = None
    category: Optional[str] = "Tiếp xúc BGH & Học sinh"
    content: str
    author_name: Optional[str] = "Cán bộ tuyển sinh"


class UpdateNoteRequest(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = None
    school_name: Optional[str] = None


async def sync_existing_waypoint_notes():
    """Tự động đồng bộ các ghi chú đã có từ campaign_waypoints vào field_notes nếu chưa có"""
    db = get_database()
    existing_count = await db.field_notes.count_documents({"is_deleted": {"$ne": True}})
    if existing_count > 0:
        return

    cursor = db.campaign_waypoints.find({
        "notes": {"$exists": True, "$ne": ""},
        "is_deleted": {"$ne": True}
    })
    
    trips_cache = {}
    schools_cache = {}

    async for wp in cursor:
        note_text = wp.get("notes")
        if not note_text or not str(note_text).strip():
            continue

        trip_id = wp.get("trip_id")
        trip_name = "Chuyến đi"
        campaign_id = wp.get("campaign_id")
        campaign_name = "Chiến dịch tuyển sinh"

        if trip_id and trip_id not in trips_cache:
            trip = await db.admission_trips.find_one({"id": trip_id})
            if trip:
                trips_cache[trip_id] = trip
        
        if trip_id and trip_id in trips_cache:
            t = trips_cache[trip_id]
            trip_name = t.get("name") or trip_name
            if not campaign_id and t.get("campaign_id"):
                campaign_id = t.get("campaign_id")

        if campaign_id:
            c = await db.campaigns.find_one({"$or": [{"id": campaign_id}, {"_id": campaign_id}]})
            if c:
                campaign_name = c.get("name") or campaign_name

        s_id = wp.get("school_id") or wp.get("id")
        s_name = wp.get("name") or "Trường học"

        created_dt = wp.get("visited_at") or wp.get("created_at") or datetime.now(timezone.utc)
        if isinstance(created_dt, str):
            try:
                created_dt = datetime.fromisoformat(created_dt)
            except Exception:
                created_dt = datetime.now(timezone.utc)

        doc = {
            "id": str(uuid.uuid4()),
            "trip_id": trip_id,
            "trip_name": trip_name,
            "campaign_id": campaign_id,
            "campaign_name": campaign_name,
            "school_id": s_id,
            "school_name": s_name,
            "waypoint_id": wp.get("id"),
            "category": "Đánh giá thực địa",
            "content": str(note_text).strip(),
            "author_name": "Đoàn tuyển sinh",
            "created_at": created_dt,
            "updated_at": created_dt,
            "is_deleted": False
        }
        await db.field_notes.insert_one(doc)


@router.get("")
async def get_all_notes(
    trip_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    school_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    page: int = 1
):
    """Lấy danh sách ghi chú với đầy đủ bộ lọc và thống kê"""
    db = get_database()
    await sync_existing_waypoint_notes()

    # Xử lý an toàn nếu được gọi trực tiếp
    try:
        page_val = int(page)
    except Exception:
        page_val = 1
    try:
        limit_val = int(limit)
    except Exception:
        limit_val = 100

    query: dict = {"is_deleted": {"$ne": True}}

    if trip_id:
        query["trip_id"] = trip_id
    if campaign_id:
        query["campaign_id"] = campaign_id
    if school_id:
        query["$or"] = [{"school_id": school_id}, {"waypoint_id": school_id}]
    if category:
        query["category"] = category
    if search and search.strip():
        s_regex = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"content": s_regex},
            {"school_name": s_regex},
            {"trip_name": s_regex},
            {"author_name": s_regex}
        ]

    total = await db.field_notes.count_documents(query)
    skip = (page_val - 1) * limit_val
    cursor = db.field_notes.find(query).sort("created_at", -1).skip(skip).limit(limit_val)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        if isinstance(doc.get("updated_at"), datetime):
            doc["updated_at"] = doc["updated_at"].isoformat()
        items.append(doc)

    # Thống kê tổng hợp
    distinct_schools = len(await db.field_notes.distinct("school_name", {"is_deleted": {"$ne": True}}))
    distinct_trips = len(await db.field_notes.distinct("trip_id", {"is_deleted": {"$ne": True}}))
    total_all_notes = await db.field_notes.count_documents({"is_deleted": {"$ne": True}})

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "stats": {
            "total_notes": total_all_notes,
            "total_schools": distinct_schools,
            "total_trips": distinct_trips
        }
    }


@router.post("")
async def create_note(data: CreateNoteRequest):
    """Tạo ghi chú mới và tự động đồng bộ vào waypoint/trường học"""
    db = get_database()
    now = datetime.now(timezone.utc)
    note_id = str(uuid.uuid4())

    trip_name = data.trip_name
    campaign_name = data.campaign_name
    campaign_id = data.campaign_id

    # Bổ sung thông tin nếu thiếu
    if data.trip_id:
        trip = await db.admission_trips.find_one({"id": data.trip_id})
        if trip:
            trip_name = trip_name or trip.get("name")
            campaign_id = campaign_id or trip.get("campaign_id")

    if campaign_id:
        camp = await db.campaigns.find_one({"$or": [{"id": campaign_id}, {"_id": campaign_id}]})
        if camp:
            campaign_name = campaign_name or camp.get("name")

    doc = {
        "id": note_id,
        "trip_id": data.trip_id,
        "trip_name": trip_name or "Chuyến đi",
        "campaign_id": campaign_id,
        "campaign_name": campaign_name or "Chiến dịch tuyển sinh",
        "school_id": data.school_id,
        "school_name": data.school_name or "Điểm trường",
        "waypoint_id": data.waypoint_id,
        "category": data.category or "Tiếp xúc BGH & Học sinh",
        "content": data.content.strip(),
        "author_name": data.author_name or "Cán bộ tuyển sinh",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False
    }

    await db.field_notes.insert_one(doc)

    # Đồng bộ ngược vào campaign_waypoints nếu có
    if data.trip_id and (data.waypoint_id or data.school_id):
        wp_query = {
            "trip_id": data.trip_id,
            "$or": [
                {"id": data.waypoint_id},
                {"school_id": data.school_id},
                {"id": data.school_id}
            ]
        }
        await db.campaign_waypoints.update_many(
            wp_query,
            {"$set": {"notes": data.content.strip()}}
        )

    # Đồng bộ vào schools nếu có school_id
    if data.school_id:
        await db.schools.update_one(
            {"$or": [{"id": data.school_id}, {"code": data.school_id}]},
            {"$set": {"notes": data.content.strip(), "updated_at": now}}
        )

    doc["_id"] = str(doc["_id"])
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


@router.put("/{note_id}")
async def update_note(note_id: str, data: UpdateNoteRequest):
    """Cập nhật nội dung ghi chú"""
    db = get_database()
    note = await db.field_notes.find_one({"id": note_id, "is_deleted": {"$ne": True}})
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghi chú")

    now = datetime.now(timezone.utc)
    update_fields = {"updated_at": now}
    if data.content is not None:
        update_fields["content"] = data.content.strip()
    if data.category is not None:
        update_fields["category"] = data.category
    if data.school_name is not None:
        update_fields["school_name"] = data.school_name

    await db.field_notes.update_one({"id": note_id}, {"$set": update_fields})

    # Đồng bộ ngược vào campaign_waypoints nếu có
    if data.content and note.get("trip_id") and (note.get("waypoint_id") or note.get("school_id")):
        wp_query = {
            "trip_id": note["trip_id"],
            "$or": [
                {"id": note.get("waypoint_id")},
                {"school_id": note.get("school_id")},
                {"id": note.get("school_id")}
            ]
        }
        await db.campaign_waypoints.update_many(
            wp_query,
            {"$set": {"notes": data.content.strip()}}
        )

    updated = await db.field_notes.find_one({"id": note_id})
    updated["_id"] = str(updated["_id"])
    if isinstance(updated.get("created_at"), datetime):
        updated["created_at"] = updated["created_at"].isoformat()
    if isinstance(updated.get("updated_at"), datetime):
        updated["updated_at"] = updated["updated_at"].isoformat()
    return updated


@router.delete("/{note_id}")
async def delete_note(note_id: str):
    """Xóa ghi chú (soft delete)"""
    db = get_database()
    res = await db.field_notes.update_one({"id": note_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghi chú")
    return {"message": "Đã xóa ghi chú thành công", "id": note_id}


@router.get("/export/excel")
async def export_notes_excel(
    trip_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    search: Optional[str] = None
):
    """Xuất toàn bộ ghi chú ra file Excel định dạng chuyên nghiệp"""
    db = get_database()
    await sync_existing_waypoint_notes()

    query: dict = {"is_deleted": {"$ne": True}}
    if trip_id:
        query["trip_id"] = trip_id
    if campaign_id:
        query["campaign_id"] = campaign_id
    if search and search.strip():
        s_regex = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"content": s_regex},
            {"school_name": s_regex},
            {"trip_name": s_regex},
            {"author_name": s_regex}
        ]

    cursor = db.field_notes.find(query).sort("created_at", -1)
    notes = await cursor.to_list(length=2000)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Ghi chú thực địa"

    font_title = Font(name="Calibri", size=14, bold=True, color="1F497D")
    font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    font_bold = Font(name="Calibri", size=10, bold=True)
    font_normal = Font(name="Calibri", size=10)

    fill_header = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    fill_even = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )

    # Tiêu đề bảng
    ws.merge_cells("A1:G1")
    ws["A1"] = "DANH SÁCH GHI CHÚ VÀ ĐÁNH GIÁ THỰC ĐỊA TUYỂN SINH"
    ws["A1"].font = font_title
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 32

    now_vn = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
    ws.merge_cells("A2:G2")
    ws["A2"] = f"Thời điểm xuất file: {now_vn} | Tổng số ghi chú: {len(notes)}"
    ws["A2"].font = Font(name="Calibri", size=10, italic=True, color="555555")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 18

    headers = [
        "STT",
        "Thời Gian Ghi",
        "Điểm Trường",
        "Chuyến Đi / Đợt",
        "Chiến Dịch",
        "Cán Bộ Ghi",
        "Nội Dung Ghi Chú & Đánh Giá"
    ]

    ws.row_dimensions[4].height = 26
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    for idx, n in enumerate(notes, 1):
        r_idx = 4 + idx
        ws.row_dimensions[r_idx].height = 24

        c_time = n.get("created_at")
        if isinstance(c_time, datetime):
            c_time_str = c_time.strftime("%d/%m/%Y %H:%M")
        elif isinstance(c_time, str):
            try:
                c_time_str = datetime.fromisoformat(c_time).strftime("%d/%m/%Y %H:%M")
            except Exception:
                c_time_str = c_time
        else:
            c_time_str = ""

        row_vals = [
            idx,
            c_time_str,
            n.get("school_name") or "Chưa rõ",
            n.get("trip_name") or "Chuyến đi",
            n.get("campaign_name") or "Chiến dịch tuyển sinh",
            n.get("author_name") or "Cán bộ tuyển sinh",
            n.get("content") or ""
        ]

        for col_idx, val in enumerate(row_vals, 1):
            cell = ws.cell(row=r_idx, column=col_idx, value=val)
            cell.font = font_bold if col_idx in (1, 3) else font_normal
            cell.border = thin_border
            align_h = "center" if col_idx in (1, 2) else ("left" if col_idx in (3, 4, 5, 7) else "center")
            cell.alignment = Alignment(horizontal=align_h, vertical="center", wrap_text=(col_idx == 7))
            if idx % 2 == 0:
                cell.fill = fill_even

    # Căn chỉnh độ rộng cột
    col_widths = [8, 18, 30, 28, 25, 20, 50]
    for idx, width in enumerate(col_widths, 1):
        ws.column_dimensions[get_column_letter(idx)].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Danh_sach_ghi_chu_tuyen_sinh_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
