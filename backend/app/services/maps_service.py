"""
Google Maps Link Parser Service
Xử lý việc parse link Google Maps và lấy tọa độ
"""

import re
import requests
from typing import Optional, Tuple
from urllib.parse import urlparse, parse_qs, unquote

class GoogleMapsParseError(Exception):
    """Custom exception for Google Maps parsing errors"""
    pass


def parse_google_maps_link(link: str) -> Tuple[float, float]:
    link = link.strip()
    
    # 1. Thử extract nhanh từ chuỗi link đầu vào
    coords = _extract_coords_from_string(link)
    if coords:
        return coords
    
    # 2. Thực hiện request để lấy URL đích và HTML
    try:
        resolved_coords = _fetch_and_extract_deep(link)
        if resolved_coords:
            return resolved_coords
            
    except Exception as e:
        raise GoogleMapsParseError(f"Lỗi khi xử lý link: {str(e)}")
    
    raise GoogleMapsParseError(
        "Không thể trích xuất tọa độ từ link. Vui lòng đảm bảo link là hợp lệ"
    )


def _fetch_and_extract_deep(link: str) -> Optional[Tuple[float, float]]:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    try:
        session = requests.Session()
        response = session.get(
            link,
            timeout=15,
            allow_redirects=True,
            headers=headers
        )
        
        final_url = response.url
        html_content = response.text
        
        coords = _extract_coords_from_string(final_url)
        if coords:
            return coords
            
        return _extract_coords_from_html(html_content)
        
    except requests.RequestException as e:
        print(f"Error fetching link: {e}")
        return None


def _extract_coords_from_string(text: str) -> Optional[Tuple[float, float]]:
    text = unquote(text)

    match1 = re.search(r'/@(-?\d+\.\d+),(-?\d+\.\d+)', text)
    if match1:
        return _validate_coordinates(match1.group(1), match1.group(2))
    
    lat_match = re.search(r'!3d(-?\d+\.?\d*)', text)
    lng_match = re.search(r'!4d(-?\d+\.?\d*)', text)
    
    if lat_match and lng_match:
        return _validate_coordinates(lat_match.group(1), lng_match.group(1))
    
    try:
        parsed = urlparse(text)
        params = parse_qs(parsed.query)
        
        if 'q' in params:
            val = params['q'][0]
            parts = re.split(r'[,\s]+', val)
            if len(parts) >= 2:
                return _validate_coordinates(parts[0], parts[1])

        if 'lat' in params and 'lng' in params:
            return _validate_coordinates(params['lat'][0], params['lng'][0])
            
    except (ValueError, IndexError):
        pass
    
    return None


def _extract_coords_from_html(html_content: str) -> Optional[Tuple[float, float]]:
    try:
        init_match = re.search(r'window\.APP_INITIALIZATION_STATE=\[\[\[[^,]+,(-?\d+\.\d+),(-?\d+\.\d+)', html_content)
        if init_match:
            lng = float(init_match.group(1))
            lat = float(init_match.group(2))
            return _validate_coordinates(lat, lng)
    except Exception:
        pass

    try:
        meta_match = re.search(r'property="og:image" content=".*?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)', html_content)
        if meta_match:
            return _validate_coordinates(meta_match.group(1), meta_match.group(2))
    except Exception:
        pass

    try:
        json_matches = re.findall(r'\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]', html_content)
        if json_matches:
            return _validate_coordinates(json_matches[0][0], json_matches[0][1])
    except Exception:
        pass

    return None


def _validate_coordinates(lat_input, lng_input) -> Optional[Tuple[float, float]]:
    try:
        lat = float(lat_input)
        lng = float(lng_input)
        
        if -90 <= lat <= 90 and -180 <= lng <= 180:
            if lat == 0 and lng == 0:
                return None
            return (lat, lng)
    except (ValueError, TypeError):
        pass
    return None
