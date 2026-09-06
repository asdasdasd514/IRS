"""
Campaign API Endpoints - Quản lý Chiến dịch Tuyển sinh & Tối ưu hóa Lộ trình Lập kế hoạch
"""

from typing import List, Optional
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_database
from app.schemas import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignDeployResponse,
    CampaignStatus,
    WaypointType
)
from app.services.auth_service import get_current_user
from app.services.routing_service import routing_service

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


def format_campaign_response(c: dict) -> CampaignResponse:
    doc = dict(c)
    doc.pop("_id", None)
    destinations = doc.get("destinations", [])
    doc["total_destinations"] = len(destinations)
    return CampaignResponse.model_validate(doc)


@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(current_user: dict = Depends(get_current_user)):
    """Lấy danh sách tất cả các chiến dịch tuyển sinh"""
    db = get_database()
    cursor = db.campaigns.find({"is_deleted": {"$ne": True}}).sort("created_at", -1)
    campaigns = await cursor.to_list(length=100)
    return [format_campaign_response(c) for c in campaigns]


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Xem chi tiết một chiến dịch tuyển sinh kèm danh sách địa điểm mục tiêu"""
    db = get_database()
    campaign = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not campaign:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")
    return format_campaign_response(campaign)


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Tạo mới một chiến dịch tuyển sinh:
    - Thêm các địa điểm / trường học dự kiến tham quan (destinations).
    - Thiết lập điểm xuất phát (start_lat, start_lng).
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    camp_id = str(uuid.uuid4())
    camp_dict = campaign_data.model_dump()

    # Tự động snapshot thông tin trường nếu destination có school_id mà thiếu name/address
    if camp_dict.get("destinations"):
        for dest in camp_dict["destinations"]:
            if dest.get("school_id"):
                school = await db.schools.find_one({
                    "$or": [{"id": dest["school_id"]}, {"code": dest["school_id"]}],
                    "is_deleted": {"$ne": True}
                })
                if school:
                    if not dest.get("name") or dest.get("name") == "string":
                        dest["name"] = school.get("name", dest.get("name"))
                    if not dest.get("address"):
                        dest["address"] = school.get("address")
                    if not dest.get("lat") and school.get("lat"):
                        dest["lat"] = school.get("lat")
                    if not dest.get("lng") and school.get("lng"):
                        dest["lng"] = school.get("lng")
            if not dest.get("id"):
                dest["id"] = str(uuid.uuid4())

    camp_doc = {
        "id": camp_id,
        **camp_dict,
        "manager_id": current_user.get("id"),
        "deployed_trip_id": None,
        "estimated_distance_km": None,
        "estimated_duration_minutes": None,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.campaigns.insert_one(camp_doc)
    return format_campaign_response(camp_doc)


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: str,
    campaign_data: CampaignUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Cập nhật thông tin chiến dịch và danh sách các địa điểm mục tiêu"""
    db = get_database()
    now = datetime.now(timezone.utc)
    camp = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")

    update_dict = campaign_data.model_dump(exclude_unset=True)
    if "status" in update_dict and hasattr(update_dict["status"], "value"):
        update_dict["status"] = update_dict["status"].value

    update_dict["updated_at"] = now
    await db.campaigns.update_one({"id": campaign_id}, {"$set": update_dict})
    updated_camp = await db.campaigns.find_one({"id": campaign_id})
    return format_campaign_response(updated_camp)


@router.post("/{campaign_id}/optimize-route")
async def preview_optimized_route(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Tính toán và xem trước (Preview) lộ trình tối ưu đường đi:
    Sử dụng thuật toán Dynamic Next-Hop Routing để tối ưu hóa thứ tự ghé thăm các trường thích ứng theo khoảng cách và thời gian.
    """
    db = get_database()
    camp = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")

    destinations = camp.get("destinations", [])
    if not destinations:
        raise HTTPException(status_code=400, detail="Chiến dịch chưa có địa điểm nào để tối ưu đường đi.")

    start_lat = camp.get("start_lat") or destinations[0]["lat"]
    start_lng = camp.get("start_lng") or destinations[0]["lng"]
    start_point = {"lat": start_lat, "lng": start_lng}

    ordered_dests, total_dist_meters, total_dur_seconds = routing_service.plan_dynamic_next_hop_route(
        start_point, destinations
    )

    return {
        "campaign_id": campaign_id,
        "campaign_name": camp.get("name"),
        "routing_algorithm": "Dynamic Next-Hop Routing",
        "total_destinations": len(ordered_dests),
        "estimated_distance_km": round(total_dist_meters / 1000, 2),
        "estimated_duration_minutes": int(total_dur_seconds / 60),
        "optimized_order": [d["name"] for d in ordered_dests],
        "destinations": ordered_dests
    }


@router.post("/{campaign_id}/deploy", response_model=CampaignDeployResponse)
async def deploy_campaign_route(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Triển khai chiến dịch:
    1. Tự động tính toán đường đi bằng thuật toán Dynamic Next-Hop Routing qua các trường mục tiêu.
    2. Tự động khởi tạo Chuyến đi thực tế (admission_trips) với các waypoints đã được sắp xếp theo lộ trình tối ưu.
    3. Cập nhật trạng thái chiến dịch thành 'deployed'.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    camp = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")

    destinations = camp.get("destinations", [])
    if not destinations:
        raise HTTPException(status_code=400, detail="Chiến dịch chưa có địa điểm nào để triển khai lộ trình.")

    # Điểm xuất phát
    start_lat = camp.get("start_lat") or destinations[0]["lat"]
    start_lng = camp.get("start_lng") or destinations[0]["lng"]
    start_point = {"lat": start_lat, "lng": start_lng}

    # 1. Thuật toán Dynamic Next-Hop Routing
    ordered_dests, total_dist_meters, total_dur_seconds = routing_service.plan_dynamic_next_hop_route(
        start_point, destinations
    )

    # 2. Tạo chuyến đi thực tế (admission_trips)
    trip_id = str(uuid.uuid4())
    trip_doc = {
        "id": trip_id,
        "campaign_id": campaign_id,
        "name": f"Lộ trình: {camp.get('name')}",
        "status": "active",
        "current_lat": start_lat,
        "current_lng": start_lng,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.admission_trips.insert_one(trip_doc)

    # 3. Tạo các Waypoints theo thứ tự đã tối ưu hóa
    waypoints_docs = []
    for i, dest in enumerate(ordered_dests, 1):
        wp_id = str(uuid.uuid4())
        wp_doc = {
            "id": wp_id,
            "trip_id": trip_id,
            "school_id": dest.get("school_id"),
            "name": dest.get("name"),
            "address": dest.get("address"),
            "lat": dest.get("lat"),
            "lng": dest.get("lng"),
            "type": WaypointType.SCHOOL.value,
            "visit_order": i,
            "is_visited": False,
            "visited_at": None,
            "notes": dest.get("notes"),
            "visit_logs": [],
            "tickets": [],
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }

        # Snapshot thông tin chi tiết từ trường gốc nếu có school_id
        if dest.get("school_id"):
            school = await db.schools.find_one({
                "$or": [{"id": dest["school_id"]}, {"code": dest["school_id"]}],
                "is_deleted": {"$ne": True}
            })
            if school:
                wp_doc["description"] = school.get("description")
                wp_doc["website"] = school.get("website")
                wp_doc["image_url"] = school.get("image_url")
                wp_doc["admissions_info"] = school.get("admissions_info")
                if school.get("school_board"):
                    sb = school["school_board"]
                    wp_doc["principal_name"] = sb.get("principal_name")
                    wp_doc["principal_phone"] = sb.get("principal_phone")
                    wp_doc["vice_principal_name"] = sb.get("vice_principal_name")
                    wp_doc["vice_principal_phone"] = sb.get("vice_principal_phone")

        waypoints_docs.append(wp_doc)

    if waypoints_docs:
        await db.waypoints.insert_many(waypoints_docs)

    # 4. Cập nhật Campaign
    dist_km = round(total_dist_meters / 1000, 2)
    dur_min = int(total_dur_seconds / 60)
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": CampaignStatus.DEPLOYED.value,
            "deployed_trip_id": trip_id,
            "estimated_distance_km": dist_km,
            "estimated_duration_minutes": dur_min,
            "updated_at": now
        }}
    )

    updated_camp = await db.campaigns.find_one({"id": campaign_id})
    trip_doc.pop("_id", None)
    for w in waypoints_docs:
        w.pop("_id", None)
    trip_doc["waypoints"] = waypoints_docs
    trip_doc["total_waypoints"] = len(waypoints_docs)

    return CampaignDeployResponse(
        campaign=format_campaign_response(updated_camp),
        trip=trip_doc,
        total_destinations=len(ordered_dests),
        optimized_order=[d["name"] for d in ordered_dests],
        estimated_distance_km=dist_km,
        message=f"Đã triển khai chiến dịch thành công thành Chuyến đi '{trip_doc['name']}' với lộ trình tối ưu qua {len(ordered_dests)} trường."
    )


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Xóa mềm chiến dịch và các chuyến đi trực thuộc.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    camp = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")

    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
    # Xóa mềm các chuyến đi thuộc chiến dịch
    await db.admission_trips.update_many(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
