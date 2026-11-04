import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Building2,
  Search,
  ExternalLink,
  Globe,
  School
} from 'lucide-react';
import { schoolApi } from '../../../services/api';
import { getGoogleMapsPlaceUrl } from '../../../utils/navigation';

// Tạo biểu tượng Marker trường học hiện đại (Huy hiệu Mũ Cử nhân)
const createSchoolIcon = (isSelected: boolean) => {
  const gradient = isSelected
    ? 'linear-gradient(135deg, #0284c7, #2563eb, #7c3aed)'
    : 'linear-gradient(135deg, #1d4ed8, #2563eb, #3b82f6)';

  return L.divIcon({
    className: 'custom-school-marker-icon',
    html: `
      <div style="position: relative; width: 34px; height: 42px; transform: translate(-50%, -100%); cursor: pointer;">
        ${
          isSelected
            ? '<div style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(56, 189, 248, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
            : ''
        }
        <div style="
          position: relative;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: ${gradient};
          border: 2.5px solid #ffffff;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.35), 0 0 10px rgba(37, 99, 235, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 7px solid ${isSelected ? '#2563eb' : '#1d4ed8'};
          margin: -1px auto 0;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -42],
    tooltipAnchor: [0, -44],
  });
};

export interface MapLayerConfig {
  id: 'streets' | 'satellite';
  name: string;
  url: string;
  attribution: string;
  icon: string;
}

export const MAP_LAYERS: MapLayerConfig[] = [
  {
    id: 'streets',
    name: 'Bản đồ chuẩn',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    icon: '🗺️',
  },
  {
    id: 'satellite',
    name: 'Vệ tinh',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    icon: '🛰️',
  },
];

// Component điều khiển camera và fit bounds của bản đồ
function MapController({
  schools,
  selectedSchool,
}: {
  schools: any[];
  selectedSchool: any | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedSchool && selectedSchool.lat && selectedSchool.lng) {
      map.flyTo([selectedSchool.lat, selectedSchool.lng], 16, { duration: 1.2 });
    } else if (schools.length > 0) {
      const validPoints = schools.filter((s) => s.lat && s.lng);
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map((s) => [s.lat, s.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [schools, selectedSchool, map]);

  return null;
}

export function AdminMapPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Chế độ xem bản đồ: 'streets' (Bản đồ chuẩn) hoặc 'satellite' (Vệ tinh)
  const [layerId, setLayerId] = useState<'streets' | 'satellite'>(() => {
    const saved = localStorage.getItem('irs_map_layer');
    return saved === 'satellite' ? 'satellite' : 'streets';
  });

  // Vị trí trung tâm mặc định (Đồng Nai / TP. Biên Hòa)
  const defaultCenter: [number, number] = [10.9574, 106.8427];

  const currentLayer = MAP_LAYERS.find((l) => l.id === layerId) || MAP_LAYERS[0];

  const handleSelectLayer = (id: 'streets' | 'satellite') => {
    setLayerId(id);
    localStorage.setItem('irs_map_layer', id);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const schoolsData = await schoolApi.getAll();
        setSchools(schoolsData || []);
      } catch (err) {
        console.error('Error loading map data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredSchools = schools.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.code?.toLowerCase().includes(term) ||
      s.address?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bản Đồ Quản Trị Hệ Thống (IRS Map)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hiển thị trực quan toàn bộ các điểm trường mục tiêu, tọa độ GPS từ Google Maps và hành trình thực địa.
          </p>
        </div>

        {/* Lớp hiển thị trạng thái số lượng trường */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
            <Building2 className="w-3.5 h-3.5" />
            {filteredSchools.length} / {schools.length} trường
          </span>
        </div>
      </div>

      {/* Main Grid: School Selector List + Map Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Danh sách địa điểm bên trái (chiếm 4 cột trên lg, 3 cột trên xl) */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-800 text-sm">
                Danh sách trường THPT
              </span>
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              {filteredSchools.length} điểm
            </span>
          </div>

          {/* Ô tìm kiếm nhanh */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên trường, mã, địa chỉ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Danh sách cuộn các trường */}
          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Đang tải danh sách trường...</p>
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Không tìm thấy trường nào phù hợp
              </div>
            ) : (
              filteredSchools.map((school) => {
                const isSelected =
                  selectedSchool &&
                  ((selectedSchool.id && selectedSchool.id === school.id) ||
                    (selectedSchool._id && selectedSchool._id === school._id));

                return (
                  <div
                    key={school.id || school._id}
                    onClick={() => {
                      setSelectedSchool(isSelected ? null : school);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-700 tracking-wide">
                            {school.code || 'THPT'}
                          </span>
                          <h3 className="font-bold text-xs text-slate-900 truncate">
                            {school.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {school.address || 'Chưa có thông tin địa chỉ'}
                        </p>
                      </div>
                    </div>

                    {/* Metadata chân thẻ */}
                    <div className="mt-2 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {school.lat && school.lng
                          ? `${Number(school.lat).toFixed(3)}, ${Number(school.lng).toFixed(3)}`
                          : 'Chưa có GPS'}
                      </span>
                      {school.website && (
                        <a
                          href={
                            school.website.startsWith('http')
                              ? school.website
                              : `https://${school.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                        >
                          <span>Web</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Khung bản đồ bên phải mở rộng to hơn (8 cột trên lg, 9 cột trên xl) */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs">
          <div className="h-[700px] w-full rounded-xl overflow-hidden relative border border-slate-100">
            {loading && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg border border-slate-200/90 flex items-center gap-2 text-xs font-semibold text-slate-700 animate-slide-down pointer-events-none">
                <div className="w-3.5 h-3.5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <span>Đang tải các điểm trường lên bản đồ...</span>
              </div>
            )}

            {/* Nút bật/tắt (Toggle Switch): Bản đồ chuẩn vs Vệ tinh */}
            <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-slate-200/90 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSelectLayer('streets')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  layerId === 'streets'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span className="text-sm">🗺️</span>
                <span>Bản đồ chuẩn</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectLayer('satellite')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  layerId === 'satellite'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span className="text-sm">🛰️</span>
                <span>Vệ tinh</span>
              </button>
            </div>

            <MapContainer
              center={defaultCenter}
              zoom={12}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <TileLayer
                key={currentLayer.id}
                attribution={currentLayer.attribution}
                url={currentLayer.url}
              />

              {/* Tự động fit bounds và zoom vào trường được chọn */}
              <MapController
                schools={filteredSchools}
                selectedSchool={selectedSchool}
              />

              {filteredSchools.map((school) => {
                if (!school.lat || !school.lng) return null;

                const isCurrent = Boolean(
                  selectedSchool && (
                    (selectedSchool.id && selectedSchool.id === school.id) ||
                    (selectedSchool._id && selectedSchool._id === school._id)
                  )
                );

                return (
                  <Marker
                    key={school.id || school._id}
                    position={[Number(school.lat), Number(school.lng)]}
                    icon={createSchoolIcon(isCurrent)}
                    eventHandlers={{
                      mouseover: (e) => {
                        e.target.openTooltip();
                      },
                      click: () => {
                        setSelectedSchool(isCurrent ? null : school);
                      },
                    }}
                  >
                    {/* Tooltip hiển thị tức thì khi hover chuột qua điểm trường */}
                    <Tooltip
                      direction="top"
                      offset={[0, -44]}
                      opacity={1}
                      className="school-map-tooltip"
                      sticky={false}
                    >
                      <div className="p-3 max-w-[270px] space-y-1.5 text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wide">
                            {school.code || 'THPT'}
                          </span>
                          <span className="text-[10.5px] font-semibold text-slate-400 truncate">
                            {school.district || 'Đồng Nai'}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-xs leading-snug">
                          {school.name}
                        </h4>

                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {school.address || 'Chưa cập nhật địa chỉ'}
                        </p>

                        {(school.principal_name || school.school_board?.principal_name) && (
                          <div className="pt-1.5 border-t border-slate-100 text-[10.5px] text-slate-700 flex items-center justify-between">
                            <span className="text-slate-400">Hiệu trưởng:</span>
                            <strong className="text-slate-800">
                              {school.principal_name || school.school_board?.principal_name}
                            </strong>
                          </div>
                        )}

                        <div className="pt-1 text-[9.5px] text-blue-600 font-semibold text-right">
                          Bấm để xem thêm chi tiết →
                        </div>
                      </div>
                    </Tooltip>

                    <Popup>
                      <div className="p-2 max-w-[260px] text-xs space-y-2">
                        <div>
                          <div className="flex items-center gap-1 text-[10.5px] font-bold text-blue-700 uppercase">
                            <School className="w-3.5 h-3.5" />
                            <span>{school.code || 'TRƯỜNG'}</span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">
                            {school.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {school.address || 'Chưa cập nhật địa chỉ'}
                          </p>
                        </div>

                        {(school.principal_name || school.school_board?.principal_name) && (
                          <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-700">
                            Hiệu trưởng:{' '}
                            <strong>
                              {school.principal_name || school.school_board?.principal_name}
                            </strong>
                            {(school.principal_phone || school.school_board?.principal_phone) && (
                              <div className="text-blue-700 font-semibold mt-0.5">
                                SĐT: {school.principal_phone || school.school_board?.principal_phone}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <a
                            href={getGoogleMapsPlaceUrl(school)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <span>Xem Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {school.website && (
                            <a
                              href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                            >
                              <Globe className="w-3 h-3" />
                              <span>Web</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AdminMapPage;
