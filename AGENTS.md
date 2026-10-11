# IRS Project - Quy Định Phát Triển & Thuật Ngữ Hệ Thống

## 1. Quy tắc về tên gọi trường học (BẮT BUỘC)
- **Tuyệt đối KHÔNG gán cứng chữ "THPT"** vào các nhãn hiển thị (UI labels), tiêu đề (headings), placeholders, cột bảng (table headers), xuất file Excel, hoặc giá trị fallback trong toàn bộ hệ thống.
- **Lý do**: Hệ thống phục vụ công tác tuyển sinh đối với đa dạng các cấp trường: **Trường THPT, Trung tâm GDTX, Trường Cao đẳng, Trường Đại học**.
- **Quy chuẩn danh xưng thay thế**:
  - Dùng **"Điểm trường"**, **"Trường"**, hoặc **"Trường học"** (Ví dụ: *"Điểm trường đã tiếp cận"*, *"Tất cả điểm trường"*, *"Chọn điểm trường"*, *"Điểm trường mục tiêu"* thay vì *"Trường THPT"*).
  - Khi hiển thị fallback hoặc mã trường, dùng `'Điểm trường'` hoặc `'TRƯỜNG'` thay vì `'THPT'`.
