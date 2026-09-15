import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  Plus,
  Play,
  Building2,
  Zap,
  Clock,
  Sparkles,
  Search,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { campaignApi, schoolApi } from '../../../services/api';

const routeMarkerIcon = (color: string, label: string) =>
  L.divIcon({
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 9999px;
        background: ${color};
        border: 3px solid white;
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

function RoutePreviewMap({
  startPoint,
  destinations,
  routeGeometry,
}: {
  startPoint: any;
  destinations: any[];
  routeGeometry?: [number, number][];
}) {
  const routePoints = [
    startPoint,
    ...(destinations || [])
  ].filter(Boolean);

  if (routePoints.length === 0) {
    return (
      <div className="h-[340px] rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Chưa có dữ liệu tuyến đường.
      </div>
    );
  }

  // Ưu tiên vẽ tọa độ uốn lượn thực tế đường bộ (OSRM / Google Maps)
  const polylinePositions: [number, number][] =
    routeGeometry && routeGeometry.length > 1
      ? (routeGeometry as [number, number][])
      : (routePoints.map((point) => [Number(point.lat), Number(point.lng)]) as [number, number][]);

  const bounds = L.latLngBounds(polylinePositions as [number, number][]);

  return (
    <div className="h-full min-h-[380px] w-full overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [30, 30] }}
        scrollWheelZoom={false}
        zoomControl={true}
        style={{ height: '100%', minHeight: '380px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Tuyến đường uốn lượn theo đường giao thông thực tế như Google Maps */}
        <Polyline
          positions={polylinePositions}
          color="#2563eb"
          weight={5}
          opacity={0.85}
        />

        {/* Điểm xuất phát */}
        <Marker position={[Number(startPoint.lat), Number(startPoint.lng)]} icon={routeMarkerIcon('#0f3b7d', 'S')}>
          <Popup>
            <div className="text-sm">
              <strong className="text-blue-900">Điểm xuất phát</strong><br />
              <strong>{startPoint.name}</strong><br />
              <span className="text-xs text-slate-600">{startPoint.address}</span>
            </div>
          </Popup>
        </Marker>

        {/* Các điểm trường mục tiêu */}
        {destinations.map((point, index) => (
          <Marker
            key={`${point.name}-${index}`}
            position={[Number(point.lat), Number(point.lng)]}
            icon={routeMarkerIcon('#16a34a', String(index + 1))}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-emerald-700">Điểm dừng {index + 1}</strong><br />
                <strong>{point.name}</strong><br />
                <span className="text-xs text-slate-600">{point.address}</span>
                {point.distance_text && (
                  <div className="mt-1 text-xs text-blue-600 font-medium">
                    Chặng: {point.distance_text} ~ {point.duration_text}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  useEffect(() => {
    loadCampaigns();
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
        },
      ];
    });
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

  const handleOptimizeRoute = async (campaignId: string) => {
    try {
      setActionLoading(`opt-${campaignId}`);
      const res = await campaignApi.optimizeRoute(campaignId);
      setActionMessage(
        `Đã tính toán thành công lộ trình Next-Hop cho chiến dịch! Tổng quãng đường: ${res.estimated_distance_km} km (${res.total_destinations} trường).`
      );
      loadCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi tối ưu đường đi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeploy = async (campaignId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn triển khai chiến dịch này thành chuyến đi thực tế?')) {
      return;
    }
    try {
      setActionLoading(`deploy-${campaignId}`);
      await campaignApi.deploy(campaignId);
      setActionMessage('Đã triển khai chiến dịch thành công! Chuyến đi thực tế đã sẵn sàng.');
      loadCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi triển khai chiến dịch');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (selectedStatus === 'all') return true;
    return c.status === selectedStatus;
  });

  const stepTitles = [
    'Thông tin chiến dịch',
    'Chọn trường mục tiêu',
    'Chọn điểm bắt đầu',
    'Xem trước lộ trình',
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản Lý Chiến Dịch Tuyển Sinh
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quy hoạch lộ trình, áp dụng thuật toán Dynamic Next-Hop và triển khai các đoàn công tác.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo chiến dịch mới</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-blue-900 text-sm animate-slide-up">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="font-semibold">{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-blue-700 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', 'draft', 'active', 'deployed', 'completed'].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
              selectedStatus === st
                ? 'bg-[#0f3b7d] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {st === 'all'
              ? 'Tất cả'
              : st === 'draft'
              ? 'Bản nháp'
              : st === 'active'
              ? 'Đang hoạt động'
              : st === 'deployed'
              ? 'Đã triển khai'
              : 'Đã hoàn tất'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Đang tải danh sách chiến dịch...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Chưa có chiến dịch nào</p>
          <p className="text-xs text-slate-400 mt-1">
            Nhấn "Tạo chiến dịch mới" để bắt đầu quy hoạch đợt tuyển sinh.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((camp) => (
            <div
              key={camp.id || camp._id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {camp.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      camp.status === 'deployed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : camp.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {camp.status || 'draft'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                  {camp.notes || camp.description || 'Chưa có ghi chú chiến dịch'}
                </p>

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Số trường mục tiêu: </span>
                    <strong className="text-slate-800">{camp.destinations?.length || 0} trường</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Thuật toán: </span>
                    <span className="font-semibold text-blue-700">Dynamic Next-Hop</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleOptimizeRoute(camp.id)}
                  disabled={actionLoading === `opt-${camp.id}`}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0f3b7d] text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span>Tối ưu Next-Hop</span>
                </button>

                {camp.status !== 'deployed' && (
                  <button
                    onClick={() => handleDeploy(camp.id)}
                    disabled={actionLoading === `deploy-${camp.id}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Triển khai</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-slide-up overflow-hidden">
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
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
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
                      className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none resize-none"
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
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
                    />
                  </div>

                  {/* Hiển thị dạng LIST với chiều cao cố định để không co giãn khi tìm kiếm */}
                  <div className="h-[380px] overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-xl p-1 bg-slate-50/30">
                    {filteredSchools.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
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
                            className={`cursor-pointer rounded-xl border p-3 flex items-center justify-between gap-3 transition ${
                              isSelected
                                ? 'border-[#0f3b7d] bg-blue-50/70 shadow-2xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
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
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
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
                            {isSelected && (
                              <span className="text-xs font-semibold text-[#0f3b7d] shrink-0 bg-blue-100 px-2.5 py-0.5 rounded-full">
                                Đã chọn
                              </span>
                            )}
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
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
                    />
                  </div>

                  {/* Hiển thị dạng LIST cố định chiều cao 380px để không co giãn khi tìm kiếm */}
                  <div className="h-[380px] overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-xl p-1 bg-slate-50/30">
                    {schools.filter((school) => {
                      const q = schoolSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        school.name?.toLowerCase().includes(q) ||
                        school.address?.toLowerCase().includes(q) ||
                        school.code?.toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
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
                              className={`cursor-pointer rounded-xl border p-3 flex items-center justify-between gap-3 transition ${
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
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
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
                          <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-2xs">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Khoảng cách</p>
                            <p className="font-black text-slate-900 text-base mt-0.5">{routePreview.estimated_distance_km} km</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Đường bộ</p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-2xs">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Thời gian đi</p>
                            <p className="font-black text-blue-700 text-base mt-0.5">
                              {routePreview.estimated_duration_text || (routePreview.estimated_duration_minutes >= 60
                                ? `${Math.floor(routePreview.estimated_duration_minutes / 60)}g ${routePreview.estimated_duration_minutes % 60}p`
                                : `${routePreview.estimated_duration_minutes}p`)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">~ {routePreview.estimated_duration_minutes} phút</p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-2xs">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Số trường</p>
                            <p className="font-black text-slate-900 text-base mt-0.5">{routePreview.total_destinations}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Mục tiêu</p>
                          </div>
                        </div>

                        {/* Điểm xuất phát */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
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
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                              Đã tối ưu Next-Hop
                            </span>
                          </div>

                          <div className="space-y-2 overflow-y-auto max-h-[250px] pr-1 flex-1">
                            {routePreview.destinations && routePreview.destinations.length > 0 ? (
                              routePreview.destinations.map((dest: any, idx: number) => (
                                <div
                                  key={dest.school_id || dest.name + idx}
                                  className="flex items-center justify-between gap-2.5 rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-700 hover:border-slate-300 transition shadow-2xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900 text-xs truncate">{dest.name}</p>
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
                                <div key={item + idx} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-2 text-xs text-slate-700">
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
                      <div className="lg:col-span-7 flex flex-col h-full rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs min-h-[420px]">
                        <div className="mb-2 flex items-center justify-between px-2 pt-1">
                          <div className="flex items-center gap-2">
                            <Compass className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bản đồ tuyến chiến dịch</span>
                          </div>
                          <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                            Tuyến đường bộ OSRM
                          </span>
                        </div>
                        <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-100">
                          <RoutePreviewMap
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                {wizardStep === 1 ? 'Hủy' : 'Quay lại'}
              </button>

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={wizardLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f3b7d] text-white font-semibold text-sm hover:bg-[#0c2f64] transition disabled:opacity-60"
                >
                  {wizardLoading && wizardStep === 3 ? 'Đang tính toán lộ trình...' : 'Tiếp tục'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmCreateCampaign}
                  disabled={wizardLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f3b7d] text-white font-semibold text-sm hover:bg-[#0c2f64] transition disabled:opacity-60 shadow-sm"
                >
                  {wizardLoading ? 'Đang lưu...' : 'Xác nhận tạo chiến dịch'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
