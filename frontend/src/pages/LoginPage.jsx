import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, getBusinessUnits } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../config/brand';


export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, loading } = useAuth();

  // Steps: 'platform' → 'credentials' | 'ga-credentials'
  const [step, setStep]         = useState('platform');
  const [bu, setBu]             = useState(null);     // selected business
  const [identifier, setIdent]  = useState('');        // email or username
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [businessUnits, setBusinessUnits] = useState(null);  // live list from the API (null until loaded)

  // Already signed in? Go to the app.
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(localStorage.getItem('salescrm_console') === '1' ? '/settings' : '/leads', { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate]);

  // Load the selectable businesses from the database. The code knows no business names, so if the list
  // can't load, the page says so instead of showing a fixed list.
  const [listError, setListError] = useState(false);
  useEffect(() => {
    getBusinessUnits('active')
      .then(list => { setBusinessUnits(Array.isArray(list) ? list : []); setListError(false); })
      .catch(() => { setBusinessUnits([]); setListError(true); });
  }, []);

  // The cards to render, and the presentation for the currently-selected slug.
  const buList = businessUnits || [];
  const buMeta = (slug) => (businessUnits || []).find(b => b.slug === slug) || { slug, name: slug, color: '#6366f1', description: '' };

  const goBack = (target) => {
    setError(''); setPassword(''); setIdent('');
    if (target === 'platform') { setBu(null); setStep('platform'); }
    else setStep(target);
  };

  // ------ Credential submission ------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (step === 'ga-credentials') {
        // Global Admin login — straight to Admin Console (Settings)
        const data = await apiLogin(identifier, password, null, 'super_admin');
        if (!data.user.is_super_admin) {
          setError('This is not an Owner account.');
          return;
        }
        localStorage.setItem('salescrm_console', '1');
        login(data.token, data.user);
        navigate('/settings', { replace: true });
        return;
      }

      // Platform login — the backend determines the role from the credentials.
      // Clear the console flag: a business login enters the full app, not the admin console.
      localStorage.removeItem('salescrm_console');
      const data = await apiLogin(identifier, password, bu);
      login(data.token, data.user);
      navigate('/leads', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  // ===========================================================================
  //  STEP 1: Platform selection — 3 business cards + Global Admin (top-right)
  // ===========================================================================
  if (step === 'platform') return (
    <div style={s.wrap}>
      <div style={{ ...s.card, position: 'relative' }}>
        {/* Global Admin — small button in the top-right corner, separate from the business cards */}
        <button type="button" onClick={() => { setStep('ga-credentials'); setError(''); }}
          title="Owner Login" style={s.adminLogin}>
          <span style={{ fontSize: 13 }}>🛡️</span> Owner
        </button>

        <h1 style={s.title}>{APP_NAME}</h1>
        <p style={s.sub}>Select your business to continue</p>

        {businessUnits === null && <p style={s.sub}>Loading businesses…</p>}
        {listError && <p style={{ ...s.sub, color: '#dc2626' }}>Couldn't load the list of businesses. Check that the server is running, then refresh the page.</p>}
        {businessUnits !== null && !listError && buList.length === 0 && <p style={s.sub}>No businesses have been set up yet. Sign in as Owner to create one.</p>}
        {buList.map(b => (
          <button key={b.slug} onClick={() => { setBu(b.slug); setStep('credentials'); setError(''); }}
            style={{ ...s.buButton, borderColor: b.color }}>
            <div style={{ ...s.buIcon, background: b.color }}>{(b.name || b.slug || '?')[0]}</div>
            <div style={{ textAlign: 'left' }}>
              <div style={s.buName}>{b.name}</div>
              <div style={s.buDesc}>{b.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ===========================================================================
  //  STEP 2a: Global Admin credential form
  // ===========================================================================
  if (step === 'ga-credentials') return (
    <div style={s.wrap}>
      <div style={s.card}>
        <button onClick={() => goBack('platform')} style={s.back}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ ...s.buIcon, background: '#7c3aed', width: 48, height: 48, fontSize: 20 }}>🛡️</div>
          <div>
            <h2 style={{ ...s.h2, margin: 0 }}>Owner</h2>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Cross-business administration</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={s.label}>Email</label>
          <input type="email" value={identifier} onChange={e => setIdent(e.target.value)}
            required autoFocus style={s.input} placeholder="admin@company.com" />
          <label style={s.label}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required style={s.input} placeholder="••••••••" />
          {error && <div style={s.error}>{error}</div>}
          <button type="submit" disabled={busy || !identifier || !password} style={s.submit}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );

  // ===========================================================================
  //  STEP 2c: Business platform — credential form (email or name + password)
  //  The backend determines the user's role from the credentials. No role selection.
  // ===========================================================================
  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <button onClick={() => goBack('platform')} style={s.back}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ ...s.buIcon, background: buMeta(bu).color, width: 36, height: 36, fontSize: 14 }}>{(buMeta(bu).name || bu || '?')[0]}</div>
          <div>
            <h2 style={{ ...s.h2, margin: 0 }}>{buMeta(bu).name}</h2>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{buMeta(bu).description}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={s.label}>Email or Username</label>
          <input type="text" value={identifier} onChange={e => setIdent(e.target.value)}
            required autoFocus style={s.input}
            placeholder="your.email@company.com or Your.Username" />
          <label style={s.label}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required style={s.input} placeholder="••••••••" />
          {error && <div style={s.error}>{error}</div>}
          <button type="submit" disabled={busy || !identifier || !password} style={s.submit}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Inline styles — matches the app convention (no CSS framework).
const s = {
  wrap:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' },
  card:    { background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  title:   { fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' },
  h2:      { fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' },
  sub:     { fontSize: 13, color: '#64748b', margin: '0 0 24px' },
  buButton:{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', marginBottom: 10 },
  buIcon:  { width: 40, height: 40, borderRadius: 10, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  buName:  { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  buDesc:  { fontSize: 12, color: '#94a3b8' },
  back:    { background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16 },
  label:   { fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6, marginTop: 12 },
  input:   { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  error:   { background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginTop: 12 },
  submit:  { width: '100%', padding: 12, marginTop: 16, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  adminLogin:{ position: 'absolute', top: 18, right: 18, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999, border: '1.5px solid #e9d5ff', background: '#faf5ff', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: 1 },
};
