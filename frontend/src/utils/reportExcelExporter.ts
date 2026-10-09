import * as XLSX from 'xlsx';
import type { Report } from '../types';

/**
 * Xuất file Excel báo cáo chuyến đi lẻ (tinh gọn 7 cột, không quán ăn, không tỷ lệ %)
 */
export const exportReportToExcel = (report: Report | any) => {
  const wb = XLSX.utils.book_new();

  const tripName = report.trip_name || 'Lộ trình tuyển sinh';
  const tripCode = report.trip_code || report.trip_id || '';
  const createdDate = report.created_at
    ? new Date(report.created_at).toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : new Date().toLocaleString('vi-VN');

  const totalSchools = report.total_schools || 0;
  const schoolsVisited = report.schools_visited || 0;
  const totalTickets = report.total_tickets || 0;

  // Sheet 1: Báo cáo kết quả công tác
  const sheetRows: any[][] = [
    ['BÁO CÁO CÔNG TÁC TUYỂN SINH THỰC ĐỊA'],
    [],
    ['1. THÔNG TIN CHUNG'],
    ['Tên chuyến đi:', tripName],
    ['Mã chuyến đi:', tripCode],
    ['Mã chiến dịch liên kết:', report.campaign_id || 'N/A'],
    ['Thời điểm lập báo cáo:', createdDate],
    ['Trạng thái chuyến đi:', 'Hoàn thành'],
    [],
    ['2. KẾT QUẢ NHANH'],
    ['Chỉ số đánh giá', 'Kết quả thực đạt', 'Đơn vị tính', 'Ghi chú'],
    ['Số trường mục tiêu', totalSchools, 'Trường', 'Toàn bộ điểm trường được quy hoạch'],
    ['Số trường đã tiếp cận thành công', schoolsVisited, 'Trường', 'Đã làm việc và tư vấn trực tiếp'],
    ['Tổng số phiếu tuyển sinh thu được', totalTickets, 'Phiếu', 'Tổng hợp từ các buổi làm việc thực địa'],
    [],
    ['3. BẢNG KẾT QUẢ THỰC ĐỊA CÁC ĐIỂM TRƯỜNG'],
    [
      'STT',
      'Tên trường học',
      'Địa chỉ',
      'Thời gian ghé',
      'Ban Giám Hiệu / Người tiếp đón',
      'Số phiếu thu',
      'Ghi chú / Đánh giá thực địa',
    ],
  ];

  const schools = report.schools_data || [];
  if (schools.length > 0) {
    schools.forEach((s: any, idx: number) => {
      const ticketsCount =
        (s.tickets || []).reduce((acc: number, t: any) => acc + (t.tickets_collected || 0), 0) ||
        s.tickets_collected ||
        0;
      const visitedTime = s.visited_at
        ? new Date(s.visited_at).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh',
          })
        : (s.is_visited ? 'Đã hoàn tất' : 'Chưa tiếp cận');

      const contacts: string[] = [];
      if (s.principal_name) contacts.push(`HT: ${s.principal_name}${s.principal_phone ? ` (${s.principal_phone})` : ''}`);
      if (s.vice_principal_name) contacts.push(`Phó HT: ${s.vice_principal_name}${s.vice_principal_phone ? ` (${s.vice_principal_phone})` : ''}`);
      if (s.representative_name) contacts.push(`Đại diện: ${s.representative_name}`);
      const contactStr = contacts.length > 0 ? contacts.join('; ') : (s.contact_name || s.phone || 'Chưa cập nhật');

      const notes = s.notes || s.contact_process || (s.is_visited ? 'Đã hoàn tất tiếp cận và thu phiếu' : 'Chưa tiếp cận');

      sheetRows.push([
        idx + 1,
        s.name || '',
        s.address || 'Chưa có địa chỉ',
        visitedTime,
        contactStr,
        ticketsCount,
        notes,
      ]);
    });

    sheetRows.push([
      'TỔNG',
      `${schools.length} trường`,
      '',
      '',
      '',
      totalTickets,
      '',
    ]);
  } else {
    sheetRows.push([1, 'Chưa có thông tin điểm trường', '', '', '', 0, '']);
  }

  sheetRows.push([]);
  sheetRows.push(['4. NHẬN XÉT & ĐỀ XUẤT CỦA ĐOÀN CÔNG TÁC']);
  sheetRows.push(['- Thuận lợi: Ban Giám hiệu các trường nhiệt tình đón tiếp; học sinh chủ động tìm hiểu các chuyên ngành.']);
  sheetRows.push([`- Tổng số phiếu thu thập được: ${totalTickets} phiếu.`]);
  sheetRows.push(['- Đề xuất: Bàn giao phiếu thu thập cho bộ phận tuyển sinh tiến hành tư vấn chuyên sâu 1-1.']);

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 42 },
    { wch: 22 },
    { wch: 35 },
    { wch: 14 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo chuyến đi');

  const safeTitle = tripName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const nowStr = new Date().toISOString().slice(0, 10);
  const filename = `Bao_cao_${safeTitle || 'trip'}_${nowStr}.xlsx`;

  XLSX.writeFile(wb, filename);
};

/**
 * Xuất file Excel Báo Cáo Tổng Hợp Toàn Chiến Dịch (2 Bảng: Theo đợt + Tích lũy theo trường)
 */
export const exportCampaignSummaryToExcel = (summary: any) => {
  const wb = XLSX.utils.book_new();

  const cName = summary.campaign_name || 'Chiến dịch tuyển sinh';
  const cCode = summary.campaign_code || summary.campaign_id || '';
  const totalRounds = summary.total_rounds || 0;
  const totalSchools = summary.total_schools || 0;
  const totalTickets = summary.total_tickets || 0;

  const rows: any[][] = [
    ['BÁO CÁO TỔNG HỢP TOÀN CHIẾN DỊCH TUYỂN SINH'],
    [],
    ['1. THÔNG TIN CHIẾN DỊCH'],
    ['Tên chiến dịch:', cName],
    ['Mã chiến dịch:', cCode],
    ['Thời gian thực hiện:', summary.start_date ? `${summary.start_date} - ${summary.end_date || ''}` : '2026'],
    ['Quy mô thực hiện:', `${totalRounds} đợt công tác`],
    ['Số trường mục tiêu:', `${totalSchools} trường`],
    ['Tổng số phiếu tích lũy:', `${totalTickets} phiếu`],
    [],
    ['2. BẢNG 1: TỔNG HỢP TIẾN ĐỘ & PHIẾU THU THEO TỪNG ĐỢT'],
    [
      'Đợt',
      'Mã chuyến đi',
      'Tên chuyến đi',
      'Ngày thực hiện',
      'Trưởng đoàn',
      'Số trường ghé',
      'Số phiếu thu',
      'Trạng thái',
    ],
  ];

  const rounds = summary.rounds_data || [];
  if (rounds.length > 0) {
    rounds.forEach((r: any) => {
      rows.push([
        r.round_name || `Đợt ${r.round_number}`,
        r.trip_code || r.trip_id || '',
        r.trip_name || '',
        r.date || '',
        r.leader_name || 'Chưa phân công',
        r.schools_count || 0,
        r.tickets_collected || 0,
        r.status || 'Hoàn thành',
      ]);
    });
    rows.push([
      'TỔNG CỘNG',
      '',
      `${totalRounds} đợt công tác`,
      '',
      '',
      `${totalSchools} trường`,
      totalTickets,
      '',
    ]);
  } else {
    rows.push(['Không có đợt công tác nào', '', '', '', '', 0, 0, '']);
  }

  rows.push([]);
  rows.push(['3. BẢNG 2: TỔNG HỢP KẾT QUẢ TÍCH LŨY THEO TỪNG ĐIỂM TRƯỜNG']);
  rows.push([
    'STT',
    'Tên trường học',
    'Địa chỉ',
    'Các đợt đã ghé',
    'Tổng phiếu thu tích lũy',
    'Ban Giám Hiệu / Người liên hệ',
    'Ghi chú đánh giá chung',
  ]);

  const schools = summary.schools_data || [];
  if (schools.length > 0) {
    schools.forEach((s: any, idx: number) => {
      rows.push([
        idx + 1,
        s.name || '',
        s.address || 'Chưa có địa chỉ',
        s.rounds_display || `${s.total_visits || 0} lần`,
        s.total_tickets || 0,
        s.contact_person || 'Chưa cập nhật',
        s.notes || '',
      ]);
    });
    rows.push([
      'TỔNG',
      `${schools.length} trường đối tác`,
      '',
      '',
      totalTickets,
      '',
      '',
    ]);
  } else {
    rows.push([1, 'Chưa có dữ liệu trường học', '', '', 0, '', '']);
  }

  rows.push([]);
  rows.push(['4. ĐÁNH GIÁ CHUNG TOÀN CHIẾN DỊCH']);
  rows.push([`- Toàn chiến dịch đã hoàn thành ${totalRounds} đợt công tác tại ${totalSchools} điểm trường đối tác.`]);
  rows.push([`- Tổng số phiếu tuyển sinh thu được: ${totalTickets} phiếu.`]);
  rows.push(['- Chiến dịch đạt hiệu quả cao, các điểm trường đều duy trì mối quan hệ hợp tác tốt đẹp với nhà trường.']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 38 },
    { wch: 24 },
    { wch: 22 },
    { wch: 32 },
    { wch: 16 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp toàn chiến dịch');

  const safeTitle = cName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const nowStr = new Date().toISOString().slice(0, 10);
  const filename = `Bao_cao_tong_hop_${safeTitle || 'campaign'}_${nowStr}.xlsx`;

  XLSX.writeFile(wb, filename);
};
