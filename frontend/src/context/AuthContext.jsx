import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, if a token exists, hydrate the user via /api/auth/me
  useEffect(() => {
    const token = localStorage.getItem('Token');
    if (!token) { setLoading(false); return; }
    getMe()
      .then(setUser)
      .catch(() => { localStorage.removeItem('Token'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token, u) => {
    localStorage.setItem('Token', token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('Token');
    setUser(null);
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
