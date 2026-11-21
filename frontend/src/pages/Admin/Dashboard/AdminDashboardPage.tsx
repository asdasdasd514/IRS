import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Users,
  Flag,
  TrendingUp,
  Building2,
  Calendar,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  BarChart3,
  Inbox,
  Compass,
  Route,
  Clock,
  ArrowRight,
  ChevronRight,
  User,
  Plus,
} from 'lucide-react';
import { dashboardApi, campaignApi } from '../../../services/api';
import { AnimatedCounter } from '../../../components/common/AnimatedCounter';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredMajor, setHoveredMajor] = useState<string | null>(null);
  const [hoveredTrend, setHoveredTrend] = useState<number | null>(null);

  // Lấy dữ liệu thống kê tổng hợp thực tế từ backend endpoint /api/dashboard/stats
  const {
    data: dashboardData,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    staleTime: 10000,
  });

  // Lấy danh sách chiến dịch trực tiếp để đồng bộ tức thời
  const { data: directCampaigns = [] } = useQuery({
    queryKey: ['dashboard-campaigns'],
    queryFn: () => campaignApi.getAll(),
    staleTime: 10000,
  });

  // Dữ liệu thực tế từ Database (Mặc định là 0 nếu chưa có dữ liệu)
  const kpi = dashboardData?.kpi_metrics || {
    visitedSchools: 0,
    totalSchools: 0,
    totalSurveys: 0,
    surveyGrowthRate: '0%',
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalUsers: 0,
    activeBusCrews: 0,
    totalDistanceKm: 0,
    distanceTargetKm: 2500,
    activeStaff: 0,
    totalReports: 0,
    targetProvinces: 0,
  };

  const topMajors = dashboardData?.top_majors || [];
  const weeklyTrend = dashboardData?.weekly_trend || [];

  // Danh sách Chiến dịch đang triển khai (Active / Deployed / Assigned)
  const activeCampaigns = useMemo(() => {
    if (Array.isArray(dashboardData?.active_campaigns)) {
      return dashboardData.active_campaigns;
    }
    const activeStatuses = ['assigned', 'in_progress', 'active', 'ongoing', 'deployed'];
    const inactiveStatuses = ['completed', 'cancelled', 'archived', 'closed', 'draft'];
    return directCampaigns.filter((c: any) => {
      const st = String(c.status || '').toLowerCase();
      if (inactiveStatuses.includes(st)) return false;
      return (
        activeStatuses.includes(st) ||
        Boolean(c.deployed_trip_id) ||
        Boolean(c.team?.leader_name)
      );
    });
  }, [dashboardData?.active_campaigns, directCampaigns]);

  // Danh sách Chiến dịch gần nhất (Recent Campaigns)
  const recentCampaigns = useMemo(() => {
    if (Array.isArray(dashboardData?.recent_campaigns) && dashboardData.recent_campaigns.length > 0) {
      return dashboardData.recent_campaigns;
    }
    return directCampaigns.slice(0, 5);
  }, [dashboardData?.recent_campaigns, directCampaigns]);

  // Định dạng ngày hiển thị dd/mm/yyyy
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  // Badge trạng thái chiến dịch
  const getStatusBadge = (status?: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'deployed') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Đã triển khai
        </span>
      );
    }
    if (s === 'assigned' || s === 'in_progress' || s === 'active') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Đang triển khai
        </span>
      );
    }
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
          Hoàn thành
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
        Lên kế hoạch
      </span>
    );
  };

  // SVG parameters for Area Trendline Chart
  const svgWidth = 560;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;
  const maxSurveys = Math.max(kpi.totalSurveys, 10);

  const points = useMemo(() => {
    if (weeklyTrend.length === 0) return [];
    return weeklyTrend.map((item, index) => {
      const x = paddingX + (index / Math.max(weeklyTrend.length - 1, 1)) * chartWidth;
      const y = svgHeight - paddingY - (item.cumulativeSurveys / maxSurveys) * chartHeight;
      return { x, y, ...item };
    });
  }, [weeklyTrend, chartWidth, chartHeight, maxSurveys]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, point, index) => {
      return index === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
    }, '');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const baselineY = svgHeight - paddingY;
    return `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;
  }, [linePath, points]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0f3b7d] shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                Bảng Điều Khiển Tổng Quan Tuyển Sinh
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi thời gian thực tiến độ tiếp cận trường học, thu thập phiếu và lộ trình các chuyến đi
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới số liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Đang tải...' : 'Cập nhật'}</span>
          </button>
        </div>
      </div>

      {/* 2. KHỐI 1: HÀNG THẺ CHỈ SỐ KPI CỐT LÕI (4 Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng số trường */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng Số Trường</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-1.5">
              <AnimatedCounter value={kpi.totalSchools} />
              <span className="text-sm font-semibold text-slate-500">trường</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
              <span>Đã tiếp cận:</span>
              <span className="font-semibold text-blue-600">{kpi.visitedSchools} trường</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${kpi.totalSchools > 0 ? (kpi.visitedSchools / kpi.totalSchools) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Tổng phiếu khảo sát thu thập */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Phiếu Khảo Sát Thu Thập</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              <AnimatedCounter value={kpi.totalSurveys} />
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                <ArrowUpRight className="w-3 h-3" />
                {kpi.totalSurveys > 0 ? `${kpi.totalSurveys} phiếu` : 'Chưa có phiếu'}
              </span>
              <span className="text-slate-400">thu thập qua QR</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-purple-600 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${kpi.totalSurveys > 0 ? 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Chiến dịch */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Chiến Dịch</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Flag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-1.5">
              <AnimatedCounter value={kpi.totalCampaigns ?? kpi.activeCampaigns ?? 0} />
              <span className="text-sm font-semibold text-slate-500">chiến dịch</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">
                <span className="font-bold text-emerald-600">{activeCampaigns.length}</span> đang triển khai
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeCampaigns.length > 0 ? 'Đang diễn ra' : 'Lên kế hoạch'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${(kpi.totalCampaigns || activeCampaigns.length) > 0 ? 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Số người dùng (tài khoản) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Số Người Dùng</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-1.5">
              <AnimatedCounter value={kpi.totalUsers ?? 1} />
              <span className="text-sm font-semibold text-slate-500">tài khoản</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
              <span>Tài khoản hệ thống</span>
              <span className="text-amber-600 font-semibold">Đang hoạt động</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${kpi.totalUsers && kpi.totalUsers > 0 ? 100 : 50}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. KHỐI CHÍNH: CỘT TRÁI (TOP NGÀNH & TIẾN ĐỘ) - CỘT PHẢI (CHUYẾN ĐI & CHIẾN DỊCH) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* CỘT TRÁI (7 CỘT): TOP NGÀNH HỌC (TRÊN) VÀ TIẾN ĐỘ KHẢO SÁT LŨY KẾ (DƯỚI) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6 flex flex-col">
          {/* Biểu đồ 1: Top Ngành Học Thu Hút Sự Quan Tâm */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Top Ngành Học Được Thí Sinh Quan Tâm Nhất
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {topMajors.length > 0
                      ? `Tổng hợp từ ${kpi.totalSurveys.toLocaleString()} phiếu khảo sát thực tế trong CSDL`
                      : 'Chưa có phiếu khảo sát nào trong hệ thống'}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                  Phân tích nhu cầu
                </span>
              </div>

              {topMajors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Inbox className="w-6 h-6 text-slate-400 stroke-1" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Chưa có dữ liệu phiếu khảo sát</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Dữ liệu nguyện vọng ngành học sẽ tự động xuất hiện tại đây khi thí sinh quét mã QR tại các trường và nộp phiếu.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5 mt-4">
                  {topMajors.map((item) => (
                    <div
                      key={item.major}
                      className="space-y-1.5 cursor-pointer group"
                      onMouseEnter={() => setHoveredMajor(item.major)}
                      onMouseLeave={() => setHoveredMajor(null)}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {item.major}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-normal">{item.count.toLocaleString()} phiếu</span>
                          <span className={`font-bold ${item.textColor}`}>{item.percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700 ${
                            hoveredMajor === item.major ? 'scale-y-125' : ''
                          }`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                {topMajors.length > 0 ? `${topMajors[0]?.major} dẫn đầu nguyện vọng` : 'Hệ thống sẵn sàng thu nhận khảo sát'}
              </span>
              <span className="text-[11px] text-slate-400">Đồng bộ từ Database</span>
            </div>
          </div>

          {/* Biểu đồ 2: Tiến Độ Khảo Sát & Tiếp Cận Theo Thời Gian (ĐẶT Ở DƯỚI TOP NGÀNH HỌC) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Tiến Độ Thu Thập Phiếu Khảo Sát Lũy Kế
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đường cong tăng trưởng số phiếu học sinh theo đợt chiến dịch thực tế
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500" />
                    <span className="font-medium text-slate-600">Số phiếu lũy kế</span>
                  </div>
                </div>
              </div>

              {weeklyTrend.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Calendar className="w-6 h-6 text-slate-400 stroke-1" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Chưa có dữ liệu tiến độ theo đợt</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Biểu đồ tăng trưởng lũy kế sẽ tự động vẽ khi các đoàn xe thực địa triển khai thu thập phiếu tại các trường.
                  </p>
                </div>
              ) : (
                <div className="relative w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-48 md:h-56">
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Grid Horizontal Lines */}
                    {[0, Math.round(maxSurveys / 2), maxSurveys].map((val) => {
                      const y = svgHeight - paddingY - (val / maxSurveys) * chartHeight;
                      return (
                        <g key={val}>
                          <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                          <text x={paddingX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                            {val.toLocaleString()}
                          </text>
                        </g>
                      );
                    })}

                    {/* Filled Area */}
                    <path d={areaPath} fill="url(#areaGradient)" />

                    {/* Smooth Stroke Line */}
                    <path d={linePath} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Data Dots & Tooltip Triggers */}
                    {points.map((pt, idx) => (
                      <g
                        key={idx}
                        className="cursor-pointer group"
                        onMouseEnter={() => setHoveredTrend(idx)}
                        onMouseLeave={() => setHoveredTrend(null)}
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredTrend === idx ? 6 : 4}
                          fill="#ffffff"
                          stroke="#059669"
                          strokeWidth="2.5"
                          className="transition-all duration-200"
                        />
                        {/* Week Label */}
                        <text x={pt.x} y={svgHeight - 10} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500">
                          {pt.week}
                        </text>

                        {/* Hover Tooltip Box */}
                        {hoveredTrend === idx && (
                          <g>
                            <rect
                              x={pt.x - 55}
                              y={pt.y - 45}
                              width="110"
                              height="36"
                              rx="6"
                              fill="#0f172a"
                              className="shadow-lg"
                            />
                            <text x={pt.x} y={pt.y - 30} textAnchor="middle" fontSize="10" fill="#ffffff" fontWeight="bold">
                              {pt.cumulativeSurveys.toLocaleString()} phiếu
                            </text>
                            <text x={pt.x} y={pt.y - 18} textAnchor="middle" fontSize="8" fill="#94a3b8">
                              {pt.schools} trường đã thăm
                            </text>
                          </g>
                        )}
                      </g>
                    ))}
                  </svg>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="text-emerald-700 font-semibold">
                {weeklyTrend.length > 0 ? 'Đang ghi nhận tiến độ thực địa' : 'Sẵn sàng theo dõi đợt tuyển sinh'}
              </span>
              <span className="text-[11px] text-slate-400">Đồng bộ từ Database</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CỘT PHẢI (5 CỘT): CỘT CHUYẾN ĐI (CHIẾN DỊCH ĐANG TRIỂN KHAI VÀ GẦN NHẤT) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6 flex flex-col">
          {/* KHỐI 1 (TRÊN CÙNG): CHIẾN DỊCH ĐANG TRIỂN KHAI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header Khối */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Chiến Dịch Đang Triển Khai
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lộ trình và các đoàn xe đang vận hành thực tế
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                    activeCampaigns.length > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {activeCampaigns.length > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                    {activeCampaigns.length} đang chạy
                  </span>
                </div>
              </div>

              {/* Danh sách chiến dịch đang triển khai */}
              {activeCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3 text-emerald-600">
                    <Route className="w-6 h-6 stroke-1" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Chưa có chiến dịch nào đang triển khai</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Phân bổ nhân sự hoặc kích hoạt chuyến đi để theo dõi hành trình trực tiếp tại đây.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/campaigns')}
                    className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Phân bổ chiến dịch</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5 mt-4">
                  {activeCampaigns.map((camp: any) => {
                    const destCount = camp.destinations_count ?? camp.destinations?.length ?? 0;
                    const distKm = camp.estimated_distance_km ? `${camp.estimated_distance_km} km` : 'Tối ưu';
                    const leader = camp.leader_name || camp.team?.leader_name;

                    return (
                      <div
                        key={camp.id || camp._id}
                        onClick={() => navigate('/admin/campaigns')}
                        className="p-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/60 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group space-y-2.5"
                      >
                        {/* Row 1: Tên chiến dịch & Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                              {camp.name}
                            </h3>
                            {camp.trip_code && (
                              <span className="font-mono text-[10.5px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5">
                                Mã xe: {camp.trip_code}
                              </span>
                            )}
                          </div>
                          {getStatusBadge(camp.status)}
                        </div>

                        {/* Row 2: Thông tin hành trình & Trưởng đoàn */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-medium text-slate-700 truncate">{destCount} trường mục tiêu</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Route className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-medium text-slate-700 truncate">{distKm}</span>
                          </div>
                          {leader && (
                            <div className="col-span-2 flex items-center gap-1.5 text-slate-500 pt-1 border-t border-slate-100/80">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">Trưởng đoàn: <strong className="text-slate-700">{leader}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Row 3: Chi tiết & Thao tác */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {camp.start_date ? formatDate(camp.start_date) : 'Đang triển khai'}
                          </span>
                          <span className="text-blue-700 font-bold text-xs inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Xem lộ trình
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Khối Chiến Dịch Đang Triển Khai */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => navigate('/admin/campaigns')}
                className="text-blue-700 font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Điều phối toàn bộ đoàn xe</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-400">Cập nhật trực tiếp</span>
            </div>
          </div>

          {/* KHỐI 2 (Ở DƯỚI): CHIẾN DỊCH GẦN NHẤT */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header Khối */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Chiến Dịch Gần Nhất
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Danh sách kế hoạch tuyển sinh vừa tạo hoặc hoàn tất gần đây
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/admin/campaigns')}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 transition cursor-pointer"
                >
                  Xem tất cả
                </button>
              </div>

              {/* Danh sách chiến dịch gần nhất */}
              {recentCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5">
                    <Inbox className="w-5 h-5 text-slate-400 stroke-1" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Chưa có chiến dịch nào</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 mt-2">
                  {recentCampaigns.map((camp: any) => {
                    const destCount = camp.destinations_count ?? camp.destinations?.length ?? 0;
                    const distKm = camp.estimated_distance_km ? `${camp.estimated_distance_km} km` : 'Đang tính';
                    const dateDisplay = camp.created_at
                      ? formatDate(camp.created_at)
                      : (camp.start_date ? formatDate(camp.start_date) : '');

                    return (
                      <div
                        key={camp.id || camp._id}
                        onClick={() => navigate('/admin/campaigns')}
                        className="py-3 px-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                              {camp.name}
                            </span>
                            {getStatusBadge(camp.status)}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {destCount} trường
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Route className="w-3 h-3 text-slate-400" />
                              {distKm}
                            </span>
                            {dateDisplay && (
                              <>
                                <span>•</span>
                                <span>{dateDisplay}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Khối Chiến Dịch Gần Nhất */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                Hiển thị {recentCampaigns.length} chiến dịch gần nhất
              </span>
              <button
                type="button"
                onClick={() => navigate('/admin/campaigns')}
                className="text-xs font-bold text-[#0f3b7d] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Xem toàn bộ</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
