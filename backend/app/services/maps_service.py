"""
Google Maps Link Parser Service
Xử lý việc parse link Google Maps và lấy tọa độ
"""

import re
import logging
import requests
from typing import Optional, Tuple
from urllib.parse import urlparse, parse_qs, unquote
from app.core.cache import maps_link_cache

logger = logging.getLogger(__name__)

class GoogleMapsParseError(Exception):
    """Custom exception for Google Maps parsing errors"""
    pass


def parse_google_maps_link(link: str) -> Tuple[float, float]:
    link = link.strip()
    if not link:
        raise GoogleMapsParseError("Link không được để trống")

    # Kiểm tra Cache 5 phút
    cached_coords = maps_link_cache.get(link)
    if cached_coords is not None:
        logger.info(f"⚡ [Cache Hit Maps Link]: {link[:60]}... -> {cached_coords}")
        return cached_coords
    
    # 1. Thử extract nhanh từ chuỗi link đầu vào
    coords = _extract_coords_from_string(link)
    if coords:
        maps_link_cache.set(link, coords, ttl=300)
        return coords
    
    # 2. Thực hiện request để lấy URL đích và HTML
    try:
        resolved_coords = _fetch_and_extract_deep(link)
        if resolved_coords:
            maps_link_cache.set(link, resolved_coords, ttl=300)
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

    # 0. Nếu người dùng dán cả mã nhúng HTML iframe (<iframe src="..."></iframe>)
    iframe_match = re.search(r'src=["\']([^"\']+)["\']', text)
    if iframe_match:
        text = iframe_match.group(1)

    # 1. Chuỗi tọa độ nhập trực tiếp (VD: "10.953047, 106.803714")
    direct_match = re.match(r'^\s*(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)\s*$', text)
    if direct_match:
        coords = _validate_coordinates(direct_match.group(1), direct_match.group(2))
        if coords:
            return coords

    # 2. ƯU TIÊN HÀNG ĐẦU: Tọa độ chính xác của ghim địa điểm
    # - Link place thông thường: !3d<lat>!4d<lng>
    # - Mã nhúng Google Maps Embed: !2d<lng>!3d<lat>
    lat_match = re.search(r'!3d(-?\d+\.?\d*)', text)
    lng_match = re.search(r'!4d(-?\d+\.?\d*)', text) or re.search(r'!2d(-?\d+\.?\d*)', text)
    if lat_match and lng_match:
        coords = _validate_coordinates(lat_match.group(1), lng_match.group(1))
        if coords:
            return coords

    # 3. Tham số query tìm kiếm (?q=lat,lng hoặc ?query=lat,lng hoặc ?ll=lat,lng)
    try:
        parsed = urlparse(text)
        params = parse_qs(parsed.query)
        for q_key in ['q', 'query', 'll', 'daddr', 'saddr']:
            if q_key in params:
                val = params[q_key][0]
                coord_match = re.search(r'(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)', val)
                if coord_match:
                    coords = _validate_coordinates(coord_match.group(1), coord_match.group(2))
                    if coords:
                        return coords
        
        if 'lat' in params and 'lng' in params:
            coords = _validate_coordinates(params['lat'][0], params['lng'][0])
            if coords:
                return coords
    except Exception:
        pass

    # 4. Dự phòng cuối: Tâm camera màn hình /@lat,lng (chỉ dùng khi link không có ghim địa điểm cụ thể)
    match_at = re.search(r'/@(-?\d+\.\d+),(-?\d+\.\d+)', text)
    if match_at:
        return _validate_coordinates(match_at.group(1), match_at.group(2))

    return None


def _extract_coords_from_html(html_content: str) -> Optional[Tuple[float, float]]:
    # 1. Tìm trong URL canonical hoặc og:url nếu có !3d!4d
    url_matches = re.findall(r'(?:property="og:url"\s+content="|rel="canonical"\s+href=")([^"]+)"', html_content)
    for u in url_matches:
        coords = _extract_coords_from_string(u)
        if coords:
            return coords

    # 2. Tìm trực tiếp !3d và !4d trong toàn bộ mã HTML
    lat_match = re.search(r'!3d(-?\d+\.?\d*)', html_content)
    lng_match = re.search(r'!4d(-?\d+\.?\d*)', html_content)
    if lat_match and lng_match:
        coords = _validate_coordinates(lat_match.group(1), lng_match.group(1))
        if coords:
            return coords

    # 3. Tìm trong window.APP_INITIALIZATION_STATE
    try:
        init_match = re.search(r'window\.APP_INITIALIZATION_STATE=\[\[\[[^,]+,(-?\d+\.\d+),(-?\d+\.\d+)', html_content)
        if init_match:
            lng = float(init_match.group(1))
            lat = float(init_match.group(2))
            return _validate_coordinates(lat, lng)
    except Exception:
        pass

    # 4. Tìm trong meta og:image
    try:
        meta_match = re.search(r'property="og:image"\s+content=".*?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)', html_content)
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

    # 5. Dự phòng cuối: /@lat,lng trong HTML
    match_at = re.search(r'/@(-?\d+\.\d+),(-?\d+\.\d+)', html_content)
    if match_at:
        return _validate_coordinates(match_at.group(1), match_at.group(2))

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
