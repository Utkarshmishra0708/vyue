import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, AdminRoute } from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import LeadsPage from './pages/LeadsPage';
import DashboardPage from './pages/DashboardPage';
import ForecastPage from './pages/ForecastPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { GLOBAL_CSS } from './globalStyles';

export default function App() {
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forecast" element={<ForecastPage />} />

            {/* Authenticated — any role */}
            <Route path="/leads"            element={<PrivateRoute><LeadsPage /></PrivateRoute>} />
            <Route path="/dashboard"        element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/change-password"  element={<PrivateRoute><ChangePasswordPage /></PrivateRoute>} />

            {/* Admin/PMO only */}
            <Route path="/reports"          element={<AdminRoute><ReportsPage /></AdminRoute>} />
            <Route path="/settings"         element={<AdminRoute><SettingsPage /></AdminRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/leads" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}
