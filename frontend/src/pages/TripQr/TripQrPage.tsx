import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  QrCode,
  MapPin,
  School,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  CheckCircle2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { tripApi } from '../../services/api';

export const TripQrPage: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Fetch dữ liệu chuyến đi
  const { data: trip, isLoading, error } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => tripApi.getTrip(tripId!),
    enabled: !!tripId,
    staleTime: 30000,
  });

  // Lọc tất cả các điểm dừng là trường học (SCHOOL)
  const schoolWaypoints = useMemo(() => {
    if (!trip) return [];
    const source = (trip.waypoints && trip.waypoints.length > 0)
      ? trip.waypoints
      : ((trip as any).destinations || []);

    return source.filter((w: any) => w.type === 'SCHOOL' || !w.type);
  }, [trip]);

  // Chọn trường học hiển thị
  const activeSchool = useMemo(() => {
    if (!schoolWaypoints || schoolWaypoints.length === 0) return null;
    if (selectedSchoolId) {
      const match = schoolWaypoints.find((w: any) => w.id === selectedSchoolId);
      if (match) return match;
    }
    // Ưu tiên trường chưa đi đầu tiên
    const nextUnvisited = schoolWaypoints.find((w: any) => !w.is_visited);
    return nextUnvisited || schoolWaypoints[0];
  }, [schoolWaypoints, selectedSchoolId]);

  // URL khảo sát online dành cho học sinh của trường được chọn
  const surveyUrl = useMemo(() => {
    if (!tripId || !activeSchool?.id) return '';
    return `${window.location.origin}/survey/${tripId}/${activeSchool.id}`;
  }, [tripId, activeSchool]);

  // Xử lý tải xuống mã QR (DUY NHẤT 1 NÚT TẢI XUỐNG theo yêu cầu)
  const handleDownloadQr = () => {
    const canvas = document.getElementById('dedicated-qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const safeName = (activeSchool?.name || 'Truong')
      .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
      .slice(0, 40);
    a.download = `QR_KhaoSat_${safeName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Toggle toàn màn hình kiosk
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-[#0f3b7d] rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Đang tải mã QR khảo sát...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 rounded-[5px] border border-slate-200 shadow-sm max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800 mb-2">Không tìm thấy chuyến đi</h2>
          <p className="text-xs text-slate-500 mb-4">
            Chuyến đi không tồn tại hoặc đã bị xóa khỏi hệ thống.
          </p>
          <button
            onClick={() => navigate('/staff/campaigns')}
            className="px-4 py-2 bg-[#0f3b7d] text-white rounded-[5px] text-xs font-bold hover:bg-[#0c2f64] transition"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(`/trips/${tripId}`)}
              className="p-2 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
              title="Quay lại bản đồ chuyến đi"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#0f3b7d] shrink-0" />
                <h1 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                  Mã QR Khảo Sát Tuyển Sinh
                </h1>
                {(trip as any)?.trip_code && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-[5px] bg-blue-50 text-[#0f3b7d] text-[11px] font-bold border border-blue-200">
                    {(trip as any).trip_code}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                Chuyến đi: <span className="font-semibold text-slate-700">{trip.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-[5px] border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer hidden sm:flex items-center gap-1.5"
              title="Toàn màn hình (Chế độ Standee bàn tư vấn)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/trips/${tripId}`)}
              className="px-3.5 py-2 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <MapIcon className="w-4 h-4" />
              <span>Trở về bản đồ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col items-center justify-center">
        {schoolWaypoints.length === 0 ? (
          <div className="bg-white rounded-[5px] border border-slate-200 p-8 text-center max-w-md w-full shadow-sm">
            <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 mb-1">Chưa có điểm trường</h3>
            <p className="text-xs text-slate-500 mb-4">
              Lộ trình này chưa được phân bổ điểm dừng trường học (SCHOOL).
            </p>
            <button
              onClick={() => navigate(`/trips/${tripId}`)}
              className="px-4 py-2 bg-[#0f3b7d] text-white rounded-[5px] text-xs font-bold hover:bg-[#0c2f64] transition"
            >
              Xem lộ trình trên bản đồ
            </button>
          </div>
        ) : (
          <div className="w-full max-w-xl flex flex-col items-center">
            {/* Menu Dropdown Chọn điểm trường */}
            {schoolWaypoints.length > 1 && (
              <div className="w-full bg-white p-3.5 rounded-[5px] border border-slate-200 shadow-xs mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="school-dropdown"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <School className="w-3.5 h-3.5 text-[#0f3b7d]" />
                    Chọn điểm trường ({schoolWaypoints.length} trường):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Bấm để đổi mã QR
                  </span>
                </div>
                <div className="relative">
                  <select
                    id="school-dropdown"
                    value={activeSchool?.id || ''}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full appearance-none bg-slate-50 hover:bg-slate-100/70 border border-slate-300 rounded-[5px] px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition cursor-pointer"
                  >
                    {schoolWaypoints.map((w: any, idx: number) => (
                      <option key={w.id || idx} value={w.id}>
                        {idx + 1}. {w.name} {w.is_visited ? '(Đã check-in)' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Thẻ hiển thị Mã QR Trung Tâm */}
            <div
              ref={qrRef}
              className="w-full bg-white rounded-[5px] border border-slate-200 shadow-md p-6 sm:p-8 flex flex-col items-center text-center relative"
            >
              {/* Badge Thông tin trường được chọn */}
              <div className="w-full bg-blue-50/70 border border-blue-100 rounded-[5px] p-3 mb-6 text-center">
                <div className="text-sm sm:text-base font-bold text-[#0f3b7d] truncate">
                  {activeSchool?.name || 'Điểm trường'}
                </div>
                {activeSchool?.address && (
                  <div className="text-xs text-slate-600 flex items-center justify-center gap-1 mt-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{activeSchool.address}</span>
                  </div>
                )}
                {activeSchool?.is_visited && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-[5px] mt-2 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Đã hoàn thành check-in tại trường này
                  </span>
                )}
              </div>

              {/* KHUNG MÃ QR VECTOR SIÊU RÕ - ĐEN TRẮNG TIÊU CHUẨN (KHÔNG LOGO, QUÉT NHANH NHẤT) */}
              <div className="bg-white p-5 sm:p-6 rounded-[5px] border-2 border-slate-200 shadow-md inline-block">
                <QRCodeCanvas
                  id="dedicated-qr-canvas"
                  value={surveyUrl}
                  size={320}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Đường dẫn & Nút xem thử Form */}
              <div className="mt-4 flex items-center justify-center gap-2 max-w-full">
                <span className="font-mono bg-slate-100 px-3 py-1.5 rounded-[5px] text-[11px] sm:text-xs text-slate-600 border border-slate-200 truncate max-w-xs sm:max-w-md">
                  {surveyUrl}
                </span>
                <a
                  href={surveyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-[5px] hover:bg-blue-50 text-[#0f3b7d] transition shrink-0"
                  title="Mở xem thử giao diện học sinh quét"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* DUY NHẤT 1 NÚT TẢI XUỐNG THEO ĐÚNG YÊU CẦU NGƯỜI DÙNG */}
              <div className="mt-6 w-full max-w-xs">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="w-full py-3 px-5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải xuống mã QR</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TripQrPage;
