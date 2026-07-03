import React, { useEffect, useState } from 'react';
import { getActivityLog } from '../services/api';
import { fmtDate } from '../utils/leadHelpers';

export default function ActivityLogView({ leadId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getActivityLog(leadId).then(setRows).finally(() => setLoading(false));
  }, [leadId]);

  if (loading) return <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading…</p>;
  if (!rows.length) return <p style={{ fontSize: 13, color: '#94a3b8' }}>No activity yet.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(r => (
        <div key={r.id} className="card-sm">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{r.user_name}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(r.createdAt)}</span>
          </div>
          {r.action_type === 'lead_created' ? (
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{r.note || 'Lead created'}</p>
          ) : (
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              <strong>{r.field_changed}</strong>: {r.old_value} → {r.new_value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
