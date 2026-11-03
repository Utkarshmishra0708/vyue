import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BASE_PATH } from '../env';
import { ROLE_LABEL } from '../utils/constants';
import useBusinessUnits from '../utils/useBusinessUnits';
import { APP_NAME, APP_LOGO } from '../config/brand';

const NAV_ICONS = {
  leads: '📋', dashboard: '📊', forecast: '🚚', reports: '📁', campaigns: '📢', customers: '👥', activity: '🕒', settings: '⚙️', 'change-password': '🔒', voc: '🗣️', 'business-units': '🏢', activities: '📌', organization: '🏛️', 'choose-business': '🏢',
};

export default function Sidebar() {
  const { user, logout, isAdmin, isSuperAdmin, isConsoleOnly, canView, canSeeActivityFeed, buHasModule } = useAuth();

  // The Owner moves between businesses through the business picker: "Switch business" returns to it
  // without signing out. A full page load gives every screen a clean start.
  const several = isSuperAdmin || (Array.isArray(user.platforms) && user.platforms.length > 1);
  const goToPicker = () => {
    localStorage.setItem('salescrm_console', '1');
    window.location.assign(`${BASE_PATH}/choose-business`);
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
  const [logoHover, setLogoHover] = useState(false);

  if (!user) return null;

  const toggle = () => {
    setCollapsed(c => {
      localStorage.setItem('sidebarCollapsed', c ? '0' : '1');
      return !c;
    });
  };

  const { meta: businessOf } = useBusinessUnits();
  const bu = businessOf(user.business_unit);
  // Console-only (Global Admin via the Admin button): shows ONLY the Admin Console — no business
  // pages. Business logins get the full operational nav for their platform.
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
        // Activities kanban — only shown when the BU has enabled it (Surveillance by default,
        // Signage/JHES only if a Global Admin turns it on via Edit Template). Suppressing the entry
        // when the BU disables it keeps other businesses' nav uncluttered.
        ...(buHasModule('activities') ? [{ path: '/activities', label: 'Task Board', disabled: !canView('activities') }] : []),
        ...(canSeeActivityFeed ? [{ path: '/activity', label: 'Activity Feed' }] : []),
        // "Settings" is always the open business's own (its people, lists and stage targets). The Owner's
        // company-wide settings (Owners, creating and managing businesses) are a separate link.
        ...(isAdmin ? [{ path: '/settings', label: 'Settings' }] : []),
        ...(isSuperAdmin ? [{ path: '/organization', label: 'Organization Settings' }] : []),
        // A Business Admin manages only their own business's template, so the label is singular.
        ...(!isSuperAdmin && user.role === 'business_admin' ? [{ path: '/business-units', label: 'Business' }] : []),
        { path: '/change-password', label: 'Password' },
      ];

  return (
    <aside style={{
      width: collapsed ? 64 : 220, flexShrink: 0, background: '#0f172a', color: '#cbd5e1',
      display: 'flex', flexDirection: 'column', height: '100vh', transition: 'width .15s',
    }}>
      {/* Logo → the sign-in page ("Select your business to continue"). Reaching it ends the current
          session, the same as Sign out. Works for every role. */}
      <button
        type="button"
        onClick={logout}
        onMouseEnter={() => setLogoHover(true)}
        onMouseLeave={() => setLogoHover(false)}
        title="Back to main page (business selection)"
        style={{
          padding: '16px', borderBottom: '1px solid #1e293b', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer', textAlign: 'left',
          background: logoHover ? '#1e293b' : 'transparent', transition: 'background .12s',
        }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Product logo (see config/brand.js). Falls back to the business colour tile if the file is missing. */}
          <img
            src={APP_LOGO}
            alt={APP_NAME}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentNode.style.background = bu.color; }}
          />
        </div>
        {!collapsed && <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{APP_NAME}</div>}
      </button>

      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {navItems.map(item => {
          const active = location.pathname === item.path;
          // A greyed (No Access) module is muted and shows a lock, but stays clickable — clicking it
          // lands on the module's access message (rendered by ModuleRoute), which is the required
          // feedback rather than a dead, unclickable item.
          const disabled = !!item.disabled;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : (disabled ? `${item.label} — no access` : undefined)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', marginBottom: 4, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? (disabled ? '#1e293b' : '#4f46e5') : 'transparent',
                color: disabled ? '#475569' : (active ? '#fff' : '#94a3b8'),
                fontSize: 13, fontWeight: 600, opacity: disabled ? 0.7 : 1,
              }}>
              <span>{NAV_ICONS[item.path.slice(1)] || '•'}</span>
              {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              {!collapsed && disabled && <span style={{ fontSize: 11 }}>🔒</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid #1e293b' }}>
        {!collapsed && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{isSuperAdmin ? 'Owner' : (ROLE_LABEL[user.role] || user.role)}{isConsoleOnly ? ' · All businesses' : ` · ${bu.name}`}</div>
          </div>
        )}
        {/* Two clear exits. Switch business (stays signed in) is for the Owner and for anyone who works in
            several businesses. Sign out ends the session and returns to the sign-in page. */}
        {several && !isConsoleOnly && (
          <button onClick={goToPicker} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 6, background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }}>
            {collapsed ? '⇄' : 'Switch business'}
          </button>
        )}
        <button onClick={logout} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }}>
          {collapsed ? '⏻' : 'Sign out'}
        </button>
        <button onClick={toggle} className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 6, background: 'transparent', borderColor: '#1e293b', color: '#64748b' }}>
          {collapsed ? '»' : '« Collapse'}
        </button>
      </div>
    </aside>
  );
}
