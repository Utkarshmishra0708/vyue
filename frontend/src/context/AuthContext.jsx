import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMe } from '../services/api';
import { IS_PROD } from '../env';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Was this session started via the "Admin Login" button (global Admin Console) rather than a
  // business sign-in? The same super_admin account is also the Signage admin, so we distinguish the
  // two experiences by HOW the user logged in, not by their role. Persisted so it survives reloads.
  const [consoleMode, setConsoleMode] = useState(() => localStorage.getItem('salescrm_console') === '1');

  // On mount, if a token exists, hydrate the user via /api/auth/me.
  // === JIOAUTIFY INTEGRATION: token is namespaced as salescrm_token to avoid clobbering the STB
  // portal's own 'Token' (JioTCM) on the shared origin. Mirrors Jio Inventory / Release Planner. ===
  useEffect(() => {
    const token = localStorage.getItem('salescrm_token');
    if (!token) { setLoading(false); return; }
    getMe()
      .then(setUser)
      .catch(() => { localStorage.removeItem('salescrm_token'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token, u) => {
    localStorage.setItem('salescrm_token', token);
    // LoginPage sets/clears salescrm_console just before this call to mark the session type.
    setConsoleMode(localStorage.getItem('salescrm_console') === '1');
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('salescrm_token');
    localStorage.removeItem('salescrm_console');
    setConsoleMode(false);
    // Also clear the portal's own session key so a shared-origin STB portal login is signed out too.
    localStorage.removeItem('token');
    setUser(null);
    // === JIOAUTIFY INTEGRATION: in production Sales CRM runs inside the STB portal window. On sign
    // out, tell the user they're being redirected and close the window so control returns to the
    // portal. In standalone dev there's no portal window to close, so fall back to the login route. ===
    if (IS_PROD) {
      window.alert('You have been logged out. Redirecting to the portal…');
      window.close();
    }
  }, []);

  // Permission predicates
  const isAuthenticated = !!user;
  // Admin tier — reaches Settings, Reports, bulk actions.
  const ADMIN_TIER      = ['super_admin', 'business_admin', 'pmo'];
  const isAdmin         = user && ADMIN_TIER.includes(user.role);
  const isSuperAdmin    = user && user.role === 'super_admin';
  // Console-only session: a super_admin who signed in through the Admin Login button. The app shows
  // ONLY the Admin Console for them — no business Leads/Dashboard/Forecast/Reports.
  const isConsoleOnly   = !!(consoleMode && user && user.role === 'super_admin');
  const isBusinessAdmin = user && user.role === 'business_admin';
  const isBD            = user && user.role === 'bd';
  // A 'forecast' account can see ONLY the Forecast dashboard.
  const isForecastOnly  = user && user.role === 'forecast';
  // Full user management (assign PMO/BD/Forecast, and — for super_admin — Business Admins across
  // businesses). A PMO can still add BDs; that's handled per-action, not by this flag.
  const canManageUsers  = user && (user.role === 'super_admin' || user.role === 'business_admin');
  // Who can add/remove lead-form dropdown options (device SKUs, sources, partners, ratings, …): the
  // admin tier including PMO. Non-super roles are scoped to their own business by the API.
  const canManageDropdowns = user && (user.role === 'super_admin' || user.role === 'business_admin' || user.role === 'pmo');
  // Forecast dashboard is login-gated: admin tier and forecast accounts always, plus anyone granted.
  const canForecast     = user && (ADMIN_TIER.includes(user.role) || user.role === 'forecast' || !!user.forecast_access);

  const value = { user, loading, login, logout, isAuthenticated, isAdmin, isSuperAdmin, isConsoleOnly, isBusinessAdmin, isBD, isForecastOnly, canManageUsers, canManageDropdowns, canForecast };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
