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
            <p style={{ fontSize: 12, color: 'var(--m3-outline)', margin: '-16px 0 20px' }}>{TEXT.setupSubtitle}</p>
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
  wrap:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16, fontFamily: 'var(--font-body)' },
  card:    { background: 'var(--m3-surface-container-lowest, #fff)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 400, boxShadow: 'var(--elevation-3)', border: 'none' },
  title:   { fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--m3-on-surface)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' },
  h2:      { fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--m3-on-surface)', fontFamily: 'var(--font-heading)' },
  sub:     { fontSize: 13, color: 'var(--m3-on-surface-variant)', margin: '0 0 20px', letterSpacing: '0.01em' },
  buButton:{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, border: '1px solid var(--m3-outline-variant)', background: 'var(--m3-surface-container-lowest, #fff)', cursor: 'pointer', marginBottom: 10, transition: 'all .2s' },
  buIcon:  { width: 40, height: 40, borderRadius: 12, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  buName:  { fontSize: 14, fontWeight: 600, color: 'var(--m3-on-surface)' },
  buDesc:  { fontSize: 12, color: 'var(--m3-on-surface-variant)' },
  back:    { background: 'none', border: 'none', color: 'var(--m3-on-surface-variant)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 16 },
  label:   { fontSize: 12, fontWeight: 500, color: 'var(--m3-on-surface-variant)', display: 'block', marginBottom: 6, marginTop: 12, letterSpacing: '0.02em' },
  input:   { width: '100%', padding: '10px 12px', border: '1px solid var(--m3-outline)', borderRadius: 4, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color .2s', letterSpacing: '0.01em' },
  error:   { background: 'var(--m3-error-container)', color: 'var(--m3-on-error-container)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 },
  submit:  { width: '100%', padding: 10, marginTop: 20, background: 'var(--m3-primary)', color: 'var(--m3-on-primary)', border: 'none', borderRadius: 18, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--elevation-1)', transition: 'all .2s', fontFamily: 'inherit', letterSpacing: '0.01em' },
  adminLogin:{ position: 'absolute', top: 18, right: 18, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, border: '1px solid var(--m3-outline-variant)', background: 'var(--m3-surface-container-lowest, #fff)', color: 'var(--m3-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', lineHeight: 1 },
};
