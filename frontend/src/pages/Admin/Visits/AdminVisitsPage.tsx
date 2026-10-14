import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Trash2,
  Route,
  Clock,
  UserCheck,
  Users,
  CheckCircle2,
  X,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Navigation,
  Calendar,
  RefreshCw,
  Building2,
  StickyNote,
} from 'lucide-react';
import { visitApi, campaignApi, schoolApi, uploadApi } from '../../../services/api';

export const AdminVisitsPage: React.FC = () => {
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Detail Modal state
  const [selectedVisitDetail, setSelectedVisitDetail] = useState<any | null>(null);

  // Preview Image Modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Queries
  const { data: schools = [] } = useQuery({
    queryKey: ['schools-for-visits'],
    queryFn: () => schoolApi.getAll(),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns-for-visits'],
    queryFn: () => campaignApi.getAll(),
  });

  // Global stats query
  const { data: globalStatsData, refetch: refetchGlobalStats } = useQuery({
    queryKey: ['visits-global-stats'],
    queryFn: () => visitApi.getVisits({ limit: 1 }),
  });

  // Main visits list query
  const {
    data: visitsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'visits-list',
      selectedSchoolId,
      selectedCampaignId,
      selectedDate,
      searchTerm,
    ],
    queryFn: () =>
      visitApi.getVisits({
        school_id: selectedSchoolId || undefined,
        campaign_id: selectedCampaignId || undefined,
        date: selectedDate || undefined,
        search: searchTerm.trim() || undefined,
        limit: 200,
      }),
    placeholderData: (previousData) => previousData,
  });

  const visitsList = visitsData?.items || [];
  const stats = globalStatsData?.stats || visitsData?.stats || {
    total_visits: 0,
    total_schools: 0,
    total_trips: 0,
    total_images: 0,
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete Visit
  const handleDeleteVisit = async (visitId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch sử tham quan này?')) return;
    try {
      await visitApi.deleteVisit(visitId);
      showToast('Đã xóa lịch sử thành công!');
      refetch();
      refetchGlobalStats();
    } catch (err) {
      console.error('Error deleting visit:', err);
      alert('Không thể xóa bản ghi tự động check-in hoặc bản ghi không tồn tại');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in pb-16">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[9999] bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[5px] bg-[#0f3b7d] text-white flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Lịch Sử Tham Quan
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Theo dõi tất cả lượt check-in thực tế, nhật ký tiếp xúc và hình ảnh tư liệu tại các điểm trường
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              refetch();
              refetchGlobalStats();
            }}
            disabled={isLoading}
            className="p-2.5 rounded-[5px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0f3b7d]' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Tổng lượt ghé */}
        <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-[5px] bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tổng lượt ghé thăm
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {stats.total_visits.toLocaleString('vi-VN')}
            </div>
            <span className="text-[11px] text-slate-500">Check-in thực tế & tư liệu thực địa</span>
          </div>
        </div>

        {/* Card 2: Điểm trường đã tới */}
        <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-[5px] bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Điểm trường đã tới
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {stats.total_schools.toLocaleString('vi-VN')}
            </div>
            <span className="text-[11px] text-slate-500">Đã cập nhật tự động lượt đến</span>
          </div>
        </div>

        {/* Card 3: Chuyến đi đã triển khai */}
        <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-[5px] bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Route className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Chuyến đi đã triển khai
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {stats.total_trips.toLocaleString('vi-VN')}
            </div>
            <span className="text-[11px] text-slate-500">Đoàn tuyển sinh các khu vực</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tìm kiếm */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo trường, nội dung, cán bộ..."
              className="w-full pl-9 pr-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0f3b7d] transition bg-white"
            />
          </div>

          {/* Lọc theo Điểm trường */}
          <div>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:border-[#0f3b7d] transition cursor-pointer"
            >
              <option value="">Tất cả điểm trường ({schools.length})</option>
              {schools.map((s: any) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Chiến dịch */}
          <div>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:border-[#0f3b7d] transition cursor-pointer"
            >
              <option value="">Tất cả chiến dịch ({campaigns.length})</option>
              {campaigns.map((c: any) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Ngày tham quan */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-2.5 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:border-[#0f3b7d] transition cursor-pointer"
                title="Lọc theo ngày tham quan"
              />
            </div>

            {(selectedSchoolId || selectedCampaignId || selectedDate || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSchoolId('');
                  setSelectedCampaignId('');
                  setSelectedDate('');
                  setSearchTerm('');
                }}
                title="Xóa tất cả bộ lọc"
                className="px-2.5 py-2 bg-red-50 text-red-600 border border-red-200 rounded-[5px] text-xs font-bold hover:bg-red-100 transition whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE DATA LIST */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                <th className="py-3 px-3 text-center w-12">STT</th>
                <th className="py-3 px-3 w-36">Thời Gian Ghé</th>
                <th className="py-3 px-3 w-56">Điểm Trường</th>
                <th className="py-3 px-3 w-48">Chuyến Đi / Đợt</th>
                <th className="py-3 px-3 w-52">Đoàn Tuyển Sinh</th>
                <th className="py-3 px-3">Nội Dung Thực Địa</th>
                <th className="py-3 px-3 text-center w-24">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-slate-300 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                    Đang tải danh sách lịch sử tham quan...
                  </td>
                </tr>
              ) : visitsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Không tìm thấy lượt tham quan nào phù hợp</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Thử điều chỉnh lại bộ lọc tìm kiếm.
                    </p>
                  </td>
                </tr>
              ) : (
                visitsList.map((visit, idx) => (
                  <tr key={visit.id || idx} className="hover:bg-slate-50/80 transition group">
                    <td className="py-3 px-3 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      <div className="flex items-center gap-1 font-medium text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {new Date(visit.visit_date).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {visit.is_checkin ? (
                        <span className="mt-1 inline-block text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                          ✓ Check-in thực tế
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold border border-blue-200">
                          📝 Ghi nhận tư liệu
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block text-xs">
                        {visit.school_name}
                      </span>
                      {visit.school_address && (
                        <span className="text-[11px] text-slate-400 block truncate max-w-xs mt-0.5">
                          {visit.school_address}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-xs text-[#0f3b7d] block flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-[#0f3b7d] shrink-0" />
                        <span>{visit.trip_code || visit.trip_name || 'Chuyến đi'}</span>
                      </span>
                      {visit.campaign_name && (
                        <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                          {visit.campaign_name}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-600 text-xs">
                      {visit.leader_name && (
                        <div className="flex items-center gap-1 font-medium text-[11px] text-slate-800">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Trưởng đoàn: <strong>{visit.leader_name}</strong></span>
                        </div>
                      )}
                      {visit.members_names && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="truncate max-w-xs">{visit.members_names}</span>
                        </div>
                      )}
                      {!visit.leader_name && !visit.members_names && (
                        <span className="text-slate-400 italic text-[11px]">Đoàn công tác tuyển sinh</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <p className="text-slate-800 leading-relaxed font-normal whitespace-pre-wrap max-w-lg text-xs">
                        {visit.visit_content}
                      </p>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedVisitDetail(visit)}
                          className="px-2.5 py-1.5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-[11px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                          title="Xem chi tiết lượt tham quan & tư liệu thực địa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem</span>
                        </button>
                        {!visit.is_checkin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteVisit(visit.id)}
                            className="p-1.5 rounded-[5px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Xóa nhật ký tham quan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CHI TIẾT LƯỢT THAM QUAN & TƯ LIỆU */}
      {selectedVisitDetail && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedVisitDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0f3b7d] to-[#1e4e96] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[5px] bg-white/10 flex items-center justify-center">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight">
                    Chi Tiết Lượt Tham Quan & Tư Liệu
                  </h3>
                  <p className="text-xs text-white/80 font-medium">
                    {selectedVisitDetail.school_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVisitDetail(null)}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer transition hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Thẻ 1: Thông tin chuyến thăm */}
              <div className="bg-slate-50 rounded-[5px] border border-slate-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0f3b7d]" />
                    <span className="font-bold text-sm text-slate-900">
                      {selectedVisitDetail.school_name}
                    </span>
                  </div>
                  {selectedVisitDetail.is_checkin ? (
                    <span className="inline-block text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                      ✓ Check-in thực tế tự động
                    </span>
                  ) : (
                    <span className="inline-block text-[11px] text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
                      📝 Ghi nhận tư liệu & ảnh
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">ĐỊA CHỈ TRƯỜNG</span>
                    <span className="text-slate-700 font-medium">{selectedVisitDetail.school_address || 'Chưa có thông tin'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">THỜI GIAN GHÉ THĂM</span>
                    <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(selectedVisitDetail.visit_date).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">CHIẾN DỊCH</span>
                    <span className="text-slate-700 font-medium">{selectedVisitDetail.campaign_name || 'Chiến dịch tuyển sinh'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">CHUYẾN ĐI / ĐỢT</span>
                    <span className="text-[#0f3b7d] font-bold">{selectedVisitDetail.trip_name || selectedVisitDetail.trip_code || 'Chuyến đi'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 font-semibold block text-[11px]">ĐOÀN CÔNG TÁC</span>
                    <div className="text-slate-700 mt-0.5">
                      <strong>Trưởng đoàn:</strong> {selectedVisitDetail.leader_name || 'Chưa phân công'}
                      {selectedVisitDetail.members_names && (
                        <span> | <strong>Thành viên:</strong> {selectedVisitDetail.members_names}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200">
                  <span className="text-slate-400 font-semibold block text-[11px]">NỘI DUNG GHI NHẬN</span>
                  <p className="mt-1 text-slate-800 leading-relaxed font-normal bg-white p-2.5 rounded-[5px] border border-slate-200">
                    {selectedVisitDetail.visit_content}
                  </p>
                </div>
              </div>

              {/* Thẻ 2: Hình ảnh tư liệu */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-500" />
                    <span>Hình ảnh tư liệu thực địa</span>
                    <span className="text-slate-400 font-normal">({selectedVisitDetail.images?.length || 0} ảnh)</span>
                  </h4>
                </div>

                {selectedVisitDetail.images && selectedVisitDetail.images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedVisitDetail.images.map((img: any, iIdx: number) => {
                      const imgUrl = img.cloudinary_url || uploadApi.getImageUrl(img.id);
                      return (
                        <div
                          key={img.id || iIdx}
                          onClick={() => setPreviewImage({ url: imgUrl, title: selectedVisitDetail.school_name })}
                          className="group relative rounded-[5px] overflow-hidden border border-slate-200 bg-slate-100 aspect-video cursor-pointer hover:shadow-md transition"
                        >
                          <img
                            src={imgUrl}
                            alt={`Tư liệu ${iIdx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-[5px] border border-slate-200 text-center text-slate-400 text-xs">
                    Chưa có hình ảnh tư liệu nào được tải lên cho trường này trong chuyến thăm.
                  </div>
                )}
              </div>

              {/* Thẻ 3: Ghi chú & Đánh giá thực địa tại trường trong chiến dịch */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <StickyNote className="w-4 h-4 text-[#0f3b7d]" />
                    <span>Ghi chú & Đánh giá thực địa tại trường</span>
                    <span className="text-slate-400 font-normal">({selectedVisitDetail.school_notes?.length || 0} ghi chú)</span>
                  </h4>
                </div>

                {selectedVisitDetail.school_notes && selectedVisitDetail.school_notes.length > 0 ? (
                  <div className="space-y-2">
                    {selectedVisitDetail.school_notes.map((note: any, nIdx: number) => (
                      <div
                        key={note.id || nIdx}
                        className="p-3 bg-white rounded-[5px] border border-slate-200/80 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                          <span className="font-bold text-slate-800">
                            {note.category || '📝 Ghi chú'}
                          </span>
                          <span className="text-slate-400">
                            {note.created_at ? new Date(note.created_at).toLocaleDateString('vi-VN') : ''}
                            {note.author_name ? ` • Bởi ${note.author_name}` : ''}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-normal text-xs whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-[5px] border border-slate-200 text-center text-slate-400 text-xs">
                    Chưa có ghi chú hoặc đánh giá thực địa bổ sung nào cho trường này trong chiến dịch.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedVisitDetail(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-[5px] text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX XEM ẢNH */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold">{previewImage.title} - Ảnh tư liệu</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="text-white/70 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewImage.url}
                alt="Preview"
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Ảnh chụp thực tế lưu trữ đám mây</span>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f3b7d] text-white rounded-md font-bold hover:bg-[#0c2f64] transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở ảnh gốc</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVisitsPage;
