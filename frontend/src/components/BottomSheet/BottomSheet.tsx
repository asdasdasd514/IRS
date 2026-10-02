import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Navigation,
  CheckCircle,
  Clock,
  MapPin,
  Car,
  Info,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';
import type { NextHopCandidate, Waypoint, Location } from '../../types';
import { calculateDistance } from '../../utils';

interface BottomSheetProps {
  isExpanded: boolean;
  onToggle: () => void;
  recommended: NextHopCandidate | null;
  alternatives: NextHopCandidate[];
  totalUnvisited: number;
  totalUnvisitedSchools: number;
  isLoading: boolean;
  onNavigate: (waypoint: Waypoint) => void;
  onCheckIn: (waypoint: Waypoint) => void;
  onSelectWaypoint: (waypoint: Waypoint) => void;
  onCompleteRestStop?: (waypoint: Waypoint) => void;
  onRemoveRestStop?: (waypointId: string) => void;
  currentLocation: Location | null;
  allWaypoints?: Waypoint[];
  visitedWaypoints?: Waypoint[];
  waypointTickets?: Record<string, number>;
  trip?: any;
  showVisitedSheet?: boolean;
  onToggleVisitedSheet?: (show: boolean) => void;
}

// Trích xuất địa danh/tỉnh thành ngắn gọn khớp phong cách Hình 2 ("Đồng Nai → BR Vũng Tàu")
function extractLocationName(name: string, address?: string): string {
  const text = `${address || ''} ${name || ''}`.toLowerCase();
  if (text.includes('vũng tàu') || text.includes('bà rịa') || text.includes('brvt')) return 'BR Vũng Tàu';
  if (text.includes('đồng nai') || text.includes('biên hòa') || text.includes('long thành') || text.includes('nhơn trạch')) return 'Đồng Nai';
  if (text.includes('bình dương') || text.includes('thủ dầu một') || text.includes('dĩ an') || text.includes('thuận an')) return 'Bình Dương';
  if (text.includes('hồ chí minh') || text.includes('tp.hcm') || text.includes('sài gòn') || text.includes('thủ đức')) return 'TP. Hồ Chí Minh';
  if (text.includes('tây ninh')) return 'Tây Ninh';
  if (text.includes('bình phước')) return 'Bình Phước';
  if (text.includes('long an')) return 'Long An';
  if (text.includes('tiền giang') || text.includes('mỹ tho')) return 'Tiền Giang';
  if (text.includes('cần thơ')) return 'Cần Thơ';
  if (text.includes('bình thuận') || text.includes('phan thiết')) return 'Bình Thuận';
  if (text.includes('lâm đồng') || text.includes('đà lạt')) return 'Lâm Đồng';
  return name.replace('Trường THPT ', '').replace('Trường Đại học ', 'ĐH ').replace('THPT ', '');
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isExpanded,
  onToggle,
  recommended,
  alternatives: _alternatives,
  totalUnvisited: _totalUnvisited,
  totalUnvisitedSchools,
  isLoading,
  onNavigate,
  onCheckIn,
  onSelectWaypoint,
  onCompleteRestStop,
  onRemoveRestStop,
  currentLocation,
  allWaypoints = [],
  visitedWaypoints = [],
  waypointTickets = {},
  trip,
  showVisitedSheet = false,
  onToggleVisitedSheet,
}) => {
  // Thứ tự hiển thị timeline: Mặc định true = Dưới lên trên (Điểm đi trước ở dưới, điểm tiếp theo ở trên)
  const [isBottomUp, setIsBottomUp] = useState(true);
  const recommendedRef = useRef<HTMLDivElement | null>(null);

  // Tự động cuộn tới điểm tiếp theo (Màu ĐỎ) khi mở rộng thẻ
  useEffect(() => {
    if (isExpanded && recommendedRef.current) {
      const timer = setTimeout(() => {
        recommendedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, isBottomUp]);

  // Xác định điểm đầu và điểm cuối cho phụ đề lộ trình (VD: "Đồng Nai → BR Vũng Tàu")
  const { startName, routeSubtitle } = useMemo(() => {
    let sName = trip?.start_point?.name || '';
    let sAddress = trip?.start_point?.address || '';
    let eName = '';
    let eAddress = '';

    if (!sName && allWaypoints.length > 0) {
      sName = allWaypoints[0].name;
      sAddress = allWaypoints[0].address || '';
    }
    if (allWaypoints.length > 1) {
      eName = allWaypoints[allWaypoints.length - 1].name;
      eAddress = allWaypoints[allWaypoints.length - 1].address || '';
    } else if (trip?.destinations && trip.destinations.length > 0) {
      eName = trip.destinations[trip.destinations.length - 1].name;
      eAddress = trip.destinations[trip.destinations.length - 1].address || '';
    }

    if (!sName) sName = 'Điểm xuất phát';
    if (!eName) eName = recommended?.waypoint?.name || 'Điểm đến';

    const cleanS = extractLocationName(sName, sAddress);
    const cleanE = extractLocationName(eName, eAddress);

    return {
      startName: sName,
      endName: eName,
      routeSubtitle: `${cleanS} → ${cleanE}`,
    };
  }, [trip, allWaypoints, recommended]);

  // Kiểm tra điểm đề xuất có phải là điểm dừng chân/quán ăn không
  const isRecommendedRestStop = recommended?.waypoint?.type === 'REST_STOP';

  // Khoảng cách GPS thực tế từ vị trí hiện tại đến điểm đề xuất
  const distToRecommended = currentLocation && recommended
    ? calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        recommended.waypoint.lat,
        recommended.waypoint.lng
      )
    : null;
  const isInsideCheckInRange = distToRecommended !== null && distToRecommended <= 30;

  // Xây dựng danh sách toàn bộ các chặng timeline theo đúng trình tự thời gian
  const timelineNodes = useMemo(() => {
    // 1. Phân loại các điểm dừng:
    // a) Điểm đã ghé (visited): sắp xếp theo thời gian ghé hoặc visit_order
    const visitedList = allWaypoints
      .filter((w) => w.is_visited)
      .sort((a, b) => {
        const tA = a.visited_at ? new Date(a.visited_at).getTime() : 0;
        const tB = b.visited_at ? new Date(b.visited_at).getTime() : 0;
        return tA - tB || (a.visit_order || 0) - (b.visit_order || 0);
      });

    // b) Điểm chưa đi (unvisited)
    const unvisitedList = allWaypoints.filter((w) => !w.is_visited);

    // c) Xác định điểm tiếp theo (recommended) - điểm cần đi tới ngay bây giờ (Màu ĐỎ ⭐)
    const recWp = recommended?.waypoint
      ? unvisitedList.find((w) => w.id === recommended.waypoint.id) || null
      : unvisitedList[0] || null;

    // d) Các điểm chưa đi còn lại (loại trừ điểm recommended)
    // Sắp xếp các điểm còn lại theo thứ tự ghé thăm (visit_order)
    const remainingUnvisited = unvisitedList
      .filter((w) => !recWp || w.id !== recWp.id)
      .sort((a, b) => {
        const orderA = a.visit_order ?? 999;
        const orderB = b.visit_order ?? 999;
        return orderA - orderB;
      });

    // e) Chuỗi hành trình từ Xuất phát -> Điểm đã ghé -> Điểm đến tiếp theo (ĐỎ) -> Các chặng tiếp theo -> Đích đến:
    const chronologicalWaypoints: Waypoint[] = [];
    chronologicalWaypoints.push(...visitedList);
    if (recWp) {
      chronologicalWaypoints.push(recWp);
    }
    chronologicalWaypoints.push(...remainingUnvisited);

    // Điểm kết thúc thực sự của toàn bộ chuyến đi là điểm chưa đi cuối cùng
    const finalWaypointId = remainingUnvisited.length > 0
      ? remainingUnvisited[remainingUnvisited.length - 1].id
      : (chronologicalWaypoints.length > 0 ? chronologicalWaypoints[chronologicalWaypoints.length - 1].id : null);

    // 2. Điểm xuất phát
    const startNode = {
      isStart: true,
      id: 'start-point',
      name: startName,
      timeText: `Điểm xuất phát • ${trip?.start_point?.preferred_time || '07:00 AM'}`,
      isRec: false,
      isVisited: true,
      isLast: false,
      isRestStop: false,
      waypoint: null as Waypoint | null,
    };

    // 3. Chuyển đổi các waypoints thành timeline nodes
    const waypointNodes = chronologicalWaypoints.map((wp) => {
      const isRec = recWp?.id === wp.id;
      const isRestStop = wp.type === 'REST_STOP';
      const isFinalDestination = wp.id === finalWaypointId && !isRec && !wp.is_visited;

      let timeText = (wp as any).preferred_visit_time
        ? `Dự kiến đến: ${(wp as any).preferred_visit_time}`
        : (isRec && recommended?.duration_text ? `Dự kiến đến sau ${recommended.duration_text}` : 'Theo thứ tự chặng');

      if (wp.is_visited) {
        timeText = wp.visited_at
          ? `Đã ghé: ${new Date(wp.visited_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
          : 'Đã hoàn tất check-in';
      }

      return {
        isStart: false,
        id: wp.id,
        name: wp.name,
        timeText: isFinalDestination ? `Điểm kết thúc • ${timeText}` : timeText,
        isRec,
        isVisited: !!wp.is_visited,
        isLast: isFinalDestination,
        isRestStop,
        waypoint: wp,
      };
    });

    // Danh sách toàn bộ chặng theo thứ tự thời gian từ lúc Xuất phát đến Đích đến:
    // [Start, (Đã đi...), Điểm tiếp theo (ĐỎ), Các điểm sắp tới..., Điểm kết thúc (ĐÍCH ĐẾN)]
    const fullChronologicalList = [startNode, ...waypointNodes];

    // Nếu isBottomUp = true: Điểm đi trước (Xuất phát, đã đi, chặng trước) ở DƯỚI,
    // các điểm tiếp theo và đích đến ở BÊN TRÊN
    // -> Đảo ngược danh sách:
    // [Điểm kết thúc (TRÊN CÙNG), ..., Điểm tiếp theo (ĐỎ), (Đã đi...), Điểm xuất phát (DƯỚI CÙNG)]
    return isBottomUp ? [...fullChronologicalList].reverse() : fullChronologicalList;
  }, [startName, trip, allWaypoints, recommended, isBottomUp]);

  return (
    <div
      className={`absolute bottom-4 left-4 z-[1000] w-[calc(100%-2rem)] max-w-sm sm:max-w-md bg-white/98 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/90 transition-all duration-300 pointer-events-auto flex flex-col overflow-hidden ${
        isExpanded ? 'max-h-[82vh]' : 'max-h-[175px]'
      }`}
    >
      {/* ========================================================================= */}
      {/* HEADER CARD - CHUẨN ĐỒNG BỘ THEO HÌNH 2 */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          {/* Biểu tượng ô tô trong hình tròn xanh dương nhạt (Khớp hình 2) */}
          <div className="w-11 h-11 rounded-full bg-[#E8F1FC] text-[#1A56DB] flex items-center justify-center shrink-0 shadow-xs">
            <Car className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Chi tiết lộ trình</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">{routeSubtitle}</p>
          </div>
        </div>

        {/* Nút hành động góc phải */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Nút đảo chiều thứ tự hiển thị (Dưới lên / Trên xuống) */}
          {isExpanded && !showVisitedSheet && (
            <button
              onClick={() => setIsBottomUp(!isBottomUp)}
              className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
              title={isBottomUp ? "Đang hiển thị: Điểm đi trước ở DƯỚI, điểm tiếp theo ở TRÊN. Bấm để đổi sang Trên xuống." : "Đang hiển thị: Trên xuống. Bấm để đổi sang Dưới lên."}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-slate-700 hidden sm:inline">
                {isBottomUp ? 'Dưới lên ↑' : 'Trên xuống ↓'}
              </span>
            </button>
          )}

          {/* Nút thu nhỏ / mở rộng */}
          <button
            onClick={onToggle}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            title={isExpanded ? 'Thu gọn thẻ' : 'Mở rộng chi tiết lộ trình'}
          >
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Tabs chuyển đổi Lộ trình chưa đi / Đã ghé */}
      {onToggleVisitedSheet && (
        <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggleVisitedSheet(false)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              !showVisitedSheet
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>Lộ trình ({allWaypoints.filter(w => !w.is_visited).length})</span>
          </button>
          <button
            onClick={() => onToggleVisitedSheet(true)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              showVisitedSheet
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Đã đi ({visitedWaypoints.length})</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2.5 text-xs text-slate-600 font-medium">Đang tối ưu chặng tiếp theo...</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. COLLAPSED VIEW (Khi thu nhỏ: hiển thị điểm tiếp theo gọn gàng và nút thao tác) */}
      {/* ========================================================================= */}
      {!isLoading && !isExpanded && !showVisitedSheet && recommended && (
        <div className="px-4 py-3 bg-white">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {isRecommendedRestStop ? (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200 flex items-center gap-1 animate-pulse">
                    ⭐ Điểm dừng ăn uống (Đi tới ngay)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-200 flex items-center gap-1">
                    ⭐ Điểm tiếp theo ({totalUnvisitedSchools} trường)
                  </span>
                )}
              </div>
              <h4 className={`text-sm font-bold truncate ${
                isRecommendedRestStop ? 'text-red-600' : 'text-slate-900'
              }`}>
                {isRecommendedRestStop && '🍽️ '}
                {recommended.waypoint.name}
              </h4>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-blue-600 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3" />
                {recommended.duration_text}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                <MapPin className="w-2.5 h-2.5" />
                {recommended.distance_text}
              </div>
            </div>
          </div>

          {/* Quick buttons */}
          {isRecommendedRestStop ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate(recommended.waypoint)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                Chỉ đường tới quán
              </button>
              {onCompleteRestStop && (
                <button
                  onClick={() => onCompleteRestStop(recommended.waypoint)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs transition"
                  title="Xác nhận đã ghé ăn uống xong để tiếp tục đi đến trường tiếp theo"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Đã ghé xong
                </button>
              )}
              {onRemoveRestStop && (
                <button
                  onClick={() => onRemoveRestStop(recommended.waypoint.id)}
                  className="px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl font-bold text-xs transition"
                  title="Xóa quán khỏi lộ trình"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate(recommended.waypoint)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                Chỉ đường
              </button>
              <button
                onClick={() => onCheckIn(recommended.waypoint)}
                className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs transition ${
                  isInsideCheckInRange
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isInsideCheckInRange ? 'Check-in (Đã tới nơi)' : 'Check-in'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EXPANDED VIEW - TIMELINE LỘ TRÌNH (ĐI TRƯỚC Ở DƯỚI, TIẾP THEO Ở TRÊN) */}
      {/* ========================================================================= */}
      {!isLoading && isExpanded && !showVisitedSheet && (
        <div className="p-4 sm:p-5 pt-3 overflow-y-auto flex-1 relative bg-white">
          {/* Đường kẻ dọc xám liên tục kết nối các chặng (Chạy dọc từ trên xuống dưới) */}
          <div className={`absolute left-[27px] sm:left-[31px] top-7 bottom-8 w-[2px] z-0 ${
            isBottomUp
              ? 'bg-gradient-to-t from-slate-200 via-blue-200 to-[#0F3A66]'
              : 'bg-slate-200'
          }`} />

          {/* Gợi ý hướng di chuyển */}
          {isBottomUp && (
            <div className="flex items-center justify-end text-[10px] text-slate-400 font-medium pb-1.5 gap-1">
              <span>Hướng lộ trình: từ dưới lên trên</span>
              <span className="text-blue-600 font-bold">▲</span>
            </div>
          )}

          <div className="space-y-6 relative z-10">
            {timelineNodes.map((node) => {
              // 1. Render Icon cho từng loại điểm
              let nodeIcon = (
                // Vòng tròn xám nhạt trung gian (Khớp THPT Phú Mỹ trong Hình 2)
                <div className="w-6 h-6 rounded-full border-[3.5px] border-[#CBD5E1] bg-white ring-4 ring-white shadow-xs shrink-0 mt-0.5" />
              );

              if (node.isStart) {
                // Điểm xuất phát: Vòng tròn rỗng viền xanh navy đậm (Khớp hình 2)
                nodeIcon = (
                  <div className="w-6 h-6 rounded-full border-[3.5px] border-[#0F3A66] bg-white ring-4 ring-white shadow-xs shrink-0 mt-0.5" />
                );
              } else if (node.isLast && !node.isRec && !node.isVisited) {
                // Điểm kết thúc: Hình tròn xanh đậm chứa ghim định vị (Khớp THPT Vũng Tàu trong Hình 2)
                nodeIcon = (
                  <div className="w-6 h-6 rounded-full bg-[#0F3A66] text-white flex items-center justify-center ring-4 ring-white shadow-xs shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                );
              } else if (node.isRec) {
                // ĐIỂM TIẾP THEO / ĐIỂM ĂN UỐNG MỚI THÊM (NỔI BẬT MÀU ĐỎ ⭐)
                nodeIcon = (
                  <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center ring-4 ring-red-100 shadow-md animate-pulse text-[11px] font-bold shrink-0 mt-0.5">
                    ⭐
                  </div>
                );
              } else if (node.isVisited) {
                // Đã check-in: Màu xanh lá có dấu check
                nodeIcon = (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ring-white shadow-xs text-xs font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                );
              } else if (node.isRestStop) {
                // Quán ăn chưa tới lượt: Viền cam biểu tượng thìa dĩa
                nodeIcon = (
                  <div className="w-6 h-6 rounded-full border-[2.5px] border-orange-500 bg-orange-50 text-orange-600 flex items-center justify-center ring-4 ring-white shadow-xs text-[11px] shrink-0 mt-0.5">
                    🍽️
                  </div>
                );
              }

              return (
                <div
                  key={node.id}
                  ref={node.isRec ? recommendedRef : undefined}
                  className={`flex items-start gap-3.5 p-2 rounded-2xl transition ${
                    node.isRec ? 'bg-red-50/70 border border-red-200' : 'hover:bg-slate-50'
                  }`}
                >
                  {nodeIcon}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className={`font-bold text-sm leading-snug ${
                        node.isRec
                          ? 'text-red-600'
                          : node.isVisited && !node.isStart
                          ? 'text-slate-500 line-through'
                          : 'text-slate-900'
                      }`}>
                        {node.isRestStop && '🍽️ '}
                        {node.name}
                      </h4>

                      {/* Huy hiệu */}
                      {node.isStart && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                          Khởi hành
                        </span>
                      )}
                      {node.isRec && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500 text-white font-bold text-[10px] shadow-xs">
                          {node.isRestStop ? '⭐ Điểm ăn uống (Đi tới ngay)' : '⭐ Điểm tiếp theo'}
                        </span>
                      )}
                      {node.isRestStop && !node.isRec && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold text-[10px] border border-orange-200">
                          Quán ăn
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                      <span>{node.timeText}</span>
                      {node.isRec && recommended?.distance_text && (
                        <span className="text-emerald-700 font-semibold">📍 {recommended.distance_text}</span>
                      )}
                    </p>

                    {/* Nút hành động nhanh trong thẻ */}
                    {node.isRec && node.waypoint && (
                      <div className="flex gap-2 mt-2 pt-1.5 border-t border-red-100">
                        {node.isRestStop ? (
                          <>
                            <button
                              onClick={() => onNavigate(node.waypoint!)}
                              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Chỉ đường tới quán
                            </button>
                            {onCompleteRestStop && (
                              <button
                                onClick={() => onCompleteRestStop(node.waypoint!)}
                                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                                title="Xác nhận đã ghé xong để tiếp tục sang trường tiếp theo"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Đã ghé xong
                              </button>
                            )}
                            {onRemoveRestStop && (
                              <button
                                onClick={() => onRemoveRestStop(node.waypoint!.id)}
                                className="bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                                title="Xóa quán khỏi lộ trình"
                              >
                                ✕ Xóa
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onNavigate(node.waypoint!)}
                              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Chỉ đường
                            </button>
                            <button
                              onClick={() => onCheckIn(node.waypoint!)}
                              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Check-in
                            </button>
                            <button
                              onClick={() => onSelectWaypoint(node.waypoint!)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Info className="w-3.5 h-3.5" />
                              Chi tiết
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Nút xóa nhanh nếu là quán ăn chưa tới lượt */}
                    {!node.isRec && node.isRestStop && !node.isVisited && node.waypoint && onRemoveRestStop && (
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => onRemoveRestStop(node.waypoint!.id)}
                          className="text-[11px] text-slate-400 hover:text-red-500 font-medium flex items-center gap-1 transition"
                        >
                          ✕ Xóa quán khỏi lộ trình
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW DANH SÁCH ĐÃ ĐI */}
      {/* ========================================================================= */}
      {!isLoading && showVisitedSheet && (
        <div className="p-4 sm:p-5 pt-3 overflow-y-auto flex-1 bg-white space-y-2.5">
          {visitedWaypoints.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              Chưa có điểm nào được check-in trong chuyến này
            </div>
          ) : (
            visitedWaypoints.map((wp) => {
              const isRestStop = wp.type === 'REST_STOP';

              return (
                <div
                  key={wp.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <h5 className="font-bold text-slate-800 text-xs truncate">
                        {isRestStop && '🍽️ '}
                        {wp.name}
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isRestStop
                        ? (wp.visited_at
                            ? `Đã ghé: ${new Date(wp.visited_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Đã ghé ăn uống')
                        : (wp.visited_at
                            ? `Đã ghé: ${new Date(wp.visited_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Đã hoàn tất check-in')}
                    </p>
                    {!isRestStop && waypointTickets[wp.id] !== undefined && waypointTickets[wp.id] > 0 && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                        🎫 {waypointTickets[wp.id]} phiếu thu thập
                      </span>
                    )}
                  </div>

                  {/* Quán ăn không hiển thị nút Xem thông tin trường học */}
                  {!isRestStop && (
                    <button
                      onClick={() => onSelectWaypoint(wp)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shrink-0"
                    >
                      Xem
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default BottomSheet;
