import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBusinessUnits, enterBusiness, switchPlatform } from '../services/api';
import { APP_NAME } from '../config/brand';
import { BASE_PATH } from '../env';

// The Owner's home: one card per business. Picking a card opens that business with the Owner's
// own sign-in (no second sign-in). Built for behaviour only: it reuses the look of the sign-in page's
// business cards, and all of its words are in TEXT so they are easy to find and restyle later.
const TEXT = {
  title: 'Select a business',
  loading: 'Loading businesses…',
  loadError: "Couldn't load the businesses. Check that the server is running, then refresh the page.",
  none: 'No businesses yet.',
  create: 'Create business',
  organization: 'Organization Settings',
  signOut: 'Sign out',
  enterError: 'Could not open that business. Please try again.',
  opening: 'Opening…',
};

export default function BusinessPickerPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, logout, canAct, isSuperAdmin } = useAuth();
  const [list, setList] = useState(null);      // null until loaded
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');        // slug being opened

  useEffect(() => {
    getBusinessUnits('active')
      .then(l => setList(Array.isArray(l) ? l : []))
      .catch(() => { setList([]); setError(TEXT.loadError); });
  }, []);

  const enter = async (slug) => {
    if (busy) return;
    setBusy(slug); setError('');
    try {
      // The Owner enters any business. Anyone else moves to their account in the other business.
      const data = isSuperAdmin ? await enterBusiness(slug) : await switchPlatform(slug);
      localStorage.removeItem('salescrm_console');   // leave the Owner's business-picker mode
      login(data.token, data.user);
      // A full reload gives every screen a clean start under the new business.
      window.location.assign(`${BASE_PATH}/leads`);
    } catch (e) {
      setError(e.response?.data?.message || TEXT.enterError);
      setBusy('');
    }
  };

  // Just signed in, and there is only one business: go straight in.
  useEffect(() => {
    if (params.get('auto') === '1' && list && list.length === 1) enter(list[0].slug);
  }, [list]); // eslint-disable-line

  const signOut = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>{APP_NAME}</h1>
        <p style={s.sub}>{TEXT.title}</p>

        {list === null && <p style={s.sub}>{TEXT.loading}</p>}
        {list && list.length === 0 && !error && <p style={s.sub}>{TEXT.none}</p>}
        {error && <div style={s.error}>{error}</div>}

        {(list || []).map(b => (
          <button key={b.slug} type="button" disabled={!!busy} onClick={() => enter(b.slug)}
            style={{ ...s.buButton, borderColor: b.color }}>
            <div style={{ ...s.buIcon, background: b.color }}>{(b.name || b.slug || '?')[0]}</div>
            <div style={{ textAlign: 'left' }}>
              <div style={s.buName}>{b.name}</div>
              <div style={s.buDesc}>{busy === b.slug ? TEXT.opening : b.description}</div>
            </div>
          </button>
        ))}

        {isSuperAdmin && canAct && list && (
          <button type="button" disabled={!!busy} onClick={() => navigate('/business-units?new=1')}
            style={{ ...s.buButton, borderColor: '#64748b' }}>
            <div style={{ ...s.buIcon, background: '#64748b' }}>+</div>
            <div style={{ textAlign: 'left' }}><div style={s.buName}>{TEXT.create}</div></div>
          </button>
        )}

        <div style={s.links}>
          {isSuperAdmin ? <button type="button" style={s.link} onClick={() => navigate('/organization')}>{TEXT.organization}</button> : <span />}
          <button type="button" style={s.link} onClick={signOut}>{TEXT.signOut}</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' },
  card:    { background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  title:   { fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' },
  sub:     { fontSize: 13, color: '#64748b', margin: '0 0 24px' },
  buButton:{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', marginBottom: 10 },
  buIcon:  { width: 40, height: 40, borderRadius: 10, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  buName:  { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  buDesc:  { fontSize: 12, color: '#94a3b8' },
  error:   { background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 },
  links:   { display: 'flex', justifyContent: 'space-between', marginTop: 18 },
  link:    { background: 'none', border: 'none', color: '#4f46e5', fontSize: 13, cursor: 'pointer', padding: 0 },
};
