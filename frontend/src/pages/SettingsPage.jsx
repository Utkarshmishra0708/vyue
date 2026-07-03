import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getBds, addBd, removeBd, resetBdPassword } from '../services/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bds, setBds] = useState([]);
  const [newName, setNewName] = useState('');
  const [bdMsg, setBdMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // bd id currently showing the reset form
  const [resetValue, setResetValue] = useState('');

  const refresh = () => getBds(user.business_unit).then(setBds);
  useEffect(() => { refresh(); }, [user.business_unit]); // eslint-disable-line

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true); setBdMsg('');
    try {
      const created = await addBd(name, user.business_unit);
      setNewName('');
      setBdMsg(`Added ${name}. Their starting password is "${created.defaultPassword}" — share this with them; they can change it themselves under Password after logging in.`);
      refresh();
    } catch (err) {
      setBdMsg(err.response?.data?.message || 'Error adding BD');
    } finally { setBusy(false); }
  };

  const handleRemove = async (id, name) => {
    if (!window.confirm(`Remove ${name}? They will no longer be able to log in. Their existing leads are kept.`)) return;
    setBusy(true); setBdMsg('');
    try {
      await removeBd(id);
      setBdMsg(`Removed ${name}.`); refresh();
    } catch (err) {
      setBdMsg(err.response?.data?.message || 'Error removing BD');
    } finally { setBusy(false); }
  };

  const openReset = (id) => {
    setResetTarget(id === resetTarget ? null : id);
    setResetValue('');
  };

  const handleReset = async (id, name) => {
    const pwd = resetValue.trim();
    if (pwd.length < 6) { setBdMsg('New password must be at least 6 characters'); return; }
    setBusy(true); setBdMsg('');
    try {
      await resetBdPassword(id, pwd);
      setBdMsg(`Password reset for ${name}. Share "${pwd}" with them — they can change it themselves under Password after logging in.`);
      setResetTarget(null); setResetValue('');
    } catch (err) {
      setBdMsg(err.response?.data?.message || 'Error resetting password');
    } finally { setBusy(false); }
  };

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
          <button className="btn" onClick={() => navigate('/change-password')}>Change Password</button>
        </div>

        <div className="card">
          <p className="section-title" style={{ marginBottom: 4 }}>Manage BDs — {user.business_unit === 'jhes' ? 'JHES' : 'Signage'}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
            Add or remove BDs. Each BD has their own password (starting at a system default) and can change it themselves after logging in — see the "Password" menu on their sidebar. If a BD forgets their password, use "Reset Password" below to set a new one for them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {bds.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>No BDs yet — add one below.</p>}
            {bds.map(b => (
              <div key={b.id} style={{ paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{b.initials}</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                  <button className="btn btn-sm" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => openReset(b.id)}>
                    {resetTarget === b.id ? 'Cancel' : 'Reset Password'}
                  </button>
                  <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => handleRemove(b.id, b.name)}>Remove</button>
                </div>
                {resetTarget === b.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingLeft: 40 }}>
                    <input
                      className="input"
                      type="text"
                      placeholder="New password (min 6 chars)"
                      value={resetValue}
                      onChange={e => setResetValue(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" disabled={busy || resetValue.trim().length < 6} onClick={() => handleReset(b.id, b.name)}>
                      {busy ? '…' : 'Set'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="New BD full name (e.g. Priya Sharma)" value={newName} onChange={e => setNewName(e.target.value)} />
            <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>{busy ? '…' : '+ Add BD'}</button>
          </form>
          {bdMsg && <p style={{ fontSize: 12, marginTop: 8, color: bdMsg.toLowerCase().includes('error') ? '#dc2626' : '#059669' }}>{bdMsg}</p>}
        </div>

        <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 4px' }}>💡 Weekly targets</p>
          <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>Global and per-BD weekly pipeline targets are editable directly on the Dashboard page.</p>
        </div>
      </div>
    </Layout>
  );
}
