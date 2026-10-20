import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Clock,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  Layers,
  MapPin,
} from 'lucide-react';
import { logApi, authApi } from '../../../services/api';
import type { SystemLog, User } from '../../../types';

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

const formatLogTime = (dateStr?: string | Date) => {
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

const formatSubTime = (dateStr?: string | Date) => {
  const d = parseApiDate(dateStr);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
};

// Helper làm nổi bật từ khóa tìm kiếm (kể cả trong thao tác con)
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

export function AdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [showOnlyMatches, setShowOnlyMatches] = useState<Record<string, boolean>>({});

  // Danh sách người dùng để lọc
  const [users, setUsers] = useState<User[]>([]);

  // Tải danh sách người dùng cho dropdown lọc
  useEffect(() => {
    authApi.listUsers()
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error fetching users for filter:', err));
  }, []);

  // Tải dữ liệu nhật ký hệ thống
  const fetchLogs = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params: any = {
        limit: 100,
        skip: 0,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedUserId) params.user_id = selectedUserId;

      const res = await logApi.getLogs(params);
      setLogs(res.items || []);
    } catch (err) {
      console.error('Error loading system logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedUserId]);

  // Gom nhóm các logs theo [Ngày + Module nghiệp vụ (action_type / trip_id)]
  const groupedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    const map = new Map<string, any>();

    logs.forEach((log) => {
      const d = parseApiDate(log.created_at || log.updated_at);
      const dateKey = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : 'unknown_date';

      // Khóa gom nhóm: Ngày + Module nghiệp vụ (chiến dịch, trường học, tài khoản, chuyến đi...)
      const moduleKey = log.trip_id || log.action_type || log.title || 'GENERAL';
      const groupKey = `${dateKey}__${moduleKey}`;

      // Chuẩn hóa và đính kèm thông tin actor vào từng sub-activity
      const logActivities = (log.activities || []).map((act: any) => ({
        ...act,
        actor: act.actor || log.actor,
      }));

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          ...log,
          id: groupKey, // Khóa định danh duy nhất cho thẻ gom nhóm
          groupKey,
          dateKey,
          activities: [...logActivities],
          actors: log.actor ? [log.actor] : [],
          earliest_at: log.created_at,
          latest_at: log.updated_at || log.created_at,
        });
      } else {
        const existing = map.get(groupKey);
        existing.activities.push(...logActivities);

        if (log.actor && !existing.actors.some((a: any) => a.user_id === log.actor?.user_id)) {
          existing.actors.push(log.actor);
        }

        const existingLatest = parseApiDate(existing.latest_at)?.getTime() || 0;
        const currentLatest = parseApiDate(log.updated_at || log.created_at)?.getTime() || 0;
        if (currentLatest > existingLatest) {
          existing.latest_at = log.updated_at || log.created_at;
        }

        const existingEarliest = parseApiDate(existing.earliest_at)?.getTime() || Infinity;
        const currentEarliest = parseApiDate(log.created_at)?.getTime() || Infinity;
        if (currentEarliest < existingEarliest) {
          existing.earliest_at = log.created_at;
        }
      }
    });

    const result = Array.from(map.values());

    // Sắp xếp các thao tác con bên trong: Mới nhất lên trước
    result.forEach((group) => {
      // Loại bỏ trùng lặp sub-activity nếu có cùng id
      const seenIds = new Set<string>();
      group.activities = group.activities.filter((act: any) => {
        if (!act.id) return true;
        if (seenIds.has(act.id)) return false;
        seenIds.add(act.id);
        return true;
      });

      group.activities.sort((a: any, b: any) => {
        const timeA = parseApiDate(a.timestamp)?.getTime() || 0;
        const timeB = parseApiDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
      });
      group.total_actions = group.activities.length;
    });

    // Sắp xếp các thẻ nhóm: Thẻ có thao tác mới nhất lên trên cùng
    result.sort((a, b) => {
      const timeA = parseApiDate(a.latest_at)?.getTime() || 0;
      const timeB = parseApiDate(b.latest_at)?.getTime() || 0;
      return timeB - timeA;
    });

    return result;
  }, [logs]);

  // Tự động mở nhóm đầu tiên hoặc tất cả khi tìm kiếm
  useEffect(() => {
    if (search.trim()) {
      const allMatches: Record<string, boolean> = {};
      groupedLogs.forEach((item) => {
        allMatches[item.id] = true;
      });
      setExpandedLogIds(allMatches);
    } else if (groupedLogs.length > 0) {
      setExpandedLogIds((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [groupedLogs[0].id]: true };
        }
        return prev;
      });
    }
  }, [search, groupedLogs]);

  const totalActivitiesCount = useMemo(() => {
    return groupedLogs.reduce((acc, g) => acc + (g.activities?.length || 0), 0);
  }, [groupedLogs]);

  const toggleExpand = (logId: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    groupedLogs.forEach((l) => { all[l.id] = true; });
    setExpandedLogIds(all);
  };

  const collapseAll = () => {
    setExpandedLogIds({});
  };

  // Helper lấy icon và style cho Log Cha
  const getSessionBadge = (actionType: string) => {
    switch (actionType) {
      case 'AUTH_SESSION':
        return {
          icon: UserIcon,
          label: 'Đăng nhập & Phiên',
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          dot: 'bg-purple-600',
        };
      case 'USER_SESSION':
        return {
          icon: UserIcon,
          label: 'Quản lý tài khoản',
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          dot: 'bg-indigo-600',
        };
      case 'LOCATION_SESSION':
      case 'SCHOOL_SESSION':
        return {
          icon: MapPin,
          label: 'Quản lý địa điểm',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-600',
        };
      case 'CAMPAIGN_SESSION':
        return {
          icon: Layers,
          label: 'Quản lý chiến dịch',
          bg: 'bg-sky-50 text-sky-800 border-sky-200',
          dot: 'bg-sky-600',
        };
      case 'TRIP_EDIT_SESSION':
        return {
          icon: Edit3,
          label: 'Chỉnh sửa lộ trình',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'CHECKIN_SESSION':
        return {
          icon: CheckCircle2,
          label: 'Check-in thực địa',
          bg: 'bg-teal-50 text-teal-800 border-teal-200',
          dot: 'bg-teal-500',
        };
      case 'ALLOCATION_SESSION':
        return {
          icon: Layers,
          label: 'Phân bổ nhân sự',
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-600',
        };
      default:
        return {
          icon: ClipboardList,
          label: 'Hoạt động',
          bg: 'bg-slate-50 text-slate-800 border-slate-200',
          dot: 'bg-slate-500',
        };
    }
  };

  // Helper lấy badge cho hành động con
  const getSubActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
        return {
          icon: CheckCircle2,
          label: 'Đăng nhập',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
        };
      case 'CREATE_USER':
        return {
          icon: PlusCircle,
          label: 'Tạo tài khoản',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
      case 'UPDATE_USER':
        return {
          icon: Edit3,
          label: 'Sửa tài khoản',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'DELETE_USER':
        return {
          icon: Trash2,
          label: 'Xóa tài khoản',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'CREATE_SCHOOL':
      case 'CREATE_LOCATION':
        return {
          icon: PlusCircle,
          label: 'Thêm địa điểm',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'UPDATE_SCHOOL':
      case 'UPDATE_LOCATION':
        return {
          icon: Edit3,
          label: 'Sửa địa điểm',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'DELETE_SCHOOL':
      case 'DELETE_LOCATION':
        return {
          icon: Trash2,
          label: 'Xóa địa điểm',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'UPLOAD_IMAGE':
        return {
          icon: PlusCircle,
          label: 'Tải ảnh',
          color: 'bg-teal-100 text-teal-800 border-teal-200',
        };
      case 'CREATE_CAMPAIGN':
        return {
          icon: PlusCircle,
          label: 'Tạo chiến dịch',
          color: 'bg-sky-100 text-sky-800 border-sky-200',
        };
      case 'UPDATE_CAMPAIGN':
        return {
          icon: Edit3,
          label: 'Sửa chiến dịch',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'DELETE_CAMPAIGN':
        return {
          icon: Trash2,
          label: 'Xóa chiến dịch',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'DEPLOY_CAMPAIGN':
        return {
          icon: CheckCircle2,
          label: 'Triển khai',
          color: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'UPDATE_NAME':
        return {
          icon: Edit3,
          label: 'Đổi tên',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'ADD_WAYPOINT':
        return {
          icon: PlusCircle,
          label: 'Thêm điểm',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'UPDATE_WAYPOINT':
        return {
          icon: Edit3,
          label: 'Sửa điểm',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'DELETE_WAYPOINT':
        return {
          icon: Trash2,
          label: 'Xóa điểm',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'CHECK_IN':
        return {
          icon: CheckCircle2,
          label: 'Check-in',
          color: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'UNDO_CHECK_IN':
        return {
          icon: RefreshCw,
          label: 'Hoàn tác',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
        };
      default:
        return {
          icon: Clock,
          label: 'Thao tác',
          color: 'bg-slate-100 text-slate-800 border-slate-200',
        };
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in pb-12">
      {/* Bộ lọc & Tìm kiếm (kèm nút Làm mới) */}
      <div className="bg-white p-4 rounded-[5px] border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Ô Tìm kiếm */}
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo thao tác con, nội dung, người dùng, chuyến đi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-[5px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden transition"
            />
          </div>

          {/* Lọc theo Người dùng */}
          <div className="md:col-span-3">
            <select
              aria-label="Lọc theo người dùng"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-[5px] bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden transition cursor-pointer"
            >
              <option value="">▼ Tất cả người dùng</option>
              {users.map((u) => {
                const uid = u.id || (u as any)._id;
                const name = u.full_name || u.username;
                const roleLabel = u.role === 'admin' ? 'Admin' : 'Cán bộ';
                return (
                  <option key={uid} value={uid}>
                    {name} ({roleLabel})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Nút Làm mới */}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="w-full px-3 py-2 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
              title="Làm mới dữ liệu nhật ký"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        {/* Nút Mở rộng / Thu gọn tất cả */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Hiển thị <strong>{groupedLogs.length}</strong> chuyên mục thao tác (<strong>{totalActivitiesCount}</strong> thao tác)
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={expandAll}
              className="text-[#0f3b7d] hover:underline font-bold cursor-pointer"
            >
              Mở rộng tất cả
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-slate-600 hover:underline font-bold cursor-pointer"
            >
              Thu gọn tất cả
            </button>
          </div>
        </div>
      </div>

      {/* Danh sách Nhật ký (Mô hình Gom nhóm theo Ngày & Chuyên mục) */}
      {loading ? (
        <div className="p-12 bg-white rounded-[5px] border border-slate-200 flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-3 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold">Đang tải nhật ký hệ thống...</p>
        </div>
      ) : groupedLogs.length === 0 ? (
        <div className="p-12 bg-white rounded-[5px] border border-slate-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Chưa ghi nhận nhật ký nào</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Khi cán bộ hoặc quản trị viên thao tác trong hệ thống (đăng nhập, chỉnh sửa chuyến đi, check-in thực địa), các hoạt động sẽ tự động được ghi nhận tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedLogs.map((sessionLog) => {
            const isExpanded = Boolean(expandedLogIds[sessionLog.id]);
            const badge = getSessionBadge(sessionLog.action_type);
            const BadgeIcon = badge.icon;
            const activities = sessionLog.activities || [];
            const isSystem = sessionLog.category === 'SYSTEM' || !sessionLog.trip_id;

            const q = search.trim().toLowerCase();
            const isSubMatch = (sub: any) => {
              if (!q) return false;
              return Boolean(
                sub.description?.toLowerCase().includes(q) ||
                sub.label?.toLowerCase().includes(q) ||
                sub.action?.toLowerCase().includes(q)
              );
            };

            const matchingActivities = q ? activities.filter(isSubMatch) : [];
            const matchingCount = matchingActivities.length;
            const hasQuery = Boolean(q);
            const isFiltered = showOnlyMatches[sessionLog.id] ?? (hasQuery && matchingCount > 0 && matchingCount < activities.length);
            const displayedActivities = (hasQuery && isFiltered && matchingCount > 0)
              ? matchingActivities
              : activities;

            return (
              <div
                key={sessionLog.id}
                className="bg-white rounded-[5px] border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200"
              >
                {/* DÒNG LOG CHA (Header Cấp Cao) */}
                <div
                  onClick={() => toggleExpand(sessionLog.id)}
                  className="p-4 cursor-pointer hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Icon phân loại phiên */}
                    <div className={`w-9 h-9 rounded-[5px] flex items-center justify-center shrink-0 border ${badge.bg}`}>
                      <BadgeIcon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {highlightText(sessionLog.title, search)}
                          {sessionLog.trip_name && !isSystem && (
                            <span className="text-slate-700 font-semibold"> • {highlightText(sessionLog.trip_name, search)}</span>
                          )}
                        </h3>
                        {matchingCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
                            <Search className="w-2.5 h-2.5 text-amber-700" />
                            Khớp {matchingCount} thao tác
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                        {/* Người thực hiện */}
                        <div className="flex items-center gap-1 font-medium text-slate-700">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{highlightText(sessionLog.actor?.full_name || sessionLog.actor?.username || 'Hệ thống', search)}</span>
                          {sessionLog.actor?.role === 'admin' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-extrabold">
                              Admin
                            </span>
                          )}
                          {sessionLog.actors && sessionLog.actors.length > 1 && (
                            <span className="text-[10px] text-slate-500 font-normal">
                              (+{sessionLog.actors.length - 1} người khác)
                            </span>
                          )}
                        </div>

                        {/* Thời gian thực hiện */}
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatLogTime(sessionLog.latest_at || sessionLog.updated_at || sessionLog.created_at)}</span>
                        </div>

                        {/* Tổng số thao tác */}
                        <div className="text-slate-500 font-semibold">
                          <span>({activities.length} thao tác trong ngày)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nút bấm mở rộng */}
                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[11px] font-bold text-[#0f3b7d] hover:underline flex items-center gap-1">
                      {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* DANH SÁCH HÀNH ĐỘNG CON (Expanded Details Timeline) */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2.5 border-t border-slate-100 bg-slate-50/50 space-y-2.5">
                    {/* Banner hỗ trợ tìm kiếm thao tác con */}
                    {hasQuery && matchingCount > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/90 border border-amber-200/90 rounded-[5px] px-3 py-1.5 text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 text-amber-900 text-[11px] font-semibold">
                          <Search className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Tìm thấy <strong>{matchingCount}</strong> thao tác phù hợp với từ khóa
                            {isFiltered && activities.length > matchingCount && (
                              <span className="text-amber-700 font-normal"> (ẩn {activities.length - matchingCount} thao tác khác để dễ xem)</span>
                            )}
                          </span>
                        </div>
                        {activities.length > matchingCount && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowOnlyMatches((prev) => ({
                                ...prev,
                                [sessionLog.id]: !isFiltered,
                              }));
                            }}
                            className="px-2.5 py-1 rounded-[4px] bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold transition cursor-pointer shadow-2xs shrink-0"
                          >
                            {isFiltered ? `Hiện toàn bộ (${activities.length} thao tác)` : `Chỉ xem ${matchingCount} thao tác khớp`}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Chi tiết các thao tác trong ngày ({displayedActivities.length}/{activities.length})
                      </p>
                    </div>

                    <div className="space-y-2 border-l-2 border-slate-200 ml-2.5 pl-3">
                      {displayedActivities.map((sub: any, idx: number) => {
                        const isMatch = isSubMatch(sub);
                        const subBadge = getSubActionBadge(sub.action);
                        const SubIcon = subBadge.icon;

                        return (
                          <div key={sub.id || idx} className="relative group">
                            {/* Dot timeline */}
                            <div
                              className={`absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white transition ${
                                isMatch
                                  ? 'bg-amber-500 ring-2 ring-amber-300 scale-110'
                                  : 'bg-slate-300 group-hover:bg-[#0f3b7d]'
                              }`}
                            />

                            <div
                              className={`p-2.5 rounded-[4px] border transition flex items-start gap-2.5 ${
                                isMatch
                                  ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200/60 shadow-xs'
                                  : 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300'
                              }`}
                            >
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 mt-0.5 inline-flex items-center gap-1 ${subBadge.color}`}
                              >
                                <SubIcon className="w-2.5 h-2.5" />
                                {subBadge.label}
                              </span>

                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 leading-snug">
                                  {highlightText(sub.description, search)}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-400">
                                    Lúc {formatSubTime(sub.timestamp)}
                                  </span>
                                  {sub.actor && sessionLog.actors && sessionLog.actors.length > 1 && (
                                    <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                                      {sub.actor.full_name || sub.actor.username}
                                    </span>
                                  )}
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminLogsPage;
