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

        candidates = []
        for wp in unvisited_waypoints:
            try:
                lat = float(wp.get("lat") if isinstance(wp, dict) else getattr(wp, "lat", 0.0))
                lng = float(wp.get("lng") if isinstance(wp, dict) else getattr(wp, "lng", 0.0))

                # Tính toán lộ trình thực tế từ vị trí hiện tại đến điểm dừng qua OSRM
                single_leg = self.get_osrm_single_leg_optimized((current_lat, current_lng), (lat, lng))
                if single_leg and single_leg.get("distance_meters"):
                    dist_m = float(single_leg["distance_meters"])
                    dur_s = int(single_leg["duration_seconds"])
                    dist_txt = single_leg["distance_text"]
                    dur_txt = single_leg["duration_text"]
                else:
                    dist_m = self._haversine(current_lat, current_lng, lat, lng) * 1.25
                    speed_mps = 25.5 * 1000 / 3600
                    dur_s = int(dist_m / speed_mps)
                    dist_txt = f"{dist_m / 1000:.1f} km" if dist_m >= 1000 else f"{int(dist_m)} m"
                    dur_txt = self._format_duration_text(dur_s)

                wp_resp = WaypointResponse.model_validate(wp) if not isinstance(wp, WaypointResponse) else wp
                candidate = NextHopCandidate(
                    waypoint=wp_resp,
                    duration_seconds=dur_s,
                    duration_text=dur_txt,
                    distance_meters=int(dist_m),
                    distance_text=dist_txt,
                    is_recommended=False
                )
                candidates.append(candidate)
            except Exception as e:
                logger.warning(f"Error computing candidate for waypoint {wp}: {e}")

        if not candidates:
            return None, []

        # Tối ưu hóa thứ tự: Tôn trọng kế hoạch lộ trình đã định (visit_order hoặc preferred_visit_time)
        def get_itinerary_priority(c: NextHopCandidate):
            wp = c.waypoint
            wp_type = getattr(wp, "type", None)
            if wp_type is None and isinstance(wp, dict):
                wp_type = wp.get("type")
            elif hasattr(wp, "model_dump"):
                wp_type = wp.model_dump().get("type")
            if hasattr(wp_type, "value"):
                wp_type = wp_type.value

            # Điểm dừng chân / Quán ăn (REST_STOP) được ưu tiên hàng đầu để xe rẽ vào ăn uống ngay lập tức (lên đỏ)
            is_rest_stop = 0 if str(wp_type).upper() == "REST_STOP" else 1

            # 1. Giờ hẹn đến trường (preferred_visit_time)
            time_mins = None
            pref_time = getattr(wp, "preferred_visit_time", None) or (wp.model_dump().get("preferred_visit_time") if hasattr(wp, "model_dump") else None)
            if pref_time and isinstance(pref_time, str) and ":" in pref_time:
                try:
                    parts = pref_time.strip().split(":")
                    time_mins = int(parts[0]) * 60 + int(parts[1])
                except Exception:
                    time_mins = None

            # 2. Thứ tự ghé thăm đã phân bổ (visit_order)
            order = getattr(wp, "visit_order", None)
            if order is None or order <= 0:
                order = 9999

            has_time = 0 if time_mins is not None else 1
            time_val = time_mins if time_mins is not None else 9999

            return (is_rest_stop, has_time, time_val, order, c.distance_meters)

        has_planned_schedule = any(
            (getattr(c.waypoint, "visit_order", 0) or 0) > 0 or getattr(c.waypoint, "preferred_visit_time", None)
            for c in candidates
        )

        if has_planned_schedule:
            candidates.sort(key=get_itinerary_priority)
        else:
            candidates.sort(key=lambda x: x.distance_meters + x.duration_seconds * 10)

        recommended = candidates[0]
        recommended.is_recommended = True
        alternatives = candidates[1:]

        return recommended, alternatives
    
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
            url = f"http://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson&steps=true"
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
            
            # Vận tốc lái xe thực tế theo mô hình giao thông Việt Nam
            total_dur_s = self.calculate_vietnam_travel_duration_seconds(dist_m)
            
            # Xử lý từng chặng (legs) với tọa độ chi tiết của từng chặng
            processed_legs = []
            for leg_idx, leg in enumerate(route.get("legs", [])):
                leg_dist = float(leg.get("distance", 0.0))
                leg_dur = self.calculate_vietnam_travel_duration_seconds(leg_dist)
                
                # Trích xuất tọa độ chi tiết của chặng từ steps
                leg_coords = []
                for step in leg.get("steps", []):
                    for c in step.get("geometry", {}).get("coordinates", []):
                        pt = [c[1], c[0]]
                        if not leg_coords or leg_coords[-1] != pt:
                            leg_coords.append(pt)
                
                processed_legs.append({
                    "leg_index": leg_idx,
                    "distance_meters": leg_dist,
                    "duration_seconds": leg_dur,
                    "distance_text": f"{leg_dist / 1000:.1f} km" if leg_dist >= 1000 else f"{int(leg_dist)} m",
                    "duration_text": self._format_duration_text(leg_dur),
                    "geometry": leg_coords
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

    def get_osrm_table_matrix(self, points: List[Tuple[float, float]]) -> Optional[dict]:
        """
        Lấy ma trận khoảng cách đường bộ thực tế (mét) và thời gian (giây) giữa tất cả các điểm
        bằng 1 request duy nhất qua OSRM Table Service.
        points: [(lat, lng), ...]
        """
        if len(points) < 2:
            return None

        cache_key = "osrm_table:" + ";".join(f"{round(p[0], 4)},{round(p[1], 4)}" for p in points)
        cached = distance_matrix_cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            import urllib.request
            import json

            coords_str = ";".join(f"{p[1]},{p[0]}" for p in points)
            url = f"http://router.project-osrm.org/table/v1/driving/{coords_str}?annotations=distance,duration"
            req = urllib.request.Request(url, headers={"User-Agent": "IRS-Admissions-App/1.0"})

            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())

            if data.get("code") == "Ok" and "distances" in data:
                res = {
                    "distances": data["distances"],
                    "durations": data.get("durations", [])
                }
                distance_matrix_cache.set(cache_key, res, ttl=600)
                return res
        except Exception as e:
            logger.warning(f"Error calling OSRM Table API: {e}")
        return None

    def solve_tsp_optimal_sequence(
        self,
        start_point: Tuple[float, float],
        destinations: List[Dict[str, Any]],
        dist_matrix: List[List[float]]
    ) -> List[int]:
        """
        Tìm thứ tự ghé thăm tối ưu toàn cục (0-indexed destinations) dựa trên ma trận khoảng cách đường bộ.
        - Tự động tôn trọng thứ tự ưu tiên (priority).
        - Nếu số điểm đến <= 8: Kiểm tra toàn bộ hoán vị (Brute-Force Permutations) để tìm lời giải tối ưu 100%.
        - Nếu số điểm đến > 8: Sử dụng thuật toán Nearest Neighbor kết hợp 2-Opt heuristic.
        """
        import itertools
        n = len(destinations)
        if n <= 1:
            return list(range(n))

        def get_priority(d: Dict[str, Any]) -> int:
            p = d.get("priority")
            if p is not None:
                try:
                    val = int(p)
                    if val > 0:
                        return val
                except (ValueError, TypeError):
                    pass
            return 999999

        # Kiểm tra xem có ràng buộc priority không
        priorities = [get_priority(d) for d in destinations]
        has_different_priorities = len(set(priorities)) > 1

        if n <= 8:
            best_perm = None
            min_score = float("inf")

            for perm in itertools.permutations(range(1, n + 1)):
                # Tính tổng quãng đường đường bộ thực tế: Start -> perm[0] -> perm[1] -> ...
                total_dist = dist_matrix[0][perm[0]]
                for i in range(len(perm) - 1):
                    total_dist += dist_matrix[perm[i]][perm[i + 1]]

                # Tie-breaker nhẹ theo priority: nếu quãng đường bằng nhau, ưu tiên thứ tự priority
                priority_penalty = 0.0
                if has_different_priorities:
                    for idx_in_perm, p_node in enumerate(perm):
                        priority_penalty += priorities[p_node - 1] * (idx_in_perm + 1) * 0.01

                score = total_dist + priority_penalty

                if score < min_score:
                    min_score = score
                    best_perm = perm

            if best_perm is not None:
                return [idx - 1 for idx in best_perm]

        # Heuristic 2-opt cho trường hợp nhiều điểm (> 8)
        # Bắt đầu bằng Nearest Neighbor
        unvisited = list(range(1, n + 1))
        curr = 0
        tour = []
        while unvisited:
            next_node = min(unvisited, key=lambda x: dist_matrix[curr][x])
            tour.append(next_node)
            unvisited.remove(next_node)
            curr = next_node

        # 2-Opt optimization
        improved = True
        while improved:
            improved = False
            for i in range(len(tour) - 1):
                for j in range(i + 1, len(tour)):
                    prev_node = 0 if i == 0 else tour[i - 1]
                    next_node = tour[j + 1] if j + 1 < len(tour) else None

                    cur_dist = dist_matrix[prev_node][tour[i]]
                    if next_node:
                        cur_dist += dist_matrix[tour[j]][next_node]

                    new_dist = dist_matrix[prev_node][tour[j]]
                    if next_node:
                        new_dist += dist_matrix[tour[i]][next_node]

                    if new_dist < cur_dist - 1e-4:
                        tour[i:j + 1] = reversed(tour[i:j + 1])
                        improved = True
                        break
                if improved:
                    break

        return [idx - 1 for idx in tour]

    def get_osrm_trip_optimal_order(
        self,
        start_point: Tuple[float, float],
        destinations: List[Tuple[float, float]]
    ) -> Optional[List[int]]:
        """
        Sử dụng OSRM Trip API (TSP solver) để tìm thứ tự ghé thăm tối ưu theo đường bộ thực tế.
        Trả về danh sách index tối ưu của destinations (0-indexed).
        start_point là điểm cố định đầu tiên (source=first).
        """
        if not destinations:
            return None

        try:
            import urllib.request
            import json

            # Build coords: start_point + all destinations
            all_points = [start_point] + list(destinations)
            coords_str = ";".join(f"{p[1]},{p[0]}" for p in all_points)

            # source=first: cố định điểm xuất phát, roundtrip=false: không quay về
            url = (
                f"http://router.project-osrm.org/trip/v1/driving/{coords_str}"
                f"?source=first&roundtrip=false&geometries=geojson&overview=full"
            )
            req = urllib.request.Request(url, headers={"User-Agent": "IRS-Admissions-App/1.0"})

            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())

            if data.get("code") != "Ok" or not data.get("trips"):
                logger.warning(f"OSRM Trip API returned non-OK: {data.get('code')}")
                return None

            # waypoints chứa thứ tự tối ưu (waypoint_index) cho mỗi điểm
            waypoints = data.get("waypoints", [])
            if not waypoints or len(waypoints) != len(all_points):
                return None

            # Tạo mapping: trip_index -> original_index
            # waypoints[i].waypoint_index = vị trí trong trip tối ưu
            trip_order = sorted(range(len(waypoints)), key=lambda i: waypoints[i].get("waypoint_index", i))

            # Bỏ start_point (index 0), trả về thứ tự destination (original index - 1)
            dest_order = [idx - 1 for idx in trip_order if idx > 0]

            logger.info(f"🗺️ [OSRM Trip TSP]: Thứ tự tối ưu destinations = {dest_order}")
            return dest_order

        except Exception as e:
            logger.warning(f"Error calling OSRM Trip API: {e}")
            return None

    def get_osrm_pairwise_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> Optional[float]:
        """
        Lấy khoảng cách đường bộ thực tế (mét) giữa 2 điểm qua OSRM Route API.
        Dùng cho Dynamic Next-Hop khi OSRM Trip API thất bại.
        """
        cache_key = f"osrm_dist:{round(lat1, 4)},{round(lng1, 4)}->{round(lat2, 4)},{round(lng2, 4)}"
        cached = distance_matrix_cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            import urllib.request
            import json

            coords_str = f"{lng1},{lat1};{lng2},{lat2}"
            url = f"http://router.project-osrm.org/route/v1/driving/{coords_str}?overview=false"
            req = urllib.request.Request(url, headers={"User-Agent": "IRS-Admissions-App/1.0"})

            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())

            if data.get("routes"):
                dist_m = float(data["routes"][0].get("distance", 0.0))
                distance_matrix_cache.set(cache_key, dist_m, ttl=600)
                return dist_m
        except Exception as e:
            logger.warning(f"Error fetching OSRM pairwise distance: {e}")

        return None

    def calculate_vietnam_travel_duration_seconds(self, distance_meters: float) -> int:
        """
        Tính toán thời gian di chuyển thực tế theo điều kiện giao thông đường bộ Việt Nam.
        Đặc thù giao thông tại VN (Biên Hòa, Bình Dương, TP.HCM và các tỉnh lân cận):
        Mật độ xe máy cao, nhiều nút giao/vòng xoay, đèn tín hiệu giao thông, xe tải container:
        - Cự ly ngắn <= 5km (nội thị, qua nhiều ngã tư đèn đỏ): Vận tốc thực tế ~22 km/h
        - Cự ly 5 - 20km (trục giao thông chính đô thị): Vận tốc thực tế ~26 km/h
        - Cự ly 20 - 50km (quốc lộ, đại lộ liên tỉnh như ĐT.743, QL13, Mỹ Phước - Tân Vạn): Vận tốc thực tế ~30 km/h
        - Cự ly > 50km (quốc lộ, cao tốc ngoài đô thị): Vận tốc thực tế ~38 km/h
        """
        if distance_meters <= 0:
            return 0
        dist_km = distance_meters / 1000.0
        if dist_km <= 5.0:
            speed_kmh = 22.0
        elif dist_km <= 20.0:
            speed_kmh = 26.0
        elif dist_km <= 50.0:
            speed_kmh = 30.0
        else:
            speed_kmh = 38.0

        speed_mps = speed_kmh * 1000.0 / 3600.0
        return max(60, int(distance_meters / speed_mps))

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

    def get_osrm_single_leg_optimized(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float]
    ) -> Optional[dict]:
        """
        Tính toán lộ trình độc lập cho 1 chặng từ p1 -> p2 qua OSRM Driving Engine.
        Áp dụng tổng quát cho mọi cặp tọa độ trên toàn quốc:
        - Gọi OSRM routing với alternatives=true để lấy các phương án đường đi thực tế.
        - Tối ưu hóa lựa chọn tuyến đường chính (đại lộ/quốc lộ lớn) có thời gian và quãng đường ngắn nhất.
        - Hiệu chỉnh thời gian di chuyển chuẩn xác theo vận tốc giao thông Việt Nam (~30 km/h thay vì vận tốc châu Âu 62 km/h của OSRM demo).
        """
        lat1, lng1 = p1
        lat2, lng2 = p2

        cache_key = f"single_leg_v4:{round(lat1, 4)},{round(lng1, 4)}->{round(lat2, 4)},{round(lng2, 4)}"
        cached = directions_cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            import urllib.request
            import json

            # Gọi OSRM Driving Engine trực tiếp cho mọi cặp tọa độ bất kỳ (hoàn toàn tổng quát cho toàn quốc)
            url = f"http://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson&steps=true&alternatives=true"
            req = urllib.request.Request(url, headers={"User-Agent": "IRS-Admissions-App/1.0"})

            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())

            routes = data.get("routes", [])
            if routes:
                best_route = min(
                    routes,
                    key=lambda r: float(r.get("distance", 0.0)) + float(r.get("duration", 0.0)) * 10.0
                )
                dist_m = float(best_route.get("distance", 0.0))
                coords = [[c[1], c[0]] for c in best_route.get("geometry", {}).get("coordinates", [])]
                
                # Tính thời gian thực tế theo mô hình giao thông Việt Nam (tránh 34km mà 34 phút do OSRM mặc định vận tốc châu Âu)
                dur_s = self.calculate_vietnam_travel_duration_seconds(dist_m)

                best_res = {
                    "distance_meters": dist_m,
                    "duration_seconds": dur_s,
                    "distance_text": f"{dist_m / 1000:.1f} km" if dist_m >= 1000 else f"{int(dist_m)} m",
                    "duration_text": self._format_duration_text(dur_s),
                    "geometry": coords
                }

                directions_cache.set(cache_key, best_res, ttl=300)
                return best_res

        except Exception as e:
            logger.warning(f"Error fetching single leg route from OSRM: {e}")

        return None

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
        
        # 1. Định tuyến đường bộ OSRM (độ chính xác cao với hàng trăm tọa độ uốn lượn theo đường phố thực tế)
        osrm_res = self.get_osrm_multi_route([(origin_lat, origin_lng), (dest_lat, dest_lng)])
        
        # 2. Nếu có SerpAPI, lấy thêm các bước chỉ dẫn (steps) văn bản chi tiết
        steps = []
        duration_text = osrm_res["duration_text"] if osrm_res else None
        distance_text = f"{osrm_res['distance_meters'] / 1000:.1f} km" if (osrm_res and osrm_res['distance_meters'] >= 1000) else (f"{int(osrm_res['distance_meters'])} m" if osrm_res else None)

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
                        or duration_text
                    )
                    distance_text = (
                        direction.get("formatted_distance")
                        or direction.get("distance_text")
                        or distance_text
                    )
                    for trip in direction.get("trips", []):
                        for step in trip.get("details", []):
                            steps.append({
                                "instruction": step.get("title") or step.get("action") or "",
                                "distance": step.get("formatted_distance") or str(step.get("distance", "")),
                                "duration": step.get("formatted_duration") or str(step.get("duration", ""))
                            })
            except Exception as e:
                logger.warning(f"SerpAPI directions steps query skipped: {e}")

        if osrm_res:
            direction_result = {
                "polyline": osrm_res["polyline"],
                "route_geometry": osrm_res["route_geometry"],
                "duration_text": duration_text or osrm_res["duration_text"],
                "distance_text": distance_text or (f"{osrm_res['distance_meters'] / 1000:.1f} km" if osrm_res['distance_meters'] >= 1000 else f"{int(osrm_res['distance_meters'])} m"),
                "steps": steps
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

        def get_dest_time_minutes(dest_dict: Dict[str, Any]) -> Optional[int]:
            t = dest_dict.get("preferred_visit_time") or dest_dict.get("preferred_time")
            if t and isinstance(t, str):
                parts = t.strip().split(":")
                if len(parts) >= 2:
                    try:
                        return int(parts[0]) * 60 + int(parts[1])
                    except (ValueError, TypeError):
                        pass
            return None

        # 1. Xác định thứ tự các điểm dừng (Destination Ordering)
        # Phân loại: Điểm có cài đặt khung giờ ghé thăm (timed) và điểm linh hoạt (flexible)
        timed_dests = [d for d in destinations if get_dest_time_minutes(d) is not None]
        flexible_dests = [d for d in destinations if get_dest_time_minutes(d) is None]

        if timed_dests:
            # Nếu người dùng có cài đặt khung giờ ghé thăm:
            # BẮT BUỘC tôn trọng mốc thời gian của người dùng theo trình tự thời gian trong ngày
            # (ví dụ: ĐH Gia Định 06:30 sáng phải đi trước, ĐH Bình Dương 16:30 chiều phải đi sau)
            timed_ordered = sorted(timed_dests, key=lambda d: get_dest_time_minutes(d))

            if not flexible_dests:
                ordered = [dict(d) for d in timed_ordered]
            else:
                # Nếu có thêm các điểm linh hoạt (không cài giờ):
                # Chèn các điểm linh hoạt vào vị trí tối ưu cự ly nhất (Cheapest Insertion)
                curr_route = [dict(d) for d in timed_ordered]
                flex_unvisited = list(flexible_dests)

                while flex_unvisited:
                    min_p = min(get_dest_priority(d) for d in flex_unvisited)
                    flex_pool = [d for d in flex_unvisited if get_dest_priority(d) == min_p]

                    best_dest = None
                    best_insert_pos = 0
                    min_extra_dist = float("inf")

                    for flex_cand in flex_pool:
                        f_lat, f_lng = flex_cand.get("lat", 0.0), flex_cand.get("lng", 0.0)

                        for pos in range(len(curr_route) + 1):
                            prev_lat = start_point["lat"] if pos == 0 else curr_route[pos - 1].get("lat", 0.0)
                            prev_lng = start_point["lng"] if pos == 0 else curr_route[pos - 1].get("lng", 0.0)

                            if pos == len(curr_route):
                                extra_dist = self._haversine(prev_lat, prev_lng, f_lat, f_lng)
                            else:
                                next_lat = curr_route[pos].get("lat", 0.0)
                                next_lng = curr_route[pos].get("lng", 0.0)
                                dist_before = self._haversine(prev_lat, prev_lng, next_lat, next_lng)
                                dist_after = (
                                    self._haversine(prev_lat, prev_lng, f_lat, f_lng)
                                    + self._haversine(f_lat, f_lng, next_lat, next_lng)
                                )
                                extra_dist = dist_after - dist_before

                            if extra_dist < min_extra_dist:
                                min_extra_dist = extra_dist
                                best_dest = flex_cand
                                best_insert_pos = pos

                    if best_dest:
                        curr_route.insert(best_insert_pos, dict(best_dest))
                        flex_unvisited.remove(best_dest)
                    else:
                        break

                ordered = curr_route
        else:
            # Nếu KHÔNG có trường nào cài giờ cụ thể (Linh hoạt hoàn toàn):
            # Tối ưu hóa toàn cục cự ly ngắn nhất theo ma trận đường bộ OSRM (Global TSP Road Solver)
            all_matrix_pts = [(curr_lat, curr_lng)] + [(d.get("lat", 0.0), d.get("lng", 0.0)) for d in unvisited]
            matrix_res = self.get_osrm_table_matrix(all_matrix_pts)

            if matrix_res and matrix_res.get("distances"):
                dist_matrix = matrix_res["distances"]
                optimal_indices = self.solve_tsp_optimal_sequence((curr_lat, curr_lng), unvisited, dist_matrix)
                logger.info(f"✅ [OSRM Table Matrix TSP]: Thứ tự tối ưu toàn cục = {optimal_indices}")
                ordered = [dict(unvisited[i]) for i in optimal_indices]
            else:
                # Fallback 1: OSRM Trip API (TSP solver)
                dest_coords = [(d.get("lat", 0.0), d.get("lng", 0.0)) for d in unvisited]
                optimal_order = self.get_osrm_trip_optimal_order((curr_lat, curr_lng), dest_coords)

                if optimal_order is not None and len(optimal_order) == len(unvisited):
                    logger.info(f"✅ [OSRM Trip TSP]: Thứ tự tối ưu = {optimal_order}")
                    ordered = [dict(unvisited[i]) for i in optimal_order]
                else:
                    # Fallback 2: OSRM pairwise distance greedy
                    remaining = list(unvisited)
                    c_lat, c_lng = curr_lat, curr_lng

                    while remaining:
                        best_dest = None
                        best_dist = float("inf")

                        for dest in remaining:
                            d_lat = dest.get("lat", 0.0)
                            d_lng = dest.get("lng", 0.0)

                            road_dist = self.get_osrm_pairwise_distance(c_lat, c_lng, d_lat, d_lng)
                            dist_m = road_dist if road_dist is not None else self._haversine(c_lat, c_lng, d_lat, d_lng) * 1.3

                            if dist_m < best_dist:
                                best_dist = dist_m
                                best_dest = dest

                        if best_dest:
                            ordered.append(dict(best_dest))
                            remaining.remove(best_dest)
                            c_lat = best_dest.get("lat", 0.0)
                            c_lng = best_dest.get("lng", 0.0)
                        else:
                            break

        # 2. Định tuyến từng chặng độc lập & Tính toán tiến trình thời gian
        total_distance = 0.0
        total_duration = 0
        all_route_coords = []

        curr_pt = (start_point["lat"], start_point["lng"])
        current_time_cursor = 7 * 60 + 30 # Mặc định 07:30 sáng

        def format_clock(minutes: int) -> str:
            h = (minutes // 60) % 24
            m = minutes % 60
            return f"{h:02d}:{m:02d}"

        for idx, dest in enumerate(ordered):
            target_pt = (dest["lat"], dest["lng"])

            # Tính toán chặng độc lập
            leg_res = self.get_osrm_single_leg_optimized(curr_pt, target_pt)

            if leg_res and leg_res.get("geometry"):
                leg_dist = leg_res["distance_meters"]
                leg_dur = leg_res["duration_seconds"]
                leg_geom = leg_res["geometry"]
                leg_dist_txt = leg_res["distance_text"]
                leg_dur_txt = leg_res["duration_text"]
            else:
                speed_mps = 25.5 * 1000 / 3600
                leg_dist = self._haversine(curr_pt[0], curr_pt[1], target_pt[0], target_pt[1]) * 1.25
                leg_dur = int(leg_dist / speed_mps)
                leg_geom = [[curr_pt[0], curr_pt[1]], [target_pt[0], target_pt[1]]]
                leg_dist_txt = f"{leg_dist / 1000:.1f} km"
                leg_dur_txt = self._format_duration_text(leg_dur)

            stay_mins = int(dest.get("visit_duration_minutes") or 60)
            user_set_time = get_dest_time_minutes(dest)

            if user_set_time is not None:
                # Nếu người dùng đã cài đặt giờ: GIỮ NGUYÊN GIỜ CỦA NGƯỜI DÙNG!
                arrival_mins = user_set_time
                departure_mins = arrival_mins + stay_mins
                visit_time_str = dest.get("preferred_visit_time") or format_clock(arrival_mins)
            else:
                # Điểm linh hoạt: Tự động tính giờ đến tiếp theo
                travel_mins = max(1, round(leg_dur / 60))
                arrival_mins = current_time_cursor + travel_mins
                departure_mins = arrival_mins + stay_mins
                visit_time_str = format_clock(arrival_mins)

            dest["distance_meters"] = leg_dist
            dest["duration_seconds"] = leg_dur
            dest["distance_text"] = leg_dist_txt
            dest["duration_text"] = leg_dur_txt
            dest["leg_geometry"] = leg_geom
            dest["order"] = idx + 1
            dest["visit_duration_minutes"] = stay_mins
            dest["preferred_visit_time"] = visit_time_str
            dest["departure_time"] = format_clock(departure_mins)

            # Cập nhật con trỏ thời gian
            current_time_cursor = departure_mins

            total_distance += leg_dist
            total_duration += leg_dur

            if not all_route_coords:
                all_route_coords.extend(leg_geom)
            else:
                if leg_geom:
                    all_route_coords.extend(leg_geom[1:] if leg_geom[0] == all_route_coords[-1] else leg_geom)

            curr_pt = target_pt

        encoded_polyline = polyline.encode(all_route_coords) if len(all_route_coords) >= 2 else ""
        duration_text = self._format_duration_text(total_duration)

        return ordered, total_distance, total_duration, all_route_coords, encoded_polyline, duration_text


routing_service = RoutingService()

