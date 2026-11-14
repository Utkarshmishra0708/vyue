import React, { useMemo, useState } from 'react';
import { PHASE_BADGE } from '../utils/constants';
import { hasConfidence, confidenceTrend, stageAging, hasMoney } from '../utils/leadHelpers';
import { sortByPriority } from '../utils/leadPriority';
import { buildNameCount, ownerLabel as _ownerLabel } from '../utils/nameLabels';

// Small confidence chip for a Kanban card: coloured by score band with a week-over-week trend mark.
function ConfChip({ lead }) {
  if (!hasConfidence(lead)) return null;
  const c = Math.round(Number(lead.confidence_score));
  const t = confidenceTrend(lead);
  const bg = c >= 60 ? '#dcfce7' : c >= 30 ? 'var(--m3-tertiary-container)' : 'var(--m3-surface-container-high)';
  const fg = c >= 60 ? '#166534' : c >= 30 ? 'var(--m3-on-surface)' : 'var(--m3-on-surface-variant)';
  const mark = t === 'up' ? <span style={{ color: 'var(--m3-success)' }}>▲</span>
    : t === 'down' ? <span style={{ color: 'var(--m3-error)' }}>▼</span>
    : t === 'hold' ? <span style={{ color: 'var(--m3-tertiary)' }}>❄</span>
    : <span style={{ color: 'var(--m3-outline)', fontSize: 8 }}>●</span>;
  return (
    <span title="Win-confidence score" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: bg, color: fg, borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
      {c}% {mark}
    </span>
  );
}

// Small aging chip for a Kanban card: days-in-stage coloured against the stage's TAT target.
// Hidden for closed/paused phases (where stageAging returns null).
function AgingChip({ lead, tatMap }) {
  const a = stageAging(lead, tatMap || {});
  if (a.days === null) return null;
  const color = a.level === 'over' ? 'var(--m3-error)' : a.level === 'warn' ? 'var(--color-warning)' : a.level === 'ok' ? 'var(--m3-success)' : 'var(--m3-on-surface-variant)';
  const bg    = a.level === 'over' ? 'var(--m3-error-container)' : a.level === 'warn' ? 'var(--m3-tertiary-container)' : a.level === 'ok' ? 'var(--m3-success-container)' : 'var(--m3-surface-container-high)';
  const tip   = a.target != null ? `${a.days}d in ${lead.phase} · target ${a.target}d` : `${a.days}d in ${lead.phase} · no target set`;
  return (
    <span title={tip} style={{ background: bg, color, border: `1px solid ${color}22`, borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
      {a.days}d
    </span>
  );
}

const COLUMNS = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Order Expected', 'Won', 'Lost', 'On Hold'];

// Per-column tint + accent so every column is clearly distinguishable and never renders low-contrast
// (light) text on a white background. Card text stays dark on white for readability.
const COLUMN_STYLE = {
  New:           { bg: 'var(--m3-surface-container-high)', accent: 'var(--m3-on-surface-variant)' },
  Qualified:     { bg: '#f5f3ff', accent: 'var(--m3-primary)' },
  Demo:          { bg: 'var(--m3-tertiary-container)', accent: 'var(--color-warning)' },
  Proposal:      { bg: '#eff6ff', accent: '#1d4ed8' },
  Negotiation:   { bg: 'var(--m3-tertiary-container)', accent: 'var(--m3-error)' },
  'Order Expected': { bg: '#f0fdfa', accent: '#0f766e' },
  'Won': { bg: 'var(--m3-success-container)', accent: 'var(--m3-success)' },
  Lost:          { bg: 'var(--m3-error-container)', accent: 'var(--m3-error)' },
  'On Hold':     { bg: 'var(--m3-surface-container-high)', accent: 'var(--m3-on-surface-variant)' },
};

export default function KanbanView({ leads, onOpen, onPhaseChange, tatMap, bds }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const bdNameCount = useMemo(() => buildNameCount(bds), [bds]);
  const ownerLabel = (owner) => _ownerLabel(owner, bdNameCount);
  const ownerUsername = (owner) => owner?.username || '';

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
      {COLUMNS.map(col => {
        // Cards within a column follow the shared prioritization order (confidence → chain
        // → TCV; stage is constant inside a column). See utils/leadPriority.js.
        const items = sortByPriority(leads.filter(l => l.phase === col));
        const cs = COLUMN_STYLE[col] || { bg: 'var(--m3-surface-container-high)', accent: 'var(--m3-on-surface-variant)' };
        const isOver = overCol === col;
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
              minWidth: 230, flexShrink: 0,
              background: isOver ? '#e0e7ff' : cs.bg,
              // Separate sides (not the `border` shorthand) so React doesn't warn about mixing it with borderTop.
              borderLeft: isOver ? '2px dashed #6366f1' : '1px solid var(--m3-outline-variant)',
              borderRight: isOver ? '2px dashed #6366f1' : '1px solid var(--m3-outline-variant)',
              borderBottom: isOver ? '2px dashed #6366f1' : '1px solid var(--m3-outline-variant)',
              borderTop: `3px solid ${cs.accent}`,
              borderRadius: 12, padding: 10,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className={`badge ${PHASE_BADGE[col]}`}>{col}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: cs.accent }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 48 }}>
              {items.map(l => {
                // Left-edge tint by aging level, so a red card jumps out of the column at a glance.
                const ageLvl = stageAging(l, tatMap || {}).level;
                const leftEdge = ageLvl === 'over' ? 'var(--m3-error)' : ageLvl === 'warn' ? 'var(--color-warning)' : ageLvl === 'ok' ? 'var(--m3-success)' : 'var(--m3-outline-variant)';
                return (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onClick={() => onOpen(l)}
                    style={{
                      cursor: 'grab', background: 'var(--m3-surface-container-lowest)', borderTop: '1px solid var(--m3-outline-variant)', borderRight: '1px solid var(--m3-outline-variant)', borderBottom: '1px solid var(--m3-outline-variant)', borderLeft: `3px solid ${leftEdge}`, borderRadius: 10,
                      padding: 10, boxShadow: '0 1px 2px rgba(15,23,42,.06)',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 4px', color: 'var(--m3-on-surface)' }}>{l.customer_name}</p>
                      <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                        <AgingChip lead={l} tatMap={tatMap} />
                        <ConfChip lead={l} />
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', margin: 0 }}>
                      {ownerLabel(l.owner)}{ownerUsername(l.owner) ? ` (${ownerUsername(l.owner)})` : ''} · {hasMoney(l.potential_tcv_lakhs) ? `₹${l.potential_tcv_lakhs}L` : '—'}
                    </p>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--m3-outline)', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
