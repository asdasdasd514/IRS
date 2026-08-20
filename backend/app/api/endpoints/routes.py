from fastapi import APIRouter
from app.models.schemas import RouteRequest, RouteResponse, DistanceMatrixRequest
from app.services.google_maps_service import GoogleMapsService

router = APIRouter()

@router.post("/optimize", response_model=RouteResponse)
async def optimize_route(request: RouteRequest):
    """
    Tính toán và tối ưu hóa lộ trình di chuyển các điểm trường THPT tuyển sinh lưu động
    """
    origin_dict = request.origin.dict()
    waypoints_dicts = [wp.dict() for wp in request.waypoints]
    
    result = await GoogleMapsService.get_directions(origin_dict, waypoints_dicts)
    return RouteResponse(**result)

@router.post("/distance-matrix")
async def get_distance_matrix(request: DistanceMatrixRequest):
    """
    Truy vấn ma trận khoảng cách giữa các điểm tuyển sinh với 5-Min TTL In-memory Cache
    """
    result = await GoogleMapsService.get_distance_matrix(request.origins, request.destinations)
    return result
