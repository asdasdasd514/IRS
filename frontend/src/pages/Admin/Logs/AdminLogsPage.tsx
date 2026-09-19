import { useState } from 'react';
import {
  UploadCloud,
  Trash2,
  Plus,
  Play,
  CheckCircle,
  HelpCircle,
  School,
  FileText
} from 'lucide-react';

interface MockFilePreview {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  duration?: string;
}

export function AdminLogsPage() {
  const [selectedTrip] = useState('Trường THPT Ngô Quyền - Đồng Nai');
  const [recordDate, setRecordDate] = useState('2026-09-12');
  const [notes, setNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Danh sách file minh chứng xem trước (mô phỏng chuẩn theo ảnh mẫu)
  const [previews, setPreviews] = useState<MockFilePreview[]>([
    {
      id: '1',
      name: 'tu-van-lop-12.jpg',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=500&auto=format&fit=crop&q=60',
    },
    {
      id: '2',
      name: 'tai-lieu-tuyen-sinh.jpg',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=500&auto=format&fit=crop&q=60',
    },
    {
      id: '3',
      name: 'video-hoi-truong.mp4',
      type: 'video',
      url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=500&auto=format&fit=crop&q=60',
      duration: '0:45',
    },
  ]);

  const handleClearAll = () => {
    setPreviews([]);
  };

  const handleRemoveItem = (id: string) => {
    setPreviews((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Title & Header (Theo ảnh mẫu) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Tải lên Minh chứng
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cập nhật hình ảnh, video hoạt động tư vấn tuyển sinh để lưu trữ hệ thống.
          </p>
        </div>

        <button
          title="Trợ giúp định dạng minh chứng"
          className="self-start sm:self-auto p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 transition"
        >
          <HelpCircle className="w-6 h-6" />
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[5px] flex items-center gap-3 text-emerald-800 text-sm animate-slide-up">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Đã lưu minh chứng hoạt động tuyển sinh thành công vào nhật ký chuyến đi!
          </span>
        </div>
      )}

      {/* Main Grid 2 Cột chuẩn theo ảnh */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (8 cols): Tập tin đính kèm & Bản xem trước */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Tập tin đính kèm */}
          <div className="bg-white rounded-[5px] border border-slate-200/80 p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Tập tin đính kèm
            </h2>

            <div className="border-2 border-dashed border-slate-300 hover:border-[#0f3b7d] rounded-[5px] p-8 sm:p-12 text-center transition-colors bg-slate-50/50 hover:bg-blue-50/20 cursor-pointer group">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-[#0f3b7d] flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-sm text-slate-700 font-medium">
                Kéo thả file vào đây hoặc{' '}
                <span className="text-[#0f3b7d] font-bold hover:underline">
                  Chọn file
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                Hỗ trợ các định dạng: JPG, PNG, MP4, MOV (Tối đa 50MB/file)
              </p>
            </div>
          </div>

          {/* Card 2: Bản xem trước */}
          <div className="bg-white rounded-[5px] border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Bản xem trước
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100/70 text-[#0f3b7d]">
                  {previews.length} file
                </span>
              </div>

              {previews.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa tất cả</span>
                </button>
              )}
            </div>

            {/* Grid ảnh / video preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {previews.map((file) => (
                <div
                  key={file.id}
                  className="group relative rounded-[5px] overflow-hidden aspect-4/3 border border-slate-200 bg-slate-100 shadow-xs"
                >
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Video Overlay duration */}
                  {file.type === 'video' && (
                    <>
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                        {file.duration || '0:30'}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-8 h-8 rounded-full bg-white/90 text-[#0f3b7d] flex items-center justify-center shadow-md">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Hover Delete Button */}
                  <button
                    onClick={() => handleRemoveItem(file.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Xóa file này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Box Thêm file */}
              <button
                type="button"
                className="rounded-[5px] border-2 border-dashed border-slate-300 hover:border-[#0f3b7d] flex flex-col items-center justify-center aspect-4/3 text-slate-500 hover:text-[#0f3b7d] transition-colors bg-slate-50/50 hover:bg-blue-50/30"
              >
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-xs font-semibold">Thêm file</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cột phải (4 cols): Thông tin chi tiết */}
        <div className="lg:col-span-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-[5px] border border-slate-200/80 p-6 shadow-xs space-y-5"
          >
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Thông tin chi tiết
            </h2>

            {/* Chuyến đi liên kết */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Chuyến đi liên kết
              </label>
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-[5px] flex items-start gap-2.5">
                <School className="w-4 h-4 text-[#0f3b7d] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-[#0f3b7d] leading-snug">
                    {selectedTrip}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đoàn công tác Tuyển sinh số 01
                  </p>
                </div>
              </div>
            </div>

            {/* Ngày ghi nhận */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Ngày ghi nhận
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition font-medium"
                  required
                />
              </div>
            </div>

            {/* Ghi chú minh chứng */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Ghi chú minh chứng <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập tóm tắt nội dung, kết quả hoạt động hoặc lưu ý quan trọng..."
                className="w-full p-3.5 text-xs bg-slate-50/50 border border-slate-300 rounded-[5px] focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] outline-none transition resize-none leading-relaxed"
                required
              />
            </div>

            {/* Action Buttons (Theo đúng mẫu ảnh) */}
            <div className="space-y-2.5 pt-2">
              <button
                type="submit"
                className="w-full bg-[#0f3b7d] hover:bg-[#0c2f64] text-white font-semibold py-2.5 px-4 rounded-[5px] transition duration-200 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Lưu minh chứng & tiếp tục</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNotes('');
                  setPreviews([]);
                }}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-[5px] border border-slate-300 transition duration-200 text-sm"
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
