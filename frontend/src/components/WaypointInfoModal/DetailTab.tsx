import React from 'react';
import {
  School,
  MapPin,
  Navigation,
  ExternalLink,
  Phone,
  Globe,
  GraduationCap,
  Building2,
  Clock,
  StickyNote
} from 'lucide-react';
import type { Waypoint, WaypointDetail } from '../../types';

interface DetailTabProps {
  waypoint?: Waypoint;
  waypointId?: string;
  detail: WaypointDetail | undefined;
  isLoading: boolean;
  onUpdate?: () => void;
}

const parseSafeDate = (dateVal?: string | Date | null): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  const str = String(dateVal);
  const hasTimezone = str.endsWith('Z') || str.includes('+') || (str.includes('T') && str.lastIndexOf('-') > str.indexOf('T'));
  const normalized = hasTimezone ? str : `${str}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(str) : d;
};

export const DetailTab: React.FC<DetailTabProps> = ({ waypoint, detail, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold">Đang tải thông tin trường học...</p>
      </div>
    );
  }

  const hotlinePhone = detail?.principal_phone || detail?.representative_phone;
  const schoolName = waypoint?.name || 'Trường học';
  const schoolAddress = waypoint?.address;
  const lat = waypoint?.lat;
  const lng = waypoint?.lng;

  return (
    <div className="space-y-4 pb-6 h-[500px] overflow-y-auto pr-1">
      {/* Khối 1: Thông tin trường học & Hotline tuyển sinh */}
      <div className="bg-white border border-slate-200/80 rounded-[5px] p-4 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <School className="w-5 h-5 text-[#0f3b7d] shrink-0" />
              <h3 className="font-bold text-slate-900 text-base leading-snug">
                {schoolName}
              </h3>
            </div>
            {schoolAddress && (
              <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{schoolAddress}</span>
              </p>
            )}
          </div>

          {lat && lng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold transition shadow-xs shrink-0 cursor-pointer"
              title="Mở Google Maps chỉ đường"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Chỉ đường Google Maps</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          )}
        </div>

        {/* Thông tin Hotline & Website */}
        {(hotlinePhone || detail?.website) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
            {hotlinePhone && (
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-[5px] border border-slate-200/60">
                <Phone className="w-4 h-4 text-[#0f3b7d] shrink-0" />
                <span className="text-slate-500 font-medium">Hotline Tuyển sinh:</span>
                <strong className="text-slate-900 font-bold font-mono text-sm tracking-wide">
                  {hotlinePhone}
                </strong>
              </div>
            )}

            {detail?.website && (
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-[5px] border border-slate-200/60">
                <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-500 font-medium">Website:</span>
                <a
                  href={detail.website.startsWith('http') ? detail.website : `https://${detail.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline font-semibold truncate flex items-center gap-1"
                >
                  <span className="truncate">{detail.website}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Khối 2: Ban Giám Hiệu nhà trường (chỉ hiện khi có dữ liệu) */}
      {(detail?.principal_name || detail?.vice_principal_name) && (
        <div className="bg-white border border-slate-200/80 rounded-[5px] p-4 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
            <GraduationCap className="w-4 h-4 text-[#0f3b7d]" />
            <span>Ban Giám Hiệu Nhà Trường</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {detail.principal_name && (
              <div className="p-3 bg-slate-50 rounded-[5px] border border-slate-200/60">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Hiệu trưởng / Đại diện
                </span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {detail.principal_name}
                </p>
              </div>
            )}

            {detail.vice_principal_name && (
              <div className="p-3 bg-slate-50 rounded-[5px] border border-slate-200/60">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Phó hiệu trưởng
                </span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {detail.vice_principal_name}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Khối 3: Thống kê tuyển sinh từ trước tới nay (Counter Cache) */}
      <div className="bg-white border border-slate-200/80 rounded-[5px] p-4 shadow-xs space-y-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
          <Building2 className="w-4 h-4 text-[#0f3b7d]" />
          <span>Chỉ Số Thực Địa Tuyển Sinh</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50/60 rounded-[5px] border border-blue-100">
            <span className="text-[11px] font-bold text-blue-700 block mb-0.5 uppercase tracking-wider">
              🏫 Đã ghé qua
            </span>
            <div className="text-xl font-black text-[#0f3b7d]">
              {detail?.total_visits || 0} <span className="text-xs font-semibold text-blue-600">lần</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-[5px] border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-700 block mb-0.5 uppercase tracking-wider">
              🎫 Phiếu thu về
            </span>
            <div className="text-xl font-black text-emerald-800">
              {detail?.total_tickets || 0} <span className="text-xs font-semibold text-emerald-600">phiếu</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-[5px] border border-amber-100">
            <span className="text-[11px] font-bold text-amber-700 block mb-0.5 uppercase tracking-wider">
              🕒 Lần ghé gần nhất
            </span>
            <div className="text-xs font-bold text-amber-900 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                {(() => {
                  const d = parseSafeDate(detail?.last_visited_at);
                  return d
                    ? `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}, ${d.toLocaleDateString('vi-VN')}`
                    : 'Chưa có lượt ghé';
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Khối 4: Ghi chú & Lưu ý thực địa (nếu có) */}
      {(detail?.notes || detail?.admissions_info || detail?.description) && (
        <div className="space-y-3">
          {detail.notes && (
            <div className="bg-white border border-slate-200/80 rounded-[5px] p-4 shadow-xs space-y-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
                <StickyNote className="w-4 h-4 text-amber-600" />
                <span>Ghi Chú & Lưu Ý Thực Địa</span>
              </h3>
              <div className="p-3 bg-amber-50/40 rounded-[5px] border border-amber-200/60 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {detail.notes}
              </div>
            </div>
          )}

          {detail.admissions_info && (
            <div className="bg-white border border-slate-200/80 rounded-[5px] p-4 shadow-xs space-y-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Thông Tin Tuyển Sinh Của Trường</span>
              </h3>
              <div className="p-3 bg-emerald-50/40 rounded-[5px] border border-emerald-200/60 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {detail.admissions_info}
              </div>
            </div>
          )}

          {detail.description && (
            <div className="bg-white border border-slate-200/80 rounded-[5px] p-4 shadow-xs space-y-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
                <School className="w-4 h-4 text-indigo-600" />
                <span>Giới Thiệu Trường</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {detail.description}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
