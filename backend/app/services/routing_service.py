"""
Dynamic Next-Hop Routing Service
Thuật toán định tuyến bước kế tiếp động cho tuyển sinh
Uses SerpAPI for Google Maps data
"""

from serpapi import GoogleSearch
from typing import List, Optional, Tuple, Dict, Any
from app.core.config import settings
from app.core.cache import distance_matrix_cache, directions_cache
from app.schemas import NextHopCandidate, WaypointResponse
import logging
import math
import time
import polyline

logger = logging.getLogger(__name__)

TIME_THRESHOLD_SECONDS = 300
AUTO_CHECKIN_RADIUS_METERS = 50


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
                
                # Cache key làm tròn 4 chữ số thập phân (~11m sai số) để hạn chế trượt cache do rung lắc GPS
                cache_key = f"{round(origin_lat, 4)},{round(origin_lng, 4)}->{round(lat, 4)},{round(lng, 4)}"
                results = distance_matrix_cache.get(cache_key)
                
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
                    distance_matrix_cache.set(cache_key, results, ttl=300)
                else:
                    logger.info(f"⚡ [Cache Hit Distance Matrix]: {cache_key}")
                
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
    
    def get_osrm_multi_route(self, points: List[Tuple[float, float]]) -> Optional[dict]:
        """
        Truy vấn định tuyến đường bộ thực tế qua OSRM (Open Source Routing Machine).
        points: [(lat, lng), ...]
        Returns: {
            "distance_meters": float,
            "duration_seconds": int,
            "duration_text": str,
            "route_geometry": List[List[float]], # [[lat, lng], ...]
            "polyline": str,
            "legs": List[dict]
        }
        """
        if len(points) < 2:
            return None
        
        cache_key = "osrm:" + ";".join(f"{round(p[0], 4)},{round(p[1], 4)}" for p in points)
        cached = directions_cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            import urllib.request
            import json

            # OSRM expects {lng},{lat}
            coords_str = ";".join(f"{p[1]},{p[0]}" for p in points)
            url = f"http://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson"
            req = urllib.request.Request(url, headers={"User-Agent": "IRS-Admissions-App/1.0"})
            
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
            
            if not data.get("routes"):
                return None
            
            route = data["routes"][0]
            dist_m = float(route.get("distance", 0.0))
            
            # Convert [lng, lat] GeoJSON to [lat, lng] for Leaflet
            coords = [[c[1], c[0]] for c in route.get("geometry", {}).get("coordinates", [])]
            encoded = polyline.encode(coords) if coords else ""
            
            # Vận tốc lái xe thực tế tại VN: ~25.5 km/h (đô thị / liên huyện Biên Hòa - Đồng Nai)
            speed_mps = 25.5 * 1000 / 3600
            total_dur_s = int(dist_m / speed_mps) if speed_mps > 0 else int(route.get("duration", 0))
            
            # Xử lý từng chặng (legs)
            processed_legs = []
            for leg in route.get("legs", []):
                leg_dist = float(leg.get("distance", 0.0))
                leg_dur = int(leg_dist / speed_mps) if speed_mps > 0 else int(leg.get("duration", 0))
                processed_legs.append({
                    "distance_meters": leg_dist,
                    "duration_seconds": leg_dur,
                    "distance_text": f"{leg_dist / 1000:.1f} km" if leg_dist >= 1000 else f"{int(leg_dist)} m",
                    "duration_text": self._format_duration_text(leg_dur)
                })
            
            res = {
                "distance_meters": dist_m,
                "duration_seconds": total_dur_s,
                "duration_text": self._format_duration_text(total_dur_s),
                "route_geometry": coords,
                "polyline": encoded,
                "legs": processed_legs
            }
            directions_cache.set(cache_key, res, ttl=300)
            return res
        except Exception as e:
            logger.warning(f"Error fetching route from OSRM: {e}")
            return None

    def _format_duration_text(self, duration_seconds: int) -> str:
        if duration_seconds < 60:
            return "1 phút"
        minutes = round(duration_seconds / 60)
        if minutes < 60:
            return f"{minutes} phút"
        hours = minutes // 60
        rem_mins = minutes % 60
        if rem_mins == 0:
            return f"{hours} giờ"
        return f"{hours} giờ {rem_mins} phút"

    async def get_directions(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float
    ) -> Optional[dict]:
        # Kiểm tra Cache 5 phút cho yêu cầu chỉ đường cùng cặp tọa độ
        cache_key = f"{round(origin_lat, 4)},{round(origin_lng, 4)}->{round(dest_lat, 4)},{round(dest_lng, 4)}"
        cached_result = directions_cache.get(cache_key)
        if cached_result is not None:
            logger.info(f"⚡ [Cache Hit Directions]: {cache_key}")
            return cached_result
        
        # 1. Thử SerpAPI nếu có cấu hình
        if self.serpapi_key:
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
                
                if "directions" in results and len(results["directions"]) > 0:
                    direction = results["directions"][0]
                    duration_text = (
                        direction.get("formatted_duration")
                        or direction.get("duration_text")
                        or (f"{direction.get('duration')} giây" if isinstance(direction.get("duration"), (int, float)) else str(direction.get("duration", "")))
                    )
                    distance_text = (
                        direction.get("formatted_distance")
                        or direction.get("distance_text")
                        or (f"{direction.get('distance')} m" if isinstance(direction.get("distance"), (int, float)) else str(direction.get("distance", "")))
                    )
                    
                    steps = []
                    coords = [(origin_lat, origin_lng)]
                    for trip in direction.get("trips", []):
                        for step in trip.get("details", []):
                            steps.append({
                                "instruction": step.get("title") or step.get("action") or "",
                                "distance": step.get("formatted_distance") or str(step.get("distance", "")),
                                "duration": step.get("formatted_duration") or str(step.get("duration", ""))
                            })
                            gps = step.get("gps_coordinates")
                            if gps and isinstance(gps, dict) and "latitude" in gps and "longitude" in gps:
                                coords.append((float(gps["latitude"]), float(gps["longitude"])))
                    coords.append((dest_lat, dest_lng))
                    
                    encoded_polyline = results.get("overview_polyline", "")
                    if not encoded_polyline and len(coords) >= 2:
                        try:
                            encoded_polyline = polyline.encode(coords)
                        except Exception as enc_err:
                            logger.warning(f"Error encoding polyline: {enc_err}")
                    
                    direction_result = {
                        "polyline": encoded_polyline,
                        "route_geometry": coords,
                        "duration_text": duration_text,
                        "distance_text": distance_text,
                        "steps": steps
                    }
                    directions_cache.set(cache_key, direction_result, ttl=300)
                    return direction_result
            except Exception as e:
                logger.warning(f"SerpAPI directions failed, falling back to OSRM: {e}")

        # 2. Định tuyến đường bộ OSRM (chính xác theo bản đồ thực tế)
        osrm_res = self.get_osrm_multi_route([(origin_lat, origin_lng), (dest_lat, dest_lng)])
        if osrm_res:
            direction_result = {
                "polyline": osrm_res["polyline"],
                "route_geometry": osrm_res["route_geometry"],
                "duration_text": osrm_res["duration_text"],
                "distance_text": f"{osrm_res['distance_meters'] / 1000:.1f} km" if osrm_res['distance_meters'] >= 1000 else f"{int(osrm_res['distance_meters'])} m",
                "steps": []
            }
            directions_cache.set(cache_key, direction_result, ttl=300)
            return direction_result

        return None

    def plan_dynamic_next_hop_route(
        self,
        start_point: Dict[str, float],
        destinations: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], float, int, List[List[float]], str, str]:
        """
        Thuật toán Định tuyến Bước Kế tiếp Động (Dynamic Next-Hop Routing) cho Tuyển sinh:
        - Tối ưu hóa thứ tự ghé thăm trường theo hàm mục tiêu Next-Hop.
        - Tích hợp động cơ đường bộ OSRM: vẽ đường uốn lượn thực tế như Google Maps.
        - Tính thời gian di chuyển chuẩn xác theo vận tốc giao thông Việt Nam (~25.5 km/h).
        - KHÔNG cộng dồn thời gian tư vấn 45 phút vào thời gian di chuyển.
        
        Output:
            Tuple[ordered_destinations, total_distance_meters, total_duration_seconds, route_geometry, polyline, duration_text]
        """
        if not destinations:
            return [], 0.0, 0, [], "", "0 phút"

        unvisited = list(destinations)
        ordered = []
        curr_lat, curr_lng = start_point["lat"], start_point["lng"]

        def get_dest_priority(dest_dict: Dict[str, Any]) -> int:
            p = dest_dict.get("priority")
            if p is not None:
                try:
                    val = int(p)
                    if val > 0:
                        return val
                except (ValueError, TypeError):
                    pass
            return 999999

        # 1. Áp dụng thuật toán Priority-Aware Dynamic Next-Hop để xác định thứ tự ghé thăm tối ưu
        # Trường có độ ưu tiên nhỏ hơn (1 > 2 > 3...) sẽ được ưu tiên đi trước tiên, sau đó tới các trường tự động
        while unvisited:
            min_priority = min(get_dest_priority(d) for d in unvisited)
            priority_pool = [d for d in unvisited if get_dest_priority(d) == min_priority]

            candidates = []
            for dest in priority_pool:
                d_lat = dest.get("lat", 0.0)
                d_lng = dest.get("lng", 0.0)
                dist_m = self._haversine(curr_lat, curr_lng, d_lat, d_lng)
                dur_s = int(dist_m / (25.5 * 1000 / 3600))
                candidates.append({
                    "dest": dest,
                    "distance_meters": dist_m,
                    "duration_seconds": dur_s
                })

            candidates.sort(key=lambda x: x["duration_seconds"])

            # Ra quyết định Next-Hop
            best = candidates[0]
            for cand in candidates[1:]:
                time_diff = cand["duration_seconds"] - best["duration_seconds"]
                if time_diff <= TIME_THRESHOLD_SECONDS and cand["distance_meters"] < best["distance_meters"]:
                    best = cand

            chosen_dest = dict(best["dest"])
            unvisited.remove(best["dest"])
            ordered.append(chosen_dest)
            curr_lat, curr_lng = chosen_dest["lat"], chosen_dest["lng"]

        # 2. Truy vấn định tuyến đường bộ thực tế qua OSRM (Google Maps-like actual roads)
        all_pts = [(start_point["lat"], start_point["lng"])] + [(d["lat"], d["lng"]) for d in ordered]
        osrm_result = self.get_osrm_multi_route(all_pts)

        if osrm_result and osrm_result.get("route_geometry"):
            total_distance = osrm_result["distance_meters"]
            total_duration = osrm_result["duration_seconds"]
            route_geometry = osrm_result["route_geometry"]
            encoded_polyline = osrm_result["polyline"]
            duration_text = osrm_result["duration_text"]

            # Gán cự ly và thời gian thực tế từng chặng cho từng điểm đến
            legs = osrm_result.get("legs", [])
            for idx, leg in enumerate(legs):
                if idx < len(ordered):
                    ordered[idx]["distance_meters"] = leg["distance_meters"]
                    ordered[idx]["duration_seconds"] = leg["duration_seconds"]
                    ordered[idx]["distance_text"] = leg["distance_text"]
                    ordered[idx]["duration_text"] = leg["duration_text"]

            return ordered, total_distance, total_duration, route_geometry, encoded_polyline, duration_text

        # 3. Fallback: Nếu OSRM tạm thời gián đoạn, tính xấp xỉ theo mạng lưới đường bộ (hệ số 1.25x)
        speed_mps = 25.5 * 1000 / 3600
        total_distance = 0.0
        c_lat, c_lng = start_point["lat"], start_point["lng"]
        route_geometry = [[c_lat, c_lng]]

        for d in ordered:
            d_lat, d_lng = d["lat"], d["lng"]
            leg_dist = self._haversine(c_lat, c_lng, d_lat, d_lng) * 1.25
            leg_dur = int(leg_dist / speed_mps)
            d["distance_meters"] = leg_dist
            d["duration_seconds"] = leg_dur
            d["distance_text"] = f"{leg_dist / 1000:.1f} km"
            d["duration_text"] = self._format_duration_text(leg_dur)
            total_distance += leg_dist
            route_geometry.append([d_lat, d_lng])
            c_lat, c_lng = d_lat, d_lng

        total_duration = int(total_distance / speed_mps)
        encoded_polyline = polyline.encode(route_geometry) if len(route_geometry) >= 2 else ""
        duration_text = self._format_duration_text(total_duration)

        return ordered, total_distance, total_duration, route_geometry, encoded_polyline, duration_text


routing_service = RoutingService()

