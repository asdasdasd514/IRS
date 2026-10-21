import uuid
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.core.database import get_database
from app.schemas.schemas import (
    SurveyConfigSchema,
    PublicSurveySubmitRequest,
    SurveyResponseItem,
    DEFAULT_MAJORS_LIST
)
from app.services.school_counter_service import increment_school_tickets
from app.api.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Surveys"])


def to_vietnam_time_str(dt) -> str:
    if not dt:
        return ""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except Exception:
            return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    vn_dt = dt + timedelta(hours=7)
    return vn_dt.strftime("%d/%m/%Y %H:%M")


def clean_phone_number(raw_phone: str) -> str:
    if not raw_phone:
        return ""
    cleaned = re.sub(r"[\s\.\-\(\)]", "", raw_phone)
    if cleaned.startswith("+84"):
        cleaned = "0" + cleaned[3:]
    return cleaned


def build_default_questions(majors=None, fields_enabled=None):
    majors_list = majors if (majors and len(majors) > 0) else list(DEFAULT_MAJORS_LIST)
    fields = fields_enabled or {
        "student_name": True,
        "phone": True,
        "grade": True,
        "email": False,
        "notes": True
    }
    questions = [
        {
            "id": "student_name",
            "type": "text",
            "title": "Họ và tên học sinh",
            "placeholder": "Nhập họ và tên đầy đủ của bạn",
            "required": True,
            "is_core": True,
            "options": []
        },
        {
            "id": "phone",
            "type": "text",
            "title": "Số điện thoại liên hệ (10 số)",
            "placeholder": "Ví dụ: 0912345678",
            "required": True,
            "is_core": True,
            "options": []
        }
    ]
    if fields.get("grade", True):
        questions.append({
            "id": "grade",
            "type": "radio",
            "title": "Khối lớp hiện tại",
            "required": False,
            "is_core": False,
            "options": ["Khối 12", "Khối 11", "Khối 10"]
        })
    if len(majors_list) > 0:
        questions.append({
            "id": "majors",
            "type": "checkbox",
            "title": "Ngành học bạn quan tâm",
            "required": False,
            "is_core": False,
            "options": list(majors_list)
        })
    if fields.get("notes", True):
        questions.append({
            "id": "notes",
            "type": "textarea",
            "title": "Ghi chú & Nguyện vọng khác",
            "placeholder": "Để lại câu hỏi hoặc thắc mắc cần tư vấn thêm...",
            "required": False,
            "is_core": False,
            "options": []
        })
    return questions


# =========================================================================
# 1. PUBLIC APIS DÀNH CHO HỌC SINH (KHÔNG CẦN ĐĂNG NHẬP)
# =========================================================================

@router.get("/surveys/public/{trip_id}/{waypoint_id}")
async def get_public_survey_info(trip_id: str, waypoint_id: str):
    """
    API Công khai để học sinh quét QR tải thông tin trường và câu hỏi khảo sát.
    Hỗ trợ cả chuyến đi đã deploy (campaign_waypoints) và chiến dịch đang lập kế hoạch (campaign.destinations).
    """
    db = get_database()
    
    # 1. Tìm waypoint trong campaign_waypoints hoặc waypoints
    wp = await db.campaign_waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        wp = await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})
    if not wp:
        wp = await db.campaign_waypoints.find_one({
            "$or": [{"school_id": waypoint_id}, {"id": waypoint_id}],
            "is_deleted": {"$ne": True}
        })
    
    # 2. Lấy thông tin chuyến đi hoặc chiến dịch
    trip = await db.admission_trips.find_one({"id": trip_id, "is_deleted": {"$ne": True}})
    trip_name = trip.get("name") if trip else "Chuyến đi tuyển sinh"
    campaign_id = trip.get("campaign_id") if trip else (wp.get("campaign_id") if wp else trip_id)

    camp = None
    if campaign_id:
        camp = await db.campaigns.find_one({"$or": [{"id": campaign_id}, {"_id": campaign_id}], "is_deleted": {"$ne": True}})

    # Nếu chưa tìm thấy wp trong waypoints (trường hợp quét QR khi chiến dịch đang planning hoặc test mẫu)
    if not wp:
        if not camp:
            # Tìm xem waypoint_id có thuộc về chiến dịch nào không
            camp = await db.campaigns.find_one({
                "$or": [
                    {"id": trip_id},
                    {"destinations.id": waypoint_id},
                    {"destinations.school_id": waypoint_id}
                ],
                "is_deleted": {"$ne": True}
            })

        if camp:
            campaign_id = camp.get("id") or str(camp.get("_id"))
            campaign_name = camp.get("name") or "Chiến dịch tuyển sinh"
            trip_name = campaign_name
            # Tìm destination phù hợp
            dest = None
            for d in camp.get("destinations") or []:
                if d.get("id") == waypoint_id or d.get("school_id") == waypoint_id:
                    dest = d
                    break
            if not dest and camp.get("destinations"):
                dest = camp["destinations"][0]

            if dest:
                wp = {
                    "id": dest.get("id") or dest.get("school_id") or waypoint_id,
                    "school_id": dest.get("school_id") or dest.get("id"),
                    "name": dest.get("name") or "Điểm trường",
                    "address": dest.get("address") or "",
                    "campaign_id": campaign_id,
                    "custom_survey_config": dest.get("custom_survey_config")
                }

    # Nếu vẫn chưa thấy wp, thử tìm trực tiếp trong danh bạ trường học (schools)
    if not wp:
        school = await db.schools.find_one({
            "$or": [{"id": waypoint_id}, {"code": waypoint_id}],
            "is_deleted": {"$ne": True}
        })
        if school:
            wp = {
                "id": school.get("id") or waypoint_id,
                "school_id": school.get("id") or waypoint_id,
                "name": school.get("name") or "Điểm trường",
                "address": school.get("address") or "",
                "campaign_id": campaign_id
            }

    if not wp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy điểm trường khảo sát hoặc lộ trình đã thay đổi."
        )

    # 3. Lấy cấu hình khảo sát: Ưu tiên form riêng của điểm trường (custom_survey_config), nếu không có thì lấy form chung của Campaign
    survey_config = None
    campaign_name = (camp.get("name") if camp else None) or trip_name or "Chiến dịch tuyển sinh"
    if wp.get("custom_survey_config"):
        survey_config = dict(wp["custom_survey_config"])
    elif camp and camp.get("survey_config"):
        survey_config = dict(camp["survey_config"])

    if not survey_config:
        survey_config = {
            "title": "Khảo Sát Nguyện Vọng Tuyển Sinh 2026",
            "description": "Vui lòng để lại thông tin để nhận tư vấn học bổng và xét tuyển sớm.",
            "questions": build_default_questions(list(DEFAULT_MAJORS_LIST)),
            "majors": list(DEFAULT_MAJORS_LIST),
            "fields_enabled": {
                "student_name": True,
                "phone": True,
                "grade": True,
                "email": False,
                "notes": True
            }
        }
    else:
        # Đảm bảo luôn có mảng questions chuẩn
        if not survey_config.get("questions") or len(survey_config["questions"]) == 0:
            survey_config["questions"] = build_default_questions(
                survey_config.get("majors"),
                survey_config.get("fields_enabled")
            )

    return {
        "success": True,
        "school": {
            "school_id": wp.get("school_id") or wp.get("id"),
            "waypoint_id": wp.get("id"),
            "name": wp.get("name") or "Điểm trường",
            "address": wp.get("address") or ""
        },
        "trip": {
            "trip_id": trip_id,
            "trip_name": trip_name,
            "campaign_id": campaign_id,
            "campaign_name": campaign_name
        },
        "survey_config": survey_config
    }


@router.post("/surveys/public/submit")
async def submit_public_survey(data: PublicSurveySubmitRequest):
    """
    Học sinh nộp phiếu khảo sát online:
    - Kiểm tra số điện thoại hợp lệ (10 số)
    - Tự động nhúng phiếu vào `campaign_waypoints` hoặc `campaigns.tickets`
    - Tự động gọi `increment_school_tickets` để cập nhật bảng `schools`
    """
    db = get_database()
    name = data.student_name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập họ và tên của bạn."
        )

    phone = clean_phone_number(data.phone)
    if not re.match(r"^0\d{9}$", phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại gồm 10 chữ số."
        )

    # 1. Tìm waypoint
    wp = await db.campaign_waypoints.find_one({"id": data.waypoint_id, "is_deleted": {"$ne": True}})
    col_name = "campaign_waypoints"
    if not wp:
        wp = await db.waypoints.find_one({"id": data.waypoint_id, "is_deleted": {"$ne": True}})
        col_name = "waypoints"
    if not wp:
        wp = await db.campaign_waypoints.find_one({
            "$or": [{"school_id": data.waypoint_id}, {"id": data.waypoint_id}],
            "is_deleted": {"$ne": True}
        })
        if wp:
            col_name = "campaign_waypoints"

    camp = None
    if not wp:
        camp = await db.campaigns.find_one({
            "$or": [
                {"id": data.trip_id},
                {"_id": data.trip_id},
                {"destinations.id": data.waypoint_id},
                {"destinations.school_id": data.waypoint_id}
            ],
            "is_deleted": {"$ne": True}
        })
        if camp:
            dest = None
            for d in camp.get("destinations") or []:
                if d.get("id") == data.waypoint_id or d.get("school_id") == data.waypoint_id:
                    dest = d
                    break
            if not dest and camp.get("destinations"):
                dest = camp["destinations"][0]
            if dest:
                wp = {
                    "id": dest.get("id") or dest.get("school_id") or data.waypoint_id,
                    "school_id": dest.get("school_id") or dest.get("id"),
                    "name": dest.get("name") or "Điểm trường",
                    "campaign_id": camp.get("id") or str(camp.get("_id"))
                }
                col_name = "campaigns"

    if not wp:
        school = await db.schools.find_one({
            "$or": [{"id": data.waypoint_id}, {"code": data.waypoint_id}],
            "is_deleted": {"$ne": True}
        })
        if school:
            wp = {
                "id": school.get("id") or data.waypoint_id,
                "school_id": school.get("id") or data.waypoint_id,
                "name": school.get("name") or "Điểm trường",
                "campaign_id": data.trip_id
            }
            col_name = "campaigns"

    if not wp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy điểm trường của chuyến đi."
        )

    now = datetime.now(timezone.utc)
    ticket_id = str(uuid.uuid4())

    ticket_doc = {
        "id": ticket_id,
        "waypoint_id": data.waypoint_id,
        "school_id": wp.get("school_id"),
        "school_name": wp.get("name"),
        "student_name": name,
        "phone": phone,
        "grade": data.grade.strip() if data.grade else "",
        "interested_majors": data.interested_majors or [],
        "answers": data.answers or {},
        "notes": data.notes.strip() if data.notes else "",
        "source": "QR_ONLINE",
        "tickets_collected": 1,
        "collection_date": now,
        "created_at": now,
        "is_deleted": False
    }

    # 2. Nhúng vào mảng tickets tương ứng
    if col_name == "campaign_waypoints":
        await db.campaign_waypoints.update_one(
            {"id": wp.get("id", data.waypoint_id)},
            {"$push": {"tickets": ticket_doc}, "$set": {"updated_at": now}}
        )
    elif col_name == "waypoints":
        await db.waypoints.update_one(
            {"id": wp.get("id", data.waypoint_id)},
            {"$push": {"tickets": ticket_doc}, "$set": {"updated_at": now}}
        )
    else:
        # Lưu vào campaign nếu đang ở giai đoạn planning hoặc test QR
        target_camp_id = wp.get("campaign_id") or data.trip_id
        await db.campaigns.update_one(
            {"$or": [{"id": target_camp_id}, {"_id": target_camp_id}]},
            {"$push": {"tickets": ticket_doc}, "$set": {"updated_at": now}}
        )

    # 3. Tự động tăng tổng số phiếu tuyển sinh của trường trong collection `schools`
    school_id = wp.get("school_id")
    if school_id:
        try:
            await increment_school_tickets(db, school_id, 1)
        except Exception as e:
            logger.warning(f"Could not increment school tickets for {school_id}: {e}")

    return {
        "success": True,
        "message": f"Cảm ơn bạn {name}! Thông tin khảo sát nguyện vọng tuyển sinh đã được gửi thành công.",
        "ticket_id": ticket_id
    }


# =========================================================================
# 2. CẤP ĐỘ CHIẾN DỊCH: QUẢN LÝ CẤU HÌNH & XEM PHIẾU THEO CHIẾN DỊCH
# =========================================================================

@router.get("/campaigns/{campaign_id}/survey-config")
async def get_campaign_survey_config(
    campaign_id: str,
    school_id: Optional[str] = Query(None, description="ID của điểm trường nếu muốn lấy cấu hình riêng"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy cấu hình form khảo sát.
    - Nếu truyền school_id: kiểm tra xem trường đó có cấu hình riêng (custom_survey_config) hay không.
    - Nếu không: trả về cấu hình form chung của chiến dịch.
    """
    db = get_database()
    camp = await db.campaigns.find_one({"$or": [{"id": campaign_id}, {"_id": campaign_id}], "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch")

    # Mặc định lấy cấu hình chung của campaign
    camp_cfg = camp.get("survey_config") or {}
    title = camp_cfg.get("title") or "Khảo Sát Nguyện Vọng Tuyển Sinh 2026"
    description = camp_cfg.get("description", "Vui lòng để lại thông tin để nhận tư vấn học bổng và chỉ tiêu tuyển sinh mới nhất.")
    majors = camp_cfg.get("majors") or list(DEFAULT_MAJORS_LIST)
    fields_enabled = camp_cfg.get("fields_enabled") or {
        "student_name": True,
        "phone": True,
        "grade": True,
        "email": False,
        "notes": True
    }
    questions = camp_cfg.get("questions")
    if not questions or len(questions) == 0:
        questions = build_default_questions(majors, fields_enabled)

    config = {
        "title": title,
        "description": description,
        "questions": questions,
        "majors": majors,
        "fields_enabled": fields_enabled,
        "is_custom": False,
        "school_id": None,
        "school_name": None
    }

    if school_id and school_id != "default":
        # Tìm trường trong campaign_waypoints hoặc destinations
        wp = await db.campaign_waypoints.find_one({
            "campaign_id": campaign_id,
            "$or": [{"school_id": school_id}, {"id": school_id}],
            "is_deleted": {"$ne": True}
        })
        school_name = (wp.get("name") if wp else "") or "Điểm trường"
        if not wp:
            # Thử tìm trong destinations của campaign
            for d in camp.get("destinations") or []:
                if d.get("school_id") == school_id or d.get("id") == school_id:
                    school_name = d.get("name") or school_name
                    if d.get("custom_survey_config"):
                        wp = {"custom_survey_config": d["custom_survey_config"], "name": school_name}
                    break

        if wp and wp.get("custom_survey_config"):
            custom_cfg = wp["custom_survey_config"]
            c_questions = custom_cfg.get("questions")
            if not c_questions or len(c_questions) == 0:
                c_questions = build_default_questions(custom_cfg.get("majors"), custom_cfg.get("fields_enabled"))
            config = {
                "title": custom_cfg.get("title") or title,
                "description": custom_cfg.get("description") if custom_cfg.get("description") is not None else description,
                "questions": c_questions,
                "majors": custom_cfg.get("majors") or majors,
                "fields_enabled": custom_cfg.get("fields_enabled") or fields_enabled,
                "is_custom": True,
                "school_id": school_id,
                "school_name": school_name
            }
        else:
            config["school_id"] = school_id
            config["school_name"] = school_name
            config["is_custom"] = False

    return {
        "success": True,
        "campaign_id": campaign_id,
        "campaign_name": camp.get("name"),
        "survey_config": config
    }


@router.put("/campaigns/{campaign_id}/survey-config")
async def update_campaign_survey_config(
    campaign_id: str,
    config: SurveyConfigSchema,
    school_id: Optional[str] = Query(None, description="ID của điểm trường nếu muốn cập nhật cấu hình riêng"),
    current_user: dict = Depends(get_current_user)
):
    """
    Cập nhật cấu hình form khảo sát (Google Form style).
    - Nếu có school_id: lưu vào cấu hình riêng của trường (custom_survey_config).
    - Nếu không: lưu vào cấu hình chung của toàn bộ chiến dịch.
    """
    db = get_database()
    camp = await db.campaigns.find_one({"$or": [{"id": campaign_id}, {"_id": campaign_id}], "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch")

    now = datetime.now(timezone.utc)
    config_dict = config.model_dump()

    target_school_id = school_id or config.school_id
    if target_school_id and target_school_id != "default":
        # Lưu vào cấu hình riêng cho trường
        config_dict["is_custom"] = True
        config_dict["school_id"] = target_school_id
        await db.campaign_waypoints.update_many(
            {"campaign_id": campaign_id, "$or": [{"school_id": target_school_id}, {"id": target_school_id}]},
            {"$set": {"custom_survey_config": config_dict, "updated_at": now}}
        )
        # Cập nhật trong destinations của campaign
        destinations = camp.get("destinations") or []
        for d in destinations:
            if d.get("school_id") == target_school_id or d.get("id") == target_school_id:
                d["custom_survey_config"] = config_dict
        await db.campaigns.update_one(
            {"$or": [{"id": campaign_id}, {"_id": campaign_id}]},
            {"$set": {"destinations": destinations, "updated_at": now}}
        )
        return {
            "success": True,
            "message": "Đã lưu cấu hình form riêng cho điểm trường thành công!",
            "survey_config": config_dict
        }
    else:
        # Lưu vào cấu hình chung của chiến dịch
        config_dict["is_custom"] = False
        config_dict["school_id"] = None
        await db.campaigns.update_one(
            {"$or": [{"id": campaign_id}, {"_id": campaign_id}]},
            {"$set": {"survey_config": config_dict, "updated_at": now}}
        )
        return {
            "success": True,
            "message": "Đã lưu cấu hình form chung của chiến dịch thành công!",
            "survey_config": config_dict
        }


@router.delete("/campaigns/{campaign_id}/survey-config/school/{school_id}")
async def revert_school_survey_config(
    campaign_id: str,
    school_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Khôi phục điểm trường về sử dụng form chung của chiến dịch."""
    db = get_database()
    now = datetime.now(timezone.utc)
    await db.campaign_waypoints.update_many(
        {"campaign_id": campaign_id, "$or": [{"school_id": school_id}, {"id": school_id}]},
        {"$unset": {"custom_survey_config": ""}, "$set": {"updated_at": now}}
    )
    camp = await db.campaigns.find_one({"$or": [{"id": campaign_id}, {"_id": campaign_id}]})
    if camp:
        destinations = camp.get("destinations") or []
        for d in destinations:
            if d.get("school_id") == school_id or d.get("id") == school_id:
                d.pop("custom_survey_config", None)
        await db.campaigns.update_one(
            {"$or": [{"id": campaign_id}, {"_id": campaign_id}]},
            {"$set": {"destinations": destinations, "updated_at": now}}
        )
    return {
        "success": True,
        "message": "Đã khôi phục điểm trường về sử dụng mẫu form chung thành công!"
    }


@router.get("/campaigns/{campaign_id}/survey-responses")
async def get_campaign_survey_responses(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy danh sách học sinh đã điền phiếu của RIÊNG chiến dịch này.
    Được dùng cho Tab 'Phiếu đã nộp' trong popup của trang Triển khai.
    """
    db = get_database()
    camp = await db.campaigns.find_one({"$or": [{"id": campaign_id}, {"_id": campaign_id}], "is_deleted": {"$ne": True}})
    camp_name = camp.get("name") if camp else "Chiến dịch tuyển sinh"

    # Lấy toàn bộ waypoints thuộc chiến dịch
    cursor = db.campaign_waypoints.find({
        "campaign_id": campaign_id,
        "is_deleted": {"$ne": True}
    }).sort("created_at", 1)
    waypoints = await cursor.to_list(length=500)

    # Lấy thêm chuyến đi để map trip_name
    trip_ids = list(set([w.get("trip_id") for w in waypoints if w.get("trip_id")]))
    trips_map = {}
    if trip_ids:
        trips = await db.admission_trips.find({"id": {"$in": trip_ids}}).to_list(length=100)
        for t in trips:
            trips_map[t["id"]] = t.get("name") or "Đợt công tác"

    items: List[dict] = []
    for wp in waypoints:
        wp_name = wp.get("name") or "Điểm trường"
        s_id = wp.get("school_id") or wp.get("id")
        t_id = wp.get("trip_id")
        t_name = trips_map.get(t_id, "Đợt thực địa")

        tickets = wp.get("tickets") or []
        for t in tickets:
            if t.get("is_deleted"):
                continue
            # Chỉ lấy các phiếu có học sinh nộp online hoặc có tên học sinh
            if t.get("student_name") or t.get("source") == "QR_ONLINE":
                items.append({
                    "id": t.get("id"),
                    "trip_id": t_id,
                    "trip_name": t_name,
                    "waypoint_id": wp.get("id"),
                    "school_id": s_id,
                    "school_name": wp_name,
                    "campaign_id": campaign_id,
                    "campaign_name": camp_name,
                    "student_name": t.get("student_name") or "Học sinh",
                    "phone": t.get("phone") or "",
                    "grade": t.get("grade") or "",
                    "interested_majors": t.get("interested_majors") or [],
                    "answers": t.get("answers") or {},
                    "notes": t.get("notes") or "",
                    "source": t.get("source") or "QR_ONLINE",
                    "created_at": to_vietnam_time_str(t.get("created_at") or t.get("collection_date"))
                })

    # Sắp xếp mới nhất lên đầu
    items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    return {
        "success": True,
        "campaign_id": campaign_id,
        "campaign_name": camp_name,
        "total": len(items),
        "responses": items
    }


# =========================================================================
# 3. CẤP ĐỘ HỆ THỐNG: TRANG QUẢN LÝ PHIẾU KHẢO SÁT TẬP TRUNG TRÊN SIDEBAR
# =========================================================================

@router.get("/surveys/all")
async def get_all_survey_responses(
    campaign_id: Optional[str] = Query(None),
    school_id: Optional[str] = Query(None),
    major: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    API Dành cho trang Quản lý Phiếu Khảo Sát trên Sidebar (/admin/surveys):
    - Đọc toàn bộ danh bạ học sinh từ tất cả các chiến dịch (0 bảng mới)
    - Bộ lọc đa chiều: Chiến dịch, Điểm trường, Ngành quan tâm
    - Tìm kiếm nhanh theo Tên, Số điện thoại
    - Trả về thống kê tổng quan (KPIs, Top ngành hot)
    """
    db = get_database()

    # 1. Tạo bản đồ tra cứu nhanh Tên Chiến Dịch và Tên Trường
    camps = await db.campaigns.find({"is_deleted": {"$ne": True}}).to_list(length=200)
    camps_map = {c.get("id") or str(c.get("_id")): c.get("name") for c in camps}

    schools = await db.schools.find({"is_deleted": {"$ne": True}}).to_list(length=500)
    schools_map = {s.get("id") or str(s.get("_id")): s.get("name") for s in schools}

    trips = await db.admission_trips.find({"is_deleted": {"$ne": True}}).to_list(length=500)
    trips_map = {t.get("id"): t.get("name") for t in trips}

    # 2. Tính thống kê TỔNG TOÀN HỆ THỐNG CỐ ĐỊNH (không thay đổi theo bộ lọc/tìm kiếm)
    all_active_waypoints = await db.campaign_waypoints.find({"is_deleted": {"$ne": True}}).to_list(length=5000)

    global_total_tickets = 0
    global_schools_with_responses = set()
    global_majors_counter: Dict[str, int] = {}

    for wp in all_active_waypoints:
        s_id = wp.get("school_id") or wp.get("id")
        wp_school_name = schools_map.get(s_id) or wp.get("name") or "Điểm trường"
        tickets = wp.get("tickets") or []
        for t in tickets:
            if t.get("is_deleted"):
                continue
            st_name = t.get("student_name") or ""
            if not st_name and t.get("source") != "QR_ONLINE":
                continue
            global_total_tickets += 1
            global_schools_with_responses.add(wp_school_name)
            for m in (t.get("interested_majors") or []):
                if m and str(m).strip():
                    global_majors_counter[m] = global_majors_counter.get(m, 0) + 1

    global_top_majors = sorted(
        [{"major": m, "count": cnt} for m, cnt in global_majors_counter.items()],
        key=lambda x: x["count"],
        reverse=True
    )

    # 3. Xây dựng bộ lọc waypoints cho danh sách hiển thị
    wp_query: Dict[str, Any] = {"is_deleted": {"$ne": True}}
    if campaign_id and campaign_id != "all":
        wp_query["campaign_id"] = campaign_id
    if school_id and school_id != "all":
        wp_query["$or"] = [{"school_id": school_id}, {"id": school_id}]

    waypoints = await db.campaign_waypoints.find(wp_query).to_list(length=2000)

    # 4. Lọc và bóc tách dữ liệu học sinh theo từ khóa & bộ lọc
    search_q = search.strip().lower() if search else None
    major_filter = major.strip() if major and major != "all" else None

    responses = []
    filtered_majors_counter: Dict[str, int] = {}
    filtered_schools_with_responses = set()

    for wp in waypoints:
        wp_id = wp.get("id")
        wp_name = wp.get("name") or "Điểm trường"
        s_id = wp.get("school_id") or wp_id
        c_id = wp.get("campaign_id")
        t_id = wp.get("trip_id")

        wp_school_name = schools_map.get(s_id) or wp_name
        wp_camp_name = camps_map.get(c_id) or "Chiến dịch tuyển sinh"
        wp_trip_name = trips_map.get(t_id) or "Đợt thực địa"

        tickets = wp.get("tickets") or []
        for t in tickets:
            if t.get("is_deleted"):
                continue

            # Chỉ lấy các phiếu có học sinh
            st_name = t.get("student_name") or ""
            phone = t.get("phone") or ""
            if not st_name and t.get("source") != "QR_ONLINE":
                continue

            # Áp dụng bộ lọc tìm kiếm (Tên hoặc SĐT)
            if search_q:
                match_name = search_q in st_name.lower()
                match_phone = search_q in phone.lower()
                if not match_name and not match_phone:
                    continue

            # Áp dụng bộ lọc ngành
            st_majors = t.get("interested_majors") or []
            if major_filter:
                if major_filter not in st_majors:
                    continue

            # Đếm thống kê theo bộ lọc
            filtered_schools_with_responses.add(wp_school_name)
            for m in st_majors:
                filtered_majors_counter[m] = filtered_majors_counter.get(m, 0) + 1

            raw_date = t.get("created_at") or t.get("collection_date")
            responses.append({
                "id": t.get("id") or str(uuid.uuid4()),
                "student_name": st_name or "Học sinh",
                "phone": phone,
                "grade": t.get("grade") or "",
                "interested_majors": st_majors,
                "notes": t.get("notes") or "",
                "school_id": s_id,
                "school_name": wp_school_name,
                "campaign_id": c_id,
                "campaign_name": wp_camp_name,
                "trip_id": t_id,
                "trip_name": wp_trip_name,
                "source": t.get("source") or "QR_ONLINE",
                "created_at": to_vietnam_time_str(raw_date),
                "raw_date": raw_date
            })

    # Sắp xếp mới nhất lên đầu
    responses.sort(key=lambda x: str(x.get("raw_date") or ""), reverse=True)

    # Thống kê top ngành quan tâm theo bộ lọc
    filtered_top_majors = sorted(
        [{"major": m, "count": cnt} for m, cnt in filtered_majors_counter.items()],
        key=lambda x: x["count"],
        reverse=True
    )

    return {
        "success": True,
        # summary: LUÔN TRẢ VỀ TỔNG TOÀN HỆ THỐNG cho 3 khung thống kê KPI trên đầu trang
        "summary": {
            "total_tickets": global_total_tickets,
            "total_schools": len(global_schools_with_responses),
            "top_majors": global_top_majors[:5]
        },
        # filtered_summary: Thống kê riêng cho kết quả sau khi lọc/tìm kiếm
        "filtered_summary": {
            "total_tickets": len(responses),
            "total_schools": len(filtered_schools_with_responses),
            "top_majors": filtered_top_majors[:5]
        },
        "filters_meta": {
            "campaigns": [{"id": c_id, "name": name} for c_id, name in camps_map.items()],
            "schools": [{"id": s_id, "name": name} for s_id, name in schools_map.items()],
            "majors": list(DEFAULT_MAJORS_LIST)
        },
        "responses": responses
    }
