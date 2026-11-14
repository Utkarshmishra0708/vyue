import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, AdminRoute, ModuleRoute, BusinessUnitRoute, SuperAdminRoute, PickerRoute } from './components/PrivateRoute';
import BusinessPickerPage from './pages/BusinessPickerPage';
import OrganizationSettingsPage from './pages/OrganizationSettingsPage';
import LoginPage from './pages/LoginPage';
import BusinessUnitsPage from './pages/BusinessUnitsPage';
import LeadsPage from './pages/LeadsPage';
import CustomersPage from './pages/CustomersPage';
import DashboardPage from './pages/DashboardPage';
import ForecastPage from './pages/ForecastPage';
import ActivityPage from './pages/ActivityPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import VocPage from './pages/VocPage';
import ActivitiesPage from './pages/ActivitiesPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import CampaignsPage from './pages/CampaignsPage';
import { GLOBAL_CSS } from './globalStyles';
import { BASE_PATH } from './env';

export default function App() {
  useEffect(() => {
    const handler = (e) => { if (e.target.type === 'number') e.target.blur(); };
    document.addEventListener('wheel', handler, { passive: true });
    return () => document.removeEventListener('wheel', handler);
  }, []);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <AuthProvider>
        <BrowserRouter basename={BASE_PATH || '/'}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* N3: Forecast is a regular in-platform module — no standalone login. */}
            <Route path="/forecast" element={<PrivateRoute><ModuleRoute module="forecast"><ForecastPage /></ModuleRoute></PrivateRoute>} />

            {/* Authenticated — any role */}
            <Route path="/leads"            element={<PrivateRoute><ModuleRoute module="leads"><LeadsPage /></ModuleRoute></PrivateRoute>} />
            {/* Customers hierarchy — its own module gate. */}
            <Route path="/customers"                 element={<PrivateRoute><ModuleRoute module="customers"><CustomersPage /></ModuleRoute></PrivateRoute>} />
            <Route path="/customers/:code"           element={<PrivateRoute><ModuleRoute module="customers"><CustomersPage /></ModuleRoute></PrivateRoute>} />
            <Route path="/customers/:code/:loc"      element={<PrivateRoute><ModuleRoute module="customers"><CustomersPage /></ModuleRoute></PrivateRoute>} />
            <Route path="/dashboard"        element={<PrivateRoute><ModuleRoute module="dashboard"><DashboardPage /></ModuleRoute></PrivateRoute>} />
            {/* Global activity feed (J1). Not a per-module page — its own grant governs it
                (Business Admin / Owner by role, Manager if granted, Team Member never), so the
                page itself enforces that rather than the module guard. */}
            <Route path="/activity"         element={<PrivateRoute><ActivityPage /></PrivateRoute>} />
            {/* VOC (Voice of Customer) — module-gated per user and per BU. */}
            <Route path="/voc"              element={<PrivateRoute><ModuleRoute module="voc"><VocPage /></ModuleRoute></PrivateRoute>} />
            {/* Activities kanban — opt-in per business (config.modules.activities). ModuleRoute
                covers both the per-user permission and, via canView, the per-BU enablement. */}
            <Route path="/activities"       element={<PrivateRoute><ModuleRoute module="activities"><ActivitiesPage /></ModuleRoute></PrivateRoute>} />
            {/* Self-service password change. */}
            <Route path="/change-password"  element={<PrivateRoute><ChangePasswordPage /></PrivateRoute>} />

            {/* Campaigns — module-gated per user and per BU. */}
            <Route path="/campaigns"        element={<PrivateRoute><ModuleRoute module="campaigns"><CampaignsPage /></ModuleRoute></PrivateRoute>} />
            {/* Reports — gated purely by the per-user module permission (like Leads/Dashboard), so a
                Sales Rep granted Reports access can open it, for every business (current and future). */}
            <Route path="/reports"          element={<PrivateRoute><ModuleRoute module="reports"><ReportsPage /></ModuleRoute></PrivateRoute>} />
            {/* Admin/PMO only */}
            <Route path="/settings"         element={<AdminRoute><SettingsPage /></AdminRoute>} />
            {/* The business picker (the Owner's home, and for anyone in several businesses) and the Owner's company-wide settings. */}
            <Route path="/choose-business"  element={<PickerRoute><BusinessPickerPage /></PickerRoute>} />
            <Route path="/organization"     element={<SuperAdminRoute><OrganizationSettingsPage /></SuperAdminRoute>} />
            {/* Global Admin manages all business units; a Business Admin can reach the same page but
                sees only their own BU (scoped server-side) and can only Edit / Edit template. */}
            <Route path="/business-units"   element={<BusinessUnitRoute><BusinessUnitsPage /></BusinessUnitRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/leads" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}
