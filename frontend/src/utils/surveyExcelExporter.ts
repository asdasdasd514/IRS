import * as XLSX from 'xlsx';

export interface SurveyExportItem {
  id?: string;
  student_name: string;
  phone: string;
  grade?: string;
  school_name?: string;
  campaign_name?: string;
  trip_name?: string;
  interested_majors?: string[];
  answers?: Record<string, any>;
  notes?: string;
  source?: string;
  created_at?: string;
}

/**
 * Xuất danh bạ học sinh điền phiếu khảo sát qua QR ra file Excel (.xlsx)
 * Tự động tạo các cột cho các câu hỏi tùy biến động (Google Form style)
 */
export const exportSurveysToExcel = (
  items: SurveyExportItem[],
  campaignName?: string
) => {
  const wb = XLSX.utils.book_new();

  const exportDate = new Date().toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const title = campaignName
    ? `DANH SÁCH HỌC SINH KHẢO SÁT - CHIẾN DỊCH: ${campaignName.toUpperCase()}`
    : 'DANH SÁCH HỌC SINH ĐIỀN PHIẾU KHẢO SÁT NGUYỆN VỌNG TUYỂN SINH';

  // Thu thập tất cả các câu hỏi tùy biến trong mảng answers (loại trừ các trường cơ bản đã có cột)
  const customQuestionKeys = new Set<string>();
  items.forEach((item) => {
    if (item.answers && typeof item.answers === 'object') {
      Object.keys(item.answers).forEach((k) => {
        if (!['student_name', 'phone', 'grade', 'majors', 'notes'].includes(k)) {
          customQuestionKeys.add(k);
        }
      });
    }
  });
  const customQuestionsList = Array.from(customQuestionKeys);

  const headerRow: string[] = [
    'STT',
    'Họ và tên học sinh',
    'Số điện thoại',
    'Lớp',
    'Điểm trường',
    'Chiến dịch tuyển sinh',
    'Đợt thực địa',
    'Ngành học quan tâm',
    ...customQuestionsList,
    'Ghi chú / Nguyện vọng khác',
    'Nguồn thu',
    'Thời gian gửi',
  ];

  const sheetRows: any[][] = [
    [title],
    [`Thời điểm xuất báo cáo: ${exportDate}`],
    [`Tổng số phiếu thu được: ${items.length} học sinh`],
    [],
    headerRow,
  ];

  items.forEach((item, index) => {
    // Đảm bảo số điện thoại luôn giữ số 0 ở đầu
    let phoneStr = item.phone || '';
    if (phoneStr && !phoneStr.startsWith("'") && !phoneStr.startsWith("0")) {
      phoneStr = '0' + phoneStr;
    }

    const majorsStr = Array.isArray(item.interested_majors)
      ? item.interested_majors.join(', ')
      : (item.interested_majors || '');

    // Giá trị các câu hỏi tùy biến
    const customValues = customQuestionsList.map((qKey) => {
      const val = item.answers?.[qKey];
      if (val === undefined || val === null) return '';
      if (Array.isArray(val)) return val.join(', ');
      return String(val);
    });

    sheetRows.push([
      index + 1,
      item.student_name || 'Học sinh',
      phoneStr,
      item.grade || '',
      item.school_name || 'Chưa cập nhật',
      item.campaign_name || 'Chiến dịch tuyển sinh',
      item.trip_name || '',
      majorsStr,
      ...customValues,
      item.notes || '',
      item.source === 'QR_ONLINE' ? 'Mã QR Online' : (item.source || 'Trực tiếp'),
      item.created_at || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);

  // Định dạng độ rộng cột (Column Widths)
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 24 }, // Họ tên
    { wch: 14 }, // SĐT
    { wch: 8 },  // Lớp
    { wch: 28 }, // Điểm trường
    { wch: 26 }, // Chiến dịch
    { wch: 20 }, // Đợt
    { wch: 36 }, // Ngành quan tâm
    { wch: 28 }, // Ghi chú
    { wch: 15 }, // Nguồn
    { wch: 18 }, // Thời gian
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học sinh');

  const safeFileName = (campaignName || 'tat_ca')
    .replace(/[^a-zA-Z0-9_\u00C0-\u1EF9-]/g, '_')
    .toLowerCase();
  
  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `khao_sat_tuyen_sinh_${safeFileName}_${todayStr}.xlsx`);
};
