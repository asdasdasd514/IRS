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
} from 'lucide-react';
import { surveyApi, tripApi } from '../../../services/api';
import { exportSurveysToExcel } from '../../../utils/surveyExcelExporter';

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

  // Tab 1: Config state
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [title, setTitle] = useState('Khảo Sát Nguyện Vọng Tuyển Sinh 2026');
  const [description, setDescription] = useState(
    'Vui lòng để lại thông tin để nhận tư vấn học bổng và chỉ tiêu tuyển sinh mới nhất.'
  );
  const [majors, setMajors] = useState<string[]>(DEFAULT_MAJORS_LIST);
  const [newMajorInput, setNewMajorInput] = useState('');
  const [fieldsEnabled, setFieldsEnabled] = useState({
    student_name: true,
    phone: true,
    grade: true,
    email: false,
    notes: true,
  });

  // Tab 2: QR state
  const [schoolList, setSchoolList] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // Tab 3: Responses state
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);

  // Load Survey Config
  useEffect(() => {
    if (!isOpen || !campaignId) return;

    const loadConfig = async () => {
      try {
        setConfigLoading(true);
        const res = await surveyApi.getCampaignSurveyConfig(campaignId);
        if (res && res.survey_config) {
          const cfg = res.survey_config;
          if (cfg.title) setTitle(cfg.title);
          if (cfg.description !== undefined) setDescription(cfg.description);
          if (Array.isArray(cfg.majors) && cfg.majors.length > 0) setMajors(cfg.majors);
          if (cfg.fields_enabled) setFieldsEnabled((prev) => ({ ...prev, ...cfg.fields_enabled }));
        }
      } catch (err) {
        console.error('Failed to load campaign survey config:', err);
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, [isOpen, campaignId]);

  // Load School Destinations & Waypoints for QR tab
  useEffect(() => {
    if (!isOpen || !campaign) return;

    // Ưu tiên lấy từ campaign.destinations
    let schools: any[] = [];
    if (Array.isArray(campaign.destinations) && campaign.destinations.length > 0) {
      schools = campaign.destinations.map((d: any, idx: number) => ({
        id: d.id || d.school_id || `dest_${idx}`,
        waypoint_id: d.id || d.school_id,
        name: d.name || 'Điểm trường',
        address: d.address || '',
      }));
    }

    // Nếu có deployed_trip_id, có thể tải thêm waypoints thực tế của trip
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
              }));
            if (wpSchools.length > 0) {
              setSchoolList(wpSchools);
              setSelectedSchoolId(wpSchools[0].waypoint_id);
              return;
            }
          }
        })
        .catch(() => {
          // Fallback to destinations
        });
    }

    setSchoolList(schools);
    if (schools.length > 0) {
      setSelectedSchoolId(schools[0].waypoint_id || schools[0].id);
    }
  }, [isOpen, campaign]);

  // Load Responses when switching to Tab 3
  const loadResponses = async () => {
    if (!campaignId) return;
    try {
      setResponsesLoading(true);
      const res = await surveyApi.getCampaignSurveyResponses(campaignId);
      if (res && res.responses) {
        setResponses(res.responses);
      }
    } catch (err) {
      console.error('Failed to load campaign survey responses:', err);
    } finally {
      setResponsesLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'responses') {
      loadResponses();
    }
  }, [isOpen, activeTab, campaignId]);

  // Save config handler
  const handleSaveConfig = async () => {
    if (!campaignId) return;
    try {
      setConfigSaving(true);
      await surveyApi.updateCampaignSurveyConfig(campaignId, {
        title,
        description,
        majors,
        fields_enabled: fieldsEnabled,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save survey config:', err);
      alert('Không thể lưu cấu hình. Vui lòng thử lại.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddMajor = () => {
    const trimmed = newMajorInput.trim();
    if (!trimmed) return;
    if (majors.includes(trimmed)) {
      alert('Ngành này đã có trong danh sách!');
      return;
    }
    setMajors([...majors, trimmed]);
    setNewMajorInput('');
  };

  const handleRemoveMajor = (index: number) => {
    setMajors(majors.filter((_, i) => i !== index));
  };

  const handleResetMajors = () => {
    setMajors(DEFAULT_MAJORS_LIST);
  };

  // QR URL calculation
  const currentTripId = campaign?.deployed_trip_id || campaign?.trip_id || campaignId || 'default';
  const currentWaypointId = selectedSchoolId || (schoolList[0]?.waypoint_id || schoolList[0]?.id) || 'school';
  const surveyUrl = `${window.location.origin}/survey/${currentTripId}/${currentWaypointId}`;

  const selectedSchoolObj = schoolList.find(
    (s) => s.waypoint_id === selectedSchoolId || s.id === selectedSchoolId
  ) || schoolList[0];

  // Nút Tải xuống QR duy nhất
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

  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-[5px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-[#0f3b7d] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[5px] bg-white/10 flex items-center justify-center text-white">
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
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 shrink-0 text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`py-3.5 px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'qr'
                ? 'border-[#0f3b7d] text-[#0f3b7d] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Mã QR Khảo Sát</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-3.5 px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'config'
                ? 'border-[#0f3b7d] text-[#0f3b7d] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Cấu Hình Form</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('responses')}
            className={`py-3.5 px-4 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'responses'
                ? 'border-[#0f3b7d] text-[#0f3b7d] bg-white'
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

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {/* ============================================================ */}
          {/* TAB 1: MÃ QR KHẢO SÁT (TINH GỌN, CHỈ 1 NÚT TẢI XUỐNG)      */}
          {/* ============================================================ */}
          {activeTab === 'qr' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Chọn điểm trường */}
              <div className="bg-slate-50 p-4 rounded-[5px] border border-slate-200/80 space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chọn Điểm Trường Để Tạo Mã QR
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

              {/* Khung hiển thị Mã QR - Tiêu chuẩn tinh gọn */}
              <div className="bg-white rounded-[5px] border-2 border-dashed border-slate-200 p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                {/* QR Vector đen trắng chuẩn (KHÔNG LOGO để quét nhạy nhất, kích thước to rõ) */}
                <div
                  ref={qrCanvasRef}
                  className="bg-white p-5 rounded-[5px] border border-slate-300 shadow-md inline-block"
                >
                  <QRCodeCanvas
                    value={surveyUrl}
                    size={320}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                {/* Đường dẫn & Nút xem thử */}
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 max-w-md truncate">
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded-[5px] truncate text-[11px] border border-slate-200">
                    {surveyUrl}
                  </span>
                  <a
                    href={surveyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-[5px] hover:bg-blue-50 text-[#0f3b7d] transition shrink-0"
                    title="Mở thử link khảo sát"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* DUY NHẤT 1 NÚT TẢI XUỐNG THEO YÊU CẦU NGƯỜI DÙNG */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="px-6 py-3 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-sm font-bold flex items-center gap-2.5 shadow-md hover:shadow-lg transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải xuống mã QR</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: CẤU HÌNH FORM KHẢO SÁT                                */}
          {/* ============================================================ */}
          {activeTab === 'config' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              {configLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-7 h-7 border-2 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs">Đang tải cấu hình form khảo sát...</span>
                </div>
              ) : (
                <>
                  {/* Tiêu đề & Lời chào */}
                  <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 space-y-4 shadow-xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Tiêu Đề Phiếu Khảo Sát
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="VD: Khảo Sát Nguyện Vọng Tuyển Sinh 2026"
                        className="w-full px-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-800 font-semibold focus:outline-none focus:border-[#0f3b7d]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mô Tả / Lời Chào
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        placeholder="Vui lòng để lại thông tin để nhận tư vấn..."
                        className="w-full px-3 py-2 rounded-[5px] border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#0f3b7d]"
                      />
                    </div>
                  </div>

                  {/* Quản lý danh sách ngành học */}
                  <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Danh Sách Ngành Tuyển Sinh ({majors.length})
                        </label>
                        <p className="text-[11px] text-slate-400">
                          Học sinh sẽ tích chọn các ngành này trên form điện thoại
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetMajors}
                        className="text-xs font-bold text-[#0f3b7d] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Mặc định</span>
                      </button>
                    </div>

                    {/* Thêm ngành mới */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMajorInput}
                        onChange={(e) => setNewMajorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMajor();
                          }
                        }}
                        placeholder="Nhập tên ngành cần thêm và bấm Thêm..."
                        className="flex-1 px-3 py-2 rounded-[5px] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#0f3b7d]"
                      />
                      <button
                        type="button"
                        onClick={handleAddMajor}
                        className="px-4 py-2 rounded-[5px] bg-[#0f3b7d] hover:bg-[#0c2f64] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm</span>
                      </button>
                    </div>

                    {/* List tags */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {majors.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 rounded-[5px] bg-slate-50 border border-slate-200 text-xs group hover:bg-slate-100 transition"
                        >
                          <span className="font-semibold text-slate-700">
                            {idx + 1}. {m}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMajor(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                            title="Xóa ngành này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bật / tắt các trường câu hỏi */}
                  <div className="bg-white rounded-[5px] border border-slate-200/80 p-5 space-y-3 shadow-xs">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Cấu Hình Trường Thông Tin
                    </label>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-[5px] bg-slate-50 border border-slate-200">
                        <div>
                          <span className="font-bold text-slate-800">Họ và tên học sinh</span>
                          <span className="text-slate-400 text-[11px] block">Trường bắt buộc</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-[5px] bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Bắt buộc
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-[5px] bg-slate-50 border border-slate-200">
                        <div>
                          <span className="font-bold text-slate-800">Số điện thoại (10 số)</span>
                          <span className="text-slate-400 text-[11px] block">Trường bắt buộc để liên hệ tư vấn</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-[5px] bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Bắt buộc
                        </span>
                      </div>

                      <label className="flex items-center justify-between p-2 rounded-[5px] bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div>
                          <span className="font-bold text-slate-800">Khối lớp (12 / 11 / 10)</span>
                          <span className="text-slate-400 text-[11px] block">Cho phép học sinh chọn lớp</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={fieldsEnabled.grade}
                          onChange={(e) =>
                            setFieldsEnabled({ ...fieldsEnabled, grade: e.target.checked })
                          }
                          className="w-4 h-4 text-[#0f3b7d] rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 rounded-[5px] bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div>
                          <span className="font-bold text-slate-800">Ghi chú & Nguyện vọng khác</span>
                          <span className="text-slate-400 text-[11px] block">Học sinh để lại lời nhắn hoặc câu hỏi</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={fieldsEnabled.notes}
                          onChange={(e) =>
                            setFieldsEnabled({ ...fieldsEnabled, notes: e.target.checked })
                          }
                          className="w-4 h-4 text-[#0f3b7d] rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Nút Lưu cấu hình */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {saveSuccess && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
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
                      <span>{configSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: PHIẾU ĐÃ NỘP (CỦA RIÊNG CHIẾN DỊCH NÀY)              */}
          {/* ============================================================ */}
          {activeTab === 'responses' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                  <span>Xuất Excel ({responses.length})</span>
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-[5px] border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">STT</th>
                        <th className="py-2.5 px-3">Học sinh</th>
                        <th className="py-2.5 px-3">SĐT</th>
                        <th className="py-2.5 px-3">Điểm trường</th>
                        <th className="py-2.5 px-3">Ngành quan tâm</th>
                        <th className="py-2.5 px-3">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {responsesLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <div className="w-6 h-6 border-2 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mx-auto mb-2" />
                            <span>Đang tải phiếu khảo sát...</span>
                          </td>
                        </tr>
                      ) : responses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
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
                            <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-800">{item.student_name}</span>
                              {item.grade && (
                                <span className="ml-1 px-1 py-0.2 rounded bg-slate-100 text-[10px] text-slate-600 font-semibold">
                                  L{item.grade}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                              {item.phone}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-700 line-clamp-1 max-w-[150px]">
                              {item.school_name}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {Array.isArray(item.interested_majors) &&
                                  item.interested_majors.map((m: string, mIdx: number) => (
                                    <span
                                      key={mIdx}
                                      className="px-1.5 py-0.2 rounded bg-blue-50 text-[#0f3b7d] text-[10px] font-semibold"
                                    >
                                      {m}
                                    </span>
                                  ))}
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                              {item.created_at}
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
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            Hệ thống Khảo sát Tuyển sinh qua QR • Lưu trực tiếp vào Waypoints
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[5px] border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default CampaignSurveyModal;
