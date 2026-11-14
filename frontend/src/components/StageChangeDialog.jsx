import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateLead, uploadPoDocument, fileUrl } from '../services/api';
import { LOST_REASONS } from '../utils/constants';
import { todayStr, addDaysStr } from '../utils/leadHelpers';

// A small dialog for moving a lead to a stage that needs a few details (Won, Lost, On Hold), so the
// whole lead form doesn't have to open. It asks only for what that stage needs and saves just those
// values; the server keeps every other field as it is. Ordinary stage moves don't use this dialog.
//
// Props: lead (the full saved lead), toPhase, buConfig (the business's config, for its template),
// onDone (after saving), onCancel, onOpenForm (switch to the full lead form instead).
export const STAGES_WITH_DIALOG = ['Won', 'Lost', 'On Hold'];

export default function StageChangeDialog({ lead, toPhase, buConfig, onDone, onCancel, onOpenForm }) {
  const { user } = useAuth();
  const isBD = user.role === 'bd';
  const sections = (buConfig && buConfig.formSchema && buConfig.formSchema.sections) || [];
  // The order document and Order Number follow the business's template, as in the full form. If the
  // template hasn't loaded, both are treated as on (the stricter choice).
  const fieldOn = (sectionKey, slug) => !sections.length || sections.some(s => s.enabled !== false && s.key === sectionKey && (s.fields || []).some(f => f.slug === slug && f.enabled));
  const docOn = toPhase === 'Won' && fieldOn('po', 'po_document_url');
  const poNumberOn = toPhase === 'Won' && fieldOn('po', 'po_number');

  const [date, setDate] = useState(todayStr());
  const [file, setFile] = useState(null);
  const existingDoc = lead.po_document_url || null;
  const [poNumber, setPoNumber] = useState(lead.po_number || '');
  const [reason, setReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [resumeDate, setResumeDate] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // A Sales Rep may backdate up to 7 days and never pick a future date; other roles may pick any date.
  const minDate = isBD ? addDaysStr(todayStr(), -7) : undefined;
  const maxDate = isBD ? todayStr() : undefined;

  const save = async () => {
    setErr('');
    if (!date) { setErr(`Enter the ${toPhase} date.`); return; }
    if (isBD && (date < minDate || date > maxDate)) { setErr(`Pick a date from ${minDate} to today. Sales Reps can backdate up to 7 days, and not into the future.`); return; }
    if (docOn && !existingDoc && !file) { setErr('An order document is required once the phase is Won.'); return; }
    if (poNumberOn && (existingDoc || file) && !poNumber.trim()) { setErr('Please enter the Order Number for the received order.'); return; }
    const lostReason = reason === 'Other' ? reasonOther.trim() : reason;
    if (toPhase === 'Lost' && !lostReason) { setErr(reason === 'Other' ? 'Describe the reason the deal was lost.' : 'Choose why the deal was lost.'); return; }

    // Only the stage and its details are sent; the server keeps all other saved values.
    const payload = { phase: toPhase, phase_date: date };
    if (toPhase === 'Won') Object.assign(payload, { po_number: poNumber.trim() || null, po_document_url: existingDoc });
    if (toPhase === 'Lost') payload.lost_reason = lostReason;
    if (toPhase === 'On Hold' && resumeDate) payload.hold_end_date = resumeDate;

    setBusy(true);
    try {
      await updateLead(lead.id, payload);
      if (file) {
        const { url } = await uploadPoDocument(lead.id, file);
        await updateLead(lead.id, { po_document_url: url });
      }
      onDone();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not move the lead.');
      setBusy(false);
    }
  };

  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--m3-on-surface)', marginBottom: 4 };
  const hint = { fontSize: 11, color: 'var(--m3-outline)', margin: '4px 0 0' };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--m3-on-surface)' }}>Move to {toPhase}</div>
            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>{lead.customer_name} · from {lead.phase}</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>{toPhase} Date *</label>
            <input type="date" className="input" value={date} min={minDate} max={maxDate} onChange={e => setDate(e.target.value)} />
            <p style={hint}>{isBD ? 'Today, or up to 7 days back if it happened earlier.' : 'Defaults to today. You can pick any date.'}</p>
          </div>

          {toPhase === 'Won' && docOn && (
            <div>
              <label style={label}>Order Document *</label>
              {existingDoc && !file && (
                <p style={{ fontSize: 12, margin: '0 0 6px' }}>
                  <a href={fileUrl(existingDoc)} target="_blank" rel="noopener noreferrer">📄 View the document already attached</a>
                </p>
              )}
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0] || null)} />
            </div>
          )}
          {toPhase === 'Won' && poNumberOn && (
            <div>
              <label style={label}>Order Number{docOn ? ' *' : ''}</label>
              <input className="input" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Enter order number (identifier)" />
            </div>
          )}

          {toPhase === 'Lost' && (
            <div>
              <label style={label}>Reason *</label>
              <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="">Choose a reason…</option>
                {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {reason === 'Other' && (
                <input className="input" style={{ marginTop: 8 }} value={reasonOther} onChange={e => setReasonOther(e.target.value)} placeholder="Describe the reason…" autoFocus />
              )}
            </div>
          )}

          {toPhase === 'On Hold' && (
            <div>
              <label style={label}>Resume Date</label>
              <input type="date" className="input" value={resumeDate} min={todayStr()} onChange={e => setResumeDate(e.target.value)} />
              <p style={hint}>When to pick this lead up again. Its confidence score is frozen while it's on hold.</p>
            </div>
          )}

          {err && <div style={{ background: 'var(--m3-error-container)', color: 'var(--m3-error)', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <button type="button" className="btn btn-sm" style={{ background: 'none', border: 'none', color: 'var(--m3-primary)', padding: 0 }} onClick={onOpenForm}>
              Open full lead instead
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Moving…' : `Move to ${toPhase}`}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
