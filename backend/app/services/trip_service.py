"""
Trip Service - Business logic for managing admission trips (MongoDB IRS Database)
Sử dụng collection `campaign_waypoints` để quản lý các điểm dừng trong chuyến đi/chiến dịch
và tự động tham chiếu thông tin hồ sơ trường từ collection `schools`.
"""

from typing import List, Optional
from datetime import datetime, timezone
from math import radians, sin, cos, sqrt, atan2
import uuid

from app.core.database import get_database
from app.schemas import (
    TripCreate, TripUpdate, TripResponse, TripListResponse,
    WaypointCreate, WaypointUpdate, WaypointResponse,
    CheckInRequest, CheckInResponse, WaypointType, TripStatus
)
from app.services.routing_service import routing_service


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Tính khoảng cách giữa 2 điểm GPS theo công thức Haversine (mét)"""
    R = 6371000
    lat1_rad, lat2_rad = radians(lat1), radians(lat2)
    delta_lat, delta_lng = radians(lat2 - lat1), radians(lng2 - lng1)
    
    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


async def sync_waypoint_to_school(db, school_id: str, updated_fields: dict):
    """Đồng bộ ngược các thông tin Ban giám hiệu, đại diện từ waypoint về danh mục schools"""
    if not school_id:
        return
    
    school_set = {}
    board_updates = {}
    
    if "principal_name" in updated_fields and updated_fields["principal_name"]:
        board_updates["school_board.principal_name"] = updated_fields["principal_name"]
    if "principal_phone" in updated_fields and updated_fields["principal_phone"]:
        board_updates["school_board.principal_phone"] = updated_fields["principal_phone"]
    if "vice_principal_name" in updated_fields and updated_fields["vice_principal_name"]:
        board_updates["school_board.vice_principal_name"] = updated_fields["vice_principal_name"]
    if "vice_principal_phone" in updated_fields and updated_fields["vice_principal_phone"]:
        board_updates["school_board.vice_principal_phone"] = updated_fields["vice_principal_phone"]
        
    if "representative_name" in updated_fields and updated_fields["representative_name"]:
        school_set["representative_name"] = updated_fields["representative_name"]
    if "representative_phone" in updated_fields and updated_fields["representative_phone"]:
        school_set["representative_phone"] = updated_fields["representative_phone"]
    if "website" in updated_fields and updated_fields["website"]:
        school_set["website"] = updated_fields["website"]
    if "image_url" in updated_fields and updated_fields["image_url"]:
        school_set["image_url"] = updated_fields["image_url"]
    if "description" in updated_fields and updated_fields["description"]:
        school_set["description"] = updated_fields["description"]
    if "admissions_info" in updated_fields and updated_fields["admissions_info"]:
        school_set["admissions_info"] = updated_fields["admissions_info"]

    school_set.update(board_updates)
    if school_set:
        school_set["updated_at"] = datetime.now(timezone.utc)
        await db.schools.update_one(
            {"$or": [{"id": school_id}, {"code": school_id}], "is_deleted": {"$ne": True}},
            {"$set": school_set}
        )


class TripService:
    async def create_trip(self, trip_data: TripCreate) -> dict:
        db = get_database()
        trip_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        trip_doc = {
            "id": trip_id,
            "name": trip_data.name,
            "campaign_id": trip_data.campaign_id,
            "trip_code": trip_data.trip_code,
            "status": TripStatus.ACTIVE.value,
            "current_lat": trip_data.current_lat,
            "current_lng": trip_data.current_lng,
            "team": trip_data.team.model_dump() if trip_data.team else None,
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        await db.admission_trips.insert_one(trip_doc)

        waypoints_list = trip_data.waypoints or []
        
        # Tối ưu hóa thứ tự các trường bằng Dynamic Next-Hop Routing ngay lúc tạo
        if len(waypoints_list) >= 2:
            start_lat = trip_data.current_lat if trip_data.current_lat is not None else waypoints_list[0].lat
            start_lng = trip_data.current_lng if trip_data.current_lng is not None else waypoints_list[0].lng
            start_pt = {"lat": start_lat, "lng": start_lng}
            
            raw_wps = [wp.model_dump() for wp in waypoints_list]
            ordered_wps, _, _ = routing_service.plan_dynamic_next_hop_route(start_pt, raw_wps)
        else:
            ordered_wps = [wp.model_dump() for wp in waypoints_list]

        cw_docs = []
        for i, wp_dict in enumerate(ordered_wps):
            cw_id = str(uuid.uuid4())
            cw_doc = {
                "id": cw_id,
                "trip_id": trip_id,
                "campaign_id": trip_data.campaign_id or trip_id,
                "school_id": wp_dict.get("school_id"),
                "waypoint_id": wp_dict.get("waypoint_id") or wp_dict.get("id"),
                "name": wp_dict.get("name"),
                "lat": wp_dict.get("lat"),
                "lng": wp_dict.get("lng"),
                "address": wp_dict.get("address"),
                "type": wp_dict.get("type", "SCHOOL"),
                "visit_order": i + 1,
                "is_visited": False,
                "visited_at": None,
                "notes": wp_dict.get("notes"),
                "visit_logs": [],
                "tickets": [],
                "is_deleted": False,
                "created_at": now,
                "updated_at": now
            }
            if hasattr(cw_doc["type"], "value"):
                cw_doc["type"] = cw_doc["type"].value
            cw_docs.append(cw_doc)

        if cw_docs:
            await db.campaign_waypoints.insert_many(cw_docs)

        return await self.get_trip(trip_id)

    async def get_trip(self, trip_id: str) -> Optional[dict]:
        db = get_database()
        trip = await db.admission_trips.find_one({"id": trip_id, "is_deleted": {"$ne": True}})
        if not trip:
            return None

        # Truy vấn các điểm dừng của chuyến đi từ campaign_waypoints (fallback waypoints)
        cursor = db.campaign_waypoints.find({"trip_id": trip_id, "is_deleted": {"$ne": True}}).sort("visit_order", 1)
        waypoints = await cursor.to_list(length=1000)
        if not waypoints:
            cursor_legacy = db.waypoints.find({"trip_id": trip_id, "is_deleted": {"$ne": True}}).sort("visit_order", 1)
            waypoints = await cursor_legacy.to_list(length=1000)

        # Tham chiếu thông tin trường học từ schools nếu có school_id
        for w in waypoints:
            w.pop("_id", None)
            if w.get("school_id"):
                school = await db.schools.find_one({
                    "$or": [{"id": w["school_id"]}, {"code": w["school_id"]}],
                    "is_deleted": {"$ne": True}
                })
                if school:
                    school.pop("_id", None)
                    w["school"] = school

        trip.pop("_id", None)
        trip["waypoints"] = waypoints
        trip["total_waypoints"] = len(waypoints)
        trip["visited_count"] = sum(1 for w in waypoints if w.get("is_visited"))
        trip["total_tickets"] = sum(
            t.get("tickets_collected", 0)
            for w in waypoints
            for t in w.get("tickets", [])
            if not t.get("is_deleted")
        )
        return trip

    async def get_trips(self, status: Optional[str] = None) -> List[dict]:
        db = get_database()
        query = {"is_deleted": {"$ne": True}}
        if status:
            query["status"] = status.value if hasattr(status, 'value') else status

        cursor = db.admission_trips.find(query).sort("created_at", -1)
        trips = await cursor.to_list(length=1000)

        for trip in trips:
            trip.pop("_id", None)
            wps_cursor = db.campaign_waypoints.find({"trip_id": trip["id"], "is_deleted": {"$ne": True}})
            wps = await wps_cursor.to_list(length=1000)
            if not wps:
                wps_legacy = db.waypoints.find({"trip_id": trip["id"], "is_deleted": {"$ne": True}})
                wps = await wps_legacy.to_list(length=1000)
            
            trip["total_waypoints"] = len(wps)
            trip["visited_count"] = sum(1 for w in wps if w.get("is_visited"))
            trip["school_count"] = sum(1 for w in wps if w.get("type") == WaypointType.SCHOOL.value)
            trip["school_visited_count"] = sum(1 for w in wps if w.get("type") == WaypointType.SCHOOL.value and w.get("is_visited"))
            
            trip["total_tickets"] = sum(
                t.get("tickets_collected", 0)
                for w in wps
                for t in w.get("tickets", [])
                if not t.get("is_deleted")
            )

        return trips

    async def update_trip(self, trip_id: str, trip_data: TripUpdate) -> Optional[dict]:
        db = get_database()
        update_dict = trip_data.model_dump(exclude_unset=True)
        if not update_dict:
            return await self.get_trip(trip_id)

        if "status" in update_dict and hasattr(update_dict["status"], 'value'):
            update_dict["status"] = update_dict["status"].value

        update_dict["updated_at"] = datetime.now(timezone.utc)
        await db.admission_trips.update_one({"id": trip_id, "is_deleted": {"$ne": True}}, {"$set": update_dict})
        return await self.get_trip(trip_id)

    async def delete_trip(self, trip_id: str) -> bool:
        """Xóa mềm chuyến đi và các điểm dừng liên quan"""
        db = get_database()
        now = datetime.now(timezone.utc)
        res = await db.admission_trips.update_one(
            {"id": trip_id, "is_deleted": {"$ne": True}},
            {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
        )
        if res.modified_count > 0:
            await db.campaign_waypoints.update_many(
                {"trip_id": trip_id, "is_deleted": {"$ne": True}},
                {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
            )
            await db.waypoints.update_many(
                {"trip_id": trip_id, "is_deleted": {"$ne": True}},
                {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
            )
            return True
        return False

    async def add_waypoint(self, trip_id: str, waypoint_data: WaypointCreate) -> Optional[dict]:
        db = get_database()
        trip = await db.admission_trips.find_one({"id": trip_id, "is_deleted": {"$ne": True}})
        if not trip:
            return None

        cursor = db.campaign_waypoints.find({"trip_id": trip_id, "is_deleted": {"$ne": True}})
        existing_wps = await cursor.to_list(length=1000)
        max_order = max([w.get("visit_order", 0) for w in existing_wps], default=0)

        cw_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        wp_data_dict = waypoint_data.model_dump(exclude_unset=True)
        if "type" in wp_data_dict and hasattr(wp_data_dict["type"], "value"):
            wp_data_dict["type"] = wp_data_dict["type"].value

        cw_doc = {
            **wp_data_dict,
            "id": cw_id,
            "trip_id": trip_id,
            "campaign_id": trip.get("campaign_id") or trip_id,
            "visit_order": max_order + 1,
            "is_visited": False,
            "visited_at": None,
            "visit_logs": [],
            "tickets": [],
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }

        await db.campaign_waypoints.insert_one(cw_doc)
        cw_doc.pop("_id", None)
        return cw_doc

    async def update_waypoint(self, waypoint_id: str, waypoint_data: WaypointUpdate) -> Optional[dict]:
        db = get_database()
        update_dict = waypoint_data.model_dump(exclude_unset=True)
        now = datetime.now(timezone.utc)
        update_dict["updated_at"] = now

        if "type" in update_dict and hasattr(update_dict["type"], "value"):
            update_dict["type"] = update_dict["type"].value

        # Cập nhật trong campaign_waypoints
        res = await db.campaign_waypoints.update_one(
            {"id": waypoint_id, "is_deleted": {"$ne": True}},
            {"$set": update_dict}
        )
        # Fallback waypoints
        if res.matched_count == 0:
            await db.waypoints.update_one(
                {"id": waypoint_id, "is_deleted": {"$ne": True}},
                {"$set": update_dict}
            )

        updated_wp = await db.campaign_waypoints.find_one({"id": waypoint_id})
        if not updated_wp:
            updated_wp = await db.waypoints.find_one({"id": waypoint_id})

        if updated_wp and updated_wp.get("school_id"):
            await sync_waypoint_to_school(db, updated_wp["school_id"], update_dict)
            
        if updated_wp:
            updated_wp.pop("_id", None)
        return updated_wp

    async def delete_waypoint(self, waypoint_id: str) -> bool:
        """Xóa mềm điểm dừng nguyên tử"""
        db = get_database()
        now = datetime.now(timezone.utc)
        res = await db.campaign_waypoints.update_one(
            {"id": waypoint_id, "is_deleted": {"$ne": True}},
            {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
        )
        if res.modified_count == 0:
            res = await db.waypoints.update_one(
                {"id": waypoint_id, "is_deleted": {"$ne": True}},
                {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
            )
        return res.modified_count > 0

    async def check_in(self, trip_id: str, checkin_data: CheckInRequest, max_distance: float = 500.0) -> CheckInResponse:
        db = get_database()
        waypoint = await db.campaign_waypoints.find_one({
            "id": checkin_data.waypoint_id,
            "trip_id": trip_id,
            "is_deleted": {"$ne": True}
        })
        if not waypoint:
            waypoint = await db.waypoints.find_one({
                "id": checkin_data.waypoint_id,
                "trip_id": trip_id,
                "is_deleted": {"$ne": True}
            })

        if not waypoint:
            return CheckInResponse(success=False, waypoint=None, message="Không tìm thấy điểm dừng")

        if waypoint.get("is_visited"):
            waypoint.pop("_id", None)
            return CheckInResponse(
                success=False,
                waypoint=waypoint,
                message="Điểm dừng này đã được check-in trước đó"
            )

        if checkin_data.lat and checkin_data.lng and not checkin_data.remote:
            dist = calculate_distance(checkin_data.lat, checkin_data.lng, waypoint["lat"], waypoint["lng"])
            if dist > max_distance:
                waypoint.pop("_id", None)
                return CheckInResponse(
                    success=False,
                    waypoint=waypoint,
                    message=f"Bạn đang cách điểm check-in {int(dist)}m. Vui lòng đến gần hơn (trong vòng {int(max_distance)}m)"
                )

        now = datetime.now(timezone.utc)
        visited_time = checkin_data.visited_at if checkin_data.visited_at else now
        
        await db.campaign_waypoints.update_one(
            {"id": checkin_data.waypoint_id},
            {"$set": {"is_visited": True, "visited_at": visited_time, "updated_at": now}}
        )
        await db.waypoints.update_one(
            {"id": checkin_data.waypoint_id},
            {"$set": {"is_visited": True, "visited_at": visited_time, "updated_at": now}}
        )

        current_lat = checkin_data.lat or waypoint["lat"]
        current_lng = checkin_data.lng or waypoint["lng"]
        await db.admission_trips.update_one(
            {"id": trip_id},
            {"$set": {"current_lat": current_lat, "current_lng": current_lng, "updated_at": now}}
        )

        updated_wp = await db.campaign_waypoints.find_one({"id": checkin_data.waypoint_id})
        if not updated_wp:
            updated_wp = await db.waypoints.find_one({"id": checkin_data.waypoint_id})

        if updated_wp:
            updated_wp.pop("_id", None)

        return CheckInResponse(
            success=True,
            waypoint=updated_wp,
            message=f"Đã check-in tại {updated_wp['name']}"
        )

    async def undo_check_in(self, trip_id: str, waypoint_id: str) -> CheckInResponse:
        db = get_database()
        waypoint = await db.campaign_waypoints.find_one({"id": waypoint_id, "trip_id": trip_id})
        if not waypoint:
            waypoint = await db.waypoints.find_one({"id": waypoint_id, "trip_id": trip_id})

        if not waypoint:
            return CheckInResponse(success=False, waypoint=None, message="Không tìm thấy điểm dừng")

        if not waypoint.get("is_visited"):
            waypoint.pop("_id", None)
            return CheckInResponse(
                success=False,
                waypoint=waypoint,
                message="Điểm dừng này chưa được check-in"
            )

        now = datetime.now(timezone.utc)
        await db.campaign_waypoints.update_one(
            {"id": waypoint_id},
            {"$set": {"is_visited": False, "visited_at": None, "updated_at": now}}
        )
        await db.waypoints.update_one(
            {"id": waypoint_id},
            {"$set": {"is_visited": False, "visited_at": None, "updated_at": now}}
        )

        updated_wp = await db.campaign_waypoints.find_one({"id": waypoint_id})
        if not updated_wp:
            updated_wp = await db.waypoints.find_one({"id": waypoint_id})
        if updated_wp:
            updated_wp.pop("_id", None)

        return CheckInResponse(
            success=True,
            waypoint=updated_wp,
            message=f"Đã hoàn tác check-in tại {updated_wp['name']}"
        )

    async def get_unvisited_waypoints(self, trip_id: str) -> List[dict]:
        db = get_database()
        cursor = db.campaign_waypoints.find({
            "trip_id": trip_id,
            "is_visited": False,
            "is_deleted": {"$ne": True}
        }).sort("visit_order", 1)
        wps = await cursor.to_list(length=1000)
        if not wps:
            cursor2 = db.waypoints.find({
                "trip_id": trip_id,
                "is_visited": False,
                "is_deleted": {"$ne": True}
            }).sort("visit_order", 1)
            wps = await cursor2.to_list(length=1000)
        for w in wps:
            w.pop("_id", None)
        return wps

    async def reset_day(self, trip_id: str, current_lat: Optional[float] = None, current_lng: Optional[float] = None) -> Optional[dict]:
        db = get_database()
        trip = await db.admission_trips.find_one({"id": trip_id, "is_deleted": {"$ne": True}})
        if not trip:
            return None

        now = datetime.now(timezone.utc)
        update_dict = {"updated_at": now}
        if current_lat and current_lng:
            update_dict["current_lat"] = current_lat
            update_dict["current_lng"] = current_lng

        await db.admission_trips.update_one({"id": trip_id}, {"$set": update_dict})
        return await self.get_trip(trip_id)


trip_service = TripService()
