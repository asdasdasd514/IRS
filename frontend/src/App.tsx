import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { HomePage } from './pages/Home/HomePage';
import { TripMapPage } from './pages/TripMap/TripMapPage';
import { CreateTripPage } from './pages/CreateTrip/CreateTripPage';
import { EditTripPage } from './pages/EditTrip/EditTripPage';
import { LoginPage } from './pages/Auth/Login/LoginPage';
import { RegisterPage } from './pages/Auth/Register/RegisterPage';
import { AdminMapPage } from './pages/Admin/Map/AdminMapPage';
import { AdminCampaignsPage } from './pages/Admin/Campaigns/AdminCampaignsPage';
import { AdminLocationsPage } from './pages/Admin/Locations/AdminLocationsPage';
import { AdminSchoolDetailPage } from './pages/Admin/Locations/AdminSchoolDetailPage';
import { AdminMembersPage } from './pages/Admin/Members/AdminMembersPage';
import { AdminLogsPage } from './pages/Admin/Logs/AdminLogsPage';
import { ReportPage } from './pages/Report/ReportPage';
import { ReportsListPage } from './pages/ReportsList/ReportsListPage';
import { StaffCampaignsPage } from './pages/Staff/StaffCampaignsPage';
import { MainLayout } from './layouts/MainLayout';
import { useAppStore } from './store/useAppStore';
import { authApi } from './services/api';

// Loading Screen khi xác thực token
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-9 h-9 border-3 border-blue-600/30 border-t-[#0f3b7d] rounded-full animate-spin mb-3" />
      <p className="text-xs font-semibold text-slate-500">Đang kiểm tra phiên đăng nhập...</p>
    </div>
  );
}

// Route Guard kiểm tra đăng nhập cho Field Staff
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user, authChecked } = useAppStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Đang kiểm tra token lần đầu nếu chưa có thông tin user
  if (!user && !authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Route Guard cho giao diện chính có Layout & Sidebar (Hỗ trợ cả Admin & Staff)
function PortalLayoutRoute({ children }: { children: React.ReactNode }) {
  const { token, user, authChecked } = useAppStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user && !authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Route Guard chỉ dành cho Quản trị viên (Admin RBAC)
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { token, user, authChecked } = useAppStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user && !authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user?.role === 'admin' || user?.is_admin;
  if (!isAdmin) {
    return <Navigate to="/staff/campaigns" replace />;
  }

  return <>{children}</>;
}

// Public Route Guard (Nếu đã đăng nhập mà vào /login hay /register thì giữ ở trang tương ứng)
function PublicAuthRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAppStore();

  if (token && user) {
    const isAdmin = user.role === 'admin' || user.is_admin;
    return <Navigate to={isAdmin ? "/admin/map" : "/staff/campaigns"} replace />;
  }

  return <>{children}</>;
}

// Điều hướng trang gốc "/"
function RootRoute() {
  const { token, user, authChecked } = useAppStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user && !authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'admin' || user.is_admin;
  if (isAdmin) {
    return <Navigate to="/admin/map" replace />;
  }

  // Cán bộ thực địa: chuyển thẳng tới trang Chiến dịch phân bổ của Staff!
  return <Navigate to="/staff/campaigns" replace />;
}

function App() {
  const { token, setAuth, setAuthChecked } = useAppStore();

  // Kiểm tra tính hợp lệ của token khi khởi động
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const user = await authApi.getMe();
          setAuth(user, token);
        } catch (err) {
          console.error('Session expired or invalid:', err);
          setAuth(null, null);
        }
      } else {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  return (
    <Routes>
      {/* Auth Routes */}
      <Route
        path="/login"
        element={
          <PublicAuthRoute>
            <LoginPage />
          </PublicAuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicAuthRoute>
            <RegisterPage />
          </PublicAuthRoute>
        }
      />

      {/* Admin Module with shared Layout & Sidebar */}
      <Route
        path="/admin"
        element={
          <PortalLayoutRoute>
            <MainLayout />
          </PortalLayoutRoute>
        }
      >
        <Route index element={<Navigate to="/admin/map" replace />} />
        <Route path="map" element={<AdminMapPage />} />
        <Route
          path="campaigns"
          element={
            <AdminOnlyRoute>
              <AdminCampaignsPage />
            </AdminOnlyRoute>
          }
        />
        <Route
          path="locations"
          element={
            <AdminOnlyRoute>
              <AdminLocationsPage />
            </AdminOnlyRoute>
          }
        />
        <Route path="locations/:schoolId" element={<AdminSchoolDetailPage />} />
        <Route
          path="members"
          element={
            <AdminOnlyRoute>
              <AdminMembersPage />
            </AdminOnlyRoute>
          }
        />
        <Route path="logs" element={<AdminLogsPage />} />
        <Route path="settings" element={<AdminMembersPage />} />
      </Route>

      {/* Staff Dedicated Module with shared Layout & Sidebar */}
      <Route
        path="/staff"
        element={
          <PortalLayoutRoute>
            <MainLayout />
          </PortalLayoutRoute>
        }
      >
        <Route index element={<Navigate to="/staff/campaigns" replace />} />
        <Route path="campaigns" element={<StaffCampaignsPage />} />
      </Route>

      {/* Root Route: Phân quyền điều hướng khi vào trang chủ / */}
      <Route path="/" element={<RootRoute />} />

      {/* Field / Staff Protected Routes */}
      <Route
        path="/trips"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/new"
        element={
          <ProtectedRoute>
            <CreateTripPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/:tripId"
        element={
          <ProtectedRoute>
            <TripMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/:tripId/edit"
        element={
          <ProtectedRoute>
            <EditTripPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:reportId"
        element={
          <ProtectedRoute>
            <ReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schools/:schoolId"
        element={
          <ProtectedRoute>
            <AdminSchoolDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
