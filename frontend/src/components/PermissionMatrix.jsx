import React from 'react';
import { MODULES, MODULE_LABELS, LEVELS, LEVEL_LABELS, LEVEL_HINTS } from '../utils/permissions';

// Tint per level so the chosen column reads at a glance.
const LEVEL_STYLE = {
  none: { bg: 'var(--m3-error-container)', fg: 'var(--m3-error)', br: '#fecaca' },
  read: { bg: 'var(--m3-surface-container-high)', fg: 'var(--m3-on-surface-variant)', br: 'var(--m3-outline-variant)' },
  edit: { bg: 'var(--m3-tertiary-container)', fg: 'var(--m3-on-surface)', br: 'var(--m3-outline-variant)' },
  full: { bg: 'var(--m3-success-container)', fg: 'var(--m3-success)', br: '#bbf7d0' },
};

// ---------------------------------------------------------------------------
// PermissionMatrix — the module × level grid, shared by the Add User dialog and
// the Access editor so the two can never drift. Settings is deliberately absent:
// it is role-gated and cannot be granted here at any level.
// ---------------------------------------------------------------------------
export default function PermissionMatrix({ value, onChange, idPrefix = 'perm', compact = false }) {
  return (
    <table className="data-table" style={compact ? { fontSize: 12 } : undefined}>
      <thead>
        <tr>
          <th>Module</th>
          {LEVELS.map(l => (
            <th key={l} style={{ textAlign: 'center', whiteSpace: 'nowrap' }} title={LEVEL_HINTS[l]}>
              {LEVEL_LABELS[l]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {MODULES.map(m => (
          <tr key={m}>
            <td style={{ fontWeight: 600 }}>{MODULE_LABELS[m]}</td>
            {LEVELS.map(l => {
              const on = value?.[m] === l;
              const st = LEVEL_STYLE[l];
              return (
                <td key={l} style={{ textAlign: 'center' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', width: '100%', padding: '3px 0', borderRadius: 6,
                    background: on ? st.bg : 'transparent',
                    border: `1px solid ${on ? st.br : 'transparent'}`,
                  }}>
                    <input
                      type="radio"
                      name={`${idPrefix}-${m}`}
                      checked={on}
                      onChange={() => onChange({ ...value, [m]: l })}
                      style={{ cursor: 'pointer', accentColor: st.fg }}
                    />
                  </label>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The short legend shown under the grid in both callers.
export function PermissionLegend() {
  return (
    <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', lineHeight: 1.7, background: 'var(--m3-surface-container)', border: '1px solid #f1f5f9', borderRadius: 8, padding: '10px 12px' }}>
      <div><b>No Access</b> — hidden from the sidebar entirely</div>
      <div><b>Read-only</b> — can view, cannot change anything</div>
      <div><b>Edit</b> — can change existing records, but not module configuration (Parent Accounts, dropdown lists)</div>
      <div><b>Full Access</b> — can also create and delete</div>
    </div>
  );
}
