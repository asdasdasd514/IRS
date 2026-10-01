import { useEffect, useRef, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, Waypoint, NextHopCandidate } from '../../types';
import { calculateDistance } from '../../utils';

// Fix Leaflet default icon issue with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker icons
const createCustomIcon = (color: string, emoji: string) =>
  L.divIcon({
    html: `
      <div style="
        background: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="transform: rotate(45deg); font-size: 18px;">${emoji}</span>
      </div>
    `,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });

const icons = {
  current: createCustomIcon('#3B82F6', '📍'),
  school: createCustomIcon('#10B981', '🏫'),
  hq: createCustomIcon('#6B7280', '🏢'),
  restStop: createCustomIcon('#F59E0B', '☕'),
  recommended: createCustomIcon('#EF4444', '⭐'),
  visited: createCustomIcon('#9CA3AF', '✓'),
  tempPlace: createCustomIcon('#FF6B35', '🍽️'), // Temp marker for nearby places
};

interface MapViewProps {
  currentLocation: Location | null;
  waypoints: Waypoint[];
  recommended: NextHopCandidate | null;
  route?: { lat: number; lng: number }[];
  tripRoute?: { lat: number; lng: number }[];
  onWaypointClick?: (waypoint: Waypoint) => void;
  nearbyPlaces?: Array<{
    place_id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    rating?: number;
    type?: string;
  }>;
}

// Component to auto-fit map bounds ONCE on load to avoid jitter
function AutoFitBounds({ locations }: { locations: Location[] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    // Chỉ tự động zoom vừa khung nhìn một lần đầu tiên hoặc khi số lượng điểm thay đổi đáng kể
    if (locations.length > 0 && (!hasFittedRef.current || Math.abs(locations.length - prevCountRef.current) > 1)) {
      const timeoutId = setTimeout(() => {
        try {
          const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
          if (map.getContainer()) {
            map.fitBounds(bounds, { 
              padding: [60, 60], 
              maxZoom: 13,
              animate: false
            });
            hasFittedRef.current = true;
            prevCountRef.current = locations.length;
          }
        } catch (error) {
          console.warn('Failed to fit bounds:', error);
        }
      }, 150);

      return () => clearTimeout(timeoutId);
    }
  }, [locations.length, map]);

  return null;
}

// Điều hướng êm dịu khi người dùng chủ động bấm "Về vị trí của tôi"
function PanToLocation({ location, trigger }: { location: Location | null; trigger?: number }) {
  const map = useMap();
  useEffect(() => {
    if (trigger && location && map.getContainer()) {
      map.flyTo([location.lat, location.lng], 15, { animate: true, duration: 0.8 });
    }
  }, [trigger, location, map]);

  return null;
}

export function MapView({
  currentLocation,
  waypoints,
  recommended,
  route,
  tripRoute,
  onWaypointClick,
  centerTrigger,
  nearbyPlaces = [],
}: MapViewProps & { centerTrigger?: number }) {
  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [10.8231, 106.6297]; // Default: Ho Chi Minh City

  // Collect all locations for auto-fit
  const allLocations: Location[] = [];
  if (currentLocation) allLocations.push(currentLocation);
  waypoints.forEach((wp) => allLocations.push({ lat: wp.lat, lng: wp.lng }));

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      className="rounded-lg shadow-lg"
    >
      {/* FREE OpenStreetMap - NO API KEY */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <AutoFitBounds locations={allLocations} />
      <PanToLocation location={currentLocation} trigger={centerTrigger} />

      {/* Current location */}
      {currentLocation && (
        <Marker position={[currentLocation.lat, currentLocation.lng]} icon={icons.current}>
          <Popup>
            <div className="text-center">
              <strong>📍 Vị trí của bạn</strong>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Schools/Waypoints & Bán kính Check-in 30m */}
      {waypoints.map((waypoint) => {
        const isRecommended = recommended?.waypoint.id === waypoint.id;
        
        // Chọn icon dựa trên type
        let baseIcon = icons.school;
        if (waypoint.type === 'HQ') baseIcon = icons.hq;
        else if (waypoint.type === 'REST_STOP') baseIcon = icons.restStop;
        
        const markerIcon = waypoint.is_visited
          ? icons.visited
          : isRecommended
          ? icons.recommended
          : baseIcon;

        const distanceToMe = currentLocation
          ? calculateDistance(currentLocation.lat, currentLocation.lng, waypoint.lat, waypoint.lng)
          : null;
        const isInsideCheckInRange = distanceToMe !== null && distanceToMe <= 30;

        return (
          <Fragment key={waypoint.id}>
            {/* Vòng tròn bán kính check-in 30m */}
            {!waypoint.is_visited && (
              <Circle
                center={[waypoint.lat, waypoint.lng]}
                radius={30}
                pathOptions={{
                  color: isInsideCheckInRange ? '#10B981' : '#3B82F6',
                  fillColor: isInsideCheckInRange ? '#10B981' : '#3B82F6',
                  fillOpacity: isInsideCheckInRange ? 0.35 : 0.12,
                  dashArray: isInsideCheckInRange ? undefined : '4, 4',
                  weight: isInsideCheckInRange ? 3 : 1.5,
                }}
              />
            )}

            <Marker
              position={[waypoint.lat, waypoint.lng]}
              icon={markerIcon}
              eventHandlers={{
                click: () => onWaypointClick?.(waypoint),
              }}
            >
              <Popup>
                <div className="min-w-[210px]">
                  <h3 className="font-bold text-base mb-1 text-slate-800">{waypoint.name}</h3>
                  {waypoint.address && (
                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">{waypoint.address}</p>
                  )}
                  {isRecommended && (
                    <div className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold mb-1.5 flex items-center gap-1 border border-red-200">
                      ⭐ Điểm đến ưu tiên tiếp theo
                    </div>
                  )}
                  {waypoint.is_visited ? (
                    <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold mb-1.5 flex items-center gap-1 border border-emerald-200">
                      ✓ Đã check-in hoàn tất
                    </div>
                  ) : (
                    <div className={`px-2 py-1 rounded text-xs font-semibold mb-1.5 border ${
                      isInsideCheckInRange
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      📍 Bán kính check-in: 30m {distanceToMe !== null ? `(Hiện tại: ~${Math.round(distanceToMe)}m)` : ''}
                    </div>
                  )}
                  {waypoint.contact_name && (
                    <p className="text-xs mt-1 text-slate-700">
                      <strong>Liên hệ:</strong> {waypoint.contact_name}
                    </p>
                  )}
                  {waypoint.contact_phone && (
                    <p className="text-xs text-slate-700">
                      <strong>SĐT:</strong> {waypoint.contact_phone}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}

      {/* Tuyến đường tổng thể của chuyến đi (Làm nền định hướng) */}
      {tripRoute && tripRoute.length > 1 && (
        <Polyline
          positions={tripRoute.map((p: any) => [p.lat, p.lng])}
          color="#64748B"
          weight={4}
          opacity={0.4}
          dashArray="6, 8"
        />
      )}

      {/* Tuyến đường dẫn đến điểm tiếp theo (Active Navigation Leg - Đường dẫn trực quan 2 lớp) */}
      {route && route.length > 1 && (
        <>
          {/* Lớp viền phát sáng */}
          <Polyline
            positions={route.map((point) => [point.lat, point.lng])}
            color="#60A5FA"
            weight={9}
            opacity={0.5}
          />
          {/* Lớp dẫn đường chính */}
          <Polyline
            positions={route.map((point) => [point.lat, point.lng])}
            color="#1D4ED8"
            weight={5}
            opacity={1}
          />
        </>
      )}

      {/* Nearby places (temp markers) */}
      {nearbyPlaces.map((place) => (
        <Marker
          key={place.place_id}
          position={[place.lat, place.lng]}
          icon={icons.tempPlace}
        >
          <Popup>
            <div className="min-w-[200px]">
              <h3 className="font-bold text-lg mb-1">{place.name}</h3>
              {place.address && (
                <p className="text-sm text-gray-600 mb-2">{place.address}</p>
              )}
              {place.rating && (
                <p className="text-sm mb-1">
                  ⭐ {place.rating}/5
                </p>
              )}
              {place.type && (
                <p className="text-xs text-gray-500 mb-2">
                  {place.type}
                </p>
              )}
              <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
                🍽️ Tìm kiếm gần đây
              </div>
              <button
                onClick={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
                  window.open(url, '_blank');
                }}
                className="mt-2 w-full bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600"
              >
                Mở Google Maps
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
