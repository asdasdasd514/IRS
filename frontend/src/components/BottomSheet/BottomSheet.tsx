import React from 'react';
import { ChevronUp, ChevronDown, Navigation, CheckCircle, Clock, MapPin, Phone, User, Info } from 'lucide-react';
import type { NextHopCandidate, Waypoint, Location } from '../../types';
import { calculateDistance, formatDistance } from '../../utils';

interface BottomSheetProps {
  isExpanded: boolean;
  onToggle: () => void;
  recommended: NextHopCandidate | null;
  alternatives: NextHopCandidate[];
  totalUnvisited: number;
  totalUnvisitedSchools: number; // Số trường chưa đi
  isLoading: boolean;
  onNavigate: (waypoint: Waypoint) => void;
  onCheckIn: (waypoint: Waypoint) => void;
  onSelectWaypoint: (waypoint: Waypoint) => void;
  currentLocation: Location | null;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isExpanded,
  onToggle,
  recommended,
  alternatives,
  totalUnvisited,
  totalUnvisitedSchools,
  isLoading,
  onNavigate,
  onCheckIn,
  onSelectWaypoint,
  currentLocation,
}) => {
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
          <span className="ml-3 text-gray-600">Đang tìm điểm đến tiếp theo...</span>
        </div>
      )}

      {/* No more waypoints */}
      {!isLoading && !recommended && totalUnvisited === 0 && (
        <div className="px-4 pb-14 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-gray-800">Hoàn thành!</h3>
          <p className="text-gray-600">Đã đi hết tất cả các điểm dừng</p>
        </div>
      )}

      {/* Recommended waypoint (collapsed view) */}
      {!isLoading && recommended && !isExpanded && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm text-gray-500">Điểm tiếp theo ({totalUnvisitedSchools} còn lại)</p>
              <h3 className="text-lg font-bold text-gray-800">{recommended.waypoint.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectWaypoint(recommended.waypoint)}
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

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-4 h-4 text-blue-600" />
              {recommended.duration_text}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="w-4 h-4 text-emerald-600" />
              {recommended.distance_text}
            </span>
          </div>

          {currentLocation && (() => {
            const dist = calculateDistance(
              currentLocation.lat,
              currentLocation.lng,
              recommended.waypoint.lat,
              recommended.waypoint.lng
            );
            const inRange = dist <= 30;
            return (
              <div
                className={`text-xs px-2.5 py-1.5 rounded-lg mb-3 flex items-center justify-between border ${
                  inRange
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <span>
                  Khoảng cách GPS: <strong>{formatDistance(dist)}</strong>
                </span>
                {inRange ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    ✓ Trong bán kính check-in (≤ 30m)
                  </span>
                ) : (
                  <span className="text-amber-700 text-[11px] font-medium">
                    (Yêu cầu khoảng cách 10m - 30m)
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex gap-2.5">
            <button
              onClick={() => onNavigate(recommended.waypoint)}
              className="flex-1 bg-primary-600 text-white py-2.5 px-3.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-700 active:bg-primary-800 transition text-xs shadow-xs"
            >
              <Navigation className="w-4 h-4" />
              Chỉ đường
            </button>
            {(() => {
              const dist = currentLocation
                ? calculateDistance(
                    currentLocation.lat,
                    currentLocation.lng,
                    recommended.waypoint.lat,
                    recommended.waypoint.lng
                  )
                : 999;
              const inRange = dist <= 30;

              return (
                <button
                  onClick={() => onCheckIn(recommended.waypoint)}
                  className={`flex-1 py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-xs shadow-xs ${
                    inRange
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 animate-pulse'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {inRange ? 'Check-in (Đã tới nơi)' : 'Check-in điểm này'}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Expanded view - full list */}
      {!isLoading && isExpanded && (
        <div className="px-4 pb-6 h-full overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              Danh sách điểm dừng ({totalUnvisited} còn lại)
            </h3>
            <button onClick={onToggle} className="p-2 rounded-full hover:bg-gray-100">
              <ChevronDown className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3">
            {/* Recommended */}
            {recommended && (
              <WaypointCard
                candidate={recommended}
                isRecommended={true}
                onNavigate={onNavigate}
                onCheckIn={onCheckIn}
                onSelect={onSelectWaypoint}
                currentLocation={currentLocation}
              />
            )}

            {/* Alternatives */}
            {alternatives.map((alt) => (
              <WaypointCard
                key={alt.waypoint.id}
                candidate={alt}
                isRecommended={false}
                onNavigate={onNavigate}
                onCheckIn={onCheckIn}
                onSelect={onSelectWaypoint}
                currentLocation={currentLocation}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Waypoint Card Component
interface WaypointCardProps {
  candidate: NextHopCandidate;
  isRecommended: boolean;
  onNavigate: (waypoint: Waypoint) => void;
  onCheckIn: (waypoint: Waypoint) => void;
  onSelect: (waypoint: Waypoint) => void;
  currentLocation: Location | null;
}

const WaypointCard: React.FC<WaypointCardProps> = ({
  candidate,
  isRecommended,
  onNavigate,
  onCheckIn,
  onSelect,
  currentLocation,
}) => {
  const { waypoint, duration_text, distance_text } = candidate;
  
  const actualDistance = currentLocation
    ? calculateDistance(currentLocation.lat, currentLocation.lng, waypoint.lat, waypoint.lng)
    : null;

  return (
    <div
      className={`p-4 rounded-xl border-2 ${
        isRecommended ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {isRecommended && (
            <span className="inline-block px-2 py-1 bg-primary-500 text-white text-xs font-semibold rounded mb-1">
              Gợi ý
            </span>
          )}
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

      <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {duration_text}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          {distance_text}
        </span>
      </div>
      {actualDistance !== null && (
        <div className="text-xs text-gray-500 mb-3 flex items-center justify-between">
          <span>
            Khoảng cách GPS: <strong>{formatDistance(actualDistance)}</strong>
          </span>
          {actualDistance <= 30 ? (
            <span className="text-emerald-700 font-bold">✓ Trong bán kính check-in (≤ 30m)</span>
          ) : (
            <span className="text-amber-700 text-[11px] font-medium">Bán kính check-in: 10 - 30m</span>
          )}
        </div>
      )}
      {actualDistance === null && <div className="mb-3" />}

      {/* Contact info */}
      {(waypoint.contact_name || waypoint.contact_phone) && (
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
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
        <p className="text-sm text-gray-600 italic mb-3 bg-yellow-50 p-2 rounded">
          📝 {waypoint.notes}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onNavigate(waypoint)}
          className={`flex-1 py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1 text-sm ${
            isRecommended
              ? 'bg-primary-500 text-white hover:bg-primary-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Navigation className="w-4 h-4" />
          Đi
        </button>
        <button
          onClick={() => onCheckIn(waypoint)}
          className="flex-1 bg-green-500 text-white py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-1 text-sm hover:bg-green-600"
        >
          <CheckCircle className="w-4 h-4" />
          Check-in
        </button>
      </div>
    </div>
  );
};

export default BottomSheet;
