import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Layout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Fixed sidebar — always visible */}
      <Sidebar />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 40, background: 'var(--m3-surface-container-lowest, #fff)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px',
          position: 'sticky', top: 0, zIndex: 5, flexShrink: 0,
          borderBottom: '1px solid var(--m3-surface-container-high)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell />
            <button
              onClick={() => navigate('/change-password')}
              title="Profile & Password"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                transition: 'box-shadow .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--elevation-1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >{initials}</button>
          </div>
        </header>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
