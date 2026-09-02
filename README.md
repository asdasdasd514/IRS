# IRS Mobile Admissions System - Fullstack Application Framework

Hệ thống **Phát triển Nền tảng Hỗ trợ Ra quyết định Lộ trình và Quản lý Chiến dịch Tuyển sinh Lưu động** (Position Module & Admissions Route Management).

---

## 📁 Cấu trúc Thư mục Dự án

```text
IRS/
├── backend/                              # Server RESTful API (Python FastAPI + MongoDB IRS)
│   ├── app/                              # Code API, Models & Services
│   ├── init_mongo.py                     # Script tạo Database IRS, Collections, Unique Indexes & Mock Data
│   ├── run_init.bat                      # File chạy nhanh tạo database trên Windows
│   ├── run_backend.bat                   # File chạy nhanh Server FastAPI trên Windows
│   ├── main.py                           # FastAPI Server Launcher
│   ├── requirements.txt                  # Python Dependencies
│   └── .env                              # Biến môi trường Server (Port 8000, Mongo URL...)
│
├── frontend/                             # Giao diện người dùng (React 18 PWA + TypeScript + Tailwind CSS)
│   ├── public/                           # Static Assets & Manifest PWA
│   ├── src/                              # Pages, Components, State (Zustand, React Query)
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── irs-main/                             # Thư mục chứa mã nguồn gốc tham khảo
├── .gitignore
└── README.md
```

---

## 🚀 Hướng dẫn Khởi chạy Hệ thống

### 1. Cài đặt & Khởi tạo Backend (Python FastAPI)

Mở Cửa sổ Terminal thứ 1:

1. Di chuyển vào thư mục `backend`:
   ```powershell
   cd backend
   ```
2. Khởi tạo Cơ sở dữ liệu MongoDB (`IRS`):
   ```powershell
   & "C:\Users\HP\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" init_mongo.py
   ```
   *(Hoặc chạy file `.\run_init.bat`)*

3. Khởi chạy Server Backend ở cổng `8000`:
   ```powershell
   & "C:\Users\HP\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" main.py
   ```
   *(Hoặc chạy file `.\run_backend.bat`)*

   > 💡 Truy cập **Swagger UI API Documentation**: `http://localhost:8000/docs`

---

### 2. Cài đặt & Khởi chạy Frontend (React PWA)

Mở Cửa sổ Terminal thứ 2:

1. Di chuyển vào thư mục `frontend`:
   ```powershell
   cd frontend
   ```
2. Khởi chạy Vite Dev Server ở cổng `5173`:
   ```powershell
   npm run dev
   ```
   > 💡 Truy cập giao diện ứng dụng tại: `http://localhost:5173`

---

## 🔑 Tài khoản Đăng nhập Mặc định

* **Tên đăng nhập (Username)**: `admin`
* **Mật khẩu (Password)**: `admin123`
