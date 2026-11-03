import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, getSetupStatus, setupCompany } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../config/brand';

const TEXT = {
  subtitle: 'Sign in to continue',
  identifier: 'Email or Username',
  identifierHint: 'your.email@company.com or Your.Username',
  password: 'Password',
  signIn: 'Sign In',
  signingIn: 'Signing in…',
  failed: 'Login failed',
  setupTitle: 'Register your company',
  setupSubtitle: "You're the first person here. Set up your company and you'll be the Owner.",
  yourName: 'Your name',
  email: 'Email',
  companyName: 'Company name',
  getStarted: 'Get started',
  settingUp: 'Setting up…',
  setupError: 'Could not complete setup. Please try again.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, loading } = useAuth();

  // null = checking, true = fresh install, false = normal sign-in
  const [needsSetup, setNeedsSetup] = useState(null);

  // Sign-in form state
  const [identifier, setIdent]  = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');

  // Registration form state
  const [ownerName, setOwnerName]       = useState('');
  const [setupEmail, setSetupEmail]     = useState('');
  const [setupPass, setSetupPass]       = useState('');
  const [companyName, setCompanyName]   = useState('');

  // Check whether this is a fresh install.
  useEffect(() => {
    getSetupStatus()
      .then(r => setNeedsSetup(r.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  // Already signed in? Go to the app.
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(localStorage.getItem('salescrm_console') === '1' ? '/choose-business' : '/leads', { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate]);

  // --- Sign-in handler (existing) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await apiLogin(identifier.trim(), password);
      const u = data.user;
      const several = !!u.is_super_admin || (Array.isArray(u.platforms) && u.platforms.length > 1);
      if (several) localStorage.setItem('salescrm_console', '1'); else localStorage.removeItem('salescrm_console');
      login(data.token, u);
      navigate(several ? '/choose-business?auto=1' : '/leads', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || TEXT.failed);
    } finally {
      setBusy(false);
    }
  };

  // --- Registration handler (P3-3) ---
  const handleSetup = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await setupCompany({ ownerName: ownerName.trim(), email: setupEmail.trim(), password: setupPass, companyName: companyName.trim() });
      localStorage.setItem('salescrm_console', '1');
      login(data.token, data.user);
      navigate('/choose-business', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || TEXT.setupError);
    } finally {
      setBusy(false);
    }
  };

  // While checking setup status, show the card shell with the title so the page isn't blank.
  if (needsSetup === null) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <h1 style={s.title}>{APP_NAME}</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>{APP_NAME}</h1>

        {needsSetup ? (
          <>
            <p style={s.sub}>{TEXT.setupTitle}</p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '-16px 0 20px' }}>{TEXT.setupSubtitle}</p>
            <form onSubmit={handleSetup}>
              <label style={s.label}>{TEXT.yourName}</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                required autoFocus style={s.input} placeholder="e.g. Anand Shukla" autoComplete="name" />
              <label style={s.label}>{TEXT.email}</label>
              <input type="email" value={setupEmail} onChange={e => setSetupEmail(e.target.value)}
                required style={s.input} placeholder="you@company.com" autoComplete="email" />
              <label style={s.label}>{TEXT.password}</label>
              <input type="password" value={setupPass} onChange={e => setSetupPass(e.target.value)}
                required minLength={8} style={s.input} placeholder="Minimum 8 characters" autoComplete="new-password" />
              <label style={s.label}>{TEXT.companyName}</label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                required style={s.input} placeholder="e.g. Acme Corp" autoComplete="organization" />
              {error && <div style={s.error}>{error}</div>}
              <button type="submit" disabled={busy || !ownerName || !setupEmail || !setupPass || !companyName} style={s.submit}>
                {busy ? TEXT.settingUp : TEXT.getStarted}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={s.sub}>{TEXT.subtitle}</p>
            <form onSubmit={handleLogin}>
              <label style={s.label}>{TEXT.identifier}</label>
              <input type="text" value={identifier} onChange={e => setIdent(e.target.value)}
                required autoFocus style={s.input} placeholder={TEXT.identifierHint} autoComplete="username" />
              <label style={s.label}>{TEXT.password}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required style={s.input} placeholder="••••••••" autoComplete="current-password" />
              {error && <div style={s.error}>{error}</div>}
              <button type="submit" disabled={busy || !identifier || !password} style={s.submit}>
                {busy ? TEXT.signingIn : TEXT.signIn}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

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
