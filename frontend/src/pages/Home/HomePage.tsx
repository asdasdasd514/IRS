import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Trash2, Play, CheckCircle2, HelpCircle, X, ArrowRight, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

import { tripApi } from '../../services/api';
import type { TripListItem } from '../../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAppStore();
  const [showGuide, setShowGuide] = useState(false);

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      logout();
      navigate('/login');
    }
  };

  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripApi.getTrips(),
  });

  const deleteMutation = useMutation({
    mutationFn: (tripId: string) => tripApi.deleteTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const handleDelete = (trip: TripListItem) => {
    if (window.confirm(`Xóa chuyến đi "${trip.name}"?`)) {
      deleteMutation.mutate(trip.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Đang chạy
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            Hoàn thành
          </span>
        );
      case 'paused':
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            Tạm dừng
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-500 text-white px-4 py-6 safe-area-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Position Module</h1>
            <p className="text-primary-100">Hệ thống định tuyến tuyển sinh</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Guide hint */}
            <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg animate-pulse">
              <span className="text-sm font-medium text-white whitespace-nowrap">
                Muốn xem hướng dẫn? Bấm đây nè
              </span>
              <ArrowRight className="w-4 h-4 animate-bounce" style={{ animationDirection: 'alternate' }} />
            </div>
            <button
              onClick={() => setShowGuide(true)}
              className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl transform hover:scale-110"
              title="Hướng dẫn sử dụng"
            >
              <HelpCircle className="w-6 h-6 text-primary-700" />
            </button>
            <button
              onClick={handleLogout}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all shadow-lg text-white"
              title="Đăng xuất"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-24">
        {/* Trip list */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Chuyến đi của bạn</h2>

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="spinner" />
          </div>
        )}

        {!isLoading && trips?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Chưa có chuyến đi nào</p>
            <p className="text-sm">Bấm nút + ở góc dưới bên phải để tạo chuyến đi đầu tiên</p>
          </div>
        )}

        <div className="space-y-3">
          {trips?.map((trip) => (
            <div
              key={trip.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => navigate(`/trips/${trip.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">{trip.name}</h3>
                  {getStatusBadge(trip.status)}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {trip.total_waypoints} điểm
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {trip.school_visited_count}/{trip.school_count} trường đã đi
                  </span>
                  {trip.total_tickets > 0 && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      🎫 {trip.total_tickets} phiếu
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{
                      width: `${trip.total_waypoints > 0
                          ? (trip.visited_count / trip.total_waypoints) * 100
                          : 0
                        }%`,
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t">
                <button
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span className="font-medium">Mở</span>
                </button>
                <div className="w-px bg-gray-200" />
                <button
                  onClick={() => handleDelete(trip)}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">📖 Hướng dẫn sử dụng hệ thống</h2>
              <button
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 1. Tạo chuyến đi */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">1️⃣ Tạo chuyến đi mới</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Bấm nút <strong>"Tạo chuyến đi mới"</strong> ở trang chính</li>
                  <li>• Nhập tên chuyến đi (VD: "Tuyển sinh Tây Ninh đợt 1")</li>
                  <li>• <strong>Thêm điểm dừng:</strong>
                    <ul className="ml-6 mt-1 space-y-1">
                      <li>- Nhập tên trường/địa điểm</li>
                      <li>- Nhập tọa độ (Latitude, Longitude)</li>
                      <li>- Chọn loại: <span className="text-blue-600">Trường học</span>, <span className="text-purple-600">Khách sạn</span>, <span className="text-gray-600">Trụ sở</span>, hoặc <span className="text-amber-600">Điểm dừng chân</span></li>
                      <li>- Bấm "Thêm" để thêm vào danh sách</li>
                    </ul>
                  </li>
                  <li>• Bấm <strong>"Tạo chuyến đi"</strong> khi đã thêm đủ điểm</li>
                </ul>
              </div>

              {/* 2. Xem bản đồ */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">2️⃣ Xem và điều hướng trên bản đồ</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Bấm <strong>"Mở"</strong> trên chuyến đi → Hiển thị bản đồ</li>
                  <li>• <strong>Hệ thống tự động gợi ý:</strong>
                    <ul className="ml-6 mt-1 space-y-1">
                      <li>- Trường gần nhất từ vị trí hiện tại</li>
                      <li>- Thời gian di chuyển (dựa vào traffic thực tế)</li>
                      <li>- Khoảng cách</li>
                      <li>- Đường đi được vẽ trên bản đồ</li>
                    </ul>
                  </li>
                  <li>• <strong>3 nút bên phải bản đồ:</strong>
                    <ul className="ml-6 mt-1 space-y-1">
                      <li>- 🔄 <strong>Tính lại:</strong> Cập nhật gợi ý và đường đi</li>
                      <li>- 📍 <strong>Về vị trí của tôi:</strong> Di chuyển bản đồ về vị trí hiện tại</li>
                      <li>- 🏨 <strong>Về khách sạn:</strong> Tìm waypoint khách sạn gần nhất</li>
                    </ul>
                  </li>
                </ul>
              </div>

              {/* 3. Check-in */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">3️⃣ Check-in khi đến trường</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Khi đến gần trường (&lt; 50m), hệ thống sẽ cho phép check-in</li>
                  <li>• Bấm nút <strong className="text-green-600">"Check-in"</strong> ở thanh dưới</li>
                  <li>• Sau khi check-in:
                    <ul className="ml-6 mt-1 space-y-1">
                      <li>- Điểm đó được đánh dấu "Đã đến"</li>
                      <li>- Hệ thống tự động tính trường tiếp theo</li>
                    </ul>
                  </li>
                </ul>
              </div>

              {/* 4. Thêm thông tin chi tiết */}
              <div className="border-l-4 border-amber-500 pl-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">4️⃣ Thêm thông tin chi tiết (CHỈ trên bản đồ)</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• <strong>Ấn vào marker (điểm) trên bản đồ</strong> → Mở modal thông tin</li>
                  <li>• <strong>3 Tab thông tin:</strong></li>
                  <li className="ml-6">
                    <strong>📋 Tab "Thông tin chi tiết":</strong>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>- Thông tin BGH (Hiệu trưởng, Phó HT)</li>
                      <li>- Người liên hệ của mình</li>
                      <li>- Quá trình liên lạc</li>
                      <li>- Ghi chú</li>
                    </ul>
                  </li>
                  <li className="ml-6">
                    <strong>🏫 Tab "Lịch sử":</strong>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>- Ghi lại từng lần đến thăm</li>
                      <li>- Nội dung buổi gặp</li>
                      <li>- Có thể thêm ảnh (tối đa 5 ảnh/lần)</li>
                    </ul>
                  </li>
                  <li className="ml-6">
                    <strong>🎫 Tab "Phiếu"</strong> (CHỈ có ở Trường học):
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>- Ghi lại số phiếu thu được mỗi lần đến</li>
                      <li>- Lần thứ mấy</li>
                      <li>- Ngày thu</li>
                    </ul>
                  </li>
                </ul>
              </div>

              {/* 5. Thêm điểm dừng chân */}
              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">5️⃣ Thêm điểm dừng chân khi đang đi</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Vào <strong>Menu</strong> (3 chấm) → <strong>Chỉnh sửa chuyến đi</strong></li>
                  <li>• Bấm nút <strong className="text-amber-600">"Dừng chân"</strong></li>
                  <li>• Nhập tên (VD: "Quán cơm Bà Hai")</li>
                  <li>• Tọa độ tự động lấy vị trí hiện tại</li>
                  <li>• Thông tin chi tiết thêm sau trên bản đồ</li>
                </ul>
              </div>

              {/* 6. Phân biệt loại điểm */}
              <div className="border-l-4 border-gray-500 pl-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">6️⃣ Phân biệt các loại điểm dừng</h3>
                <div className="space-y-2 text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏫</span>
                    <strong className="text-blue-600">Trường học:</strong>
                    <span>Có đầy đủ 3 tab (Chi tiết + Lịch sử + Phiếu), tham gia thuật toán routing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏨</span>
                    <strong className="text-purple-600">Khách sạn:</strong>
                    <span>Có 2 tab (Chi tiết + Lịch sử), KHÔNG routing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">☕</span>
                    <strong className="text-amber-600">Dừng chân:</strong>
                    <span>Có 2 tab, KHÔNG routing, chỉ để ghi log lộ trình</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏢</span>
                    <strong className="text-gray-600">Trụ sở:</strong>
                    <span>Có 2 tab, KHÔNG routing</span>
                  </div>
                </div>
              </div>

              {/* Lưu ý quan trọng */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-bold text-red-800 mb-2">⚠️ Lưu ý quan trọng</h3>
                <ul className="space-y-1 text-red-700">
                  <li>• <strong>PHẢI ấn vào marker trên bản đồ</strong> mới có thể thêm thông tin chi tiết, lịch sử, phiếu</li>
                  <li>• Khi tạo chuyến đi/thêm điểm, chỉ cần nhập tên và tọa độ</li>
                  <li>• Thuật toán routing chỉ tính cho <strong>Trường học</strong>, bỏ qua các loại khác</li>
                  <li>• Hệ thống cache vị trí: di chuyển &lt; 10m sẽ không gọi lại API (tiết kiệm)</li>
                </ul>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full bg-primary-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-primary-600"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button - Tạo chuyến đi mới */}
      <button
        onClick={() => navigate('/trips/new')}
        className="fixed bottom-6 right-6 w-16 h-16 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-110 flex items-center justify-center z-50"
        title="Tạo chuyến đi mới"
      >
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
};

export default HomePage;
