import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Building2,
  Users,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  Phone,
  GraduationCap,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { surveyApi } from '../../../services/api';
import { exportSurveysToExcel } from '../../../utils/surveyExcelExporter';

export function AdminSurveysPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    summary: {
      total_tickets: number;
      total_schools: number;
      top_majors: Array<{ major: string; count: number }>;
    };
    filters_meta: {
      campaigns: Array<{ id: string; name: string }>;
      schools: Array<{ id: string; name: string }>;
      majors: string[];
    };
    responses: any[];
  }>({
    summary: { total_tickets: 0, total_schools: 0, top_majors: [] },
    filters_meta: { campaigns: [], schools: [], majors: [] },
    responses: [],
  });

  // Thống kê tổng quan cố định toàn hệ thống (không bị đổi khi gõ tìm kiếm)
  const [globalSummary, setGlobalSummary] = useState<{
    total_tickets: number;
    total_schools: number;
    top_majors: Array<{ major: string; count: number }>;
  }>({ total_tickets: 0, total_schools: 0, top_majors: [] });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedMajor, setSelectedMajor] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected item for detail view modal
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const res = await surveyApi.getAllSurveyResponses({
        campaign_id: selectedCampaign !== 'all' ? selectedCampaign : undefined,
        school_id: selectedSchool !== 'all' ? selectedSchool : undefined,
        major: selectedMajor !== 'all' ? selectedMajor : undefined,
        search: searchTerm.trim() ? searchTerm.trim() : undefined,
      });

      if (res && res.success) {
        if (res.summary && (res.summary.total_tickets > 0 || globalSummary.total_tickets === 0)) {
          setGlobalSummary(res.summary);
        }
        setData({
          summary: res.summary || { total_tickets: 0, total_schools: 0, top_majors: [] },
          filters_meta: res.filters_meta || { campaigns: [], schools: [], majors: [] },
          responses: res.responses || [],
        });
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Failed to fetch surveys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSurveys();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCampaign, selectedSchool, selectedMajor]);

  // On-enter search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSurveys();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCampaign('all');
    setSelectedSchool('all');
    setSelectedMajor('all');
  };

  // Pagination calculation
  const totalPages = Math.ceil(data.responses.length / pageSize) || 1;
  const paginatedResponses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.responses.slice(start, start + pageSize);
  }, [data.responses, currentPage, pageSize]);

  const handleExport = () => {
    let campaignLabel = '';
    if (selectedCampaign !== 'all') {
      const c = data.filters_meta.campaigns.find((item) => item.id === selectedCampaign);
      if (c) campaignLabel = c.name;
    }
    exportSurveysToExcel(data.responses, campaignLabel || 'Toàn hệ thống');
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[5px] bg-[#0f3b7d] text-white flex items-center justify-center shadow-xs">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Phiếu Khảo Sát
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Tổng hợp thông tin học sinh đăng ký nguyện vọng tuyển sinh qua mã QR tại các điểm trường
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchSurveys}
            disabled={loading}
            className="p-2.5 rounded-[5px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0f3b7d]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={data.responses.length === 0}
            className="px-4 py-2.5 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel ({data.responses.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards (Luôn hiển thị tổng toàn hệ thống cố định) */}
      {(() => {
        const displaySummary = globalSummary.total_tickets > 0 ? globalSummary : data.summary;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Tổng số phiếu */}
            <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-[5px] bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tổng số phiếu thu được
                </span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {displaySummary.total_tickets.toLocaleString('vi-VN')}
                </div>
                <span className="text-[11px] text-slate-500">100% học sinh quét QR online</span>
              </div>
            </div>

            {/* Card 2: Số điểm trường */}
            <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-[5px] bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Điểm trường đã tiếp cận
                </span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {displaySummary.total_schools.toLocaleString('vi-VN')}
                </div>
                <span className="text-[11px] text-slate-500">Đã cập nhật tự động tổng số phiếu</span>
              </div>
            </div>

            {/* Card 3: Top ngành hot */}
            <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-[5px] bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ngành học quan tâm nhất
                </span>
                <div className="text-base font-bold text-slate-900 truncate mt-0.5" title={displaySummary.top_majors[0]?.major || 'Chưa có'}>
                  {displaySummary.top_majors[0]?.major || 'Chưa có dữ liệu'}
                </div>
                <span className="text-[11px] text-amber-700 font-semibold">
                  {displaySummary.top_majors[0] ? `${displaySummary.top_majors[0].count} học sinh quan tâm` : 'Chờ học sinh gửi phiếu'}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên học sinh, số điện thoại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0f3b7d] transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setTimeout(fetchSurveys, 10);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Select Campaign */}
          <div className="md:col-span-3">
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-[#0f3b7d] bg-white cursor-pointer"
            >
              <option value="all">Tất cả chiến dịch</option>
              {data.filters_meta.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select School */}
          <div className="md:col-span-3">
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-[#0f3b7d] bg-white cursor-pointer"
            >
              <option value="all">Tất cả điểm trường</option>
              {data.filters_meta.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Major */}
          <div className="md:col-span-2">
            <select
              value={selectedMajor}
              onChange={(e) => setSelectedMajor(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-[#0f3b7d] bg-white cursor-pointer"
            >
              <option value="all">Tất cả ngành</option>
              {data.filters_meta.majors.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filters tag & Reset */}
        {(selectedCampaign !== 'all' || selectedSchool !== 'all' || selectedMajor !== 'all' || searchTerm) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Đang lọc:</span>
              {selectedCampaign !== 'all' && (
                <span className="px-2 py-0.5 rounded-[5px] bg-blue-50 text-[#0f3b7d] font-semibold text-[11px]">
                  Chiến dịch: {data.filters_meta.campaigns.find((c) => c.id === selectedCampaign)?.name}
                </span>
              )}
              {selectedSchool !== 'all' && (
                <span className="px-2 py-0.5 rounded-[5px] bg-purple-50 text-purple-700 font-semibold text-[11px]">
                  Trường: {data.filters_meta.schools.find((s) => s.id === selectedSchool)?.name}
                </span>
              )}
              {selectedMajor !== 'all' && (
                <span className="px-2 py-0.5 rounded-[5px] bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                  Ngành: {selectedMajor}
                </span>
              )}
              {searchTerm && (
                <span className="px-2 py-0.5 rounded-[5px] bg-slate-100 text-slate-700 font-semibold text-[11px]">
                  Từ khóa: "{searchTerm}"
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[#0f3b7d] hover:underline font-bold cursor-pointer text-xs"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4 text-center w-12">STT</th>
                <th className="py-3.5 px-4 min-w-[160px]">Học sinh</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Số điện thoại</th>
                <th className="py-3.5 px-4 min-w-[180px]">Điểm trường</th>
                <th className="py-3.5 px-4 min-w-[150px]">Chiến dịch</th>
                <th className="py-3.5 px-4 min-w-[200px]">Ngành quan tâm</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Thời gian gửi</th>
                <th className="py-3.5 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs font-semibold">Đang tải danh sách phiếu khảo sát...</span>
                  </td>
                </tr>
              ) : paginatedResponses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                    <p className="text-sm font-semibold text-slate-600">Chưa có phiếu khảo sát nào phù hợp</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Thử điều chỉnh lại bộ lọc hoặc quét mã QR tại các điểm trường để thu thập phiếu mới.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedResponses.map((item, index) => {
                  const stt = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={item.id || index}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedTicket(item)}
                    >
                      <td className="py-3 px-4 text-center text-slate-400 font-medium">{stt}</td>

                      {/* Họ tên & Lớp */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-[#0f3b7d] transition-colors">
                          {item.student_name}
                        </div>
                        {item.grade ? (
                          <span className="inline-block px-1.5 py-0.2 rounded-[5px] bg-slate-100 text-slate-600 text-[10px] font-semibold mt-0.5">
                            Lớp {item.grade}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Chưa ghi lớp</span>
                        )}
                      </td>

                      {/* SĐT */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <a
                          href={`tel:${item.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono font-bold text-blue-700 hover:underline flex items-center gap-1.5"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{item.phone || '--'}</span>
                        </a>
                      </td>

                      {/* Trường */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1" title={item.school_name}>
                          {item.school_name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.trip_name || 'Đợt thực địa'}</span>
                        </div>
                      </td>

                      {/* Chiến dịch */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700 line-clamp-1" title={item.campaign_name}>
                          {item.campaign_name}
                        </div>
                      </td>

                      {/* Ngành quan tâm */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Array.isArray(item.interested_majors) && item.interested_majors.length > 0 ? (
                            item.interested_majors.map((m: string, mIdx: number) => (
                              <span
                                key={mIdx}
                                className="px-2 py-0.5 rounded-[5px] bg-blue-50 text-[#0f3b7d] font-semibold text-[10px]"
                              >
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Chưa chọn ngành</span>
                          )}
                        </div>
                      </td>

                      {/* Thời gian */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-700 font-medium">{item.created_at || '--'}</div>
                        <span className="inline-block px-1.5 py-0.2 rounded-[5px] bg-emerald-50 text-emerald-700 font-bold text-[9px] mt-0.5">
                          QR Online
                        </span>
                      </td>

                      {/* Chi tiết */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(item);
                          }}
                          className="p-1.5 rounded-[5px] hover:bg-slate-100 text-slate-400 hover:text-[#0f3b7d] transition cursor-pointer"
                          title="Xem chi tiết phiếu"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> -{' '}
              <span className="font-bold text-slate-800">
                {Math.min(currentPage * pageSize, data.responses.length)}
              </span>{' '}
              trong tổng số <span className="font-bold text-slate-800">{data.responses.length}</span> phiếu
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-[5px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-slate-700 px-2">
                Trang {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-[5px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[5px] shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0f3b7d] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-blue-200" />
                <div>
                  <h3 className="font-bold text-base">Thông Tin Phiếu Khảo Sát</h3>
                  <p className="text-xs text-blue-100">Chi tiết nguyện vọng của học sinh</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-[5px] hover:bg-white/10 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Họ và tên
                  </span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedTicket.student_name}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Số điện thoại
                  </span>
                  <div className="mt-0.5">
                    <a
                      href={`tel:${selectedTicket.phone}`}
                      className="text-base font-bold text-[#0f3b7d] hover:underline flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedTicket.phone}</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Khối lớp
                  </span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedTicket.grade ? `Lớp ${selectedTicket.grade}` : 'Chưa cập nhật'}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Thời gian gửi phiếu
                  </span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedTicket.created_at || '--'}
                  </div>
                </div>
              </div>

              <div className="space-y-1 pb-4 border-b border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Điểm trường & Điểm đến
                </span>
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{selectedTicket.school_name}</span>
                </div>
                <div className="text-xs text-slate-500 pl-6">
                  Chiến dịch: <strong>{selectedTicket.campaign_name}</strong>
                  {selectedTicket.trip_name && ` • Đợt: ${selectedTicket.trip_name}`}
                </div>
              </div>

              {/* Ngành quan tâm */}
              <div className="space-y-1.5 pb-4 border-b border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Nguyện vọng & Ngành học quan tâm
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Array.isArray(selectedTicket.interested_majors) && selectedTicket.interested_majors.length > 0 ? (
                    selectedTicket.interested_majors.map((m: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-[5px] bg-blue-50 text-[#0f3b7d] font-bold text-xs border border-blue-200/50"
                      >
                        ✓ {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Không chọn ngành cụ thể</span>
                  )}
                </div>
              </div>

              {/* Ghi chú */}
              {selectedTicket.notes && (
                <div className="space-y-1 bg-slate-50 p-3 rounded-[5px] border border-slate-200/60">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Câu hỏi / Ghi chú từ học sinh
                  </span>
                  <p className="text-slate-700 italic text-xs leading-relaxed">
                    "{selectedTicket.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                ID: {selectedTicket.id?.slice(0, 8)}...
              </span>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-[5px] bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSurveysPage;
