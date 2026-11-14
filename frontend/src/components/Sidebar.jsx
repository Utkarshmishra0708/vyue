import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BASE_PATH } from '../env';
import { ROLE_LABEL } from '../utils/constants';
import useBusinessUnits from '../utils/useBusinessUnits';
import { APP_NAME, APP_LOGO } from '../config/brand';

/* ── M3 outlined-style SVG icons (24×24 viewBox, 1.5px stroke) ── */
const I = (d, vb = '0 0 24 24') => ({ d, vb });
const NAV_SVG = {
  leads:        I('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'),
  dashboard:    I('M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm10-1a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z'),
  forecast:     I('M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H6m7-1V9a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-1m-5 0v2m0 0h6m-6 0H5'),
  reports:      I('M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
  campaigns:    I('M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z'),
  customers:    I('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'),
  activity:     I('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
  settings:     I('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066zM15 12a3 3 0 11-6 0 3 3 0 016 0z'),
  'change-password': I('M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'),
  voc:          I('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'),
  'business-units': I('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'),
  activities:   I('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01'),
  organization: I('M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z'),
  'choose-business': I('M8 7h12m0 0l-4-4m4 4l-4 4m0 5H4m0 0l4 4m-4-4l4-4'),
};

function NavIcon({ name, size = 20 }) {
  const icon = NAV_SVG[name];
  if (!icon) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  return (
    <svg width={size} height={size} viewBox={icon.vb} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={icon.d} />
    </svg>
  );
}

export default function Sidebar({ onClose }) {
  const { user, logout, isAdmin, isSuperAdmin, isConsoleOnly, canView, canSeeActivityFeed, buHasModule } = useAuth();

  const several = isSuperAdmin || (Array.isArray(user.platforms) && user.platforms.length > 1);
  const goToPicker = () => {
    localStorage.setItem('salescrm_console', '1');
    window.location.assign(`${BASE_PATH}/choose-business`);
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [logoHover, setLogoHover] = useState(false);

  if (!user) return null;

  const go = (path) => { navigate(path); if (onClose) onClose(); };

  const { meta: businessOf } = useBusinessUnits();
  const bu = businessOf(user.business_unit);

  const navItems = isConsoleOnly
    ? [
        { path: '/choose-business', label: 'Select business' },
        { path: '/organization', label: 'Organization Settings' },
        { path: '/change-password', label: 'Password' },
      ]
    : [
        { path: '/leads',     label: 'Leads',     disabled: !canView('leads') },
        { path: '/dashboard', label: 'Dashboard', disabled: !canView('dashboard') },
        ...(buHasModule('voc') ? [{ path: '/voc', label: 'Customer Feedback', disabled: !canView('voc') }] : []),
        ...(buHasModule('customers') ? [{ path: '/customers', label: 'Customers', disabled: !canView('customers') }] : []),
        ...(buHasModule('forecast') ? [{ path: '/forecast', label: 'Inventory Pipeline', disabled: !canView('forecast') }] : []),
        { path: '/reports',   label: 'Reports',   disabled: !canView('reports') },
        ...(buHasModule('campaigns') ? [{ path: '/campaigns', label: 'Campaigns', disabled: !canView('campaigns') }] : []),
        ...(buHasModule('activities') ? [{ path: '/activities', label: 'Task Board', disabled: !canView('activities') }] : []),
        ...(canSeeActivityFeed ? [{ path: '/activity', label: 'Activity Feed' }] : []),
        ...(isAdmin ? [{ path: '/settings', label: 'Settings' }] : []),
        ...(isSuperAdmin ? [{ path: '/organization', label: 'Organization Settings' }] : []),
        ...(!isSuperAdmin && user.role === 'business_admin' ? [{ path: '/business-units', label: 'Business' }] : []),
        { path: '/change-password', label: 'Password' },
      ];

  const initials = (user.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside style={{
      width: 240, flexShrink: 0, background: 'var(--color-sidebar)', color: 'var(--color-sidebar-text)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      padding: '16px 8px 12px',
    }}>
      {/* Brand */}
      <button
        type="button"
        onClick={logout}
        onMouseEnter={() => setLogoHover(true)}
        onMouseLeave={() => setLogoHover(false)}
        title="Back to main page"
        style={{
          padding: '0 12px 20px', border: 'none',
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer', textAlign: 'left',
          background: 'transparent', transition: 'opacity .15s', opacity: logoHover ? 0.75 : 1,
        }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--m3-primary)', boxShadow: '0 2px 8px rgba(124,58,237,.45)',
        }}>
          <img
            src={APP_LOGO}
            alt={APP_NAME}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentNode.style.background = 'var(--m3-primary)';
              e.currentTarget.parentNode.innerHTML = '<span style="color:#fff;font-weight:700;font-size:13px">S</span>';
            }}
          />
        </div>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#fff', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>{APP_NAME}</span>
      </button>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        <p style={{ color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, fontWeight: 600, margin: '0 12px 6px', lineHeight: 1 }}>Workspace</p>
        {navItems.map(item => {
          const active = location.pathname === item.path;
          const disabled = !!item.disabled;
          const slug = item.path.slice(1);
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              title={disabled ? `${item.label} — no access` : undefined}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', marginBottom: 1, border: 'none', cursor: 'pointer',
                borderRadius: 20,
                background: active ? 'var(--color-sidebar-active)' : 'transparent',
                color: disabled ? '#49454F' : (active ? 'var(--color-sidebar-text-active)' : 'var(--color-sidebar-text)'),
                fontSize: 13, fontWeight: active ? 700 : 500, opacity: disabled ? 0.5 : 1,
                transition: 'all .15s ease',
                letterSpacing: '0.01em',
              }}>
              <NavIcon name={slug} size={18} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {disabled && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                  <path d={NAV_SVG['change-password'].d} />
                </svg>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ marginTop: 'auto', padding: '8px 4px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {several && !isConsoleOnly && (
            <button onClick={goToPicker} style={{
              width: '100%', border: '1px solid rgba(167,139,250,.25)', borderRadius: 16,
              background: 'transparent', color: 'var(--color-sidebar-glow)', fontSize: 12, fontWeight: 600,
              padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all .15s',
            }}>
              Switch business
            </button>
          )}
          <button onClick={logout} style={{
            width: '100%', border: '1px solid rgba(167,139,250,.25)', borderRadius: 16,
            background: 'transparent', color: 'var(--color-sidebar-glow)', fontSize: 12, fontWeight: 600,
            padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all .15s',
          }}>
            Sign out
          </button>
        </div>

        {/* Profile card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
          background: 'rgba(167,139,250,.1)', borderRadius: 12,
        }}>
          <span style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13,
          }}>{initials}</span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: 13, fontWeight: 600, color: '#EDE9FE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</strong>
            <small style={{ fontSize: 11, color: '#A78BFA', marginTop: 1 }}>
              {isSuperAdmin ? 'Owner' : (ROLE_LABEL[user.role] || user.role)}{isConsoleOnly ? '' : ` · ${bu.name}`}
            </small>
          </span>
        </div>
      </div>
    </aside>
  );
}
