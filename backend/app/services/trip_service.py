"""
Trip Service - Business logic for managing admission trips (MongoDB IRS Database)
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


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Tính khoảng cách giữa 2 điểm GPS theo công thức Haversine (mét)"""
    R = 6371000
    lat1_rad, lat2_rad = radians(lat1), radians(lat2)
    delta_lat, delta_lng = radians(lat2 - lat1), radians(lng2 - lng1)
    
    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


class TripService:
    async def create_trip(self, trip_data: TripCreate) -> dict:
        db = get_database()
        trip_id = str(uuid.uuid4())
        now = datetime.utcnow()

        trip_doc = {
            "id": trip_id,
            "name": trip_data.name,
            "status": TripStatus.ACTIVE.value,
            "current_lat": trip_data.current_lat,
            "current_lng": trip_data.current_lng,
            "hotel_lat": trip_data.hotel_lat,
            "hotel_lng": trip_data.hotel_lng,
            "hotel_name": trip_data.hotel_name,
            "created_at": now,
            "updated_at": now
        }
        await db.admission_trips.insert_one(trip_doc)

        waypoints_docs = []
        for i, wp_data in enumerate(trip_data.waypoints):
            wp_doc = {
                "id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "name": wp_data.name,
                "lat": wp_data.lat,
                "lng": wp_data.lng,
                "google_place_id": wp_data.google_place_id,
                "address": wp_data.address,
                "type": wp_data.type.value if hasattr(wp_data.type, 'value') else str(wp_data.type),
                "notes": wp_data.notes,
                "contact_name": wp_data.contact_name,
                "contact_phone": wp_data.contact_phone,
                "visit_order": i + 1,
                "is_visited": False,
                "visited_at": None,
                "created_at": now
            }
            waypoints_docs.append(wp_doc)

        if waypoints_docs:
            await db.waypoints.insert_many(waypoints_docs)

        return await self.get_trip(trip_id)

    async def get_trip(self, trip_id: str) -> Optional[dict]:
        db = get_database()
        trip = await db.admission_trips.find_one({"id": trip_id, "is_deleted": {"$ne": True}})
        if not trip:
            return None

        cursor = db.waypoints.find({"trip_id": trip_id, "is_deleted": {"$ne": True}}).sort("visit_order", 1)
        waypoints = await cursor.to_list(length=1000)
        
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
            wps_cursor = db.waypoints.find({"trip_id": trip["id"], "is_deleted": {"$ne": True}})
            wps = await wps_cursor.to_list(length=1000)
            
            trip["total_waypoints"] = len(wps)
            trip["visited_count"] = sum(1 for w in wps if w.get("is_visited"))
            trip["school_count"] = sum(1 for w in wps if w.get("type") == WaypointType.SCHOOL.value)
            trip["school_visited_count"] = sum(1 for w in wps if w.get("type") == WaypointType.SCHOOL.value and w.get("is_visited"))
            
            # Count total tickets collected directly from embedded tickets array
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

        update_dict["updated_at"] = datetime.utcnow()
        await db.admission_trips.update_one({"id": trip_id, "is_deleted": {"$ne": True}}, {"$set": update_dict})
        return await self.get_trip(trip_id)

    async def delete_trip(self, trip_id: str) -> bool:
        """Xóa mềm chuyến đi và các điểm dừng liên quan"""
        db = get_database()
        now = datetime.utcnow()
        res = await db.admission_trips.update_one(
            {"id": trip_id, "is_deleted": {"$ne": True}},
            {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
        )
        if res.modified_count > 0:
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

        cursor = db.waypoints.find({"trip_id": trip_id, "is_deleted": {"$ne": True}})
        existing_wps = await cursor.to_list(length=1000)
        max_order = max([w.get("visit_order", 0) for w in existing_wps], default=0)

        wp_id = str(uuid.uuid4())
        now = datetime.utcnow()
        wp_data_dict = waypoint_data.model_dump(exclude_unset=True)
        if "type" in wp_data_dict and hasattr(wp_data_dict["type"], "value"):
            wp_data_dict["type"] = wp_data_dict["type"].value

        # Tự động đồng bộ từ danh mục trường nếu có school_id
        if waypoint_data.school_id:
            school = await db.schools.find_one({"$or": [{"id": waypoint_data.school_id}, {"code": waypoint_data.school_id}]})
            if school:
                if not wp_data_dict.get("description"):
                    wp_data_dict["description"] = school.get("description")
                if school.get("school_board"):
                    sb = school["school_board"]
                    if not wp_data_dict.get("principal_name"):
                        wp_data_dict["principal_name"] = sb.get("principal_name")
                    if not wp_data_dict.get("principal_phone"):
                        wp_data_dict["principal_phone"] = sb.get("principal_phone")
                    if not wp_data_dict.get("vice_principal_name"):
                        wp_data_dict["vice_principal_name"] = sb.get("vice_principal_name")
                    if not wp_data_dict.get("vice_principal_phone"):
                        wp_data_dict["vice_principal_phone"] = sb.get("vice_principal_phone")

        wp_doc = {
            **wp_data_dict,
            "id": wp_id,
            "trip_id": trip_id,
            "visit_order": max_order + 1,
            "is_visited": False,
            "visited_at": None,
            "visit_logs": [],
            "tickets": [],
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }

        await db.waypoints.insert_one(wp_doc)
        return wp_doc

    async def update_waypoint(self, waypoint_id: str, waypoint_data: WaypointUpdate) -> Optional[dict]:
        db = get_database()
        update_dict = waypoint_data.model_dump(exclude_unset=True)
        if not update_dict:
            return await db.waypoints.find_one({"id": waypoint_id, "is_deleted": {"$ne": True}})

        if "type" in update_dict and hasattr(update_dict["type"], "value"):
            update_dict["type"] = update_dict["type"].value

        update_dict["updated_at"] = datetime.utcnow()
        await db.waypoints.update_one({"id": waypoint_id, "is_deleted": {"$ne": True}}, {"$set": update_dict})
        return await db.waypoints.find_one({"id": waypoint_id})

    async def delete_waypoint(self, waypoint_id: str) -> bool:
        """Xóa mềm điểm dừng nguyên tử trên document duy nhất"""
        db = get_database()
        now = datetime.utcnow()
        res = await db.waypoints.update_one(
            {"id": waypoint_id, "is_deleted": {"$ne": True}},
            {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
        )
        return res.modified_count > 0


    async def check_in(self, trip_id: str, checkin_data: CheckInRequest, max_distance: float = 500.0) -> CheckInResponse:
        db = get_database()
        waypoint = await db.waypoints.find_one({
            "id": checkin_data.waypoint_id,
            "trip_id": trip_id,
            "is_deleted": {"$ne": True}
        })

        if not waypoint:
            return CheckInResponse(success=False, waypoint=None, message="Không tìm thấy điểm dừng")

        if waypoint.get("is_visited"):
            return CheckInResponse(
                success=False,
                waypoint=WaypointResponse.model_validate(waypoint),
                message="Điểm dừng này đã được check-in trước đó"
            )

        if checkin_data.lat and checkin_data.lng and not checkin_data.remote:
            dist = calculate_distance(checkin_data.lat, checkin_data.lng, waypoint["lat"], waypoint["lng"])
            if dist > max_distance:
                return CheckInResponse(
                    success=False,
                    waypoint=WaypointResponse.model_validate(waypoint),
                    message=f"Bạn đang cách điểm check-in {int(dist)}m. Vui lòng đến gần hơn (trong vòng {int(max_distance)}m)"
                )

        visited_time = checkin_data.visited_at if checkin_data.visited_at else datetime.utcnow()
        await db.waypoints.update_one(
            {"id": checkin_data.waypoint_id},
            {"$set": {"is_visited": True, "visited_at": visited_time}}
        )

        current_lat = checkin_data.lat or waypoint["lat"]
        current_lng = checkin_data.lng or waypoint["lng"]
        await db.admission_trips.update_one(
            {"id": trip_id},
            {"$set": {"current_lat": current_lat, "current_lng": current_lng, "updated_at": datetime.utcnow()}}
        )

        updated_wp = await db.waypoints.find_one({"id": checkin_data.waypoint_id})
        return CheckInResponse(
            success=True,
            waypoint=WaypointResponse.model_validate(updated_wp),
            message=f"Đã check-in tại {updated_wp['name']}"
        )

    async def undo_check_in(self, trip_id: str, waypoint_id: str) -> CheckInResponse:
        db = get_database()
        waypoint = await db.waypoints.find_one({"id": waypoint_id, "trip_id": trip_id})

        if not waypoint:
            return CheckInResponse(success=False, waypoint=None, message="Không tìm thấy điểm dừng")

        if not waypoint.get("is_visited"):
            return CheckInResponse(
                success=False,
                waypoint=WaypointResponse.model_validate(waypoint),
                message="Điểm dừng này chưa được check-in"
            )

        await db.waypoints.update_one(
            {"id": waypoint_id},
            {"$set": {"is_visited": False, "visited_at": None}}
        )

        updated_wp = await db.waypoints.find_one({"id": waypoint_id})
        return CheckInResponse(
            success=True,
            waypoint=WaypointResponse.model_validate(updated_wp),
            message=f"Đã hoàn tác check-in tại {updated_wp['name']}"
        )

    async def get_unvisited_waypoints(self, trip_id: str) -> List[dict]:
        db = get_database()
        cursor = db.waypoints.find({
            "trip_id": trip_id,
            "is_visited": False,
            "type": WaypointType.SCHOOL.value
        }).sort("visit_order", 1)
        return await cursor.to_list(length=1000)

    async def reset_day(self, trip_id: str, hotel_lat: Optional[float] = None, hotel_lng: Optional[float] = None) -> Optional[dict]:
        db = get_database()
        trip = await db.admission_trips.find_one({"id": trip_id})
        if not trip:
            return None

        update_dict = {"updated_at": datetime.utcnow()}
        if hotel_lat and hotel_lng:
            update_dict["current_lat"] = hotel_lat
            update_dict["current_lng"] = hotel_lng
            update_dict["hotel_lat"] = hotel_lat
            update_dict["hotel_lng"] = hotel_lng
        elif trip.get("hotel_lat") and trip.get("hotel_lng"):
            update_dict["current_lat"] = trip.get("hotel_lat")
            update_dict["current_lng"] = trip.get("hotel_lng")

        await db.admission_trips.update_one({"id": trip_id}, {"$set": update_dict})
        return await self.get_trip(trip_id)


trip_service = TripService()
