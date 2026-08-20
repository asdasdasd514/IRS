# IRS - Fullstack Application Framework

Dự án Fullstack tích hợp giữa **Frontend** (React + TypeScript + Vite) và **Backend** (Node.js + Express + TypeScript).

---

## 📁 Cấu trúc thư mục

```text
IRS/
├── frontend/             # Giao diện người dùng (React, TypeScript, Vite)
│   ├── src/
│   │   ├── components/   # Các UI Component dùng lại
│   │   ├── pages/        # Trang của ứng dụng
│   │   ├── services/     # Kết nối API HTTP/Axios
│   │   ├── utils/        # Hàm trợ giúp (Helpers)
│   │   ├── App.tsx       # Component chính
│   │   └── main.tsx      # Entry point
│   ├── package.json
│   └── vite.config.ts
├── backend/              # Server RESTful API (Node.js, Express, TypeScript)
│   ├── src/
│   │   ├── config/       # Cấu hình môi trường & DB
│   │   ├── controllers/  # Xử lý logic theo Endpoint
│   │   ├── middlewares/  # Middleware Express (Auth, Error handler, CORS...)
│   │   ├── models/       # Định nghĩa Schema / Data model
│   │   ├── routes/       # Khai báo đường dẫn API
│   │   ├── services/     # Logic nghiệp vụ (Business logic)
│   │   └── app.ts        # Bootstrapping Express App
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
└── README.md
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Cài đặt Dependencies

#### Frontend:
```bash
cd frontend
npm install
```

#### Backend:
```bash
cd backend
npm install
```

### 2. Khởi chạy trong môi trường phát triển (Dev)

#### Backend (Chạy trước ở cổng 5000):
```bash
cd backend
npm run dev
```

#### Frontend (Chạy ở cổng 5173):
```bash
cd frontend
npm run dev
```

---

## ⚙️ Các lệnh hữu ích (Scripts)

| Thư mục | Lệnh | Mô tả |
| :--- | :--- | :--- |
| `frontend` | `npm run dev` | Khởi chạy Vite Dev Server |
| `frontend` | `npm run build` | Đóng gói sản phẩm |
| `backend` | `npm run dev` | Chạy Express server với tự động reload (`ts-node-dev`) |
| `backend` | `npm run build` | Biên dịch TypeScript sang JavaScript |
| `backend` | `npm start` | Chạy ứng dụng production trong `dist/` |
