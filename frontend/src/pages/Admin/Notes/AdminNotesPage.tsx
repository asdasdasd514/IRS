import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  StickyNote,
  Search,
  Download,
  Plus,
  Trash2,
  Edit3,
  School,
  Route,
  Clock,
  User,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { noteApi, campaignApi, tripApi } from '../../../services/api';
import type { FieldNote } from '../../../types';

export const AdminNotesPage: React.FC = () => {
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedTripId, setSelectedTripId] = useState('');

  // Modal create/edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<FieldNote | null>(null);
  const [formSchoolName, setFormSchoolName] = useState('');
  const [formTripId, setFormTripId] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAuthorName, setFormAuthorName] = useState('Cán bộ tuyển sinh');
  const [formError, setFormError] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch Danh sách chiến dịch & chuyến đi cho dropdown filter
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns-list-for-notes'],
    queryFn: () => campaignApi.getAll(),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips-list-for-notes'],
    queryFn: () => tripApi.getTrips(),
  });

  // Fetch thống kê tổng quan cố định (luôn giữ tổng toàn hệ thống, không thay đổi theo ô tìm kiếm)
  const { data: globalStatsData, refetch: refetchGlobalStats } = useQuery({
    queryKey: ['field-notes-global-stats'],
    queryFn: () => noteApi.getNotes({ limit: 1 }),
  });

  // Fetch danh sách ghi chú theo bộ lọc
  const {
    data: notesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'field-notes',
      selectedCampaignId,
      selectedTripId,
      searchTerm,
    ],
    queryFn: () =>
      noteApi.getNotes({
        campaign_id: selectedCampaignId || undefined,
        trip_id: selectedTripId || undefined,
        search: searchTerm.trim() || undefined,
        limit: 200,
      }),
    placeholderData: (previousData) => previousData,
  });

  const notesList = notesData?.items || [];
  const stats = globalStatsData?.stats || notesData?.stats || {
    total_notes: 0,
    total_schools: 0,
    total_trips: 0,
  };

  // Tự động gán author từ user session
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.full_name) setFormAuthorName(u.full_name);
        else if (u.username) setFormAuthorName(u.username);
      }
    } catch {
      // ignore
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Xử lý mở modal thêm mới
  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setFormSchoolName('');
    setFormTripId(trips.length > 0 ? trips[0].id : '');
    setFormContent('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Xử lý mở modal sửa
  const handleOpenEditModal = (note: FieldNote) => {
    setEditingNote(note);
    setFormSchoolName(note.school_name || '');
    setFormTripId(note.trip_id || '');
    setFormContent(note.content);
    setFormAuthorName(note.author_name || 'Cán bộ tuyển sinh');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Form Lưu / Sửa ghi chú
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) {
      setFormError('Vui lòng nhập nội dung ghi chú');
      return;
    }

    try {
      if (editingNote) {
        // Cập nhật
        await noteApi.updateNote(editingNote.id, {
          content: formContent.trim(),
          school_name: formSchoolName.trim() || undefined,
        });
        showToast('Đã cập nhật ghi chú thành công!');
      } else {
        // Tạo mới
        const selectedTripObj = trips.find((t: any) => t.id === formTripId);
        await noteApi.createNote({
          trip_id: formTripId || undefined,
          trip_name: selectedTripObj?.name,
          campaign_id: selectedTripObj?.campaign_id,
          school_name: formSchoolName.trim() || 'Điểm trường thực địa',
          content: formContent.trim(),
          author_name: formAuthorName,
        });
        showToast('Đã thêm ghi chú mới thành công!');
      }

      setIsModalOpen(false);
      refetch();
      refetchGlobalStats();
    } catch (err) {
      console.error('Error saving note:', err);
      setFormError('Lỗi khi lưu ghi chú, vui lòng kiểm tra lại');
    }
  };

  // Xóa ghi chú
  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) return;
    try {
      await noteApi.deleteNote(noteId);
      showToast('Đã xóa ghi chú thành công!');
      refetch();
      refetchGlobalStats();
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('Không thể xóa ghi chú');
    }
  };

  // Xuất file Excel
  const handleExportExcel = () => {
    const url = noteApi.getExportExcelUrl({
      trip_id: selectedTripId || undefined,
      campaign_id: selectedCampaignId || undefined,
      search: searchTerm.trim() || undefined,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[9999] bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-5 sm:p-6 rounded-lg border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-[#0f3b7d] rounded-lg border border-blue-100">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Quản Lý Ghi Chú Thực Địa
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Tổng hợp, tìm kiếm và theo dõi tất cả ghi chú, đánh giá từ các đợt công tác tuyển sinh
              </p>
            </div>
          </div>
        </div>

        {/* Nút tác vụ */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-[6px] text-xs font-bold shadow-2xs transition cursor-pointer"
            title="Xuất danh sách ra file Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0f3b7d] hover:bg-[#0c2f64] active:scale-[0.99] text-white rounded-[6px] text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm ghi chú</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#0f3b7d] flex items-center justify-center font-bold">
            <StickyNote className="w-5 h-5 text-[#0f3b7d]" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Tổng số ghi chú
            </span>
            <p className="text-2xl font-black text-slate-900 leading-tight">
              {stats.total_notes}{' '}
              <span className="text-xs font-normal text-slate-500">bản ghi</span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <School className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Điểm trường có nhận xét
            </span>
            <p className="text-2xl font-black text-emerald-700 leading-tight">
              {stats.total_schools}{' '}
              <span className="text-xs font-normal text-slate-500">trường</span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Route className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Đợt công tác ghi nhận
            </span>
            <p className="text-2xl font-black text-purple-700 leading-tight">
              {stats.total_trips}{' '}
              <span className="text-xs font-normal text-slate-500">chuyến đi</span>
            </p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tìm kiếm từ khóa */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo trường, nội dung, cán bộ..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-[6px] text-xs font-medium outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition"
            />
          </div>

          {/* Lọc theo Chiến dịch */}
          <div>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-[6px] text-xs font-medium outline-hidden focus:border-[#0f3b7d] transition cursor-pointer"
            >
              <option value="">Tất cả chiến dịch</option>
              {campaigns.map((c: any) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Chuyến đi */}
          <div>
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-[6px] text-xs font-medium outline-hidden focus:border-[#0f3b7d] transition cursor-pointer"
            >
              <option value="">Tất cả chuyến đi (Đợt)</option>
              {trips.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABLE DATA LIST */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                <th className="py-3 px-3 text-center w-12">STT</th>
                <th className="py-3 px-3 w-36">Thời Gian Ghi</th>
                <th className="py-3 px-3 w-56">Điểm Trường</th>
                <th className="py-3 px-3 w-48">Chuyến Đi / Đợt</th>
                <th className="py-3 px-3">Nội Dung Ghi Chú & Đánh Giá</th>
                <th className="py-3 px-3 w-32">Cán Bộ Ghi</th>
                <th className="py-3 px-3 text-center w-20">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-slate-300 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                    Đang tải danh sách ghi chú...
                  </td>
                </tr>
              ) : notesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <StickyNote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Không tìm thấy ghi chú nào phù hợp</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Thử điều chỉnh lại bộ lọc hoặc tạo thêm ghi chú mới.
                    </p>
                  </td>
                </tr>
              ) : (
                notesList.map((note, idx) => (
                  <tr key={note.id || idx} className="hover:bg-slate-50/80 transition group">
                    <td className="py-3 px-3 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div className="flex items-center gap-1 font-medium text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(note.created_at).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">
                        {note.school_name || 'Điểm thực địa'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <span className="font-medium text-[11px] block text-[#0f3b7d]">
                        {note.trip_name || 'Chuyến đi'}
                      </span>
                      {note.campaign_name && (
                        <span className="text-[10px] text-slate-400 block truncate">
                          {note.campaign_name}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-slate-800 leading-relaxed font-normal whitespace-pre-wrap max-w-xl">
                        {note.content}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      <div className="flex items-center gap-1 text-[11px]">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{note.author_name || 'Cán bộ'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(note)}
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-blue-700 transition cursor-pointer"
                          title="Sửa ghi chú"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Xóa ghi chú"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL THÊM / SỬA GHI CHÚ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#0f3b7d] to-[#1e58a8] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-300" />
                <h2 className="text-sm sm:text-base font-bold">
                  {editingNote ? 'Chỉnh Sửa Ghi Chú' : 'Thêm Ghi Chú Mới'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner */}
            {formError && (
              <div className="bg-red-50 text-red-700 border-b border-red-200 px-4 py-2 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên điểm trường học
                </label>
                <input
                  type="text"
                  value={formSchoolName}
                  onChange={(e) => setFormSchoolName(e.target.value)}
                  placeholder="Ví dụ: Trường Đại học Công Nghệ Đồng Nai..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-[6px] outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d]"
                />
              </div>

              {!editingNote && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gắn với Chuyến đi (Đợt công tác)
                  </label>
                  <select
                    value={formTripId}
                    onChange={(e) => setFormTripId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-[6px] outline-hidden cursor-pointer"
                  >
                    <option value="">Không gắn chuyến đi cụ thể</option>
                    {trips.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}


              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung ghi chú & đánh giá <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Nhập nội dung nhận xét, đánh giá thực địa..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-[6px] outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] resize-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cán bộ thực hiện ghi
                </label>
                <input
                  type="text"
                  value={formAuthorName}
                  onChange={(e) => setFormAuthorName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-[6px] text-slate-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-[6px] transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#0f3b7d] hover:bg-[#0c2f64] text-white rounded-[6px] shadow-xs transition cursor-pointer"
                >
                  {editingNote ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotesPage;
