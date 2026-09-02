"""
Trip API Endpoints - Quản lý chuyến đi tuyển sinh (MongoDB IRS)
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks

logger = logging.getLogger(__name__)

from app.schemas import (
    TripCreate, TripUpdate, TripResponse, TripListResponse,
    WaypointCreate, WaypointUpdate, WaypointResponse,
    CheckInRequest, CheckInResponse,
    NextHopRequest, NextHopResponse,
    ReportResponse, ReportListResponse, ReportCreate
)
from app.services.trip_service import trip_service
from app.services.routing_service import routing_service
from app.services.maps_service import parse_google_maps_link, GoogleMapsParseError
from app.services.auth_service import get_current_user
from app.services.places_service import places_service
from app.services import report_service

router = APIRouter(prefix="/trips", tags=["Trips"])


@router.get("/search-nearby-places")
async def search_nearby_places(
    lat: float = Query(..., description="Vĩ độ vị trí hiện tại"),
    lng: float = Query(..., description="Kinh độ vị trí hiện tại"),
    query: str = Query("quán ăn nhà hàng khách sạn", description="Từ khóa tìm kiếm"),
    radius: int = Query(5000, description="Bán kính tìm kiếm (mét)", ge=100, le=50000),
    current_user: dict = Depends(get_current_user)
):
    try:
        places = places_service.search_nearby_places(lat, lng, query, radius)
        return {
            "success": True,
            "total": len(places),
            "places": places
        }
    except Exception as e:
        logger.error(f"Error in search_nearby_places endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tìm kiếm: {str(e)}"
        )


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    trip_data: TripCreate,
    current_user: dict = Depends(get_current_user)
):
    trip = await trip_service.create_trip(trip_data)
    return trip


@router.get("", response_model=List[TripListResponse])
async def get_trips(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    trips = await trip_service.get_trips(status)
    return [TripListResponse(**t) for t in trips]


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    trip = await trip_service.get_trip(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )
    return trip


@router.patch("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: str,
    trip_data: TripUpdate,
    current_user: dict = Depends(get_current_user)
):
    trip = await trip_service.update_trip(trip_id, trip_data)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )
    return trip


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    success = await trip_service.delete_trip(trip_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )


# === Waypoint Endpoints ===

@router.post("/{trip_id}/waypoints", response_model=WaypointResponse, status_code=status.HTTP_201_CREATED)
async def add_waypoint(
    trip_id: str,
    waypoint_data: WaypointCreate
):
    waypoint = await trip_service.add_waypoint(trip_id, waypoint_data)
    if not waypoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )
    return WaypointResponse.model_validate(waypoint)


@router.patch("/{trip_id}/waypoints/{waypoint_id}", response_model=WaypointResponse)
async def update_waypoint(
    trip_id: str,
    waypoint_id: str,
    waypoint_data: WaypointUpdate
):
    waypoint = await trip_service.update_waypoint(waypoint_id, waypoint_data)
    if not waypoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy điểm dừng"
        )
    return WaypointResponse.model_validate(waypoint)


@router.delete("/{trip_id}/waypoints/{waypoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_waypoint(
    trip_id: str,
    waypoint_id: str
):
    success = await trip_service.delete_waypoint(waypoint_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy điểm dừng"
        )


# === Routing Endpoints ===

@router.post("/{trip_id}/next-hop", response_model=NextHopResponse)
async def get_next_hop(
    trip_id: str,
    request: NextHopRequest
):
    unvisited = await trip_service.get_unvisited_waypoints(trip_id)
    if not unvisited:
        return NextHopResponse(
            recommended=None,
            alternatives=[],
            total_unvisited=0,
            message="Đã hoàn thành tất cả các điểm dừng!"
        )
    
    recommended, alternatives = await routing_service.find_next_hop(
        request.current_lat,
        request.current_lng,
        unvisited
    )
    
    await trip_service.update_trip(
        trip_id,
        TripUpdate(current_lat=request.current_lat, current_lng=request.current_lng)
    )
    
    return NextHopResponse(
        recommended=recommended,
        alternatives=alternatives,
        total_unvisited=len(unvisited),
        message=f"Gợi ý: {recommended.waypoint.name}" if recommended else ""
    )


@router.post("/{trip_id}/check-in", response_model=CheckInResponse)
async def check_in(
    trip_id: str,
    request: CheckInRequest
):
    result = await trip_service.check_in(trip_id, request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )
    return result


@router.post("/{trip_id}/undo-check-in", response_model=CheckInResponse)
async def undo_check_in(
    trip_id: str,
    waypoint_id: str = Query(..., description="ID của waypoint cần undo"),
    current_user: dict = Depends(get_current_user)
):
    result = await trip_service.undo_check_in(trip_id, waypoint_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )
    return result


@router.post("/{trip_id}/reset-day", response_model=TripResponse)
async def reset_day(
    trip_id: str,
    hotel_lat: Optional[float] = None,
    hotel_lng: Optional[float] = None
):
    trip = await trip_service.reset_day(trip_id, hotel_lat, hotel_lng)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )
    return trip


@router.post("/{trip_id}/go-hotel")
async def go_to_hotel(
    trip_id: str,
    current_lat: float,
    current_lng: float
):
    trip = await trip_service.get_trip(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy chuyến đi"
        )
    
    if not trip.get("hotel_lat") or not trip.get("hotel_lng"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chưa cài đặt vị trí khách sạn"
        )
    
    directions = await routing_service.get_directions(
        current_lat, current_lng,
        trip["hotel_lat"], trip["hotel_lng"]
    )
    
    return {
        "hotel_name": trip.get("hotel_name"),
        "hotel_lat": trip.get("hotel_lat"),
        "hotel_lng": trip.get("hotel_lng"),
        "directions": directions
    }


@router.get("/{trip_id}/directions")
async def get_directions(
    trip_id: str,
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...)
):
    return await routing_service.get_directions(origin_lat, origin_lng, dest_lat, dest_lng)


# === Maps Parser Endpoint ===

@router.post("/utils/parse-maps-link")
async def parse_maps_link(request: dict):
    try:
        link = request.get("link")
        if not link:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vui lòng cung cấp link Google Maps"
            )
        
        latitude, longitude = parse_google_maps_link(link)
        return {
            "success": True,
            "latitude": latitude,
            "longitude": longitude
        }
    except GoogleMapsParseError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Lỗi khi parse link: {str(e)}")


# === Report Endpoints ===

@router.get("/reports/all", response_model=List[ReportListResponse])
async def get_all_reports(current_user: dict = Depends(get_current_user)):
    reports = await report_service.get_all_reports()
    return [ReportListResponse(**r) for r in reports]


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    success = await report_service.delete_report(report_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy báo cáo")


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    report = await report_service.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy báo cáo")
    return ReportResponse.model_validate(report)


@router.post("/{trip_id}/reports", response_model=dict, status_code=status.HTTP_201_CREATED)
async def generate_report(
    trip_id: str,
    background_tasks: BackgroundTasks,
    request: Optional[ReportCreate] = None,
    current_user: dict = Depends(get_current_user)
):
    trip = await trip_service.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chuyến đi không tồn tại")
    
    created_at = request.created_at if request else None
    job = await report_service.start_report_generation_job(trip_id, created_at)
    
    background_tasks.add_task(
        report_service.process_report_job_background,
        job["id"],
        trip_id
    )
    return {"job_id": job["id"]}


@router.get("/{trip_id}/reports", response_model=List[ReportResponse])
async def get_trip_reports(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    reports = await report_service.get_trip_reports(trip_id)
    return [ReportResponse.model_validate(r) for r in reports]


@router.get("/reports/jobs/{job_id}", response_model=dict)
async def get_report_job_status(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    job = await report_service.get_report_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job không tồn tại")
    
    return {
        "id": job["id"],
        "trip_id": job["trip_id"],
        "status": job["status"],
        "progress": job["progress"],
        "result_report_id": job.get("result_report_id"),
        "error_message": job.get("error_message"),
        "created_at": job["created_at"].isoformat() if hasattr(job["created_at"], 'isoformat') else str(job["created_at"]),
        "updated_at": job["updated_at"].isoformat() if hasattr(job["updated_at"], 'isoformat') else str(job["updated_at"])
    }
