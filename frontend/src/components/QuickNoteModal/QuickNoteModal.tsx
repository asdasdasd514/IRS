import React, { useState, useEffect } from 'react';
import {
  X,
  StickyNote,
  Send,
  CheckCircle2,
  Clock,
  School,
  List,
  PlusCircle,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { noteApi } from '../../services/api';
import type { Waypoint, FieldNote } from '../../types';

interface QuickNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip?: any;
  currentWaypoint?: Waypoint | null;
  allWaypoints?: Waypoint[];
  onNoteSaved?: () => void;
}

export const QuickNoteModal: React.FC<QuickNoteModalProps> = ({
  isOpen,
  onClose,
  trip,
  currentWaypoint,
  allWaypoints = [],
  onNoteSaved,
}) => {
  const [selectedWaypointId, setSelectedWaypointId] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('Cán bộ tuyển sinh');
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab view: 'create' hoặc 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [tripNotes, setTripNotes] = useState<FieldNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Lấy tên cán bộ từ auth user nếu có
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.full_name) setAuthorName(u.full_name);
        else if (u.username) setAuthorName(u.username);
      }
    } catch {
      // ignore
    }
  }, []);

  // Tự động set điểm dừng đang chọn
  useEffect(() => {
    if (isOpen) {
      if (currentWaypoint?.id) {
        setSelectedWaypointId(currentWaypoint.id);
      } else if (allWaypoints.length > 0) {
        setSelectedWaypointId(allWaypoints[0].id);
      }
      loadTripNotes();
      setErrorMsg(null);
    }
  }, [isOpen, currentWaypoint, allWaypoints]);

  const loadTripNotes = async () => {
    if (!trip?.id) return;
    try {
      setIsLoadingNotes(true);
      const res = await noteApi.getNotes({ trip_id: trip.id, limit: 50 });
      setTripNotes(res.items || []);
    } catch (err) {
      console.error('Failed to load trip notes:', err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung ghi chú');
      return;
    }

    const selectedWp = allWaypoints.find((w) => w.id === selectedWaypointId);
    const schoolName = selectedWp?.name || trip?.name || 'Điểm thực địa';
    const schoolId = selectedWp?.school_id || selectedWp?.id;

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await noteApi.createNote({
        trip_id: trip?.id,
        trip_name: trip?.name || 'Chuyến đi tuyển sinh',
        campaign_id: trip?.campaign_id,
        school_id: schoolId,
        school_name: schoolName,
        waypoint_id: selectedWp?.id,
        content: content.trim(),
        author_name: authorName,
      });

      setContent('');
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 2500);
      loadTripNotes();
      if (onNoteSaved) onNoteSaved();
    } catch (err: any) {
      console.error('Error saving note:', err);
      setErrorMsg('Không thể lưu ghi chú, vui lòng thử lại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) return;
    try {
      await noteApi.deleteNote(noteId);
      setTripNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (onNoteSaved) onNoteSaved();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0f3b7d] to-[#1e58a8] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-white backdrop-blur-xs">
              <StickyNote className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight">Ghi Chú Nhanh Thực Địa</h2>
              <p className="text-[11px] text-blue-100 font-medium">
                {trip?.name || 'Chuyến đi tuyển sinh'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'create'
                ? 'border-[#0f3b7d] text-[#0f3b7d] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Viết ghi chú mới</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#0f3b7d] text-[#0f3b7d] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Đã ghi trong đợt ({tripNotes.length})</span>
          </button>
        </div>

        {/* Toast thông báo thành công */}
        {successToast && (
          <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-4 py-2 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Đã lưu ghi chú thành công và đồng bộ vào báo cáo!</span>
          </div>
        )}

        {/* Thông báo lỗi */}
        {errorMsg && (
          <div className="bg-red-50 text-red-700 border-b border-red-200 px-4 py-2 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'create' ? (
            <form onSubmit={handleSaveNote} className="space-y-3.5">
              {/* Chọn điểm trường */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span>Điểm trường / Vị trí áp dụng</span>
                </label>
                <select
                  value={selectedWaypointId}
                  onChange={(e) => setSelectedWaypointId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-[6px] focus:bg-white focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] outline-hidden cursor-pointer"
                >
                  {allWaypoints.length > 0 ? (
                    allWaypoints.map((w, idx) => (
                      <option key={w.id || idx} value={w.id}>
                        {idx + 1}. {w.name} {w.is_visited ? '✓ (Đã ghé)' : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">{trip?.name || 'Toàn chuyến đi'}</option>
                  )}
                </select>
              </div>

              {/* Nội dung ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung ghi chú & Đánh giá thực địa <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Ví dụ: Ban Giám hiệu tiếp đón chu đáo, học sinh đặt nhiều câu hỏi về ngành CNTT & Học bổng; đã hẹn trao đổi thêm..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-[6px] focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] outline-hidden resize-none leading-relaxed"
                  autoFocus
                />
              </div>

              {/* Tên người ghi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Cán bộ thực hiện ghi:
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-[6px] transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold bg-[#0f3b7d] hover:bg-[#0c2f64] text-white rounded-[6px] shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu ghi chú'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Tab Lịch sử ghi chú của chuyến đi */
            <div className="space-y-3">
              {isLoadingNotes ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                  Đang tải danh sách ghi chú...
                </div>
              ) : tripNotes.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <StickyNote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold">Chưa có ghi chú nào trong chuyến đi này</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="mt-3 text-xs text-[#0f3b7d] font-bold hover:underline"
                  >
                    + Viết ghi chú đầu tiên
                  </button>
                </div>
              ) : (
                tripNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-[8px] space-y-1.5 hover:bg-white hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">
                          {note.school_name || 'Điểm trường'}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(note.created_at).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                        title="Xóa ghi chú"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">
                      {note.content}
                    </p>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Bởi: {note.author_name || 'Cán bộ tuyển sinh'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickNoteModal;
