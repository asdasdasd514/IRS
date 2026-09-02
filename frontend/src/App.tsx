import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage, TripMapPage, CreateTripPage, EditTripPage, LoginPage, AdminPage } from './pages';
import { ReportPage } from './pages/Report';
import { ReportsListPage } from './pages/ReportsList';
import { useAppStore } from './store/useAppStore';
import { useEffect } from 'react';
import { authApi } from './services/api';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAppStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { token, setAuth } = useAppStore();

  // Check token validity on mount
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPage />} />

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
    </Routes>
  );
}

export default App;
