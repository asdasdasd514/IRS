import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  Plus,
  Building2,
  Clock,
  Sparkles,
  Search,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  Trash2,
  X,
  ExternalLink,
  Route,
  Users,
  UserCheck,
  UserPlus,
  Car,
  Shield,
  AlertCircle,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Edit,
  GripVertical,
} from 'lucide-react';
import { campaignApi, schoolApi, authApi, tripApi } from '../../../services/api';

const routeMarkerIcon = (color: string, label: string) =>
  L.divIcon({
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 9999px;
        background: ${color};
        border: 2.5px solid white;
        box-shadow: 0 3px 10px rgba(15, 59, 125, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: 700;
      ">${label}</div>
    `,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });

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
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

const calculateDepartureTime = (visitTime?: string, durationMinutes: number = 60): string => {
  if (!visitTime) return '';
  const parts = visitTime.split(':');
  if (parts.length < 2) return '';
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return '';
  const totalM = h * 60 + m + (durationMinutes || 60);
  const endH = Math.floor(totalM / 60) % 24;
  const endM = totalM % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

function CampaignRouteMap({
  startPoint,
  destinations,
  routeGeometry,
  activeSchool,
  onSelectSchool,
}: {
  startPoint?: any;
  destinations: any[];
  routeGeometry?: [number, number][];
  activeSchool?: any;
  onSelectSchool?: (school: any) => void;
}) {
  const navigate = useNavigate();
  const routePoints = [
    startPoint,
    ...(destinations || [])
  ].filter((p) => p && p.lat != null && p.lng != null && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)));

  if (routePoints.length === 0) {
    return (
      <div className="h-full min-h-[360px] rounded-[5px] border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <Building2 className="w-10 h-10 text-slate-300 mb-2" />
        <p className="font-semibold text-slate-600 text-sm">Chưa có dữ liệu tuyến đường</p>
        <p className="text-xs text-slate-400 mt-1">Danh sách trường học hoặc điểm xuất phát chưa có tọa độ GPS hợp lệ.</p>
      </div>
    );
  }

  const polylinePositions: [number, number][] =
    routeGeometry && routeGeometry.length > 1
      ? (routeGeometry as [number, number][])
      : (routePoints.map((point) => [Number(point.lat), Number(point.lng)]) as [number, number][]);

  const bounds = L.latLngBounds(polylinePositions as [number, number][]);

  const activeCenter: [number, number] | undefined =
    activeSchool?.lat != null && activeSchool?.lng != null && !isNaN(Number(activeSchool.lat)) && !isNaN(Number(activeSchool.lng))
      ? [Number(activeSchool.lat), Number(activeSchool.lng)]
      : undefined;

  return (
    <div className="h-full min-h-[380px] w-full overflow-hidden rounded-[5px] border border-slate-200 shadow-2xs relative">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [35, 35] }}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ height: '100%', minHeight: '380px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController center={activeCenter} zoom={15} bounds={!activeCenter ? bounds : undefined} />

        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            color="#2563eb"
            weight={5}
            opacity={0.85}
          />
        )}

        {/* Điểm xuất phát nếu có */}
        {startPoint && startPoint.lat != null && startPoint.lng != null && !isNaN(Number(startPoint.lat)) && (
          <Marker
            position={[Number(startPoint.lat), Number(startPoint.lng)]}
            icon={routeMarkerIcon('#0f3b7d', 'S')}
            eventHandlers={{
              click: () => onSelectSchool && onSelectSchool(startPoint),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[180px] text-xs">
                <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-[#0f3b7d] font-bold text-[10px] uppercase mb-1">
                  Điểm xuất phát
                </span>
                <h4 className="font-bold text-slate-900 text-sm leading-snug">{startPoint.name}</h4>
                <p className="text-slate-600 text-[11px] mt-1">{startPoint.address || 'Không có địa chỉ'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Các điểm trường mục tiêu */}
        {destinations.map((point, index) => {
          const lat = Number(point.lat);
          const lng = Number(point.lng);
          if (isNaN(lat) || isNaN(lng)) return null;

          const isActive =
            activeSchool &&
            ((point.school_id && activeSchool.school_id === point.school_id) ||
              (point.id && activeSchool.id === point.id) ||
              (activeSchool.lat === point.lat && activeSchool.lng === point.lng));

          return (
            <Marker
              key={`${point.school_id || point.id || point.name}-${index}`}
              position={[lat, lng]}
              icon={routeMarkerIcon(isActive ? '#ef4444' : '#16a34a', String(index + 1))}
              eventHandlers={{
                click: () => onSelectSchool && onSelectSchool(point),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[210px] text-xs">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
                      {index + 1}
                    </span>
                    <span className="text-emerald-800 font-bold uppercase text-[10px]">
                      Điểm dừng {index + 1}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm leading-snug">{point.name}</h4>
                  {point.code && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">
                      Mã: {point.code}
                    </span>
                  )}
                  <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">{point.address || 'Chưa có địa chỉ'}</p>

                  {(point.distance_text || point.duration_text) && (
                    <div className="mt-2 py-1 px-2 rounded-lg bg-blue-50 text-blue-900 text-[11px] font-medium flex items-center justify-between">
                      <span>Chặng đi:</span>
                      <strong>{point.distance_text} ~ {point.duration_text}</strong>
                    </div>
                  )}

                  {(point.school_id || point.id) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/schools/${point.school_id || point.id}`)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                      >
                        <span>Xem hồ sơ trường</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export function AdminCampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const setActionMessage = (_msg: string | null) => {};
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Tab chính: 'campaigns' (Chiến dịch) hoặc 'assignment' (Phân công)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'assignment'>('campaigns');

  // Modal Xem chi tiết chiến dịch & Lộ trình Bản đồ
  const [selectedCampaignForView, setSelectedCampaignForView] = useState<any | null>(null);
  const [activeSchoolInView, setActiveSchoolInView] = useState<any | null>(null);

  // Danh sách tài khoản nhân sự hệ thống để gợi ý phân công
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  // Thông tin phân công đoàn công tác
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [teamNotes, setTeamNotes] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('irs_campaign_view_mode');
      return saved === 'grid' || saved === 'list' ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });

  // Tab Phân bổ: Modal phân bổ & Quản lý danh sách đã phân bổ
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [allocationStartDate, setAllocationStartDate] = useState('');
  const [allocationEndDate, setAllocationEndDate] = useState('');
  const [allocatedSearch, setAllocatedSearch] = useState('');
  const [viewingAllocatedTrip, setViewingAllocatedTrip] = useState<any | null>(null);
  const [selectedAllocationCampaignId, setSelectedAllocationCampaignId] = useState<string | null>(null);
  const [selectedAllocationCampaign, setSelectedAllocationCampaign] = useState<any | null>(null);
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const [campaignDropdownSearch, setCampaignDropdownSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedStopIdForAllocation, setSelectedStopIdForAllocation] = useState<string>('START');
  const [stopAssignments, setStopAssignments] = useState<
    Record<string, Array<{ id: string; name: string; email?: string; role?: string }>>
  >({});
  const [, setDraggedStaff] = useState<any | null>(null);
  const [dragOverStopId, setDragOverStopId] = useState<string | null>(null);

  // Chế độ tự động phân bổ ngẫu nhiên
  const [isAutoAllocating, setIsAutoAllocating] = useState(false);
  const [autoAllocCounts, setAutoAllocCounts] = useState<Record<string, number | string>>({});

  // Danh sách các chuyến đi đã phân bổ (mỗi chuyến lưu riêng biệt)
  const [allocatedTrips, setAllocatedTrips] = useState<any[]>([]);

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('irs_campaign_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // New Campaign Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignNotes, setCampaignNotes] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedDestinations, setSelectedDestinations] = useState<any[]>([]);
  const [startPoint, setStartPoint] = useState<any | null>(null);
  const [routePreview, setRoutePreview] = useState<any | null>(null);

  const resetWizard = () => {
    setWizardStep(1);
    setCampaignName('');
    setCampaignNotes('');
    setSchoolSearch('');
    setSelectedDestinations([]);
    setStartPoint(null);
    setRoutePreview(null);
    setWizardLoading(false);
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await campaignApi.getAll();
      setCampaigns(data);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSchools = async () => {
    try {
      const data = await schoolApi.getAll();
      setSchools(data || []);
    } catch (err) {
      console.error('Error fetching schools:', err);
      setSchools([]);
    }
  };

  const loadSystemUsers = async () => {
    try {
      const users = await authApi.listUsers();
      setSystemUsers(Array.isArray(users) ? users : []);
    } catch {
      setSystemUsers([]);
    }
  };

  const loadAllocatedTrips = async () => {
    try {
      const data = await tripApi.getTrips();
      setAllocatedTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching allocated trips:', err);
      setAllocatedTrips([]);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadSchools();
    loadSystemUsers();
    loadAllocatedTrips();
  }, []);

  const openCreateModal = async () => {
    resetWizard();
    await loadSchools();
    setIsModalOpen(true);
  };

  const filteredSchools = schools.filter((school) => {
    const q = schoolSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      school.name?.toLowerCase().includes(q) ||
      school.address?.toLowerCase().includes(q) ||
      school.code?.toLowerCase().includes(q)
    );
  });

  const toggleDestination = (school: any) => {
    setSelectedDestinations((prev) => {
      const exists = prev.some((item) => item.school_id === school.id);
      if (exists) {
        return prev.filter((item) => item.school_id !== school.id);
      }

      return [
        ...prev,
        {
          school_id: school.id,
          id: school.id,
          name: school.name,
          address: school.address || 'Không có địa chỉ',
          lat: Number(school.lat),
          lng: Number(school.lng),
          notes: school.notes || '',
          priority: undefined,
          preferred_visit_time: undefined,
          visit_duration_minutes: 60,
        },
      ];
    });
  };

  const updateDestinationVisitTime = (schoolId: string, time?: string, duration?: number) => {
    setSelectedDestinations((prev) =>
      prev.map((item) =>
        item.school_id === schoolId || item.id === schoolId
          ? {
              ...item,
              preferred_visit_time: time && time.trim() ? time.trim() : undefined,
              visit_duration_minutes: duration !== undefined ? duration : (item.visit_duration_minutes || 60),
            }
          : item
      )
    );
  };


  const nextStep = async () => {
    if (wizardStep === 1 && !campaignName.trim()) {
      alert('Vui lòng nhập tên chiến dịch.');
      return;
    }

    if (wizardStep === 2 && selectedDestinations.length === 0) {
      alert('Vui lòng chọn ít nhất một trường để lập lộ trình.');
      return;
    }

    if (wizardStep === 3 && !startPoint) {
      alert('Vui lòng chọn điểm bắt đầu cho tuyến đi.');
      return;
    }

    if (wizardStep === 3) {
      // Chỉ tính toán xem trước lộ trình, KHÔNG tạo chiến dịch vào database
      await handlePreviewRoute();
      return;
    }

    setWizardStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setWizardStep((prev) => Math.max(prev - 1, 1));
  };

  // Tính toán lộ trình tạm thời để xem trước (KHÔNG lưu database)
  const handlePreviewRoute = async () => {
    if (!campaignName.trim() || selectedDestinations.length === 0 || !startPoint) {
      alert('Vui lòng hoàn tất thông tin chiến dịch trước khi xem lộ trình.');
      return;
    }

    setWizardLoading(true);
    try {
      const preview = await campaignApi.previewRoute({
        destinations: selectedDestinations,
        start_point: {
          lat: Number(startPoint.lat),
          lng: Number(startPoint.lng),
          name: startPoint.name,
        },
      });
      setRoutePreview(preview);
      setWizardStep(4);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Không thể tính toán lộ trình');
    } finally {
      setWizardLoading(false);
    }
  };

  // CHỈ LƯU VÀO DATABASE KHI NGƯỜI DÙNG BẤM NÚT XÁC NHẬN NÀY Ở BƯỚC 4
  const handleConfirmCreateCampaign = async () => {
    if (!campaignName.trim() || selectedDestinations.length === 0 || !startPoint) {
      alert('Vui lòng hoàn tất thông tin chiến dịch trước khi tạo.');
      return;
    }

    setWizardLoading(true);
    try {
      const created = await campaignApi.create({
        name: campaignName.trim(),
        description: campaignNotes.trim() || undefined,
        notes: campaignNotes.trim() || undefined,
        destinations: routePreview?.destinations || selectedDestinations,
      });

      // Lưu kết quả định tuyến vào route_plans
      await campaignApi.optimizeRoute(created.id, {
        lat: Number(startPoint.lat),
        lng: Number(startPoint.lng),
        name: startPoint.name,
        address: startPoint.address,
      });

      setIsModalOpen(false);
      resetWizard();
      await loadCampaigns();
      setActionMessage(`Đã tạo thành công chiến dịch "${created.name}" với lộ trình tối ưu!`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Không thể tạo chiến dịch');
    } finally {
      setWizardLoading(false);
    }
  };

  const openViewCampaign = async (camp: any) => {
    setSelectedCampaignForView(camp);
    setActiveSchoolInView(null);
    try {
      const fullCamp = await campaignApi.getById(camp.id || camp._id);
      if (fullCamp) {
        setSelectedCampaignForView(fullCamp);
      }
    } catch (err) {
      console.error('Error loading full campaign details:', err);
    }
  };

  const handleDeleteCampaign = async (campaignId: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa chiến dịch "${name}"?`)) {
      return;
    }
    try {
      setActionLoading(`del-${campaignId}`);
      await campaignApi.delete(campaignId);
      setActionMessage(`Đã xóa thành công chiến dịch "${name}".`);
      if (selectedCampaignForView && selectedCampaignForView.id === campaignId) {
        setSelectedCampaignForView(null);
      }
      await loadCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi xóa chiến dịch');
    } finally {
      setActionLoading(null);
    }
  };

  const extractStopAssignments = (camp: any) => {
    const map: Record<string, Array<{ id: string; name: string; email?: string; role?: string }>> = {};
    if (!camp) return map;

    // 1. Start point
    if (camp.start_point?.assigned_staff && Array.isArray(camp.start_point.assigned_staff)) {
      map['START'] = camp.start_point.assigned_staff;
    }

    // 2. Destinations
    if (Array.isArray(camp.destinations)) {
      camp.destinations.forEach((dest: any, idx: number) => {
        const key = dest.school_id || dest.id || `STOP_${idx}`;
        if (dest.assigned_staff && Array.isArray(dest.assigned_staff)) {
          map[key] = dest.assigned_staff;
        }
      });
    }

    // 3. Fallback team.stop_assignments
    if (camp.team?.stop_assignments && typeof camp.team.stop_assignments === 'object') {
      Object.entries(camp.team.stop_assignments).forEach(([k, v]) => {
        if (Array.isArray(v) && (!map[k] || map[k].length === 0)) {
          map[k] = v as any;
        }
      });
    }

    return map;
  };

  const assignStaffToStop = (stopKey: string, user: any) => {
    const staffObj = {
      id: String(user.id || user._id || user.username),
      name: user.full_name || user.username,
      email: user.email || '',
      role: user.role === 'staff' ? 'Cán bộ tuyển sinh' : (user.role || 'Cán bộ tuyển sinh'),
    };

    setStopAssignments((prev) => {
      const current = prev[stopKey] || [];
      if (current.some((s) => s.id === staffObj.id || s.name === staffObj.name)) {
        return prev;
      }
      return {
        ...prev,
        [stopKey]: [...current, staffObj],
      };
    });
  };

  const toggleStaffOnStop = (stopKey: string, user: any) => {
    const staffId = String(user.id || user._id || user.username);
    const staffName = user.full_name || user.username;

    setStopAssignments((prev) => {
      const current = prev[stopKey] || [];
      const exists = current.some((s) => s.id === staffId || s.name === staffName);
      if (exists) {
        return {
          ...prev,
          [stopKey]: current.filter((s) => s.id !== staffId && s.name !== staffName),
        };
      } else {
        const staffObj = {
          id: staffId,
          name: staffName,
          email: user.email || '',
          role: user.role === 'staff' ? 'Cán bộ tuyển sinh' : (user.role || 'Cán bộ tuyển sinh'),
        };
        return {
          ...prev,
          [stopKey]: [...current, staffObj],
        };
      }
    });
  };

  const removeStaffFromStop = (stopKey: string, staffIdOrName: string) => {
    setStopAssignments((prev) => {
      const current = prev[stopKey] || [];
      return {
        ...prev,
        [stopKey]: current.filter((s) => s.id !== staffIdOrName && s.name !== staffIdOrName),
      };
    });
  };

  const openAllocationModal = (camp?: any) => {
    if (camp) {
      setSelectedAllocationCampaignId(camp.id || camp._id);
      setSelectedAllocationCampaign(camp);
    } else {
      setSelectedAllocationCampaignId(null);
      setSelectedAllocationCampaign(null);
    }
    // PHÂN BỔ MỚI: Luôn bắt đầu với dữ liệu trống, không giữ data cũ
    setAllocationStartDate('');
    setAllocationEndDate('');
    setVehiclePlate('');
    setTeamNotes('');
    setStopAssignments({});
    setSelectedStopIdForAllocation('START');
    setIsAutoAllocating(false);
    setAutoAllocCounts({});
    setCampaignDropdownSearch('');
    setIsCampaignDropdownOpen(false);
    setIsAllocationModalOpen(true);
  };

  const handleSelectCampaignInAllocation = (camp: any) => {
    setSelectedAllocationCampaignId(camp.id || camp._id);
    setSelectedAllocationCampaign(camp);
    // PHÂN BỔ MỚI: Bắt đầu mới hoàn toàn, không lấy lại ngày/xe/nhân sự đã phân trước đó
    setAllocationStartDate('');
    setAllocationEndDate('');
    setVehiclePlate('');
    setTeamNotes('');
    setStopAssignments({});
    setSelectedStopIdForAllocation('START');
    setIsAutoAllocating(false);
    setAutoAllocCounts({});
    setIsCampaignDropdownOpen(false);
  };

  const handleStartAutoAllocate = () => {
    if (!selectedAllocationCampaign) {
      alert('Vui lòng chọn chiến dịch trước khi thực hiện tự động phân bổ.');
      return;
    }
    const initialCounts: Record<string, number | string> = {};
    if (selectedAllocationCampaign.start_point) {
      initialCounts['START'] = 1;
    }
    (selectedAllocationCampaign.destinations || []).forEach((dest: any, idx: number) => {
      const key = dest.school_id || dest.id || `STOP_${idx}`;
      initialCounts[key] = 1;
    });
    setAutoAllocCounts(initialCounts);
    setIsAutoAllocating(true);
  };

  const handleConfirmAutoAllocate = () => {
    if (!selectedAllocationCampaign) return;

    const availableStaff = systemUsers.filter((u) => u.role === 'staff');
    const pool = availableStaff.length > 0 ? availableStaff : systemUsers;
    if (pool.length === 0) {
      alert('Hệ thống chưa có tài khoản nhân sự (staff) nào để phân bổ.');
      return;
    }

    const stopsList: Array<{ key: string; count: number; name: string }> = [];
    if (selectedAllocationCampaign.start_point) {
      const c = Math.max(0, parseInt(String(autoAllocCounts['START'] ?? 0), 10) || 0);
      stopsList.push({
        key: 'START',
        count: c,
        name: selectedAllocationCampaign.start_point.name || 'Điểm xuất phát',
      });
    }

    (selectedAllocationCampaign.destinations || []).forEach((dest: any, idx: number) => {
      const key = dest.school_id || dest.id || `STOP_${idx}`;
      const c = Math.max(0, parseInt(String(autoAllocCounts[key] ?? 0), 10) || 0);
      stopsList.push({
        key: key,
        count: c,
        name: dest.name || `Điểm dừng ${idx + 1}`,
      });
    });

    const totalStaffNeeded = stopsList.reduce((sum, s) => sum + s.count, 0);
    if (totalStaffNeeded === 0) {
      alert('Vui lòng nhập số lượng người lớn hơn 0 cho ít nhất một điểm dừng.');
      return;
    }

    // Thuật toán Shuffle Fisher-Yates
    const shuffle = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    let poolQueue = shuffle(pool);
    const newAssignments: Record<string, Array<{ id: string; name: string; email?: string; role?: string }>> = {
      ...stopAssignments,
    };

    stopsList.forEach(({ key, count }) => {
      if (count <= 0) {
        newAssignments[key] = [];
        return;
      }

      const assignedForThisStop: any[] = [];
      const usedInThisStop = new Set<string>();

      let attempts = 0;
      while (assignedForThisStop.length < count && attempts < pool.length * 3) {
        attempts++;
        if (poolQueue.length === 0) {
          poolQueue = shuffle(pool);
        }
        const candidate = poolQueue.shift()!;
        const candidateId = String(candidate.id || candidate._id || candidate.username);

        if (!usedInThisStop.has(candidateId)) {
          usedInThisStop.add(candidateId);
          assignedForThisStop.push({
            id: candidateId,
            name: candidate.full_name || candidate.username,
            email: candidate.email || '',
            role: candidate.role === 'staff' ? 'Cán bộ tuyển sinh' : (candidate.role || 'Cán bộ tuyển sinh'),
          });
        }
      }

      newAssignments[key] = assignedForThisStop;
    });

    setStopAssignments(newAssignments);
    setIsAutoAllocating(false);
  };

  const handleSaveAllocation = async () => {
    if (!selectedAllocationCampaign) {
      alert('Vui lòng chọn chiến dịch cần phân bổ.');
      return;
    }

    setSavingAssignment(true);
    try {
      // Thu thập tất cả nhân sự đã phân bổ qua các điểm dừng (Điểm bắt đầu [S] + các điểm dừng [1], [2]...)
      const uniqueStaffMap = new Map<string, any>();
      Object.values(stopAssignments).forEach((list) => {
        list.forEach((s) => {
          const key = s.id || s.name;
          if (!uniqueStaffMap.has(key)) {
            uniqueStaffMap.set(key, s);
          }
        });
      });
      const allAssignedList = Array.from(uniqueStaffMap.values());

      const updatedStartPoint = selectedAllocationCampaign.start_point
        ? {
            ...selectedAllocationCampaign.start_point,
            assigned_staff: stopAssignments['START'] || [],
          }
        : undefined;

      const updatedDestinations = (selectedAllocationCampaign.destinations || []).map((dest: any, idx: number) => {
        const key = dest.school_id || dest.id || `STOP_${idx}`;
        return {
          ...dest,
          assigned_staff: stopAssignments[key] || [],
        };
      });

      const teamData = {
        leader_name: allAssignedList.length > 0 ? allAssignedList[0].name : undefined,
        members_count: allAssignedList.length,
        members: allAssignedList.map((s) => ({
          name: s.name,
          role: s.role || 'Cán bộ tuyển sinh',
          email: s.email || '',
        })),
        stop_assignments: stopAssignments,
        vehicle_plate: vehiclePlate.trim() || undefined,
        notes: teamNotes.trim() || undefined,
      };

      const cId = selectedAllocationCampaign.id || selectedAllocationCampaign._id;
      const res = await campaignApi.allocate(cId, {
        team: teamData,
        start_date: allocationStartDate || undefined,
        end_date: allocationEndDate || undefined,
        destinations: updatedDestinations,
        start_point: updatedStartPoint,
      });

      setCampaigns((prev) =>
        prev.map((c) =>
          (c.id === cId || c._id === cId)
            ? {
                ...c,
                team: teamData,
                start_date: allocationStartDate || undefined,
                end_date: allocationEndDate || undefined,
                destinations: updatedDestinations,
                start_point: updatedStartPoint,
                status: 'assigned',
                deployed_trip_id: res.trip_id || c.deployed_trip_id,
              }
            : c
        )
      );

      if (selectedCampaignForView && (selectedCampaignForView.id === cId || selectedCampaignForView._id === cId)) {
        setSelectedCampaignForView((prev: any) =>
          prev
            ? {
                ...prev,
                team: teamData,
                start_date: allocationStartDate || undefined,
                end_date: allocationEndDate || undefined,
                destinations: updatedDestinations,
                start_point: updatedStartPoint,
                status: 'assigned',
              }
            : null
        );
      }

      if (selectedAllocationCampaign && (selectedAllocationCampaign.id === cId || selectedAllocationCampaign._id === cId)) {
        setSelectedAllocationCampaign((prev: any) =>
          prev
            ? {
                ...prev,
                team: teamData,
                start_date: allocationStartDate || undefined,
                end_date: allocationEndDate || undefined,
                destinations: updatedDestinations,
                start_point: updatedStartPoint,
                status: 'assigned',
              }
            : null
        );
      }

      setActionMessage(`Đã lưu và phân bổ nhân sự cho các điểm trên tuyến đường thành công!`);
      setIsAutoAllocating(false);
      setAutoAllocCounts({});
      setIsAllocationModalOpen(false);
      await loadCampaigns();
      await loadAllocatedTrips();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi lưu phân bổ nhân sự');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleUnallocate = async (camp: any) => {
    const cId = camp.id || camp._id;
    if (!window.confirm(`Bạn có chắc chắn muốn hủy phân bổ cho chiến dịch "${camp.name}"? Chuyến đi đã tạo sẽ được gỡ bỏ khỏi hệ thống.`)) {
      return;
    }

    try {
      await campaignApi.unallocate(cId);
      setCampaigns((prev) =>
        prev.map((c) =>
          (c.id === cId || c._id === cId)
            ? {
                ...c,
                team: undefined,
                start_date: undefined,
                end_date: undefined,
                status: 'planning',
                deployed_trip_id: undefined,
              }
            : c
        )
      );
      if (viewingAllocatedTrip && (viewingAllocatedTrip.id === cId || viewingAllocatedTrip._id === cId)) {
        setViewingAllocatedTrip(null);
      }
      await loadCampaigns();
      await loadAllocatedTrips();
      setActionMessage(`Đã hủy phân bổ cho chiến dịch "${camp.name}".`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi hủy phân bổ');
    }
  };

  const handleViewAllocatedTrip = async (camp: any) => {
    const parentCamp = campaigns.find(
      (c) => c.id === camp.campaign_id || c._id === camp.campaign_id
    );
    const effectiveRouteGeom =
      camp.route_geometry && Array.isArray(camp.route_geometry) && camp.route_geometry.length > 1
        ? camp.route_geometry
        : parentCamp?.route_geometry && Array.isArray(parentCamp.route_geometry) && parentCamp.route_geometry.length > 1
        ? parentCamp.route_geometry
        : undefined;

    const merged = {
      ...camp,
      start_point: camp.start_point || parentCamp?.start_point,
      route_geometry: effectiveRouteGeom,
      destinations: (camp.destinations && camp.destinations.length > 0) ? camp.destinations : parentCamp?.destinations,
    };
    setViewingAllocatedTrip(merged);

    // Nếu chưa có route_geometry đầy đủ, chủ động fetch chi tiết chiến dịch từ server
    if (!effectiveRouteGeom || effectiveRouteGeom.length <= 1) {
      const campId = camp.campaign_id || camp.id || camp._id;
      if (campId) {
        try {
          const fullCamp = await campaignApi.getById(campId);
          if (fullCamp?.route_geometry && fullCamp.route_geometry.length > 1) {
            setViewingAllocatedTrip((prev: any) =>
              prev
                ? {
                    ...prev,
                    route_geometry: fullCamp.route_geometry,
                    start_point: prev.start_point || fullCamp.start_point,
                    destinations: (prev.destinations && prev.destinations.length > 0) ? prev.destinations : fullCamp.destinations,
                  }
                : null
            );
          }
        } catch (e) {
          console.warn('Could not fetch full campaign for route geometry:', e);
        }
      }
    }
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const filteredCampaigns = campaigns.filter((camp) => {
    const q = campaignSearch.trim().toLowerCase();
    const matchQuery =
      !q ||
      camp.name?.toLowerCase().includes(q) ||
      camp.notes?.toLowerCase().includes(q) ||
      camp.description?.toLowerCase().includes(q) ||
      camp.destinations?.some((d: any) =>
        d.school_name?.toLowerCase().includes(q) ||
        d.school?.name?.toLowerCase().includes(q)
      );

    return matchQuery;
  });

  const ITEMS_PER_PAGE = 20;
  const [campaignPage, setCampaignPage] = useState(1);

  useEffect(() => {
    setCampaignPage(1);
  }, [campaignSearch, activeTab]);

  const totalCampaignPages = Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE);
  const paginatedCampaigns = filteredCampaigns.slice(
    (campaignPage - 1) * ITEMS_PER_PAGE,
    campaignPage * ITEMS_PER_PAGE
  );

  const dropdownFilteredCampaigns = useMemo(() => {
    const q = campaignDropdownSearch.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [campaigns, campaignDropdownSearch]);

  const staffList = useMemo(() => {
    const staffs = systemUsers.filter((u) => u.role === 'staff');
    const source = staffs.length > 0 ? staffs : systemUsers;
    const q = staffSearch.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [systemUsers, staffSearch]);

  const allocatedCampaigns = useMemo(() => {
    if (allocatedTrips.length > 0) {
      return allocatedTrips.map((t) => {
        const parentCamp = campaigns.find(
          (c) => c.id === t.campaign_id || c._id === t.campaign_id
        );
        const effectiveRouteGeom =
          t.route_geometry && Array.isArray(t.route_geometry) && t.route_geometry.length > 1
            ? t.route_geometry
            : parentCamp?.route_geometry && Array.isArray(parentCamp.route_geometry) && parentCamp.route_geometry.length > 1
            ? parentCamp.route_geometry
            : undefined;

        return {
          ...t,
          deployed_trip_id: t.trip_code || t.id,
          start_point: t.start_point || parentCamp?.start_point,
          route_geometry: effectiveRouteGeom,
          polyline: t.polyline || parentCamp?.polyline,
          destinations: (t.destinations && t.destinations.length > 0) ? t.destinations : parentCamp?.destinations,
        };
      });
    }
    return campaigns.filter(
      (c) => Boolean(c.team?.leader_name) || c.status === 'assigned' || Boolean(c.deployed_trip_id)
    );
  }, [allocatedTrips, campaigns]);

  const filteredAllocatedCampaigns = useMemo(() => {
    const q = allocatedSearch.trim().toLowerCase();
    if (!q) return allocatedCampaigns;
    return allocatedCampaigns.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.deployed_trip_id?.toLowerCase().includes(q) ||
        c.trip_code?.toLowerCase().includes(q) ||
        c.id?.toLowerCase().includes(q) ||
        c.team?.leader_name?.toLowerCase().includes(q) ||
        c.team?.vehicle_plate?.toLowerCase().includes(q) ||
        c.team?.members?.some((m: any) => m.name?.toLowerCase().includes(q))
    );
  }, [allocatedCampaigns, allocatedSearch]);

  const getStartPointInfo = (sp: any) => {
    if (!sp) return null;
    const matchedSchool = schools.find((s) => {
      if (sp.school_id && (s.id === sp.school_id || s._id === sp.school_id)) return true;
      if (s.name && sp.name && s.name.toLowerCase() === sp.name.toLowerCase()) return true;
      if (s.lat != null && s.lng != null && sp.lat != null && sp.lng != null) {
        return (
          Math.abs(Number(s.lat) - Number(sp.lat)) < 0.005 &&
          Math.abs(Number(s.lng) - Number(sp.lng)) < 0.005
        );
      }
      return false;
    });

    const name =
      (sp.name && sp.name !== 'Điểm xuất phát' && sp.name !== 'Start' ? sp.name : null) ||
      (matchedSchool && matchedSchool.name) ||
      sp.name ||
      'Điểm xuất phát';

    const address =
      sp.address ||
      (matchedSchool ? matchedSchool.address : '') ||
      '';

    return { name, address };
  };

  useEffect(() => {
    if (!selectedAllocationCampaignId) {
      setSelectedAllocationCampaign(null);
      return;
    }
    const found = campaigns.find(
      (c) => (c.id || c._id) === selectedAllocationCampaignId
    );
    if (found) {
      setSelectedAllocationCampaign(found);
    }
    campaignApi
      .getById(selectedAllocationCampaignId)
      .then((full) => {
        if (full) {
          setSelectedAllocationCampaign(full);
          setStopAssignments(extractStopAssignments(full));
        }
      })
      .catch((err) => console.error('Error fetching full campaign for allocation:', err));
  }, [selectedAllocationCampaignId, campaigns]);

  const totalAssignedStaffCount = useMemo(() => {
    const all = new Set<string>();
    Object.values(stopAssignments).forEach((list) => {
      list.forEach((s) => all.add(s.id || s.name));
    });
    return all.size;
  }, [stopAssignments]);

  const stepTitles = [
    'Thông tin chiến dịch',
    'Chọn trường mục tiêu',
    'Chọn điểm bắt đầu',
    'Xem trước lộ trình',
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header trang */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản Lý Chiến Dịch Tuyển Sinh
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý và triển khai các chiến dịch tuyển sinh tại các trường THPT và đại học trên toàn quốc.
          </p>
        </div>

        {activeTab === 'campaigns' ? (
          <button
            onClick={openCreateModal}
            className="bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-[5px] transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo chiến dịch mới</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAllocationModal()}
            className="bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-[5px] transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Phân bổ</span>
          </button>
        )}
      </div>

      {/* Tab Switcher: Chiến dịch / Phân công */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2.5 px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'campaigns'
              ? 'border-[#0f3b7d] text-[#0f3b7d]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Chiến dịch</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold transition ${
              activeTab === 'campaigns'
                ? 'bg-blue-100 text-[#0f3b7d]'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {campaigns.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assignment')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'assignment'
              ? 'border-[#0f3b7d] text-[#0f3b7d]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Phân bổ</span>
        </button>
      </div>

      {/* Search & Filter & View Switcher Bar (CHỈ HIỂN THỊ Ở TAB CHIẾN DỊCH) */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-[5px] border border-slate-200/80 p-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        {/* Search box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={campaignSearch}
            onChange={(e) => setCampaignSearch(e.target.value)}
            placeholder="Tìm kiếm chiến dịch..."
            className="w-full pl-10 pr-8 py-1.5 text-sm bg-transparent placeholder:text-slate-400 text-slate-800 focus:outline-none"
          />
          {campaignSearch && (
            <button
              type="button"
              onClick={() => setCampaignSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right controls: View toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {/* View Switcher: Lưới / List (Chỉ icon) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-[5px] border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              title="Hiển thị dạng lưới"
              className={`p-1.5 rounded-[5px] text-xs font-semibold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#0f3b7d] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('list')}
              title="Hiển thị dạng danh sách"
              className={`p-1.5 rounded-[5px] text-xs font-semibold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#0f3b7d] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CHIẾN DỊCH */}
      {/* ========================================================================= */}
      {activeTab === 'campaigns' && (
        <>
          {loading ? (
            <div className="text-center py-16 bg-white rounded-[5px] border border-slate-200/80">
              <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Đang tải danh sách chiến dịch...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[5px] border border-slate-200/80">
              <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-700">Chưa có chiến dịch nào</p>
              <p className="text-xs text-slate-400 mt-1">
                Nhấn "Tạo chiến dịch mới" để bắt đầu quy hoạch đợt tuyển sinh.
              </p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[5px] border border-slate-200/80">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-700">Không tìm thấy chiến dịch phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">
                Vui lòng thử từ khóa khác hoặc xóa bộ lọc để xem tất cả chiến dịch.
              </p>
              <button
                type="button"
                onClick={() => setCampaignSearch('')}
                className="mt-4 px-4 py-2 rounded-[5px] bg-blue-50 text-[#0f3b7d] font-bold text-xs hover:bg-blue-100 transition cursor-pointer"
              >
                Xóa tìm kiếm
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {paginatedCampaigns.map((camp) => (
                <div
                  key={camp.id || camp._id}
                  className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {camp.name}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                      {camp.notes || camp.description || 'Chưa có ghi chú chiến dịch'}
                    </p>

                    <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Số trường mục tiêu:</span>
                        </div>
                        <strong className="text-slate-800 font-bold">{camp.destinations?.length || 0} trường</strong>
                      </div>

                      {camp.estimated_distance_km ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Route className="w-3.5 h-3.5 text-blue-600" />
                            <span>Lộ trình tối ưu:</span>
                          </div>
                          <span className="font-bold text-blue-700">
                            {camp.estimated_distance_km} km {camp.estimated_duration_text ? `(~ ${camp.estimated_duration_text})` : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Thuật toán:</span>
                          </div>
                          <span className="font-semibold text-blue-700">Dynamic Next-Hop</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons trên Card: Xem chi tiết & Lộ trình, Xóa (Đã bỏ nút Triển khai) */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openViewCampaign(camp)}
                      className="flex-1 py-2 px-3 rounded-[5px] bg-blue-50 hover:bg-blue-100 text-[#0f3b7d] text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem chi tiết & Lộ trình</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                      disabled={actionLoading === `del-${camp.id}`}
                      title="Xóa chiến dịch"
                      className="p-2 rounded-[5px] border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition text-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Hiển thị dạng List */
            <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">Tên chiến dịch</th>
                      <th className="py-3.5 px-4">Số trường</th>
                      <th className="py-3.5 px-4">Lộ trình & Quãng đường</th>
                      <th className="py-3.5 px-5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedCampaigns.map((camp) => (
                      <tr key={camp.id || camp._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900 text-sm">{camp.name}</div>
                          {(camp.notes || camp.description) && (
                            <div className="text-slate-400 text-xs line-clamp-1 mt-0.5 max-w-md">
                              {camp.notes || camp.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{camp.destinations?.length || 0} trường</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {camp.estimated_distance_km ? (
                            <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                              <Route className="w-3.5 h-3.5" />
                              <span>{camp.estimated_distance_km} km</span>
                              {camp.estimated_duration_text && (
                                <span className="text-slate-400 font-normal text-[11px]">
                                  (~ {camp.estimated_duration_text})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Dynamic Next-Hop</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openViewCampaign(camp)}
                              className="py-1.5 px-3 rounded-[5px] bg-blue-50 hover:bg-blue-100 text-[#0f3b7d] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                              title="Xem chi tiết & Lộ trình"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem chi tiết</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                              disabled={actionLoading === `del-${camp.id}`}
                              title="Xóa chiến dịch"
                              className="p-1.5 rounded-[5px] border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phân trang góc dưới bên phải nếu quá 20 chiến dịch */}
          {totalCampaignPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <div className="text-xs text-slate-500 font-medium">
                Trang <span className="font-bold text-slate-800">{campaignPage}</span> / {totalCampaignPages} (Tổng {filteredCampaigns.length} chiến dịch)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCampaignPage((p) => Math.max(p - 1, 1))}
                  disabled={campaignPage === 1}
                  className="p-2 rounded-[5px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalCampaignPages }, (_, i) => i + 1)
                  .filter((page) => page === 1 || page === totalCampaignPages || Math.abs(page - campaignPage) <= 1)
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {prev && page - prev > 1 && (
                          <span className="px-1 text-slate-400 text-xs">...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCampaignPage(page)}
                          className={`min-w-[34px] h-[34px] px-2.5 rounded-[5px] text-xs font-bold transition cursor-pointer ${
                            campaignPage === page
                              ? 'bg-[#0f3b7d] text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => setCampaignPage((p) => Math.min(p + 1, totalCampaignPages))}
                  disabled={campaignPage === totalCampaignPages}
                  className="p-2 rounded-[5px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PHÂN BỔ (DANH SÁCH ĐÃ PHÂN BỔ & NÚT MỞ FORM PHÂN BỔ) */}
      {/* ========================================================================= */}
      {activeTab === 'assignment' && (
        <div className="space-y-6">
          {/* Thanh tìm kiếm & nút Phân bổ (đồng bộ style như bên tab Chiến dịch) */}
          <div className="bg-white rounded-[5px] border border-slate-200/80 p-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            {/* Search box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={allocatedSearch}
                onChange={(e) => setAllocatedSearch(e.target.value)}
                placeholder="Tìm kiếm tuyến đi phân bổ..."
                className="w-full pl-10 pr-8 py-1.5 text-sm bg-transparent placeholder:text-slate-400 text-slate-800 focus:outline-none"
              />
              {allocatedSearch && (
                <button
                  type="button"
                  onClick={() => setAllocatedSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Nội dung danh sách đã phân bổ */}
          {allocatedCampaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[5px] border border-slate-200/80 p-8 shadow-xs flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-[#0f3b7d] flex items-center justify-center mb-3">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Chưa có tuyến đi nào được phân bổ</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                Các chiến dịch sau khi được phân bổ nhân sự và thời gian bắt đầu - kết thúc sẽ hiển thị tại đây.
              </p>
              <button
                type="button"
                onClick={() => openAllocationModal()}
                className="h-10 px-5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Phân bổ nhân sự ngay</span>
              </button>
            </div>
          ) : filteredAllocatedCampaigns.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[5px] border border-slate-200/80 p-6 shadow-xs">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Không tìm thấy tuyến đi phù hợp với từ khóa</p>
              <button
                type="button"
                onClick={() => setAllocatedSearch('')}
                className="mt-2 text-xs text-blue-700 font-bold hover:underline"
              >
                Xóa tìm kiếm
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredAllocatedCampaigns.map((camp) => {
                const cId = camp.id || camp._id;
                const members = Array.isArray(camp.team?.members) ? camp.team.members : [];
                return (
                  <div
                    key={cId}
                    className="bg-white rounded-[5px] border border-slate-200/90 hover:border-slate-300 shadow-xs flex flex-col justify-between transition hover:shadow-sm overflow-hidden"
                  >
                    {/* Header Thẻ */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-slate-900 truncate" title={camp.name}>
                            {camp.name}
                          </h3>
                          {camp.deployed_trip_id && (
                            <span className="inline-block mt-1 px-1.5 py-0.2 rounded-[5px] bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">
                              Mã chuyến: {camp.deployed_trip_id}
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[11px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                          <UserCheck className="w-3 h-3" />
                          <span>Đã phân bổ</span>
                        </span>
                      </div>

                      {/* Banner Thời gian */}
                      <div className="mt-3 p-2 rounded-[5px] bg-blue-50/70 border border-blue-100/80 flex items-center gap-2 text-xs text-[#0f3b7d]">
                        <Calendar className="w-3.5 h-3.5 text-[#0f3b7d] shrink-0" />
                        <span className="font-bold">
                          {formatDateDisplay(camp.start_date) || 'Chưa đặt ngày'}
                        </span>
                        <span className="text-slate-400 font-normal">→</span>
                        <span className="font-bold">
                          {formatDateDisplay(camp.end_date) || 'Chưa đặt ngày'}
                        </span>
                      </div>
                    </div>

                    {/* Thân thẻ: Thông tin lộ trình & Đoàn công tác */}
                    <div className="p-4 space-y-3 flex-1 text-xs">
                      {/* Thống kê nhanh */}
                      <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
                        <div className="p-1.5 rounded-[5px] bg-slate-50 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">Trường</span>
                          <span className="font-black text-slate-800 text-xs">{camp.destinations?.length || 0}</span>
                        </div>
                        <div className="p-1.5 rounded-[5px] bg-slate-50 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">Cự ly</span>
                          <span className="font-black text-blue-700 text-xs">
                            {camp.estimated_distance_km ? `${camp.estimated_distance_km} km` : '--'}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-[5px] bg-slate-50 text-center">
                          <span className="text-[10px] text-slate-400 font-bold block">Thời gian</span>
                          <span className="font-black text-slate-800 text-xs truncate">
                            {camp.estimated_duration_text || (camp.estimated_duration_minutes ? `${camp.estimated_duration_minutes}p` : '--')}
                          </span>
                        </div>
                      </div>

                      {/* Thông tin đoàn */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Shield className="w-3.5 h-3.5 text-[#0f3b7d] shrink-0" />
                          <span className="text-slate-400 font-medium">Trưởng đoàn:</span>
                          <span className="font-bold truncate">
                            {camp.team?.leader_name || 'Chưa chỉ định'}
                          </span>
                        </div>

                        {camp.team?.vehicle_plate && (
                          <div className="flex items-center gap-2 text-slate-700">
                            <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-400 font-medium">Xe:</span>
                            <span className="font-semibold text-slate-800">{camp.team.vehicle_plate}</span>
                          </div>
                        )}

                        {members.length > 0 && (
                          <div className="pt-1">
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>Thành viên ({members.length}):</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {members.map((m: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded-[5px] bg-slate-100 text-slate-700 text-[10px] font-medium"
                                >
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {camp.team?.notes && (
                          <p className="text-[11px] text-slate-500 italic line-clamp-2 pt-1 border-t border-slate-50">
                            "{camp.team.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Thẻ: Hành động */}
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewAllocatedTrip(camp)}
                        className="text-xs font-bold text-[#0f3b7d] hover:text-[#0c2f64] flex items-center gap-1 py-1 px-2 rounded-[5px] hover:bg-blue-50 transition cursor-pointer"
                        title="Xem lộ trình và bản đồ"
                      >
                        <Route className="w-3.5 h-3.5" />
                        <span>Xem lộ trình</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAllocationModal(camp)}
                          className="p-1.5 rounded-[5px] text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                          title="Chỉnh sửa phân bổ"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnallocate(camp)}
                          className="p-1.5 rounded-[5px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Hủy phân bổ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ========================================================================= */}
      {/* MODAL XEM CHI TIẾT CHIẾN DỊCH & LỘ TRÌNH BẢN ĐỒ (CAMPAIGN DETAIL & ROUTE MAP) */}
      {/* ========================================================================= */}
      {selectedCampaignForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-[5px] max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-slide-up overflow-hidden">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[5px] bg-blue-100 text-[#0f3b7d] flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">
                      {selectedCampaignForView.name}
                    </h3>
                    {selectedCampaignForView.status === 'deployed' && (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Đã triển khai
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedCampaignForView.notes || selectedCampaignForView.description || 'Chưa có ghi chú chiến dịch'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCampaignForView(null);
                    setActiveSchoolInView(null);
                  }}
                  className="p-2 rounded-[5px] text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body: 2 Cột */}
            <div className="flex-1 overflow-hidden p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[480px]">
              {/* CỘT TRÁI: THÔNG TIN CHIẾN DỊCH, THỐNG KÊ & THỨ TỰ GHÉ THĂM */}
              <div className="lg:col-span-5 flex flex-col space-y-3.5 overflow-y-auto pr-1">
                {/* Thẻ chỉ số tổng quan (Khoảng cách, Thời gian, Số trường) */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[5px] bg-slate-50 border border-slate-200/80 p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Khoảng cách</span>
                    <p className="text-base font-black text-slate-900 mt-0.5">
                      {selectedCampaignForView.estimated_distance_km ? `${selectedCampaignForView.estimated_distance_km} km` : '--'}
                    </p>
                    <span className="text-[10px] text-slate-400">Đường bộ</span>
                  </div>
                  <div className="rounded-[5px] bg-slate-50 border border-slate-200/80 p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Thời gian đi</span>
                    <p className="text-base font-black text-blue-700 mt-0.5">
                      {selectedCampaignForView.estimated_duration_text || (selectedCampaignForView.estimated_duration_minutes ? `${selectedCampaignForView.estimated_duration_minutes}p` : '--')}
                    </p>
                    <span className="text-[10px] text-slate-400">Ước tính</span>
                  </div>
                  <div className="rounded-[5px] bg-slate-50 border border-slate-200/80 p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Số trường</span>
                    <p className="text-base font-black text-[#0f3b7d] mt-0.5">
                      {selectedCampaignForView.destinations?.length || 0}
                    </p>
                    <span className="text-[10px] text-slate-400">Mục tiêu</span>
                  </div>
                </div>

                {/* Ghi chú chiến dịch */}
                {(selectedCampaignForView.notes || selectedCampaignForView.description) && (
                  <div className="p-3 rounded-[5px] bg-slate-50/70 border border-slate-200/80 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mục tiêu & Ghi chú</span>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {selectedCampaignForView.notes || selectedCampaignForView.description}
                    </p>
                  </div>
                )}

                {/* Điểm xuất phát nếu có */}
                {selectedCampaignForView.start_point && (
                  <div
                    onClick={() => setActiveSchoolInView({
                      ...selectedCampaignForView.start_point,
                      isStart: true,
                    })}
                    className="p-3 rounded-[5px] border border-blue-200 bg-blue-50/50 hover:bg-blue-50 cursor-pointer transition flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-[#0f3b7d] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                        S
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-[#0f3b7d] uppercase">Điểm xuất phát:</span>
                          <strong className="text-slate-900 font-bold truncate">
                            {selectedCampaignForView.start_point.name || 'Điểm xuất phát'}
                          </strong>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {selectedCampaignForView.start_point.address ||
                            (selectedCampaignForView.start_point.lat && selectedCampaignForView.start_point.lng
                              ? `${Number(selectedCampaignForView.start_point.lat).toFixed(4)}, ${Number(selectedCampaignForView.start_point.lng).toFixed(4)}`
                              : '')}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded-full shrink-0 border border-blue-200">
                      Xem vị trí
                    </span>
                  </div>
                )}

                {/* Danh sách các trường theo thứ tự lộ trình */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#0f3b7d]" />
                      <span>Thứ tự ghé thăm tối ưu</span>
                    </h4>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[5px] border border-emerald-200/60">
                      Dynamic Next-Hop
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[320px] pr-1 flex-1">
                    {(!selectedCampaignForView.destinations || selectedCampaignForView.destinations.length === 0) ? (
                      <div className="p-6 text-center border border-dashed border-slate-200 rounded-[5px] text-xs text-slate-400">
                        Chiến dịch này chưa có trường mục tiêu nào.
                      </div>
                    ) : (
                      selectedCampaignForView.destinations.map((dest: any, idx: number) => {
                        const isFocused = activeSchoolInView && (
                          (dest.school_id && activeSchoolInView.school_id === dest.school_id) ||
                          (dest.id && activeSchoolInView.id === dest.id) ||
                          (activeSchoolInView.lat === dest.lat && activeSchoolInView.lng === dest.lng)
                        );

                        return (
                          <div
                            key={dest.school_id || dest.id || idx}
                            onClick={() => setActiveSchoolInView(dest)}
                            className={`p-3 rounded-[5px] border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                              isFocused
                                ? 'border-[#0f3b7d] bg-blue-50/80 shadow-2xs ring-2 ring-[#0f3b7d]/20'
                                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isFocused ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-slate-900 text-xs truncate">
                                    {dest.name}
                                  </p>
                                  {(dest.preferred_visit_time || dest.preferred_time) ? (
                                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded-[5px] shrink-0 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-indigo-600" />
                                      {dest.preferred_visit_time || dest.preferred_time} ({dest.visit_duration_minutes || 60}p)
                                    </span>
                                  ) : dest.priority ? (
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-[5px] shrink-0">
                                      Ưu tiên {dest.priority}
                                    </span>
                                  ) : null}
                                  {dest.code && (
                                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-[5px] shrink-0">
                                      {dest.code}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {dest.address || 'Chưa có địa chỉ'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {(dest.distance_text || dest.duration_text) && (
                                <div className="text-right">
                                  <span className="text-[11px] font-bold text-blue-700 block">{dest.distance_text}</span>
                                  <span className="text-[10px] text-slate-400 block">~ {dest.duration_text}</span>
                                </div>
                              )}

                              {(dest.school_id || dest.id) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/admin/schools/${dest.school_id || dest.id}`);
                                  }}
                                  title="Xem trang thông tin trường"
                                  className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100/60 rounded-[5px] transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: BẢN ĐỒ LỘ TRÌNH CHIẾN DỊCH */}
              <div className="lg:col-span-7 flex flex-col h-full rounded-[5px] border border-slate-200 bg-white p-3 shadow-xs min-h-[460px]">
                <div className="mb-2.5 flex items-center justify-between px-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#0f3b7d]" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Bản đồ lộ trình & vị trí các trường
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                    Nhấp vào marker để xem thông tin
                  </span>
                </div>

                <div className="flex-1 w-full rounded-[5px] overflow-hidden border border-slate-100">
                  <CampaignRouteMap
                    startPoint={selectedCampaignForView.start_point}
                    destinations={selectedCampaignForView.destinations || []}
                    routeGeometry={selectedCampaignForView.route_geometry}
                    activeSchool={activeSchoolInView}
                    onSelectSchool={(school) => setActiveSchoolInView(school)}
                  />
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Chiến dịch gồm <strong>{selectedCampaignForView.destinations?.length || 0}</strong> trường học mục tiêu
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCampaignForView(null);
                  setActiveSchoolInView(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-[5px] transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-[5px] max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-slide-up overflow-hidden">
            {/* Header: Cố định */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {stepTitles[wizardStep - 1]}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bước {wizardStep}/4 - Thiết lập thông tin chiến dịch tuyển sinh
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetWizard();
                }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 text-sm font-semibold transition"
              >
                ✕ Đóng
              </button>
            </div>

            {/* Stepper: Căn giữa, hiển thị đầy đủ tên bước, cân đối và thẩm mỹ */}
            <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="max-w-xl mx-auto flex items-center justify-between">
                {[
                  { step: 1, title: 'Thông tin' },
                  { step: 2, title: 'Chọn trường' },
                  { step: 3, title: 'Điểm xuất phát' },
                  { step: 4, title: 'Xem lộ trình' },
                ].map((item, idx) => {
                  const isCurrent = wizardStep === item.step;
                  const isCompleted = wizardStep > item.step;
                  return (
                    <div key={item.step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : isCurrent
                              ? 'bg-[#0f3b7d] text-white ring-4 ring-blue-100 shadow-xs'
                              : 'bg-white text-slate-400 border border-slate-200'
                          }`}
                        >
                          {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : item.step}
                        </div>
                        <span
                          className={`text-[11px] font-semibold mt-1 whitespace-nowrap ${
                            isCurrent
                              ? 'text-[#0f3b7d]'
                              : isCompleted
                              ? 'text-slate-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                      {idx < 3 && (
                        <div
                          className={`h-0.5 flex-1 mx-3 -mt-3.5 transition-colors duration-200 ${
                            wizardStep > item.step ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body: Cuộn mượt bên trong modal, không bao giờ tràn màn hình */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {wizardStep === 1 && (
                <div className="space-y-4 min-h-[380px] flex flex-col justify-center">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Tên chiến dịch *
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Ví dụ: Tuyển sinh Đồng Nai 2026 Đợt 1"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Ghi chú / mục tiêu
                    </label>
                    <textarea
                      rows={5}
                      value={campaignNotes}
                      onChange={(e) => setCampaignNotes(e.target.value)}
                      placeholder="Mô tả đợt tuyển sinh, mục tiêu, lĩnh vực quan tâm..."
                      className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Chọn các trường học mục tiêu. Đã chọn: <strong className="text-blue-700">{selectedDestinations.length} trường</strong>
                    </p>
                    {selectedDestinations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDestinations([])}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Bỏ chọn tất cả
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      placeholder="Tìm trường theo tên, mã hoặc địa chỉ..."
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
                    />
                  </div>

                  {/* Hiển thị dạng LIST với chiều cao cố định để không co giãn khi tìm kiếm */}
                  <div className="h-[380px] overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-[5px] p-1 bg-slate-50/30">
                    {filteredSchools.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center rounded-[5px] border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                        <Building2 className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">Không tìm thấy trường nào phù hợp</p>
                        <p className="text-xs text-slate-400 mt-1">Thử tìm kiếm với từ khóa khác</p>
                      </div>
                    ) : (
                      filteredSchools.map((school) => {
                        const isSelected = selectedDestinations.some((item) => item.school_id === school.id);
                        return (
                          <div
                            key={school.id}
                            onClick={() => toggleDestination(school)}
                            className={`cursor-pointer rounded-[5px] border p-3 transition ${
                              isSelected
                                ? 'border-[#0f3b7d] bg-blue-50/70 shadow-2xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-[5px] border flex items-center justify-center shrink-0 transition ${
                                    isSelected
                                      ? 'bg-[#0f3b7d] border-[#0f3b7d] text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-900 text-sm truncate">{school.name}</p>
                                    {school.code && (
                                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-[5px] shrink-0">
                                        {school.code}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{school.address || 'Chưa có địa chỉ'}</span>
                                  </p>
                                </div>
                              </div>

                              {isSelected && (() => {
                                const destItem = selectedDestinations.find((item) => item.school_id === school.id);
                                const vTime = destItem?.preferred_visit_time;
                                const vDur = destItem?.visit_duration_minutes || 60;
                                return (
                                  <div className="shrink-0">
                                    {vTime ? (
                                      <span className="text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-[5px] flex items-center gap-1.5 shadow-2xs">
                                        <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                        <span>{vTime} - {calculateDepartureTime(vTime, vDur)}</span>
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium bg-white border border-slate-200 text-slate-500 px-2.5 py-1 rounded-[5px] flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span>Giờ tự động</span>
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Khung nhập giờ ghé thăm khi trường được chọn */}
                            {isSelected && (() => {
                              const destItem = selectedDestinations.find((item) => item.school_id === school.id);
                              const vTime = destItem?.preferred_visit_time || '';
                              const vDur = destItem?.visit_duration_minutes || 60;
                              return (
                                <div
                                  className="mt-2.5 pt-2.5 border-t border-blue-200/60 flex flex-wrap items-center justify-between gap-2.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-[#0f3b7d]" />
                                      Khung giờ ghé thăm:
                                    </span>

                                    {/* Giờ đến */}
                                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-[5px] px-2 py-1 shadow-2xs">
                                      <span className="text-[11px] text-slate-500 font-medium">Giờ đến:</span>
                                      <input
                                        type="time"
                                        value={vTime}
                                        onChange={(e) => updateDestinationVisitTime(school.id, e.target.value, vDur)}
                                        className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                                        title="Nhập hoặc chọn giờ muốn ghé thăm trường"
                                      />
                                    </div>

                                    {/* Thời lượng ở lại */}
                                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-[5px] px-2 py-1 shadow-2xs">
                                      <span className="text-[11px] text-slate-500 font-medium">Ở lại:</span>
                                      <select
                                        value={vDur}
                                        onChange={(e) => updateDestinationVisitTime(school.id, vTime, parseInt(e.target.value, 10))}
                                        className="text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
                                        title="Thời gian làm việc / tư vấn tại trường"
                                      >
                                        <option value={30}>30 phút</option>
                                        <option value={45}>45 phút</option>
                                        <option value={60}>60 phút (1 giờ)</option>
                                        <option value={90}>90 phút (1.5 giờ)</option>
                                        <option value={120}>120 phút (2 giờ)</option>
                                        <option value={150}>150 phút (2.5 giờ)</option>
                                        <option value={180}>180 phút (3 giờ)</option>
                                      </select>
                                    </div>

                                    {/* Dự kiến giờ rời */}
                                    {vTime ? (
                                      <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[5px] text-xs font-semibold">
                                        <span>Rời lúc:</span>
                                        <span className="font-bold text-emerald-900">~{calculateDepartureTime(vTime, vDur)}</span>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">
                                        (Chưa đặt giờ: Tự động sắp xếp tối ưu theo đường đi)
                                      </span>
                                    )}
                                  </div>

                                  {/* Nút xóa giờ hẹn */}
                                  {vTime && (
                                    <button
                                      type="button"
                                      onClick={() => updateDestinationVisitTime(school.id, '', vDur)}
                                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-[5px] transition flex items-center gap-1 font-semibold ml-auto"
                                      title="Xóa giờ hẹn (trở về Tự động tối ưu)"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      Xóa giờ
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Chọn địa điểm làm điểm bắt đầu cho đoàn công tác tuyển sinh:
                  </p>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      placeholder="Tìm điểm bắt đầu theo tên hoặc địa chỉ..."
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
                    />
                  </div>

                  {/* Hiển thị dạng LIST cố định chiều cao 380px để không co giãn khi tìm kiếm */}
                  <div className="h-[380px] overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-[5px] p-1 bg-slate-50/30">
                    {schools.filter((school) => {
                      const q = schoolSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        school.name?.toLowerCase().includes(q) ||
                        school.address?.toLowerCase().includes(q) ||
                        school.code?.toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center rounded-[5px] border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                        <Building2 className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">Không tìm thấy địa điểm nào</p>
                        <p className="text-xs text-slate-400 mt-1">Thử tìm kiếm với từ khóa khác</p>
                      </div>
                    ) : (
                      schools
                        .filter((school) => {
                          const q = schoolSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            school.name?.toLowerCase().includes(q) ||
                            school.address?.toLowerCase().includes(q) ||
                            school.code?.toLowerCase().includes(q)
                          );
                        })
                        .map((school) => {
                          const isSelected = startPoint?.school_id === school.id;
                          return (
                            <div
                              key={school.id}
                              onClick={() => setStartPoint({
                                school_id: school.id,
                                id: school.id,
                                name: school.name,
                                address: school.address || 'Không có địa chỉ',
                                lat: Number(school.lat),
                                lng: Number(school.lng),
                              })}
                              className={`cursor-pointer rounded-[5px] border p-3 flex items-center justify-between gap-3 transition ${
                                isSelected
                                  ? 'border-[#0f3b7d] bg-blue-50/70 shadow-2xs ring-1 ring-[#0f3b7d]'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition ${
                                    isSelected
                                      ? 'border-[#0f3b7d] bg-[#0f3b7d]'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-900 text-sm truncate">{school.name}</p>
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-[5px] shrink-0">
                                      {Number(school.lat).toFixed(5)}, {Number(school.lng).toFixed(5)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{school.address || 'Chưa có địa chỉ'}</span>
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="text-xs font-semibold text-[#0f3b7d] shrink-0 bg-blue-100 px-2.5 py-0.5 rounded-full">
                                  Điểm xuất phát
                                </span>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div>
                  {routePreview ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                      {/* CỘT BÊN TRÁI: THỐNG KÊ, ĐIỂM BẮT ĐẦU, DANH SÁCH TRƯỜNG & THỜI GIAN ĐI */}
                      <div className="lg:col-span-5 flex flex-col space-y-3">
                        {/* Thẻ thống kê thời gian & cự ly */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-[5px] bg-white p-3 border border-emerald-100 shadow-2xs">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Khoảng cách</p>
                            <p className="font-black text-slate-900 text-base mt-0.5">{routePreview.estimated_distance_km} km</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Đường bộ</p>
                          </div>
                          <div className="rounded-[5px] bg-white p-3 border border-emerald-100 shadow-2xs">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Thời gian đi</p>
                            <p className="font-black text-blue-700 text-base mt-0.5">
                              {routePreview.estimated_duration_text || (routePreview.estimated_duration_minutes >= 60
                                ? `${Math.floor(routePreview.estimated_duration_minutes / 60)}g ${routePreview.estimated_duration_minutes % 60}p`
                                : `${routePreview.estimated_duration_minutes}p`)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">~ {routePreview.estimated_duration_minutes} phút</p>
                          </div>
                          <div className="rounded-[5px] bg-white p-3 border border-emerald-100 shadow-2xs">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Số trường</p>
                            <p className="font-black text-slate-900 text-base mt-0.5">{routePreview.total_destinations}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Mục tiêu</p>
                          </div>
                        </div>

                        {/* Điểm xuất phát */}
                        <div className="rounded-[5px] border border-slate-200 bg-slate-50 p-3 shadow-2xs">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Điểm xuất phát</span>
                            <span className="text-[10px] font-bold bg-blue-100 text-[#0f3b7d] px-2 py-0.5 rounded-full">Bắt đầu</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">{startPoint?.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{startPoint?.address}</p>
                        </div>

                        {/* Thứ tự ghé thăm và thời gian đi */}
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                              Thứ tự ghé thăm & Thời gian đi
                            </p>
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-[5px]">
                              Đã tối ưu Next-Hop
                            </span>
                          </div>

                          <div className="space-y-2 overflow-y-auto max-h-[250px] pr-1 flex-1">
                            {routePreview.destinations && routePreview.destinations.length > 0 ? (
                              routePreview.destinations.map((dest: any, idx: number) => (
                                <div
                                  key={dest.school_id || dest.name + idx}
                                  className="flex items-center justify-between gap-2.5 rounded-[5px] bg-white border border-slate-200 p-2.5 text-xs text-slate-700 hover:border-slate-300 transition shadow-2xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-slate-900 text-xs truncate">{dest.name}</p>
                                        {(dest.preferred_visit_time || dest.preferred_time) ? (
                                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded-[5px] shrink-0 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-indigo-600" />
                                            {dest.preferred_visit_time || dest.preferred_time} - {calculateDepartureTime(dest.preferred_visit_time || dest.preferred_time, dest.visit_duration_minutes || 60)} ({dest.visit_duration_minutes || 60}p)
                                          </span>
                                        ) : dest.priority ? (
                                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-[5px] shrink-0">
                                            Ưu tiên {dest.priority}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-[5px] shrink-0">
                                            Linh hoạt
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 line-clamp-1">{dest.address}</p>
                                    </div>
                                  </div>
                                  {(dest.distance_text || dest.duration_text) && (
                                    <div className="text-right shrink-0">
                                      <span className="text-[11px] font-bold text-blue-700 block">{dest.distance_text}</span>
                                      <span className="text-[10px] text-slate-500 block">~ {dest.duration_text}</span>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              routePreview.optimized_order?.map((item: string, idx: number) => (
                                <div key={item + idx} className="flex items-center gap-2 rounded-[5px] bg-white border border-slate-200 p-2 text-xs text-slate-700">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[#0f3b7d] text-[10px] font-bold">
                                    {idx + 1}
                                  </span>
                                  <span>{item}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CỘT BÊN PHẢI: BẢN ĐỒ TUYẾN ĐƯỜNG */}
                      <div className="lg:col-span-7 flex flex-col h-full rounded-[5px] border border-slate-200 bg-white p-2.5 shadow-xs min-h-[420px]">
                        <div className="mb-2 flex items-center justify-between px-2 pt-1">
                          <div className="flex items-center gap-2">
                            <Compass className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bản đồ tuyến chiến dịch</span>
                          </div>
                          <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-[5px]">
                            Tuyến đường bộ
                          </span>
                        </div>
                        <div className="flex-1 w-full rounded-[5px] overflow-hidden border border-slate-100">
                          <CampaignRouteMap
                            startPoint={startPoint}
                            destinations={routePreview.destinations || []}
                            routeGeometry={routePreview.route_geometry}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 text-center py-10">
                      Đang tính toán lộ trình tối ưu...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer: Cố định */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={wizardStep === 1 ? () => {
                  setIsModalOpen(false);
                  resetWizard();
                } : prevStep}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[5px] border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                {wizardStep === 1 ? 'Hủy' : 'Quay lại'}
              </button>

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={wizardLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[5px] bg-[#0f3b7d] text-white font-semibold text-sm hover:bg-[#0c2f64] transition disabled:opacity-60"
                >
                  {wizardLoading && wizardStep === 3 ? 'Đang tính toán lộ trình...' : 'Tiếp tục'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmCreateCampaign}
                  disabled={wizardLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[5px] bg-[#0f3b7d] text-white font-semibold text-sm hover:bg-[#0c2f64] transition disabled:opacity-60 shadow-sm"
                >
                  {wizardLoading ? 'Đang lưu...' : 'Xác nhận tạo chiến dịch'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FORM PHÂN BỔ NHÂN SỰ & LỘ TRÌNH (ALL-IN-ONE ALLOCATION MODAL) */}
      {/* ========================================================================= */}
      {isAllocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-[5px] max-w-7xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 animate-slide-up overflow-hidden">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[5px] bg-[#0f3b7d]/10 text-[#0f3b7d] flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Phân Bổ Nhân Sự & Lịch Trình Tuyến Đi
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chọn chiến dịch, thiết lập thời gian bắt đầu - kết thúc và phân công đoàn công tác
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAllocationModalOpen(false);
                  setIsAutoAllocating(false);
                }}
                className="p-2 rounded-[5px] text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* THANH CHỌN CHIẾN DỊCH & THỜI GIAN ĐI (START DATE - END DATE) */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-[5px] p-4 shadow-2xs">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Dropdown Chọn chiến dịch */}
                  <div className="lg:col-span-6">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#0f3b7d]" />
                      <span>Chiến dịch tuyển sinh (*)</span>
                    </label>
                    <div className="relative w-full">
                      <button
                        type="button"
                        onClick={() => setIsCampaignDropdownOpen((prev) => !prev)}
                        className="w-full h-10 bg-white rounded-[5px] border border-slate-200 hover:border-slate-300 px-3.5 flex items-center justify-between gap-2.5 shadow-2xs transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-[5px] bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0">
                            <Compass className="w-3.5 h-3.5" />
                          </div>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {selectedAllocationCampaign?.name || 'Chọn chiến dịch để phân bổ...'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {selectedAllocationCampaign && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAllocationCampaignId(null);
                                setSelectedAllocationCampaign(null);
                                setIsCampaignDropdownOpen(false);
                              }}
                              title="Bỏ chọn chiến dịch"
                              className="p-1 rounded-[5px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                              isCampaignDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Dropdown Popover */}
                      {isCampaignDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsCampaignDropdownOpen(false)}
                          />
                          <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-[5px] border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col">
                            <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
                              <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  autoFocus
                                  value={campaignDropdownSearch}
                                  onChange={(e) => setCampaignDropdownSearch(e.target.value)}
                                  placeholder="Tìm kiếm chiến dịch..."
                                  className="w-full pl-9 pr-7 py-2 text-xs bg-white border border-slate-200 rounded-[5px] focus:outline-none focus:border-[#0f3b7d]"
                                />
                                {campaignDropdownSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setCampaignDropdownSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                              {dropdownFilteredCampaigns.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400">
                                  Không tìm thấy chiến dịch
                                </div>
                              ) : (
                                dropdownFilteredCampaigns.map((camp) => {
                                  const isSelected =
                                    (camp.id || camp._id) === selectedAllocationCampaignId;
                                  return (
                                    <button
                                      key={camp.id || camp._id}
                                      type="button"
                                      onClick={() => handleSelectCampaignInAllocation(camp)}
                                      className={`w-full text-left p-2.5 rounded-[5px] flex items-center justify-between gap-2 transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-blue-50/80 text-[#0f3b7d] font-bold'
                                          : 'hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <p className="text-xs truncate font-semibold">{camp.name}</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                          {camp.destinations?.length || 0} trường
                                          {camp.estimated_distance_km
                                            ? ` • ${camp.estimated_distance_km} km`
                                            : ''}
                                        </p>
                                      </div>
                                      {isSelected && (
                                        <Check className="w-4 h-4 text-[#0f3b7d] shrink-0" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ngày bắt đầu */}
                  <div className="lg:col-span-3">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ngày bắt đầu (*)</span>
                    </label>
                    <input
                      type="date"
                      value={allocationStartDate}
                      onChange={(e) => setAllocationStartDate(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-[5px] text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0f3b7d] shadow-2xs"
                    />
                  </div>

                  {/* Ngày kết thúc */}
                  <div className="lg:col-span-3">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ngày kết thúc</span>
                    </label>
                    <input
                      type="date"
                      value={allocationEndDate}
                      onChange={(e) => setAllocationEndDate(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-[5px] text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0f3b7d] shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {!selectedAllocationCampaign ? (
                <div className="bg-slate-50/50 rounded-[5px] border border-dashed border-slate-200 p-16 text-center flex flex-col items-center justify-center min-h-[360px]">
                  <Compass className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-bold text-slate-700 text-sm">Vui lòng chọn một chiến dịch từ menu ở trên</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    Sau khi chọn chiến dịch, thông tin lộ trình và bản đồ tuyến đi sẽ xuất hiện tại đây để bạn gán nhân sự đoàn công tác.
                  </p>
                </div>
              ) : (
                /* NỘI DUNG 2 CỘT: TRÁI = THÔNG TIN + PHÂN CÔNG + LỘ TRÌNH + BẢN ĐỒ | PHẢI = CỘT STAFF */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* CỘT TRÁI (lg:col-span-8) */}
                  <div className="lg:col-span-8 space-y-5">
                    {/* 1. Tóm tắt thông tin chiến dịch */}
                    <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                        <div>
                          <h4 className="text-base font-bold text-slate-900">
                            {selectedAllocationCampaign.name}
                          </h4>
                          {selectedAllocationCampaign.description && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {selectedAllocationCampaign.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {totalAssignedStaffCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-xs font-bold bg-emerald-100 text-emerald-800">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Đã phân bổ ({totalAssignedStaffCount} nhân sự)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Chưa phân bổ</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Thống kê nhanh: 3 cột (Bỏ phần hiển thị Trưởng đoàn) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                        <div className="p-2.5 rounded-[5px] bg-slate-50 border border-slate-100 text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Số trường</span>
                          <p className="text-base font-black text-slate-900 mt-0.5">
                            {selectedAllocationCampaign.destinations?.length || 0}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-[5px] bg-slate-50 border border-slate-100 text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Quãng đường</span>
                          <p className="text-base font-black text-blue-700 mt-0.5">
                            {selectedAllocationCampaign.estimated_distance_km ? `${selectedAllocationCampaign.estimated_distance_km} km` : '--'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-[5px] bg-slate-50 border border-slate-100 text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Thời gian đi</span>
                          <p className="text-base font-black text-slate-900 mt-0.5 truncate">
                            {selectedAllocationCampaign.estimated_duration_text || (selectedAllocationCampaign.estimated_duration_minutes ? `${selectedAllocationCampaign.estimated_duration_minutes} phút` : '--')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 3. Lộ trình từ đầu đến cuối (Điểm xuất phát & Danh sách các trường) */}
                    <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Lộ trình các điểm dừng</h4>
                        </div>
                        <span className="text-xs text-slate-400 font-semibold shrink-0">
                          {(selectedAllocationCampaign.destinations?.length || 0) + (selectedAllocationCampaign.start_point ? 1 : 0)} điểm
                        </span>
                      </div>

                      {/* Điểm bắt đầu [S] */}
                      {selectedAllocationCampaign.start_point && (() => {
                        const spInfo = getStartPointInfo(selectedAllocationCampaign.start_point);
                        const isSelectedForAssign = selectedStopIdForAllocation === 'START';
                        const isDragOver = dragOverStopId === 'START';
                        const assignedList = stopAssignments['START'] || [];

                        return (
                          <div
                            onClick={() => setSelectedStopIdForAllocation('START')}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'copy';
                              if (dragOverStopId !== 'START') setDragOverStopId('START');
                            }}
                            onDragLeave={() => {
                              if (dragOverStopId === 'START') setDragOverStopId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverStopId(null);
                              try {
                                const raw = e.dataTransfer.getData('text/plain');
                                if (raw) {
                                  const u = JSON.parse(raw);
                                  assignStaffToStop('START', u);
                                }
                              } catch (err) {}
                            }}
                            className={`p-3 rounded-[5px] border transition cursor-pointer shadow-2xs ${
                              isDragOver
                                ? 'border-dashed border-2 border-blue-600 bg-blue-100/80 ring-4 ring-blue-300'
                                : isSelectedForAssign
                                ? 'border-[#0f3b7d] bg-blue-50/90 ring-2 ring-[#0f3b7d]/30 shadow-xs'
                                : 'border-blue-100 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="w-7 h-7 rounded-[5px] bg-[#0f3b7d] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs"
                                  title="Điểm xuất phát"
                                >
                                  S
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-slate-900 text-xs truncate">
                                      {spInfo?.name || 'Điểm xuất phát'}
                                    </p>
                                    <span className="text-[10px] font-bold bg-blue-100 text-[#0f3b7d] px-1.5 py-0.2 rounded-[5px] shrink-0">
                                      Xuất phát
                                    </span>
                                  </div>
                                  {spInfo?.address && (
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{spInfo.address}</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                              </div>
                            </div>

                            {/* Danh sách nhân sự được phân công cho Điểm xuất phát */}
                            {(assignedList.length > 0 || isDragOver) && (
                              <div className="mt-2.5 pt-2 border-t border-blue-200/60 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-[#0f3b7d]" />
                                  Nhân sự phụ trách:
                                </span>
                                {isDragOver && assignedList.length === 0 && (
                                  <span className="text-[11px] text-blue-600 font-semibold italic">
                                    ⬇ Thả nhân sự vào đây
                                  </span>
                                )}
                                {assignedList.map((st) => (
                                  <span
                                    key={st.id || st.name}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-white border border-blue-200 text-[#0f3b7d] text-xs font-semibold shadow-2xs"
                                  >
                                    <span>{st.name}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeStaffFromStop('START', st.id || st.name);
                                      }}
                                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded-[3px] transition cursor-pointer"
                                      title="Xóa nhân sự khỏi điểm này"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Danh sách các trường [1], [2], ... */}
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {selectedAllocationCampaign.destinations && selectedAllocationCampaign.destinations.length > 0 ? (
                          selectedAllocationCampaign.destinations.map((dest: any, idx: number) => {
                            const stopKey = dest.school_id || dest.id || `STOP_${idx}`;
                            const isSelectedForAssign = selectedStopIdForAllocation === stopKey;
                            const isDragOver = dragOverStopId === stopKey;
                            const assignedList = stopAssignments[stopKey] || [];

                            return (
                              <div
                                key={stopKey}
                                onClick={() => setSelectedStopIdForAllocation(stopKey)}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'copy';
                                  if (dragOverStopId !== stopKey) setDragOverStopId(stopKey);
                                }}
                                onDragLeave={() => {
                                  if (dragOverStopId === stopKey) setDragOverStopId(null);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverStopId(null);
                                  try {
                                    const raw = e.dataTransfer.getData('text/plain');
                                    if (raw) {
                                      const u = JSON.parse(raw);
                                      assignStaffToStop(stopKey, u);
                                    }
                                  } catch (err) {}
                                }}
                                className={`p-2.5 rounded-[5px] border transition cursor-pointer ${
                                  isDragOver
                                    ? 'border-dashed border-2 border-blue-600 bg-blue-100/80 ring-4 ring-blue-300'
                                    : isSelectedForAssign
                                    ? 'border-[#0f3b7d] bg-blue-50/80 ring-2 ring-[#0f3b7d]/30 shadow-xs'
                                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                      className={`w-6 h-6 rounded-[5px] flex items-center justify-center text-xs font-bold shrink-0 ${
                                        isSelectedForAssign ? 'bg-[#0f3b7d] text-white' : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-slate-900 text-xs truncate">
                                          {dest.name}
                                        </p>
                                        {(dest.preferred_visit_time || dest.preferred_time) ? (
                                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded-[5px] shrink-0 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-indigo-600" />
                                            {dest.preferred_visit_time || dest.preferred_time} ({dest.visit_duration_minutes || 60}p)
                                          </span>
                                        ) : dest.priority ? (
                                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-[5px] shrink-0">
                                            Ưu tiên {dest.priority}
                                          </span>
                                        ) : null}
                                        {dest.code && (
                                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-[5px] shrink-0">
                                            {dest.code}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                        {dest.address || 'Chưa có địa chỉ'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {(dest.distance_text || dest.duration_text) && (
                                      <div className="text-right">
                                        <span className="text-[11px] font-bold text-blue-700 block">{dest.distance_text}</span>
                                        <span className="text-[10px] text-slate-400 block">~ {dest.duration_text}</span>
                                      </div>
                                    )}
                                    {(dest.school_id || dest.id) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/admin/schools/${dest.school_id || dest.id}`);
                                        }}
                                        className="p-1 text-blue-700 hover:text-blue-900 hover:bg-blue-100/60 rounded-[5px] transition"
                                        title="Xem hồ sơ trường"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Nhân sự phụ trách cho chặng này */}
                                {(assignedList.length > 0 || isDragOver) && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                      <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                                      Nhân sự phụ trách:
                                    </span>
                                    {isDragOver && assignedList.length === 0 && (
                                      <span className="text-[11px] text-blue-600 font-semibold italic">
                                        ⬇ Thả nhân sự vào đây
                                      </span>
                                    )}
                                    {assignedList.map((st) => (
                                      <span
                                        key={st.id || st.name}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-blue-50 text-[#0f3b7d] border border-blue-200 text-xs font-semibold shadow-2xs"
                                      >
                                        <span>{st.name}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeStaffFromStop(stopKey, st.id || st.name);
                                          }}
                                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded-[3px] transition cursor-pointer"
                                          title="Xóa nhân sự khỏi điểm này"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Chiến dịch chưa có trường học nào
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. Bản đồ trực quan tuyến đường (Không tele khi bấm điểm dừng) */}
                    <div className="bg-white rounded-[5px] border border-slate-200/80 p-3 shadow-xs">
                      <div className="h-[380px] w-full rounded-[5px] overflow-hidden border border-slate-100">
                        <CampaignRouteMap
                          startPoint={selectedAllocationCampaign.start_point}
                          destinations={selectedAllocationCampaign.destinations || []}
                          routeGeometry={selectedAllocationCampaign.route_geometry}
                          activeSchool={undefined}
                          onSelectSchool={undefined}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CỘT PHẢI: KHUNG CỘT NHÂN SỰ HỆ THỐNG (lg:col-span-4) */}
                  <div className="lg:col-span-4 bg-white rounded-[5px] border border-slate-200/80 p-4 shadow-xs space-y-3 sticky top-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#0f3b7d]" />
                        <h4 className="text-sm font-bold text-slate-900">Danh Sách Nhân Sự</h4>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-[5px] font-bold bg-blue-100 text-[#0f3b7d]">
                        {staffList.length}
                      </span>
                    </div>

                    {/* Tìm kiếm staff */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={staffSearch}
                        onChange={(e) => setStaffSearch(e.target.value)}
                        placeholder="Tìm nhân sự theo tên, email..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-[#0f3b7d]"
                      />
                      {staffSearch && (
                        <button
                          type="button"
                          onClick={() => setStaffSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Danh sách staff hỗ trợ kéo thả và click gán */}
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {staffList.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          Không tìm thấy nhân sự
                        </div>
                      ) : (
                        staffList.map((user) => {
                          const userName = user.full_name || user.username;
                          const userId = String(user.id || user._id || user.username);
                          const currentStopList = stopAssignments[selectedStopIdForAllocation] || [];
                          const isAssignedToCurrent = currentStopList.some((s) => s.id === userId || s.name === userName);

                          // Đếm xem nhân sự này được phân công vào bao nhiêu điểm trên toàn lộ trình
                          let assignedStopsCount = 0;
                          Object.values(stopAssignments).forEach((list) => {
                            if (list.some((s) => s.id === userId || s.name === userName)) {
                              assignedStopsCount += 1;
                            }
                          });

                          return (
                            <div
                              key={user.id}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify(user));
                                setDraggedStaff(user);
                              }}
                              onDragEnd={() => {
                                setDraggedStaff(null);
                                setDragOverStopId(null);
                              }}
                              onClick={() => toggleStaffOnStop(selectedStopIdForAllocation, user)}
                              className={`p-2.5 rounded-[5px] border transition cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 select-none ${
                                isAssignedToCurrent
                                  ? 'bg-blue-50/90 border-[#0f3b7d] ring-1 ring-[#0f3b7d]/30 shadow-2xs'
                                  : assignedStopsCount > 0
                                  ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                                  : 'bg-slate-50/60 border-slate-100 hover:bg-white hover:border-slate-300 hover:shadow-2xs'
                              }`}
                              title="Kéo thả vào điểm dừng hoặc bấm để phân công"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <GripVertical className="w-4 h-4 text-slate-400 shrink-0 cursor-grab" />
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 uppercase ${
                                    isAssignedToCurrent
                                      ? 'bg-[#0f3b7d] text-white'
                                      : assignedStopsCount > 0
                                      ? 'bg-emerald-700 text-white'
                                      : 'bg-slate-700 text-white'
                                  }`}
                                >
                                  {userName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate">
                                    {userName}
                                  </p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {user.email || ''}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                {isAssignedToCurrent ? (
                                  <span className="text-[10px] font-bold bg-[#0f3b7d] text-white px-2 py-0.5 rounded-[5px]">
                                    ✓ Đang gán
                                  </span>
                                ) : assignedStopsCount > 0 ? (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-[5px]">
                                    Đã gán ({assignedStopsCount} điểm)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-[5px]">
                                    {user.role || 'staff'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAllocationModalOpen(false);
                  setIsAutoAllocating(false);
                }}
                className="px-4 py-2 rounded-[5px] border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>

              <div className="flex items-center gap-2.5 flex-wrap justify-end w-full sm:w-auto">
                {isAutoAllocating ? (
                  <>
                    {/* Các ô nhập số lượng cho từng điểm: S, 1, 2, ... */}
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-[280px] sm:max-w-md p-1 rounded-[5px] border border-slate-200/90 bg-white shadow-2xs">
                      {/* Điểm S */}
                      {selectedAllocationCampaign?.start_point && (
                        <div
                          className="flex items-center border border-blue-200 rounded-[4px] overflow-hidden shrink-0"
                          title={`Điểm xuất phát [S]: ${selectedAllocationCampaign.start_point.name || 'Điểm bắt đầu'}`}
                        >
                          <span className="w-5 h-7 bg-[#0f3b7d] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                            S
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={autoAllocCounts['START'] ?? ''}
                            onChange={(e) =>
                              setAutoAllocCounts((prev) => ({
                                ...prev,
                                START: e.target.value,
                              }))
                            }
                            className="w-9 h-7 text-center text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none"
                            placeholder="0"
                          />
                        </div>
                      )}

                      {/* Các điểm 1, 2, ... */}
                      {(selectedAllocationCampaign?.destinations || []).map((dest: any, idx: number) => {
                        const stopKey = dest.school_id || dest.id || `STOP_${idx}`;
                        return (
                          <div
                            key={stopKey}
                            className="flex items-center border border-emerald-200 rounded-[4px] overflow-hidden shrink-0"
                            title={`Điểm dừng [${idx + 1}]: ${dest.name || `Trường ${idx + 1}`}`}
                          >
                            <span className="w-5 h-7 bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={autoAllocCounts[stopKey] ?? ''}
                              onChange={(e) =>
                                setAutoAllocCounts((prev) => ({
                                  ...prev,
                                  [stopKey]: e.target.value,
                                }))
                              }
                              className="w-9 h-7 text-center text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Nút Xác nhận màu xanh */}
                    <button
                      type="button"
                      onClick={handleConfirmAutoAllocate}
                      className="h-8.5 px-3 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Xác nhận</span>
                    </button>

                    {/* Nút Hủy màu đỏ */}
                    <button
                      type="button"
                      onClick={() => setIsAutoAllocating(false)}
                      className="h-8.5 px-3 rounded-[5px] bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Hủy</span>
                    </button>
                  </>
                ) : (
                  /* Nút Tự động (bên trái nút Lưu & Phân bổ) */
                  <button
                    type="button"
                    onClick={handleStartAutoAllocate}
                    disabled={!selectedAllocationCampaign}
                    title="Tự động phân bổ ngẫu nhiên nhân sự"
                    className="h-9 px-3.5 rounded-[5px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tự động</span>
                  </button>
                )}

                {/* Nút Lưu & Phân bổ chuyến đi */}
                <button
                  type="button"
                  onClick={handleSaveAllocation}
                  disabled={savingAssignment || !selectedAllocationCampaign}
                  className="h-9 px-5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer shrink-0"
                >
                  {savingAssignment ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang lưu vào hệ thống...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Lưu & Phân bổ chuyến đi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XEM NHANH LỘ TRÌNH & BẢN ĐỒ TUYẾN ĐI ĐÃ PHÂN BỔ */}
      {/* ========================================================================= */}
      {viewingAllocatedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-[5px] max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-slide-up overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[5px] bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Route className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      {viewingAllocatedTrip.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-[5px] bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Đã phân bổ
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {viewingAllocatedTrip.deployed_trip_id && (
                      <span className="font-mono font-bold mr-2">Mã chuyến: {viewingAllocatedTrip.deployed_trip_id}</span>
                    )}
                    {viewingAllocatedTrip.destinations?.length || 0} trường mục tiêu
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingAllocatedTrip(null)}
                className="p-2 rounded-[5px] text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner tóm tắt đoàn & thời gian */}
            <div className="px-6 py-3 bg-blue-50/60 border-b border-blue-100/80 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-[#0f3b7d] font-bold">
                <Calendar className="w-4 h-4" />
                <span>
                  {formatDateDisplay(viewingAllocatedTrip.start_date) || 'Chưa định ngày'}
                </span>
                <span className="font-normal text-slate-400">đến</span>
                <span>
                  {formatDateDisplay(viewingAllocatedTrip.end_date) || 'Chưa định ngày'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span className="font-bold">{viewingAllocatedTrip.team?.leader_name || 'Chưa có trưởng đoàn'}</span>
                </div>
                {viewingAllocatedTrip.team?.vehicle_plate && (
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold">{viewingAllocatedTrip.team.vehicle_plate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Body: Lộ trình & Bản đồ */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Cột trái: Lộ trình các điểm dừng */}
                <div className="lg:col-span-5 flex flex-col space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-[5px] bg-slate-50 p-2.5 border border-slate-100 text-center">
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">Khoảng cách</span>
                      <span className="font-black text-blue-700 text-sm mt-0.5 block">
                        {viewingAllocatedTrip.estimated_distance_km ? `${viewingAllocatedTrip.estimated_distance_km} km` : '--'}
                      </span>
                    </div>
                    <div className="rounded-[5px] bg-slate-50 p-2.5 border border-slate-100 text-center">
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">Thời gian</span>
                      <span className="font-black text-slate-800 text-sm mt-0.5 block truncate">
                        {viewingAllocatedTrip.estimated_duration_text || (viewingAllocatedTrip.estimated_duration_minutes ? `${viewingAllocatedTrip.estimated_duration_minutes}p` : '--')}
                      </span>
                    </div>
                    <div className="rounded-[5px] bg-slate-50 p-2.5 border border-slate-100 text-center">
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">Số trường</span>
                      <span className="font-black text-slate-800 text-sm mt-0.5 block">
                        {viewingAllocatedTrip.destinations?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Điểm xuất phát */}
                  {viewingAllocatedTrip.start_point && (() => {
                    const spInfo = getStartPointInfo(viewingAllocatedTrip.start_point);
                    return (
                      <div className="p-3 rounded-[5px] bg-blue-50/70 border border-blue-100 flex items-center gap-3">
                        <span className="w-7 h-7 rounded-[5px] bg-[#0f3b7d] text-white flex items-center justify-center text-xs font-bold shrink-0">
                          S
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate">
                            {spInfo?.name || 'Điểm xuất phát'}
                          </p>
                          {spInfo?.address && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{spInfo.address}</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Danh sách trường */}
                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[380px] pr-1">
                    {viewingAllocatedTrip.destinations && viewingAllocatedTrip.destinations.length > 0 ? (
                      viewingAllocatedTrip.destinations.map((d: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-[5px] border border-slate-200/80 bg-white flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-[5px] bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{d.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{d.address || 'Chưa có địa chỉ'}</p>
                            </div>
                          </div>
                          {(d.distance_text || d.duration_text) && (
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-bold text-blue-700 block">{d.distance_text}</span>
                              <span className="text-[9px] text-slate-400 block">~ {d.duration_text}</span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">Không có trường học nào</div>
                    )}
                  </div>
                </div>

                {/* Cột phải: Bản đồ tuyến đường */}
                <div className="lg:col-span-7 h-[460px] rounded-[5px] overflow-hidden border border-slate-200 shadow-2xs">
                  <CampaignRouteMap
                    startPoint={
                      viewingAllocatedTrip.start_point ||
                      campaigns.find((c) => c.id === viewingAllocatedTrip.campaign_id || c._id === viewingAllocatedTrip.campaign_id)?.start_point
                    }
                    destinations={
                      (viewingAllocatedTrip.destinations && viewingAllocatedTrip.destinations.length > 0)
                        ? viewingAllocatedTrip.destinations
                        : (campaigns.find((c) => c.id === viewingAllocatedTrip.campaign_id || c._id === viewingAllocatedTrip.campaign_id)?.destinations || [])
                    }
                    routeGeometry={
                      viewingAllocatedTrip.route_geometry && viewingAllocatedTrip.route_geometry.length > 1
                        ? viewingAllocatedTrip.route_geometry
                        : (() => {
                            const pCamp = campaigns.find(
                              (c) => c.id === viewingAllocatedTrip.campaign_id || c._id === viewingAllocatedTrip.campaign_id
                            );
                            return pCamp?.route_geometry && pCamp.route_geometry.length > 1
                              ? pCamp.route_geometry
                              : undefined;
                          })()
                    }
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setViewingAllocatedTrip(null)}
                className="px-4 py-2 rounded-[5px] border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={() => {
                  const camp = viewingAllocatedTrip;
                  setViewingAllocatedTrip(null);
                  openAllocationModal(camp);
                }}
                className="px-5 py-2 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Chỉnh sửa phân bổ này</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
