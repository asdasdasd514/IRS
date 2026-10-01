import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import {
  Compass,
  Users,
  Calendar,
  Car,
  Route,
  Navigation,
  Search,
  Building2,
  ExternalLink,
  Crosshair,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play,
  Layers,
  Award,
  X,
} from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';
import { campaignApi, authApi } from '../../services/api';

// Fix icon Leaflet mặc định
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Marker Icons
const createCustomMarkerIcon = (
  label: string,
  isStart: boolean = false,
  isMyAssigned: boolean = false,
  isActive: boolean = false
) => {
  let bgColor = '#10b981'; // Xanh lá mặc định cho điểm trường
  let borderColor = '#ffffff';
  let size = 28;
  let haloClass = '';

  if (isStart) {
    bgColor = '#0f3b7d'; // Xanh navy cho điểm xuất phát
    size = 32;
  } else if (isMyAssigned) {
    bgColor = '#f59e0b'; // Vàng cam cho điểm staff được phân công
    borderColor = '#ffffff';
    size = 32;
    haloClass = 'box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.4), 0 3px 10px rgba(0,0,0,0.3);';
  }

  if (isActive) {
    bgColor = '#ef4444'; // Đỏ khi đang được chọn
    size = 34;
    haloClass = 'box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0,0,0,0.35);';
  } else if (!haloClass) {
    haloClass = 'box-shadow: 0 2px 8px rgba(15, 59, 125, 0.28);';
  }

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 9999px;
        background: ${bgColor};
        border: 2.5px solid ${borderColor};
        ${haloClass}
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${size > 30 ? 12 : 11}px;
        font-weight: 800;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        ${label}
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Map Controller để pan/zoom mượt mà
function MapController({
  center,
  zoom,
  bounds,
}: {
  center?: [number, number];
  zoom?: number;
  bounds?: L.LatLngBoundsExpression;
}) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom || 15, { duration: 0.8 });
    } else if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch {
        // ignore invalid bounds
      }
    }
  }, [center, zoom, bounds, map]);
  return null;
}

export function StaffCampaignsPage() {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [systemStaffList, setSystemStaffList] = useState<any[]>([]);

  // Lọc theo người dùng (Mặc định là người dùng đang đăng nhập)
  const [selectedStaffId] = useState<string>(() => user?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter] = useState<'all' | 'assigned' | 'active' | 'completed'>('all');

  // Chiến dịch và Điểm trường đang chọn để focus trên bản đồ
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [activeStop, setActiveStop] = useState<any | null>(null);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Record<string, boolean>>({});

  // GPS vị trí hiện tại của cán bộ
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.is_admin;

  // Tải dữ liệu từ backend
  const loadData = async () => {
    try {
      setLoading(true);
      const allCamps = await campaignApi.getAll();
      setCampaigns(Array.isArray(allCamps) ? allCamps : []);

      // Nếu là Admin, lấy danh sách cán bộ để có thể chọn xem theo góc nhìn của từng người
      if (isAdmin) {
        try {
          const users = await authApi.listUsers({ role: 'staff' });
          if (Array.isArray(users) && users.length > 0) {
            setSystemStaffList(users);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Error loading staff campaigns data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lấy đối tượng Staff đang được chọn xem
  const activeStaff = useMemo(() => {
    if (!selectedStaffId) return user;
    const found = systemStaffList.find((s) => s.id === selectedStaffId || s._id === selectedStaffId);
    return found || user;
  }, [selectedStaffId, systemStaffList, user]);

  // Kiểm tra xem 1 cán bộ có thuộc danh sách phân bổ hay không
  const isStaffAssigned = (staffList: any[] | undefined, targetStaff: any): boolean => {
    if (!staffList || !Array.isArray(staffList) || !targetStaff) return false;
    const targetId = String(targetStaff.id || targetStaff._id || '').toLowerCase().trim();
    const targetName = String(targetStaff.full_name || targetStaff.name || targetStaff.username || '').toLowerCase().trim();
    const targetEmail = String(targetStaff.email || '').toLowerCase().trim();
    const targetUsername = String(targetStaff.username || '').toLowerCase().trim();

    return staffList.some((s) => {
      if (!s) return false;
      if (typeof s === 'string') {
        const sStr = s.toLowerCase().trim();
        return (
          (targetId && sStr === targetId) ||
          (targetName && (sStr === targetName || sStr.includes(targetName) || targetName.includes(sStr))) ||
          (targetUsername && (sStr === targetUsername || sStr.includes(targetUsername) || targetUsername.includes(sStr))) ||
          (targetEmail && sStr === targetEmail)
        );
      }
      const sId = String(s.id || s._id || '').toLowerCase().trim();
      const sName = String(s.name || s.full_name || s.username || '').toLowerCase().trim();
      const sEmail = String(s.email || '').toLowerCase().trim();
      const sUsername = String(s.username || '').toLowerCase().trim();

      return (
        (targetId && sId && targetId === sId) ||
        (targetName && sName && (targetName === sName || targetName.includes(sName) || sName.includes(targetName))) ||
        (targetUsername && sUsername && targetUsername === sUsername) ||
        (targetEmail && sEmail && targetEmail === sEmail)
      );
    });
  };

  // Kiểm tra cán bộ có được phân công trong chiến dịch hay không
  const isUserAssignedToCamp = (camp: any, targetUser: any): boolean => {
    if (!targetUser) return false;
    const userName = String(targetUser.full_name || targetUser.name || targetUser.username || '').toLowerCase().trim();

    // 1. Trưởng đoàn
    const leaderName = String(camp.team?.leader_name || '').toLowerCase().trim();
    if (leaderName && userName && (leaderName === userName || leaderName.includes(userName) || userName.includes(leaderName))) {
      return true;
    }

    // 2. Thành viên đoàn (team.members)
    if (isStaffAssigned(camp.team?.members, targetUser)) {
      return true;
    }

    // 3. Phân công từng điểm dừng (stop_assignments)
    if (camp.team?.stop_assignments && typeof camp.team.stop_assignments === 'object') {
      const hasInStop = Object.values(camp.team.stop_assignments).some((list) =>
        isStaffAssigned(list as any[], targetUser)
      );
      if (hasInStop) return true;
    }

    // 4. Điểm xuất phát (start_point.assigned_staff)
    if (isStaffAssigned(camp.start_point?.assigned_staff, targetUser)) {
      return true;
    }

    // 5. Điểm đến mục tiêu (destinations[...].assigned_staff)
    if (Array.isArray(camp.destinations)) {
      const hasInDest = camp.destinations.some((d: any) =>
        isStaffAssigned(d.assigned_staff, targetUser)
      );
      if (hasInDest) return true;
    }

    return false;
  };

  // Lọc các chiến dịch: Ai được phân công trong chiến dịch đó thì bên tổng quan chiến dịch sẽ hiển thị chiến dịch đó
  const allocatedCampaignsForStaff = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return [];

    return campaigns.filter((camp) => {
      // Phải là chiến dịch có phân bổ đoàn/điểm đến hoặc có trạng thái đã phân bổ/đang chạy/hoàn thành
      const hasTeam = Boolean(camp.team && (camp.team.leader_name || camp.team.members?.length > 0 || camp.team.stop_assignments));
      const isAllocatedStatus = ['assigned', 'deployed', 'active', 'completed'].includes(camp.status);
      if (!hasTeam && !isAllocatedStatus) return false;

      // Nếu là Admin: hiển thị tất cả các chiến dịch đã phân bổ trong hệ thống
      if (isAdmin) return true;

      // Nếu là Cán bộ: CHỈ hiển thị những chiến dịch mà cán bộ đó được phân công
      return isUserAssignedToCamp(camp, user);
    });
  }, [campaigns, user, isAdmin]);

  // Lọc theo tìm kiếm và trạng thái
  const filteredCampaigns = useMemo(() => {
    return allocatedCampaignsForStaff.filter((camp) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'assigned' && camp.status !== 'assigned') return false;
        if (statusFilter === 'active' && camp.status !== 'active' && camp.status !== 'deployed') return false;
        if (statusFilter === 'completed' && camp.status !== 'completed') return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const nameMatch = (camp.name || '').toLowerCase().includes(q);
      const codeMatch = (camp.deployed_trip_id || camp.id || '').toLowerCase().includes(q);
      const schoolMatch = (camp.destinations || []).some((d: any) =>
        (d.name || '').toLowerCase().includes(q) || (d.address || '').toLowerCase().includes(q)
      );

      return nameMatch || codeMatch || schoolMatch;
    });
  }, [allocatedCampaignsForStaff, statusFilter, searchQuery]);

  // Chọn chiến dịch: mở dropdown chi tiết và mở bản đồ tương ứng
  const handleSelectCampaign = (cId: string) => {
    if (selectedCampaignId === cId) {
      toggleExpand(cId);
    } else {
      setSelectedCampaignId(cId);
      setExpandedCampaignIds((prev) => ({ ...prev, [cId]: true }));
      setActiveStop(null);
    }
  };

  // Chiến dịch đang được chọn để hiển thị chi tiết và bản đồ (chỉ có khi đã chọn chiến dịch)
  const currentCampaign = useMemo(() => {
    if (!selectedCampaignId) return null;
    return filteredCampaigns.find((c) => (c.id || c._id) === selectedCampaignId) || null;
  }, [filteredCampaigns, selectedCampaignId]);

  // Danh sách các điểm dừng trên bản đồ của chiến dịch hiện tại
  const mapPoints = useMemo(() => {
    if (!currentCampaign) return [];

    const points: any[] = [];

    // Điểm xuất phát
    if (currentCampaign.start_point && currentCampaign.start_point.lat && currentCampaign.start_point.lng) {
      const isAssigned = isStaffAssigned(currentCampaign.start_point.assigned_staff, activeStaff);
      points.push({
        ...currentCampaign.start_point,
        isStart: true,
        label: 'S',
        isMyAssigned: isAssigned,
      });
    }

    // Các điểm trường
    (currentCampaign.destinations || []).forEach((dest: any, idx: number) => {
      if (dest.lat && dest.lng) {
        const isAssigned = isStaffAssigned(dest.assigned_staff, activeStaff);
        points.push({
          ...dest,
          isStart: false,
          label: String(idx + 1),
          order: idx + 1,
          isMyAssigned: isAssigned,
        });
      }
    });

    return points;
  }, [currentCampaign, activeStaff]);

  // Bảng màu cho từng chặng riêng biệt (tránh trùng màu / chung đường)
  const LEG_COLORS = [
    '#2563eb', // Chặng 1: Xanh dương đậm
    '#059669', // Chặng 2: Xanh ngọc
    '#7c3aed', // Chặng 3: Tím hoàng gia
    '#ea580c', // Chặng 4: Cam hổ phách
    '#db2777', // Chặng 5: Hồng ruby
    '#0891b2', // Chặng 6: Xanh mòng két
  ];

  // Danh sách các chặng riêng biệt kèm tọa độ đường bộ của từng chặng
  const individualLegs = useMemo(() => {
    if (!currentCampaign) return [];
    const dests = currentCampaign.destinations || [];
    const legs: Array<{
      index: number;
      fromName: string;
      toName: string;
      distanceText: string;
      durationText: string;
      geometry: [number, number][];
      color: string;
      destId: string;
    }> = [];

    dests.forEach((dest: any, idx: number) => {
      const prevName = idx === 0
        ? (currentCampaign.start_point?.name || 'Điểm xuất phát')
        : (dests[idx - 1]?.name || `Điểm dừng ${idx}`);
      
      const geom = (dest.leg_geometry && Array.isArray(dest.leg_geometry) && dest.leg_geometry.length > 1)
        ? dest.leg_geometry
        : [];

      legs.push({
        index: idx + 1,
        fromName: prevName,
        toName: dest.name || `Điểm dừng ${idx + 1}`,
        distanceText: dest.distance_text || '',
        durationText: dest.duration_text || '',
        geometry: geom,
        color: LEG_COLORS[idx % LEG_COLORS.length],
        destId: dest.id || dest.school_id || String(idx),
      });
    });

    return legs;
  }, [currentCampaign]);

  const hasIndividualLegGeometries = useMemo(() => {
    return individualLegs.length > 0 && individualLegs.some((l) => l.geometry.length > 1);
  }, [individualLegs]);

  // Hàm tạo độ lệch nhẹ để các chặng song hành/ngược chiều không bị đè mất nhau
  const getOffsetGeometry = (coords: [number, number][], legIdx: number): [number, number][] => {
    if (!coords || coords.length < 2 || legIdx === 0) return coords;
    const offset = (legIdx % 2 === 1 ? 1 : -1) * Math.ceil(legIdx / 2) * 0.00008;
    return coords.map(([lat, lng]) => [lat + offset, lng + offset]);
  };

  // Tọa độ vẽ đường polyline
  const polylinePositions = useMemo<[number, number][]>(() => {
    if (!currentCampaign) return [];

    // Ưu tiên route_geometry (tọa độ polyline chi tiết đường bộ)
    if (currentCampaign.route_geometry && Array.isArray(currentCampaign.route_geometry) && currentCampaign.route_geometry.length > 1) {
      return currentCampaign.route_geometry;
    }

    // Fallback: nối thẳng các điểm
    return mapPoints
      .filter((p) => p.lat != null && p.lng != null && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)))
      .map((p) => [Number(p.lat), Number(p.lng)]);
  }, [currentCampaign, mapPoints]);

  // Bounds bản đồ để tự động zoom vừa toàn bộ lộ trình
  const mapBounds = useMemo(() => {
    const coords: [number, number][] = [];
    polylinePositions.forEach((pos) => coords.push(pos));
    mapPoints.forEach((p) => {
      if (p.lat && p.lng && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng))) {
        coords.push([Number(p.lat), Number(p.lng)]);
      }
    });

    if (coords.length === 0) {
      // Tọa độ mặc định (Việt Nam / Cần Thơ / TP.HCM)
      return L.latLngBounds([[10.0452, 105.7469], [10.05, 105.75]]);
    }
    return L.latLngBounds(coords);
  }, [polylinePositions, mapPoints]);

  // Tâm bản đồ khi bấm chọn 1 điểm dừng cụ thể
  const activeCenter = useMemo<[number, number] | undefined>(() => {
    if (activeStop && activeStop.lat && activeStop.lng && !isNaN(Number(activeStop.lat)) && !isNaN(Number(activeStop.lng))) {
      return [Number(activeStop.lat), Number(activeStop.lng)];
    }
    return undefined;
  }, [activeStop]);

  // Lấy vị trí GPS hiện tại của cán bộ
  const handleGetMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMyLocation(coords);
        setActiveStop({
          name: 'Vị trí hiện tại của bạn',
          address: 'Tọa độ GPS thiết bị',
          lat: coords[0],
          lng: coords[1],
          isMyLocation: true,
        });
        setGettingLocation(false);
      },
      (err) => {
        console.error('GPS error:', err);
        alert('Không thể xác định vị trí hiện tại. Vui lòng cấp quyền truy cập vị trí trên trình duyệt.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Mở Google Maps chỉ đường
  const handleOpenGoogleMapsDirection = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const toggleExpand = (cId: string) => {
    setExpandedCampaignIds((prev) => ({
      ...prev,
      [cId]: !prev[cId],
    }));
  };

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* 1. Header Banner & Profile Card */}
      {/* 3. Bố cục chính: Cột trái Danh sách Chiến dịch & Cột phải Bản đồ tương tác */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CỘT TRÁI: DANH SÁCH CHIẾN DỊCH & ĐỊA ĐIỂM (5 CỘT) */}
        <div className={`${currentCampaign ? 'lg:col-span-5' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} space-y-4`}>
          {/* Thanh tìm kiếm & Dropdown chọn chiến dịch */}
          <div className="bg-white p-3.5 rounded-[5px] border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm tên chiến dịch, mã chuyến, tên trường..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-[5px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden transition"
                />
              </div>

              {/* Dropdown chọn chiến dịch */}
              <div className="sm:w-72">
                <select
                  aria-label="Chọn chiến dịch"
                  value={selectedCampaignId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setSelectedCampaignId(null);
                      setActiveStop(null);
                    } else {
                      handleSelectCampaign(val);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-[5px] bg-blue-50/80 border border-blue-200 text-[#0f3b7d] focus:bg-white focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] outline-hidden transition cursor-pointer"
                >
                  <option value="">▼ Chọn chiến dịch xem bản đồ...</option>
                  {filteredCampaigns.map((camp) => {
                    const cId = camp.id || camp._id;
                    const leaderText = camp.team?.leader_name ? ` (Trưởng đoàn: ${camp.team.leader_name})` : '';
                    return (
                      <option key={cId} value={cId}>
                        {camp.name}{leaderText}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Thông báo trạng thái đang xem bản đồ */}
            {currentCampaign ? (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-[5px] text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Compass className="w-4 h-4 text-[#0f3b7d] shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">
                    Đang hiển thị bản đồ: <strong className="text-[#0f3b7d]">{currentCampaign.name}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCampaignId(null);
                    setActiveStop(null);
                  }}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline shrink-0 ml-2 cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Ẩn bản đồ</span>
                </button>
              </div>
            ) : filteredCampaigns.length > 0 ? (
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-[5px] text-xs text-slate-500 flex items-center gap-2">
                <Compass className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Bấm vào một chiến dịch bên dưới hoặc chọn từ menu thả xuống để mở bản đồ lộ trình chi tiết.</span>
              </div>
            ) : null}
          </div>

          {/* Danh sách các chiến dịch */}
          {loading ? (
            <div className="p-12 bg-white rounded-[5px] border border-slate-200 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold">Đang tải danh sách chiến dịch phân bổ...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((camp) => {
                const cId = camp.id || camp._id;
                const isSelected = currentCampaign && (currentCampaign.id === cId || currentCampaign._id === cId);
                const isExpanded = Boolean(expandedCampaignIds[cId]);
                const destinations = camp.destinations || [];
                const members = camp.team?.members || [];
                const isLeader =
                  String(camp.team?.leader_name || '').toLowerCase() ===
                  String(activeStaff?.full_name || activeStaff?.username || '').toLowerCase();

                // Đếm số trường staff này phụ trách trong chiến dịch này
                const myAssignedCountInThisCamp = destinations.filter((d: any) =>
                  isStaffAssigned(d.assigned_staff, activeStaff)
                ).length + (isStaffAssigned(camp.start_point?.assigned_staff, activeStaff) ? 1 : 0);

                return (
                  <div
                    key={cId}
                    className={`bg-white rounded-[5px] border transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Header Thẻ Chiến dịch */}
                    <div
                      onClick={() => handleSelectCampaign(cId)}
                      className="p-3.5 cursor-pointer hover:bg-slate-50/60 transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {camp.deployed_trip_id && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0f3b7d] font-mono text-[10px] font-bold">
                                {camp.deployed_trip_id.slice(0, 10).toUpperCase()}
                              </span>
                            )}
                            {isLeader && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                                <Award className="w-3 h-3" />
                                Trưởng đoàn
                              </span>
                            )}
                            {myAssignedCountInThisCamp > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                {myAssignedCountInThisCamp} điểm phụ trách
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                            {camp.name}
                          </h3>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {camp.status === 'completed' ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                              Hoàn thành
                            </span>
                          ) : camp.status === 'active' || camp.status === 'deployed' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold animate-pulse">
                              Đang công tác
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#0f3b7d] text-[10px] font-bold">
                              Đã phân bổ
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Thông số chuyến đi */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {camp.start_date
                              ? new Date(camp.start_date).toLocaleDateString('vi-VN')
                              : 'Chưa đặt ngày'}
                            {camp.end_date ? ` - ${new Date(camp.end_date).toLocaleDateString('vi-VN')}` : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Route className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {destinations.length} điểm trường • {camp.estimated_distance_km ? `${camp.estimated_distance_km}km` : 'Đang tính'}
                          </span>
                        </div>

                        {camp.team?.vehicle_plate && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate font-semibold text-slate-700">Xe: {camp.team.vehicle_plate}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Đoàn: {members.length > 0 ? `${members.length} người` : 'Chưa xếp'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách các điểm dừng dạng accordion */}
                    <div className="border-t border-slate-100 bg-slate-50/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(cId);
                        }}
                        className="w-full px-3.5 py-2 flex items-center justify-between text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          Xem danh sách các điểm dừng ({destinations.length + (camp.start_point ? 1 : 0)})
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-3.5 pb-3 pt-1 space-y-1.5 divide-y divide-slate-100">
                          {/* Điểm xuất phát nếu có */}
                          {camp.start_point && (
                            <div
                              onClick={() => {
                                setSelectedCampaignId(cId);
                                setActiveStop({
                                  ...camp.start_point,
                                  isStart: true,
                                  label: 'S',
                                });
                              }}
                              className={`pt-2 flex items-start gap-2.5 p-2 rounded-[5px] cursor-pointer transition ${
                                activeStop?.isStart && isSelected
                                  ? 'bg-blue-100/70 border border-blue-300'
                                  : 'hover:bg-white'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-full bg-[#0f3b7d] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                S
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-slate-800 truncate">
                                    {camp.start_point.name}
                                  </h4>
                                  <span className="px-1.5 py-0.2 bg-blue-100 text-[#0f3b7d] rounded text-[9px] font-bold">
                                    Xuất phát
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {camp.start_point.address || 'Điểm tập kết đoàn công tác'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Các điểm trường mục tiêu */}
                          {destinations.map((dest: any, idx: number) => {
                            const isMyDest = isStaffAssigned(dest.assigned_staff, activeStaff);
                            const isActiveDest =
                              activeStop &&
                              !activeStop.isStart &&
                              (activeStop.id === dest.id || activeStop.school_id === dest.school_id || (activeStop.lat === dest.lat && activeStop.lng === dest.lng));

                            return (
                              <div
                                key={dest.id || idx}
                                onClick={() => {
                                  setSelectedCampaignId(cId);
                                  setActiveStop({
                                    ...dest,
                                    isStart: false,
                                    label: String(idx + 1),
                                    order: idx + 1,
                                    isMyAssigned: isMyDest,
                                  });
                                }}
                                className={`pt-2 flex items-start gap-2.5 p-2 rounded-[5px] cursor-pointer transition ${
                                  isActiveDest && isSelected
                                    ? 'bg-red-50 border border-red-300'
                                    : isMyDest
                                    ? 'bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/60'
                                    : 'hover:bg-white'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                    isMyDest ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-emerald-600'
                                  }`}
                                >
                                  {idx + 1}
                                </span>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="text-xs font-bold text-slate-800 truncate">
                                      {dest.name}
                                    </h4>
                                    {isMyDest && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-extrabold flex items-center gap-0.5">
                                        ⭐ Bạn phụ trách
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {dest.address || 'Chưa cập nhật địa chỉ'}
                                  </p>

                                  {/* Thông tin chặng đường */}
                                  {(dest.distance_text || dest.duration_text) && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                        style={{
                                          backgroundColor: `${LEG_COLORS[idx % LEG_COLORS.length]}18`,
                                          color: LEG_COLORS[idx % LEG_COLORS.length],
                                        }}
                                      >
                                        <Navigation className="w-2.5 h-2.5" />
                                        Chặng {idx + 1}: {dest.distance_text} {dest.duration_text ? `• ~${dest.duration_text}` : ''}
                                      </span>
                                    </div>
                                  )}

                                  {/* Hiển thị cán bộ phụ trách điểm này */}
                                  {dest.assigned_staff && dest.assigned_staff.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-600 flex-wrap">
                                      <span className="text-slate-400">Phụ trách:</span>
                                      {dest.assigned_staff.map((st: any, sIdx: number) => (
                                        <span
                                          key={sIdx}
                                          className={`px-1 py-0.2 rounded text-[9px] font-medium ${
                                            (st.id && st.id === activeStaff?.id) || st.name === activeStaff?.full_name
                                              ? 'bg-amber-200 text-amber-900 font-bold'
                                              : 'bg-slate-200/70 text-slate-700'
                                          }`}
                                        >
                                          {st.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer Thao tác Thẻ */}
                    <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectCampaign(cId)}
                        className={`text-xs font-bold flex items-center gap-1.5 py-1 px-2.5 rounded-[5px] transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#0f3b7d] text-white'
                            : 'text-[#0f3b7d] hover:text-[#0c2f64] hover:bg-blue-50'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>{isSelected ? 'Đang xem bản đồ' : 'Xem lộ trình trên bản đồ'}</span>
                      </button>

                      {/* Nút mở chuyến đi thực tế để check-in và ghi chú */}
                      {camp.deployed_trip_id ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/trips/${camp.deployed_trip_id}`)}
                          className="px-2.5 py-1 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                          title="Mở ứng dụng điều hướng thực địa"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Vào công tác</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Chờ kích hoạt</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: BẢN ĐỒ LỘ TRÌNH VÀ CÁC ĐỊA ĐIỂM (CHỈ HIỂN THỊ KHI ĐÃ CHỌN CHIẾN DỊCH) */}
        {currentCampaign && (
          <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-[650px] lg:h-[720px] relative">
            {/* Top Bar bên trên Bản đồ */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 z-10">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-800 truncate">
                    {currentCampaign ? currentCampaign.name : 'Bản đồ tuyển sinh lưu động'}
                  </h3>
                </div>
                {currentCampaign && (
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Lộ trình: {mapPoints.length} điểm • {currentCampaign.estimated_distance_km ? `${currentCampaign.estimated_distance_km} km` : ''} •{' '}
                    {currentCampaign.estimated_duration_minutes ? `~${currentCampaign.estimated_duration_minutes} phút di chuyển` : ''}
                  </p>
                )}
              </div>

              {/* Các nút công cụ trên bản đồ */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleGetMyLocation}
                  disabled={gettingLocation}
                  className="px-2.5 py-1.5 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Tìm vị trí GPS hiện tại của tôi"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${gettingLocation ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Vị trí của tôi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStop(null)}
                  className="px-2.5 py-1.5 rounded-[5px] bg-blue-50 hover:bg-blue-100 text-[#0f3b7d] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Xem toàn bộ lộ trình"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Toàn tuyến</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCampaignId(null);
                    setActiveStop(null);
                  }}
                  className="px-2.5 py-1.5 rounded-[5px] bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Ẩn bản đồ"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ẩn bản đồ</span>
                </button>
              </div>
            </div>

            {/* Container Bản đồ Leaflet */}
            <div className="flex-1 w-full h-full relative">
              {/* Floating Legend hiển thị các chặng độc lập */}
              {hasIndividualLegGeometries && individualLegs.length > 0 && (
                <div className="absolute top-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-[5px] border border-slate-200 shadow-md flex items-center gap-3 text-[11px] pointer-events-auto">
                  {individualLegs.map((leg, lIdx) => (
                    <div key={lIdx} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: leg.color }}></span>
                      <span className="font-bold text-slate-800">Chặng {leg.index}:</span>
                      <span className="text-slate-600 font-medium">{leg.distanceText || '...'}</span>
                    </div>
                  ))}
                </div>
              )}

              <MapContainer
                key={currentCampaign.id || currentCampaign._id}
                bounds={mapBounds}
                boundsOptions={{ padding: [40, 40] }}
                scrollWheelZoom={true}
                zoomControl={true}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapController
                  center={activeCenter}
                  zoom={15}
                  bounds={!activeCenter ? mapBounds : undefined}
                />

                {/* Đường dẫn lộ trình: Vẽ từng chặng với màu sắc riêng biệt hoặc đường fallback */}
                {hasIndividualLegGeometries ? (
                  individualLegs.map((leg, lIdx) => {
                    if (leg.geometry.length < 2) return null;
                    const isLegActive = activeStop && (activeStop.order === leg.index || activeStop.id === leg.destId);
                    const displayGeom = getOffsetGeometry(leg.geometry, lIdx);
                    return (
                      <Polyline
                        key={`leg-${lIdx}`}
                        positions={displayGeom}
                        color={leg.color}
                        weight={isLegActive ? 7 : 5}
                        opacity={isLegActive ? 1 : 0.88}
                        eventHandlers={{
                          click: () => {
                            if (currentCampaign?.destinations?.[lIdx]) {
                              const dest = currentCampaign.destinations[lIdx];
                              setActiveStop({
                                ...dest,
                                isStart: false,
                                label: String(lIdx + 1),
                                order: lIdx + 1,
                              });
                            }
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-1 min-w-[190px] text-xs">
                            <span 
                              className="inline-block px-1.5 py-0.5 rounded font-bold text-[10px] text-white uppercase mb-1"
                              style={{ backgroundColor: leg.color }}
                            >
                              Chặng {leg.index}
                            </span>
                            <h4 className="font-bold text-slate-800 text-xs">
                              {leg.fromName} ➔ {leg.toName}
                            </h4>
                            <div className="flex items-center gap-2 text-slate-600 text-[11px] mt-1">
                              <span>Khoảng cách: <strong>{leg.distanceText || 'N/A'}</strong></span>
                              <span>•</span>
                              <span>Thời gian: <strong>{leg.durationText || 'N/A'}</strong></span>
                            </div>
                          </div>
                        </Popup>
                      </Polyline>
                    );
                  })
                ) : (
                  polylinePositions.length > 1 && (
                    <Polyline
                      positions={polylinePositions}
                      color="#2563eb"
                      weight={5}
                      opacity={0.85}
                    />
                  )
                )}

                {/* Điểm GPS người dùng nếu có */}
                {myLocation && (
                  <Marker
                    position={myLocation}
                    icon={L.divIcon({
                      html: `
                        <div style="
                          width: 22px;
                          height: 22px;
                          border-radius: 9999px;
                          background: #3b82f6;
                          border: 3px solid white;
                          box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.35);
                        "></div>
                      `,
                      className: '',
                      iconSize: [22, 22],
                      iconAnchor: [11, 11],
                    })}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <strong className="text-blue-700">Vị trí hiện tại của bạn</strong>
                        <p className="text-[11px] text-slate-500">Được định vị qua GPS thiết bị</p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Markers các điểm xuất phát & các trường học */}
                {mapPoints.map((point, index) => {
                  const lat = Number(point.lat);
                  const lng = Number(point.lng);
                  if (isNaN(lat) || isNaN(lng)) return null;

                  const isActive =
                    activeStop &&
                    ((point.isStart && activeStop.isStart) ||
                      (point.school_id && activeStop.school_id === point.school_id) ||
                      (point.id && activeStop.id === point.id) ||
                      (point.lat === activeStop.lat && point.lng === activeStop.lng));

                  return (
                    <Marker
                      key={`${point.name}-${index}`}
                      position={[lat, lng]}
                      icon={createCustomMarkerIcon(
                        point.label || String(index + 1),
                        point.isStart,
                        point.isMyAssigned,
                        isActive
                      )}
                      eventHandlers={{
                        click: () => setActiveStop(point),
                      }}
                    >
                      <Popup>
                        <div className="p-1 min-w-[220px] text-xs">
                          {point.isStart ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-[#0f3b7d] font-bold text-[10px] uppercase mb-1">
                              Điểm xuất phát
                            </span>
                          ) : (
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 uppercase">
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px]">
                                  {point.label}
                                </span>
                                Điểm dừng {point.label}
                              </span>
                              {point.isMyAssigned && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold">
                                  ⭐ Bạn phụ trách
                                </span>
                              )}
                            </div>
                          )}

                          <h4 className="font-bold text-slate-900 text-sm leading-snug">{point.name}</h4>
                          <p className="text-slate-600 text-[11px] mt-1">{point.address || 'Không có địa chỉ'}</p>

                          {/* Cán bộ phụ trách */}
                          {point.assigned_staff && point.assigned_staff.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-slate-100">
                              <p className="text-[10px] font-semibold text-slate-500 mb-1">Cán bộ phụ trách:</p>
                              <div className="flex flex-wrap gap-1">
                                {point.assigned_staff.map((st: any, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-slate-700 text-[10px] font-medium"
                                  >
                                    {st.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Thao tác trong Popup */}
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenGoogleMapsDirection(lat, lng)}
                              className="px-2 py-1 rounded-[4px] bg-blue-50 text-[#0f3b7d] hover:bg-blue-100 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>Chỉ đường</span>
                            </button>

                            {point.school_id && (
                              <Link
                                to={`/schools/${point.school_id}`}
                                className="px-2 py-1 rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Hồ sơ trường</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* Chú giải Map (Legend) ở góc dưới bản đồ */}
              <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md p-2.5 rounded-[5px] border border-slate-200 shadow-sm text-xs space-y-1.5 pointer-events-auto">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Chú thích điểm dừng</p>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#0f3b7d] text-white flex items-center justify-center text-[9px] font-bold">
                    S
                  </span>
                  <span className="text-[11px] text-slate-700">Điểm xuất phát</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#f59e0b] text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-amber-300">
                    ★
                  </span>
                  <span className="text-[11px] font-bold text-amber-800">Điểm bạn phụ trách</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#10b981] text-white flex items-center justify-center text-[9px] font-bold">
                    1
                  </span>
                  <span className="text-[11px] text-slate-700">Điểm trường trong đoàn</span>
                </div>
              </div>

              {/* Chi tiết điểm đang chọn hiển thị nổi bật dạng Floating Panel */}
              {activeStop && (
                <div className="absolute top-3 right-3 z-[1000] max-w-sm w-full bg-white/95 backdrop-blur-md p-3.5 rounded-[5px] border border-slate-200 shadow-lg text-xs animate-scale-up">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-[#0f3b7d] text-[10px] font-bold uppercase">
                        {activeStop.isStart ? 'Điểm xuất phát' : `Điểm dừng ${activeStop.label || ''}`}
                      </span>
                      {activeStop.isMyAssigned && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                          ⭐ Bạn phụ trách
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveStop(null)}
                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 mt-1">{activeStop.name}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">{activeStop.address || 'Không có địa chỉ'}</p>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenGoogleMapsDirection(Number(activeStop.lat), Number(activeStop.lng))}
                      className="flex-1 py-1.5 px-2.5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Mở Google Maps chỉ đường</span>
                    </button>

                    {activeStop.school_id && (
                      <Link
                        to={`/schools/${activeStop.school_id}`}
                        className="py-1.5 px-2.5 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Hồ sơ trường</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default StaffCampaignsPage;
