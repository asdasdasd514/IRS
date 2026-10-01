import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, MapPin, Menu, Utensils } from 'lucide-react';
import polyline from '@mapbox/polyline';

import { MapView, BottomSheet, VisitedBottomSheet, WaypointInfoModal } from '../../components';
import { tripApi, ticketApi, reportApi } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { useWatchPosition } from '../../hooks';
import { calculateDistance, formatDistance, buildGoogleMapsDirectionsUrl } from '../../utils';
import type { Waypoint } from '../../types';

export const TripMapPage: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Tự động theo dõi GPS liên tục theo thời gian thực (Live Real-time GPS Tracking)
  const {
    location: geoLocation,
    error: geoError,
    accuracy: geoAccuracy,
    refresh: refreshLocation
  } = useWatchPosition({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000,
  });

  const {
    currentLocation,
    setCurrentLocation,
    nextHop,
    alternatives,
    setNextHop,
    bottomSheetExpanded,
    setBottomSheetExpanded,
    isLoadingNextHop,
    setIsLoadingNextHop,
  } = useAppStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState<{ lat: number; lng: number }[] | null>(null);
  const [showVisitedSheet, setShowVisitedSheet] = useState(false);
  const [waypointTickets, setWaypointTickets] = useState<Record<string, number>>({});
  const [centerTrigger, setCenterTrigger] = useState(0);

  // Nearby places (temp markers)
  const [nearbyPlaces, setNearbyPlaces] = useState<Array<{
    place_id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    rating?: number;
    type?: string;
  }>>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  // Waypoint info modal
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);
  const [showWaypointModal, setShowWaypointModal] = useState(false);

  // Toast for undo check-in
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastCheckedInWaypoint, setLastCheckedInWaypoint] = useState<Waypoint | null>(null);

  // Fetch trip data
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => tripApi.getTrip(tripId!),
    enabled: !!tripId,
  });

  // Hỗ trợ hiển thị điểm dừng từ cả waypoints lẫn fallback destinations
  const rawWaypointsSource = useMemo(() => {
    if (trip?.waypoints && trip.waypoints.length > 0) {
      return trip.waypoints;
    }
    if ((trip as any)?.destinations && (trip as any).destinations.length > 0) {
      return (trip as any).destinations;
    }
    return [];
  }, [trip]);

  const displayWaypoints = useMemo(() => {
    return rawWaypointsSource
      .map((waypoint: any, index: number) => {
        const lat = Number(waypoint.lat ?? waypoint.latitude);
        const lng = Number(waypoint.lng ?? waypoint.longitude);

        return {
          ...waypoint,
          id: waypoint.id || `waypoint-${index}`,
          name: waypoint.name || `Điểm dừng ${index + 1}`,
          lat,
          lng,
          type: waypoint.type || 'SCHOOL',
          visit_order: waypoint.visit_order || waypoint.order || (index + 1),
        };
      })
      .filter((waypoint: any) => Number.isFinite(waypoint.lat) && Number.isFinite(waypoint.lng));
  }, [rawWaypointsSource]);

  // Giải mã toàn bộ tuyến đường tổng thể (Trip Route Polyline)
  const tripRoute = useMemo(() => {
    const t = trip as any;
    if (t?.route_geometry && Array.isArray(t.route_geometry) && t.route_geometry.length > 1) {
      return t.route_geometry.map((pt: any) => ({
        lat: Number(pt[0]),
        lng: Number(pt[1])
      }));
    }
    if (t?.polyline) {
      try {
        const decoded = polyline.decode(t.polyline);
        return decoded.map((pt: [number, number]) => ({ lat: pt[0], lng: pt[1] }));
      } catch (e) {
        console.error('Error decoding trip polyline:', e);
      }
    }
    return undefined;
  }, [trip]);

  const mapName = trip?.name || (trip as (typeof trip & { title?: string }) | undefined)?.title || 'Bản đồ chuyến đi';

  // Reset state when trip changes
  useEffect(() => {
    setRoute(null);
    setNextHop(null, []);
  }, [tripId, setNextHop]);

  // Cập nhật vị trí GPS trực tiếp vào store khi có tín hiệu
  useEffect(() => {
    if (geoLocation) {
      setCurrentLocation(geoLocation);
    }
  }, [geoLocation, setCurrentLocation]);

  // Khởi tạo vị trí mặc định nếu chưa bật GPS
  useEffect(() => {
    if (!currentLocation && trip) {
      const t = trip as any;
      if (t.current_lat && t.current_lng) {
        setCurrentLocation({ lat: t.current_lat, lng: t.current_lng });
      } else if (t.start_point?.lat && t.start_point?.lng) {
        setCurrentLocation({ lat: t.start_point.lat, lng: t.start_point.lng });
      }
    }
  }, [trip, currentLocation, setCurrentLocation]);

  // Fetch next hop when location changes
  const fetchNextHop = useCallback(async () => {
    if (!tripId || !currentLocation) return;

    setIsLoadingNextHop(true);
    try {
      const response = await tripApi.getNextHop(tripId, {
        current_lat: currentLocation.lat,
        current_lng: currentLocation.lng,
      });
      setNextHop(response.recommended, response.alternatives);

      // Fetch route to recommended waypoint
      if (response.recommended) {
        try {
          const routeData = await tripApi.getDirections(
            tripId,
            currentLocation.lat,
            currentLocation.lng,
            response.recommended.waypoint.lat,
            response.recommended.waypoint.lng
          );

          // Decode Google Maps polyline
          if (routeData?.polyline) {
            const decoded = polyline.decode(routeData.polyline);
            // Convert from [lat, lng] to {lat, lng} format
            const routePoints = decoded.map(([lat, lng]: [number, number]) => ({ lat, lng }));
            setRoute(routePoints);
          } else {
            // Fallback: straight line
            setRoute([
              currentLocation,
              { lat: response.recommended.waypoint.lat, lng: response.recommended.waypoint.lng }
            ]);
          }
        } catch (err) {
          console.error('Error fetching route:', err);
          // Fallback: straight line
          setRoute([
            currentLocation,
            { lat: response.recommended.waypoint.lat, lng: response.recommended.waypoint.lng }
          ]);
        }
      } else {
        setRoute(null);
      }
    } catch (error) {
      console.error('Error fetching next hop:', error);
      setRoute(null);
    } finally {
      setIsLoadingNextHop(false);
    }
  }, [tripId, currentLocation, setIsLoadingNextHop, setNextHop]);

  // Fetch on initial load only (not on every location change)
  useEffect(() => {
    if (currentLocation && trip && !nextHop) {
      fetchNextHop();
    }
  }, [currentLocation, trip, nextHop, fetchNextHop]);

  // Fetch tickets for visited waypoints
  useEffect(() => {
    const fetchTickets = async () => {
      if (!trip?.waypoints) return;

      const visitedIds = trip.waypoints
        .filter(w => w.visited_at)
        .map(w => w.id);

      if (visitedIds.length === 0) return;

      try {
        const ticketPromises = visitedIds.map(async (waypointId) => {
          try {
            const tickets = await ticketApi.getAll(waypointId);
            // Tính tổng số phiếu thật sự thu được (tickets_collected), không phải số lần
            const totalTickets = tickets.reduce((sum, ticket) => sum + ticket.tickets_collected, 0);
            return { waypointId, count: totalTickets };
          } catch {
            return { waypointId, count: 0 };
          }
        });

        const results = await Promise.all(ticketPromises);
        const ticketMap: Record<string, number> = {};
        results.forEach(({ waypointId, count }) => {
          ticketMap[waypointId] = count;
        });

        setWaypointTickets(ticketMap);
      } catch (error) {
        console.error('Error fetching tickets:', error);
      }
    };

    fetchTickets();
  }, [trip?.waypoints]);

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: ({ waypointId, remote }: { waypointId: string; remote: boolean }) =>
      tripApi.checkIn(tripId!, {
        waypoint_id: waypointId,
        lat: currentLocation?.lat,
        lng: currentLocation?.lng,
        remote: remote,
        visited_at: new Date().toISOString(),  // Send device timestamp
      }),
    onSuccess: (data, { waypointId }) => {
      if (data.success) {
        // Show toast with undo option
        const waypoint = trip?.waypoints.find(w => w.id === waypointId);
        if (waypoint) {
          setLastCheckedInWaypoint(waypoint);
          setShowUndoToast(true);

          // Auto hide toast after 10 seconds
          setTimeout(() => {
            setShowUndoToast(false);
          }, 10000);
        }
      } else {
        // Show error message from backend
        alert(data.message || 'Check-in thất bại');
      }

      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      fetchNextHop();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || 'Lỗi khi check-in');
    },
  });

  // Undo check-in mutation
  const undoCheckInMutation = useMutation({
    mutationFn: (waypointId: string) =>
      tripApi.undoCheckIn(tripId!, waypointId),
    onSuccess: (data) => {
      if (data.success) {
        setShowUndoToast(false);
        setLastCheckedInWaypoint(null);
        alert(data.message || 'Đã hoàn tác check-in');
      } else {
        alert(data.message || 'Không thể hoàn tác');
      }

      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      fetchNextHop();
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || 'Lỗi khi hoàn tác');
    },
  });

  // Navigate to Google Maps bám sát 100% tuyến đường đã định tuyến
  const handleNavigate = useCallback(
    (waypoint: Waypoint) => {
      if (!currentLocation) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${waypoint.lat},${waypoint.lng}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      // Nếu đang chỉ đường đến điểm khuyến nghị (nextHop) và đã có route geometry
      const isNextHop = nextHop?.waypoint?.id === waypoint.id;
      const activeGeometry = isNextHop && route && route.length >= 10 ? route : undefined;

      const url = buildGoogleMapsDirectionsUrl(
        currentLocation,
        { lat: waypoint.lat, lng: waypoint.lng },
        activeGeometry
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [currentLocation, nextHop, route]
  );

  // Check-in handler với quy tắc bán kính 10m - 30m
  const handleCheckIn = useCallback(
    (waypoint: Waypoint) => {
      if (!currentLocation) {
        alert('Không xác định được vị trí GPS của bạn. Vui lòng bật định vị hoặc kiểm tra kết nối.');
        return;
      }

      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        waypoint.lat,
        waypoint.lng
      );

      const distanceText = formatDistance(distance);
      const isWithinRange = distance <= 30; // Quy chuẩn bán kính check-in 10 - 30m

      let confirmMessage = `Check-in tại: ${waypoint.name}\n\nKhoảng cách hiện tại: ${distanceText} (Quy định: ≤ 30m)`;
      let isRemoteCheckIn = false;

      if (!isWithinRange) {
        confirmMessage += `\n\n⚠️ CẢNH BÁO KHOẢNG CÁCH:\nBạn đang cách điểm đến ${distanceText}, vượt quá bán kính quy định (10m - 30m).\n\n`;
        confirmMessage += `Vui lòng di chuyển đến gần trường (trong vòng 30m) để hệ thống tự động ghi nhận.\n\n`;
        confirmMessage += `Nếu bạn đã có mặt thực tế tại trường (sai số GPS tòa nhà), bạn có muốn gửi yêu cầu Check-in ngay không?`;
        isRemoteCheckIn = true;

        if (!window.confirm(confirmMessage)) {
          return;
        }
      } else {
        confirmMessage += `\n\n✅ Vị trí hợp lệ! Bạn đang có mặt trong bán kính 30m của trường.`;
        if (!window.confirm(confirmMessage)) {
          return;
        }
      }

      checkInMutation.mutate({ waypointId: waypoint.id, remote: isRemoteCheckIn });
    },
    [checkInMutation, currentLocation]
  );

  // Center on current location
  const handleCenterLocation = useCallback(() => {
    refreshLocation();
    setCenterTrigger((prev) => prev + 1);
  }, [refreshLocation]);

  // Find nearby restaurants/hotels
  const handleFindRestaurants = useCallback(async () => {
    if (!currentLocation) {
      alert('Không xác định được vị trí hiện tại');
      return;
    }

    setIsSearchingPlaces(true);
    try {
      const result = await tripApi.searchNearbyPlaces(
        currentLocation.lat,
        currentLocation.lng,
        'quán ăn nhà hàng khách sạn',
        5000 // 5km radius
      );

      if (result.success && result.places.length > 0) {
        setNearbyPlaces(result.places);
        alert(`Tìm thấy ${result.total} địa điểm gần bạn!`);
      } else {
        alert('Không tìm thấy địa điểm nào gần bạn');
        setNearbyPlaces([]);
      }
    } catch (error) {
      console.error('Error searching places:', error);
      alert('Lỗi khi tìm kiếm địa điểm');
    } finally {
      setIsSearchingPlaces(false);
    }
  }, [currentLocation]);

  // Handle waypoint marker click
  const handleWaypointClick = useCallback((waypoint: Waypoint) => {
    setSelectedWaypoint(waypoint);
    setShowWaypointModal(true);
  }, []);

  if (tripLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Không tìm thấy chuyến đi</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-primary-500 font-medium"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const unvisitedWaypoints = displayWaypoints.filter((w: any) => !w.is_visited);
  const visitedWaypoints = displayWaypoints
    .filter((w: any) => w.is_visited)
    .sort((a: any, b: any) => new Date(b.visited_at!).getTime() - new Date(a.visited_at!).getTime());
  // Chỉ đếm trường chưa đi (SCHOOL), không tính các loại khác
  const unvisitedSchools = unvisitedWaypoints.filter((w: any) => w.type === 'SCHOOL');

  const tripCode = (trip as any)?.trip_code;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header - Fixed & Smart HUD */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-xs z-30 px-4 py-2.5 relative">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/staff/campaigns')}
            className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Quay lại danh sách chiến dịch"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="text-center flex-1 mx-3 min-w-0">
            <div className="flex items-center justify-center gap-2">
              <h1 className="font-bold text-slate-800 text-sm truncate" title={mapName}>
                {mapName}
              </h1>
              {tripCode && (
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-blue-50 text-[#0f3b7d] text-[10px] font-bold border border-blue-200">
                  {tripCode}
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-[11px] font-medium text-slate-500">
                Tiến độ: <strong className="text-[#0f3b7d]">{visitedWaypoints.length}/{Math.max(1, displayWaypoints.length)}</strong> điểm dừng ({Math.round((visitedWaypoints.length / Math.max(1, displayWaypoints.length)) * 100)}%)
              </span>
            </div>

            {/* Mini Progress Bar */}
            <div className="w-full max-w-xs mx-auto bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.round((visitedWaypoints.length / Math.max(1, displayWaypoints.length)) * 100)}%`,
                }}
              />
            </div>
          </div>

          <button
            onClick={() => setMenuOpen(true)}
            className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Menu tùy chọn"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Container - Flex grow to fill available space */}
      <div className="flex-1 relative bg-slate-100">
        <MapView
          key={tripId}
          currentLocation={currentLocation}
          waypoints={displayWaypoints}
          recommended={nextHop}
          route={route || undefined}
          tripRoute={tripRoute}
          onWaypointClick={handleWaypointClick}
          centerTrigger={centerTrigger}
          nearbyPlaces={nearbyPlaces}
        />

        {/* Floating GPS Status & Quick Test Tool (Top-Left) */}
        <div className="absolute left-3 top-3 z-[1000] flex flex-col gap-2 pointer-events-auto items-start">
          {/* GPS Live Status Pill */}
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-slate-200 flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                geoLocation ? 'bg-emerald-500 animate-ping' : geoError ? 'bg-red-500' : 'bg-amber-400'
              }`}
            />
            {geoLocation ? (
              <span>GPS Trực tiếp {geoAccuracy ? `(±${geoAccuracy}m)` : ''}</span>
            ) : geoError ? (
              <span className="text-red-600 text-[11px] truncate max-w-[170px]" title={geoError}>
                GPS: {geoError}
              </span>
            ) : (
              <span className="text-amber-600">Đang tìm tín hiệu GPS...</span>
            )}
          </div>

          {/* Quick Test Simulator Button (Để kiểm tra check-in 10-30m mà không cần đi ra ngoài) */}
          {nextHop?.waypoint && (
            <button
              type="button"
              onClick={() => {
                const targetLat = nextHop.waypoint.lat + 0.00012;
                const targetLng = nextHop.waypoint.lng + 0.00012;
                setCurrentLocation({ lat: targetLat, lng: targetLng, accuracy: 5 });
                alert(
                  `🎯 [Mô phỏng GPS]:\nĐã đặt vị trí của bạn cách cổng trường "${nextHop.waypoint.name}" ~18 mét.\nKhoảng cách này nằm trong bán kính quy định (10m - 30m).\n\nBây giờ bạn có thể bấm nút "Check-in" ngay lập tức!`
                );
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
              title="Đặt vị trí cách trường 18m để thử tính năng Check-in 10m - 30m"
            >
              <span>🎯 Thử GPS gần trường (18m)</span>
            </button>
          )}

          {/* Nút khôi phục vị trí GPS thật nếu đang mô phỏng */}
          {geoLocation && currentLocation && (currentLocation.lat !== geoLocation.lat || currentLocation.lng !== geoLocation.lng) && (
            <button
              type="button"
              onClick={() => {
                setCurrentLocation(geoLocation);
                alert('📍 Đã chuyển lại vị trí GPS thực tế từ thiết bị.');
              }}
              className="bg-slate-800/90 hover:bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm transition cursor-pointer"
            >
              ↩ Khôi phục GPS thật
            </button>
          )}
        </div>

        {/* Floating Buttons (Top-Right) */}
        <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-3 pointer-events-auto">
          {/* Recalculate button */}
          <button
            onClick={fetchNextHop}
            disabled={isLoadingNextHop}
            className={`bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 active:bg-gray-100 ${
              isLoadingNextHop ? 'animate-spin' : ''
            }`}
            title="Tính lại lộ trình"
          >
            <RefreshCw className="w-5 h-5 text-primary-600" />
          </button>

          {/* Center on location */}
          <button
            onClick={handleCenterLocation}
            className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 active:bg-gray-100"
            title="Về vị trí của tôi"
          >
            <MapPin className="w-5 h-5 text-slate-700" />
          </button>

          {/* Find nearby places */}
          <button
            onClick={handleFindRestaurants}
            disabled={isSearchingPlaces}
            className={`bg-orange-500 p-3 rounded-full shadow-lg hover:bg-orange-600 active:bg-orange-700 ${
              isSearchingPlaces ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Tìm quán ăn gần đây"
          >
            <Utensils className={`w-5 h-5 text-white ${isSearchingPlaces ? 'animate-pulse' : ''}`} />
          </button>

          {/* Clear nearby places if showing */}
          {nearbyPlaces.length > 0 && (
            <button
              onClick={() => setNearbyPlaces([])}
              className="bg-red-500 p-3 rounded-full shadow-lg hover:bg-red-600 active:bg-red-700 text-white font-bold"
              title="Xóa địa điểm tìm được"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Toggle Button - Fixed above bottom sheet, tách ra khỏi bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t">
        <div className="flex gap-2 p-2">
          <button
            onClick={() => setShowVisitedSheet(false)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${!showVisitedSheet
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            Chưa đi ({unvisitedSchools.length})
          </button>
          <button
            onClick={() => setShowVisitedSheet(true)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${showVisitedSheet
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            Đã đi ({visitedWaypoints.length})
          </button>
        </div>
      </div>

      {/* Bottom Sheet - Fixed at bottom, thêm margin-bottom để không bị che bởi thanh Chưa đi/Đã đi */}
      <div className="pb-[56px]"> {/* 56px là chiều cao của thanh Chưa đi/Đã đi */}
        {!showVisitedSheet ? (
          <BottomSheet
            isExpanded={bottomSheetExpanded}
            onToggle={() => setBottomSheetExpanded(!bottomSheetExpanded)}
            recommended={nextHop}
            alternatives={alternatives}
            totalUnvisited={unvisitedSchools.length}
            totalUnvisitedSchools={unvisitedSchools.length}
            isLoading={isLoadingNextHop}
            onNavigate={handleNavigate}
            onCheckIn={handleCheckIn}
            onSelectWaypoint={handleWaypointClick}
            currentLocation={currentLocation}
          />
        ) : (
          <VisitedBottomSheet
            isExpanded={bottomSheetExpanded}
            onToggle={() => setBottomSheetExpanded(!bottomSheetExpanded)}
            visitedWaypoints={visitedWaypoints}
            isLoading={false}
            onSelectWaypoint={handleWaypointClick}
            currentLocation={currentLocation}
            waypointTickets={waypointTickets}
          />
        )}
      </div>

      {/* Menu Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg">{mapName}</h2>
              <p className="text-sm text-gray-500">
                {trip.visited_count}/{trip.total_waypoints} điểm
              </p>
            </div>

            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  navigate(`/trips/${tripId}/edit`);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
              >
                <span>✏️</span>
                <span>Chỉnh sửa chuyến đi</span>
              </button>

              <button
                onClick={async () => {
                  setMenuOpen(false);

                  if (!window.confirm('Tạo báo cáo cho chuyến đi này?\n\nQuá trình tạo báo cáo có thể mất 1-2 phút.')) return;

                  // Show loading toast
                  const loadingToast = document.createElement('div');
                  loadingToast.id = 'report-loading-toast';
                  loadingToast.className = 'fixed top-4 right-4 z-[9999] bg-blue-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-sm';
                  loadingToast.innerHTML = `
                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <div>
                      <div class="font-semibold">Đang tạo báo cáo...</div>
                      <div class="text-sm opacity-90">Vui lòng đợi trong giây lát</div>
                    </div>
                  `;
                  document.body.appendChild(loadingToast);

                  try {
                    // Start background job - returns job_id immediately
                    // Use client-side time for report creation
                    const createdAt = new Date().toISOString();
                    const { job_id } = await reportApi.generateReport(tripId!, createdAt);

                    // Update toast to show we're polling
                    const progressEl = document.createElement('div');
                    progressEl.id = 'report-progress';
                    progressEl.className = 'text-sm opacity-90';
                    progressEl.textContent = '0%';
                    loadingToast.querySelector('div:last-child')!.appendChild(progressEl);

                    // Stop polling after 60 minutes max
                    const timeoutId = setTimeout(() => {
                      clearInterval(pollInterval);
                      loadingToast.remove();
                      alert('Timeout: Quá thời gian chờ (60p). Vui lòng kiểm tra lại trong danh sách báo cáo.');
                    }, 3600000);

                    // Poll for status every 2 seconds
                    const pollInterval = setInterval(async () => {
                      try {
                        const jobStatus = await reportApi.getJobStatus(job_id);

                        // Update progress
                        const prog = document.getElementById('report-progress');
                        if (prog) prog.textContent = `${jobStatus.progress}%`;

                        if (jobStatus.status === 'completed') {
                          clearInterval(pollInterval);
                          clearTimeout(timeoutId); // Clear the timeout!
                          loadingToast.remove();

                          // Show success toast
                          const successToast = document.createElement('div');
                          successToast.id = 'report-success-toast';
                          successToast.className = 'fixed top-4 right-4 z-[9999] bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg max-w-md';
                          successToast.innerHTML = `
                            <div class="flex items-start gap-3">
                              <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                              <div class="flex-1">
                                <div class="font-semibold mb-2">Tạo báo cáo thành công!</div>
                                <div class="flex gap-2 flex-wrap">
                                  <button onclick="window.location.href='/reports/${jobStatus.result_report_id}'" class="bg-white text-green-600 px-4 py-2 rounded font-medium hover:bg-green-50 transition-colors">
                                    Xem báo cáo
                                  </button>
                                  <button onclick="this.closest('#report-success-toast').remove()" class="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700 border border-white transition-colors">
                                    Tiếp tục
                                  </button>
                                </div>
                              </div>
                              <button onclick="this.closest('#report-success-toast').remove()" class="text-white hover:text-gray-200">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                            </div>
                          `;
                          document.body.appendChild(successToast);
                          setTimeout(() => successToast.remove(), 15000);

                        } else if (jobStatus.status === 'failed') {
                          clearInterval(pollInterval);
                          clearTimeout(timeoutId); // Clear the timeout!
                          loadingToast.remove();

                          const errorToast = document.createElement('div');
                          errorToast.className = 'fixed top-4 right-4 z-[9999] bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg max-w-md';
                          errorToast.innerHTML = `
                            <div class="flex items-start gap-3">
                              <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                              <div class="flex-1">
                                <div class="font-semibold mb-1">Lỗi tạo báo cáo</div>
                                <div class="text-sm opacity-90">${jobStatus.error_message || 'Vui lòng thử lại'}</div>
                              </div>
                              <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                            </div>
                          `;
                          document.body.appendChild(errorToast);
                          setTimeout(() => errorToast.remove(), 8000);
                        }
                      } catch (pollError) {
                        console.error('Poll error:', pollError);
                      }
                    }, 2000);

                  } catch (error: any) {
                    document.getElementById('report-loading-toast')?.remove();

                    const errorToast = document.createElement('div');
                    errorToast.className = 'fixed top-4 right-4 z-[9999] bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg max-w-md';
                    errorToast.innerHTML = `
                      <div class="flex items-start gap-3">
                        <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        <div class="flex-1">
                          <div class="font-semibold mb-1">Lỗi tạo báo cáo</div>
                          <div class="text-sm opacity-90">${error?.response?.data?.detail || error?.message || 'Vui lòng thử lại'}</div>
                        </div>
                        <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      </div>
                    `;
                    document.body.appendChild(errorToast);
                    setTimeout(() => errorToast.remove(), 8000);
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
              >
                <span>📊</span>
                <span>Tạo báo cáo</span>
              </button>

              <button
                onClick={() => {
                  navigate('/reports');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
              >
                <span>📋</span>
                <span>Xem tất cả báo cáo</span>
              </button>

              <button
                onClick={() => {
                  navigate('/');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
              >
                <span>📋</span>
                <span>Danh sách chuyến đi</span>
              </button>
            </div>

            {/* Location Error */}
            {geoError && (
              <div className="p-4 m-4 bg-red-50 rounded-lg">
                <p className="text-red-600 text-sm">{geoError}</p>
                <button
                  onClick={refreshLocation}
                  className="text-primary-500 text-sm font-medium mt-2"
                >
                  Thử lại
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Waypoint Info Modal */}
      <WaypointInfoModal
        waypoint={selectedWaypoint}
        isOpen={showWaypointModal}
        onClose={() => {
          setShowWaypointModal(false);
          setSelectedWaypoint(null);
        }}
      />

      {/* Undo Check-in Toast */}
      {showUndoToast && lastCheckedInWaypoint && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-slide-up">
          <div className="bg-green-600 text-white p-4 rounded-lg shadow-lg flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold">✓ Đã check-in tại {lastCheckedInWaypoint.name}</p>
              <p className="text-sm text-green-100">Nhấm nhầm? Bạn có 10 giây để hoàn tác</p>
            </div>
            <button
              onClick={() => {
                if (lastCheckedInWaypoint) {
                  undoCheckInMutation.mutate(lastCheckedInWaypoint.id);
                }
              }}
              disabled={undoCheckInMutation.isPending}
              className="ml-4 px-4 py-2 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 active:bg-green-100 disabled:opacity-50"
            >
              {undoCheckInMutation.isPending ? 'Đang xử lý...' : 'Hoàn tác'}
            </button>
            <button
              onClick={() => setShowUndoToast(false)}
              className="ml-2 text-white hover:text-green-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMapPage;

