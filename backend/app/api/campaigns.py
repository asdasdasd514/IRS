"""
Campaign API Endpoints - Quản lý Chiến dịch Tuyển sinh & Tối ưu hóa Lộ trình Lập kế hoạch
Sử dụng thuật toán Dynamic Next-Hop Routing và lưu trữ kết quả trong route_plans & campaign_waypoints
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status

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


class RoutePreviewDirectRequest(BaseModel):
    destinations: List[Dict[str, Any]]
    start_point: Dict[str, Any]


@router.post("/preview-route")
async def preview_campaign_route_direct(
    payload: RoutePreviewDirectRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Tính toán và xem trước (Preview) lộ trình tối ưu đường bộ KHÔNG lưu vào Database:
    Phục vụ xem trước trong wizard tạo chiến dịch, chỉ khi bấm xác nhận mới lưu chiến dịch.
    """
    destinations = payload.destinations or []
    if not destinations:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất một trường mục tiêu để tính lộ trình.")

    start_point = payload.start_point or {}
    origin_lat = start_point.get("lat")
    origin_lng = start_point.get("lng")
    if origin_lat is None or origin_lng is None:
        origin_lat = destinations[0].get("lat")
        origin_lng = destinations[0].get("lng")
        origin_name = destinations[0].get("name", "Điểm xuất phát")
    else:
        origin_name = start_point.get("name", "Điểm xuất phát")
        origin_address = start_point.get("address")

    st_pt = {
        "lat": float(origin_lat),
        "lng": float(origin_lng),
        "name": origin_name,
        "address": origin_address,
        "school_id": start_point.get("school_id")
    }

    ordered_dests, total_dist_meters, total_dur_seconds, route_geometry, encoded_polyline, duration_text = (
        routing_service.plan_dynamic_next_hop_route(st_pt, destinations)
    )

    return {
        "routing_algorithm": "Dynamic Next-Hop Routing",
        "start_point": st_pt,
        "total_destinations": len(ordered_dests),
        "estimated_distance_km": round(total_dist_meters / 1000, 2),
        "estimated_duration_minutes": int(total_dur_seconds / 60),
        "estimated_duration_text": duration_text,
        "optimized_order": [d["name"] for d in ordered_dests],
        "destinations": ordered_dests,
        "polyline": encoded_polyline,
        "route_geometry": route_geometry
    }



def format_campaign_response(c: dict, route_plan: dict = None) -> CampaignResponse:
    doc = dict(c)
    doc.pop("_id", None)
    destinations = doc.get("destinations", [])
    doc["total_destinations"] = len(destinations)

    # Nếu có route_plan, tự động merge các thông tin định tuyến đã tính toán
    if route_plan:
        if not doc.get("start_point") and route_plan.get("start_lat") is not None and route_plan.get("start_lng") is not None:
            doc["start_point"] = {
                "lat": route_plan["start_lat"],
                "lng": route_plan["start_lng"],
                "name": route_plan.get("start_name", "Điểm xuất phát"),
                "address": route_plan.get("start_address")
            }
        if not doc.get("route_geometry") and route_plan.get("route_geometry"):
            doc["route_geometry"] = route_plan["route_geometry"]
        if not doc.get("polyline") and route_plan.get("polyline"):
            doc["polyline"] = route_plan["polyline"]
        if doc.get("estimated_distance_km") is None and route_plan.get("estimated_distance_km") is not None:
            doc["estimated_distance_km"] = route_plan["estimated_distance_km"]
        if doc.get("estimated_duration_minutes") is None and route_plan.get("estimated_duration_minutes") is not None:
            doc["estimated_duration_minutes"] = route_plan["estimated_duration_minutes"]
        if not doc.get("estimated_duration_text") and route_plan.get("estimated_duration_text"):
            doc["estimated_duration_text"] = route_plan["estimated_duration_text"]
        if route_plan.get("destinations") and len(route_plan["destinations"]) > 0:
            doc["destinations"] = route_plan["destinations"]
            doc["total_destinations"] = len(route_plan["destinations"])

    return CampaignResponse.model_validate(doc)


@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(current_user: dict = Depends(get_current_user)):
    """Lấy danh sách tất cả các chiến dịch tuyển sinh kèm dữ liệu lộ trình"""
    db = get_database()
    cursor = db.campaigns.find({"is_deleted": {"$ne": True}}).sort("created_at", -1)
    campaigns = await cursor.to_list(length=100)

    # Lấy kèm route_plans để gắn đầy đủ lộ trình cho các chiến dịch
    camp_ids = [c["id"] for c in campaigns if "id" in c]
    route_plans_cursor = db.route_plans.find({"campaign_id": {"$in": camp_ids}, "is_deleted": {"$ne": True}}).sort("created_at", -1)
    route_plans = await route_plans_cursor.to_list(length=200)
    route_plans_map = {}
    for rp in route_plans:
        cid = rp.get("campaign_id")
        if cid and cid not in route_plans_map:
            route_plans_map[cid] = rp

    return [format_campaign_response(c, route_plans_map.get(c.get("id"))) for c in campaigns]


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Xem chi tiết một chiến dịch tuyển sinh kèm danh sách địa điểm mục tiêu và lộ trình"""
    db = get_database()
    campaign = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not campaign:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")

    route_plan = await db.route_plans.find_one(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        sort=[("created_at", -1)]
    )
    return format_campaign_response(campaign, route_plan)


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Tạo mới một chiến dịch tuyển sinh:
    - Lưu thông tin chung của chiến dịch (tên, mô tả, thời gian dự kiến).
    - Thêm danh sách các trường / địa điểm dự kiến tham quan (destinations).
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    camp_id = str(uuid.uuid4())
    camp_dict = campaign_data.model_dump()

    # Tự động snapshot tọa độ & địa chỉ trường nếu destination có school_id
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
    start_lat: Optional[float] = Query(None, description="Vĩ độ điểm xuất phát"),
    start_lng: Optional[float] = Query(None, description="Kinh độ điểm xuất phát"),
    start_name: Optional[str] = Query(None, description="Tên điểm xuất phát"),
    start_address: Optional[str] = Query(None, description="Địa chỉ điểm xuất phát"),
    current_user: dict = Depends(get_current_user)
):
    """
    Tính toán và xem trước (Preview) lộ trình tối ưu đường đi:
    1. Sử dụng thuật toán Dynamic Next-Hop Routing để tối ưu hóa thứ tự ghé thăm các trường.
    2. Tự động lưu trữ kết quả tính toán vào collection `route_plans`.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    camp = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")

    destinations = camp.get("destinations", [])
    if not destinations:
        raise HTTPException(status_code=400, detail="Chiến dịch chưa có địa điểm nào để tối ưu đường đi.")

    existing_start = camp.get("start_point") or {}
    origin_lat = start_lat if start_lat is not None else destinations[0]["lat"]
    origin_lng = start_lng if start_lng is not None else destinations[0]["lng"]
    origin_name = start_name or existing_start.get("name") or "Điểm xuất phát"
    origin_address = start_address or existing_start.get("address")
    start_point = {"lat": origin_lat, "lng": origin_lng, "name": origin_name, "address": origin_address}

    ordered_dests, total_dist_meters, total_dur_seconds, route_geometry, encoded_polyline, duration_text = (
        routing_service.plan_dynamic_next_hop_route(start_point, destinations)
    )

    # Lưu kết quả tính toán vào collection route_plans
    plan_id = str(uuid.uuid4())
    route_plan_doc = {
        "id": plan_id,
        "campaign_id": campaign_id,
        "trip_id": None,
        "name": f"Kế hoạch định tuyến - {camp.get('name')}",
        "algorithm": "Dynamic Next-Hop Routing",
        "start_lat": origin_lat,
        "start_lng": origin_lng,
        "start_name": origin_name,
        "start_address": origin_address,
        "total_destinations": len(ordered_dests),
        "total_distance_meters": int(total_dist_meters),
        "estimated_distance_km": round(total_dist_meters / 1000, 2),
        "total_duration_seconds": int(total_dur_seconds),
        "estimated_duration_minutes": int(total_dur_seconds / 60),
        "estimated_duration_text": duration_text,
        "destinations": [
            {
                "order": idx + 1,
                "priority": d.get("priority"),
                "school_id": d.get("school_id"),
                "waypoint_id": d.get("waypoint_id") or d.get("id"),
                "name": d.get("name"),
                "lat": d.get("lat"),
                "lng": d.get("lng"),
                "address": d.get("address"),
                "distance_meters": d.get("distance_meters"),
                "duration_seconds": d.get("duration_seconds"),
                "distance_text": d.get("distance_text"),
                "duration_text": d.get("duration_text")
            }
            for idx, d in enumerate(ordered_dests)
        ],
        "polyline": encoded_polyline,
        "route_geometry": route_geometry,
        "status": "draft",
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.route_plans.insert_one(route_plan_doc)

    # Cập nhật trực tiếp kết quả định tuyến vào collection campaigns
    await db.campaigns.update_one(
        {"id": campaign_id},
        {
            "$set": {
                "start_point": {"lat": origin_lat, "lng": origin_lng, "name": origin_name, "address": origin_address},
                "estimated_distance_km": round(total_dist_meters / 1000, 2),
                "estimated_duration_minutes": int(total_dur_seconds / 60),
                "estimated_duration_text": duration_text,
                "destinations": ordered_dests,
                "route_geometry": route_geometry,
                "polyline": encoded_polyline,
                "updated_at": now
            }
        }
    )

    return {
        "plan_id": plan_id,
        "campaign_id": campaign_id,
        "campaign_name": camp.get("name"),
        "routing_algorithm": "Dynamic Next-Hop Routing",
        "start_point": {"lat": origin_lat, "lng": origin_lng, "name": origin_name},
        "total_destinations": len(ordered_dests),
        "estimated_distance_km": round(total_dist_meters / 1000, 2),
        "estimated_duration_minutes": int(total_dur_seconds / 60),
        "estimated_duration_text": duration_text,
        "optimized_order": [d["name"] for d in ordered_dests],
        "destinations": ordered_dests,
        "polyline": encoded_polyline,
        "route_geometry": route_geometry
    }


@router.post("/{campaign_id}/deploy", response_model=CampaignDeployResponse)
async def deploy_campaign_route(
    campaign_id: str,
    start_lat: Optional[float] = Query(None, description="Vĩ độ điểm xuất phát"),
    start_lng: Optional[float] = Query(None, description="Kinh độ điểm xuất phát"),
    current_user: dict = Depends(get_current_user)
):
    """
    Triển khai chiến dịch:
    1. Tự động tính toán đường đi bằng thuật toán Dynamic Next-Hop Routing qua các trường mục tiêu.
    2. Lưu kết quả định tuyến vào collection `route_plans`.
    3. Khởi tạo Chuyến đi thực tế (admission_trips) và các điểm dừng trong `campaign_waypoints`.
    4. Cập nhật trạng thái chiến dịch thành 'deployed'.
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
    origin_lat = start_lat if start_lat is not None else destinations[0]["lat"]
    origin_lng = start_lng if start_lng is not None else destinations[0]["lng"]
    start_point = {"lat": origin_lat, "lng": origin_lng}

    # 1. Thuật toán Dynamic Next-Hop Routing đường bộ
    ordered_dests, total_dist_meters, total_dur_seconds, route_geometry, encoded_polyline, duration_text = (
        routing_service.plan_dynamic_next_hop_route(start_point, destinations)
    )
    dist_km = round(total_dist_meters / 1000, 2)
    dur_min = int(total_dur_seconds / 60)

    # 2. Tạo chuyến đi thực tế (admission_trips)
    trip_id = str(uuid.uuid4())
    trip_doc = {
        "id": trip_id,
        "campaign_id": campaign_id,
        "name": f"Lộ trình: {camp.get('name')}",
        "status": "active",
        "current_lat": origin_lat,
        "current_lng": origin_lng,
        "polyline": encoded_polyline,
        "route_geometry": route_geometry,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.admission_trips.insert_one(trip_doc)

    # 3. Tạo các điểm dừng trong collection `campaign_waypoints` theo thứ tự tối ưu
    campaign_waypoints_docs = []
    for i, dest in enumerate(ordered_dests, 1):
        cw_id = str(uuid.uuid4())
        cw_doc = {
            "id": cw_id,
            "campaign_id": campaign_id,
            "trip_id": trip_id,
            "school_id": dest.get("school_id"),
            "waypoint_id": dest.get("waypoint_id") or dest.get("id"),
            "name": dest.get("name"),
            "address": dest.get("address"),
            "lat": dest.get("lat"),
            "lng": dest.get("lng"),
            "type": WaypointType.SCHOOL.value,
            "visit_order": i,
            "priority": dest.get("priority"),
            "is_visited": False,
            "visited_at": None,
            "notes": dest.get("notes"),
            "visit_logs": [],
            "tickets": [],
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        campaign_waypoints_docs.append(cw_doc)

    if campaign_waypoints_docs:
        await db.campaign_waypoints.insert_many(campaign_waypoints_docs)

    # 4. Lưu kết quả định tuyến chính thức vào collection `route_plans`
    plan_id = str(uuid.uuid4())
    route_plan_doc = {
        "id": plan_id,
        "campaign_id": campaign_id,
        "trip_id": trip_id,
        "name": f"Lộ trình triển khai - {camp.get('name')}",
        "algorithm": "Dynamic Next-Hop Routing",
        "start_lat": origin_lat,
        "start_lng": origin_lng,
        "start_name": "Điểm xuất phát",
        "total_destinations": len(ordered_dests),
        "total_distance_meters": int(total_dist_meters),
        "estimated_distance_km": dist_km,
        "total_duration_seconds": int(total_dur_seconds),
        "estimated_duration_minutes": dur_min,
        "destinations": [
            {
                "order": idx + 1,
                "priority": d.get("priority"),
                "school_id": d.get("school_id"),
                "waypoint_id": d.get("waypoint_id") or d.get("id"),
                "name": d.get("name"),
                "lat": d.get("lat"),
                "lng": d.get("lng"),
                "address": d.get("address")
            }
            for idx, d in enumerate(ordered_dests)
        ],
        "polyline": None,
        "status": "applied",
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    await db.route_plans.insert_one(route_plan_doc)

    # 5. Cập nhật Campaign
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
    for w in campaign_waypoints_docs:
        w.pop("_id", None)
    trip_doc["waypoints"] = campaign_waypoints_docs
    trip_doc["total_waypoints"] = len(campaign_waypoints_docs)

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
    Xóa mềm chiến dịch và các chuyến đi, điểm dừng, kế hoạch lộ trình trực thuộc.
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
    # Xóa mềm các campaign_waypoints thuộc chiến dịch
    await db.campaign_waypoints.update_many(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
    # Xóa mềm các route_plans thuộc chiến dịch
    await db.route_plans.update_many(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
