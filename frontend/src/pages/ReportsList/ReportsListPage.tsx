import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Calendar,
  School,
  Search,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Award,
  Filter,
} from 'lucide-react';
import { reportApi, campaignApi } from '../../services/api';
import { exportReportToExcel, exportCampaignSummaryToExcel } from '../../utils/reportExcelExporter';
import type { ReportListItem } from '../../types';

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  startDate?: string;
  endDate?: string;
  leaderName?: string;
  targetSchoolsCount: number;
  totalTickets: number;
  roundsCount: number;
  reports: ReportListItem[];
}

export const ReportsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const campIdParam = searchParams.get('campaign_id');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>(campIdParam || 'all');
  const [expandedCampIds, setExpandedCampIds] = useState<Record<string, boolean>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingCampId, setDownloadingCampId] = useState<string | null>(null);

  // Fetch tất cả báo cáo
  const { data: reports, isLoading: isLoadingReports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportApi.getAllReports(),
  });

  // Fetch danh sách chiến dịch
  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignApi.getAll(),
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  };

  // Gom nhóm dữ liệu CHA - CON (Chiến dịch làm Cha, các Đợt làm Con)
  const { campaignGroups, orphanReports } = useMemo(() => {
    if (!reports) return { campaignGroups: [], orphanReports: [] };

    const campMap = new Map<string, any>();
    (campaigns || []).forEach((c: any) => {
      campMap.set(c.id, c);
      if (c._id) campMap.set(c._id, c);
    });

    const groupsMap = new Map<string, CampaignGroup>();
    const orphans: ReportListItem[] = [];

    // Khởi tạo các nhóm từ danh sách chiến dịch hiện có
    (campaigns || []).forEach((c: any) => {
      const cId = c.id || c._id;
      const targetSchools = (c.destinations || []).length;
      groupsMap.set(cId, {
        campaignId: cId,
        campaignName: c.name || 'Chiến dịch tuyển sinh',
        campaignCode: c.code || `CAMP-${cId.slice(0, 6).toUpperCase()}`,
        startDate: c.start_date,
        endDate: c.end_date,
        leaderName: c.team?.leader_name || '',
        targetSchoolsCount: targetSchools,
        totalTickets: 0,
        roundsCount: 0,
        reports: [],
      });
    });

    // Phân bổ các báo cáo vào từng nhóm Cha
    reports.forEach((rep: any) => {
      const cId = rep.campaign_id;
      if (cId && groupsMap.has(cId)) {
        const group = groupsMap.get(cId)!;
        group.reports.push(rep);
        group.totalTickets += rep.total_tickets || 0;
        group.roundsCount += 1;
        if (!group.leaderName && rep.leader_name) {
          group.leaderName = rep.leader_name;
        }
      } else if (cId) {
        // Có campaign_id nhưng chưa có trong campaigns list
        let campName = rep.campaign_name || rep.trip_name || 'Chiến dịch tuyển sinh';
        // Tinh gọn tên chiến dịch nếu lấy từ tên đợt (bỏ " - Đợt X")
        campName = campName.replace(/\s*-\s*Đợt\s+\d+$/i, '').trim();

        let campCode = rep.campaign_code;
        if (!campCode) {
          campCode = cId.toUpperCase().startsWith('CAMP-')
            ? cId.toUpperCase()
            : `CAMP-${cId.slice(0, 6).toUpperCase()}`;
        }

        const group: CampaignGroup = {
          campaignId: cId,
          campaignName: campName,
          campaignCode: campCode,
          startDate: rep.created_at,
          endDate: undefined,
          leaderName: rep.leader_name || '',
          targetSchoolsCount: rep.total_schools || 0,
          totalTickets: rep.total_tickets || 0,
          roundsCount: 1,
          reports: [rep],
        };
        groupsMap.set(cId, group);
      } else {
        orphans.push(rep);
      }
    });

    // Sắp xếp báo cáo trong từng nhóm theo thứ tự ngày tạo từ Đợt 1 -> Đợt N
    // Và tự động tính toán khoảng thời gian (startDate - endDate) của chiến dịch theo các đợt thực tế
    groupsMap.forEach((grp) => {
      grp.reports.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (grp.targetSchoolsCount === 0 && grp.reports.length > 0) {
        grp.targetSchoolsCount = grp.reports[0].total_schools || 0;
      }

      // Chuẩn hóa tên chiến dịch nếu còn dính " - Đợt X"
      if (grp.campaignName.match(/\s*-\s*Đợt\s+\d+$/i)) {
        grp.campaignName = grp.campaignName.replace(/\s*-\s*Đợt\s+\d+$/i, '').trim();
      }

      // Cập nhật khoảng thời gian theo các đợt thực địa thực tế
      if (grp.reports.length > 0) {
        const earliestDate = grp.reports[0].created_at;
        const latestDate = grp.reports[grp.reports.length - 1].created_at;
        grp.startDate = earliestDate;
        if (grp.reports.length > 1 && formatDate(earliestDate) !== formatDate(latestDate)) {
          grp.endDate = latestDate;
        } else {
          grp.endDate = undefined;
        }
      }
    });

    // Lọc theo từ khóa tìm kiếm và bộ lọc chiến dịch
    let filteredGroups = Array.from(groupsMap.values()).filter((g) => g.reports.length > 0);

    if (selectedCampaignFilter !== 'all') {
      filteredGroups = filteredGroups.filter((g) => g.campaignId === selectedCampaignFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filteredGroups = filteredGroups.filter((g) => {
        const matchCamp =
          g.campaignName.toLowerCase().includes(q) ||
          g.campaignCode.toLowerCase().includes(q) ||
          (g.leaderName && g.leaderName.toLowerCase().includes(q));
        const matchChild = g.reports.some(
          (r: any) =>
            r.trip_name?.toLowerCase().includes(q) ||
            r.trip_code?.toLowerCase().includes(q) ||
            r.id?.toLowerCase().includes(q)
        );
        return matchCamp || matchChild;
      });
    }

    return { campaignGroups: filteredGroups, orphanReports: orphans };
  }, [reports, campaigns, selectedCampaignFilter, searchQuery]);

  // Đóng/Mở nhóm Cha
  const toggleExpand = (campId: string) => {
    setExpandedCampIds((prev) => ({
      ...prev,
      [campId]: prev[campId] === undefined ? false : !prev[campId],
    }));
  };

  const isExpanded = (campId: string) => {
    // Mặc định đóng để giao diện gọn gàng, người dùng bấm mới mở ra
    return Boolean(expandedCampIds[campId]);
  };


  // Xuất file Excel báo cáo từng đợt
  const handleDownloadRoundExcel = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    try {
      setDownloadingId(reportId);
      const fullReport = await reportApi.getReport(reportId);
      if (fullReport) {
        exportReportToExcel(fullReport);
      }
    } catch (err) {
      console.error('Failed to export round excel:', err);
      navigate(`/reports/${reportId}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Xuất file Excel báo cáo tổng hợp toàn chiến dịch
  const handleDownloadCampaignSummaryExcel = async (e: React.MouseEvent, campId: string) => {
    e.stopPropagation();
    try {
      setDownloadingCampId(campId);
      const summary = await campaignApi.getSummaryReport(campId);
      if (summary) {
        exportCampaignSummaryToExcel(summary);
      }
    } catch (err) {
      console.error('Failed to export campaign summary excel:', err);
      navigate(`/reports/summary/${campId}`);
    } finally {
      setDownloadingCampId(null);
    }
  };

  const isLoading = isLoadingReports || isLoadingCampaigns;

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-[#0f3b7d]/30 border-t-[#0f3b7d] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Đang tải danh sách báo cáo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-[5px] border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[5px] bg-[#0f3b7d]/10 text-[#0f3b7d] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-[#0f3b7d]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              Báo Cáo Tổng Kết Tuyển Sinh
            </h1>
          </div>
        </div>

        {/* Thanh Tìm Kiếm & Bộ Lọc Chiến Dịch */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-slate-100 items-center">
          {/* Ô tìm kiếm */}
          <div className="sm:col-span-7 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên chiến dịch, mã đợt, trưởng đoàn, trường học..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-[5px] bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] outline-hidden transition"
            />
          </div>

          {/* Dropdown lọc chiến dịch */}
          <div className="sm:col-span-5 flex items-center gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCampaignFilter}
                onChange={(e) => {
                  setSelectedCampaignFilter(e.target.value);
                  if (e.target.value === 'all') {
                    setSearchParams({});
                  } else {
                    setSearchParams({ campaign_id: e.target.value });
                  }
                }}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-[5px] bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:border-[#0f3b7d] outline-hidden transition cursor-pointer appearance-none"
              >
                <option value="all">🏢 Tất cả chiến dịch ({campaignGroups.length})</option>
                {campaignGroups.map((g) => (
                  <option key={g.campaignId} value={g.campaignId}>
                    [{g.campaignCode}] {g.campaignName} ({g.roundsCount} đợt)
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách Báo cáo dạng CHA - CON */}
      {campaignGroups.length === 0 && orphanReports.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200/80 rounded-[5px] p-8 shadow-xs">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-800 font-bold text-base mb-1">Chưa tìm thấy báo cáo nào</p>
          <p className="text-slate-500 text-xs mb-4">
            {searchQuery
              ? 'Không có kết quả nào phù hợp với từ khóa tìm kiếm.'
              : 'Báo cáo sẽ được tạo tự động khi hoàn thành các đợt công tác thực địa.'}
          </p>
          <button
            onClick={() => navigate('/staff/campaigns')}
            className="px-4 py-2 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold rounded-[5px] transition cursor-pointer"
          >
            Xem danh sách chiến dịch triển khai
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaignGroups.map((group) => {
            const open = isExpanded(group.campaignId);

            return (
              <div
                key={group.campaignId}
                className="bg-white rounded-[5px] border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200"
              >
                {/* ================= KHỐI CHA: CHIẾN DỊCH TUYỂN SINH ================= */}
                <div
                  onClick={() => toggleExpand(group.campaignId)}
                  className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/30 border-b border-slate-200/80 cursor-pointer hover:bg-slate-50/90 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-[5px] bg-[#0f3b7d] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Layers className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2 py-0.5 rounded-[4px] bg-blue-100 text-[#0f3b7d] text-[10px] font-black uppercase tracking-wider border border-blue-200">
                          {group.campaignCode}
                        </span>
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {group.campaignName}
                        </h2>
                      </div>

                      {/* Thông tin tóm tắt Cha: Tuyệt đối không có "9 lượt trường", không có % hoàn thành */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 mt-1">
                        {group.startDate && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {formatDate(group.startDate)}
                              {group.endDate ? ` - ${formatDate(group.endDate)}` : ''}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1 font-semibold text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0f3b7d]" />
                          <span><strong>{group.roundsCount}</strong> đợt công tác</span>
                        </div>

                        <div className="flex items-center gap-1 font-semibold text-slate-700">
                          <School className="w-3.5 h-3.5 text-blue-600" />
                          <span><strong>{group.targetSchoolsCount}</strong> trường mục tiêu</span>
                        </div>

                        <div className="flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-[4px] border border-purple-200">
                          <span>🎫</span>
                          <span><strong>{group.totalTickets}</strong> phiếu thu</span>
                        </div>

                        {group.leaderName && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-[4px] border border-amber-200 font-semibold">
                            <Award className="w-3 h-3 text-amber-600" />
                            <span>Trưởng đoàn: {group.leaderName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nút hành động Cấp Cha */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center" onClick={(e) => e.stopPropagation()}>
                    {/* NÚT 1: XEM BÁO CÁO TỔNG HỢP */}
                    <button
                      type="button"
                      onClick={() => navigate(`/reports/summary/${group.campaignId}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f3b7d] hover:bg-[#0c2f64] active:scale-[0.99] text-white rounded-[5px] text-xs font-bold transition shadow-xs cursor-pointer"
                      title="Xem báo cáo tổng hợp kết quả của toàn bộ các đợt"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Xem</span>
                    </button>

                    {/* NÚT 2: EXPORT EXCEL TỔNG HỢP */}
                    <button
                      type="button"
                      onClick={(e) => handleDownloadCampaignSummaryExcel(e, group.campaignId)}
                      disabled={downloadingCampId === group.campaignId}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-[5px] text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-60"
                      title="Tải nhanh file Excel tổng hợp 2 bảng (.xlsx)"
                    >
                      {downloadingCampId === group.campaignId ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Export</span>
                    </button>

                    {/* Nút mở rộng/thu gọn */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.campaignId)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-[5px] transition cursor-pointer"
                      title={open ? 'Thu gọn danh sách đợt con' : 'Xem các đợt con'}
                    >
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* ================= KHỐI CON: CÁC ĐỢT CỦA CHIẾN DỊCH ================= */}
                {open && (
                  <div className="divide-y divide-slate-100 bg-slate-50/40">
                    {group.reports.map((report: any, idx: number) => {
                      const roundLabel = report.round_name || `Đợt ${idx + 1}`;
                      const tripCode = report.trip_code || report.trip_id;

                      return (
                        <div
                          key={report.id}
                          onClick={() => navigate(`/reports/${report.id}`)}
                          className="px-4 py-3 sm:px-6 sm:py-3.5 hover:bg-blue-50/40 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Icon xe ô tô từng đợt */}
                            <div className="w-8 h-8 rounded-[5px] bg-white border border-slate-200 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:border-blue-400">
                              <span className="text-xs">🚗</span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-[#0f3b7d] transition-colors">
                                  {roundLabel}
                                </span>
                                {tripCode && (
                                  <code className="text-[11px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded-[4px] border border-slate-200">
                                    {tripCode}
                                  </code>
                                )}
                                <span className="text-[11px] text-slate-400">
                                  • {formatDate(report.created_at)}
                                </span>
                              </div>

                              {/* Thông số Đợt con */}
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                                {report.leader_name && (
                                  <span className="text-[11px] text-slate-700">
                                    Trưởng đoàn: <strong>{report.leader_name}</strong>
                                  </span>
                                )}
                                <div className="flex items-center gap-1 text-slate-700">
                                  <School className="w-3 h-3 text-blue-600" />
                                  <span><strong>{report.schools_visited || report.total_schools}</strong> trường</span>
                                </div>
                                <div className="flex items-center gap-1 text-purple-700 font-bold">
                                  <span>🎫</span>
                                  <span><strong>{report.total_tickets}</strong> phiếu thu</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons Đợt Con */}
                          <div
                            className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleDownloadRoundExcel(e, report.id)}
                              disabled={downloadingId === report.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[5px] text-xs font-semibold transition cursor-pointer disabled:opacity-60"
                              title="Tải file Excel của đợt này"
                            >
                              {downloadingId === report.id ? (
                                <div className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                              ) : (
                                <Download className="w-3 h-3 text-emerald-700" />
                              )}
                              <span>Export</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/reports/${report.id}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-[5px] text-xs font-semibold transition cursor-pointer"
                            >
                              <span>Xem</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Nhóm các báo cáo độc lập nếu có */}
          {orphanReports.length > 0 && (
            <div className="bg-white rounded-[5px] border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Các báo cáo độc lập khác ({orphanReports.length})</span>
              </div>
              <div className="divide-y divide-slate-100">
                {orphanReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => navigate(`/reports/${report.id}`)}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{report.trip_name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(report.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleDownloadRoundExcel(e, report.id)}
                        className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-[5px] font-semibold"
                      >
                        Xuất Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/reports/${report.id}`)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-[5px]"
                      >
                        Xem
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsListPage;
