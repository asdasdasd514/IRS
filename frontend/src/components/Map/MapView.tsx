import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, Waypoint, NextHopCandidate } from '../../types';

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
  hotel: createCustomIcon('#F59E0B', '🏨'),
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

// Component to auto-fit map bounds
function AutoFitBounds({ locations }: { locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      // Use setTimeout to ensure map is fully initialized
      const timeoutId = setTimeout(() => {
        try {
          const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
          // Check if map container exists before fitting bounds
          if (map.getContainer()) {
            map.fitBounds(bounds, { 
              padding: [50, 50], 
              maxZoom: 13,
              animate: false // Disable animation to prevent race conditions
            });
          }
        } catch (error) {
          console.warn('Failed to fit bounds:', error);
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [locations, map]);

  return null;
}

// Component to reset view when map remounts
function MapInitializer({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    try {
      if (map.getContainer()) {
        map.setView(center, 13, { animate: false });
      }
    } catch (error) {
      console.warn('Failed to set view:', error);
    }
  }, [center, map]);

  return null;
}

export function MapView({
  currentLocation,
  waypoints,
  recommended,
  route,
  onWaypointClick,
  nearbyPlaces = [],
}: MapViewProps) {
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

      <MapInitializer center={center} />
      <AutoFitBounds locations={allLocations} />

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

      {/* Schools/Waypoints */}
      {waypoints.map((waypoint) => {
        const isRecommended = recommended?.waypoint.id === waypoint.id;
        
        // Chọn icon dựa trên type
        let baseIcon = icons.school;
        if (waypoint.type === 'HOTEL') baseIcon = icons.hotel;
        else if (waypoint.type === 'HQ') baseIcon = icons.hq;
        else if (waypoint.type === 'REST_STOP') baseIcon = icons.restStop;
        
        const markerIcon = waypoint.is_visited
          ? icons.visited
          : isRecommended
          ? icons.recommended
          : baseIcon;

        return (
          <Marker
            key={waypoint.id}
            position={[waypoint.lat, waypoint.lng]}
            icon={markerIcon}
            eventHandlers={{
              click: () => onWaypointClick?.(waypoint),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-lg mb-1">{waypoint.name}</h3>
                {waypoint.address && (
                  <p className="text-sm text-gray-600 mb-2">{waypoint.address}</p>
                )}
                {isRecommended && (
                  <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-medium mb-2">
                    ⭐ Trường gần nhất
                  </div>
                )}
                {waypoint.is_visited && (
                  <div className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm mb-2">
                    ✓ Đã thăm
                  </div>
                )}
                {waypoint.contact_name && (
                  <p className="text-sm mt-1">
                    <strong>Liên hệ:</strong> {waypoint.contact_name}
                  </p>
                )}
                {waypoint.contact_phone && (
                  <p className="text-sm">
                    <strong>SĐT:</strong> {waypoint.contact_phone}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Route line from backend */}
      {route && route.length > 1 && (
        <Polyline
          positions={route.map((point) => [point.lat, point.lng])}
          color="#3B82F6"
          weight={4}
          opacity={0.7}
        />
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
