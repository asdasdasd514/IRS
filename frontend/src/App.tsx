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
import { AdminMembersPage } from './pages/Admin/Members/AdminMembersPage';
import { AdminLogsPage } from './pages/Admin/Logs/AdminLogsPage';
import { ReportPage } from './pages/Report/ReportPage';
import { ReportsListPage } from './pages/ReportsList/ReportsListPage';
import { MainLayout } from './layouts/MainLayout';
import { useAppStore } from './store/useAppStore';
import { authApi } from './services/api';

// Route Guard kiểm tra đăng nhập
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAppStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Route Guard phân quyền Quản trị viên (RBAC)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAppStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user?.role === 'admin' || user?.is_admin;
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { token, setAuth } = useAppStore();

  // Kiểm tra tính hợp lệ của token khi khởi động
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const user = await authApi.getMe();
          setAuth(user, token);
        } catch (err) {
          setAuth(null, null);
        }
      }
    };
    checkAuth();
  }, []);

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Admin Module with shared Layout & Sidebar */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <MainLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/map" replace />} />
        <Route path="map" element={<AdminMapPage />} />
        <Route path="campaigns" element={<AdminCampaignsPage />} />
        <Route path="locations" element={<AdminLocationsPage />} />
        <Route path="members" element={<AdminMembersPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
        <Route path="settings" element={<AdminMembersPage />} />
      </Route>

      {/* Field / Staff Protected Routes */}
      <Route
        path="/"
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

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
