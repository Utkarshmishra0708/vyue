import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PrivateRoute({ children }) {
  const { isAuthenticated, isForecastOnly, isConsoleOnly, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  // A forecast-only account can access nothing but the Forecast dashboard.
  if (isForecastOnly) return <Navigate to="/forecast" replace />;
  // A console-only session (signed in via Admin Login) is confined to the Admin Console; the only
  // PrivateRoute page it may reach is its own password change.
  if (isConsoleOnly && location.pathname !== '/change-password') return <Navigate to="/settings" replace />;
  return children;
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, isConsoleOnly, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/leads" replace />;
  // Console-only sessions get the Admin Console (Settings) but not business admin pages like Reports.
  if (isConsoleOnly && location.pathname !== '/settings') return <Navigate to="/settings" replace />;
  return children;
}

// Forecast dashboard: requires login AND forecast access (PMO/admin by default, or a PMO grant).
export function ForecastRoute({ children }) {
  const { isAuthenticated, canForecast, isConsoleOnly, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  // The Forecast dashboard is a business view, so a console-only session is sent to the Admin Console.
  if (isConsoleOnly) return <Navigate to="/settings" replace />;
  if (!canForecast) return <Navigate to="/leads" replace />;
  return children;
}
