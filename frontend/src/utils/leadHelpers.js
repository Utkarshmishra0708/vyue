import { PHASE_DATE_MAP, TAT_DAYS, SIGNAGE_SERVICES } from './constants';

// Auto-calculated Total Contract Value, in lakhs (₹ / 100,000), from a lead/form's ticked services:
//   opex  → qty × rate × contract months   (recurring)
//   capex → qty × rate                      (one-time)
// The device line uses its per-lead cost type (form.device_cost_type, default capex). Returns ''
// when nothing is calculable (no services, or missing rate/qty), so callers can show a blank field.
// Mirror of computeTcvLakhs() in backend/routes/leads.js — keep the two formulas in sync.
export function computeTcvLakhs(form) {
  const months = parseInt(form.contract_period_months, 10) || 0;
  let rupees = 0;
  const add = (included, rate, qty, nature) => {
    if (!included) return;
    const r = parseFloat(rate) || 0;
    const q = parseInt(qty, 10) || 0;
    if (!r || !q) return;
    rupees += nature === 'opex' ? r * q * months : r * q;
  };
  for (const svc of SIGNAGE_SERVICES) {
    add(form[`includes_${svc.key}`], form[`${svc.key}_rate`], form[`${svc.key}_qty`], svc.nature);
  }
  add(form.includes_device, form.device_rate, form.device_qty, form.device_cost_type === 'opex' ? 'opex' : 'capex');
  return rupees > 0 ? +(rupees / 100000).toFixed(2) : '';
}

// Additional Notes is stored as rich-text HTML (react-quill). Strip tags for
// plain-text contexts (Excel/PDF cells) so exports don't show raw markup.
export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

export function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtMonthYear(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
export function daysBetween(a, b) {
  const ms = new Date(b).setHours(0,0,0,0) - new Date(a).setHours(0,0,0,0);
  return Math.round(ms / 86400000);
}
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function addDaysStr(dateStr, days) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

export function isTATBreached(lead) {
  if (['PO Expected', 'PO Received', 'Lost', 'On Hold'].includes(lead.phase)) return false;
  const dateKey = PHASE_DATE_MAP[lead.phase];
  const dateStr = lead.phase_changed_at || (dateKey ? lead[dateKey] : null) || lead.createdAt;
  if (!dateStr) return false;
  return daysBetween(dateStr, new Date()) > TAT_DAYS;
}

export function isOverdue(lead) {
  if (!lead.next_followup_date) return false;
  if (['Lost', 'PO Received', 'On Hold'].includes(lead.phase)) return false;
  return new Date(lead.next_followup_date) < new Date();
}

export function getPOExpiryDays(lead) {
  if (!lead.po_received_date || !lead.po_validity_months) return null;
  const expiry = new Date(lead.po_received_date);
  expiry.setMonth(expiry.getMonth() + lead.po_validity_months);
  return daysBetween(new Date(), expiry);
}

export function calcLeadScore(lead) {
  if (lead.phase === 'PO Received') return 100;
  if (lead.phase === 'Lost') return 0;
  if (lead.phase === 'On Hold') return 10;
  const PHASE_PTS = { New:5, Qualified:15, Demo:25, Proposal:35, Negotiation:48, 'PO Expected':58 };
  let s = PHASE_PTS[lead.phase] || 5;
  if (lead.lead_temperature === 'Hot') s += 20;
  else if (lead.lead_temperature === 'Warm') s += 10;
  const tcv = parseFloat(lead.potential_tcv_lakhs) || 0;
  if (tcv > 50) s += 10; else if (tcv > 20) s += 7; else if (tcv > 5) s += 4; else if (tcv > 0) s += 2;
  const dateKey = PHASE_DATE_MAP[lead.phase];
  const dateStr = lead.phase_changed_at || (dateKey ? lead[dateKey] : null) || lead.createdAt;
  if (dateStr && daysBetween(dateStr, new Date()) > TAT_DAYS) s -= 12;
  if (lead.next_followup_date) {
    s += 5;
    if (new Date(lead.next_followup_date) >= new Date()) s += 5;
  }
  return Math.min(99, Math.max(1, s));
}

// Build stage-age + team-average lookup from raw stage_history rows.
export function buildRotMetrics(history) {
  const byLead = {};
  for (const sh of history) (byLead[sh.lead_id] ||= []).push(sh);
  const stageDurations = {};
  const lastEntry = {};
  for (const [leadId, list] of Object.entries(byLead)) {
    const sorted = [...list].sort((a,b) => new Date(a.changed_at) - new Date(b.changed_at));
    lastEntry[leadId] = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      const stage = sorted[i].to_stage;
      const days = daysBetween(sorted[i].changed_at, sorted[i+1].changed_at);
      if (days >= 0) (stageDurations[stage] ||= []).push(days);
    }
  }
  const teamAvg = {};
  for (const stage of Object.keys(stageDurations)) {
    const arr = stageDurations[stage];
    teamAvg[stage] = arr.length ? Math.round(arr.reduce((s,d) => s+d, 0) / arr.length) : null;
  }
  return { lastEntry, teamAvg, stageDurations };
}

export function getRotState(lead, lastEntry, teamAvg) {
  if (['PO Received', 'Lost', 'On Hold'].includes(lead.phase)) return null;
  const entry = lastEntry[lead.id];
  const since = entry ? new Date(entry.changed_at) : new Date(lead.phase_changed_at || lead.createdAt);
  const ageDays = daysBetween(since, new Date());
  const avg = teamAvg[lead.phase];
  const threshold = avg && avg > 0 ? avg * 2 : 30;
  if (ageDays < threshold) return null;
  return { ageDays, threshold, severity: ageDays >= threshold * 1.5 ? 'red' : 'amber' };
}
