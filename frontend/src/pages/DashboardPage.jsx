import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getLeads, getStageHistory, getSettings, setSetting, getBds, getBusinessUnitConfig } from '../services/api';
import { STAGE_ORDER, STAGE_WIN_PCT, PHASE_BADGE } from '../utils/constants';
import { fmtDate, isOverdue, daysBetween, calcLeadScore, dealSizeThresholds, renewalStatus, renewalLabel, RENEWAL_BAND_STYLE, buildRenewedSet } from '../utils/leadHelpers';
import IndiaMap from '../components/IndiaMap';
import { buildNameCount, bdLabel as _bdLabel, ownerLabel as _ownerLabel } from '../utils/nameLabels';

function Kpi({ icon, label, value, sub, onClick }) {
  return (
    <div className={`kpi-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div style={{ marginBottom: 6 }}>{icon}</div>
      <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Inventory Trend granularities and how many past/future buckets each shows around "now".
const INV_GRAN = [
  { key: 'weekly', label: 'Weekly', unit: 'week', past: 4, future: 5 },
  { key: 'monthly', label: 'Monthly', unit: 'month', past: 3, future: 4 },
  { key: 'quarterly', label: 'Quarterly', unit: 'quarter', past: 2, future: 3 },
  { key: 'semi_annual', label: 'Semi-annually', unit: 'half-year', past: 1, future: 2 },
  { key: 'annual', label: 'Annually', unit: 'year', past: 1, future: 2 },
];
// The calendar period `offset` away from `now` (0 = current, -1 = previous, +1 = next), for a granularity.
function periodBucket(now, gran, offset) {
  if (gran === 'weekly') {
    const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999);
    return { start: s, end: e, label: `${s.getDate()} ${MON[s.getMonth()]}` };
  }
  if (gran === 'monthly') {
    const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    return { start: s, end: e, label: `${MON[s.getMonth()]} '${String(s.getFullYear()).slice(2)}` };
  }
  if (gran === 'quarterly') {
    const s = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + offset * 3, 1);
    const e = new Date(s.getFullYear(), s.getMonth() + 3, 0, 23, 59, 59, 999);
    return { start: s, end: e, label: `Q${Math.floor(s.getMonth() / 3) + 1} '${String(s.getFullYear()).slice(2)}` };
  }
  if (gran === 'semi_annual') {
    const s = new Date(now.getFullYear(), (now.getMonth() < 6 ? 0 : 6) + offset * 6, 1);
    const e = new Date(s.getFullYear(), s.getMonth() + 6, 0, 23, 59, 59, 999);
    return { start: s, end: e, label: `H${s.getMonth() < 6 ? 1 : 2} '${String(s.getFullYear()).slice(2)}` };
  }
  const s = new Date(now.getFullYear() + offset, 0, 1);
  const e = new Date(now.getFullYear() + offset, 11, 31, 23, 59, 59, 999);
  return { start: s, end: e, label: String(s.getFullYear()) };
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [dashSearchParams] = useSearchParams();

  const [leads, setLeads] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [bds, setBds] = useState([]);
  const [settings, setSettings] = useState({});
  const [filterBD, setFilterBD] = useState(''); // user id (string) or ''
  const [loading, setLoading] = useState(true);
  const [editingTarget, setEditingTarget] = useState(null); // bd id (string) or 'weekly'
  const [targetInput, setTargetInput] = useState('');
  const [tab, setTab] = useState(() => dashSearchParams.get('tab') || 'overview');
  const [datePreset, setDatePreset] = useState('all'); // all | week | month | quarter | year | custom
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [attPeriod, setAttPeriod] = useState('monthly');
  const [poTrendMetric, setPoTrendMetric] = useState('count'); // count | tcv | acv | licenses (shown as Units)
  // Hardware units are shown only for a business whose own service catalog includes hardware.
  const [hasHardware, setHasHardware] = useState(false);
  useEffect(() => {
    let alive = true;
    getBusinessUnitConfig(user.business_unit)
      .then(cfg => { if (alive) setHasHardware((cfg.services || []).some(sv => sv.hardware)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user.business_unit]);
  const [poTrendYears, setPoTrendYears] = useState([]);

  useEffect(() => {
    Promise.all([getLeads(), getStageHistory(), getSettings(), getBds(user.business_unit)])
      .then(([ld, sh, st, bl]) => { setLeads(ld); setStageHistory(sh); setSettings(st); setBds(bl); })
      .finally(() => setLoading(false));
  }, [user.business_unit]);

  // Name-duplication lookup: when two BDs share a name, show "Name (username)" to disambiguate.
  const bdNameCount = useMemo(() => buildNameCount(bds), [bds]);
  const bdLabel = (b) => _bdLabel(b, bdNameCount);
  const ownerLabel = (owner) => _ownerLabel(owner, bdNameCount);

  const weeklyTarget = parseFloat(settings.weekly_target_lakhs) || 5.3;
  const bdTargets = useMemo(() => { try { return JSON.parse(settings.bd_weekly_targets || '{}'); } catch { return {}; } }, [settings]);

  // The weekly target that applies to the CURRENT view: a BD sees their own target; an admin viewing
  // one BD sees that BD's; an admin viewing everyone sees the team total (sum of each BD's target).
  // A BD with no individually-set target falls back to the business-wide default.
  const scopedBdId = !isAdmin ? String(user.id) : (filterBD || null);
  const scopedWeeklyTarget = useMemo(() => {
    if (scopedBdId) return Number(bdTargets[scopedBdId]) || weeklyTarget;
    if (bds.length) return bds.reduce((s, b) => s + (Number(bdTargets[String(b.id)]) || weeklyTarget), 0);
    return weeklyTarget;
  }, [scopedBdId, bdTargets, weeklyTarget, bds]);
  const scopedBdObj = scopedBdId ? bds.find(b => String(b.id) === scopedBdId) || { name: user.name } : null;
  const scopedBdDisplay = scopedBdObj ? ownerLabel(scopedBdObj) : null;

  // BD-filtered base (used by widgets that have their own time axis, e.g. Inventory Trend).
  const bdFiltered = useMemo(() => isAdmin && filterBD ? leads.filter(l => String(l.owner?.id) === filterBD) : leads, [leads, isAdmin, filterBD]);

  // Header date-range filter — bounds leads by creation date. "all" = no restriction (default), so
  // the dashboard behaves exactly as before until the user narrows the window.
  const dateBounds = useMemo(() => {
    const now = new Date();
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
    switch (datePreset) {
      case 'week': { const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { from: startOfDay(s), to: endOfDay(now) }; }
      case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
      case 'quarter': return { from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), to: endOfDay(now) };
      case 'year': return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
      case 'custom': return { from: customFrom ? startOfDay(new Date(customFrom)) : null, to: customTo ? endOfDay(new Date(customTo)) : null };
      default: return { from: null, to: null };
    }
  }, [datePreset, customFrom, customTo]);

  // The date a lead "belongs to" for the period filter: a won deal lands on its Won date
  // (its real business event), everything else on when it entered the system. Using the business
  // date means historical bulk-imported POs fall in their true week/month, not the import date.
  const effectiveDate = (l) => ((l.phase === 'Won' && (l.po_received_date || l.phase_changed_at)) || l.createdAt);
  const filtered = useMemo(() => {
    if (!dateBounds.from && !dateBounds.to) return bdFiltered;
    return bdFiltered.filter(l => {
      const d = new Date(effectiveDate(l));
      if (dateBounds.from && d < dateBounds.from) return false;
      if (dateBounds.to && d > dateBounds.to) return false;
      return true;
    });
  }, [bdFiltered, dateBounds]);

  // POs that have been renewed — suppresses expiry warnings, shows "Renewed" badge instead.
  const renewedIds = useMemo(() => buildRenewedSet(leads), [leads]);

  const navigateWithFilter = (filter) => {
    const params = new URLSearchParams({ filter });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    params.set('dtab', tab);
    navigate(`/leads?${params}`);
  };
  const navigateWithPhase = (phase) => {
    const params = new URLSearchParams({ phase });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    params.set('dtab', tab);
    navigate(`/leads?${params}`);
  };
  const navigateWithConf = (conf) => {
    const params = new URLSearchParams({ conf });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    params.set('dtab', tab);
    navigate(`/leads?${params}`);
  };
  const navigateReached = (stage) => {
    const reached = STAGE_ORDER.slice(STAGE_ORDER.indexOf(stage));
    const params = new URLSearchParams({ phase: reached.join(',') });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    params.set('dtab', tab);
    navigate(`/leads?${params}`);
  };
  const navigateWithSource = (source) => {
    const params = new URLSearchParams({ source });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    params.set('dtab', tab);
    navigate(`/leads?${params}`);
  };
  const navigateWithIds = (ids, label) => {
    if (!ids || !ids.length) return;
    const params = new URLSearchParams({ ids: ids.join(','), idslabel: label });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    params.set('dtab', tab);
    navigate(`/leads?${params}`);
  };

  const active = filtered.filter(l => !['Lost', 'On Hold', 'Won'].includes(l.phase));
  const won = filtered.filter(l => l.phase === 'Won');
  const hot = filtered.filter(l => l.lead_temperature === 'Hot' && !['Lost', 'Won'].includes(l.phase));
  const overdue = filtered.filter(isOverdue);
  const openTCV = active.reduce((s, l) => s + (parseFloat(l.potential_tcv_lakhs) || 0), 0);
  const wonTCV = won.reduce((s, l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);

  // --- Pipeline Confidence (win-probability) over the ACTIVE pipeline. Uses the per-lead confidence
  // score + last-week baseline from the Lead Confidence Scoring engine. ---
  const confScored = active.filter(l => l.confidence_score !== null && l.confidence_score !== undefined);
  const confAvg = confScored.length ? Math.round(confScored.reduce((s, l) => s + Number(l.confidence_score), 0) / confScored.length) : null;
  const confWithPrev = confScored.filter(l => l.confidence_prev !== null && l.confidence_prev !== undefined);
  const confCur = confWithPrev.length ? confWithPrev.reduce((s, l) => s + Number(l.confidence_score), 0) / confWithPrev.length : null;
  const confPrevAvg = confWithPrev.length ? confWithPrev.reduce((s, l) => s + Number(l.confidence_prev), 0) / confWithPrev.length : null;
  const confTrend = (confCur === null || confPrevAvg === null) ? 'flat' : (confCur > confPrevAvg + 0.5 ? 'up' : confCur < confPrevAvg - 0.5 ? 'down' : 'flat');
  const confBandOf = (l) => { const c = Number(l.confidence_score); return c >= 60 ? 'high' : c >= 30 ? 'medium' : 'low'; };
  const confHigh = confScored.filter(l => confBandOf(l) === 'high').length;
  const confMedium = confScored.filter(l => confBandOf(l) === 'medium').length;
  const confLow = confScored.filter(l => confBandOf(l) === 'low').length;
  const confLosing = confScored
    .filter(l => l.confidence_prev != null && Number(l.confidence_score) < Number(l.confidence_prev) - 0.5)
    .map(l => ({ id: l.id, customer_name: l.customer_name, phase: l.phase, score: Number(l.confidence_score), drop: Number(l.confidence_prev) - Number(l.confidence_score) }))
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 5);

  // Data quality — only mandatory fields (State/City are optional, so excluded)
  const missingTCV = filtered.filter(l => !l.potential_tcv_lakhs || parseFloat(l.potential_tcv_lakhs) === 0).length;
  const missingFollowup = filtered.filter(l => !l.next_followup_date && !['Won', 'Lost', 'On Hold'].includes(l.phase)).length;
  // Quantity counts hardware units, so it is only "missing" on a lead that has a hardware service but no
  // units. A software-only lead correctly has a quantity of 0.
  const hasHardwareLine = (l) => { try { return (JSON.parse(l.services_json || '[]') || []).some(x => x && x.hw); } catch { return false; } };
  const missingQuantity = filtered.filter(l => hasHardwareLine(l) && !(Number(l.quantity) > 0)).length;
  const dataQualityIssues = [
    { label: 'Missing Deal Value', count: missingTCV, badge: 'badge-red' },
    { label: 'No Follow-Up Date', count: missingFollowup, badge: 'badge-amber' },
    { label: 'Missing Quantity', count: missingQuantity, badge: 'badge-amber' },
  ].filter(d => d.count > 0);
  const totalDataIssues = dataQualityIssues.reduce((s, d) => s + d.count, 0);

  // Pipeline target — respects the dashboard date-range filter.
  // When a specific period is selected (week/month/quarter/year/custom), won POs are filtered to
  // that range and the target scales proportionally (weekly target × weeks in period).
  // "All time" falls back to the current week so the card stays meaningful.
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
  const PERIOD_LABELS = { all: 'This Week', week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year', custom: 'Selected Period' };
  const pipelineLabel = PERIOD_LABELS[datePreset] || 'This Week';
  const pipeStart = dateBounds.from || weekStart;
  const pipeEnd = dateBounds.to || weekEnd;
  const pipeWeeks = datePreset === 'all' || datePreset === 'week' ? 1
    : datePreset === 'month' ? (new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() / 7)
    : datePreset === 'quarter' ? 13
    : datePreset === 'year' ? 52
    : Math.max(1, Math.round((pipeEnd - pipeStart) / 86400000 + 1) / 7);
  const pipelineTarget = scopedWeeklyTarget * pipeWeeks;
  const pipelineWonLeads = filtered.filter(l => l.phase === 'Won').filter(l => {
    const d = new Date(l.po_received_date || l.phase_changed_at);
    return d >= pipeStart && d <= pipeEnd;
  });
  const pipelineWon = pipelineWonLeads.reduce((s, l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
  const pipelinePct = Math.min(100, Math.round((pipelineWon / pipelineTarget) * 100));

  // Extras for a business that sells hardware: total hardware units won + distinct customers
  const sigWonLeads = hasHardware ? pipelineWonLeads : [];
  const pipelineLicenses = sigWonLeads.reduce((s, l) => s + (parseInt(l.quantity, 10) || 0), 0);
  const pipelineCustomers = new Set(sigWonLeads.map(l => l.customer_name).filter(Boolean)).size;

  // STAGE_ORDER already ends with Lost and On Hold; adding them again showed duplicate chips.
  const phaseCounts = STAGE_ORDER.map(p => ({ phase: p, count: filtered.filter(l => l.phase === p).length }));
  const funnelData = STAGE_ORDER.filter(s => s !== 'Lost' && s !== 'On Hold').map(p => ({ name: p, count: filtered.filter(l => l.phase === p).length }));

  const filteredLeadIds = new Set(filtered.map(l => l.id));
  const scopedHistory = stageHistory.filter(sh => filteredLeadIds.has(sh.lead_id));

  // Conversion funnel — based on each lead's CURRENT phase, so it updates immediately as a stage
  // moves (no dependence on stage_history completeness, which was making it look stale). A lead
  // currently at stage N has reached every earlier stage, so each level counts leads at or beyond it.
  // Lost / On Hold aren't pipeline stages and are excluded. This yields a monotonically narrowing —
  // i.e. a true funnel — shape.
  const stageRank = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i]));
  // Funnel omits the Negotiation step by request. Counts still use each stage's TRUE rank, so a lead
  // sitting in Negotiation is correctly counted as having reached Proposal but not yet Order Expected.
  const funnelStages = STAGE_ORDER.filter(s => s !== 'Negotiation' && s !== 'Lost' && s !== 'On Hold').map(stage => ({
    stage,
    count: filtered.filter(l => { const r = stageRank[l.phase]; return r !== undefined && r >= stageRank[stage]; }).length,
    winPct: STAGE_WIN_PCT[stage] || 0,
  }));
  const funnelWithConv = funnelStages.map((s, i) => ({
    ...s, conv: i === 0 || funnelStages[i-1].count === 0 ? null : Math.round((s.count / funnelStages[i-1].count) * 100),
  }));

  // Avg time-in-stage
  const byLead = {};
  for (const sh of scopedHistory) (byLead[sh.lead_id] ||= []).push(sh);
  const stageDurations = {};
  for (const list of Object.values(byLead)) {
    const sorted = [...list].sort((a,b) => new Date(a.changed_at) - new Date(b.changed_at));
    for (let i = 0; i < sorted.length - 1; i++) {
      const stage = sorted[i].to_stage;
      const days = daysBetween(sorted[i].changed_at, sorted[i+1].changed_at);
      if (days >= 0) (stageDurations[stage] ||= []).push(days);
    }
  }
  const avgTimeInStage = STAGE_ORDER.map(stage => {
    const arr = stageDurations[stage] || [];
    return { stage, avgDays: arr.length ? Math.round(arr.reduce((s,d)=>s+d,0)/arr.length) : null, samples: arr.length };
  });

  // Lead Source Effectiveness — which channels bring the best leads. Per source: volume, win rate
  // (won / closed), total pipeline TCV, and average lead score. Ranked by TCV so the most valuable
  // source is on top. Respects the active BD filter (via `filtered`).
  const scoreThresholds = useMemo(() => dealSizeThresholds(leads), [leads]);
  const sourceStats = useMemo(() => {
    const known = ['Channel Partner', 'Account Manager', 'Direct Sales'];
    const sources = Array.from(new Set([...known, ...filtered.map(l => l.lead_source).filter(Boolean)]));
    return sources.map(src => {
      const rows = filtered.filter(l => l.lead_source === src);
      const won = rows.filter(l => l.phase === 'Won').length;
      const lost = rows.filter(l => l.phase === 'Lost').length;
      const closed = won + lost;
      const tcv = rows.reduce((s, l) => s + (parseFloat(l.potential_tcv_lakhs) || 0), 0);
      const scores = rows.map(l => calcLeadScore(l, scoreThresholds)).filter(v => v !== null);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return { src, count: rows.length, won, winRate: closed ? Math.round((won / closed) * 100) : null, tcv, avgScore };
    }).filter(s => s.count > 0).sort((a, b) => b.tcv - a.tcv);
  }, [filtered, scoreThresholds]);

  // Ticker follows the same BD filter as the rest of the dashboard.
  const overdueForTicker = filtered.filter(isOverdue);
  // On Hold leads are surfaced on their own ticker for team-wide visibility (scoring spec Section 7.2).
  const onHoldForTicker = filtered.filter(l => l.phase === 'On Hold');

  // Annual BD performance — BDs see only their own; admin sees all BDs, or just the selected one.
  const currentYear = new Date().getFullYear();
  const bdsToShow = isAdmin ? (filterBD ? bds.filter(b => String(b.id) === filterBD) : bds) : bds.filter(b => String(b.id) === String(user.id));
  // BD cards (weekly targets) follow the same selection.
  const bdCards = isAdmin && filterBD ? bds.filter(b => String(b.id) === filterBD) : bds;
  const annualBDPerf = bdsToShow.map(bd => {
    const bdLeads = leads.filter(l => l.owner?.id === bd.id);
    const wonThisYear = bdLeads.filter(l => l.phase === 'Won' && new Date(l.po_received_date || l.phase_changed_at).getFullYear() === currentYear);
    const closedThisYear = bdLeads.filter(l => ['Won','Lost'].includes(l.phase) && new Date(l.po_received_date || l.phase_changed_at || l.createdAt).getFullYear() === currentYear);
    const wonTCVYear = wonThisYear.reduce((s,l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
    const convRate = closedThisYear.length ? Math.round((wonThisYear.length / closedThisYear.length) * 100) : 0;
    const activeNow = bdLeads.filter(l => !['Lost','On Hold','Won'].includes(l.phase));
    return { id: bd.id, name: bd.name, label: bdLabel(bd), totalLeads: bdLeads.length, wonDeals: wonThisYear.length, wonTCV: wonTCVYear, convRate, activeLeads: activeNow.length };
  });

  // Won Trend — year-over-year month-by-month comparison.
  const wonPOs = useMemo(() => bdFiltered.filter(l => l.phase === 'Won'), [bdFiltered]);
  const poTrendAvailableYears = useMemo(() => {
    const yrs = new Set();
    for (const l of wonPOs) {
      const d = l.po_received_date || l.phase_changed_at;
      if (d) yrs.add(new Date(d).getFullYear());
    }
    return [...yrs].sort((a, b) => b - a);
  }, [wonPOs]);
  useEffect(() => {
    if (poTrendYears.length === 0 && poTrendAvailableYears.length > 0) {
      setPoTrendYears(poTrendAvailableYears.slice(0, 2));
    }
  }, [poTrendAvailableYears]);
  const poTrendData = useMemo(() => {
    const activeYears = poTrendYears.length ? poTrendYears : poTrendAvailableYears.slice(0, 2);
    return MON.map((m, mi) => {
      const row = { month: m };
      for (const yr of activeYears) {
        const matches = wonPOs.filter(l => {
          const d = new Date(l.po_received_date || l.phase_changed_at);
          return d.getFullYear() === yr && d.getMonth() === mi;
        });
        row[`${yr}_count`] = matches.length;
        row[`${yr}_tcv`] = matches.reduce((s, l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
        row[`${yr}_acv`] = matches.reduce((s, l) => s + (parseFloat(l.acv_lakhs) || 0), 0);
        row[`${yr}_licenses`] = matches.reduce((s, l) => s + (parseInt(l.quantity, 10) || 0), 0);
      }
      return row;
    });
  }, [wonPOs, poTrendYears, poTrendAvailableYears]);
  const poTrendActiveYears = poTrendYears.length ? poTrendYears : poTrendAvailableYears.slice(0, 2);
  const PO_TREND_COLORS = ['var(--m3-primary)', '#f59e0b', 'var(--m3-success)', 'var(--m3-error)', '#8b5cf6'];
  const poTrendTotals = useMemo(() => {
    const totals = {};
    for (const yr of poTrendActiveYears) {
      totals[yr] = { count: 0, tcv: 0, acv: 0, licenses: 0 };
      for (const row of poTrendData) {
        totals[yr].count += row[`${yr}_count`] || 0;
        totals[yr].tcv += row[`${yr}_tcv`] || 0;
        totals[yr].acv += row[`${yr}_acv`] || 0;
        totals[yr].licenses += row[`${yr}_licenses`] || 0;
      }
    }
    return totals;
  }, [poTrendData, poTrendActiveYears]);

  // Renewal alerts — driven by PO End Date (service_end_date) for every WON PO, the single
  // definition used across the app (see renewalStatus in leadHelpers). Surfaces anything expiring
  // within 90 days OR already lapsed, soonest/most-overdue first.
  const renewalAlerts = filtered
    .map(l => ({ lead: l, status: renewalStatus(l, renewedIds) }))
    .filter(x => x.status && x.status.band !== 'ok' && x.status.band !== 'renewed')
    .map(x => ({ ...x.lead, renewal: x.status, daysToExpiry: x.status.days }))
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  // --- Cohort Aging Grid — financial year (Apr-Mar). Origin month = month of
  // device_requested_date; closing month = month of po_received_date (Won only). ---
  const [closureFY, setClosureFY] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const closureData = useMemo(() => {
    const fyStart = new Date(closureFY, 3, 1);
    const fyEnd = new Date(closureFY + 1, 2, 31, 23, 59, 59);
    const fyMonths = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(closureFY, 3 + i, 1);
      fyMonths.push({ month: d.getMonth(), year: d.getFullYear(), label: `${MON[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` });
    }
    const mKey = (m, y) => `${y}-${String(m).padStart(2, '0')}`;
    const fyKeys = fyMonths.map(m => mKey(m.month, m.year));

    const grid = {};
    fyKeys.forEach(k => { grid[k] = { total: 0, totalIds: [], cells: {}, cellIds: {}, open: 0, openIds: [], lost: 0, lostIds: [] }; });

    for (const l of bdFiltered) {
      if (!l.device_requested_date) continue;
      const drd = new Date(l.device_requested_date);
      if (drd < fyStart || drd > fyEnd) continue;
      const units = parseInt(l.quantity, 10) || 0;
      if (!units) continue;
      const originKey = mKey(drd.getMonth(), drd.getFullYear());
      if (!grid[originKey]) continue;
      grid[originKey].total += units;
      grid[originKey].totalIds.push(l.id);

      if (l.phase === 'Lost') {
        grid[originKey].lost += units;
        grid[originKey].lostIds.push(l.id);
      } else if (l.phase === 'Won' && l.po_received_date) {
        const prd = new Date(l.po_received_date);
        const closeKey = mKey(prd.getMonth(), prd.getFullYear());
        if (!grid[originKey].cells[closeKey]) grid[originKey].cells[closeKey] = 0;
        if (!grid[originKey].cellIds[closeKey]) grid[originKey].cellIds[closeKey] = [];
        grid[originKey].cells[closeKey] += units;
        grid[originKey].cellIds[closeKey].push(l.id);
      } else {
        grid[originKey].open += units;
        grid[originKey].openIds.push(l.id);
      }
    }

    const rows = fyKeys.map((k, i) => ({
      label: fyMonths[i].label, key: k, total: grid[k].total, totalIds: grid[k].totalIds,
      cells: fyKeys.map(ck => grid[k].cells[ck] || 0),
      cellIds: fyKeys.map(ck => grid[k].cellIds[ck] || []),
      open: grid[k].open, openIds: grid[k].openIds,
      lost: grid[k].lost, lostIds: grid[k].lostIds,
    }));

    return { fyMonths, fyKeys, rows };
  }, [bdFiltered, closureFY]);

  // --- Target vs Expected vs Won — attainment for the selected period. Expected is driven by each
  // deal's Order Expected date (open deals forecast to land in the period); Won by Won date
  // (deals actually closed). Target scales the stored weekly target by the period length. Uses
  // bdFiltered (its own period axis), independent of the header date-range filter. ---
  const attCfg = INV_GRAN.find(g => g.key === attPeriod) || INV_GRAN[1];
  const attainment = useMemo(() => {
    const ref = new Date();
    const cur = periodBucket(ref, attPeriod, 0);
    const prev = periodBucket(ref, attPeriod, -1);
    const inRange = (dateStr, b) => { if (!dateStr) return false; const d = new Date(dateStr); return d >= b.start && d <= b.end; };
    const wonRows = (b) => bdFiltered.filter(l => l.phase === 'Won' && inRange(l.po_received_date || l.phase_changed_at, b));
    const expRows = (b) => bdFiltered.filter(l => !['Lost', 'Won'].includes(l.phase) && inRange(l.po_expected_date, b));
    const sumWon = (rows) => rows.reduce((s, l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
    const sumTcv = (rows) => rows.reduce((s, l) => s + (parseFloat(l.potential_tcv_lakhs) || 0), 0);
    const wonCur = wonRows(cur), expCur = expRows(cur);
    const days = Math.max(1, Math.round((cur.end - cur.start) / 86400000));
    const target = scopedWeeklyTarget * (days / 7);
    const won = sumWon(wonCur), expected = sumTcv(expCur);
    return {
      cur, won, expected, target, expCount: expCur.length,
      wonIds: wonCur.map(l => l.id), expectedIds: expCur.map(l => l.id),
      wonPrev: sumWon(wonRows(prev)), expectedPrev: sumTcv(expRows(prev)),
      projected: won + expected,
      pct: target > 0 ? Math.round(((won + expected) / target) * 100) : 0,
      wonPct: target > 0 ? Math.round((won / target) * 100) : 0,
    };
  }, [bdFiltered, attPeriod, scopedWeeklyTarget]);

  const saveWeeklyTarget = async () => {
    const v = parseFloat(targetInput);
    if (isNaN(v) || v <= 0) return;
    await setSetting('weekly_target_lakhs', String(v));
    setSettings(s => ({ ...s, weekly_target_lakhs: String(v) }));
    setEditingTarget(null);
  };
  const saveBdTarget = async (bdId) => {
    const v = parseFloat(targetInput);
    if (isNaN(v) || v <= 0) return;
    const next = { ...bdTargets, [String(bdId)]: v };
    await setSetting('bd_weekly_targets', JSON.stringify(next));
    setSettings(s => ({ ...s, bd_weekly_targets: JSON.stringify(next) }));
    setEditingTarget(null);
  };

  if (loading) return <Layout><div style={{ padding: 20, color: 'var(--m3-outline)' }}>Loading…</div></Layout>;

  return (
    <Layout>
      <div style={{ background: 'var(--m3-surface-container-lowest)', borderBottom: '1px solid var(--m3-outline-variant)', padding: '10px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Dashboard</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>Pipeline overview & analytics</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 150 }} value={datePreset} onChange={e => setDatePreset(e.target.value)} title="Filter leads by creation date">
              <option value="all">All time</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
              <option value="custom">Custom range…</option>
            </select>
            {datePreset === 'custom' && (
              <>
                <input className="input" style={{ width: 140 }} type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} />
                <span style={{ color: 'var(--m3-outline)', fontSize: 12 }}>→</span>
                <input className="input" style={{ width: 140 }} type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} />
              </>
            )}
            {isAdmin && (
              <select className="input" style={{ width: 160 }} value={filterBD} onChange={e => setFilterBD(e.target.value)}>
                <option value="">All Sales Reps</option>
                {bds.map(b => <option key={b.id} value={String(b.id)}>{bdLabel(b)}</option>)}
              </select>
            )}
          </div>
        </div>
        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          {[['overview', 'Overview'], ['analytics', 'Analytics']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13,
                fontWeight: tab === key ? 700 : 500, color: tab === key ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                borderBottom: tab === key ? '2px solid #4f46e5' : '2px solid transparent', marginBottom: -1,
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'overview' && (<>
        {overdueForTicker.length > 0 && (() => {
          const text = overdueForTicker
            .map(l => `${l.customer_name} · ${ownerLabel(l.owner)} · Due ${fmtDate(l.next_followup_date)}`)
            .join('     •     ');
          // Speed scales with content so the pace stays even regardless of how many items there are.
          const duration = Math.max(18, overdueForTicker.length * 6);
          return (
            <div style={{ background: 'var(--m3-error)', color: '#fff', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> OVERDUE</span>
              <div className="marquee" style={{ flex: 1 }}>
                <div className="marquee__track" style={{ animationDuration: `${duration}s` }}>
                  <span style={{ paddingRight: 48 }}>{text}</span>
                  <span style={{ paddingRight: 48 }} aria-hidden="true">{text}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* On-Hold ticker — any On Hold lead is surfaced team-wide (Section 7.2 of the scoring spec). */}
        {onHoldForTicker.length > 0 && (() => {
          const text = onHoldForTicker
            .map(l => `${l.customer_name} · ${ownerLabel(l.owner)}${l.hold_end_date ? ` · Resume ${fmtDate(l.hold_end_date)}` : ''}`)
            .join('     •     ');
          const duration = Math.max(18, onHoldForTicker.length * 6);
          return (
            <div style={{ background: 'var(--m3-tertiary)', color: '#fff', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>❄ ON HOLD</span>
              <div className="marquee" style={{ flex: 1 }}>
                <div className="marquee__track" style={{ animationDuration: `${duration}s` }}>
                  <span style={{ paddingRight: 48 }}>{text}</span>
                  <span style={{ paddingRight: 48 }} aria-hidden="true">{text}</span>
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Kpi icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--m3-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Open Pipeline" value={`₹${openTCV.toFixed(1)}L`} sub={`${active.length} active`} onClick={() => navigateWithFilter('active')} />
          <Kpi icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--m3-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} label="Won Deal Value" value={`₹${wonTCV.toFixed(1)}L`} sub={`${won.length} deals`} onClick={() => navigateWithFilter('won')} />
          <Kpi icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--m3-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} label="Hot Leads" value={String(hot.length)} sub="Tap to view" onClick={() => navigateWithFilter('hot')} />
          <Kpi icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Overdue Follow-Ups" value={String(overdue.length)} sub="Tap to view" onClick={() => navigateWithFilter('overdue')} />
        </div>

        {totalDataIssues > 0 && (
          <div className="card" style={{ background: 'var(--m3-tertiary-container)', borderColor: 'var(--m3-outline-variant)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--m3-on-surface)', margin: 0 }}>
                Data Quality — {totalDataIssues} incomplete field{totalDataIssues > 1 ? 's' : ''} across leads
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dataQualityIssues.map(d => (
                <span key={d.label} className={`badge ${d.badge}`} style={{ padding: '6px 12px' }}>
                  {d.label}: <strong style={{ marginLeft: 4, marginRight: 4 }}>{d.count}</strong>lead{d.count > 1 ? 's' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <p className="section-title">Leads by Phase</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {phaseCounts.map(pc => (
              <span key={pc.phase} className={`badge ${PHASE_BADGE[pc.phase]}`} style={{ cursor: 'pointer', padding: '6px 12px' }} onClick={() => navigateWithPhase(pc.phase)}>
                {pc.phase} <strong style={{ marginLeft: 6 }}>{pc.count}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <p className="section-title" style={{ margin: 0 }}>Pipeline Target</p>
              <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: '2px 0 0' }}>Orders {pipelineLabel.toLowerCase()} vs ₹{pipelineTarget.toFixed(1)}L target</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>₹{pipelineWon.toFixed(2)}L</p>
              <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: 0 }}>{pipelinePct}% of ₹{pipelineTarget.toFixed(1)}L</p>
            </div>
          </div>
          <div style={{ height: 8, background: 'var(--color-bg)', borderRadius: 99, marginBottom: 10 }}>
            <div style={{ height: 8, width: `${pipelinePct}%`, background: pipelinePct >= 100 ? 'var(--m3-success)' : 'var(--m3-primary)', borderRadius: 99 }} />
          </div>
          {hasHardware && (
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> <strong>{pipelineLicenses}</strong> Units</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> <strong>{pipelineCustomers}</strong> Customer{pipelineCustomers !== 1 ? 's' : ''}</span>
            </div>
          )}
          {isAdmin && (
            editingTarget === 'weekly' ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <input className="input" style={{ width: 100 }} type="number" step="0.1" value={targetInput} onChange={e => setTargetInput(e.target.value)} />
                <button className="btn btn-sm btn-primary" onClick={saveWeeklyTarget}>Save</button>
                <button className="btn btn-sm" onClick={() => setEditingTarget(null)}>✕</button>
              </div>
            ) : <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => { setEditingTarget('weekly'); setTargetInput(String(weeklyTarget)); }}>Edit target</button>
          )}
          {isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              {bdCards.map(b => {
                const bdWeeklyTarget = bdTargets[String(b.id)] ?? weeklyTarget;
                const bdTarget = bdWeeklyTarget * pipeWeeks;
                const bdWonLeads = filtered.filter(l => l.owner?.id === b.id && l.phase === 'Won').filter(l => {
                  const d = new Date(l.po_received_date || l.phase_changed_at); return d >= pipeStart && d <= pipeEnd;
                });
                const bdWon = bdWonLeads.reduce((s,l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
                const bdLic = hasHardware ? bdWonLeads.reduce((s,l) => s + (parseInt(l.quantity, 10) || 0), 0) : 0;
                const bdCust = hasHardware ? new Set(bdWonLeads.map(l => l.customer_name).filter(Boolean)).size : 0;
                const pct = Math.min(100, Math.round((bdWon / bdTarget) * 100));
                const bKey = String(b.id);
                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{bdLabel(b)}</span>
                      {editingTarget === bKey ? (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <input className="input" style={{ width: 70 }} type="number" step="0.1" value={targetInput} onChange={e => setTargetInput(e.target.value)} />
                          <button className="btn btn-sm btn-primary" onClick={() => saveBdTarget(b.id)}>✓</button>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--m3-on-surface-variant)' }}>₹{bdWon.toFixed(1)}L / ₹{bdTarget.toFixed(1)}L <button className="btn btn-sm" style={{ marginLeft: 6, padding: '2px 6px' }} onClick={() => { setEditingTarget(bKey); setTargetInput(String(bdWeeklyTarget)); }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button></span>
                      )}
                    </div>
                    <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 99, marginTop: 4 }}>
                      <div style={{ height: 6, width: `${pct}%`, background: pct >= 100 ? 'var(--m3-success)' : '#818cf8', borderRadius: 99 }} />
                    </div>
                    {hasHardware && (
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--m3-outline)', marginTop: 3 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> {bdLic} units</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {bdCust} customer{bdCust !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <p className="section-title" style={{ margin: 0 }}>Target vs Expected vs Won</p>
              <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: '2px 0 0' }}>Expected = deals with a Order Expected date this {attCfg.unit}; Won = orders received this {attCfg.unit}</p>
            </div>
            <select className="input" style={{ width: 160 }} value={attPeriod} onChange={e => setAttPeriod(e.target.value)}>
              {INV_GRAN.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div className="card-sm" style={{ textAlign: 'center' }} title={`${scopedBdDisplay ? (isAdmin ? scopedBdDisplay + "'s" : 'Your') : 'Team'} weekly target ₹${Number(scopedWeeklyTarget).toFixed(1)}L × this ${attCfg.unit}`}>
              <div style={{ fontSize: 11, color: 'var(--m3-outline)' }}>Target</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--m3-on-surface)' }}>₹{attainment.target.toFixed(1)}L</div>
              <div style={{ fontSize: 11, color: 'var(--m3-outline)' }}>{scopedBdDisplay ? (isAdmin ? `${scopedBdDisplay}'s` : 'your') : 'team'} · this {attCfg.unit}</div>
            </div>
            <div className={`card-sm ${attainment.expectedIds.length ? 'clickable' : ''}`} style={{ textAlign: 'center', cursor: attainment.expectedIds.length ? 'pointer' : 'default' }}
              onClick={() => navigateWithIds(attainment.expectedIds, `Expected · this ${attCfg.unit}`)}
              title={attainment.expectedIds.length ? `View the ${attainment.expCount} deal(s) with a Order Expected date this ${attCfg.unit}` : undefined}>
              <div style={{ fontSize: 11, color: 'var(--m3-outline)' }}>Expected (order due)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--m3-primary)' }}>₹{attainment.expected.toFixed(1)}L</div>
              <div style={{ fontSize: 11, color: 'var(--m3-outline)' }}>{attainment.expCount} deal{attainment.expCount === 1 ? '' : 's'}</div>
            </div>
            <div className={`card-sm ${attainment.wonIds.length ? 'clickable' : ''}`} style={{ textAlign: 'center', cursor: attainment.wonIds.length ? 'pointer' : 'default' }}
              onClick={() => navigateWithIds(attainment.wonIds, `Won · this ${attCfg.unit}`)}
              title={attainment.wonIds.length ? `View the ${attainment.wonIds.length} deal(s) won this ${attCfg.unit}` : undefined}>
              <div style={{ fontSize: 11, color: 'var(--m3-outline)' }}>Won</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--m3-success)' }}>₹{attainment.won.toFixed(1)}L</div>
              <div style={{ fontSize: 11, color: 'var(--m3-outline)' }}>{attainment.wonPct}% of target</div>
            </div>
          </div>

        </div>

        {renewalAlerts.length > 0 && (
          <div className="card">
            <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg> Renewal Alerts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {renewalAlerts.map(l => {
                const s = RENEWAL_BAND_STYLE[l.renewal.band] || RENEWAL_BAND_STYLE.ok;
                return (
                  <div key={l.id} className="card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--m3-surface-container-lowest)', borderLeft: `3px solid ${s.border}` }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{l.customer_name}{l.city ? ` · ${l.city}` : ''}</p>
                      <p style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', margin: 0 }}>{ownerLabel(l.owner)} · {l.lead_ref || `₹${l.potential_tcv_lakhs}L`} · ends {l.service_end_date ? fmtDate(l.service_end_date) : '—'}</p>
                    </div>
                    <span style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {renewalLabel(l.renewal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </>)}

        {tab === 'analytics' && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <p className="section-title">Pipeline by Phase</p>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="section-title">Conversion Funnel</p>
            {(() => {
              const hasData = (funnelWithConv[0]?.count || 0) > 0;
              if (!hasData) return <p style={{ fontSize: 12, color: 'var(--m3-outline)', fontStyle: 'italic', margin: 0 }}>No pipeline leads yet.</p>;
              // Segmented trapezoid funnel: dark navy → light blue ramp (6 bands, Negotiation removed),
              // with the stage-to-stage conversion % shown between bands. The lightest bands stay a
              // visible blue (not white) so they read on the white card, with dark text.
              const shades = ['#0d47a1', '#1565c0', '#1e88e5', '#42a5f5', '#7fb5ec', '#a9d0f5'];
              const n = funnelWithConv.length;
              // Gentle fixed taper (top 100% → base ~55%) so the shape always reads as a funnel AND
              // every label fits fully inside its trapezoid. Each band's bottom width equals the next
              // band's top width, so the segments line up into one continuous funnel silhouette.
              const widthAt = (i) => 1 - (i / n) * 0.45;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                  {funnelWithConv.map((f, i) => {
                    const wTop = widthAt(i);
                    const wBot = widthAt(i + 1);
                    const insetPct = Math.max(0, Math.min(45, (1 - wBot / wTop) / 2 * 100));
                    const darkText = i >= 4; // light blue bands need dark text for contrast
                    const nextConv = i < n - 1 ? funnelWithConv[i + 1].conv : null;
                    return (
                      <React.Fragment key={f.stage}>
                        <div
                          className="funnel-band"
                          onClick={() => navigateReached(f.stage)}
                          title={`View the ${f.count} lead${f.count === 1 ? '' : 's'} that reached ${f.stage}`}
                          style={{
                          width: `${Math.round(wTop * 100)}%`, margin: '0 auto', height: 44,
                          background: shades[i] || '#a9d0f5',
                          clipPath: `polygon(0 0, 100% 0, ${100 - insetPct}% 100%, ${insetPct}% 100%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          color: darkText ? '#0d47a1' : '#fff', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'width .3s ease',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{f.stage}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>· {f.count} lead{f.count === 1 ? '' : 's'}</span>
                        </div>
                        {i < n - 1 && (
                          <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--m3-outline)', padding: '2px 0' }}>
                            {nextConv === null ? '·' : `${nextConv}% conversion`}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="card">
            <p className="section-title">Bottlenecks — Avg Days per Stage</p>
            {avgTimeInStage.every(s => s.avgDays === null) ? (
              <p style={{ fontSize: 12, color: 'var(--m3-outline)', fontStyle: 'italic' }}>No completed stage transitions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {avgTimeInStage.map(s => {
                  const maxAvg = Math.max(...avgTimeInStage.map(x => x.avgDays || 0), 1);
                  return (
                    <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <div style={{ width: 80, fontWeight: 600 }}>{s.stage}</div>
                      <div style={{ flex: 1, height: 16, background: 'var(--m3-surface-container)', borderRadius: 6 }}>
                        {s.avgDays !== null && <div style={{ height: '100%', width: `${Math.max(4, Math.round((s.avgDays/maxAvg)*100))}%`, background: s.avgDays > 21 ? '#f87171' : s.avgDays > 14 ? '#fbbf24' : '#34d399', borderRadius: 6 }} />}
                      </div>
                      <div style={{ width: 60, textAlign: 'right' }}>{s.avgDays === null ? '—' : `${s.avgDays}d (${s.samples})`}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <p className="section-title">Lead Source Effectiveness</p>
            {sourceStats.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--m3-outline)', fontStyle: 'italic', margin: 0 }}>No leads to analyse yet.</p>
            ) : (
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th style={{ textAlign: 'right' }}>Leads</th>
                    <th style={{ textAlign: 'right' }}>Win %</th>
                    <th style={{ textAlign: 'right' }}>Deal Value (₹L)</th>
                    <th style={{ textAlign: 'right' }}>Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceStats.map(s => (
                    <tr key={s.src} onClick={() => navigateWithSource(s.src)} title={`View ${s.count} ${s.src} lead(s)`} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600 }}>{s.src}</td>
                      <td style={{ textAlign: 'right' }}>{s.count}</td>
                      <td style={{ textAlign: 'right' }}>
                        {s.winRate === null
                          ? <span style={{ color: 'var(--m3-outline-variant)' }}>—</span>
                          : <span style={{ fontWeight: 700, color: s.winRate >= 50 ? 'var(--m3-success)' : s.winRate >= 25 ? 'var(--color-warning)' : 'var(--m3-error)' }}>{s.winRate}%</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{s.tcv.toFixed(1)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {s.avgScore === null
                          ? <span style={{ color: 'var(--m3-outline-variant)' }}>—</span>
                          : <span className={`badge ${s.avgScore >= 70 ? 'badge-green' : s.avgScore >= 40 ? 'badge-amber' : 'badge-gray'}`}>{s.avgScore}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <p className="section-title">Pipeline Confidence</p>
            {confScored.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--m3-outline)', fontStyle: 'italic', margin: 0 }}>No active leads to score yet.</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--m3-on-surface)', lineHeight: 1 }}>{confAvg}%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: confTrend === 'up' ? 'var(--m3-success)' : confTrend === 'down' ? 'var(--m3-error)' : 'var(--m3-outline)' }}>
                    {confTrend === 'up' ? '▲ up' : confTrend === 'down' ? '▼ down' : '● flat'} vs last week
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--m3-outline)' }}>avg win-confidence · {confScored.length} active</span>
                </div>
                {/* Band mix bar */}
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 10, background: 'var(--color-bg)' }}>
                  {confHigh > 0 && <div style={{ flex: confHigh, background: 'var(--m3-success)' }} />}
                  {confMedium > 0 && <div style={{ flex: confMedium, background: '#f59e0b' }} />}
                  {confLow > 0 && <div style={{ flex: confLow, background: 'var(--m3-outline-variant)' }} />}
                </div>
                {/* Clickable band tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[['high', 'High ≥60', 'var(--m3-success)', confHigh], ['medium', 'Medium 30–59', 'var(--color-warning)', confMedium], ['low', 'Low <30', 'var(--m3-on-surface-variant)', confLow]].map(([key, label, color, count]) => (
                    <button key={key} onClick={() => navigateWithConf(key)} title={`View ${count} ${label} lead(s)`}
                      style={{ textAlign: 'left', border: '1px solid var(--m3-outline-variant)', borderRadius: 10, padding: '8px 10px', background: 'var(--m3-surface-container-lowest)', cursor: 'pointer' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
                      <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>{label}</div>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--m3-on-surface-variant)', margin: '0 0 6px' }}>📉 Losing confidence this week</p>
                {confLosing.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--m3-outline)', margin: 0 }}>No active leads dropped this week.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {confLosing.map(l => (
                      <div key={l.id} onClick={() => navigate('/leads')} title="Open Leads"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.customer_name} <span style={{ color: 'var(--m3-outline)', fontWeight: 400 }}>· {l.phase}</span>
                        </span>
                        <span style={{ color: 'var(--m3-error)', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{Math.round(l.score)}% ▼ −{Math.round(l.drop)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <p className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Won Trend</p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="input" style={{ width: 110, fontSize: 11, height: 28, padding: '2px 6px' }} value={poTrendMetric} onChange={e => setPoTrendMetric(e.target.value)}>
                  <option value="count">Count</option>
                  <option value="tcv">Deal Value (₹L)</option>
                  <option value="acv">Annual Value (₹L)</option>
                  {hasHardware && <option value="licenses">Units</option>}
                </select>
                {poTrendAvailableYears.map(yr => (
                  <label key={yr} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox" checked={poTrendActiveYears.includes(yr)}
                      onChange={() => setPoTrendYears(prev => {
                        const cur = prev.length ? prev : poTrendAvailableYears.slice(0, 2);
                        return cur.includes(yr) ? cur.filter(y => y !== yr) : [...cur, yr];
                      })} />
                    {yr}
                  </label>
                ))}
              </div>
            </div>
            {poTrendActiveYears.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--m3-outline)', fontStyle: 'italic', margin: 0 }}>No won orders yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={poTrendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f4" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={poTrendMetric === 'tcv' || poTrendMetric === 'acv'} />
                    <Tooltip formatter={(v) => (poTrendMetric === 'tcv' || poTrendMetric === 'acv') ? `₹${Number(v).toFixed(1)}L` : v} />
                    <Legend />
                    {poTrendActiveYears.map((yr, i) => (
                      <Line key={yr} type="monotone" dataKey={`${yr}_${poTrendMetric}`} name={String(yr)}
                        stroke={PO_TREND_COLORS[i % PO_TREND_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--m3-on-surface-variant)', flexWrap: 'wrap' }}>
                  {poTrendActiveYears.map((yr, i) => (
                    <span key={yr}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, background: PO_TREND_COLORS[i % PO_TREND_COLORS.length], borderRadius: 2, marginRight: 4 }} />
                      {yr}: <strong>{poTrendTotals[yr]?.count || 0}</strong> orders · Deal Value <strong>₹{(poTrendTotals[yr]?.tcv || 0).toFixed(1)}L</strong> · Annual Value <strong>₹{(poTrendTotals[yr]?.acv || 0).toFixed(1)}L</strong>{hasHardware && <> · <strong>{poTrendTotals[yr]?.licenses || 0}</strong> units</>}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        <div className="card">
          <p className="section-title">🏅 Annual Sales Rep Performance — {currentYear}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {annualBDPerf.map(bd => (
              <div key={bd.id} className="card-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, margin: 0, fontSize: 13 }}>{bd.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: 0 }}>{bd.totalLeads} total leads</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, color: 'var(--m3-success)', margin: 0 }}>₹{bd.wonTCV.toFixed(1)}L won</p>
                    <p style={{ fontSize: 11, color: 'var(--m3-outline)', margin: 0 }}>{bd.wonDeals} deals</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                  <div style={{ background: 'var(--m3-surface-container)', borderRadius: 8, padding: 6, textAlign: 'center' }}><div style={{ color: 'var(--m3-outline)' }}>Active</div><div style={{ fontWeight: 700 }}>{bd.activeLeads}</div></div>
                  <div style={{ background: 'var(--m3-success-container)', borderRadius: 8, padding: 6, textAlign: 'center' }}><div style={{ color: 'var(--m3-outline)' }}>Won {currentYear}</div><div style={{ fontWeight: 700 }}>{bd.wonDeals}</div></div>
                  <div style={{ background: '#eff6ff', borderRadius: 8, padding: 6, textAlign: 'center' }}><div style={{ color: 'var(--m3-outline)' }}>Conv. Rate</div><div style={{ fontWeight: 700 }}>{bd.convRate}%</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Distribution — India choropleth map (bottom of analytics) */}
        <div className="card" style={{ marginTop: 16 }}>
          <IndiaMap leads={filtered} />
        </div>

        {/* Cohort Aging Grid */}
        <div style={{ marginTop: 16, background: 'var(--m3-on-surface)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--m3-outline-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cohort Aging Grid</p>
            <select
              value={closureFY}
              onChange={e => setClosureFY(Number(e.target.value))}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #475569', fontSize: 12, color: 'var(--m3-outline-variant)', background: 'var(--m3-on-surface)', cursor: 'pointer', outline: 'none' }}
            >
              {[0, 1, 2].map(offset => {
                const y = new Date().getFullYear() - offset;
                return <option key={y} value={y}>FY {y}-{String(y + 1).slice(2)}</option>;
              })}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { color: '#1e40af', label: 'Closed on time' },
              { color: '#78350f', label: 'Closed late' },
              { color: '#93c5fd', label: 'Still open' },
              { color: 'var(--m3-error)', label: 'Lost' },
            ].map(l => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--m3-outline)' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--m3-outline)', fontWeight: 600, borderBottom: '1px solid #334155', position: 'sticky', left: 0, background: 'var(--m3-on-surface)', zIndex: 2 }}>Expected in</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--m3-outline-variant)', fontWeight: 700, borderBottom: '1px solid #334155' }}>Total</th>
                  {closureData.fyMonths.map(m => (
                    <th key={m.label} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--m3-outline)', fontWeight: 600, borderBottom: '1px solid #334155' }}>{m.label}</th>
                  ))}
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#93c5fd', fontWeight: 600, borderBottom: '1px solid #334155' }}>Still open</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--m3-error)', fontWeight: 600, borderBottom: '1px solid #334155' }}>Lost</th>
                </tr>
              </thead>
              <tbody>
                {closureData.rows.map((row, ri) => (
                  <tr key={row.key}>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--m3-outline-variant)', borderBottom: '1px solid #334155', position: 'sticky', left: 0, background: 'var(--m3-on-surface)', zIndex: 1 }}>{row.label}</td>
                    <td
                      onClick={() => row.total > 0 && navigateWithIds(row.totalIds, `Total expected ${row.label}`)}
                      style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--m3-outline-variant)', borderBottom: '1px solid #334155', cursor: row.total > 0 ? 'pointer' : 'default' }}
                      title={row.total > 0 ? 'Click to view leads' : undefined}
                    >{row.total}</td>
                    {row.cells.map((val, ci) => {
                      const isBefore = ci < ri;
                      const isOnTime = ci === ri;
                      const ids = row.cellIds[ci];
                      let bg = 'transparent';
                      if (!isBefore && val > 0) bg = isOnTime ? '#1e40af' : '#78350f';
                      else if (!isBefore && isOnTime) bg = '#1e3a5f';
                      return (
                        <td key={ci}
                          onClick={() => !isBefore && val > 0 && navigateWithIds(ids, `${row.label} → ${closureData.fyMonths[ci].label}`)}
                          style={{
                            padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #334155',
                            background: bg, color: isBefore ? 'var(--m3-on-surface)' : val > 0 ? '#fff' : 'var(--m3-on-surface-variant)',
                            fontWeight: val > 0 ? 700 : 400, borderRadius: 0,
                            cursor: !isBefore && val > 0 ? 'pointer' : 'default',
                          }}
                          title={!isBefore && val > 0 ? 'Click to view leads' : undefined}
                        >
                          {isBefore ? '' : val}
                        </td>
                      );
                    })}
                    <td
                      onClick={() => row.open > 0 && navigateWithIds(row.openIds, `Still open — expected ${row.label}`)}
                      style={{ padding: '7px 10px', textAlign: 'right', color: '#93c5fd', fontWeight: row.open > 0 ? 700 : 400, borderBottom: '1px solid #334155', cursor: row.open > 0 ? 'pointer' : 'default' }}
                      title={row.open > 0 ? 'Click to view leads' : undefined}
                    >{row.open}</td>
                    <td
                      onClick={() => row.lost > 0 && navigateWithIds(row.lostIds, `Lost — expected ${row.label}`)}
                      style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--m3-error)', fontWeight: row.lost > 0 ? 700 : 400, borderBottom: '1px solid #334155', cursor: row.lost > 0 ? 'pointer' : 'default' }}
                      title={row.lost > 0 ? 'Click to view leads' : undefined}
                    >{row.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        </>)}

      </div>
    </Layout>
  );
}
