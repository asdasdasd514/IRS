import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

export function AdminMapPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);

  // Vị trí trung tâm mặc định (Đồng Nai / Đông Nam Bộ)
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bản Đồ Quản Trị Hệ Thống
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Giám sát trực quan các điểm trường THPT mục tiêu, lộ trình và đoàn xe tuyển sinh thực địa.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xs text-xs">
            <span className="text-slate-400">Tổng điểm trường: </span>
            <span className="font-bold text-[#0f3b7d]">{schools.length}</span>
          </div>
          <div className="px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xs text-xs">
            <span className="text-slate-400">Chuyến đi: </span>
            <span className="font-bold text-emerald-600">{activeTrips.length}</span>
          </div>
        </div>
      </div>

      {/* Map Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="h-[520px] w-full rounded-xl overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-xs flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
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

            {schools.map((school) => {
              if (!school.lat || !school.lng) return null;
              return (
                <Marker
                  key={school.id || school._id}
                  position={[school.lat, school.lng]}
                  icon={schoolIcon}
                  eventHandlers={{
                    click: () => setSelectedSchool(school),
                  }}
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-bold text-slate-900 text-sm">{school.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{school.address}</p>
                      {school.principal_name && (
                        <p className="text-xs text-blue-700 mt-1">
                          Hiệu trưởng: {school.principal_name}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Quick Floating Legend on Map */}
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200/80 shadow-md text-xs z-10 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span>Điểm trường mục tiêu (School)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Đoàn xe đang lưu động</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected School Info Card if any */}
      {selectedSchool && (
        <div className="bg-white rounded-2xl border border-blue-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slide-up">
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Chi tiết điểm trường đang chọn
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              {selectedSchool.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedSchool.address || 'Chưa cập nhật địa chỉ'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSchool(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
