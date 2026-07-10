import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMe } from '../services/api';
import { IS_PROD } from '../env';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('salescrm_token');
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
  const isAdmin         = user && (user.role === 'admin' || user.role === 'pmo');
  const isBD            = user && user.role === 'bd';

  const value = { user, loading, login, logout, isAuthenticated, isAdmin, isBD };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
