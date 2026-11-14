import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../services/api';
import NotificationPreferences from './NotificationPreferences';

const POLL_MS = 60_000;

const SEVERITY_COLORS = {
  critical: { bg: 'var(--m3-error-container)', border: '#fca5a5', dot: 'var(--m3-error)', label: 'Critical' },
  warning:  { bg: 'var(--m3-tertiary-container)', border: '#fcd34d', dot: '#f59e0b', label: 'Important' },
  info:     { bg: '#f0f9ff', border: '#93c5fd', dot: 'var(--m3-primary)', label: 'Info' },
  low:      { bg: 'var(--m3-success-container)', border: '#86efac', dot: 'var(--m3-success)', label: 'Low' },
};

const RULE_LABELS = {
  lead_phase_change: 'Phase Change',
  lead_reassigned: 'Lead Reassigned',
  lead_created: 'Lead Created',
  lead_lost: 'Lead Lost',
  lead_on_hold: 'Lead On Hold',
  po_document_uploaded: 'Order Document',
  renewal_due: 'Renewal Due',
  renewal_created: 'Renewal Created',
  stale_lead: 'Stale Lead',
  stage_tat_breach: 'TAT Breach',
  followup_overdue: 'Followup Overdue',
  hold_ending: 'Hold Ending',
  task_status_change: 'Task Update',
  confidence_drop: 'Confidence Drop',
  pipeline_below_target: 'Pipeline Alert',
  mention: 'Mention',
  task_assigned: 'Task Assigned',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setCount(data.count);
    } catch { /* silent */ }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 30 });
      setItems(data.notifications || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, POLL_MS);
    return () => clearInterval(t);
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await markRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setCount(c => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      setCount(0);
    } catch { /* silent */ }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
          fontSize: 20, padding: '4px 8px', color: 'var(--m3-on-surface-variant)',
        }}
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: 0,
            background: 'var(--m3-error)', color: '#fff', borderRadius: '50%',
            fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 999,
          width: 380, maxHeight: 480, background: 'var(--m3-surface-container-lowest)',
          border: '1px solid var(--m3-outline-variant)', borderRadius: 12,
          boxShadow: 'var(--elevation-3)',
          display: 'flex', flexDirection: 'column',
          marginTop: 4,
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--m3-outline-variant)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{showPrefs ? 'Preferences' : 'Notifications'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!showPrefs && count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none', border: 'none', color: 'var(--m3-primary)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowPrefs(p => !p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, color: 'var(--m3-on-surface-variant)', padding: '0 2px',
                }}
                title={showPrefs ? 'Back to notifications' : 'Notification settings'}
              >
                {showPrefs ? '←' : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {showPrefs ? (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <NotificationPreferences onClose={() => setShowPrefs(false)} />
            </div>
          ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && !items.length && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--m3-outline)' }}>Loading...</div>
            )}
            {!loading && !items.length && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--m3-outline)' }}>No notifications yet</div>
            )}
            {items.map(n => {
              const sev = SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.info;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) handleMarkRead(n.id);
                    let path = n.link_path || (n.lead_id ? `/leads?lead=${n.lead_id}` : null);
                    if (path) {
                      const m = path.match(/^\/leads\/(\d+)$/);
                      if (m) path = `/leads?lead=${m[1]}`;
                      setOpen(false);
                      navigate(path, { replace: false, state: { ts: Date.now() } });
                    }
                  }}
                  style={{
                    padding: '10px 16px', borderBottom: '1px solid var(--m3-surface-container-high)',
                    cursor: 'pointer',
                    background: n.is_read ? 'var(--m3-surface-container-lowest)' : sev.bg,
                    borderLeft: `3px solid ${n.is_read ? 'transparent' : sev.border}`,
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span title={sev.label} style={{
                      width: 10, height: 10, borderRadius: '50%', background: sev.dot,
                      flexShrink: 0, marginTop: 4,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: 'var(--m3-on-surface)', lineHeight: 1.3 }}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2, lineHeight: 1.3 }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 4,
                          background: 'var(--m3-surface-container-high)', color: 'var(--m3-on-surface-variant)', fontWeight: 500,
                        }}>
                          {RULE_LABELS[n.rule_key] || n.rule_key}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--m3-outline)' }}>{timeAgo(n.createdAt || n.created_at)}</span>
                      </div>
                    </div>
                    {!n.is_read && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: sev.dot,
                        flexShrink: 0, marginTop: 4,
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

      )}
    </div>
  );
}
