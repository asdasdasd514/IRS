import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  School,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { surveyApi } from '../../services/api';
import { SurveyQuestion } from '../../types';

export const PublicSurveyPage: React.FC = () => {
  const { tripId, waypointId } = useParams<{ tripId: string; waypointId: string }>();

  // Dynamic answers state: key is question id, value is string | string[]
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 1. Fetch thông tin trường và cấu hình form (ưu tiên form riêng của trường nếu có)
  const {
    data: surveyInfo,
    isLoading,
    error,
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

  // Xây dựng danh sách câu hỏi linh hoạt (hỗ trợ Google Form động)
  const activeQuestions: SurveyQuestion[] = useMemo(() => {
    if (config?.questions && Array.isArray(config.questions) && config.questions.length > 0) {
      return config.questions;
    }

    // Fallback nếu câu hỏi chưa được định nghĩa
    const fallback: SurveyQuestion[] = [
      {
        id: 'student_name',
        type: 'text',
        title: 'Họ và tên của bạn',
        placeholder: 'Ví dụ: Nguyễn Văn An',
        required: true,
        is_core: true,
      },
      {
        id: 'phone',
        type: 'text',
        title: 'Số điện thoại (Zalo liên hệ)',
        placeholder: 'Ví dụ: 0912345678',
        required: true,
        is_core: true,
      },
    ];

    if (config?.fields_enabled?.grade !== false) {
      fallback.push({
        id: 'grade',
        type: 'radio',
        title: 'Khối lớp hiện tại',
        required: false,
        options: ['Khối 12', 'Khối 11', 'Khối 10'],
      });
    }

    if (Array.isArray(config?.majors) && config.majors.length > 0) {
      fallback.push({
        id: 'majors',
        type: 'checkbox',
        title: 'Ngành học bạn quan tâm',
        required: false,
        options: config.majors,
      });
    }

    if (config?.fields_enabled?.notes !== false) {
      fallback.push({
        id: 'notes',
        type: 'textarea',
        title: 'Ghi chú & Nguyện vọng khác',
        placeholder: 'Để lại câu hỏi hoặc thắc mắc cần tư vấn thêm...',
        required: false,
      });
    }

    return fallback;
  }, [config]);

  // Handler cập nhật giá trị từng câu hỏi
  const handleValueChange = (questionId: string, val: any) => {
    setFormValues((prev) => ({
      ...prev,
      [questionId]: val,
    }));
    if (fieldErrors[questionId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  // Handler toggle checkbox (nhiều lựa chọn)
  const handleToggleCheckboxOption = (questionId: string, option: string) => {
    const current: string[] = Array.isArray(formValues[questionId]) ? formValues[questionId] : [];
    let updated: string[];
    if (current.includes(option)) {
      updated = current.filter((o) => o !== option);
    } else {
      updated = [...current, option];
    }
    handleValueChange(questionId, updated);
  };

  // 2. Mutation nộp phiếu
  const submitMutation = useMutation({
    mutationFn: () => {
      // Map toàn bộ câu trả lời theo tiêu đề câu hỏi để người dùng xem dễ hiểu
      const answersMap: Record<string, any> = {};
      activeQuestions.forEach((q) => {
        const val = formValues[q.id];
        if (val !== undefined && val !== null && val !== '') {
          answersMap[q.title] = val;
        }
      });

      // Lấy các trường tiêu chuẩn nếu có (tự động nhận diện nếu người dùng đổi tên câu hỏi)
      let studentName = String(formValues['student_name'] || '').trim();
      if (!studentName) {
        const nameQ = activeQuestions.find(
          (q) => q.title.toLowerCase().includes('tên') || q.id.toLowerCase().includes('name')
        );
        if (nameQ && formValues[nameQ.id]) {
          studentName = String(formValues[nameQ.id]).trim();
        } else if (activeQuestions[0] && formValues[activeQuestions[0].id]) {
          studentName = String(formValues[activeQuestions[0].id]).trim();
        } else {
          studentName = 'Học sinh';
        }
      }

      let phone = String(formValues['phone'] || '').trim();
      if (!phone) {
        const phoneQ = activeQuestions.find(
          (q) =>
            q.title.toLowerCase().includes('thoại') ||
            q.title.toLowerCase().includes('phone') ||
            q.title.toLowerCase().includes('sđt') ||
            q.id.toLowerCase().includes('phone')
        );
        if (phoneQ && formValues[phoneQ.id]) {
          phone = String(formValues[phoneQ.id]).trim();
        }
      }

      const grade = String(formValues['grade'] || '').trim();
      const notes = String(formValues['notes'] || '').trim();
      const majors = Array.isArray(formValues['majors']) ? formValues['majors'] : [];

      return surveyApi.submitPublicSurvey({
        trip_id: tripId!,
        waypoint_id: waypointId!,
        student_name: studentName,
        phone,
        grade,
        interested_majors: majors,
        notes,
        answers: answersMap,
      });
    },
    onSuccess: () => {
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail || 'Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại.';
      alert(msg);
    },
  });

  // Handler Submit & Validate
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    activeQuestions.forEach((q) => {
      const val = formValues[q.id];

      // Validate required
      if (q.required) {
        if (q.type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) {
            newErrors[q.id] = 'Vui lòng chọn ít nhất một lựa chọn.';
          }
        } else {
          if (!val || String(val).trim() === '') {
            newErrors[q.id] = 'Vui lòng không để trống câu hỏi này.';
          }
        }
      }

      // Validate số điện thoại
      if (q.id === 'phone' || q.title.toLowerCase().includes('điện thoại')) {
        const rawPhone = String(val || '');
        const cleanPhone = rawPhone.replace(/[\s\.\-\(\)]/g, '');
        if (!cleanPhone && q.required) {
          newErrors[q.id] = 'Vui lòng nhập số điện thoại liên hệ.';
        } else if (cleanPhone && !/^0\d{9}$/.test(cleanPhone)) {
          newErrors[q.id] =
            'Số điện thoại không hợp lệ (cần đủ 10 chữ số và bắt đầu bằng số 0).';
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      // Tự cuộn đến câu hỏi lỗi đầu tiên
      const firstErrorId = Object.keys(newErrors)[0];
      const el = document.getElementById(`field_${firstErrorId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

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
        <div className="max-w-md w-full bg-white rounded-[6px] border border-slate-200 shadow-sm p-6 text-center space-y-3">
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
    const studentName = formValues['student_name'] || 'bạn';
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-slate-50 to-white flex items-center justify-center p-4 sm:p-6 animate-fade-in">
        <div className="max-w-md w-full bg-white rounded-[6px] border border-slate-200 shadow-md p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200 animate-bounce">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900">Gửi Thông Tin Thành Công!</h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Cảm ơn bạn <strong className="text-[#0f3b7d]">{studentName}</strong> đã hoàn tất
              phiếu khảo sát nguyện vọng tuyển sinh.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[5px] text-xs text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-700">
              <School className="w-4 h-4 text-[#0f3b7d] shrink-0" />
              <span>
                <strong>Trường:</strong> {school?.name}
              </span>
            </div>
            {formValues['majors'] && Array.isArray(formValues['majors']) && (
              <div className="flex items-start gap-2 text-slate-700">
                <GraduationCap className="w-4 h-4 text-[#0f3b7d] shrink-0 mt-0.5" />
                <span>
                  <strong>Ngành quan tâm:</strong> {formValues['majors'].join(', ')}
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
              setFormValues({});
              setFieldErrors({});
            }}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-[5px] transition cursor-pointer"
          >
            Điền thêm cho bạn bè
          </button>
        </div>
      </div>
    );
  }

  // MÀN HÌNH FORM KHẢO SÁT CHÍNH (GOOGLE FORMS MOBILE EXPERIENCE)
  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header trường và chiến dịch */}
        <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs overflow-hidden">
          <div className="h-2.5 bg-[#0f3b7d] w-full" />
          <div className="p-5 sm:p-6 space-y-3">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
              {config?.title || 'Khảo Sát Nguyện Vọng Tuyển Sinh 2026'}
            </h1>

            <p className="text-xs text-slate-600 leading-relaxed">
              {config?.description ||
                'Vui lòng để lại thông tin để nhận tư vấn học bổng và chỉ tiêu tuyển sinh mới nhất.'}
            </p>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <School className="w-4 h-4 text-[#0f3b7d] shrink-0" />
              <span>{school?.name}</span>
            </div>

            <div className="text-[11px] text-red-500 font-medium">
              * Biểu thị câu hỏi bắt buộc
            </div>
          </div>
        </div>

        {/* Dynamic Form questions */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {activeQuestions.map((q, idx) => {
            const hasError = !!fieldErrors[q.id];
            const currentVal = formValues[q.id];

            return (
              <div
                key={q.id || idx}
                id={`field_${q.id}`}
                className={`bg-white rounded-[6px] border p-4 sm:p-5 transition shadow-2xs space-y-3 ${
                  hasError ? 'border-red-400 ring-1 ring-red-400 bg-red-50/20' : 'border-slate-200'
                }`}
              >
                {/* Tiêu đề câu hỏi */}
                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-900 block leading-snug">
                    {q.title}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {q.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{q.description}</p>
                  )}
                </div>

                {/* 1. Trả lời ngắn (Text) */}
                {q.type === 'text' && (
                  <div>
                    <input
                      type={q.id === 'phone' ? 'tel' : 'text'}
                      value={currentVal || ''}
                      onChange={(e) => handleValueChange(q.id, e.target.value)}
                      placeholder={q.placeholder || 'Câu trả lời của bạn...'}
                      className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-[5px] text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition"
                    />
                  </div>
                )}

                {/* 2. Đoạn văn dài (Textarea) */}
                {q.type === 'textarea' && (
                  <div>
                    <textarea
                      rows={3}
                      value={currentVal || ''}
                      onChange={(e) => handleValueChange(q.id, e.target.value)}
                      placeholder={q.placeholder || 'Nhập câu trả lời chi tiết của bạn...'}
                      className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-[5px] text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition resize-none"
                    />
                  </div>
                )}

                {/* 3. Trắc nghiệm 1 đáp án (Radio) */}
                {q.type === 'radio' && (
                  <div className="space-y-2">
                    {(q.options || []).map((opt, optIdx) => {
                      const isSelected = currentVal === opt;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleValueChange(q.id, opt)}
                          className={`w-full text-left p-3 rounded-[5px] border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/80 border-[#0f3b7d] text-[#0f3b7d] shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="leading-snug">{opt}</span>
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ml-2 ${
                              isSelected
                                ? 'bg-[#0f3b7d] border-[#0f3b7d]'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 4. Hộp kiểm nhiều đáp án (Checkbox) */}
                {q.type === 'checkbox' && (
                  <div className="space-y-2">
                    {(q.options || []).map((opt, optIdx) => {
                      const selectedList: string[] = Array.isArray(currentVal) ? currentVal : [];
                      const isChecked = selectedList.includes(opt);
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleToggleCheckboxOption(q.id, opt)}
                          className={`w-full text-left p-3 rounded-[5px] border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/80 border-[#0f3b7d] text-[#0f3b7d] shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="leading-snug">{opt}</span>
                          <span
                            className={`w-4 h-4 rounded-[3px] flex items-center justify-center text-[10px] shrink-0 border ml-2 ${
                              isChecked
                                ? 'bg-[#0f3b7d] border-[#0f3b7d] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 5. Menu thả xuống (Dropdown) */}
                {q.type === 'dropdown' && (
                  <div className="relative">
                    <select
                      value={currentVal || ''}
                      onChange={(e) => handleValueChange(q.id, e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-[5px] text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d] transition cursor-pointer pr-10"
                    >
                      <option value="">-- Chọn một câu trả lời --</option>
                      {(q.options || []).map((opt, optIdx) => (
                        <option key={optIdx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                )}

                {/* Thông báo lỗi câu hỏi */}
                {hasError && (
                  <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors[q.id]}</span>
                  </p>
                )}
              </div>
            );
          })}

          {/* Nút gửi thông tin */}
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

        <div className="p-3 bg-white rounded-[6px] border border-slate-200 text-center text-[10px] text-slate-400 shadow-2xs">
          Thông tin của bạn được bảo mật tuyệt đối và chỉ sử dụng cho mục đích tư vấn tuyển sinh chính thức.
        </div>
      </div>
    </div>
  );
};

export default PublicSurveyPage;
