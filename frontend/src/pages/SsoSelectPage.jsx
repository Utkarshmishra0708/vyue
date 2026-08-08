import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ssoSelect } from '../services/api';
import { useAuth } from '../context/AuthContext';

// === JIOAUTIFY INTEGRATION: SSO account chooser. Reached only in production, when the STB portal
// hands off an email that has BOTH a signage and a jhes Sales CRM account: the portal opens
// /sales_crm?ssoTicket=<jwt>, App.captureSsoFromUrl stashes the ticket in sessionStorage and routes
// here. We redeem the ticket to list the accounts, let the user pick a business unit, then exchange
// the ticket for a token for that account and land on /leads — bypassing the login page entirely. ===
const BU_LABEL = { signage: 'Signage', jhes: 'JHES', surveillance: 'Surveillance' };
const BU_COLOR = { signage: '#4f46e5', jhes: '#ea580c', surveillance: '#0891b2' };
const BU_DESC  = { signage: 'Digital Signage Solutions', jhes: 'Jio Hospitality & Entertainment Services', surveillance: 'Surveillance & Security Solutions' };

export default function SsoSelectPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const ticket = sessionStorage.getItem('salescrm_sso_ticket');

  // On mount, redeem the ticket for the list of accounts to choose from.
  useEffect(() => {
    if (!ticket) { navigate('/login', { replace: true }); return; }
    ssoSelect(ticket)
      .then((res) => {
        const list = (res && res.accounts) || [];
        // Defensive: if the ticket somehow resolves to a single account, log straight in.
        if (list.length === 1) return handlePick(list[0].business_unit);
        setAccounts(list);
      })
      .catch((err) => setError(err.response?.data?.message || 'SSO session expired. Open Sales CRM from the portal again.'));
  }, []); // run once on mount; ticket/login/navigate are stable for this flow

  const handlePick = async (businessUnit) => {
    setBusy(true);
    setError('');
    try {
      const { token, user } = await ssoSelect(ticket, businessUnit);
      sessionStorage.removeItem('salescrm_sso_ticket');
      login(token, user);           // seeds salescrm_token + auth state
      navigate('/leads', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sign in to that account.');
      setBusy(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Sales CRM</h1>
        <p style={s.sub}>Your email has more than one account — choose which to open</p>

        {error && <div style={s.error}>{error}</div>}

        {!accounts && !error && <p style={{ fontSize: 13, color: '#64748b' }}>Loading your accounts…</p>}

        {accounts && accounts.map((a) => (
          <button
            key={a.business_unit}
            onClick={() => handlePick(a.business_unit)}
            disabled={busy}
            style={{ ...s.buButton, borderColor: BU_COLOR[a.business_unit] || '#e2e8f0', cursor: busy ? 'wait' : 'pointer' }}
          >
            <div style={{ ...s.buIcon, background: BU_COLOR[a.business_unit] || '#6366f1' }}>
              {(BU_LABEL[a.business_unit] || a.business_unit || '?')[0]}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={s.buName}>{BU_LABEL[a.business_unit] || a.business_unit}</div>
              <div style={s.buDesc}>{BU_DESC[a.business_unit] || ''}{a.role ? ` · ${a.role.toUpperCase()}` : ''}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Inline styles — mirrors LoginPage.jsx convention (no CSS framework).
const s = {
  wrap:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' },
  card:    { background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  title:   { fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' },
  sub:     { fontSize: 13, color: '#64748b', margin: '0 0 24px' },
  buButton:{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', marginBottom: 10 },
  buIcon:  { width: 40, height: 40, borderRadius: 10, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  buName:  { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  buDesc:  { fontSize: 12, color: '#94a3b8' },
  error:   { background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 },
};
