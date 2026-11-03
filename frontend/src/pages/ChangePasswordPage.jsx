import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { changePassword } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordPage() {
  const { mustChangePassword, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (newPassword.length < 6) return setMsg('New password must be at least 6 characters.');
    if (newPassword !== confirm) return setMsg('Passwords do not match.');
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      await refreshUser();
      if (mustChangePassword) {
        navigate('/leads', { replace: true });
      } else {
        setMsg('Password updated successfully!');
        setCurrentPassword(''); setNewPassword(''); setConfirm('');
      }
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error updating password');
    } finally { setBusy(false); }
  };

  const forced = mustChangePassword;

  const inner = (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 20px' }}>
      <div className="card">
        {forced && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
            You're using a temporary password. Please choose your own before continuing.
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="field-label">{forced ? 'Temporary Password' : 'Current Password'}</label>
            <input type="password" className="input" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="field-label">New Password</label>
            <input type="password" className="input" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" />
          </div>
          <div>
            <label className="field-label">Confirm New Password</label>
            <input type="password" className="input" required value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          {msg && <p style={{ fontSize: 13, color: msg.includes('success') ? '#059669' : '#dc2626' }}>{msg}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : forced ? 'Set Password & Continue' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  );

  if (forced) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>Set Your Password</h1>
          <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>Choose a password you'll remember. You won't need the temporary one after this.</p>
          {inner}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Change Password</h1>
      </div>
      {inner}
    </Layout>
  );
}
