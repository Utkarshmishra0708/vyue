import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BU_CONFIG } from '../utils/constants';
import { IS_PROD } from '../env';

const NAV_ICONS = {
  leads: '📋', dashboard: '📊', reports: '📁', settings: '⚙️', 'change-password': '🔒',
};

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');

  if (!user) return null;

  const toggle = () => {
    setCollapsed(c => {
      localStorage.setItem('sidebarCollapsed', c ? '0' : '1');
      return !c;
    });
  };

  const bu = BU_CONFIG[user.business_unit] || BU_CONFIG.signage;
  const navItems = [
    { path: '/leads', label: 'Leads' },
    { path: '/dashboard', label: 'Dashboard' },
    ...(isAdmin ? [{ path: '/reports', label: 'Reports' }] : []),
    ...(isAdmin ? [{ path: '/settings', label: 'Settings' }] : []),
    // Self-service password change is DEV-ONLY; production is SSO-only.
    ...(!IS_PROD ? [{ path: '/change-password', label: 'Password' }] : []),
  ];

  return (
    <aside style={{
      width: collapsed ? 64 : 220, flexShrink: 0, background: '#0f172a', color: '#cbd5e1',
      display: 'flex', flexDirection: 'column', minHeight: '100vh', transition: 'width .15s',
    }}>
      <div style={{ padding: '18px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bu.color, flexShrink: 0 }} />
        {!collapsed && <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Sales CRM</div>}
      </div>

      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', marginBottom: 4, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? '#4f46e5' : 'transparent', color: active ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 600,
              }}>
              <span>{NAV_ICONS[item.path.slice(1)] || '•'}</span>
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid #1e293b' }}>
        {!collapsed && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{user.role} · {bu.label}</div>
          </div>
        )}
        <button onClick={logout} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }}>
          {collapsed ? '⎋' : 'Sign out'}
        </button>
        <button onClick={toggle} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 6, background: 'transparent', borderColor: '#1e293b', color: '#64748b' }}>
          {collapsed ? '»' : '« Collapse'}
        </button>
      </div>
    </aside>
  );
}
