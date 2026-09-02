"""
Dynamic Next-Hop Routing Service
Thuật toán định tuyến bước kế tiếp động cho tuyển sinh
Uses SerpAPI for Google Maps data
"""

from serpapi import GoogleSearch
from typing import List, Optional, Tuple, Dict, Any
from app.core.config import settings
from app.schemas import NextHopCandidate, WaypointResponse
import logging
import math
import time

logger = logging.getLogger(__name__)

TIME_THRESHOLD_SECONDS = 300
AUTO_CHECKIN_RADIUS_METERS = 50
_distance_cache: Dict[Tuple[float, float, float, float], Tuple[dict, float]] = {}
CACHE_TTL_SECONDS = 300


class RoutingService:
    def __init__(self):
        self.serpapi_key = settings.SERPAPI_KEY
    
    async def find_next_hop(
        self,
        current_lat: float,
        current_lng: float,
        unvisited_waypoints: List[Any]
    ) -> Tuple[Optional[NextHopCandidate], List[NextHopCandidate]]:
        if not unvisited_waypoints:
            return None, []
        
        if not self.serpapi_key:
            return await self._find_next_hop_haversine(
                current_lat, current_lng, unvisited_waypoints
            )
        
        try:
            candidates = await self._get_distance_matrix(
                current_lat, current_lng, unvisited_waypoints
            )
            
            if not candidates:
                return None, []
            
            candidates.sort(key=lambda x: x.duration_seconds)
            
            recommended = self._apply_selection_logic(candidates)
            recommended.is_recommended = True
            
            alternatives = [c for c in candidates if c.waypoint.id != recommended.waypoint.id]
            
            return recommended, alternatives
            
        except Exception as e:
            logger.error(f"Error calling SerpAPI: {e}")
            return await self._find_next_hop_haversine(
                current_lat, current_lng, unvisited_waypoints
            )
    
    async def _get_distance_matrix(
        self,
        origin_lat: float,
        origin_lng: float,
        destinations: List[Any]
    ) -> List[NextHopCandidate]:
        candidates = []
        
        for wp in destinations:
            try:
                lat = wp.get("lat") if isinstance(wp, dict) else wp.lat
                lng = wp.get("lng") if isinstance(wp, dict) else wp.lng
                wp_name = wp.get("name") if isinstance(wp, dict) else wp.name
                
                cache_key = (
                    round(origin_lat, 5),
                    round(origin_lng, 5),
                    round(lat, 5),
                    round(lng, 5)
                )
                
                current_time = time.time()
                if cache_key in _distance_cache:
                    cached_result, cached_time = _distance_cache[cache_key]
                    if current_time - cached_time < CACHE_TTL_SECONDS:
                        results = cached_result
                    else:
                        del _distance_cache[cache_key]
                        results = None
                else:
                    results = None
                
                if results is None:
                    params = {
                        "engine": "google_maps_directions",
                        "start_coords": f"{origin_lat},{origin_lng}",
                        "end_coords": f"{lat},{lng}",
                        "api_key": self.serpapi_key,
                        "hl": "vi",
                        "gl": "vn"
                    }
                    
                    search = GoogleSearch(params)
                    results = search.get_dict()
                    _distance_cache[cache_key] = (results, current_time)
                
                if "directions" in results and len(results["directions"]) > 0:
                    direction = results["directions"][0]
                    duration_raw = direction.get("duration", "N/A")
                    distance_raw = direction.get("distance", "N/A")
                    
                    if isinstance(duration_raw, (int, float)):
                        duration_seconds = int(duration_raw)
                        hours = duration_seconds // 3600
                        minutes = (duration_seconds % 3600) // 60
                        duration_text = f"{hours} giờ {minutes} phút" if hours > 0 else f"{minutes} phút"
                    else:
                        duration_text = str(duration_raw) if duration_raw else "N/A"
                        duration_seconds = self._parse_duration(duration_text)
                    
                    if isinstance(distance_raw, (int, float)):
                        distance_meters = int(distance_raw)
                        distance_text = f"{distance_meters / 1000:.1f} km" if distance_meters >= 1000 else f"{distance_meters} m"
                    else:
                        distance_text = str(distance_raw) if distance_raw else "N/A"
                        distance_meters = self._parse_distance(distance_text)
                    
                    wp_resp = WaypointResponse.model_validate(wp) if not isinstance(wp, WaypointResponse) else wp
                    candidate = NextHopCandidate(
                        waypoint=wp_resp,
                        duration_seconds=duration_seconds,
                        duration_text=duration_text,
                        distance_meters=distance_meters,
                        distance_text=distance_text,
                        is_recommended=False
                    )
                    candidates.append(candidate)
                else:
                    distance = self._haversine(origin_lat, origin_lng, lat, lng)
                    duration_seconds = int(distance / (30 * 1000 / 3600))
                    wp_resp = WaypointResponse.model_validate(wp) if not isinstance(wp, WaypointResponse) else wp
                    candidate = NextHopCandidate(
                        waypoint=wp_resp,
                        duration_seconds=duration_seconds,
                        duration_text=f"{duration_seconds // 60} phút",
                        distance_meters=int(distance),
                        distance_text=f"{distance / 1000:.1f} km",
                        is_recommended=False
                    )
                    candidates.append(candidate)
                    
            except Exception as e:
                logger.warning(f"Error fetching directions for waypoint: {e}")
                lat = wp.get("lat") if isinstance(wp, dict) else wp.lat
                lng = wp.get("lng") if isinstance(wp, dict) else wp.lng
                distance = self._haversine(origin_lat, origin_lng, lat, lng)
                duration_seconds = int(distance / (30 * 1000 / 3600))
                wp_resp = WaypointResponse.model_validate(wp) if not isinstance(wp, WaypointResponse) else wp
                candidate = NextHopCandidate(
                    waypoint=wp_resp,
                    duration_seconds=duration_seconds,
                    duration_text=f"{duration_seconds // 60} phút",
                    distance_meters=int(distance),
                    distance_text=f"{distance / 1000:.1f} km",
                    is_recommended=False
                )
                candidates.append(candidate)
        
        return candidates
    
    def _parse_duration(self, duration_text: str) -> int:
        try:
            total_seconds = 0
            if "giờ" in duration_text or "tiếng" in duration_text:
                parts = duration_text.lower().replace("tiếng", "giờ").split("giờ")
                hours = int(''.join(filter(str.isdigit, parts[0])))
                total_seconds += hours * 3600
                if len(parts) > 1 and "phút" in parts[1]:
                    minutes = int(''.join(filter(str.isdigit, parts[1])))
                    total_seconds += minutes * 60
            elif "phút" in duration_text:
                minutes = int(''.join(filter(str.isdigit, duration_text)))
                total_seconds = minutes * 60
            else:
                total_seconds = int(''.join(filter(str.isdigit, duration_text))) * 60
            return total_seconds
        except:
            return 0
    
    def _parse_distance(self, distance_text: str) -> int:
        try:
            distance_text = distance_text.lower().replace(",", ".")
            if "km" in distance_text:
                km = float(''.join(c for c in distance_text.split("km")[0] if c.isdigit() or c == '.'))
                return int(km * 1000)
            elif "m" in distance_text:
                meters = float(''.join(c for c in distance_text.split("m")[0] if c.isdigit() or c == '.'))
                return int(meters)
            else:
                return 0
        except:
            return 0
    
    def _haversine(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lng2 - lng1)
        
        a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
    
    def _apply_selection_logic(self, candidates: List[NextHopCandidate]) -> NextHopCandidate:
        if len(candidates) < 2:
            return candidates[0]
        best = candidates[0]
        for candidate in candidates[1:]:
            time_diff = candidate.duration_seconds - best.duration_seconds
            if (time_diff <= TIME_THRESHOLD_SECONDS and candidate.distance_meters < best.distance_meters):
                best = candidate
        return best
    
    async def _find_next_hop_haversine(
        self,
        current_lat: float,
        current_lng: float,
        waypoints: List[Any]
    ) -> Tuple[Optional[NextHopCandidate], List[NextHopCandidate]]:
        candidates = []
        for wp in waypoints:
            lat = wp.get("lat") if isinstance(wp, dict) else wp.lat
            lng = wp.get("lng") if isinstance(wp, dict) else wp.lng
            distance = self._haversine(current_lat, current_lng, lat, lng)
            duration_seconds = int(distance / (30 * 1000 / 3600))
            
            wp_resp = WaypointResponse.model_validate(wp) if not isinstance(wp, WaypointResponse) else wp
            candidate = NextHopCandidate(
                waypoint=wp_resp,
                duration_seconds=duration_seconds,
                duration_text=f"{duration_seconds // 60} phút",
                distance_meters=int(distance),
                distance_text=f"{distance / 1000:.1f} km",
                is_recommended=False
            )
            candidates.append(candidate)
        
        candidates.sort(key=lambda x: x.distance_meters)
        if candidates:
            candidates[0].is_recommended = True
            return candidates[0], candidates[1:]
        return None, []
    
    def check_auto_checkin(
        self,
        current_lat: float,
        current_lng: float,
        waypoint_lat: float,
        waypoint_lng: float,
        radius_meters: int = AUTO_CHECKIN_RADIUS_METERS
    ) -> bool:
        distance = self._haversine(current_lat, current_lng, waypoint_lat, waypoint_lng)
        return distance <= radius_meters
    
    async def get_directions(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float
    ) -> Optional[dict]:
        if not self.serpapi_key:
            return None
        
        try:
            params = {
                "engine": "google_maps_directions",
                "start_coords": f"{origin_lat},{origin_lng}",
                "end_coords": f"{dest_lat},{dest_lng}",
                "api_key": self.serpapi_key,
                "hl": "vi",
                "gl": "vn"
            }
            
            search = GoogleSearch(params)
            results = search.get_dict()
            
            if "directions" not in results or len(results["directions"]) == 0:
                return None
            
            direction = results["directions"][0]
            steps = []
            if "legs" in results and len(results["legs"]) > 0:
                leg = results["legs"][0]
                for step in leg.get("steps", []):
                    steps.append({
                        "instruction": step.get("instructions", ""),
                        "distance": step.get("distance", ""),
                        "duration": step.get("duration", "")
                    })
            
            return {
                "polyline": results.get("overview_polyline", ""),
                "duration_text": direction.get("duration", ""),
                "distance_text": direction.get("distance", ""),
                "steps": steps
            }
            
        except Exception as e:
            logger.error(f"Error getting directions from SerpAPI: {e}")
            return None


routing_service = RoutingService()
