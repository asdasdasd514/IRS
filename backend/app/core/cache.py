import time
from typing import Dict, Any, Optional

class TTLMemoryCache:
    def __init__(self, default_ttl_seconds: int = 300):
        """In-memory Cache với TTL (Time To Live), mặc định 5 phút = 300 giây"""
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        if key not in self.cache:
            return None
        
        item = self.cache[key]
        if time.time() > item['expiry']:
            # Expired
            del self.cache[key]
            return None
            
        return item['value']

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        ttl_seconds = ttl if ttl is not None else self.default_ttl
        expiry = time.time() + ttl_seconds
        self.cache[key] = {
            'value': value,
            'expiry': expiry
        }

    def clear(self) -> None:
        self.cache.clear()

# Instance toàn cục dùng cho Distance Matrix & Directions
distance_matrix_cache = TTLMemoryCache(default_ttl_seconds=300)
