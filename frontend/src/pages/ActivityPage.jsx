import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getActivityFeed, getActivityFilters } from '../services/api';
import useBusinessUnits from '../utils/useBusinessUnits';

// ---------------------------------------------------------------------------
// ActivityPage — the tool-wide activity feed.
//
// Same event store as the per-lead Activity tab (activity_log), so the two can
// never disagree; this view just isn't scoped to one lead. Non-lead events
// (chain, permissions, SLA) carry a category tag so a mixed feed stays readable.
//
// Scoping is entirely server-side: the feed only ever returns events for leads,
// platforms and modules the caller can already reach, and permission entries
// are omitted for anyone below the admin tier.
// ---------------------------------------------------------------------------
const TYPE_STYLE = {
  lead:        { bg: 'var(--m3-primary-container)', fg: 'var(--m3-primary)', br: 'var(--m3-primary-container)' },
  chain:       { bg: '#f0fdfa', fg: '#0f766e', br: '#99f6e4' },
  permissions: { bg: 'var(--m3-error-container)', fg: 'var(--m3-error)', br: '#fecaca' },
  sla:         { bg: 'var(--m3-tertiary-container)', fg: 'var(--m3-on-surface)', br: 'var(--m3-outline-variant)' },
};

const PAGE = 40;

// Absolute timestamp — "7 Oct 2026, 14:32". The Activity feed is an audit log, so an exact
// date+time reads more usefully than relative "18h ago" for anyone reviewing what changed when.
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtTimestamp(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS_SHORT[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${mon} ${yyyy}, ${hh}:${mm}`;
}

const EMPTY_FILTERS = { user_id: '', platform: '', type: '', from: '', to: '' };

export default function ActivityPage() {
  const navigate = useNavigate();
  const { canSeeActivityFeed } = useAuth();
  const { meta: businessOf } = useBusinessUnits();
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [options, setOptions] = useState({ users: [], platforms: [], types: [] });
  const sentinel = useRef(null);

  useEffect(() => { getActivityFilters().then(setOptions).catch(() => {}); }, []);

  // Reload from the top whenever a filter changes (or on manual refresh).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE };
      for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
      const d = await getActivityFeed(params);
      setEntries(d.entries || []);
      setCursor(d.nextCursor);
      setHasMore(!!d.hasMore);
    } catch {
      setEntries([]); setCursor(null); setHasMore(false);
    } finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  // Append the next page. `before` is the last id already shown, so paging stays
  // consistent even as new events land at the top.
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || cursor == null) return;
    setLoadingMore(true);
    try {
      const params = { limit: PAGE, before: cursor };
      for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
      const d = await getActivityFeed(params);
      setEntries(prev => [...prev, ...(d.entries || [])]);
      setCursor(d.nextCursor);
      setHasMore(!!d.hasMore);
    } catch { setHasMore(false); } finally { setLoadingMore(false); }
  }, [cursor, hasMore, loadingMore, filters]);

  // Infinite scroll, with the Load more button below as the accessible fallback.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return undefined;
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) loadMore(); }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  // Team Members (and Managers without the grant) can't see the platform feed. If they reach here
  // directly, show a message rather than an empty/erroring page — their per-lead Activity tab still
  // works. Placed after all hooks so hook order stays stable.
  if (!canSeeActivityFeed) {
    return (
      <Layout>
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--m3-on-surface-variant)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
            <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>No access to the activity feed</h1>
            <p style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', margin: 0 }}>
              The organization-wide activity feed is available to Business Admins and Managers who have
              been granted it. You can still see a lead's own history from its Activity tab.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const set = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));
  const selectedUser = filters.user_id
    ? options.users.find(u => String(u.id) === String(filters.user_id))
    : null;
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <Layout>
      <div style={{ background: 'var(--m3-surface-container-lowest)', borderBottom: '1px solid var(--m3-outline-variant)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Activity Feed</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
            Recent changes across the tool — leads, chains, permissions and SLA config
          </p>
        </div>
        <button className="btn btn-sm" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>

      <div style={{ padding: 16 }}>
        {/* Filters — the option lists come from the server, built only from what this user can see. */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 12, padding: '12px 14px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--m3-on-surface-variant)', alignSelf: 'center' }}>Filters</span>
          <div>
            <label className="field-label">User</label>
            <select className="input" style={{ width: 210 }} value={filters.user_id} onChange={set('user_id')}>
              <option value="">Everyone</option>
              {/* Keyed by account, not name — two accounts are both called "PMO". */}
              {options.users.map(u => (
                <option key={u.id ?? u.name} value={u.id ?? ''}>
                  {u.name}
                  {u.email ? ` — ${u.email}` : ''}
                  {/* One person can hold an account per platform under the same email, so the
                      platform is what finally tells the two options apart. */}
                  {u.businessUnit ? ` (${u.businessUnit})` : ''}
                  {/* The whole team is listed here, including people who have done nothing. That is
                      called out in the feed area below on selection, not in this label — the option
                      list stays a clean roster. */}
                </option>
              ))}
            </select>
          </div>
          {options.platforms.length > 1 && (
            <div>
              <label className="field-label">Business</label>
              <select className="input" style={{ width: 150 }} value={filters.platform} onChange={set('platform')}>
                <option value="">All businesses</option>
                {options.platforms.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="field-label">Type</label>
            <select className="input" style={{ width: 150 }} value={filters.type} onChange={set('type')}>
              <option value="">All types</option>
              {options.types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">From</label>
            <input className="input" style={{ width: 150 }} type="date" value={filters.from} onChange={set('from')} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input className="input" style={{ width: 150 }} type="date" value={filters.to} onChange={set('to')} />
          </div>
          {activeCount > 0 && (
            <button className="btn btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear ({activeCount})</button>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <p style={{ color: 'var(--m3-outline)', padding: 16, textAlign: 'center', margin: 0, fontSize: 13 }}>Loading…</p>
          ) : entries.length === 0 ? (
            // The dropdown lists the whole team without annotating it, so this is where a person
            // with nothing recorded is called out — as a direct answer, not a generic empty state.
            selectedUser && selectedUser.count === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--m3-on-surface-variant)' }}>
                  No activity by {selectedUser.name}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--m3-outline)' }}>
                  {selectedUser.email ? `${selectedUser.email} · ` : ''}
                  {selectedUser.businessUnit ? `${selectedUser.businessUnit} · ` : ''}
                  this user hasn't made any changes the tool records
                  {activeCount > 1 ? ', or none within the other filters applied' : ''}.
                </p>
                <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => setFilters(EMPTY_FILTERS)}>
                  Show everyone
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--m3-outline)', padding: 24, textAlign: 'center', margin: 0, fontSize: 13 }}>
                {activeCount ? 'No activity matches these filters.' : 'No activity recorded yet.'}
              </p>
            )
          ) : (
            <>
              {entries.map(e => {
                const st = TYPE_STYLE[e.type] || TYPE_STYLE.lead;
                const clickable = e.type === 'lead' && e.leadId;
                return (
                  <div
                    key={e.id}
                    onClick={clickable ? () => navigate(`/leads?lead=${e.leadId}&from=activity`) : undefined}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 18px',
                      borderBottom: '1px solid #f8fafc', cursor: clickable ? 'pointer' : 'default',
                    }}
                    onMouseEnter={ev => { if (clickable) ev.currentTarget.style.background = 'var(--m3-surface-container)'; }}
                    onMouseLeave={ev => { if (clickable) ev.currentTarget.style.background = ''; }}
                    title={clickable ? 'Open this lead' : undefined}
                  >
                    <span style={{ background: st.bg, color: st.fg, border: `1px solid ${st.br}`, borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 2 }}>
                      {e.typeLabel}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--m3-on-surface)' }}>
                        <b title={e.userEmail || undefined}>{e.user || 'Unknown user'}</b>
                        {e.field ? <> changed <b>{e.field}</b></> : <> updated</>}
                        {e.subject && <> on <span style={{ color: clickable ? 'var(--m3-primary)' : 'var(--m3-on-surface)', fontWeight: 600 }}>{e.subject}</span></>}
                      </div>
                      {/* The display name alone is ambiguous — several accounts are called "PMO" —
                          so the account email identifies who actually made the change. */}
                      {e.userEmail && (
                        <div style={{ fontSize: 11, color: 'var(--m3-outline)', marginTop: 1 }}>{e.userEmail}</div>
                      )}
                      {(e.from || e.to) && (
                        <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2, wordBreak: 'break-word' }}>
                          <span style={{ textDecoration: e.from ? 'line-through' : 'none', opacity: 0.75 }}>{e.from || '—'}</span>
                          {' → '}
                          <span style={{ color: 'var(--m3-on-surface)' }}>{e.to || '—'}</span>
                        </div>
                      )}
                      {e.note && !e.field && <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>{e.note}</div>}
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 11, color: 'var(--m3-outline)' }} title={new Date(e.at).toLocaleString()}>{fmtTimestamp(e.at)}</div>
                      {e.businessUnit && <div style={{ fontSize: 10, color: 'var(--m3-outline-variant)', marginTop: 2 }}>{businessOf(e.businessUnit).name}</div>}
                    </div>
                  </div>
                );
              })}

              <div ref={sentinel} style={{ padding: 14, textAlign: 'center' }}>
                {hasMore ? (
                  <button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--m3-outline-variant)' }}>
                    {entries.length} event{entries.length === 1 ? '' : 's'} · end of history
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
