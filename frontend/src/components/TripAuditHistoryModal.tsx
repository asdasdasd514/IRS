import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Clock,
  User as UserIcon,
  RefreshCw,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  Layers,
  History,
  AlertCircle,
  Search,
} from 'lucide-react';
import { logApi } from '../services/api';
import type { SystemLog } from '../types';

interface TripAuditHistoryModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  tripName?: string;
}

const parseApiDate = (dateStr?: string | Date | null): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  let str = String(dateStr).trim();
  if (!str) return null;
  // Gắn Z nếu chuỗi ISO chưa có múi giờ để JavaScript chuyển chính xác sang giờ địa phương
  if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str += 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const formatDateTime = (dateStr?: string | Date) => {
  const d = parseApiDate(dateStr);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${hours}:${minutes}:${seconds} - ${day}/${month}/${year}`;
};

const formatTimeOnly = (dateStr?: string | Date) => {
  const d = parseApiDate(dateStr);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
};

const getSubActionBadge = (action: string) => {
  switch (action) {
    case 'ADD_WAYPOINT':
      return { label: 'Thêm điểm', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PlusCircle };
    case 'UPDATE_WAYPOINT':
      return { label: 'Sửa điểm', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Edit3 };
    case 'DELETE_WAYPOINT':
      return { label: 'Xóa điểm', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Trash2 };
    case 'UPDATE_NAME':
      return { label: 'Đổi tên', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Edit3 };
    case 'UPDATE_STATUS':
      return { label: 'Trạng thái', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
    case 'CHECK_IN':
      return { label: 'Check-in', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: CheckCircle2 };
    case 'UNDO_CHECK_IN':
      return { label: 'Undo Check-in', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: RefreshCw };
    default:
      return { label: 'Thao tác', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: Clock };
  }
};

const highlightText = (text?: string, query?: string) => {
  if (!text) return '';
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded shadow-2xs">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const TripAuditHistoryModal: React.FC<TripAuditHistoryModalProps> = ({
  tripId,
  isOpen,
  onClose,
  tripName
}) => {
  const [search, setSearch] = useState('');
  const { data: logs = [], isLoading, isError, refetch } = useQuery<SystemLog[]>({
    queryKey: ['trip-audit-logs', tripId],
    queryFn: () => logApi.getTripLogs(tripId),
    enabled: isOpen && !!tripId,
    staleTime: 10000,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0f3b7d] flex items-center justify-center text-white shadow-inner">
              <History className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight flex items-center gap-2 text-white">
                Lịch sử chỉnh sửa & thao tác
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                {tripName ? `Chuyến đi: ${tripName}` : `Mã chuyến đi: ${tripId}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refetch()}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm thao tác */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm trong các thao tác, nội dung chi tiết..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {isLoading && (
            <div className="py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#0f3b7d] border-t-transparent" />
              <p className="text-sm font-medium text-slate-500 mt-3">Đang tải lịch sử phiên thao tác...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Không thể tải nhật ký chuyến đi</p>
                <p className="text-xs mt-0.5">Vui lòng thử lại sau.</p>
              </div>
            </div>
          )}

          {!isLoading && !isError && logs.length === 0 && (
            <div className="py-12 text-center bg-white rounded-lg border border-slate-200/80 p-8 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <History className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Chưa có lịch sử thao tác nào</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Mọi hành động thêm/sửa/xóa điểm dừng hoặc đổi tên lộ trình sẽ tự động được ghi nhận và gom nhóm tại đây.
              </p>
            </div>
          )}

          {!isLoading && !isError && logs.length > 0 && (() => {
            const q = search.trim().toLowerCase();
            const isSubMatch = (sub: any) => {
              if (!q) return false;
              return Boolean(
                sub.description?.toLowerCase().includes(q) ||
                sub.label?.toLowerCase().includes(q) ||
                sub.action?.toLowerCase().includes(q)
              );
            };

            const filteredLogs = logs.filter((parentLog) => {
              if (!q) return true;
              const titleMatch = parentLog.title?.toLowerCase().includes(q);
              const actorMatch = (
                parentLog.actor?.full_name?.toLowerCase().includes(q) ||
                parentLog.actor?.username?.toLowerCase().includes(q)
              );
              const anySubMatch = (parentLog.activities || []).some(isSubMatch);
              return titleMatch || actorMatch || anySubMatch;
            });

            if (filteredLogs.length === 0) {
              return (
                <div className="py-10 text-center bg-white rounded-lg border border-slate-200 p-6 text-slate-500 text-xs">
                  Không tìm thấy thao tác nào khớp với từ khóa <strong>"{search}"</strong>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredLogs.map((parentLog) => {
                  const activities = parentLog.activities || [];
                  const actorName = parentLog.actor?.full_name || parentLog.actor?.username || 'Hệ thống';
                  const actorRole = parentLog.actor?.role || 'User';

                  const matchingActivities = q ? activities.filter(isSubMatch) : [];
                  const matchingCount = matchingActivities.length;
                  const displayedActivities = (q && matchingCount > 0) ? matchingActivities : activities;

                  return (
                    <div
                      key={parentLog.id}
                      className="bg-white rounded-lg border border-slate-200/90 shadow-2xs overflow-hidden hover:border-slate-300 transition"
                    >
                      {/* Parent Session Header */}
                      <div className="p-3.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-[#0f3b7d] shrink-0" />
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {highlightText(parentLog.title || 'Phiên làm việc', search)}
                          </span>
                          <span className="text-[11px] font-semibold text-[#0f3b7d] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                            {parentLog.total_actions || activities.length} thao tác
                          </span>
                          {matchingCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
                              <Search className="w-2.5 h-2.5 text-amber-700" />
                              Khớp {matchingCount} thao tác
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            {highlightText(actorName, search)}
                            <span className="text-[10px] text-slate-400 font-normal">({actorRole})</span>
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDateTime(parentLog.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Timeline of Child Activities */}
                      <div className="p-3.5 bg-slate-50/40">
                        {q && matchingCount > 0 && activities.length > matchingCount && (
                          <div className="text-[11px] text-amber-800 font-medium mb-2 flex items-center gap-1">
                            <Search className="w-3 h-3 text-amber-600" />
                            <span>Hiển thị <strong>{matchingCount}</strong>/{activities.length} thao tác phù hợp</span>
                          </div>
                        )}
                        <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-3">
                          {displayedActivities.map((sub, idx) => {
                            const isMatch = isSubMatch(sub);
                            const badge = getSubActionBadge(sub.action);
                            const SubIcon = badge.icon;

                            return (
                              <div key={sub.id || idx} className="relative group">
                                {/* Dot */}
                                <div
                                  className={`absolute -left-[18px] top-1.5 w-2 h-2 rounded-full border-2 border-white transition ${
                                    isMatch ? 'bg-amber-500 ring-2 ring-amber-300 scale-110' : 'bg-slate-300 group-hover:bg-[#0f3b7d]'
                                  }`}
                                />

                                <div
                                  className={`p-2.5 rounded border transition flex items-start gap-2.5 ${
                                    isMatch
                                      ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200/60 shadow-xs'
                                      : 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300'
                                  }`}
                                >
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 mt-0.5 inline-flex items-center gap-1 ${badge.color}`}
                                  >
                                    <SubIcon className="w-2.5 h-2.5" />
                                    {badge.label}
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-800 leading-snug">
                                      {highlightText(sub.description, search)}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-slate-400">
                                        {formatTimeOnly(sub.timestamp)}
                                      </span>
                                      {isMatch && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                          Khớp từ khóa
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-2xs transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
