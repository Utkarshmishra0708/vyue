import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import PermissionsModal from '../components/PermissionsModal';
import DropdownManager from '../components/DropdownManager';
import PermissionMatrix, { PermissionLegend } from '../components/PermissionMatrix';
import { getManagedUsers, addUser, updateUser, setUserActive, unlockUser, deleteUser, resetPassword, getTat, updateTat, setActivityFeedAccess } from '../services/api';
import useBusinessUnits from '../utils/useBusinessUnits';

// Dropdown lists a business can manage for its lead form.
const DROPDOWN_LISTS = [
  { field: 'lead_source',      label: 'Lead Source',            hint: 'Where a lead came from' },
  { field: 'channel_partner',  label: 'Channel Partner names',  hint: 'Offered when the source is Channel Partner' },
  { field: 'kam',              label: 'Account Manager names',  hint: 'Offered when the source is Account Manager' },
  { field: 'lead_affiliate',   label: 'Referral Partner names', hint: 'Offered when the source is Referral Partner' },
  { field: 'lead_temperature', label: 'Lead Rating',            hint: 'For example Hot, Warm, Cold' },
];

const ROLE_LABEL = { super_admin: 'Owner', business_admin: 'Business Admin', pmo: 'Manager', bd: 'Sales Rep' };
const ROLE_COLOR = { super_admin: 'var(--m3-primary)', business_admin: 'var(--m3-primary)', pmo: 'var(--m3-tertiary)', bd: 'var(--m3-tertiary)' };
const EMPTY_FORM = { name: '', email: '', mobile: '', role: 'bd' };

// Which roles the current actor may assign (mirrors the backend hierarchy, Themes E2/E3/E4/E5):
//   Global Admin  → Business Admin, Manager, Team Member
//   Business Admin→ Manager, Team Member (own platform)
//   Manager       → Manager, Team Member (own platform)
const ASSIGNABLE = {
  super_admin: ['business_admin', 'pmo', 'bd'],
  business_admin: ['pmo', 'bd'],
  pmo: ['pmo', 'bd'],
};
// Account type — deliberately NOT a role picker. Module access already governs what a user can do;
// the only things it cannot express are how the person signs in and whether they see their own
// leads or everyone's. That is all this control chooses. The underlying role is set from it.
//   primary: the two types that cover almost every account
//   extra:   kept so existing capability isn't lost, tucked behind a disclosure
const ACCOUNT_TYPES = {
  bd: {
    label: 'Sales Rep',
    blurb: 'Sees only their own leads',
    primary: true,
    perms: { leads: 'full', dashboard: 'read', forecast: 'none', reports: 'none' },
  },
  pmo: {
    label: 'Manager',
    blurb: 'Configurable module access · can open Settings · can add team',
    primary: true,
    perms: { leads: 'full', dashboard: 'full', forecast: 'full', reports: 'full' },
  },
  business_admin: {
    label: 'Business Admin',
    blurb: 'Full access to every module on this business · granted by an Owner',
    perms: { leads: 'full', dashboard: 'full', forecast: 'full', reports: 'full' },
  },
};

// Add/Edit user modal — access-first. There is no role dropdown: what a user can DO is chosen in
// the module Access grid below. The small "Account type" control above it only settles the two
// things module access cannot express — how the person signs in, and whether they see their own
// leads or everyone's — and the underlying role is derived from it.
//
// On edit the grid is omitted: access for an existing user is changed with the 🔐 Access button on
// their row, so there is exactly one place to do it.
function UserFormModal({ mode, initial, busy, lockRole, assignableRoles, onSubmit, onClose }) {
  const allowed = (assignableRoles && assignableRoles.length ? assignableRoles : ['bd'])
    .filter(r => ACCOUNT_TYPES[r]);
  const firstAllowed = allowed.includes('bd') ? 'bd' : allowed[0];
  const [form, setForm] = useState(initial || { ...EMPTY_FORM, role: firstAllowed });
  // Access starts from the account type's sensible default and is freely editable from there.
  const [perms, setPerms] = useState(ACCOUNT_TYPES[firstAllowed]?.perms || ACCOUNT_TYPES.bd.perms);
  // Once the admin edits the grid we stop overwriting it when they switch account type.
  const [permsTouched, setPermsTouched] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const pickType = (role) => {
    setForm(f => ({ ...f, role }));
    if (!permsTouched) setPerms(ACCOUNT_TYPES[role].perms);
  };
  const editPerms = (next) => { setPermsTouched(true); setPerms(next); };

  const primary = allowed.filter(r => ACCOUNT_TYPES[r].primary);
  const extra = allowed.filter(r => !ACCOUNT_TYPES[r].primary);
  const isAdd = mode !== 'edit';

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim(), email = form.email.trim(), mobile = form.mobile.trim();
    if (!name || !email || !mobile || !form.role) return setErr('All fields are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('Enter a valid email address.');
    if (!/^\d{10}$/.test(mobile)) return setErr('Mobile must be exactly 10 digits.');
    setErr('');
    // Await the save so a server error (e.g. duplicate email) is shown INSIDE the modal rather than on
    // the page behind it — otherwise a failed add looks like nothing happened.
    try {
      await onSubmit({ name, email, mobile, role: form.role, ...(isAdd ? { permissions: perms } : { username: String(form.username || '').trim() }) });
    } catch (er) {
      setErr(er.message || 'Could not save user. Please try again.');
    }
  };

  const TypeOption = ({ role }) => {
    const t = ACCOUNT_TYPES[role];
    const on = form.role === role;
    return (
      <label
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', borderRadius: 8,
          border: '1px solid ' + (on ? 'var(--m3-primary-container)' : 'var(--m3-outline-variant)'), background: on ? 'var(--m3-primary-container)' : '#fff',
          cursor: lockRole ? 'not-allowed' : 'pointer', opacity: lockRole && !on ? 0.5 : 1,
        }}
      >
        <input
          type="radio" name="account-type" checked={on} disabled={lockRole}
          onChange={() => pickType(role)} style={{ marginTop: 2, cursor: 'inherit' }}
        />
        <span>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{t.label}</span>
          <span style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>{t.blurb}</span>
        </span>
      </label>
    );
  };

  // No close-on-backdrop-click: a stray click must not discard in-progress user form input.
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: isAdd ? 620 : 460 }}>
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: 15 }}>{mode === 'edit' ? 'Edit User' : 'Add User'}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Name *</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Full name" autoFocus required />
            </div>
            <div>
              <label className="field-label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" required />
            </div>
            {mode === 'edit' && (
              <div>
                <label className="field-label">Username</label>
                <input className="input" value={form.username || ''} onChange={set('username')} placeholder="First.Last" pattern="[A-Za-z0-9][A-Za-z0-9._\-]{1,62}" title="Letters, digits, dots, hyphens and underscores, no spaces" />
                <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: '4px 0 0' }}>Used to sign in, along with the email.</p>
              </div>
            )}
            <div>
              <label className="field-label">Mobile *</label>
              <input className="input" value={form.mobile} onChange={set('mobile')} placeholder="10-digit mobile number" inputMode="numeric" maxLength={10} required />
            </div>

            <div>
              <label className="field-label">Account type *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {primary.map(r => <TypeOption key={r} role={r} />)}
                {showMore && extra.map(r => <TypeOption key={r} role={r} />)}
              </div>
              {extra.length > 0 && !lockRole && (
                <button type="button" onClick={() => setShowMore(v => !v)}
                  style={{ border: 'none', background: 'none', color: 'var(--m3-primary)', fontSize: 11, cursor: 'pointer', padding: '6px 0 0' }}>
                  {showMore ? '- Fewer account types' : '+ More account types (' + extra.length + ')'}
                </button>
              )}
              {lockRole && <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: '5px 0 0' }}>You cannot change your own account type.</p>}
            </div>

            {isAdd && (
              <div>
                <label className="field-label">Module access *</label>
                <p style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', margin: '0 0 8px' }}>
                  Pre-filled from the account type — adjust anything you like. Changeable later from
                  the 🔐 Access button on their row.
                </p>
                <PermissionMatrix value={perms} onChange={editPerms} idPrefix="new-user" compact />
                <div style={{ height: 10 }} />
                <PermissionLegend />
              </div>
            )}

            {err && <p style={{ fontSize: 12, color: 'var(--m3-error)', margin: 0 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isSuperAdmin, isCrossPlatform, isConsoleOnly, canAct } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', user }
  const [transferFor, setTransferFor] = useState(null); // { user, leadCount } — Sales Rep delete needs lead transfer
  const [transferTo, setTransferTo] = useState('unassigned');
  // The Admin Console follows the sidebar Platform selection: a Global Admin in a business session
  // opens straight to the business they're currently in (user.business_unit) and the other tabs are
  // greyed out — to manage another, they switch platform on the left. The console-only Global Admin
  // (logged in via the Global Admin button, no platform switcher) keeps the manual business picker.
  const [manageBusiness, setManageBusiness] = useState((isSuperAdmin && isConsoleOnly) ? null : user.business_unit);
  // The business's name for the page title comes from the shared list (never the internal ID).
  const { meta: businessOf } = useBusinessUnits();
  // Bumped whenever the user list changes, so the Global Admins panel refreshes its grant candidates.

  // Stage TAT (days-per-stage) editor for the Lead Confidence Scoring engine — per platform. Only a
  // business's PMO / Business Admin may edit; the per-stage weightage is a fixed constant (read-only).
  const [tatStages, setTatStages] = useState([]); // [{ stage, tat_days, weight }]
  const [tatBusy, setTatBusy] = useState(false);
  const [tatMsg, setTatMsg] = useState('');
  const [tatModal, setTatModal] = useState(false); // TAT table lives in a modal to keep Settings compact
  // Per-module access editor (RBAC). Same admin tier that already manages users.
  const [permTarget, setPermTarget] = useState(null); // { id, name } | null
  // A Read-only Super Admin gets the view-only variant of this too — the backend refuses the write
  // either way, but the spec is that they see no edit affordance anywhere.
  const canEditTat = canAct && (isSuperAdmin || user.role === 'pmo' || user.role === 'business_admin');

  const refresh = () => {
    if (!manageBusiness) { setUsers([]); return; }
    getManagedUsers(manageBusiness).then(setUsers).catch(() => setUsers([]));
  };
  useEffect(() => { refresh(); }, [manageBusiness]); // eslint-disable-line

  useEffect(() => {
    setTatMsg('');
    if (!manageBusiness) { setTatStages([]); return; }
    getTat(manageBusiness).then(d => setTatStages(d.stages || [])).catch(() => setTatStages([]));
  }, [manageBusiness]);

  const setTatDay = (stage, val) => setTatStages(rows => rows.map(r => r.stage === stage ? { ...r, tat_days: val } : r));

  const saveTat = async () => {
    setTatBusy(true); setTatMsg('');
    try {
      const tats = {};
      for (const r of tatStages) tats[r.stage] = parseInt(r.tat_days, 10);
      const d = await updateTat(manageBusiness, tats);
      setTatStages(d.stages || []);
      setTatMsg('TAT saved — confidence scores recalculated.');
    } catch (e) {
      setTatMsg(e.response?.data?.message || 'Error saving TAT');
    } finally { setTatBusy(false); }
  };

  // Can the current actor manage this user row? (mirrors the backend rules — gates the row actions)
  // A Read-only Super Admin sees zero action buttons anywhere, so this gate folds in canAct.
  const canActOn = (u) => canAct
    && (ASSIGNABLE[effectiveRole] || []).includes(u.role)
    && (isSuperAdmin || isCrossPlatform || u.business_unit === user.business_unit);

  const handleSubmit = async (data) => {
    setBusy(true); setMsg('');
    try {
      if (modal.mode === 'edit') {
        await updateUser(modal.user.id, data);
        setMsg(`Updated ${data.name}.`);
      } else {
        const created = await addUser(manageBusiness, data);
        if (created.tempPassword) {
          setMsg(`Added ${data.name}. Username: ${created.username}. Temporary password: ${created.tempPassword} — give this to them once. They'll be asked to set their own password at first sign-in.`);
        } else {
          setMsg(`Added ${data.name}. Username: ${created.username}. They already have an account in another business, so they sign in with their existing password.`);
        }
      }
      setModal(null);
      refresh();
    } catch (err) {
      const m = err.response?.data?.message || 'Error saving user';
      setMsg(m);
      throw new Error(m); // rethrow so the modal can surface it to the user (see UserFormModal.submit)
    } finally { setBusy(false); }
  };

  const handleUnlock = async (u) => {
    setBusy(true); setMsg('');
    try {
      await unlockUser(u.id);
      setMsg(`Unlocked ${u.name}.`); refresh();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error unlocking user');
    } finally { setBusy(false); }
  };

  const handleToggleActive = async (u) => {
    const next = !u.active;
    const verb = next ? 'Enable' : 'Disable';
    if (!window.confirm(`${verb} ${u.name}? ${next ? 'They will be able to log in again.' : 'They will no longer be able to log in. Their existing leads are kept.'}`)) return;
    setBusy(true); setMsg('');
    try {
      await setUserActive(u.id, next);
      setMsg(`${verb}d ${u.name}.`); refresh();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error updating user');
    } finally { setBusy(false); }
  };

  // J1: grant/revoke a Manager's platform-wide Activity feed. Only a Global Admin (Read+Write) or a
  // Business Admin may set it, and only for a Manager (pmo). A Manager can never grant it — to self or
  // to another Manager — so the button is shown only when the actor is super_admin/business_admin.
  const canGrantFeed = canAct && (isSuperAdmin || user.role === 'business_admin');
  // Dropdown lists are managed inside a business (the lists belong to that business).
  const canManageLists = canAct && !isConsoleOnly && (isSuperAdmin || ['business_admin', 'pmo'].includes(user.role));
  const handleToggleFeed = async (u) => {
    const next = !u.activity_feed_access;
    const verb = next ? 'Grant' : 'Revoke';
    if (!window.confirm(`${verb} the organization-wide Activity feed for ${u.name}? ${next
      ? 'They will see every user’s activity on this business.'
      : 'They will see only their own per-lead activity.'}`)) return;
    setBusy(true); setMsg('');
    try {
      await setActivityFeedAccess(u.id, next);
      setMsg(`${verb}ed Activity feed for ${u.name}.`); refresh();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error updating Activity feed access');
    } finally { setBusy(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete ${u.name}? This cannot be undone.`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await deleteUser(u.id);
      setMsg(res.message || `Permanently deleted ${u.name}.`); refresh();
    } catch (err) {
      const data = err.response?.data;
      // If the account owns leads, the backend asks us to choose a transfer target first.
      if (err.response?.status === 409 && data?.requiresReassign) {
        setTransferFor({ user: u, leadCount: data.leadCount });
        setTransferTo('unassigned');
      } else {
        setMsg(data?.message || 'Error deleting user');
      }
    } finally { setBusy(false); }
  };

  const confirmTransferDelete = async () => {
    const u = transferFor.user;
    setBusy(true); setMsg('');
    try {
      const res = await deleteUser(u.id, transferTo);
      setMsg(res.message || `Deleted ${u.name}.`);
      setTransferFor(null); refresh();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error transferring leads');
    } finally { setBusy(false); }
  };


  const handleReset = async (id, name) => {
    if (!window.confirm(`Reset password for ${name}? This generates a new temporary password that you must give them once. They'll be asked to choose their own at next sign-in.`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await resetPassword(id);
      setMsg(`Password reset for ${name}. Temporary password: ${res.tempPassword} — give this to them once. They'll set their own at next sign-in.`);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error resetting password');
    } finally { setBusy(false); }
  };

  const effectiveRole = isSuperAdmin ? 'super_admin' : user.role;
  const buLabel = manageBusiness
    ? businessOf(manageBusiness).name
    : '';

  return (
    <Layout>
      <div style={{ background: 'var(--m3-surface-container-lowest)', borderBottom: '1px solid var(--m3-outline-variant)', padding: '10px 16px' }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Settings{buLabel ? ` — ${buLabel}` : ''}</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>Manage this business's team, lists and account</p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <p className="section-title">Admin Account</p>
          <p style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', margin: '0 0 12px' }}>Logged in as <strong>{user.email}</strong></p>
          {/* Self-service password change. */}
          <button className="btn" onClick={() => navigate('/change-password')}>Change Password</button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 10, flexWrap: 'wrap' }}>
            <p className="section-title" style={{ margin: 0 }}>Manage Users{buLabel ? ` — ${buLabel}` : ''}</p>
            {canAct && <button className="btn btn-primary btn-sm" disabled={busy || !manageBusiness} onClick={() => setModal({ mode: 'add' })}>+ Add User</button>}
          </div>
          <p style={{ fontSize: 12, color: 'var(--m3-outline)', margin: '0 0 14px' }}>
            Manager users are admins; Sales Rep users are the sales team. Use Edit to change a user's details. If a Sales Rep forgets their password, use Reset Password to set a new one.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {manageBusiness && users.length === 0 && <p style={{ fontSize: 13, color: 'var(--m3-outline)' }}>No users yet — add one above.</p>}
            {users.map(u => (
              <div key={u.id} style={{ paddingBottom: 8, borderBottom: '1px solid #f1f5f9', opacity: u.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: ROLE_COLOR[u.role] || 'var(--m3-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{u.initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {u.name}
                      {!u.active && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--color-warning)', background: 'var(--m3-tertiary-container)', padding: '1px 6px', borderRadius: 6 }}>DISABLED</span>}
                      {u.locked_until && new Date(u.locked_until) > new Date() && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--m3-error)', background: 'var(--m3-error-container)', padding: '1px 6px', borderRadius: 6 }}>LOCKED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--m3-outline)' }}>{ROLE_LABEL[u.role] || u.role}{u.username ? ` · ${u.username}` : ''}{u.email ? ` · ${u.email}` : ''}{u.mobile ? ` · ${u.mobile}` : ''}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {canAct && (canActOn(u) || u.id === user.id) && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => setModal({ mode: 'edit', user: { name: u.name, email: u.email || '', mobile: u.mobile || '', role: u.role, id: u.id, username: u.username || '' } })}>Edit</button>
                    )}
                    {u.active && canActOn(u) && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => handleReset(u.id, u.name)}>
                        Reset Password
                      </button>
                    )}
                    {/* Forecast is one of the four modules in the Access editor now, so a separate
                        per-user Forecast toggle would be a second, conflicting control for the
                        same thing. Access is the single place it is granted. */}
                    {canActOn(u) && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => setPermTarget({ id: u.id, name: u.name })}
                        title="Set per-module access levels (Leads, Dashboard, Inventory Pipeline, Reports)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Access</button>
                    )}
                    {/* J1: per-Manager Activity-feed grant. Only for Managers, and only a Global Admin /
                        Business Admin can set it. Business Admin / Owner get the feed by role, so
                        no toggle is shown for them; a Team Member never sees the feed, so none for them. */}
                    {u.role === 'pmo' && canGrantFeed && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => handleToggleFeed(u)}
                        title="Grant or revoke this Manager's access to the organization-wide Activity feed">
                        {u.activity_feed_access ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Feed: On</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Feed: Off</>}
                      </button>
                    )}
                    {u.locked_until && new Date(u.locked_until) > new Date() && canAct && canActOn(u) && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => handleUnlock(u)}>Unlock</button>
                    )}
                    {u.id !== user.id && canActOn(u) && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => handleToggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                    )}
                    {u.id !== user.id && canActOn(u) && (
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => handleDelete(u)}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {msg && <p style={{ fontSize: 12, marginTop: 12, color: msg.toLowerCase().includes('error') ? 'var(--m3-error)' : 'var(--m3-success)' }}>{msg}</p>}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <p className="section-title" style={{ margin: 0 }}>Lead Scoring — Stage TAT{buLabel ? ` — ${buLabel}` : ''}</p>
              <p style={{ fontSize: 12, color: 'var(--m3-outline)', margin: '4px 0 0' }}>
                Turn-around days per stage that drive the win-confidence decay — {canEditTat ? 'editable independently per business.' : "managed by this business's Manager / Business Admin."}
              </p>
            </div>
            {manageBusiness && (
              <button className="btn btn-sm" style={{ flexShrink: 0 }} onClick={() => { setTatMsg(''); setTatModal(true); }}>
                {canEditTat ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Edit Stage TAT</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>View Stage TAT</>}
              </button>
            )}
          </div>
          {!manageBusiness && <p style={{ fontSize: 13, color: 'var(--m3-outline)', margin: '10px 0 0' }}>Select a business above to view its stage TAT.</p>}
        </div>

        {canManageLists && (
          <div className="card">
            <p className="section-title" style={{ margin: 0 }}>Dropdown lists{buLabel ? ` — ${buLabel}` : ''}</p>
            <p style={{ fontSize: 12, color: 'var(--m3-outline)', margin: '4px 0 12px' }}>
              The choices offered in this business's lead form. Click Manage to add or remove options.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DROPDOWN_LISTS.map(d => (
                <div key={d.field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 10px', border: '1px solid var(--m3-outline-variant)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--m3-on-surface)' }}>{d.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--m3-outline)' }}>{d.hint}</div>
                  </div>
                  <DropdownManager field={d.field} label={d.label} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ background: 'var(--m3-tertiary-container)', borderColor: 'var(--m3-outline-variant)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--m3-on-surface)', margin: '0 0 4px' }}>💡 Weekly targets</p>
          <p style={{ fontSize: 12, color: 'var(--m3-on-surface)', margin: 0 }}>Global and per-Sales Rep weekly pipeline targets are editable directly on the Dashboard page.</p>
        </div>
      </div>

      {modal && (
        <UserFormModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.user : null}
          busy={busy}
          lockRole={modal.mode === 'edit' && modal.user.id === user.id}
          assignableRoles={ASSIGNABLE[effectiveRole] || []}
          onSubmit={handleSubmit}
          onClose={() => { if (!busy) setModal(null); }}
        />
      )}

      {tatModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 15 }}>Stage TAT{buLabel ? ` — ${buLabel}` : ''}</span>
              <button className="btn btn-sm" onClick={() => setTatModal(false)} disabled={tatBusy}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: 'var(--m3-outline)', margin: '0 0 14px' }}>
                <b>TAT</b> is how many days a lead may sit in each stage before its win-confidence begins to decay.
                The <b>weightage</b> (each stage's base confidence) and the decay formula are fixed constants shown for
                reference only — just the TAT is editable.
              </p>
              {!canEditTat && (
                <p style={{ fontSize: 12, color: 'var(--color-warning)', background: 'var(--m3-tertiary-container)', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', margin: '0 0 12px' }}>
                  Stage TAT can only be changed by this business's <b>Manager</b> or <b>Business Admin</b>. You can view the values below.
                </p>
              )}
              {tatStages.length === 0 ? <p style={{ fontSize: 13, color: 'var(--m3-outline)' }}>Loading…</p> : (
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr><th>Stage</th><th style={{ textAlign: 'center' }}>Weightage (%)</th><th style={{ textAlign: 'center' }}>TAT (days)</th></tr>
                  </thead>
                  <tbody>
                    {tatStages.map(r => (
                      <tr key={r.stage}>
                        <td style={{ fontWeight: 600 }}>{r.stage}</td>
                        <td style={{ textAlign: 'center', color: 'var(--m3-on-surface-variant)' }} title="Fixed base confidence weight — not editable">{r.weight}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <input className="input" style={{ width: 90, textAlign: 'center', display: 'inline-block' }} type="number" min={1} max={365}
                            value={r.tat_days} disabled={!canEditTat} onChange={e => setTatDay(r.stage, e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: '10px 0 0' }}>Won is terminal (no TAT). Allowed range 1–365 days.</p>
              {tatMsg && <p style={{ fontSize: 12, margin: '10px 0 0', color: tatMsg.toLowerCase().includes('error') ? 'var(--m3-error)' : 'var(--m3-success)' }}>{tatMsg}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn" onClick={() => setTatModal(false)} disabled={tatBusy}>Close</button>
                {canEditTat && <button className="btn btn-primary" disabled={tatBusy} onClick={saveTat}>{tatBusy ? 'Saving…' : 'Save TAT'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {transferFor && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 15 }}>Transfer leads before deleting</span>
              <button className="btn btn-sm" onClick={() => setTransferFor(null)} disabled={busy}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', margin: '0 0 14px' }}>
                <strong>{transferFor.user.name}</strong> owns <strong>{transferFor.leadCount}</strong> lead(s). Choose who to transfer them to — then the account will be deleted.
              </p>
              <label className="field-label">Transfer leads to</label>
              <select className="input" value={transferTo} onChange={e => setTransferTo(e.target.value)}>
                <option value="unassigned">Unassigned — holding account</option>
                {users.filter(x => x.id !== transferFor.user.id && x.active && ['bd', 'pmo'].includes(x.role)).map(x => (
                  <option key={x.id} value={x.id}>{x.name} ({ROLE_LABEL[x.role] || x.role})</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button className="btn" onClick={() => setTransferFor(null)} disabled={busy}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmTransferDelete} disabled={busy}>
                  {busy ? 'Working…' : 'Transfer & Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-module access levels (RBAC). Settings itself is never listed — it stays role-gated. */}
      {permTarget && (
        <PermissionsModal
          userId={permTarget.id}
          userName={permTarget.name}
          onClose={() => setPermTarget(null)}
          onSaved={(m) => { setMsg(m); refresh(); }}
        />
      )}
    </Layout>
  );
}
