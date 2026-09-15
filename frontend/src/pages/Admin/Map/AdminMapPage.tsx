import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Building2,
  Search,
  ExternalLink,
  Navigation,
  Globe,
  School
} from 'lucide-react';
import { schoolApi, tripApi } from '../../../services/api';

// Sửa lỗi hiển thị icon mặc định của Leaflet
const schoolIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Vị trí trung tâm mặc định (Đồng Nai / TP. Biên Hòa)
  const defaultCenter: [number, number] = [10.9574, 106.8427];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [schoolsData, tripsData] = await Promise.allSettled([
          schoolApi.getAll(),
          tripApi.getTrips(),
        ]);

        if (schoolsData.status === 'fulfilled') {
          setSchools(schoolsData.value || []);
        }
        if (tripsData.status === 'fulfilled') {
          setActiveTrips(tripsData.value || []);
        }
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bản Đồ Quản Trị Hệ Thống (IRS Map)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hiển thị trực quan toàn bộ các điểm trường THPT mục tiêu, tọa độ GPS từ Google Maps và hành trình thực địa.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xs text-xs">
            <span className="text-slate-400">Tổng điểm trường: </span>
            <span className="font-bold text-[#0f3b7d]">{schools.length}</span>
          </div>
          <div className="px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xs text-xs">
            <span className="text-slate-400">Đoàn xe tuyển sinh: </span>
            <span className="font-bold text-emerald-600">{activeTrips.length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: School Selector List + Map Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Danh sách địa điểm bên trái (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0f3b7d]" />
              <h2 className="text-sm font-bold text-slate-900">Danh sách địa điểm</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0f3b7d]">
              {filteredSchools.length} trường
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm trường trên bản đồ..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#0f3b7d] outline-none"
            />
          </div>



          {/* Scrollable list of schools */}
          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
            {filteredSchools.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Không tìm thấy trường nào.
              </p>
            ) : (
              filteredSchools.map((s) => {
                const isSelected = selectedSchool?.id === s.id;
                return (
                  <div
                    key={s.id || s._id}
                    onClick={() => setSelectedSchool(s)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'border-[#0f3b7d] bg-blue-50/70 shadow-xs'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-slate-900 leading-snug">
                        {s.name}
                      </p>
                      {s.code && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {s.code}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      {s.address || 'Chưa có địa chỉ'}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10.5px]">
                      <span className="text-emerald-700 font-mono font-medium">
                        {s.lat && s.lng
                          ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}`
                          : 'Chưa có tọa độ'}
                      </span>
                      <span className="text-blue-600 hover:underline flex items-center gap-0.5 font-medium">
                        <span>Định vị</span>
                        <Navigation className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Khung bản đồ bên phải (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
          <div className="h-[580px] w-full rounded-xl overflow-hidden relative border border-slate-100">
            {loading && (
              <div className="absolute inset-0 z-20 bg-white/75 backdrop-blur-xs flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">
                    Đang tải các điểm trường lên bản đồ...
                  </p>
                </div>
              </div>
            )}

            <MapContainer
              center={defaultCenter}
              zoom={12}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Tự động fit bounds và zoom vào trường được chọn */}
              <MapController
                schools={filteredSchools}
                selectedSchool={selectedSchool}
              />

              {filteredSchools.map((school) => {
                if (!school.lat || !school.lng) return null;

                return (
                  <Marker
                    key={school.id || school._id}
                    position={[Number(school.lat), Number(school.lng)]}
                    icon={schoolIcon}
                    eventHandlers={{
                      click: () => setSelectedSchool(school),
                    }}
                  >
                    <Popup>
                      <div className="p-2 max-w-[260px] text-xs space-y-2">
                        <div>
                          <div className="flex items-center gap-1 text-[10.5px] font-bold text-blue-700 uppercase">
                            <School className="w-3.5 h-3.5" />
                            <span>{school.code || 'THPT'}</span>
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
                            href={`https://www.google.com/maps/search/?api=1&query=${school.lat},${school.lng}`}
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

            {/* Quick Floating Legend on Map */}
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200/80 shadow-md text-xs z-10 space-y-1.5 pointer-events-auto">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span>Trường THPT mục tiêu ({filteredSchools.length})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Đoàn xe tuyển sinh lưu động</span>
              </div>
            </div>
          </div>

          {/* Detailed Card for Selected School */}
          {selectedSchool && (
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up">
              <div>
                <span className="text-[10.5px] font-bold text-blue-700 uppercase tracking-wider">
                  Trường học đang được chọn trên bản đồ
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedSchool.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedSchool.address || 'Chưa cập nhật địa chỉ chi tiết'}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                  <span className="font-mono text-emerald-700 font-semibold">
                    GPS: {Number(selectedSchool.lat).toFixed(4)}, {Number(selectedSchool.lng).toFixed(4)}
                  </span>
                  {selectedSchool.principal_name && (
                    <span>Hiệu trưởng: <strong>{selectedSchool.principal_name}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedSchool.lat},${selectedSchool.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-[#0f3b7d] text-white text-xs font-semibold rounded-xl hover:bg-[#0c2f64] transition flex items-center gap-1.5 shadow-xs"
                >
                  <span>Mở Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setSelectedSchool(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
