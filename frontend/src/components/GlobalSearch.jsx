import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearch } from '../services/api';

const PHASE_COLORS = {
  New: 'var(--m3-primary)', Qualified: '#8b5cf6', Demo: '#06b6d4', Proposal: '#f59e0b',
  Negotiation: '#ec4899', 'Order Expected': '#f97316', 'Won': 'var(--m3-success)',
  Lost: 'var(--m3-error)', 'On Hold': 'var(--m3-on-surface-variant)',
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q) => {
    if (q.trim().length < 2) { setResults(null); setOpen(false); return; }
    setLoading(true);
    setOpen(true);
    globalSearch(q.trim())
      .then((data) => { setResults(data); setLoading(false); })
      .catch(() => { setResults(null); setLoading(false); });
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const go = (path) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(path);
  };

  const leads = results?.leads || [];
  const chains = results?.chains || [];
  const vocs = results?.vocs || [];
  const activities = results?.activities || [];
  const hasResults = leads.length || chains.length || vocs.length || activities.length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--m3-outline)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
        </svg>
        <input
          className="input"
          placeholder="Search anything..."
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results) setOpen(true); }}
          style={{ width: 260, paddingLeft: 8, fontSize: 12, border: 'none', background: 'transparent', boxShadow: 'none' }}
        />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          width: 400, maxHeight: 400, overflowY: 'auto',
          background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 12,
          boxShadow: 'var(--elevation-3)', zIndex: 1000,
        }}>
          {loading && (
            <div style={{ padding: '16px 14px', color: 'var(--m3-outline)', fontSize: 13 }}>Searching...</div>
          )}

          {!loading && !hasResults && (
            <div style={{ padding: '16px 14px', color: 'var(--m3-outline)', fontSize: 13 }}>No results</div>
          )}

          {!loading && hasResults && (
            <>
              {leads.length > 0 && (
                <div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--m3-on-surface-variant)', textTransform: 'uppercase', background: 'var(--m3-surface-container)', borderBottom: '1px solid var(--m3-outline-variant)' }}>
                    Leads ({leads.length})
                  </div>
                  {leads.map((l) => (
                    <div key={l.id} onClick={() => go(`/leads?lead=${l.id}`)}
                      style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--m3-surface-container-high)', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m3-surface-container)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: 11, color: 'var(--m3-primary)', fontFamily: 'monospace', flexShrink: 0 }}>#{l.sr_no}</span>
                      <span style={{ fontSize: 13, color: 'var(--m3-on-surface)', flex: 1 }}>{l.customer_name}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: PHASE_COLORS[l.phase] ? `${PHASE_COLORS[l.phase]}18` : 'var(--m3-surface-container-high)',
                        color: PHASE_COLORS[l.phase] || 'var(--m3-on-surface-variant)',
                      }}>{l.phase}</span>
                    </div>
                  ))}
                </div>
              )}

              {chains.length > 0 && (
                <div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--m3-on-surface-variant)', textTransform: 'uppercase', background: 'var(--m3-surface-container)', borderBottom: '1px solid var(--m3-outline-variant)' }}>
                    Parent Accounts ({chains.length})
                  </div>
                  {chains.map((c) => (
                    <div key={c.id} onClick={() => go('/global-pos')}
                      style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--m3-surface-container-high)', fontSize: 13, color: 'var(--m3-on-surface)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m3-surface-container)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      {c.chain_name}
                    </div>
                  ))}
                </div>
              )}

              {vocs.length > 0 && (
                <div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--m3-on-surface-variant)', textTransform: 'uppercase', background: 'var(--m3-surface-container)', borderBottom: '1px solid var(--m3-outline-variant)' }}>
                    Feedback ({vocs.length})
                  </div>
                  {vocs.map((v) => (
                    <div key={v.id} onClick={() => go('/voc')}
                      style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--m3-surface-container-high)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m3-surface-container)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ color: 'var(--m3-on-surface)', flex: 1 }}>{v.customer_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--m3-outline)' }}>{v.category}</span>
                    </div>
                  ))}
                </div>
              )}

              {activities.length > 0 && (
                <div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--m3-on-surface-variant)', textTransform: 'uppercase', background: 'var(--m3-surface-container)', borderBottom: '1px solid var(--m3-outline-variant)' }}>
                    Activities ({activities.length})
                  </div>
                  {activities.map((a) => (
                    <div key={a.id} onClick={() => go('/activities')}
                      style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--m3-surface-container-high)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m3-surface-container)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ color: 'var(--m3-on-surface)', flex: 1 }}>{a.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--m3-outline)' }}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
