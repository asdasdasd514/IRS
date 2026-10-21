import { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  X,
  QrCode,
  Settings,
  ClipboardList,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Check,
  FileSpreadsheet,
  RefreshCw,
  Info,
  Copy,
  ChevronUp,
  ChevronDown,
  Layers,
  CheckSquare,
  CircleDot,
} from 'lucide-react';
import { surveyApi, tripApi } from '../../../services/api';
import { exportSurveysToExcel } from '../../../utils/surveyExcelExporter';
import { SurveyQuestion, SurveyQuestionType } from '../../../types';

interface CampaignSurveyModalProps {
  campaign: any;
  isOpen?: boolean;
  onClose: () => void;
}

const DEFAULT_MAJORS_LIST = [
  'Công nghệ thông tin & Trí tuệ nhân tạo (AI)',
  'Kỹ thuật phần mềm & Thiết kế vi mạch',
  'Quản trị kinh doanh & Digital Marketing',
  'Tài chính - Ngân hàng & Công nghệ tài chính (FinTech)',
  'Ngôn ngữ Anh & Tiếng Anh thương mại',
  'Truyền thông đa phương tiện & Quan hệ công chúng',
  'Logistics & Quản lý chuỗi cung ứng',
  'Y khoa & Dược học & Điều dưỡng',
];

export function CampaignSurveyModal({
  campaign,
  isOpen = true,
  onClose,
}: CampaignSurveyModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'qr' | 'responses'>('qr');
  const campaignId = campaign?.id || campaign?._id;

  // Điểm trường danh sách
  const [schoolList, setSchoolList] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // Scope: 'default' = form chung của chiến dịch, hoặc waypoint_id / school_id
  const [selectedScope, setSelectedScope] = useState<string>('default');
  const [isCustomScope, setIsCustomScope] = useState<boolean>(false);
  const [schoolCustomMap, setSchoolCustomMap] = useState<Record<string, boolean>>({});

  // Config State
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formTitle, setFormTitle] = useState('Khảo Sát Nguyện Vọng Tuyển Sinh 2026');
  const [formDescription, setFormDescription] = useState(
    'Vui lòng để lại thông tin để nhận tư vấn học bổng và chỉ tiêu tuyển sinh mới nhất.'
  );
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Tab 3: Responses state & Detail modal
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);
  const [selectedResponseForDetail, setSelectedResponseForDetail] = useState<any | null>(null);

  // 1. Load Destinations & Waypoints
  useEffect(() => {
    if (!isOpen || !campaign) return;

    let schools: any[] = [];
    if (Array.isArray(campaign.destinations) && campaign.destinations.length > 0) {
      schools = campaign.destinations.map((d: any, idx: number) => ({
        id: d.id || d.school_id || `dest_${idx}`,
        waypoint_id: d.id || d.school_id,
        name: d.name || 'Điểm trường',
        address: d.address || '',
        has_custom: !!d.custom_survey_config,
      }));
    }

    const tripId = campaign.deployed_trip_id || campaign.trip_id;
    if (tripId) {
      tripApi
        .getTrip(tripId)
        .then((tripRes) => {
          if (tripRes && Array.isArray(tripRes.waypoints) && tripRes.waypoints.length > 0) {
            const wpSchools = tripRes.waypoints
              .filter((w: any) => w.type !== 'REST_STOP')
              .map((w: any) => ({
                id: w.school_id || w.id,
                waypoint_id: w.id,
                name: w.name || 'Điểm trường',
                address: w.address || '',
                has_custom: !!w.custom_survey_config,
              }));
            if (wpSchools.length > 0) {
              setSchoolList(wpSchools);
              setSelectedSchoolId(wpSchools[0].waypoint_id);
              const customMap: Record<string, boolean> = {};
              wpSchools.forEach((s) => {
                if (s.has_custom) customMap[s.waypoint_id] = true;
              });
              setSchoolCustomMap(customMap);
              return;
            }
          }
        })
        .catch(() => {});
    }

    setSchoolList(schools);
    if (schools.length > 0) {
      setSelectedSchoolId(schools[0].waypoint_id || schools[0].id);
      const customMap: Record<string, boolean> = {};
      schools.forEach((s) => {
        if (s.has_custom) customMap[s.waypoint_id || s.id] = true;
      });
      setSchoolCustomMap(customMap);
    }
  }, [isOpen, campaign]);

  // 2. Load Survey Config when scope changes or modal opens
  const loadConfigForScope = async (scope: string) => {
    if (!campaignId) return;
    try {
      setConfigLoading(true);
      const schoolIdParam = scope === 'default' ? undefined : scope;
      const res = await surveyApi.getCampaignSurveyConfig(campaignId, schoolIdParam);

      if (res && res.survey_config) {
        const cfg = res.survey_config;
        setFormTitle(cfg.title || 'Khảo Sát Nguyện Vọng Tuyển Sinh 2026');
        setFormDescription(
          cfg.description !== undefined
            ? cfg.description
            : 'Vui lòng để lại thông tin để nhận tư vấn học bổng và chỉ tiêu tuyển sinh mới nhất.'
        );
        setIsCustomScope(!!cfg.is_custom);

        if (Array.isArray(cfg.questions) && cfg.questions.length > 0) {
          setQuestions(cfg.questions);
        } else {
          // Fallback tạo bộ câu hỏi mặc định
          setQuestions([
            {
              id: 'student_name',
              type: 'text',
              title: 'Họ và tên học sinh',
              placeholder: 'Nhập họ và tên đầy đủ của bạn',
              required: true,
              options: [],
            },
            {
              id: 'phone',
              type: 'text',
              title: 'Số điện thoại liên hệ (Zalo 10 số)',
              placeholder: 'Ví dụ: 0912345678',
              required: true,
              options: [],
            },
            {
              id: 'grade',
              type: 'radio',
              title: 'Khối lớp hiện tại',
              required: false,
              options: ['Khối 12', 'Khối 11', 'Khối 10'],
            },
            {
              id: 'majors',
              type: 'checkbox',
              title: 'Ngành học bạn quan tâm',
              required: false,
              is_core: false,
              options: DEFAULT_MAJORS_LIST,
            },
            {
              id: 'notes',
              type: 'textarea',
              title: 'Ghi chú & Nguyện vọng khác',
              placeholder: 'Để lại câu hỏi hoặc thắc mắc cần tư vấn thêm...',
              required: false,
              is_core: false,
              options: [],
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to load survey config:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && campaignId && activeTab === 'config') {
      loadConfigForScope(selectedScope);
    }
  }, [isOpen, campaignId, selectedScope, activeTab]);

  // Load responses when switching to Responses tab
  const loadResponses = async () => {
    if (!campaignId) return;
    try {
      setResponsesLoading(true);
      const res = await surveyApi.getCampaignSurveyResponses(campaignId);
      if (res && res.responses) {
        setResponses(res.responses);
      }
    } catch (err) {
      console.error('Failed to load survey responses:', err);
    } finally {
      setResponsesLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'responses') {
      loadResponses();
    }
  }, [isOpen, activeTab, campaignId]);

  // Scope switcher
  const handleScopeChange = (newScope: string) => {
    setSelectedScope(newScope);
  };

  // Revert custom school config back to campaign default
  const handleRevertSchoolConfig = async () => {
    if (selectedScope === 'default') return;
    const ok = window.confirm(
      'Bạn có chắc chắn muốn xóa form riêng của điểm trường này và khôi phục về sử dụng Form chung của chiến dịch?'
    );
    if (!ok) return;

    try {
      setConfigSaving(true);
      await surveyApi.revertSchoolSurveyConfig(campaignId, selectedScope);
      setSchoolCustomMap((prev) => ({ ...prev, [selectedScope]: false }));
      setIsCustomScope(false);
      await loadConfigForScope(selectedScope);
      alert('Đã khôi phục về Form chung của chiến dịch!');
    } catch (err) {
      console.error('Failed to revert school survey config:', err);
      alert('Không thể khôi phục cấu hình. Vui lòng thử lại.');
    } finally {
      setConfigSaving(false);
    }
  };

  // Save config handler
  const handleSaveConfig = async () => {
    if (!campaignId) return;

    if (questions.length === 0) {
      alert('Biểu mẫu phải có ít nhất 1 câu hỏi!');
      return;
    }

    try {
      setConfigSaving(true);
      const payload = {
        title: formTitle.trim() || 'Khảo Sát Nguyện Vọng Tuyển Sinh 2026',
        description: formDescription.trim(),
        questions: questions.map((q) => ({
          ...q,
          title: q.title.trim() || 'Câu hỏi chưa đặt tên',
          options: Array.isArray(q.options)
            ? q.options.map((o) => o.trim()).filter(Boolean)
            : [],
        })),
      };

      const schoolIdParam = selectedScope === 'default' ? undefined : selectedScope;
      await surveyApi.updateCampaignSurveyConfig(campaignId, payload, schoolIdParam);

      if (selectedScope !== 'default') {
        setIsCustomScope(true);
        setSchoolCustomMap((prev) => ({ ...prev, [selectedScope]: true }));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save survey config:', err);
      alert('Không thể lưu cấu hình. Vui lòng kiểm tra lại.');
    } finally {
      setConfigSaving(false);
    }
  };

  // Question editing helpers
  const handleAddQuestion = (type: SurveyQuestionType = 'text') => {
    const newId = `q_${Date.now()}`;
    const newQ: SurveyQuestion = {
      id: newId,
      type,
      title: 'Câu hỏi mới',
      description: '',
      required: false,
      options: ['radio', 'checkbox', 'dropdown'].includes(type) ? ['Tùy chọn 1', 'Tùy chọn 2'] : [],
      placeholder: '',
      is_core: false,
    };
    setQuestions([...questions, newQ]);
    setActiveQuestionId(newId);
  };

  const handleDuplicateQuestion = (index: number) => {
    const orig = questions[index];
    const newId = `q_${Date.now()}`;
    const copyQ: SurveyQuestion = {
      ...orig,
      id: newId,
      title: `${orig.title} (Bản sao)`,
      is_core: false,
      options: orig.options ? [...orig.options] : [],
    };
    const nextQuestions = [...questions];
    nextQuestions.splice(index + 1, 0, copyQ);
    setQuestions(nextQuestions);
    setActiveQuestionId(newId);
  };

  const handleDeleteQuestion = (index: number) => {
    const q = questions[index];
    setQuestions(questions.filter((_, i) => i !== index));
    if (activeQuestionId === q?.id) {
      setActiveQuestionId(null);
    }
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const nextQuestions = [...questions];
    const [moved] = nextQuestions.splice(index, 1);
    nextQuestions.splice(targetIdx, 0, moved);
    setQuestions(nextQuestions);
  };

  const handleUpdateQuestion = (index: number, field: keyof SurveyQuestion, value: any) => {
    const nextQuestions = [...questions];
    const currentQ = { ...nextQuestions[index], [field]: value };

    // Nếu đổi sang loại trắc nghiệm mà chưa có options thì gán mặc định
    if (field === 'type' && ['radio', 'checkbox', 'dropdown'].includes(value)) {
      if (!currentQ.options || currentQ.options.length === 0) {
        currentQ.options = ['Tùy chọn 1', 'Tùy chọn 2'];
      }
    }
    nextQuestions[index] = currentQ;
    setQuestions(nextQuestions);
  };

  const handleAddOption = (qIndex: number) => {
    const nextQuestions = [...questions];
    const currentQ = nextQuestions[qIndex];
    const currentOptions = currentQ.options ? [...currentQ.options] : [];
    currentOptions.push(`Tùy chọn ${currentOptions.length + 1}`);
    currentQ.options = currentOptions;
    setQuestions(nextQuestions);
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, val: string) => {
    const nextQuestions = [...questions];
    const currentQ = nextQuestions[qIndex];
    if (currentQ.options) {
      currentQ.options[optIndex] = val;
      setQuestions(nextQuestions);
    }
  };

  const handleDeleteOption = (qIndex: number, optIndex: number) => {
    const nextQuestions = [...questions];
    const currentQ = nextQuestions[qIndex];
    if (currentQ.options && currentQ.options.length > 1) {
      currentQ.options.splice(optIndex, 1);
      setQuestions(nextQuestions);
    } else {
      alert('Câu hỏi trắc nghiệm phải có ít nhất 1 tùy chọn.');
    }
  };

  // QR URL calculation
  const currentTripId = campaign?.deployed_trip_id || campaign?.trip_id || campaignId || 'default';
  const currentWaypointId =
    selectedSchoolId || schoolList[0]?.waypoint_id || schoolList[0]?.id || 'school';
  const surveyUrl = `${window.location.origin}/survey/${currentTripId}/${currentWaypointId}`;

  const selectedSchoolObj =
    schoolList.find((s) => s.waypoint_id === selectedSchoolId || s.id === selectedSchoolId) ||
    schoolList[0];

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) {
      alert('Không tìm thấy hình ảnh mã QR!');
      return;
    }
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    const safeSchoolName = (selectedSchoolObj?.name || 'Truong')
      .replace(/[^a-zA-Z0-9_\u00C0-\u1EF9-]/g, '_')
      .slice(0, 30);
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_KhaoSat_${safeSchoolName}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const selectedScopeSchoolObj = schoolList.find(
    (s) => (s.waypoint_id || s.id) === selectedScope
  );

  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-50 rounded-[6px] shadow-2xl max-w-5xl w-full flex flex-col max-h-[94vh] overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-[#0f3b7d] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[5px] bg-white/10 flex items-center justify-center text-white shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Khảo Sát & Mã QR Tuyển Sinh
              </h2>
              <p className="text-xs text-blue-100 line-clamp-1 mt-0.5">
                Chiến dịch: <strong className="text-white">{campaign.name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[5px] hover:bg-white/10 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 shrink-0 text-xs sm:text-sm font-bold">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`py-3 px-3 sm:px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'qr'
                  ? 'border-[#0f3b7d] text-[#0f3b7d] bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Mã QR Khảo Sát</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`py-3 px-3 sm:px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'config'
                  ? 'border-[#0f3b7d] text-[#0f3b7d] bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Biểu Mẫu Khảo Sát</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('responses')}
              className={`py-3 px-3 sm:px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'responses'
                  ? 'border-[#0f3b7d] text-[#0f3b7d] bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Phiếu Đã Nộp</span>
              {responses.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[#0f3b7d] text-[10px] font-extrabold">
                  {responses.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            Tự động đồng bộ với điện thoại học sinh
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
          {/* ============================================================ */}
          {/* TAB 1: MÃ QR KHẢO SÁT                                         */}
          {/* ============================================================ */}
          {activeTab === 'qr' && (
            <div className="space-y-5 max-w-2xl mx-auto">
              {/* Chọn điểm trường */}
              <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chọn Điểm Trường Để Xuất Mã QR
                </label>
                {schoolList.length > 0 ? (
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-[5px] border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#0f3b7d] cursor-pointer"
                  >
                    {schoolList.map((s, idx) => (
                      <option key={s.waypoint_id || s.id || idx} value={s.waypoint_id || s.id}>
                        {idx + 1}. {s.name} {s.address ? `(${s.address})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-[5px] border border-amber-200 flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                      Chiến dịch chưa có điểm trường nào được gắn. Bạn vẫn có thể quét mã QR mẫu này để thử nghiệm.
                    </span>
                  </div>
                )}
              </div>

              {/* Khung hiển thị Mã QR */}
              <div className="bg-white rounded-[6px] border border-slate-200 p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xs">
                <div
                  ref={qrCanvasRef}
                  className="bg-white p-5 rounded-[6px] border border-slate-300 shadow-sm inline-block"
                >
                  <QRCodeCanvas value={surveyUrl} size={300} level="H" includeMargin={true} />
                </div>

                {/* Đường dẫn & Nút xem thử */}
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 max-w-md truncate">
                  <span className="font-mono bg-slate-50 px-2 py-1 rounded-[5px] truncate text-[11px] border border-slate-200">
                    {surveyUrl}
                  </span>
                  <a
                    href={surveyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-[5px] hover:bg-blue-50 text-[#0f3b7d] transition shrink-0"
                    title="Mở thử link khảo sát"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* NÚT TẢI XUỐNG DUY NHẤT */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="px-6 py-2.5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải xuống mã QR (PNG)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: CẤU HÌNH BIỂU MẪU (GOOGLE FORMS EDITOR)               */}
          {/* ============================================================ */}
          {activeTab === 'config' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* PHẠM VI ÁP DỤNG (SCOPE SWITCHER) */}
              <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#0f3b7d]" />
                      <span>Phạm Vi Áp Dụng Biểu Mẫu</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bạn có thể dùng chung mẫu cho cả chiến dịch hoặc tạo form riêng cho từng trường cụ thể
                    </p>
                  </div>

                  <select
                    value={selectedScope}
                    onChange={(e) => handleScopeChange(e.target.value)}
                    className="py-2 px-3 rounded-[5px] border border-slate-300 bg-slate-50 hover:bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0f3b7d] cursor-pointer"
                  >
                    <option value="default">📋 Mẫu Form chung của Toàn Chiến Dịch</option>
                    {schoolList.map((s, idx) => {
                      const scopeKey = s.waypoint_id || s.id;
                      const hasCustom = schoolCustomMap[scopeKey];
                      return (
                        <option key={scopeKey || idx} value={scopeKey}>
                          🏫 {s.name} {hasCustom ? '★ (Form riêng)' : '(Dùng mẫu chung)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Banner trạng thái của điểm trường */}
                {selectedScope === 'default' ? (
                  <div className="text-[11px] text-blue-800 bg-blue-50/80 p-2.5 rounded-[5px] border border-blue-200 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Đang chỉnh sửa <strong>Mẫu Form chung của Chiến dịch</strong>. Tất cả các điểm trường chưa cấu hình riêng sẽ tự động áp dụng biểu mẫu này.
                    </span>
                  </div>
                ) : (
                  <div
                    className={`text-[11px] p-2.5 rounded-[5px] border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isCustomScope
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isCustomScope ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                        }`}
                      />
                      <span>
                        {isCustomScope ? (
                          <>
                            Điểm trường <strong>{selectedScopeSchoolObj?.name}</strong> đang có{' '}
                            <strong>Form tùy chỉnh riêng biệt</strong>.
                          </>
                        ) : (
                          <>
                            Điểm trường <strong>{selectedScopeSchoolObj?.name}</strong> đang dùng mẫu chung. Khi bạn lưu, hệ thống sẽ tự động tạo một form riêng độc lập cho trường này.
                          </>
                        )}
                      </span>
                    </div>

                    {isCustomScope && (
                      <button
                        type="button"
                        onClick={handleRevertSchoolConfig}
                        disabled={configSaving}
                        className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer shrink-0 self-start sm:self-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Khôi phục về mẫu chung</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {configLoading ? (
                <div className="py-16 text-center text-slate-400 bg-white rounded-[6px] border border-slate-200">
                  <div className="w-7 h-7 border-2 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs font-semibold">Đang tải cấu hình biểu mẫu...</span>
                </div>
              ) : (
                <>
                  {/* GOOGLE FORM HEADER CARD */}
                  <div className="bg-white rounded-[6px] border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="h-2 bg-[#0f3b7d] w-full" />
                    <div className="p-5 sm:p-6 space-y-4">
                      <div>
                        <input
                          type="text"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="Tiêu đề biểu mẫu khảo sát..."
                          className="w-full text-lg sm:text-xl font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-[#0f3b7d] focus:outline-hidden py-1 transition"
                        />
                      </div>

                      <div>
                        <textarea
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          rows={2}
                          placeholder="Mô tả biểu mẫu / Lời chào gửi đến học sinh..."
                          className="w-full text-xs sm:text-sm text-slate-600 border-b border-transparent hover:border-slate-300 focus:border-[#0f3b7d] focus:outline-hidden py-1 transition resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DANH SÁCH CÁC CÂU HỎI */}
                  <div className="space-y-3">
                    {questions.map((q, qIndex) => {
                      const isActive = activeQuestionId === q.id;
                      return (
                        <div
                          key={q.id || qIndex}
                          onClick={() => setActiveQuestionId(q.id)}
                          className={`bg-white rounded-[6px] border transition shadow-2xs overflow-hidden ${
                            isActive
                              ? 'border-l-4 border-l-[#0f3b7d] border-slate-300 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="p-4 sm:p-5 space-y-4">
                            {/* Header câu hỏi: Số thứ tự, Tiêu đề & Chọn loại câu hỏi */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                                  {qIndex + 1}
                                </span>
                                <input
                                  type="text"
                                  value={q.title}
                                  onChange={(e) =>
                                    handleUpdateQuestion(qIndex, 'title', e.target.value)
                                  }
                                  placeholder="Nhập nội dung câu hỏi..."
                                  className="flex-1 text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 hover:bg-white focus:bg-white px-3 py-2 rounded-[4px] border border-slate-200 focus:border-[#0f3b7d] focus:outline-hidden"
                                />
                              </div>

                              {/* Dropdown chọn loại câu hỏi */}
                              <div className="sm:w-56 shrink-0">
                                <select
                                  value={q.type}
                                  onChange={(e) =>
                                    handleUpdateQuestion(
                                      qIndex,
                                      'type',
                                      e.target.value as SurveyQuestionType
                                    )
                                  }
                                  className="w-full py-2 px-3 rounded-[4px] border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-[#0f3b7d] cursor-pointer"
                                >
                                  <option value="text">Trả lời ngắn (Text)</option>
                                  <option value="textarea">Đoạn văn dài (Textarea)</option>
                                  <option value="radio">Trắc nghiệm 1 đáp án (Radio)</option>
                                  <option value="checkbox">Hộp kiểm nhiều đáp án (Checkbox)</option>
                                  <option value="dropdown">Menu thả xuống (Dropdown)</option>
                                </select>
                              </div>
                            </div>

                            {/* Vùng hiển thị tùy chọn hoặc gợi ý placeholder */}
                            {(q.type === 'text' || q.type === 'textarea') && (
                              <div className="pl-8">
                                <input
                                  type="text"
                                  value={q.placeholder || ''}
                                  onChange={(e) =>
                                    handleUpdateQuestion(qIndex, 'placeholder', e.target.value)
                                  }
                                  placeholder="Văn bản gợi ý hiển thị mờ trong ô nhập (placeholder)..."
                                  className="w-full text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-[4px] border border-dashed border-slate-200 focus:border-[#0f3b7d] focus:outline-hidden"
                                />
                              </div>
                            )}

                            {['radio', 'checkbox', 'dropdown'].includes(q.type) && (
                              <div className="pl-8 space-y-2">
                                {(q.options || []).map((opt, optIdx) => (
                                  <div key={optIdx} className="flex items-center gap-2">
                                    <span className="text-slate-400 shrink-0">
                                      {q.type === 'radio' && <CircleDot className="w-3.5 h-3.5" />}
                                      {q.type === 'checkbox' && <CheckSquare className="w-3.5 h-3.5" />}
                                      {q.type === 'dropdown' && (
                                        <span className="text-[11px] font-mono font-bold">
                                          {optIdx + 1}.
                                        </span>
                                      )}
                                    </span>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) =>
                                        handleUpdateOption(qIndex, optIdx, e.target.value)
                                      }
                                      placeholder={`Tùy chọn ${optIdx + 1}`}
                                      className="flex-1 text-xs text-slate-700 px-2.5 py-1.5 rounded-[4px] border border-slate-200 focus:border-[#0f3b7d] focus:outline-hidden"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOption(qIndex, optIdx)}
                                      className="p-1 text-slate-400 hover:text-red-500 transition cursor-pointer"
                                      title="Xóa lựa chọn này"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}

                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAddOption(qIndex)}
                                    className="text-xs font-bold text-[#0f3b7d] hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Thêm tùy chọn</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Footer card: Di chuyển, Sao chép, Xóa, Bắt buộc */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveQuestion(qIndex, 'up')}
                                  disabled={qIndex === 0}
                                  className="p-1.5 rounded-[4px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                  title="Di chuyển lên trên"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveQuestion(qIndex, 'down')}
                                  disabled={qIndex === questions.length - 1}
                                  className="p-1.5 rounded-[4px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                  title="Di chuyển xuống dưới"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateQuestion(qIndex)}
                                  className="p-1.5 rounded-[4px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  title="Nhân bản câu hỏi này"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(qIndex)}
                                  className="p-1.5 rounded-[4px] text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                  title="Xóa câu hỏi này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>

                                <div className="h-4 w-px bg-slate-200" />

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                  <span>Bắt buộc</span>
                                  <input
                                    type="checkbox"
                                    checked={q.required}
                                    onChange={(e) =>
                                      handleUpdateQuestion(qIndex, 'required', e.target.checked)
                                    }
                                    className="w-4 h-4 text-[#0f3b7d] rounded cursor-pointer"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* NÚT THÊM CÂU HỎI MỚI */}
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('text')}
                      className="px-5 py-2.5 rounded-[5px] bg-white border border-dashed border-slate-300 hover:border-[#0f3b7d] text-slate-700 hover:text-[#0f3b7d] text-xs font-bold flex items-center gap-2 shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm Câu Hỏi Mới</span>
                    </button>
                  </div>

                  {/* THANH LƯU CẤU HÌNH DƯỚI CÙNG */}
                  <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs p-4 rounded-[6px] border border-slate-200 shadow-md flex items-center justify-between gap-3 mt-6">
                    <div className="text-xs text-slate-500">
                      Tổng số câu hỏi: <strong className="text-slate-800">{questions.length}</strong>
                    </div>

                    <div className="flex items-center gap-3">
                      {saveSuccess && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                          <Check className="w-4 h-4" />
                          Đã lưu thành công!
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        disabled={configSaving}
                        className="px-5 py-2.5 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition"
                      >
                        <Save className="w-4 h-4" />
                        <span>
                          {configSaving
                            ? 'Đang lưu...'
                            : selectedScope === 'default'
                            ? 'Lưu Form Chung Cho Chiến Dịch'
                            : `Lưu Form Riêng Cho ${selectedScopeSchoolObj?.name || 'Điểm Trường'}`}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: PHIẾU ĐÃ NỘP (CÓ MODAL XEM CHI TIẾT TỪNG PHIẾU)       */}
          {/* ============================================================ */}
          {activeTab === 'responses' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-[6px] border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="text-xs sm:text-sm font-semibold text-slate-600">
                    Tổng số phiếu đã thu được:{' '}
                    <strong className="text-slate-900 text-base">{responses.length}</strong> học sinh
                  </div>
                  <button
                    type="button"
                    onClick={loadResponses}
                    className="p-1 rounded-[5px] text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    title="Tải lại danh sách"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${responsesLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => exportSurveysToExcel(responses, campaign.name)}
                  disabled={responses.length === 0}
                  className="px-4 py-2 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xuất Excel Đầy Đủ ({responses.length})</span>
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">STT</th>
                        <th className="py-2.5 px-3">Học sinh</th>
                        <th className="py-2.5 px-3">SĐT</th>
                        <th className="py-2.5 px-3">Điểm trường</th>
                        <th className="py-2.5 px-3">Ngành / Câu trả lời</th>
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {responsesLoading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            <div className="w-6 h-6 border-2 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                            <span>Đang tải phiếu khảo sát...</span>
                          </td>
                        </tr>
                      ) : responses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            <ClipboardList className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                            <p className="font-semibold text-slate-600 text-xs">
                              Chiến dịch này chưa có học sinh nào nộp phiếu
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Hãy tải mã QR và giới thiệu cho các em học sinh quét khi đến trường!
                            </p>
                          </td>
                        </tr>
                      ) : (
                        responses.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800">{item.student_name}</span>
                              {item.grade && (
                                <span className="ml-1 px-1.5 py-0.2 rounded bg-slate-100 text-[10px] text-slate-600 font-semibold">
                                  {item.grade}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                              {item.phone}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700 line-clamp-1 max-w-[150px]">
                              {item.school_name}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {Array.isArray(item.interested_majors) &&
                                  item.interested_majors.map((m: string, mIdx: number) => (
                                    <span
                                      key={mIdx}
                                      className="px-1.5 py-0.2 rounded bg-blue-50 text-[#0f3b7d] text-[10px] font-semibold truncate max-w-[200px]"
                                    >
                                      {m}
                                    </span>
                                  ))}
                                {item.answers && Object.keys(item.answers).length > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 text-[10px] font-bold">
                                    +{Object.keys(item.answers).length} câu hỏi
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                              {item.created_at}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedResponseForDetail(item)}
                                className="px-2.5 py-1 rounded-[4px] bg-slate-100 hover:bg-[#0f3b7d] hover:text-white text-slate-700 font-bold text-[11px] transition cursor-pointer"
                              >
                                Xem
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Hệ thống Khảo sát Tuyển sinh Thông minh • Mã QR Động</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[5px] border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* POPUP XEM CHI TIẾT CÂU TRẢ LỜI CỦA 1 HỌC SINH */}
      {selectedResponseForDetail && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-[6px] shadow-2xl max-w-lg w-full flex flex-col max-h-[85vh] overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-[#0f3b7d] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Chi Tiết Phiếu Khảo Sát</h3>
                <p className="text-[11px] text-blue-200">{selectedResponseForDetail.student_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResponseForDetail(null)}
                className="p-1 rounded-[4px] hover:bg-white/10 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-[5px] border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Họ và tên:</span>
                  <span className="font-bold text-slate-800">
                    {selectedResponseForDetail.student_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số điện thoại:</span>
                  <span className="font-bold text-blue-700 font-mono">
                    {selectedResponseForDetail.phone}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Điểm trường:</span>
                  <span className="font-semibold text-slate-700">
                    {selectedResponseForDetail.school_name}
                  </span>
                </div>
                {selectedResponseForDetail.grade && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Khối lớp:</span>
                    <span className="font-semibold text-slate-700">
                      {selectedResponseForDetail.grade}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời gian nộp:</span>
                  <span className="text-slate-600">{selectedResponseForDetail.created_at}</span>
                </div>
              </div>

              {/* Ngành quan tâm */}
              {Array.isArray(selectedResponseForDetail.interested_majors) &&
                selectedResponseForDetail.interested_majors.length > 0 && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Ngành học quan tâm:</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedResponseForDetail.interested_majors.map((m: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-blue-50 text-[#0f3b7d] rounded-[4px] font-semibold text-[11px]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Các câu trả lời tùy biến khác trong answers */}
              {selectedResponseForDetail.answers &&
                Object.keys(selectedResponseForDetail.answers).length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="font-bold text-slate-800 block">
                      Các câu hỏi bổ sung (Tùy biến):
                    </label>
                    <div className="space-y-2">
                      {Object.entries(selectedResponseForDetail.answers).map(([key, val], aIdx) => {
                        if (['student_name', 'phone', 'grade', 'majors', 'notes'].includes(key)) {
                          return null;
                        }
                        return (
                          <div
                            key={aIdx}
                            className="p-2.5 rounded-[5px] bg-slate-50 border border-slate-200"
                          >
                            <span className="font-bold text-slate-700 block mb-1">{key}</span>
                            <span className="text-slate-900 font-medium">
                              {Array.isArray(val) ? val.join(', ') : String(val || '—')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Ghi chú */}
              {selectedResponseForDetail.notes && (
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block">Ghi chú & Nguyện vọng khác:</label>
                  <p className="p-2.5 rounded-[5px] bg-amber-50/60 border border-amber-200 text-slate-800 italic">
                    "{selectedResponseForDetail.notes}"
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedResponseForDetail(null)}
                className="px-4 py-1.5 rounded-[4px] bg-[#0f3b7d] text-white font-bold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CampaignSurveyModal;
