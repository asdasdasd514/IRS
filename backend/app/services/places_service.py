"""
Places Service - Tìm kiếm quán ăn, nhà hàng, khách sạn
Hỗ trợ 2 chế độ:
1. Tìm kiếm quán ăn dọc theo tuyến đường di chuyển (Search Along Route) kèm bộ lọc cự ly sát đường.
2. Tìm kiếm quanh 1 tọa độ đơn lẻ (Nearby search).
Uses SerpAPI Google Local Search with caching and geometric corridor filtering.
"""
import logging
import math
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Optional, Tuple
from serpapi import GoogleSearch
from app.core.config import settings
from app.core.cache import places_cache
from app.core.database import get_database

logger = logging.getLogger(__name__)


class PlacesService:
    def __init__(self):
        self.serpapi_key = settings.SERPAPI_KEY

    def distance_point_to_segment(
        self,
        p: Tuple[float, float],
        a: Tuple[float, float],
        b: Tuple[float, float]
    ) -> float:
        """
        Tính khoảng cách mét từ điểm p(lat, lng) đến đoạn thẳng a-b(lat, lng)
        dùng phép chiếu tọa độ phẳng cục bộ UTM/WGS84.
        """
        lat_p, lng_p = p
        lat_a, lng_a = a
        lat_b, lng_b = b

        mean_lat_rad = math.radians((lat_a + lat_b) / 2.0)
        kx = 111320.0 * math.cos(mean_lat_rad)
        ky = 111320.0

        px = lng_p * kx
        py = lat_p * ky
        ax = lng_a * kx
        ay = lat_a * ky
        bx = lng_b * kx
        by = lat_b * ky

        dx = bx - ax
        dy = by - ay
        seg_len_sq = dx * dx + dy * dy
        if seg_len_sq <= 1e-6:
            return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)

        t = ((px - ax) * dx + (py - ay) * dy) / seg_len_sq
        t = max(0.0, min(1.0, t))

        proj_x = ax + t * dx
        proj_y = ay + t * dy
        return math.sqrt((px - proj_x) ** 2 + (py - proj_y) ** 2)

    def min_distance_to_route(
        self,
        p: Tuple[float, float],
        route_coords: List[List[float]]
    ) -> float:
        """
        Tính khoảng cách mét ngắn nhất từ vị trí quán p(lat, lng)
        đến toàn bộ polyline của tuyến đường đang đi.
        """
        if not route_coords:
            return 999999.0
        if len(route_coords) == 1:
            lat_diff = (p[0] - route_coords[0][0]) * 111320.0
            lng_diff = (p[1] - route_coords[0][1]) * 111320.0 * math.cos(math.radians(p[0]))
            return math.sqrt(lat_diff ** 2 + lng_diff ** 2)

        min_dist = float('inf')
        for i in range(len(route_coords) - 1):
            d = self.distance_point_to_segment(p, route_coords[i], route_coords[i + 1])
            if d < min_dist:
                min_dist = d
                if min_dist < 20.0:  # Quán nằm sát mép đường <= 20m thì dừng sớm
                    break
        return min_dist

    async def search_places_along_route(
        self,
        route_geometry: List[List[float]],
        query: str = "đồ ăn",
        max_distance_from_route_meters: float = 250.0,
        limit: int = 15
    ) -> List[Dict]:
        """
        Tìm kiếm các điểm bán đồ ăn/quán cơm/quán ăn nằm SÁT LỀ ĐƯỜNG dọc theo lộ trình di chuyển:
        - Lấy mẫu các điểm nút phân bổ đều trên hành trình (15%, 35%, 55%, 75%, 90%).
        - Tìm kiếm rộng: bao gồm quán bán đồ ăn bình dân, quán cơm, bún phở, đồ ăn vặt, tiệm ăn.
        - LỌC NGHIÊM NGẶT: Chỉ giữ lại các địa điểm có khoảng cách vuông góc đến tim đường <= max_distance_from_route_meters
          (mặc định <= 250m), loại bỏ hoàn toàn các quán nằm sâu trong ngõ hẻm/khu dân cư.
        - Chạy đa luồng song song để tốc độ phản hồi nhanh tức thì.
        - Cơ chế Cache 2 tầng: RAM + MongoDB Persistent Cache (hạn 7 ngày).
        """
        if not route_geometry or len(route_geometry) < 2:
            return []

        # Tạo cache key dựa trên điểm đầu, điểm cuối và cự ly
        start_pt = route_geometry[0]
        end_pt = route_geometry[-1]
        cache_key = f"along_route:{round(start_pt[0], 3)},{round(start_pt[1], 3)}->{round(end_pt[0], 3)},{round(end_pt[1], 3)}:{query.strip().lower()}:{max_distance_from_route_meters}"
        
        # Tầng 1: In-memory cache (RAM)
        cached = places_cache.get(cache_key)
        if cached is not None:
            logger.info(f"⚡ [RAM Cache Hit Places Along Route]: {cache_key} ({len(cached)} quán ăn)")
            return cached

        # Tầng 2: MongoDB Persistent Cache
        db = get_database()
        if db is not None:
            try:
                doc = await db.cached_places.find_one({"cache_key": cache_key})
                if doc and "places" in doc and doc["places"]:
                    places_cache.set(cache_key, doc["places"], ttl=86400)
                    logger.info(f"⚡ [MongoDB Cache Hit Places Along Route]: {cache_key} ({len(doc['places'])} quán ăn)")
                    return doc["places"]
            except Exception as mongo_err:
                logger.warning(f"Error checking places MongoDB cache: {mongo_err}")

        if not self.serpapi_key:
            logger.warning("SerpAPI key not configured - cannot search places along route")
            return []

        total_pts = len(route_geometry)
        if total_pts >= 30:
            sample_indices = [
                int(total_pts * 0.15),
                int(total_pts * 0.35),
                int(total_pts * 0.55),
                int(total_pts * 0.75),
                int(total_pts * 0.90)
            ]
        elif total_pts >= 10:
            sample_indices = [int(total_pts * 0.25), int(total_pts * 0.50), int(total_pts * 0.75)]
        else:
            sample_indices = [int(total_pts * 0.5)]

        # Nếu tìm kiếm đồ ăn chung, mở rộng thành các từ khóa phổ biến để tìm quán cơm, bún phở, đồ ăn bình dân
        normalized_q = query.strip().lower()
        if normalized_q in ["đồ ăn", "quán ăn", "quán ăn nhà hàng", "do an", "quan an", "food"]:
            sub_queries = ["đồ ăn", "quán cơm", "quán ăn bình dân"]
        else:
            sub_queries = [query]

        tasks = []
        for s_idx in sample_indices:
            pt = route_geometry[s_idx]
            for sq in sub_queries:
                tasks.append((pt, sq))

        def _fetch_local_results(task_args: Tuple[List[float], str]) -> List[Dict]:
            pt_coord, q_str = task_args
            try:
                params = {
                    "engine": "google_maps",
                    "type": "search",
                    "q": q_str,
                    "ll": f"@{pt_coord[0]},{pt_coord[1]},14z",
                    "api_key": self.serpapi_key,
                    "hl": "vi",
                    "gl": "vn",
                }
                search = GoogleSearch(params)
                res = search.get_dict()
                return res.get("local_results", [])
            except Exception as e:
                logger.warning(f"Error querying SerpAPI for {q_str} at {pt_coord}: {e}")
                return []

        # Chạy đa luồng song song qua ThreadPoolExecutor
        raw_places_map: Dict[str, Dict] = {}
        with ThreadPoolExecutor(max_workers=min(len(tasks), 10)) as executor:
            batch_results = list(executor.map(_fetch_local_results, tasks))

        for local_items in batch_results:
            for item in local_items:
                gps = item.get("gps_coordinates")
                if gps and gps.get("latitude") and gps.get("longitude"):
                    place_lat = float(gps["latitude"])
                    place_lng = float(gps["longitude"])
                    pid = item.get("place_id") or f"{place_lat},{place_lng}"
                    name = (item.get("title") or "").strip()
                    if len(name) < 2:
                        continue
                    if pid not in raw_places_map:
                        raw_places_map[pid] = {
                            "place_id": pid,
                            "name": name,
                            "address": item.get("address") or "",
                            "lat": place_lat,
                            "lng": place_lng,
                            "rating": item.get("rating"),
                            "reviews": item.get("reviews"),
                            "type": item.get("type") or "Quán ăn",
                            "price": item.get("price"),
                            "thumbnail": item.get("thumbnail"),
                        }

        # Lọc chỉ giữ lại quán nằm SÁT ĐƯỜNG (cự ly vuông góc <= max_distance_from_route_meters)
        filtered_places = []
        for p in raw_places_map.values():
            dist_to_route = self.min_distance_to_route((p["lat"], p["lng"]), route_geometry)
            if dist_to_route <= max_distance_from_route_meters:
                p["dist_to_route_m"] = round(dist_to_route)
                if dist_to_route <= 35:
                    p["dist_to_route_text"] = f"Mặt tiền đường (cách ~{round(dist_to_route)}m)"
                else:
                    p["dist_to_route_text"] = f"Sát lề đường (cách ~{round(dist_to_route)}m)"
                filtered_places.append(p)

        # Sắp xếp ưu tiên các quán gần trục lộ chính nhất
        filtered_places.sort(key=lambda x: x.get("dist_to_route_m", 999999))
        result = filtered_places[:limit]

        logger.info(f"🛣️ [Search Along Route]: Tìm thấy {len(result)} quán bán đồ ăn sát đường (<= {max_distance_from_route_meters}m)")
        
        # Lưu Tầng 1 (RAM)
        places_cache.set(cache_key, result, ttl=86400)

        # Lưu Tầng 2 (MongoDB Persistent Cache - hạn 7 ngày)
        if db is not None:
            try:
                now = datetime.now(timezone.utc)
                expires_at = now + timedelta(days=7)
                await db.cached_places.update_one(
                    {"cache_key": cache_key},
                    {"$set": {
                        "cache_key": cache_key,
                        "places": result,
                        "created_at": now,
                        "expires_at": expires_at
                    }},
                    upsert=True
                )
                logger.info(f"💾 [MongoDB Saved Places Cache]: {cache_key}")
            except Exception as save_err:
                logger.warning(f"Failed to persist places cache to MongoDB: {save_err}")

        return result

    async def search_nearby_places(
        self, 
        lat: float, 
        lng: float, 
        query: str = "quán ăn nhà hàng khách sạn",
        radius_meters: int = 5000
    ) -> List[Dict]:
        """Tìm kiếm quán ăn quanh 1 tọa độ cụ thể (Hỗ trợ Cache 2 tầng RAM + MongoDB)"""
        cache_key = f"{round(lat, 3)},{round(lng, 3)}:{query.strip().lower()}:{radius_meters}"
        
        # Tầng 1: In-memory cache (RAM)
        cached_places = places_cache.get(cache_key)
        if cached_places is not None:
            logger.info(f"⚡ [RAM Cache Hit Nearby Places]: {cache_key} ({len(cached_places)} địa điểm)")
            return cached_places

        # Tầng 2: MongoDB Persistent Cache
        db = get_database()
        if db is not None:
            try:
                doc = await db.cached_places.find_one({"cache_key": cache_key})
                if doc and "places" in doc and doc["places"]:
                    places_cache.set(cache_key, doc["places"], ttl=86400)
                    logger.info(f"⚡ [MongoDB Cache Hit Nearby Places]: {cache_key} ({len(doc['places'])} địa điểm)")
                    return doc["places"]
            except Exception as mongo_err:
                logger.warning(f"Error checking nearby places MongoDB cache: {mongo_err}")

        if not self.serpapi_key:
            logger.warning("SerpAPI key not configured - cannot search places")
            return []

        try:
            params = {
                "engine": "google_maps",
                "type": "search",
                "q": query,
                "ll": f"@{lat},{lng},14z",
                "nearby": "true",
                "api_key": self.serpapi_key,
                "hl": "vi",
                "gl": "vn",
            }

            logger.info(f"Searching places near ({lat}, {lng}) with query: {query}")
            search = GoogleSearch(params)
            results = search.get_dict()

            places = []
            local_results = results.get("local_results", [])
            
            for place in local_results[:20]:
                place_data = {
                    "place_id": place.get("place_id"),
                    "name": place.get("title"),
                    "address": place.get("address"),
                    "lat": place.get("gps_coordinates", {}).get("latitude"),
                    "lng": place.get("gps_coordinates", {}).get("longitude"),
                    "rating": place.get("rating"),
                    "reviews": place.get("reviews"),
                    "type": place.get("type"),
                    "price": place.get("price"),
                    "thumbnail": place.get("thumbnail"),
                }
                
                if place_data["lat"] and place_data["lng"]:
                    places.append(place_data)

            logger.info(f"Found {len(places)} places near location")
            
            # Lưu Tầng 1 (RAM)
            places_cache.set(cache_key, places, ttl=86400)

            # Lưu Tầng 2 (MongoDB Persistent Cache - hạn 7 ngày)
            if db is not None:
                try:
                    now = datetime.now(timezone.utc)
                    expires_at = now + timedelta(days=7)
                    await db.cached_places.update_one(
                        {"cache_key": cache_key},
                        {"$set": {
                            "cache_key": cache_key,
                            "places": places,
                            "created_at": now,
                            "expires_at": expires_at
                        }},
                        upsert=True
                    )
                    logger.info(f"💾 [MongoDB Saved Nearby Places Cache]: {cache_key}")
                except Exception as save_err:
                    logger.warning(f"Failed to persist nearby places cache to MongoDB: {save_err}")

            return places

        except Exception as e:
            logger.error(f"Error searching places with SerpAPI: {e}")
            return []


places_service = PlacesService()
