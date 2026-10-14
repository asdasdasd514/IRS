import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  StickyNote,
  Search,
  Plus,
  Trash2,
  Edit3,
  Route,
  Clock,
  User,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { noteApi, campaignApi, tripApi, schoolApi } from '../../../services/api';
import type { FieldNote } from '../../../types';

export const FIELD_NOTE_TAGS = [
  { label: '📝 Ghi chú', value: 'Ghi chú', badgeColor: 'bg-blue-50 text-blue-800 border-blue-300' },
  { label: '🌟 Tiềm năng', value: 'Tiềm năng', badgeColor: 'bg-amber-50 text-amber-800 border-amber-300' },
  { label: '⚠️ Lưu ý', value: 'Lưu ý', badgeColor: 'bg-rose-50 text-rose-800 border-rose-300' },
];

const getTagBadgeStyle = (category?: string) => {
  if (!category) return 'bg-blue-50 text-blue-800 border-blue-200';
  const c = category.toLowerCase();
  if (c.includes('tiềm năng')) return 'bg-amber-50 text-amber-800 border-amber-300';
  if (c.includes('lưu ý')) return 'bg-rose-50 text-rose-800 border-rose-300';
  return 'bg-blue-50 text-blue-800 border-blue-300';
};

export const AdminNotesPage: React.FC = () => {
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  // Modal create/edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<FieldNote | null>(null);
  const [formSchoolName, setFormSchoolName] = useState('');
  const [formCategory, setFormCategory] = useState('Ghi chú');
  const [formTripId, setFormTripId] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAuthorName, setFormAuthorName] = useState('Cán bộ tuyển sinh');
  const [formError, setFormError] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch Danh sách trường học cho dropdown filter
  const { data: schools = [] } = useQuery({
    queryKey: ['schools-list-for-notes'],
    queryFn: () => schoolApi.getAll(),
  });

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
      selectedSchoolId,
      selectedCategory,
      selectedCampaignId,
      searchTerm,
    ],
    queryFn: () =>
      noteApi.getNotes({
        school_id: selectedSchoolId || undefined,
        category: selectedCategory || undefined,
        campaign_id: selectedCampaignId || undefined,
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
    setFormCategory('Ghi chú');
    setFormTripId(trips.length > 0 ? trips[0].id : '');
    setFormContent('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Xử lý mở modal sửa
  const handleOpenEditModal = (note: FieldNote) => {
    setEditingNote(note);
    setFormSchoolName(note.school_name || '');
    setFormCategory(note.category || 'Ghi chú');
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
          category: formCategory,
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
          category: formCategory,
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


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in pb-16">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[9999] bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[5px] bg-[#0f3b7d] text-white flex items-center justify-center shadow-xs">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Ghi Chú Thực Địa
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Tổng hợp, phân loại và theo dõi tất cả đánh giá thực địa từ các đợt công tác tuyển sinh
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              refetch();
              refetchGlobalStats();
            }}
            disabled={isLoading}
            className="p-2.5 rounded-[5px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0f3b7d]' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm ghi chú</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Tổng số ghi chú */}
        <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-[5px] bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0">
            <StickyNote className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tổng số ghi chú
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {stats.total_notes.toLocaleString('vi-VN')}
            </div>
            <span className="text-[11px] text-slate-500">Đánh giá & phản hồi thực tế</span>
          </div>
        </div>

        {/* Card 2: Điểm trường có nhận xét */}
        <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-[5px] bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Điểm trường có nhận xét
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {stats.total_schools.toLocaleString('vi-VN')}
            </div>
            <span className="text-[11px] text-slate-500">Các trường đã có dữ liệu trao đổi</span>
          </div>
        </div>

        {/* Card 3: Đợt công tác ghi nhận */}
        <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-[5px] bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Route className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Đợt công tác ghi nhận
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {stats.total_trips.toLocaleString('vi-VN')}
            </div>
            <span className="text-[11px] text-slate-500">Từ các đợt tuyển sinh thực địa</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tìm kiếm từ khóa */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo nội dung, cán bộ..."
              className="w-full pl-9 pr-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0f3b7d] transition bg-white"
            />
          </div>

          {/* Lọc theo Điểm trường */}
          <div>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:border-[#0f3b7d] transition cursor-pointer"
            >
              <option value="">Tất cả điểm trường ({schools.length})</option>
              {schools.map((s: any) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Chiến dịch */}
          <div>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:border-[#0f3b7d] transition cursor-pointer"
            >
              <option value="">Tất cả chiến dịch ({campaigns.length})</option>
              {campaigns.map((c: any) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Phân loại */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:border-[#0f3b7d] transition cursor-pointer"
            >
              <option value="">Tất cả phân loại</option>
              {FIELD_NOTE_TAGS.map((tag) => (
                <option key={tag.value} value={tag.value}>
                  {tag.label}
                </option>
              ))}
            </select>

            {(selectedSchoolId || selectedCategory || selectedCampaignId || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSchoolId('');
                  setSelectedCategory('');
                  setSelectedCampaignId('');
                  setSearchTerm('');
                }}
                title="Xóa tất cả bộ lọc"
                className="px-2.5 py-2 bg-red-50 text-red-600 border border-red-200 rounded-[5px] text-xs font-bold hover:bg-red-100 transition whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            )}
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
                <th className="py-3 px-3 w-52">Điểm Trường</th>
                <th className="py-3 px-3 w-40">Phân Loại / Tag</th>
                <th className="py-3 px-3 w-44">Chuyến Đi / Đợt</th>
                <th className="py-3 px-3">Nội Dung Ghi Chú & Đánh Giá</th>
                <th className="py-3 px-3 w-32">Cán Bộ Ghi</th>
                <th className="py-3 px-3 text-center w-20">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-slate-300 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                    Đang tải danh sách ghi chú...
                  </td>
                </tr>
              ) : notesList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
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
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getTagBadgeStyle(
                          note.category
                        )}`}
                      >
                        {note.category || 'Ghi chú'}
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

              {/* Chọn Tag Phân loại */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Phân loại & Đánh giá:</span>
                  <span className="text-[11px] font-bold text-[#0f3b7d] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    {formCategory}
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FIELD_NOTE_TAGS.map((tag) => {
                    const isSelected = formCategory === tag.value;
                    return (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => setFormCategory(tag.value)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#0f3b7d] text-white border-[#0f3b7d] shadow-xs ring-2 ring-offset-1 ring-[#0f3b7d]'
                            : `${tag.badgeColor} hover:brightness-95`
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>

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
