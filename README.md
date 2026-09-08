# IRS - Nền Tảng Hỗ Trợ Ra Quyết Định Lộ Trình & Quản Lý Chiến Dịch Tuyển Sinh Lưu Động

Hệ thống **IRS (Intelligent Routing System for Admissions)** là nền tảng Fullstack chuyên dụng hỗ trợ các đoàn công tác tuyển sinh lưu động lập kế hoạch, tối ưu hóa hành trình thực địa bằng thuật toán định tuyến động và quản lý toàn diện hồ sơ trường học, chiến dịch tuyển sinh.

---

## 🌟 Tính Năng Cốt Lõi

### 1. Thuật toán Định tuyến Động (Dynamic Next-Hop Routing)
* **Khắc phục hạn chế của TSP tĩnh:** Không sử dụng mô hình TSP cố định cứng nhắc từ đầu; hệ thống liên tục tính toán và gợi ý điểm đến kế tiếp (**Next-Hop**) tối ưu nhất dựa trên vị trí GPS thời gian thực của đoàn xe.
* **Luật ra quyết định đa tiêu chí (Multi-Criteria Selection):** Cân đối giữa thời gian di chuyển và khoảng cách thực tế (ngưỡng 300 giây). Nếu thời gian đến giữa các trường chênh lệch không quá 5 phút nhưng có trường cự ly ngắn hơn đáng kể, hệ thống sẽ ưu tiên chọn trường đó nhằm tiết kiệm nhiên liệu và tránh đi đường vòng.
* **Quy hoạch lộ trình Chiến dịch:** Tự động phân tích toàn bộ danh sách trường mục tiêu, sắp xếp thứ tự ghé thăm tối ưu và tính toán thời gian làm việc/tư vấn tại mỗi trường (mặc định 45 phút/trường). Kết quả tính toán được lưu trữ độc lập vào collection `route_plans`.

### 2. Cơ chế Dự phòng Đa tầng (Fallback Mechanism)
* **Chế độ trực tuyến (Online):** Tích hợp Google Maps Directions API qua SerpAPI để lấy ma trận thời gian thực tế theo tình trạng lưu lượng giao thông đường bộ.
* **Chế độ ngoại tuyến / Dự phòng (Offline Fallback):** Tự động kích hoạt khi mất kết nối Internet, máy chủ ngoài gặp sự cố hoặc chưa cấu hình API Key. Hệ thống sử dụng công thức toán học **Haversine (Great-Circle Distance)** để tính khoảng cách đường chim bay trên mặt cầu Trái Đất kết hợp mô hình vận tốc xe trung bình (30 km/h) và giải thuật **Greedy Nearest-Neighbor**. Cơ chế này chạy 100% bằng CPU nội bộ, đảm bảo hệ thống **hoạt động liên tục, không bao giờ bị treo hay dừng hoạt động ngoài thực địa**.
* **Dự phòng hiển thị bản đồ:** Tự động vẽ đường chỉ hướng trực tiếp từ vị trí hiện tại đến trường học mục tiêu nếu không tải được dữ liệu polyline mặt đường.

### 3. Cơ sở Dữ liệu Tách bạch (8 Collections Chuẩn hóa)
* Dữ liệu được tổ chức theo đúng nguyên tắc chuẩn hóa: tách biệt hoàn toàn giữa Hồ sơ danh bạ trường học (`schools`), Điểm mốc bản đồ (`waypoints`), Kế hoạch chiến dịch (`campaigns`), Điểm dừng thực địa của chuyến đi (`campaign_waypoints`) và Kết quả thuật toán định tuyến (`route_plans`).

### 4. Quản trị & Nghiệp vụ Thực địa Toàn diện
* Xác thực bảo mật chuẩn JWT Token, phân quyền người dùng chặt chẽ giữa Quản trị viên (Admin) và Nhân viên thực địa (Staff).
* Cơ chế xóa mềm (Soft Delete) an toàn trên toàn bộ hệ thống.
* Hỗ trợ đoàn tuyển sinh check-in điểm trường, ghi nhận nhật ký làm việc (visit logs) và thu thập phiếu khảo sát học sinh (tickets).

---

## 🏗️ Kiến Trúc Cơ Sở Dữ Liệu (MongoDB - 8 Collections)

| Collection | Vai trò & Đặc điểm dữ liệu |
| :--- | :--- |
| **`users`** | Tài khoản người dùng, phân quyền (Admin / Staff), mật khẩu băm bcrypt, hỗ trợ xóa mềm. |
| **`campaigns`** | Kế hoạch chiến dịch tuyển sinh (tên chiến dịch, thời gian bắt đầu/kết thúc, ghi chú, trạng thái). |
| **`admission_trips`** | Chuyến đi thực tế thuộc chiến dịch (xe phụ trách, thời gian khởi hành, trạng thái). |
| **`schools`** | Hồ sơ danh bạ trường học gốc: Ban giám hiệu, thông tin tuyển sinh, website, ảnh, ghi chú... |
| **`waypoints`** | Điểm mốc / POI trên bản đồ: Tọa độ GPS (`lat`, `lng`), địa chỉ, loại điểm. Tách biệt hoàn toàn với chuyến đi. |
| **`campaign_waypoints`** | Các điểm/trường sẽ đi trong chiến dịch và chuyến đi: Lưu thứ tự ghé thăm (`visit_order`), trạng thái check-in, nhật ký và phiếu khảo sát. |
| **`route_plans`** | Lưu trữ kết quả của thuật toán Dynamic Next-Hop Routing (`start_point`, danh sách điểm đến đã tối ưu, tổng quãng đường, trạng thái draft / applied). |
| **`trip_reports`** | Báo cáo tổng kết sau chuyến đi (số lượng học sinh tiếp cận, đánh giá hiệu quả). |

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
IRS/
├── backend/                              # Máy chủ API (Python FastAPI + MongoDB)
│   ├── app/
│   │   ├── api/                          # Routers: auth, users, trips, schools, campaigns, route_plans, upload...
│   │   ├── core/                         # Cấu hình hệ thống (config), kết nối DB (database), bảo mật (security)
│   │   ├── schemas/                      # Pydantic Schemas định dạng request/response
│   │   └── services/                     # Business Logic: routing_service, trip_service, auth_service...
│   ├── init_mongo.py                     # Script khởi tạo Database IRS, 8 Collections & Indexes
│   ├── run_init.bat                      # File khởi tạo nhanh Database trên Windows
│   ├── run_backend.bat                   # File khởi chạy nhanh Backend Server trên Windows
│   ├── main.py                           # Điểm khởi động ứng dụng FastAPI
│   ├── requirements.txt                  # Danh sách thư viện Python
│   └── .env                              # Cấu hình biến môi trường Backend
│
├── frontend/                             # Giao diện người dùng (React PWA + TypeScript + Tailwind CSS)
│   ├── public/                           # Static assets, icons & PWA manifest
│   ├── src/
│   │   ├── components/                   # UI Components: Map, BottomSheet, Modal, FloatingButtons...
│   │   ├── pages/                        # Các trang: Home, TripMap, CreateTrip, Admin, Reports...
│   │   ├── services/                     # Axios API clients kết nối Backend
│   │   ├── store/                        # Quản lý state toàn cục (Zustand)
│   │   └── types/                        # TypeScript Interfaces & Types
│   ├── package.json
│   ├── vite.config.ts
│   └── .env                              # Cấu hình biến môi trường Frontend
│
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Chuẩn bị Môi trường
* **Python**: Phiên bản 3.10 trở lên.
* **Node.js**: Phiên bản 18 trở lên (kèm npm).
* **MongoDB Community Server**: Đang chạy dịch vụ trên máy chủ hoặc có URL kết nối MongoDB từ xa.

---

### 2. Cài đặt & Khởi chạy Backend (Python FastAPI)

Mở một cửa sổ dòng lệnh (Terminal / Command Prompt / PowerShell):

1. **Di chuyển vào thư mục backend:**
   ```bash
   cd backend
   ```

2. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Cấu hình biến môi trường (`.env`):**
   Kiểm tra tệp `.env` trong thư mục `backend` và tùy chỉnh thông số kết nối nếu cần

4. **Khởi tạo Cơ sở dữ liệu MongoDB:**
   Chạy lệnh sau để thiết lập 8 collections và tạo chỉ mục tìm kiếm tối ưu:
   ```bash
   python init_mongo.py
   ```
   *(Trên Windows, bạn cũng có thể nhấp đúp chạy nhanh file `.\run_init.bat`)*

5. **Khởi chạy Máy chủ Backend:**
   ```bash
   python main.py
   ```
   *(Hoặc chạy lệnh `uvicorn main:app --reload` / file `.\run_backend.bat`)*

---

### 3. Cài đặt & Khởi chạy Frontend (React PWA)

Mở một cửa sổ dòng lệnh thứ hai:

1. **Di chuyển vào thư mục frontend:**
   ```bash
   cd frontend
   ```

2. **Cài đặt các gói thư viện npm:**
   ```bash
   npm install
   ```

3. **Cấu hình biến môi trường (`.env`):**
   Kiểm tra tệp `.env` trong thư mục `frontend` để đảm bảo kết nối đúng địa chỉ Backend API:
   ```env
   VITE_API_URL=http://localhost:8000/api
   ```
   *(Điều chỉnh cổng khớp với cổng bạn đã cấu hình cho Backend)*

4. **Khởi chạy Ứng dụng Frontend:**
   ```bash
   npm run dev
   ```
---

## 📖 Tài Liệu Giao Diện API (Swagger UI & ReDoc)

Hệ thống tích hợp sẵn giao diện tài liệu tương tác trực quan chuẩn OpenAPI:

* **Swagger UI:** Truy cập `/docs` hoặc `/swagger` trên địa chỉ máy chủ Backend (Ví dụ: `http://localhost:<CỔNG_BACKEND>/docs`).
* **ReDoc:** Truy cập `/redoc` trên địa chỉ máy chủ Backend.

Tất cả các API được phân định rõ ràng theo tiền tố `/api/...`:
* `/api/auth`: Đăng nhập cấp mã truy cập JWT Token và lấy hồ sơ phiên làm việc (`/login`, `/me`).
* `/api/users`: Quản lý tài khoản người dùng, phân quyền Admin/Staff, xóa mềm.
* `/api/campaigns`: Quản lý kế hoạch chiến dịch, chạy thuật toán định tuyến động (`/optimize-route`), triển khai thành chuyến đi (`/deploy`).
* `/api/route-plans`: Quản lý, truy vấn và lưu trữ các phương án lộ trình tối ưu.
* `/api/schools`: Danh bạ hồ sơ trường học, thông tin ban giám hiệu, tuyển sinh, website, ảnh.
* `/api/trips`: Điều phối chuyến đi thực địa, gợi ý điểm tiếp theo theo thời gian thực (`/next-hop`), check-in điểm trường.
* `/api/waypoints`: Quản lý tọa độ mốc bản đồ POI.

---

## 🔑 Tài Khoản Quản Trị Mặc Định

Sau khi chạy lệnh khởi tạo cơ sở dữ liệu `init_mongo.py`, hệ thống tự động thiết lập sẵn một tài khoản Quản trị viên gốc để đăng nhập lần đầu:

* **Tên đăng nhập (Username):** `admin`
* **Mật khẩu (Password):** `admin123`
* **Vai trò (Role):** `admin` (Toàn quyền quản trị hệ thống)
