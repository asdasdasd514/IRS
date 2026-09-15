import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  User,
  ExternalLink
} from 'lucide-react';
import { schoolApi } from '../../../services/api';

export function AdminLocationsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    district: '',
    lat: '',
    lng: '',
    principal_name: '',
    principal_phone: '',
    website: '',
  });

  const loadSchools = async () => {
    try {
      setLoading(true);
      const data = await schoolApi.getAll();
      setSchools(data);
    } catch (err) {
      console.error('Error fetching schools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await schoolApi.create({
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        district: formData.district.trim() || undefined,
        lat: formData.lat ? parseFloat(formData.lat) : undefined,
        lng: formData.lng ? parseFloat(formData.lng) : undefined,
        principal_name: formData.principal_name.trim() || undefined,
        principal_phone: formData.principal_phone.trim() || undefined,
        website: formData.website.trim() || undefined,
      });

      setIsModalOpen(false);
      setFormData({
        name: '',
        address: '',
        district: '',
        lat: '',
        lng: '',
        principal_name: '',
        principal_phone: '',
        website: '',
      });
      loadSchools();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Không thể tạo trường học');
    }
  };

  const filteredSchools = schools.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.address?.toLowerCase().includes(term) ||
      s.district?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản Lý Địa Điểm & Trường Học
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Danh bạ các trường THPT mục tiêu, tọa độ GPS và thông tin ban giám hiệu liên hệ.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm trường học</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm trường theo tên, địa chỉ, quận/huyện..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
          />
        </div>
      </div>

      {/* Schools List */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Đang tải danh bạ trường học...</p>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Không tìm thấy trường học</p>
          <p className="text-xs text-slate-400 mt-1">
            Hãy điều chỉnh từ khóa tìm kiếm hoặc nhấn "Thêm trường học".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchools.map((s) => (
            <div
              key={s.id || s._id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {s.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.district || 'Đồng Nai'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{s.address || 'Chưa có địa chỉ'}</span>
                  </div>

                  {s.principal_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Hiệu trưởng: {s.principal_name}</span>
                    </div>
                  )}

                  {s.principal_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[#0f3b7d] font-semibold">{s.principal_phone}</span>
                    </div>
                  )}

                  {s.lat && s.lng && (
                    <div className="text-[11px] text-slate-400 font-mono">
                      GPS: {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                    </div>
                  )}
                </div>
              </div>

              {s.website && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <a
                    href={s.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Website trường</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm Trường Học */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-slide-up">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Thêm Trường Học Mới
            </h3>

            <form onSubmit={handleCreateSchool} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Tên trường THPT *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: THPT Chuyên Lương Thế Vinh"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Quận / Huyện
                  </label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    placeholder="Biên Hòa"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={formData.principal_phone}
                    onChange={(e) => setFormData({ ...formData, principal_phone: e.target.value })}
                    placeholder="0251 382..."
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Địa chỉ chi tiết
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Đường Lê Quý Đôn, P. Tân Hiệp..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Vĩ độ (Lat)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    placeholder="10.9574"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Kinh độ (Lng)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                    placeholder="106.8427"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0f3b7d] text-white font-semibold text-xs hover:bg-[#0c2f64]"
                >
                  Lưu trường học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
