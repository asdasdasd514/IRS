import React from 'react';
import { ChevronUp, ChevronDown, MapPin, Phone, User, Info, CheckCircle2 } from 'lucide-react';
import type { Waypoint, Location } from '../../types';
import { calculateDistance, formatDistance } from '../../utils';

interface VisitedBottomSheetProps {
  isExpanded: boolean;
  onToggle: () => void;
  visitedWaypoints: Waypoint[];
  isLoading: boolean;
  onSelectWaypoint: (waypoint: Waypoint) => void;
  currentLocation: Location | null;
  waypointTickets?: Record<string, number>; // waypoint_id -> total tickets
}

export const VisitedBottomSheet: React.FC<VisitedBottomSheetProps> = ({
  isExpanded,
  onToggle,
  visitedWaypoints,
  isLoading,
  onSelectWaypoint,
  currentLocation,
  waypointTickets = {},
}) => {
  const totalVisited = visitedWaypoints.length;

  return (
    <div
      className={`flex-shrink-0 bg-white border-t border-gray-200 transition-all duration-300 z-20 safe-area-bottom ${
        isExpanded ? 'h-[60vh] overflow-y-auto' : 'h-[250px]'
      }`}
    >
      {/* Handle */}
      <div className="flex justify-center cursor-pointer" onClick={onToggle}>
        <div className="bottom-sheet-handle" />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 pb-14">
          <div className="spinner" />
          <span className="ml-3 text-gray-600">Đang tải...</span>
        </div>
      )}

      {/* No visited waypoints */}
      {!isLoading && totalVisited === 0 && (
        <div className="px-4 pb-14 text-center">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-gray-800">Chưa có điểm đã đi</h3>
          <p className="text-gray-600">Bắt đầu check-in các điểm dừng</p>
        </div>
      )}

      {/* Collapsed view - show first visited */}
      {!isLoading && totalVisited > 0 && !isExpanded && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm text-gray-500">Đã hoàn thành ({totalVisited} điểm)</p>
              <h3 className="text-lg font-bold text-gray-800">{visitedWaypoints[0].name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectWaypoint(visitedWaypoints[0])}
                className="bg-blue-500 text-white py-1.5 px-3 rounded-lg font-medium flex items-center justify-center gap-1 text-xs hover:bg-blue-600 flex-shrink-0"
              >
                <Info className="w-4 h-4" />
                Chi tiết
              </button>
              <button onClick={onToggle} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0">
                <ChevronUp className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {currentLocation && (
            <p className="text-xs text-gray-500 mb-2">
              Khoảng cách: {formatDistance(calculateDistance(
                currentLocation.lat,
                currentLocation.lng,
                visitedWaypoints[0].lat,
                visitedWaypoints[0].lng
              ))}
            </p>
          )}

          {visitedWaypoints[0].visited_at && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Đã đi lúc {new Date(visitedWaypoints[0].visited_at).toLocaleString('vi-VN', { timeZoneName: 'short' })}
            </p>
          )}

          {waypointTickets[visitedWaypoints[0].id] !== undefined && waypointTickets[visitedWaypoints[0].id] > 0 && (
            <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
              🎫 {waypointTickets[visitedWaypoints[0].id]} phiếu
            </p>
          )}
        </div>
      )}

      {/* Expanded view - full list */}
      {!isLoading && isExpanded && totalVisited > 0 && (
        <div className="px-4 pb-6 h-full overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              Điểm đã đi ({totalVisited} điểm)
            </h3>
            <button onClick={onToggle} className="p-2 rounded-full hover:bg-gray-100">
              <ChevronDown className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3">
            {visitedWaypoints.map((waypoint) => (
              <VisitedWaypointCard
                key={waypoint.id}
                waypoint={waypoint}
                onSelect={onSelectWaypoint}
                currentLocation={currentLocation}
                totalTickets={waypointTickets[waypoint.id]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Visited Waypoint Card Component
interface VisitedWaypointCardProps {
  waypoint: Waypoint;
  onSelect: (waypoint: Waypoint) => void;
  currentLocation: Location | null;
  totalTickets?: number;
}

const VisitedWaypointCard: React.FC<VisitedWaypointCardProps> = ({
  waypoint,
  onSelect,
  currentLocation,
  totalTickets,
}) => {
  const actualDistance = currentLocation
    ? calculateDistance(currentLocation.lat, currentLocation.lng, waypoint.lat, waypoint.lng)
    : null;

  return (
    <div className="p-4 rounded-xl border-2 border-green-200 bg-green-50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="inline-block px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded">
              Đã hoàn thành
            </span>
          </div>
          <h4 className="font-semibold text-gray-800">{waypoint.name}</h4>
          {waypoint.address && (
            <p className="text-sm text-gray-500 line-clamp-1">{waypoint.address}</p>
          )}
        </div>
        <button
          onClick={() => onSelect(waypoint)}
          className="ml-2 bg-blue-500 text-white py-1.5 px-3 rounded-lg font-medium flex items-center justify-center gap-1 text-xs hover:bg-blue-600 flex-shrink-0"
        >
          <Info className="w-4 h-4" />
          Chi tiết
        </button>
      </div>

      {waypoint.visited_at && (
        <div className="text-sm text-gray-600 mb-2">
          <p className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Đã đi lúc: {new Date(waypoint.visited_at).toLocaleString('vi-VN', { timeZoneName: 'short' })}
          </p>
        </div>
      )}

      {/* Ticket count */}
      {totalTickets !== undefined && totalTickets > 0 && (
        <p className="text-sm text-green-600 font-medium flex items-center gap-1 mb-2">
          🎫 {totalTickets} phiếu
        </p>
      )}

      {actualDistance !== null && (
        <p className="text-xs text-gray-500 mb-2">
          Khoảng cách hiện tại: {formatDistance(actualDistance)}
        </p>
      )}

      {/* Contact info */}
      {(waypoint.contact_name || waypoint.contact_phone) && (
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
          {waypoint.contact_name && (
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {waypoint.contact_name}
            </span>
          )}
          {waypoint.contact_phone && (
            <a
              href={`tel:${waypoint.contact_phone}`}
              className="flex items-center gap-1 text-primary-500"
            >
              <Phone className="w-4 h-4" />
              {waypoint.contact_phone}
            </a>
          )}
        </div>
      )}

      {/* Notes */}
      {waypoint.notes && (
        <p className="text-sm text-gray-600 italic bg-yellow-50 p-2 rounded">
          📝 {waypoint.notes}
        </p>
      )}
    </div>
  );
};

export default VisitedBottomSheet;
