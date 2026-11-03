import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MODULES, MODULE_LABELS, PATH_MODULE, meets } from '../utils/permissions';
import Layout from './Layout';

// The first module this user can actually see, as a landing spot. Used whenever we have to bounce
// someone off a page: sending them to a module they also lack would just loop.
export function firstAllowedPath(permissions) {
  const order = ['/leads', '/dashboard', '/forecast', '/reports', '/voc', '/campaigns', '/customers', '/activities'];
  const found = order.find(p => meets(permissions, PATH_MODULE[p], 'read'));
  return found || null;
}

// The "No Access" screen for a module. Per the RBAC spec, a module the user can't open stays
// VISIBLE in the navigation (greyed) and, when clicked, shows this message explaining the lack of
// access — rather than being hidden or redirected away. Rendered inside Layout so the sidebar
// stays put and the user can move on to a module they do have.
function ModuleNoAccess({ module }) {
  const label = MODULE_LABELS[module] || module;
  return (
    <Layout>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>No access to {label}</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            You don't have access to the {label} module. Ask an administrator to grant it — the
            change applies here immediately, without signing in again.
          </p>
        </div>
      </div>
    </Layout>
  );
}

// ModuleRoute — gates a page on a per-module access level, on top of the role checks below.
// 'No Access' does NOT hide or redirect: the page shows an access message in place (see
// ModuleNoAccess), and the module stays visible-but-greyed in the nav. Also enforces the per-BU
// enablement (config.modules) so a business that has switched a module off can't reach it by URL.
export function ModuleRoute({ module, minLevel = 'read', children }) {
  const { isAuthenticated, loading, permissions, isConsoleOnly, buHasModule } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (isConsoleOnly) return <Navigate to="/choose-business" replace />;
  if (buHasModule && !buHasModule(module)) return <ModuleNoAccess module={module} />;
  if (meets(permissions, module, minLevel)) return children;
  return <ModuleNoAccess module={module} />;
}

export { MODULES };

export function PrivateRoute({ children }) {
  const { isAuthenticated, isConsoleOnly, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  // An Owner who has not opened a business yet (the picker) is kept to the picker, Organization
  // Settings and Businesses (their own guards allow them) plus Password; every business screen
  // sends them to the picker.
  if (isConsoleOnly && location.pathname !== '/change-password') return <Navigate to="/choose-business" replace />;
  return children;
}

// SuperAdminRoute — only a Global Admin (super_admin scope, read or write) may enter. Used for
// cross-platform administration such as Business Unit management. A Read-only Global Admin passes
// here (they can view); write actions are blocked server-side and hidden client-side via canAct.
export function SuperAdminRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isSuperAdmin) return <Navigate to="/leads" replace />;
  return children;
}

// PickerRoute — the business picker is for the Owner and for anyone who works in several businesses
// (an account under the same email in more than one). Everyone else goes back to Leads.
export function PickerRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  const several = isSuperAdmin || (Array.isArray(user?.platforms) && user.platforms.length > 1);
  if (!several) return <Navigate to="/leads" replace />;
  // The picker is only shown when no business is open (right after signing in, or after Switch
  // business). Inside a business, a typed address or the browser's back arrow goes to that business.
  if (localStorage.getItem('salescrm_console') !== '1') return <Navigate to="/leads" replace />;
  return children;
}

// Allows a Global Admin OR a Business Admin (their business_unit role) to reach the Business Units
// management page. The page itself scopes what each role actually sees and can click.
export function BusinessUnitRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (isSuperAdmin || user?.role === 'business_admin') return children;
  return <Navigate to="/leads" replace />;
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, isConsoleOnly, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/leads" replace />;
  // An Owner who has not opened a business yet has no business Settings: back to the picker.
  if (isConsoleOnly) return <Navigate to="/choose-business" replace />;
  return children;
}

// N3: Forecast is now a regular in-platform module, gated by ModuleRoute. ForecastRoute kept for
// backward compatibility but defers entirely to ModuleRoute.
export function ForecastRoute({ children }) {
  return <ModuleRoute module="forecast">{children}</ModuleRoute>;
}
