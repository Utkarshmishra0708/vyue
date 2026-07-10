import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getManagedUsers, addUser, updateUser, setUserActive, deleteUser, resetBdPassword } from '../services/api';
import { IS_PROD } from '../env';

const ROLE_LABEL = { pmo: 'PMO · Admin', bd: 'BD · User' };
const ROLE_COLOR = { pmo: '#4f46e5', bd: '#0891b2' };
const EMPTY_FORM = { name: '', email: '', mobile: '', role: 'bd' };

// Add/Edit user modal. `initial` seeds the fields (edit); when null it's an add.
// `lockRole` disables the role field (used when a user edits their own account — they must not
// change their own role).
function UserFormModal({ mode, initial, busy, lockRole, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const name = form.name.trim(), email = form.email.trim(), mobile = form.mobile.trim();
    if (!name || !email || !mobile || !form.role) return setErr('All fields are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('Enter a valid email address.');
    if (!/^\d{10}$/.test(mobile)) return setErr('Mobile must be exactly 10 digits.');
    setErr('');
    onSubmit({ name, email, mobile, role: form.role });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
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
            <div>
              <label className="field-label">Mobile *</label>
              <input className="input" value={form.mobile} onChange={set('mobile')} placeholder="10-digit mobile number" inputMode="numeric" maxLength={10} required />
            </div>
            <div>
              <label className="field-label">Role *</label>
              <select className="input" value={form.role} onChange={set('role')} disabled={lockRole} required>
                <option value="bd">BD — User</option>
                <option value="pmo">PMO — Admin</option>
              </select>
              {lockRole && <p style={{ fontSize: 11, color: '#94a3b8', margin: '5px 0 0' }}>You cannot change your own role.</p>}
            </div>
            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{err}</p>}
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', user }
  const [resetTarget, setResetTarget] = useState(null); // user id currently showing the reset form
  const [resetValue, setResetValue] = useState('');

  const refresh = () => getManagedUsers(user.business_unit).then(setUsers).catch(() => setUsers([]));
  useEffect(() => { refresh(); }, [user.business_unit]); // eslint-disable-line

  const handleSubmit = async (data) => {
    setBusy(true); setMsg('');
    try {
      if (modal.mode === 'edit') {
        await updateUser(modal.user.id, data);
        setMsg(`Updated ${data.name}.`);
      } else {
        const created = await addUser(user.business_unit, data);
        setMsg(IS_PROD
          ? `Added ${data.name}. They can sign in through the portal (SSO).`
          : `Added ${data.name}. Starting password is "${created.defaultPassword}" — share it; they can change it under Password after logging in.`);
      }
      setModal(null);
      refresh();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error saving user');
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

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete ${u.name}? This cannot be undone. If they own any leads, delete will be blocked — disable them instead.`)) return;
    setBusy(true); setMsg('');
    try {
      await deleteUser(u.id);
      setMsg(`Permanently deleted ${u.name}.`); refresh();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error deleting user');
    } finally { setBusy(false); }
  };

  const openReset = (id) => { setResetTarget(id === resetTarget ? null : id); setResetValue(''); };

  const handleReset = async (id, name) => {
    const pwd = resetValue.trim();
    if (pwd.length < 6) { setMsg('New password must be at least 6 characters'); return; }
    setBusy(true); setMsg('');
    try {
      await resetBdPassword(id, pwd);
      setMsg(`Password reset for ${name}. Share "${pwd}" with them — they can change it themselves under Password after logging in.`);
      setResetTarget(null); setResetValue('');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error resetting password');
    } finally { setBusy(false); }
  };

  const buLabel = user.business_unit === 'jhes' ? 'JHES' : 'Signage';

  return (
    <Layout>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Settings</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Manage your team and account</p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card">
          <p className="section-title">Admin Account</p>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>Logged in as <strong>{user.email}</strong></p>
          {/* Self-service password change is DEV-ONLY; production is SSO-only. */}
          {!IS_PROD && <button className="btn" onClick={() => navigate('/change-password')}>Change Password</button>}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p className="section-title" style={{ margin: 0 }}>Manage Users — {buLabel}</p>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setModal({ mode: 'add' })}>+ Add User</button>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
            PMO users are admins; BD users are the sales team. Use Edit to change a user's details.
            {!IS_PROD && ' If a BD forgets their password, use Reset Password to set a new one.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>No users yet — add one above.</p>}
            {users.map(u => (
              <div key={u.id} style={{ paddingBottom: 8, borderBottom: '1px solid #f1f5f9', opacity: u.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: ROLE_COLOR[u.role] || '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{u.initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {u.name}
                      {!u.active && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 6 }}>DISABLED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{ROLE_LABEL[u.role] || u.role}{u.email ? ` · ${u.email}` : ''}{u.mobile ? ` · ${u.mobile}` : ''}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" disabled={busy} onClick={() => setModal({ mode: 'edit', user: { name: u.name, email: u.email || '', mobile: u.mobile || '', role: u.role, id: u.id } })}>Edit</button>
                    {!IS_PROD && u.role === 'bd' && u.active && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => openReset(u.id)}>
                        {resetTarget === u.id ? 'Cancel' : 'Reset Password'}
                      </button>
                    )}
                    {u.id !== user.id && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => handleToggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                    )}
                    {u.id !== user.id && (
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => handleDelete(u)}>Delete</button>
                    )}
                  </div>
                </div>
                {!IS_PROD && resetTarget === u.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingLeft: 40 }}>
                    <input className="input" type="text" placeholder="New password (min 6 chars)" value={resetValue} onChange={e => setResetValue(e.target.value)} autoFocus />
                    <button className="btn btn-primary btn-sm" disabled={busy || resetValue.trim().length < 6} onClick={() => handleReset(u.id, u.name)}>
                      {busy ? '…' : 'Set'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {msg && <p style={{ fontSize: 12, marginTop: 12, color: msg.toLowerCase().includes('error') ? '#dc2626' : '#059669' }}>{msg}</p>}
        </div>

        <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 4px' }}>💡 Weekly targets</p>
          <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>Global and per-BD weekly pipeline targets are editable directly on the Dashboard page.</p>
        </div>
      </div>

      {modal && (
        <UserFormModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.user : null}
          busy={busy}
          lockRole={modal.mode === 'edit' && modal.user.id === user.id}
          onSubmit={handleSubmit}
          onClose={() => { if (!busy) setModal(null); }}
        />
      )}
    </Layout>
  );
}
