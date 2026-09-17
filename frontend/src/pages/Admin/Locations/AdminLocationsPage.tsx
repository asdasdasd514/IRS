import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  User,
  ExternalLink,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Globe,
  Trash2,
  Pencil,
  LayoutGrid,
  List,
  Eye
} from 'lucide-react';
import { schoolApi, mapsApi } from '../../../services/api';

export function AdminLocationsPage() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    lat: '',
    lng: '',
    principal_name: '',
    principal_phone: '',
    website: '',
    notes: '',
  });

  // Google Maps link input & parse state
  const [mapsLink, setMapsLink] = useState('');
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

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

  // Trích xuất tọa độ từ Google Maps (Ưu tiên tọa độ ghim địa điểm chính xác)
  const handleExtractFromGoogleMaps = async () => {
    if (!mapsLink.trim()) {
      setParseError('Vui lòng nhập hoặc dán link Google Maps.');
      return;
    }

    setParseError(null);
    setParseSuccess(null);
    setIsParsingLink(true);

    const input = mapsLink.trim();

    try {
      // 1. Kiểm tra nhanh chuỗi tọa độ trực tiếp dạng: 10.9574, 106.8427 hoặc 10.9574 106.8427
      const coordMatch = input.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
      if (coordMatch) {
        const latVal = parseFloat(coordMatch[1]);
        const lngVal = parseFloat(coordMatch[2]);
        setFormData((prev) => ({
          ...prev,
          lat: latVal.toFixed(6),
          lng: lngVal.toFixed(6),
        }));
        setParseSuccess(`✓ Đã nhận diện tọa độ: ${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`);
        setIsParsingLink(false);
        return;
      }

      // 2. ƯU TIÊN SỐ 1: Tọa độ chính xác của địa điểm/ghim cắm mốc (!3d<lat>!4d<lng>)
      // Đây là vị trí CHÍNH XÁC của trường học, không phải tâm màn hình
      const lat3d = input.match(/!3d(-?\d+\.?\d*)/);
      const lng4d = input.match(/!4d(-?\d+\.?\d*)/);
      if (lat3d && lng4d) {
        const latVal = parseFloat(lat3d[1]);
        const lngVal = parseFloat(lng4d[1]);
        setFormData((prev) => ({
          ...prev,
          lat: latVal.toFixed(6),
          lng: lngVal.toFixed(6),
        }));
        setParseSuccess(`✓ Đã trích xuất chính xác vị trí trường: ${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`);
        setIsParsingLink(false);
        return;
      }

      // 3. Kiểm tra tham số query (?q=lat,lng hoặc ?query=lat,lng hoặc ?ll=lat,lng)
      const qCoordMatch = input.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
      if (qCoordMatch) {
        const latVal = parseFloat(qCoordMatch[1]);
        const lngVal = parseFloat(qCoordMatch[2]);
        setFormData((prev) => ({
          ...prev,
          lat: latVal.toFixed(6),
          lng: lngVal.toFixed(6),
        }));
        setParseSuccess(`✓ Đã trích xuất tọa độ từ query: ${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`);
        setIsParsingLink(false);
        return;
      }

      // 4. Nếu là link rút gọn (maps.app.goo.gl...) hoặc link đặc biệt, gọi Backend parser
      if (input.includes('goo.gl') || input.includes('maps.app') || !input.includes('/@')) {
        const res = await mapsApi.parseLink(input);
        if (res && res.latitude && res.longitude) {
          setFormData((prev) => ({
            ...prev,
            lat: res.latitude.toFixed(6),
            lng: res.longitude.toFixed(6),
          }));
          setParseSuccess(`✓ Đã lấy thành công từ Google Maps: ${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}`);
          setIsParsingLink(false);
          return;
        }
      }

      // 5. Dự phòng cuối: Chỉ khi KHÔNG CÓ ghim địa điểm thì mới lấy tâm màn hình /@lat,lng
      const urlAtMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (urlAtMatch) {
        const latVal = parseFloat(urlAtMatch[1]);
        const lngVal = parseFloat(urlAtMatch[2]);
        setFormData((prev) => ({
          ...prev,
          lat: latVal.toFixed(6),
          lng: lngVal.toFixed(6),
        }));
        setParseSuccess(`✓ Đã nhận diện tọa độ: ${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`);
        setIsParsingLink(false);
        return;
      }

      // 6. Thử gọi backend lần cuối
      const res = await mapsApi.parseLink(input);
      if (res && res.latitude && res.longitude) {
        setFormData((prev) => ({
          ...prev,
          lat: res.latitude.toFixed(6),
          lng: res.longitude.toFixed(6),
        }));
        setParseSuccess(`✓ Đã lấy thành công từ Google Maps: ${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}`);
      } else {
        setParseError('Không thể tìm thấy tọa độ trong link này. Bạn có thể mở Google Maps, click chuột phải vào trường chọn "Sao chép tọa độ" rồi dán vào đây.');
      }
    } catch (err: any) {
      console.error('Error parsing maps link:', err);
      const msg =
        err.response?.data?.detail ||
        'Không thể phân tích link Google Maps. Bạn có thể mở Google Maps, click chuột phải vào trường chọn "Sao chép tọa độ" rồi dán vào đây.';
      setParseError(msg);
    } finally {
      setIsParsingLink(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSchool(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      lat: '',
      lng: '',
      principal_name: '',
      principal_phone: '',
      website: '',
      notes: '',
    });
    setMapsLink('');
    setParseError(null);
    setParseSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (school: any) => {
    setEditingSchool(school);
    setFormData({
      name: school.name || '',
      code: school.code || '',
      address: school.address || '',
      lat: school.lat ? String(school.lat) : '',
      lng: school.lng ? String(school.lng) : '',
      principal_name: school.principal_name || school.school_board?.principal_name || '',
      principal_phone: school.principal_phone || school.school_board?.principal_phone || '',
      website: school.website || '',
      notes: school.notes || '',
    });
    setMapsLink('');
    setParseError(null);
    setParseSuccess(null);
    setIsModalOpen(true);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên trường học.');
      return;
    }

    if (!formData.lat || !formData.lng) {
      alert('Vui lòng cung cấp tọa độ (Kinh độ & Vĩ độ) từ Google Maps để định vị trên bản đồ.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      address: formData.address.trim() || undefined,
      lat: parseFloat(formData.lat),
      lng: parseFloat(formData.lng),
      principal_name: formData.principal_name.trim() || undefined,
      principal_phone: formData.principal_phone.trim() || undefined,
      website: formData.website.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    };

    try {
      if (editingSchool) {
        await schoolApi.update(editingSchool.id || editingSchool._id, payload);
        setActionSuccessMsg(`Đã cập nhật trường "${formData.name.trim()}" thành công!`);
      } else {
        await schoolApi.create(payload);
        setActionSuccessMsg('Đã thêm trường học mới thành công và đồng bộ lên bản đồ!');
      }

      setIsModalOpen(false);
      setEditingSchool(null);
      setFormData({
        name: '',
        code: '',
        address: '',
        lat: '',
        lng: '',
        principal_name: '',
        principal_phone: '',
        website: '',
        notes: '',
      });
      setMapsLink('');
      setParseError(null);
      setParseSuccess(null);

      setTimeout(() => setActionSuccessMsg(null), 4000);
      loadSchools();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Không thể lưu trường học');
    }
  };

  const handleDeleteSchool = async (school: any) => {
    if (!window.confirm(`Bạn có chắc muốn xóa trường "${school.name}" khỏi danh mục?`)) {
      return;
    }
    try {
      await schoolApi.delete(school.id || school._id);
      setActionSuccessMsg(`Đã xóa trường "${school.name}" thành công.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      loadSchools();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi xóa trường');
    }
  };

  const filteredSchools = schools.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.code?.toLowerCase().includes(term) ||
      s.address?.toLowerCase().includes(term) ||
      s.principal_name?.toLowerCase().includes(term)
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
            Hồ sơ danh bạ trường mục tiêu, ban giám hiệu và tọa độ GPS lấy từ Google Maps.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm trường học</span>
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{actionSuccessMsg}</span>
        </div>
      )}



      {/* Search & Filter Bar with View Mode Toggle */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên trường, mã, địa chỉ, hiệu trưởng..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition"
          />
        </div>

        {/* Nút chuyển đổi giao diện: Lưới hoặc Danh sách (chỉ hiển thị icon không cần chữ) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Hiển thị dạng lưới"
            className={`p-2 rounded-lg transition ${
              viewMode === 'grid'
                ? 'bg-white text-[#0f3b7d] shadow-xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            title="Hiển thị dạng danh sách"
            className={`p-2 rounded-lg transition ${
              viewMode === 'list'
                ? 'bg-white text-[#0f3b7d] shadow-xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Schools Cards Grid or List */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Đang tải danh bạ trường học...</p>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Chưa có trường học nào phù hợp</p>
          <p className="text-xs text-slate-400 mt-1">
            Nhấn nút "Thêm trường học" để bổ sung trường mới cùng tọa độ Google Maps.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchools.map((s) => (
            <div
              key={s.id || s._id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    onClick={() => navigate(`/admin/locations/${s.id || s._id}`)}
                    className="flex items-start gap-3 cursor-pointer group/title flex-1 min-w-0"
                    title="Bấm để xem & tùy biến trang thông tin chi tiết của trường"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0f3b7d] group-hover/title:bg-[#0f3b7d] group-hover/title:text-white transition flex items-center justify-center shrink-0 font-bold text-sm">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 group-hover/title:text-[#0f3b7d] leading-snug transition flex items-center gap-1.5">
                        <span className="truncate">{s.name}</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {s.code && (
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600 font-semibold">
                            {s.code}
                          </span>
                        )}
                        <span className="text-[10.5px] text-blue-600 font-medium opacity-0 group-hover/title:opacity-100 transition flex items-center gap-0.5">
                          Xem trang trường →
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/locations/${s.id || s._id}`);
                      }}
                      title="Xem & Tùy biến trang trường học (WordPress Builder)"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(s);
                      }}
                      title="Chỉnh sửa thông tin & tọa độ trường"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSchool(s);
                      }}
                      title="Xóa trường này"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{s.address || 'Chưa cập nhật địa chỉ'}</span>
                  </div>

                  {(s.principal_name || s.school_board?.principal_name) && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Hiệu trưởng:{' '}
                        <strong>{s.principal_name || s.school_board?.principal_name}</strong>
                      </span>
                    </div>
                  )}

                  {(s.principal_phone || s.school_board?.principal_phone) && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[#0f3b7d] font-semibold">
                        {s.principal_phone || s.school_board?.principal_phone}
                      </span>
                    </div>
                  )}

                  {/* Tọa độ Google Maps */}
                  {s.lat && s.lng ? (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                        GPS: {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                      </span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium hover:underline"
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-600 italic">
                      Chưa có tọa độ GPS
                    </div>
                  )}
                </div>
              </div>

              {s.website && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <a
                    href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 font-medium truncate"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span className="truncate">Website trường</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* View Mode List: Bảng danh sách trường tinh gọn, đầy đủ thông tin */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Tên trường & Mã</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Địa chỉ chi tiết</th>
                  <th className="py-3.5 px-4 min-w-[180px]">Ban Giám Hiệu</th>
                  <th className="py-3.5 px-4 min-w-[170px]">Tọa độ GPS & Map</th>
                  <th className="py-3.5 px-4">Website</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchools.map((s) => (
                  <tr
                    key={s.id || s._id}
                    className="hover:bg-blue-50/40 transition group"
                  >
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => navigate(`/admin/locations/${s.id || s._id}`)}
                        className="flex items-center gap-3 cursor-pointer group/school-item"
                        title="Bấm để xem & tùy biến trang thông tin chi tiết của trường"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0f3b7d] group-hover/school-item:bg-[#0f3b7d] group-hover/school-item:text-white transition flex items-center justify-center shrink-0 font-bold">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 group-hover/school-item:text-[#0f3b7d] text-sm leading-snug transition">
                            {s.name}
                          </p>
                          {s.code && (
                            <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600 font-semibold">
                              {s.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-1.5 text-slate-600 max-w-sm">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{s.address || 'Chưa cập nhật'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        {(s.principal_name || s.school_board?.principal_name) ? (
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{s.principal_name || s.school_board?.principal_name}</span>
                          </p>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa cập nhật</span>
                        )}
                        {(s.principal_phone || s.school_board?.principal_phone) && (
                          <p className="text-[#0f3b7d] font-semibold flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{s.principal_phone || s.school_board?.principal_phone}</span>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {s.lat && s.lng ? (
                        <div className="space-y-1">
                          <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold inline-block">
                            GPS: {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                          </span>
                          <div>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <span>Google Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-600 italic text-[11px]">Chưa có tọa độ</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {s.website ? (
                        <a
                          href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium truncate max-w-[140px]"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">Website</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/locations/${s.id || s._id}`)}
                          title="Xem & Tùy biến trang trường học (WordPress Builder)"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          title="Chỉnh sửa thông tin & tọa độ trường"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSchool(s)}
                          title="Xóa trường này"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal Thêm Trường Học Mới Với Google Maps Integration */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingSchool ? 'Chỉnh Sửa Trường Học & Tọa Độ' : 'Thêm Trường Học & Địa Điểm Mới'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingSchool
                    ? 'Cập nhật thông tin hồ sơ và định vị GPS trường học.'
                    : 'Nhập thông tin hồ sơ trường và lấy tọa độ GPS tự động từ Google Maps.'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchool} className="space-y-4">
              {/* KHỐI 1: TỌA ĐỘ MAP */}
              <div className="p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f3b7d] uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <span>Tọa độ Map</span>
                  </label>
                  <a
                    href="https://www.google.com/maps"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Mở Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  Dán link Google Maps (Link chia sẻ <code className="text-blue-700 bg-white px-1 py-0.5 rounded border border-blue-100 font-mono">maps.app.goo.gl</code>, link trình duyệt, hoặc chuỗi tọa độ <code className="text-blue-700 bg-white px-1 py-0.5 rounded border border-blue-100 font-mono">10.9574, 106.8427</code>):
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mapsLink}
                    onChange={(e) => setMapsLink(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleExtractFromGoogleMaps}
                    disabled={isParsingLink || !mapsLink.trim()}
                    className="px-4 py-2 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-semibold rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-xs"
                  >
                    {isParsingLink ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Đang quét...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Trích xuất tọa độ</span>
                      </>
                    )}
                  </button>
                </div>

                {parseError && (
                  <div className="p-2.5 bg-red-50 border border-red-200/80 rounded-xl text-red-700 text-xs flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{parseError}</span>
                  </div>
                )}

                {parseSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{parseSuccess}</span>
                  </div>
                )}

                {/* 2 trường hiển thị tọa độ đã trích xuất */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Vĩ độ (Latitude) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.lat}
                      onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:border-[#0f3b7d] outline-none font-mono font-bold text-slate-800"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Kinh độ (Longitude) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.lng}
                      onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:border-[#0f3b7d] outline-none font-mono font-bold text-slate-800"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* KHỐI 2: THÔNG TIN TRƯỜNG HỌC */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Thông tin hồ sơ trường
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên trường *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#0f3b7d] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mã trường (Code)
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Địa chỉ chi tiết
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hiệu trưởng / Ban giám hiệu
                    </label>
                    <input
                      type="text"
                      value={formData.principal_name}
                      onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số điện thoại liên hệ
                    </label>
                    <input
                      type="text"
                      value={formData.principal_phone}
                      onChange={(e) => setFormData({ ...formData, principal_phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Website trường
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0f3b7d] text-white font-semibold text-xs hover:bg-[#0c2f64] flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{editingSchool ? 'Lưu thay đổi' : 'Lưu trường học'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
