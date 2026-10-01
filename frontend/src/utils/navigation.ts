/**
 * Utility tạo URL mở Google Maps bám sát 100% lộ trình định tuyến của IRS
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Tính khoảng cách xấp xỉ giữa 2 điểm GPS (mét)
 */
function quickDistanceMeters(p1: LatLng, p2: LatLng): number {
  const dLat = (p2.lat - p1.lat) * 111320;
  const dLng = (p2.lng - p1.lng) * 111320 * Math.cos((p1.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Tạo URL Google Maps Directions theo lộ trình định tuyến đã tính toán:
 * 
 * 1. Đặt `origin` tại vị trí thực tế của người dùng (hoặc điểm xuất phát).
 * 2. Đặt `destination` tại điểm trường cần đến.
 * 3. Nếu có `routeGeometry` (các tọa độ thực tế của tuyến đường do OSRM vẽ):
 *    Trích xuất 2 - 3 điểm chốt hành trình (via-points tại 25%, 50%, 75% chiều dài cung đường)
 *    để truyền vào tham số `waypoints`.
 *    Khi Google Maps nhận được các điểm chốt này, thuật toán Google Maps BẮT BUỘC phải
 *    vẽ đường đi qua đúng các đại lộ/cây cầu/tuyến đường mà IRS đã định tuyến,
 *    không thể tự ý đi vòng qua đường khác!
 */
export function buildGoogleMapsDirectionsUrl(
  origin: LatLng,
  destination: LatLng,
  routeGeometry?: LatLng[],
  travelMode: 'driving' | 'motorcycle' = 'driving'
): string {
  const originParam = `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;
  const destParam = `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;

  let waypointsParam = '';

  if (routeGeometry && routeGeometry.length >= 10) {
    const totalPts = routeGeometry.length;
    // Lấy 3 điểm chốt tại 25%, 50%, 75% cung đường
    const sampleRatios = [0.25, 0.5, 0.75];
    const candidateViaPoints: LatLng[] = [];

    for (const ratio of sampleRatios) {
      const idx = Math.floor(totalPts * ratio);
      const pt = routeGeometry[idx];
      if (pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) {
        // Chỉ lấy điểm nếu cách xa điểm xuất phát và điểm đích tối thiểu 350m
        const distFromOrigin = quickDistanceMeters(origin, pt);
        const distFromDest = quickDistanceMeters(destination, pt);
        if (distFromOrigin > 350 && distFromDest > 350) {
          candidateViaPoints.push(pt);
        }
      }
    }

    if (candidateViaPoints.length > 0) {
      const viaCoords = candidateViaPoints
        .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
        .join('|');
      waypointsParam = `&waypoints=${encodeURIComponent(viaCoords)}`;
    }
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}${waypointsParam}&travelmode=${travelMode}`;
}

/**
 * Tạo URL Google Maps dẫn đường qua toàn bộ chuỗi điểm dừng còn lại trong chuyến đi
 */
export function buildGoogleMapsMultiStopUrl(
  origin: LatLng,
  remainingWaypoints: LatLng[],
  travelMode: 'driving' | 'motorcycle' = 'driving'
): string {
  if (!remainingWaypoints || remainingWaypoints.length === 0) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}&travelmode=${travelMode}`;
  }

  if (remainingWaypoints.length === 1) {
    return buildGoogleMapsDirectionsUrl(origin, remainingWaypoints[0], undefined, travelMode);
  }

  // Điểm cuối cùng là destination
  const lastIndex = remainingWaypoints.length - 1;
  const destination = remainingWaypoints[lastIndex];

  // Các điểm ở giữa là intermediate waypoints (tối đa 9 điểm do giới hạn Google Maps URL)
  const intermediateWaypoints = remainingWaypoints
    .slice(0, lastIndex)
    .slice(0, 8)
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join('|');

  const originParam = `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;
  const destParam = `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
  const waypointsParam = intermediateWaypoints ? `&waypoints=${encodeURIComponent(intermediateWaypoints)}` : '';

  return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}${waypointsParam}&travelmode=${travelMode}`;
}
