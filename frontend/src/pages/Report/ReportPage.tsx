import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  School,
  Download,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { reportApi, campaignApi } from '../../services/api';
import { exportReportToExcel, exportCampaignSummaryToExcel } from '../../utils/reportExcelExporter';

export const ReportPage: React.FC = () => {
  const { reportId, campaignId } = useParams<{ reportId?: string; campaignId?: string }>();
  const navigate = useNavigate();

  // Mode: 'summary' hoặc 'round'
  const [viewMode, setViewMode] = useState<'summary' | 'round'>(campaignId ? 'summary' : 'round');
  const [currentReportId, setCurrentReportId] = useState<string | null>(reportId || null);
  const [downloading, setDownloading] = useState(false);

  // 1. Fetch báo cáo đợt hiện tại nếu có
  const { data: currentReport, isLoading: isLoadingReport } = useQuery({
    queryKey: ['report', currentReportId],
    queryFn: () => reportApi.getReport(currentReportId!),
    enabled: !!currentReportId,
  });

  // Xác định campaignId mục tiêu
  const targetCampaignId = campaignId || currentReport?.campaign_id;

  // 2. Fetch dữ liệu tổng hợp toàn chiến dịch (Real-time auto-aggregated)
  const { data: campaignSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['campaign-summary-report', targetCampaignId],
    queryFn: () => campaignApi.getSummaryReport(targetCampaignId!),
    enabled: !!targetCampaignId,
  });

  // Đồng bộ viewMode khi URL thay đổi
  useEffect(() => {
    if (campaignId) {
      setViewMode('summary');
    } else if (reportId) {
      setViewMode('round');
      setCurrentReportId(reportId);
    }
  }, [campaignId, reportId]);

  // Nếu mở bằng reportId và đã load được báo cáo, đồng bộ state
  useEffect(() => {
    if (currentReport && !campaignId && viewMode === 'round') {
      setCurrentReportId(currentReport.id);
    }
  }, [currentReport, campaignId, viewMode]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  };

  // Định dạng ngày giờ chuẩn xác: DD/MM/YYYY HH:mm (như hình mẫu)
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '';
    if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(dateString.trim())) return dateString.trim();
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    return `${day}/${month}/${year} ${hours}:${mins}`;
  };

  // Định dạng điểm xuất phát (100% dữ liệu động từ API/Database)
  const formatStartPoint = (point?: any) => {
    if (!point) return 'Chưa cập nhật';
    if (typeof point === 'string') return point;
    const name = point.name?.trim();
    const address = point.address?.trim();
    if (name && address) {
      if (address.toLowerCase().includes(name.toLowerCase())) return address;
      return `${name} (${address})`;
    }
    return name || address || 'Chưa cập nhật';
  };

  // Định dạng danh sách cán bộ tuyển sinh (100% dữ liệu động từ API/Database)
  const formatStaffList = (staff?: any, fallbackLeader?: string) => {
    if (Array.isArray(staff) && staff.length > 0) {
      const names = staff
        .map((s: any) => (typeof s === 'string' ? s : s?.name))
        .filter(Boolean);
      if (names.length > 0) {
        return Array.from(new Set(names)).join(', ');
      }
    }
    return fallbackLeader || 'Chưa phân công';
  };

  const formatCampaignDateRange = (start?: string, end?: string, rounds?: any[]) => {
    const formatSingle = (val?: string) => {
      if (!val) return '';
      if (val.includes('/')) return val;
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    };
    let s = formatSingle(start);
    let e = formatSingle(end);

    if ((!s || !e) && rounds && rounds.length > 0) {
      const dates = rounds
        .map((r: any) => formatSingle(r.date))
        .filter(Boolean);
      if (dates.length > 0) {
        if (!s) s = dates[0];
        if (!e) e = dates[dates.length - 1];
      }
    }

    if (s && e) return s === e ? s : `${s} - ${e}`;
    return s || e || 'Chưa thiết lập';
  };

  // Xuất file Excel thích ứng với chế độ đang xem
  const handleExportExcel = () => {
    try {
      setDownloading(true);
      if (viewMode === 'summary') {
        if (campaignSummary) {
          exportCampaignSummaryToExcel(campaignSummary);
        }
      } else {
        if (currentReport) {
          exportReportToExcel(currentReport);
        }
      }
      setTimeout(() => setDownloading(false), 800);
    } catch (err) {
      console.error('Failed to export excel:', err);
      setDownloading(false);
    }
  };

  const isLoading = (viewMode === 'summary' && isLoadingSummary) || (viewMode === 'round' && isLoadingReport);

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-[#0f3b7d]/30 border-t-[#0f3b7d] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Đang tải báo cáo tuyển sinh...</p>
        </div>
      </div>
    );
  }

  // Danh sách các đợt có trong chiến dịch để render trong Dropdown Menu
  const roundsList = campaignSummary?.rounds_data || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in pb-16">
      {/* ================= 1. THANH ĐIỀU HƯỚNG & DROPDOWN MENU CHỌN BÁO CÁO ================= */}
      <div className="bg-white p-3.5 sm:p-4 rounded-[5px] border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/reports')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-[5px] bg-slate-100 hover:bg-slate-200 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Danh sách</span>
          </button>

          {/* DROPDOWN MENU: CHUYỂN ĐỔI CHẾ ĐỘ XEM BÁO CÁO */}
          {targetCampaignId ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1.5 shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#0f3b7d]" />
                <span>Báo cáo:</span>
              </span>
              <div className="relative min-w-[260px] sm:min-w-[340px]">
                <select
                  value={viewMode === 'summary' ? 'summary' : (currentReportId || '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'summary') {
                      setViewMode('summary');
                    } else {
                      setCurrentReportId(val);
                      setViewMode('round');
                    }
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-[5px] text-xs font-bold text-slate-800 shadow-2xs outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition appearance-none cursor-pointer"
                >
                  <option value="summary">
                    📊 Báo Cáo Tổng Hợp Toàn Chiến Dịch ({roundsList.length} đợt)
                  </option>
                  {roundsList.length > 0 && (
                    <optgroup label="─── Từng Đợt Riêng Lẻ ───">
                      {roundsList.map((rnd: any) => (
                        <option
                          key={rnd.trip_id}
                          value={rnd.report_id || rnd.trip_id}
                          disabled={!rnd.report_id}
                        >
                          🚗 {rnd.round_name} ({rnd.trip_code}) • {rnd.tickets_collected} phiếu {rnd.report_id ? '' : '(Chưa lập)'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {currentReport?.trip_name || 'Báo Cáo Tuyển Sinh Thực Địa'}
              </h2>
            </div>
          )}
        </div>

        {/* NÚT EXPORT */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            onClick={handleExportExcel}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-[5px] text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-60"
            title="Xuất file Excel (.xlsx)"
          >
            {downloading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{downloading ? 'Đang xuất...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* ================= 2. GIAO DIỆN CHẾ ĐỘ 1: BÁO CÁO TỔNG HỢP TOÀN CHIẾN DỊCH ================= */}
      {viewMode === 'summary' && campaignSummary && (
        <div className="bg-white rounded-[5px] border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6 print:shadow-none print:border-none print:p-0">
          {/* Header Báo Cáo Không Căn Giữa */}
          <div className="border-b border-slate-200 pb-4 flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-black text-[#0f3b7d] uppercase tracking-wide">
              BÁO CÁO TỔNG HỢP TOÀN CHIẾN DỊCH TUYỂN SINH
            </h1>
            <span className="px-2.5 py-0.5 rounded-[4px] bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200">
              📊 {campaignSummary.total_rounds} ĐỢT CÔNG TÁC
            </span>
          </div>

          {/* 1. THÔNG TIN CHUNG CHIẾN DỊCH (Hiển thị danh sách bullet chuẩn như Hình 2) */}
          <div className="space-y-3">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              1. Thông Tin Chung Chiến Dịch
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-800 marker:text-slate-900 leading-relaxed">
              <li>
                <strong className="font-bold text-slate-900">Tên chiến dịch:</strong>{' '}
                <span className="text-slate-800">{campaignSummary.campaign_name || 'Chiến dịch tuyển sinh'}</span>
              </li>
              <li>
                <strong className="font-bold text-slate-900">Mã chiến dịch:</strong>{' '}
                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200/80 align-middle">
                  {campaignSummary.campaign_id}
                </span>
              </li>
              {campaignSummary.campaign_code && campaignSummary.campaign_code !== campaignSummary.campaign_id && (
                <li>
                  <strong className="font-bold text-slate-900">Mã ký hiệu:</strong>{' '}
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200/80 align-middle">
                    {campaignSummary.campaign_code}
                  </span>
                </li>
              )}
              <li>
                <strong className="font-bold text-slate-900">Thời gian chiến dịch:</strong>{' '}
                <span className="text-slate-800">
                  {formatCampaignDateRange(campaignSummary.start_date, campaignSummary.end_date, campaignSummary.rounds_data)}
                </span>
              </li>
              <li>
                <strong className="font-bold text-slate-900">Thời điểm lập báo cáo:</strong>{' '}
                <span className="text-slate-800">{formatDateTime(campaignSummary.created_at)}</span>
              </li>
              <li>
                <strong className="font-bold text-slate-900">Trạng thái chiến dịch:</strong>{' '}
                <span className="text-slate-800">{campaignSummary.status || 'completed'}</span>
              </li>
              {campaignSummary.campaign_created_at && (
                <li>
                  <strong className="font-bold text-slate-900">Thời gian khởi tạo:</strong>{' '}
                  <span className="text-slate-800">
                    {formatDateTime(campaignSummary.campaign_created_at)}
                  </span>
                </li>
              )}
              <li>
                <strong className="font-bold text-slate-900">Điểm xuất phát:</strong>{' '}
                <span className="text-slate-800">{formatStartPoint(campaignSummary.start_point)}</span>
              </li>
              <li>
                <strong className="font-bold text-slate-900">Đoàn cán bộ tuyển sinh:</strong>{' '}
                <span className="text-slate-800">
                  {formatStaffList(campaignSummary.assigned_staff, campaignSummary.leader_name)}
                </span>
              </li>
            </ul>
          </div>

          {/* 2. Kết Quả Thực Hiện (3 Thẻ Chỉ Số Cốt Lõi) */}
          <div className="space-y-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
              2. KẾT QUẢ THỰC HIỆN
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-slate-50 border border-slate-200 rounded-[5px] p-3.5 sm:p-4 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Quy Mô Công Tác
                </span>
                <p className="text-xl sm:text-2xl font-black text-[#0f3b7d]">
                  {campaignSummary.total_rounds}{' '}
                  <span className="text-xs font-medium text-slate-600">đợt công tác</span>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-[5px] p-3.5 sm:p-4 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Điểm Trường Mục Tiêu
                </span>
                <p className="text-xl sm:text-2xl font-black text-emerald-700">
                  {campaignSummary.total_schools}{' '}
                  <span className="text-xs font-medium text-slate-600">trường đối tác</span>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-[5px] p-3.5 sm:p-4 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Phiếu Tuyển Sinh Thu Được
                </span>
                <p className="text-xl sm:text-2xl font-black text-purple-700">
                  {campaignSummary.total_tickets}{' '}
                  <span className="text-xs font-medium text-slate-600">phiếu tích lũy</span>
                </p>
              </div>
            </div>
          </div>

          {/* 3. BẢNG TIẾN ĐỘ & PHIẾU THU THEO TỪNG ĐỢT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                3. BẢNG TIẾN ĐỘ VÀ PHIẾU THU THEO TỪNG ĐỢT CÔNG TÁC
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">({campaignSummary.total_rounds} đợt)</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-[5px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                    <th className="py-2.5 px-3 text-center w-20">Đợt</th>
                    <th className="py-2.5 px-3 w-36">Mã Chuyến Đi</th>
                    <th className="py-2.5 px-3 w-28">Ngày Đi</th>
                    <th className="py-2.5 px-3">Trưởng Đoàn</th>
                    <th className="py-2.5 px-3 text-center w-28">Số Trường</th>
                    <th className="py-2.5 px-3 text-center w-28">Số Phiếu Thu</th>
                    <th className="py-2.5 px-3 text-center w-32">Trạng Thái</th>
                    <th className="py-2.5 px-3 text-center w-20 print:hidden">Xem Đợt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(campaignSummary.rounds_data || []).map((rnd: any) => (
                    <tr key={rnd.trip_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">{rnd.round_name}</td>
                      <td className="py-2.5 px-3">
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                          {rnd.trip_code}
                        </code>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{rnd.date || 'Chưa đặt'}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{rnd.leader_name}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-800">{rnd.schools_count} trường</td>
                      <td className="py-2.5 px-3 text-center font-bold text-purple-700 text-sm">{rnd.tickets_collected}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${rnd.status === 'completed' || rnd.status === 'Hoàn thành'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                          }`}>
                          {rnd.status === 'completed' ? 'Hoàn thành' : rnd.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center print:hidden">
                        {rnd.report_id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentReportId(rnd.report_id);
                              setViewMode('round');
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-bold text-[#0f3b7d] transition cursor-pointer"
                          >
                            Xem
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Chưa có</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Hàng Tổng Cộng Căn Gióng Chuẩn Cột */}
                  <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={4} className="py-2.5 px-3 uppercase text-xs text-left">
                      TỔNG CỘNG ({campaignSummary.total_rounds} ĐỢT)
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-slate-900 font-extrabold">
                      {campaignSummary.total_schools} trường
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-purple-700 font-black text-sm">
                      {campaignSummary.total_tickets} phiếu
                    </td>
                    <td colSpan={2} className="text-center text-slate-400 text-xs">
                      —
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* BẢNG 2: TỔNG HỢP KẾT QUẢ TÍCH LŨY THEO TỪNG ĐIỂM TRƯỜNG */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                4. BẢNG TỔNG HỢP HIỆU QUẢ TÍCH LŨY THEO TỪNG ĐIỂM TRƯỜNG
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">({campaignSummary.total_schools} trường)</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-[5px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 w-56">Tên Trường Học</th>
                    <th className="py-2.5 px-3 max-w-xs">Địa Chỉ</th>
                    <th className="py-2.5 px-3 text-center w-32">Các Đợt Đã Ghé</th>
                    <th className="py-2.5 px-3 text-center w-28">Tổng Phiếu Thu</th>
                    <th className="py-2.5 px-3">Ban Giám Hiệu / Người Liên Hệ</th>
                    <th className="py-2.5 px-3">Ghi Chú Đánh Giá Chung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(campaignSummary.schools_data || []).map((sch: any, idx: number) => (
                    <tr key={sch.school_id || idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{sch.name}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs">{sch.address}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          {sch.rounds_display}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-purple-700 text-sm">
                        {sch.total_tickets}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{sch.contact_person}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs">{sch.notes}</td>
                    </tr>
                  ))}
                  {/* Hàng Tổng Cộng Căn Gióng Chuẩn Cột */}
                  <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={4} className="py-2.5 px-3 uppercase text-xs text-left">
                      TỔNG ({campaignSummary.total_schools} TRƯỜNG ĐỐI TÁC)
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-purple-700 font-black text-sm">
                      {campaignSummary.total_tickets} phiếu
                    </td>
                    <td colSpan={2} className="text-center text-slate-400 text-xs">
                      —
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. GIAO DIỆN CHẾ ĐỘ 2: BÁO CÁO TỪNG ĐỢT LẺ ================= */}
      {viewMode === 'round' && (
        <>
          {currentReport ? (
            <div className="bg-white rounded-[5px] border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6 print:shadow-none print:border-none print:p-0">
              {/* Header Báo Cáo Không Căn Giữa */}
              <div className="border-b border-slate-200 pb-4 flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-[#0f3b7d] uppercase tracking-wide">
                  BÁO CÁO TỔNG KẾT CHIẾN DỊCH TUYỂN SINH
                </h1>
                <span className="px-2.5 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                  ✅ ĐÃ HOÀN THÀNH CÔNG TÁC
                </span>
              </div>

              {/* 1. THÔNG TIN CHUNG CHUYẾN ĐI (Hiển thị danh sách bullet chuẩn như Hình 2) */}
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  1. Thông Tin Chung Chuyến Đi
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-800 marker:text-slate-900 leading-relaxed">
                  <li>
                    <strong className="font-bold text-slate-900">Tên chuyến đi / lộ trình:</strong>{' '}
                    <span className="text-slate-800">{currentReport.trip_name || 'Chuyến đi tuyển sinh'}</span>
                  </li>
                  <li>
                    <strong className="font-bold text-slate-900">Mã chuyến đi:</strong>{' '}
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200/80 align-middle">
                      {currentReport.trip_id || currentReport.trip_code}
                    </span>
                  </li>
                  {currentReport.trip_code && currentReport.trip_code !== currentReport.trip_id && (
                    <li>
                      <strong className="font-bold text-slate-900">Mã ký hiệu:</strong>{' '}
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200/80 align-middle">
                        {currentReport.trip_code}
                      </span>
                    </li>
                  )}
                  {currentReport.campaign_id && (
                    <li>
                      <strong className="font-bold text-slate-900">Mã chiến dịch liên kết:</strong>{' '}
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200/80 align-middle">
                        {currentReport.campaign_id}
                      </span>
                    </li>
                  )}
                  <li>
                    <strong className="font-bold text-slate-900">Thời điểm lập báo cáo:</strong>{' '}
                    <span className="text-slate-800">{formatDateTime(currentReport.created_at)}</span>
                  </li>
                  <li>
                    <strong className="font-bold text-slate-900">Trạng thái chuyến đi:</strong>{' '}
                    <span className="text-slate-800">{currentReport.status || currentReport.trip_status || 'completed'}</span>
                  </li>
                  <li>
                    <strong className="font-bold text-slate-900">Thời gian khởi tạo:</strong>{' '}
                    <span className="text-slate-800">
                      {formatDateTime(currentReport.trip_created_at || currentReport.created_at)}
                    </span>
                  </li>
                  <li>
                    <strong className="font-bold text-slate-900">Điểm xuất phát:</strong>{' '}
                    <span className="text-slate-800">{formatStartPoint(currentReport.start_point)}</span>
                  </li>
                  <li>
                    <strong className="font-bold text-slate-900">Đoàn cán bộ tuyển sinh:</strong>{' '}
                    <span className="text-slate-800">
                      {formatStaffList(currentReport.assigned_staff, currentReport.leader_name)}
                    </span>
                  </li>
                </ul>
              </div>

              {/* 2. Kết Quả Thực Hiện (KPIs Căn Đều) */}
              <div className="space-y-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                  2. KẾT QUẢ THỰC HIỆN
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="bg-slate-50 border border-slate-200 rounded-[5px] p-3.5 sm:p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[5px] bg-blue-100 text-[#0f3b7d] flex items-center justify-center shrink-0">
                      <School className="w-5 h-5 text-[#0f3b7d]" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Số trường đã tiếp cận</span>
                      <p className="text-xl font-black text-slate-900">
                        {currentReport.schools_visited || currentReport.total_schools}{' '}
                        <span className="text-xs font-medium text-slate-500">/ {currentReport.total_schools} trường mục tiêu</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-[5px] p-3.5 sm:p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[5px] bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <span className="text-lg">🎫</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">Phiếu tuyển sinh thu được</span>
                      <p className="text-xl font-black text-purple-700">
                        {currentReport.total_tickets} <span className="text-xs font-medium text-slate-500">phiếu quan tâm</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Bảng Kết Quả Thực Địa Các Điểm Trường Căn Gióng Chuẩn Cột */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                    3. BẢNG KẾT QUẢ THỰC ĐỊA CÁC ĐIỂM TRƯỜNG
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({(currentReport.schools_data || []).length} điểm trường)
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-[5px]">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                        <th className="py-2.5 px-3 text-center w-12">STT</th>
                        <th className="py-2.5 px-3 w-56">Tên Trường Học</th>
                        <th className="py-2.5 px-3 max-w-xs">Địa Chỉ</th>
                        <th className="py-2.5 px-3 w-36">Thời Gian Ghé</th>
                        <th className="py-2.5 px-3">Ban Giám Hiệu / Người Tiếp Đón</th>
                        <th className="py-2.5 px-3 text-center w-28">Số Phiếu Thu</th>
                        <th className="py-2.5 px-3">Ghi Chú / Đánh Giá Thực Địa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(currentReport.schools_data && currentReport.schools_data.length > 0) ? (
                        currentReport.schools_data.map((sch: any, idx: number) => {
                          const ticketsCount =
                            sch.tickets_collected != null
                              ? sch.tickets_collected
                              : Array.isArray(sch.tickets) && sch.tickets.length > 0
                                ? ((sch.tickets.reduce((acc: number, t: any) => acc + (t.tickets_collected || 0), 0)) || sch.tickets.length)
                                : 0;
                          const visitedTime = sch.visited_at
                            ? formatDate(sch.visited_at)
                            : (sch.is_visited ? 'Đã hoàn tất' : 'Chưa tiếp cận');

                          const contacts: string[] = [];
                          if (sch.principal_name) contacts.push(`HT: ${sch.principal_name}${sch.principal_phone ? ` (${sch.principal_phone})` : ''}`);
                          if (sch.vice_principal_name) contacts.push(`Phó HT: ${sch.vice_principal_name}${sch.vice_principal_phone ? ` (${sch.vice_principal_phone})` : ''}`);
                          if (sch.representative_name) contacts.push(`Đại diện: ${sch.representative_name}`);
                          const contactStr = contacts.length > 0 ? contacts.join('; ') : (sch.contact_name || sch.phone || 'Chưa cập nhật');

                          return (
                            <tr key={sch.school_id || idx} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{sch.name}</td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-xs">{sch.address || 'Chưa có'}</td>
                              <td className="py-2.5 px-3 text-slate-700">{visitedTime}</td>
                              <td className="py-2.5 px-3 text-slate-700">{contactStr}</td>
                              <td className="py-2.5 px-3 text-center font-black text-purple-700 text-sm">{ticketsCount}</td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-xs">{sch.notes || 'Đã làm việc và tư vấn trực tiếp'}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">Chưa có thông tin điểm trường</td>
                        </tr>
                      )}
                      {/* Dòng tổng cộng căn gióng chuẩn cột */}
                      {currentReport.schools_data && currentReport.schools_data.length > 0 && (
                        <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                          <td colSpan={5} className="py-2.5 px-3 uppercase text-xs text-left">
                            TỔNG CỘNG ({currentReport.schools_data.length} TRƯỜNG)
                          </td>
                          <td className="py-2.5 px-3 text-center text-xs text-purple-700 font-black text-sm">
                            {currentReport.total_tickets} phiếu
                          </td>
                          <td className="text-center text-slate-400 text-xs">—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="py-16 text-center bg-white rounded-[5px] border border-slate-200/80 p-6">
              <p className="text-slate-700 font-bold mb-2">Chưa chọn đợt báo cáo nào</p>
              <p className="text-xs text-slate-500 mb-4">Vui lòng chọn một đợt trên menu hoặc chuyển sang Báo cáo tổng hợp.</p>
              <button
                type="button"
                onClick={() => setViewMode('summary')}
                className="px-4 py-2 bg-[#0f3b7d] text-white text-xs font-bold rounded-[5px] transition cursor-pointer"
              >
                Xem báo cáo tổng hợp toàn chiến dịch
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportPage;
