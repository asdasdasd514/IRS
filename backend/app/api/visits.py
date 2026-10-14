"""
API Quản lý Lịch Sử Tham Quan / Ghé Thăm Thực Địa (Visit Logs Management)
Tổng hợp toàn bộ lượt Check-in thực tế và Nhật ký ghé thăm kèm tư liệu ảnh
từ tất cả các đoàn tuyển sinh và chiến dịch.
"""

import io
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from fastapi import APIRouter, HTTPException, Query, status, Response
from pydantic import BaseModel, Field
from app.core.database import get_database

router = APIRouter(prefix="/visits", tags=["Visit History"])


class CreateVisitRequest(BaseModel):
    waypoint_id: Optional[str] = None
    school_id: Optional[str] = None
    school_name: Optional[str] = None
    trip_id: Optional[str] = None
    visit_content: str
    visit_date: Optional[str] = None


async def _gather_all_visits(db) -> List[Dict[str, Any]]:
    """Tổng hợp toàn bộ các lượt ghé thăm từ campaign_waypoints và waypoints"""
    # 1. Lấy thông tin chuyến đi & chiến dịch để cache
    trips_cursor = db.admission_trips.find({"is_deleted": {"$ne": True}})
    trips_cache = {}
    async for t in trips_cursor:
        t_id = t.get("id") or str(t.get("_id"))
        team = t.get("team") or {}
        leader = team.get("leader_name") if isinstance(team, dict) else getattr(team, "leader_name", None)
        raw_m = team.get("members", []) if isinstance(team, dict) else getattr(team, "members", [])
        m_list = []
        for m in raw_m:
            if isinstance(m, dict) and m.get("name"):
                m_list.append(m.get("name"))
            elif hasattr(m, "name") and m.name:
                m_list.append(m.name)
            elif isinstance(m, str):
                m_list.append(m)

        trips_cache[t_id] = {
            "trip_code": t.get("trip_code") or t.get("name") or "Chuyến đi",
            "trip_name": t.get("name") or "Chuyến đi",
            "campaign_id": t.get("campaign_id"),
            "leader_name": leader,
            "members_names": ", ".join(m_list) if m_list else None
        }

    # Cache chiến dịch
    camps_cursor = db.campaigns.find({"is_deleted": {"$ne": True}})
    camps_cache = {}
    async for c in camps_cursor:
        c_id = c.get("id") or str(c.get("_id"))
        camps_cache[c_id] = c.get("name") or "Chiến dịch tuyển sinh"

    # Cache ghi chú thực địa từ collection schools
    school_notes_cache = {}
    schools_cursor = db.schools.find({"is_deleted": {"$ne": True}}, {"id": 1, "_id": 1, "field_notes": 1})
    async for sc in schools_cursor:
        sc_id = sc.get("id") or str(sc.get("_id"))
        fns = []
        for fn in (sc.get("field_notes") or []):
            if isinstance(fn, dict) and not fn.get("is_deleted"):
                fn_copy = dict(fn)
                if not fn_copy.get("id") and fn_copy.get("_id"):
                    fn_copy["id"] = str(fn_copy["_id"])
                fns.append(fn_copy)
        if fns:
            school_notes_cache[sc_id] = fns

    all_visits = []
    seen_ids = set()

    # 2. Duyệt qua campaign_waypoints
    cw_cursor = db.campaign_waypoints.find({"is_deleted": {"$ne": True}})
    async for item in cw_cursor:
        wp_id = item.get("id") or str(item.get("_id"))
        s_name = item.get("name") or "Điểm trường thực địa"
        s_id = item.get("school_id") or wp_id
        t_id = item.get("trip_id")
        t_info = trips_cache.get(t_id, {
            "trip_code": "Chuyến đi",
            "trip_name": "Chuyến đi",
            "campaign_id": item.get("campaign_id"),
            "leader_name": None,
            "members_names": None
        })
        camp_id = t_info.get("campaign_id") or item.get("campaign_id")
        camp_name = camps_cache.get(camp_id, "Chiến dịch tuyển sinh")

        # Tất cả ảnh của waypoint này
        wp_images = []
        for log in (item.get("visit_logs") or []):
            if isinstance(log, dict) and not log.get("is_deleted"):
                for img in (log.get("images") or []):
                    if isinstance(img, dict) and not img.get("is_deleted"):
                        wp_images.append(img)
        for img in (item.get("images") or []):
            if isinstance(img, dict) and not img.get("is_deleted"):
                wp_images.append(img)

        # Ghi chú thực địa của trường trong chiến dịch này
        all_school_notes = school_notes_cache.get(s_id, [])
        relevant_notes = [
            n for n in all_school_notes
            if not camp_id or not n.get("campaign_id") or n.get("campaign_id") == camp_id
        ]

        # A. Các visit_logs thủ công
        for log in (item.get("visit_logs") or []):
            if not isinstance(log, dict) or log.get("is_deleted") is True:
                continue
            log_id = log.get("id")
            if log_id in seen_ids:
                continue
            seen_ids.add(log_id)

            v_date = log.get("visit_date") or log.get("created_at")
            if isinstance(v_date, datetime):
                v_date_str = v_date.isoformat()
            else:
                v_date_str = str(v_date) if v_date else datetime.now(timezone.utc).isoformat()

            raw_images = log.get("images") or []
            active_images = [
                img for img in raw_images
                if isinstance(img, dict) and not img.get("is_deleted")
            ]

            all_visits.append({
                "id": log_id,
                "waypoint_id": wp_id,
                "school_id": s_id,
                "school_name": s_name,
                "school_address": item.get("address") or "",
                "trip_id": t_id,
                "trip_code": t_info.get("trip_code"),
                "trip_name": t_info.get("trip_name"),
                "campaign_id": camp_id,
                "campaign_name": camp_name,
                "leader_name": t_info.get("leader_name"),
                "members_names": t_info.get("members_names"),
                "visit_date": v_date_str,
                "visit_content": log.get("visit_content") or "Đoàn đã ghé làm việc tại trường",
                "is_checkin": False,
                "images": active_images or wp_images,
                "school_notes": relevant_notes,
                "created_at": v_date_str
            })

        # B. Check-in thực tế tự động (nếu đã ghé thăm)
        if item.get("is_visited"):
            auto_id = f"auto-visit-{wp_id}"
            if auto_id not in seen_ids:
                seen_ids.add(auto_id)
                v_date = item.get("visited_at") or item.get("updated_at") or item.get("created_at")
                if isinstance(v_date, datetime):
                    v_date_str = v_date.isoformat()
                    v_date_dt = v_date
                else:
                    v_date_str = str(v_date) if v_date else datetime.now(timezone.utc).isoformat()
                    try:
                        v_date_dt = datetime.fromisoformat(v_date_str)
                    except Exception:
                        v_date_dt = None

                time_display = ""
                if v_date_dt:
                    if v_date_dt.tzinfo is None:
                        v_date_dt = v_date_dt.replace(tzinfo=timezone.utc)
                    vn_dt = v_date_dt + timedelta(hours=7)
                    time_display = vn_dt.strftime("%H:%M ngày %d/%m/%Y")

                trip_desc = f" trong chuyến đi {t_info.get('trip_code')}" if t_info.get('trip_code') else ""
                content = f"Đoàn đã tới trường lúc {time_display}{trip_desc}" if time_display else "Đoàn đã tới trường và check-in thực tế"

                all_visits.append({
                    "id": auto_id,
                    "waypoint_id": wp_id,
                    "school_id": s_id,
                    "school_name": s_name,
                    "school_address": item.get("address") or "",
                    "trip_id": t_id,
                    "trip_code": t_info.get("trip_code"),
                    "trip_name": t_info.get("trip_name"),
                    "campaign_id": camp_id,
                    "campaign_name": camp_name,
                    "leader_name": t_info.get("leader_name"),
                    "members_names": t_info.get("members_names"),
                    "visit_date": v_date_str,
                    "visit_content": content,
                    "is_checkin": True,
                    "images": wp_images,
                    "school_notes": relevant_notes,
                    "created_at": v_date_str
                })

    # Sắp xếp mới nhất lên đầu
    all_visits.sort(key=lambda x: str(x.get("visit_date", "")), reverse=True)
    return all_visits


def _extract_date_str(v_date_raw) -> str:
    """Chuyển đổi thời gian của bản ghi sang định dạng YYYY-MM-DD theo giờ Việt Nam (UTC+7)"""
    if not v_date_raw:
        return ""
    try:
        if isinstance(v_date_raw, datetime):
            dt = v_date_raw
        else:
            raw_s = str(v_date_raw).strip()
            dt = datetime.fromisoformat(raw_s.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        vn_dt = dt.astimezone(timezone(timedelta(hours=7)))
        return vn_dt.strftime("%Y-%m-%d")
    except Exception:
        return str(v_date_raw)[:10]


@router.get("")
async def get_all_visits(
    school_id: Optional[str] = None,
    trip_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    is_checkin: Optional[bool] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    page: int = 1
):
    """Lấy danh sách lịch sử tham quan / ghé thăm trường của toàn hệ thống"""
    db = get_database()
    raw_visits = await _gather_all_visits(db)

    # Thống kê tổng quan
    total_records = len(raw_visits)
    distinct_schools = len(set(v["school_id"] for v in raw_visits if v.get("school_id")))
    distinct_trips = len(set(v["trip_id"] for v in raw_visits if v.get("trip_id")))
    total_images = sum(len(v.get("images", [])) for v in raw_visits)

    # Áp dụng bộ lọc
    filtered = raw_visits
    if school_id:
        filtered = [v for v in filtered if v.get("school_id") == school_id or v.get("waypoint_id") == school_id]
    if trip_id:
        filtered = [v for v in filtered if v.get("trip_id") == trip_id]
    if campaign_id:
        filtered = [v for v in filtered if v.get("campaign_id") == campaign_id]
    if is_checkin is not None:
        filtered = [v for v in filtered if v.get("is_checkin") is is_checkin]
    if date and date.strip():
        target_d = date.strip()
        filtered = [v for v in filtered if _extract_date_str(v.get("visit_date")) == target_d]
    if search and search.strip():
        q = search.strip().lower()
        filtered = [
            v for v in filtered
            if q in v.get("school_name", "").lower()
            or q in v.get("visit_content", "").lower()
            or q in v.get("trip_code", "").lower()
            or q in v.get("trip_name", "").lower()
            or q in str(v.get("leader_name", "")).lower()
            or q in str(v.get("members_names", "")).lower()
        ]

    try:
        page_val = max(1, int(page))
    except Exception:
        page_val = 1
    try:
        limit_val = max(1, int(limit))
    except Exception:
        limit_val = 100

    skip = (page_val - 1) * limit_val
    paginated_items = filtered[skip : skip + limit_val]

    return {
        "items": paginated_items,
        "total": len(filtered),
        "page": page_val,
        "limit": limit_val,
        "stats": {
            "total_visits": total_records,
            "total_schools": distinct_schools,
            "total_trips": distinct_trips,
            "total_images": total_images
        }
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_visit(data: CreateVisitRequest):
    """Thêm một lượt ghi nhận tham quan thủ công"""
    db = get_database()
    now = datetime.now(timezone.utc)
    visit_id = str(uuid.uuid4())

    target_wp = None
    if data.waypoint_id:
        target_wp = await db.campaign_waypoints.find_one({"id": data.waypoint_id, "is_deleted": {"$ne": True}})
    if not target_wp and data.school_id:
        target_wp = await db.campaign_waypoints.find_one({"school_id": data.school_id, "is_deleted": {"$ne": True}})
    if not target_wp and data.school_name:
        target_wp = await db.campaign_waypoints.find_one({"name": data.school_name.strip(), "is_deleted": {"$ne": True}})

    if not target_wp:
        # Tìm trong waypoints gốc
        if data.waypoint_id:
            target_wp = await db.waypoints.find_one({"id": data.waypoint_id, "is_deleted": {"$ne": True}})

    wp_id = target_wp.get("id") if target_wp else (data.waypoint_id or str(uuid.uuid4()))

    v_date = data.visit_date or now.isoformat()

    log_doc = {
        "id": visit_id,
        "waypoint_id": wp_id,
        "visit_content": data.visit_content.strip(),
        "visit_date": v_date,
        "created_at": now.isoformat(),
        "images": [],
        "is_deleted": False
    }

    if target_wp:
        col = db.campaign_waypoints if target_wp in [await db.campaign_waypoints.find_one({"_id": target_wp["_id"]})] else db.waypoints
        await col.update_one(
            {"_id": target_wp["_id"]},
            {"$push": {"visit_logs": log_doc}, "$set": {"updated_at": now.isoformat()}}
        )
    else:
        # Nếu chưa có waypoint, tạo mới một campaign_waypoint tối giản
        new_wp = {
            "id": wp_id,
            "name": data.school_name or "Điểm trường thực địa",
            "school_id": data.school_id or wp_id,
            "trip_id": data.trip_id,
            "visit_logs": [log_doc],
            "is_visited": True,
            "visited_at": v_date,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "is_deleted": False
        }
        await db.campaign_waypoints.insert_one(new_wp)

    return {"success": True, "id": visit_id, "message": "Đã thêm lịch sử tham quan thành công"}


@router.delete("/{visit_id}")
async def delete_visit(visit_id: str):
    """Xóa một bản ghi lịch sử tham quan"""
    db = get_database()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Xóa trong campaign_waypoints
    res1 = await db.campaign_waypoints.update_one(
        {"visit_logs.id": visit_id},
        {"$set": {"visit_logs.$.is_deleted": True, "visit_logs.$.updated_at": now_iso}}
    )
    # Xóa trong waypoints
    res2 = await db.waypoints.update_one(
        {"visit_logs.id": visit_id},
        {"$set": {"visit_logs.$.is_deleted": True, "visit_logs.$.updated_at": now_iso}}
    )

    if res1.modified_count == 0 and res2.modified_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch sử để xóa")

    return {"success": True, "message": "Đã xóa lịch sử tham quan thành công"}


@router.get("/export/excel")
async def export_visits_excel(
    school_id: Optional[str] = None,
    trip_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    is_checkin: Optional[bool] = None,
    date: Optional[str] = None,
    search: Optional[str] = None
):
    """Xuất danh sách lịch sử tham quan thực địa ra file Excel (.xlsx)"""
    db = get_database()
    raw_visits = await _gather_all_visits(db)

    filtered = raw_visits
    if school_id:
        filtered = [v for v in filtered if v.get("school_id") == school_id or v.get("waypoint_id") == school_id]
    if trip_id:
        filtered = [v for v in filtered if v.get("trip_id") == trip_id]
    if campaign_id:
        filtered = [v for v in filtered if v.get("campaign_id") == campaign_id]
    if is_checkin is not None:
        filtered = [v for v in filtered if v.get("is_checkin") is is_checkin]
    if date and date.strip():
        target_d = date.strip()
        filtered = [v for v in filtered if _extract_date_str(v.get("visit_date")) == target_d]
    if search and search.strip():
        q = search.strip().lower()
        filtered = [
            v for v in filtered
            if q in v.get("school_name", "").lower()
            or q in v.get("visit_content", "").lower()
            or q in v.get("trip_code", "").lower()
            or q in v.get("trip_name", "").lower()
            or q in str(v.get("leader_name", "")).lower()
            or q in str(v.get("members_names", "")).lower()
        ]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lịch sử tham quan"

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

    ws.merge_cells("A1:H1")
    ws["A1"] = "DANH SÁCH LỊCH SỬ THAM QUAN & CHECK-IN THỰC ĐỊA TUYỂN SINH"
    ws["A1"].font = font_title
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 32

    now_vn = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
    ws.merge_cells("A2:H2")
    ws["A2"] = f"Thời điểm xuất file: {now_vn} | Tổng số lượt ghé: {len(filtered)}"
    ws["A2"].font = Font(name="Calibri", size=10, italic=True, color="555555")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 18

    headers = [
        "STT",
        "Thời Gian Ghé",
        "Điểm Trường",
        "Chuyến Đi / Đợt",
        "Trưởng Đoàn & Thành Viên",
        "Loại Ghi Nhận",
        "Số Ảnh",
        "Nội Dung Chi Tiết"
    ]

    ws.row_dimensions[4].height = 26
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    for idx, v in enumerate(filtered, 1):
        r_idx = 4 + idx
        ws.row_dimensions[r_idx].height = 24

        v_time = v.get("visit_date")
        if isinstance(v_time, datetime):
            time_str = v_time.strftime("%d/%m/%Y %H:%M")
        elif isinstance(v_time, str):
            try:
                time_str = datetime.fromisoformat(v_time).strftime("%d/%m/%Y %H:%M")
            except Exception:
                time_str = v_time
        else:
            time_str = ""

        loai = "Check-in thực tế" if v.get("is_checkin") else "Ghi nhận tư liệu"
        doan = f"Trưởng đoàn: {v.get('leader_name') or 'Chưa rõ'}"
        if v.get("members_names"):
            doan += f" | TV: {v.get('members_names')}"

        row_vals = [
            idx,
            time_str,
            v.get("school_name") or "Điểm trường",
            v.get("trip_code") or v.get("trip_name") or "Chuyến đi",
            doan,
            loai,
            len(v.get("images", [])),
            v.get("visit_content") or ""
        ]

        for col_idx, val in enumerate(row_vals, 1):
            cell = ws.cell(row=r_idx, column=col_idx, value=val)
            cell.font = font_bold if col_idx in (1, 3) else font_normal
            cell.border = thin_border
            align_h = "center" if col_idx in (1, 2, 6, 7) else ("left" if col_idx in (3, 4, 5, 8) else "center")
            cell.alignment = Alignment(horizontal=align_h, vertical="center", wrap_text=(col_idx == 8))
            if idx % 2 == 0:
                cell.fill = fill_even

    col_widths = [8, 18, 30, 24, 35, 20, 10, 50]
    for idx, width in enumerate(col_widths, 1):
        ws.column_dimensions[get_column_letter(idx)].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Lich_su_tham_quan_tuyen_sinh_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
