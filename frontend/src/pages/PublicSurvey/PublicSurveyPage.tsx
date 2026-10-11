import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  School,
  GraduationCap,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Send,
  Loader2
} from 'lucide-react';
import { surveyApi } from '../../services/api';

export const PublicSurveyPage: React.FC = () => {
  const { tripId, waypointId } = useParams<{ tripId: string; waypointId: string }>();

  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('');
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [phoneError, setPhoneError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 1. Fetch thông tin trường và cấu hình form
  const {
    data: surveyInfo,
    isLoading,
    error
  } = useQuery({
    queryKey: ['public-survey', tripId, waypointId],
    queryFn: () => surveyApi.getPublicSurveyInfo(tripId!, waypointId!),
    enabled: !!tripId && !!waypointId,
    retry: 1,
  });

  // Tự động cuộn lên đầu trang khi tải
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const school = surveyInfo?.school;
  const config = surveyInfo?.survey_config;
  const majorsList: string[] = config?.majors || [];
  const fieldsEnabled = config?.fields_enabled || {
    student_name: true,
    phone: true,
    grade: true,
    notes: true
  };

  // Toggle chọn ngành
  const handleToggleMajor = (major: string) => {
    if (selectedMajors.includes(major)) {
      setSelectedMajors(selectedMajors.filter((m) => m !== major));
    } else {
      setSelectedMajors([...selectedMajors, major]);
    }
  };

  // 2. Mutation nộp phiếu
  const submitMutation = useMutation({
    mutationFn: () =>
      surveyApi.submitPublicSurvey({
        trip_id: tripId!,
        waypoint_id: waypointId!,
        student_name: studentName.trim(),
        phone: phone.trim(),
        grade: grade.trim(),
        interested_majors: selectedMajors,
        notes: notes.trim(),
      }),
    onSuccess: () => {
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại.';
      alert(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentName.trim()) {
      alert('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    const cleanPhone = phone.replace(/[\s\.\-\(\)]/g, '');
    if (!/^0\d{9}$/.test(cleanPhone)) {
      setPhoneError('Vui lòng nhập số điện thoại hợp lệ (10 chữ số, bắt đầu bằng số 0).');
      return;
    }
    setPhoneError('');

    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 border-3 border-[#0f3b7d]/20 border-t-[#0f3b7d] rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-600">Đang tải phiếu khảo sát tuyển sinh...</p>
        </div>
      </div>
    );
  }

  if (error || !surveyInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[5px] border border-slate-200 shadow-sm p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Không tìm thấy phiếu khảo sát</h2>
          <p className="text-xs text-slate-500">
            Đường dẫn có thể đã thay đổi hoặc điểm trường không khả dụng. Vui lòng quét lại mã QR tại bàn tư vấn.
          </p>
        </div>
      </div>
    );
  }

  // MÀN HÌNH NỘP THÀNH CÔNG
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-slate-50 to-white flex items-center justify-center p-4 sm:p-6 animate-fade-in">
        <div className="max-w-md w-full bg-white rounded-[5px] border border-slate-200/90 shadow-md p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200 animate-bounce">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900">
              Gửi Thông Tin Thành Công!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Cảm ơn bạn <strong className="text-[#0f3b7d]">{studentName}</strong> đã quan tâm và hoàn tất phiếu khảo sát nguyện vọng tuyển sinh.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[5px] text-xs text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-700">
              <School className="w-4 h-4 text-[#0f3b7d] shrink-0" />
              <span><strong>Trường:</strong> {school?.name}</span>
            </div>
            {selectedMajors.length > 0 && (
              <div className="flex items-start gap-2 text-slate-700">
                <BookOpen className="w-4 h-4 text-[#0f3b7d] shrink-0 mt-0.5" />
                <span>
                  <strong>Ngành quan tâm:</strong> {selectedMajors.join(', ')}
                </span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 italic">
            Ban Tuyển sinh & Hướng nghiệp sẽ sớm liên hệ gửi thông tin học bổng và tư vấn xét tuyển chi tiết cho bạn!
          </p>

          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setStudentName('');
              setPhone('');
              setGrade('');
              setSelectedMajors([]);
              setNotes('');
            }}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-[5px] transition cursor-pointer"
          >
            Điền thêm cho bạn bè
          </button>
        </div>
      </div>
    );
  }

  // MÀN HÌNH FORM KHẢO SÁT CHÍNH
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/40 via-slate-50 to-slate-100 py-6 px-3.5 sm:px-6">
      <div className="max-w-lg mx-auto bg-white rounded-[5px] border border-slate-200/90 shadow-sm overflow-hidden animate-slide-up">
        {/* Header trường và chiến dịch */}
        <div className="bg-[#0f3b7d] text-white p-5 sm:p-6 text-center space-y-2 relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-[11px] font-bold tracking-wide backdrop-blur-xs">
            <GraduationCap className="w-3.5 h-3.5 text-blue-200" />
            <span>TƯ VẤN TUYỂN SINH & HƯỚNG NGHIỆP</span>
          </div>

          <h1 className="text-lg sm:text-xl font-black uppercase tracking-wide leading-tight">
            {config?.title || 'Khảo Sát Nguyện Vọng Tuyển Sinh 2026'}
          </h1>

          <div className="flex items-center justify-center gap-1.5 text-blue-100 text-xs font-medium pt-1">
            <School className="w-4 h-4 text-blue-300 shrink-0" />
            <span className="truncate">{school?.name}</span>
          </div>
        </div>

        {/* Thân Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          <p className="text-xs text-slate-500 italic text-center pb-1">
            {config?.description || 'Vui lòng để lại thông tin để nhận tư vấn học bổng và chỉ tiêu tuyển sinh mới nhất.'}
          </p>

          {/* 1. Họ và tên */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#0f3b7d]" />
              <span>Họ và tên của bạn <span className="text-red-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 rounded-[5px] text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition"
            />
          </div>

          {/* 2. Số điện thoại */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#0f3b7d]" />
              <span>Số điện thoại (Zalo) <span className="text-red-500">*</span></span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError('');
              }}
              placeholder="Ví dụ: 0912345678"
              className={`w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border rounded-[5px] text-xs font-semibold text-slate-800 focus:outline-hidden transition ${
                phoneError
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-300 focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d]'
              }`}
            />
            {phoneError && (
              <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {phoneError}
              </p>
            )}
          </div>

          {/* 3. Lớp học */}
          {fieldsEnabled.grade && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#0f3b7d]" />
                <span>Lớp học hiện tại</span>
              </label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Ví dụ: 12A1, 12A2, 12C3..."
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 rounded-[5px] text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition"
              />
            </div>
          )}

          {/* 4. Ngành học quan tâm */}
          {majorsList.length > 0 && (
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span>Ngành nghề yêu thích / Nguyện vọng</span>
                </span>
                <span className="text-[11px] text-slate-500 font-normal">(Chọn một hoặc nhiều)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {majorsList.map((major) => {
                  const isChecked = selectedMajors.includes(major);
                  return (
                    <button
                      key={major}
                      type="button"
                      onClick={() => handleToggleMajor(major)}
                      className={`text-left p-2.5 rounded-[5px] border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50 border-[#0f3b7d] text-[#0f3b7d] shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate pr-1">{major}</span>
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 border ${
                          isChecked
                            ? 'bg-[#0f3b7d] border-[#0f3b7d] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Ghi chú / Nguyện vọng thêm */}
          {fieldsEnabled.notes && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Câu hỏi hoặc ghi chú thêm cho ban tuyển sinh (tùy chọn)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ví dụ: Em muốn hỏi về chính sách học bổng, ký túc xá..."
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 rounded-[5px] text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition resize-none"
              />
            </div>
          )}

          {/* Nút gửi */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full py-3.5 px-4 bg-[#0f3b7d] hover:bg-[#0c2f64] active:scale-[0.99] text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-[5px] transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ĐANG GỬI THÔNG TIN...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>GỬI THÔNG TIN KHẢO SÁT</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Thông tin của bạn được bảo mật và chỉ sử dụng cho mục đích tư vấn tuyển sinh chính thức.
        </div>
      </div>
    </div>
  );
};

export default PublicSurveyPage;
