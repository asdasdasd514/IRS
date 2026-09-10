import time
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class TTLMemoryCache:
    """
    In-memory Cache với cơ chế TTL (Time To Live), LRU Eviction và chống tràn bộ nhớ (Memory-leak safe).
    Mặc định TTL = 300 giây (5 phút).
    """
    def __init__(self, default_ttl_seconds: int = 300, max_size: int = 2000, name: str = "cache"):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl_seconds
        self.max_size = max_size
        self.name = name
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        """Lấy giá trị từ cache. Trả về None nếu không tồn tại hoặc đã quá hạn."""
        if key not in self.cache:
            self.misses += 1
            return None
        
        item = self.cache[key]
        now = time.time()
        if now > item['expiry']:
            # Đã hết hạn (Expired) -> Xóa ngay
            del self.cache[key]
            self.misses += 1
            return None
            
        # Cache hit: Cập nhật thời điểm truy cập gần nhất (LRU)
        item['last_accessed'] = now
        self.hits += 1
        return item['value']

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Lưu giá trị vào cache với TTL cụ thể (mặc định 5 phút = 300s)."""
        now = time.time()
        ttl_seconds = ttl if ttl is not None else self.default_ttl
        expiry = now + ttl_seconds

        # Nếu cache đạt ngưỡng tối đa max_size, dọn dẹp các key quá hạn trước
        if len(self.cache) >= self.max_size and key not in self.cache:
            self._evict_expired_or_lru()

        self.cache[key] = {
            'value': value,
            'expiry': expiry,
            'last_accessed': now
        }

    def _evict_expired_or_lru(self) -> None:
        """Dọn dẹp key hết hạn, nếu vẫn đầy thì xóa key ít được dùng nhất (LRU)."""
        now = time.time()
        # 1. Quét xóa các key đã hết hạn
        expired_keys = [k for k, v in self.cache.items() if now > v['expiry']]
        for k in expired_keys:
            del self.cache[k]

        # 2. Nếu sau khi quét vẫn vượt quá 90% max_size, xóa bớt 20% các key cũ nhất
        if len(self.cache) >= int(self.max_size * 0.9):
            sorted_by_lru = sorted(self.cache.items(), key=lambda item: item[1].get('last_accessed', 0))
            num_to_evict = max(1, len(self.cache) // 5)
            for k, _ in sorted_by_lru[:num_to_evict]:
                self.cache.pop(k, None)

    def delete(self, key: str) -> bool:
        """Xóa 1 key khỏi cache."""
        if key in self.cache:
            del self.cache[key]
            return True
        return False

    def clear_prefix(self, prefix: str) -> int:
        """Xóa tất cả các key có tiền tố prefix (hữu ích khi muốn làm mới dữ liệu của một trip)."""
        keys_to_delete = [k for k in self.cache if k.startswith(prefix)]
        for k in keys_to_delete:
            del self.cache[k]
        return len(keys_to_delete)

    def clear(self) -> None:
        """Xóa toàn bộ cache."""
        self.cache.clear()
        self.hits = 0
        self.misses = 0

    def stats(self) -> Dict[str, Any]:
        """Thống kê tình trạng cache."""
        now = time.time()
        active_count = sum(1 for v in self.cache.values() if now <= v['expiry'])
        return {
            "name": self.name,
            "total_keys": len(self.cache),
            "active_keys": active_count,
            "hits": self.hits,
            "misses": self.misses,
            "hit_ratio": round(self.hits / (self.hits + self.misses), 2) if (self.hits + self.misses) > 0 else 0.0
        }


# ==================== CÁC INSTANCE CACHE TOÀN CỤC CHUYÊN BIỆT (TTL = 5 PHÚT) ====================

# 1. Cache tính toán Distance Matrix giữa các điểm trường (Next-Hop candidate)
distance_matrix_cache = TTLMemoryCache(default_ttl_seconds=300, max_size=3000, name="distance_matrix")

# 2. Cache lộ trình chỉ đường Google Maps Directions (Polyline, Steps, Distance, Duration)
directions_cache = TTLMemoryCache(default_ttl_seconds=300, max_size=1500, name="directions")

# 3. Cache tìm kiếm quán ăn/nhà hàng/khách sạn tiện ích xung quanh
places_cache = TTLMemoryCache(default_ttl_seconds=300, max_size=500, name="places")

# 4. Cache bóc tách tọa độ từ link Google Maps
maps_link_cache = TTLMemoryCache(default_ttl_seconds=300, max_size=1000, name="maps_link")

# 5. Cache API tổng quát
api_response_cache = TTLMemoryCache(default_ttl_seconds=300, max_size=1000, name="api_response")
