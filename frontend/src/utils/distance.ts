/**
 * Utility functions for distance calculations
 */

/**
 * Tính khoảng cách giữa 2 điểm GPS theo công thức Haversine
 * 
 * @param lat1 Vĩ độ điểm 1
 * @param lng1 Kinh độ điểm 1
 * @param lat2 Vĩ độ điểm 2
 * @param lng2 Kinh độ điểm 2
 * @returns Khoảng cách tính bằng mét
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Bán kính trái đất tính bằng mét

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance;
}

/**
 * Format khoảng cách thành string dễ đọc
 * 
 * @param meters Khoảng cách tính bằng mét
 * @returns String đã format (VD: "1.5 km" hoặc "250 m")
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Kiểm tra xem có đủ gần để check-in không
 * 
 * @param currentLat Vĩ độ hiện tại
 * @param currentLng Kinh độ hiện tại
 * @param targetLat Vĩ độ đích
 * @param targetLng Kinh độ đích
 * @param maxDistance Khoảng cách tối đa cho phép (mặc định 500m)
 * @returns true nếu đủ gần
 */
export function isWithinCheckInRange(
  currentLat: number,
  currentLng: number,
  targetLat: number,
  targetLng: number,
  maxDistance: number = 500
): boolean {
  const distance = calculateDistance(currentLat, currentLng, targetLat, targetLng);
  return distance <= maxDistance;
}
