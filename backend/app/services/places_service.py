"""
Places Service - Tìm kiếm quán ăn, nhà hàng, khách sạn gần vị trí
Uses SerpAPI Google Local Search
"""
import logging
from typing import List, Dict, Optional
from serpapi import GoogleSearch
from app.core.config import settings

logger = logging.getLogger(__name__)


class PlacesService:
    def __init__(self):
        self.serpapi_key = settings.SERPAPI_KEY

    def search_nearby_places(
        self, 
        lat: float, 
        lng: float, 
        query: str = "quán ăn nhà hàng khách sạn",
        radius_meters: int = 5000
    ) -> List[Dict]:
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
            return places

        except Exception as e:
            logger.error(f"Error searching places with SerpAPI: {e}")
            return []


places_service = PlacesService()
