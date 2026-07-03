import React, { useState } from 'react';
import { PHASE_BADGE } from '../utils/constants';

const COLUMNS = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'PO Expected', 'PO Received', 'Lost', 'On Hold'];

export default function KanbanView({ leads, onOpen, onPhaseChange }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
      {COLUMNS.map(col => {
        const items = leads.filter(l => l.phase === col);
        return (
          <div
            key={col}
            onDragOver={e => { e.preventDefault(); setOverCol(col); }}
            onDragLeave={() => setOverCol(o => o === col ? null : o)}
            onDrop={e => {
              e.preventDefault();
              if (dragId) onPhaseChange(dragId, col);
              setDragId(null); setOverCol(null);
            }}
            style={{
              minWidth: 220, flexShrink: 0, background: overCol === col ? '#eef2ff' : '#f8fafc',
              border: '1px solid #e2e8f0', borderRadius: 12, padding: 10,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className={`badge ${PHASE_BADGE[col]}`}>{col}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
              {items.map(l => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onClick={() => onOpen(l)}
                  className="card-sm"
                  style={{ cursor: 'grab', background: '#fff' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>{l.customer_name}</p>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{l.owner?.name?.split(' ')[0]} · ₹{l.potential_tcv_lakhs}L</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
