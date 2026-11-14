import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import CustomLeadForm from '../components/CustomLeadForm';
import StageChangeDialog, { STAGES_WITH_DIALOG } from '../components/StageChangeDialog';
import ActivityLogView from '../components/ActivityLogView';
import MultiSelect from '../components/MultiSelect';
import KanbanView from '../components/KanbanView';
import GlobalPosView from '../components/GlobalPosView';
import BulkUploadModal from '../components/BulkUploadModal';
import ExpansionPicker from '../components/ExpansionPicker';
import usePersistedState from '../utils/usePersistedState';
import { parseServiceLines } from '../components/ServicesOffered';
import { useAuth } from '../context/AuthContext';
import { getLeads, getLead, deleteLead, updateLead, getBds, bulkUpdateLeads, getStageHistory, getDropdowns, getBusinessUnitConfig, getTat } from '../services/api';
import { PHASE_BADGE } from '../utils/constants';
import { hasMoney, fmtDate, isTATBreached, isOverdue, hasConfidence, confidenceTrend, stripHtml, primaryContact, formatOtherContacts, stageAging, renewalStatus, renewalLabel, RENEWAL_BAND_STYLE, buildRenewedSet } from '../utils/leadHelpers';
import { sortWithWonLast } from '../utils/leadPriority';
import { exportRowsToPdf } from '../utils/pdfExport';
import { writeFormattedSheet } from '../utils/excelExport';
import { buildNameCount, bdLabel as _bdLabel, ownerLabel as _ownerLabel } from '../utils/nameLabels';
import { APP_NAME } from '../config/brand';
import useBusinessUnits from '../utils/useBusinessUnits';

// Compact date-range picker for the Follow-up filter. Single button opens a small popover
// with From + To date inputs. Shows the selected range as a short label on the button.
function FollowUpDatePicker({ from, to, onFromChange, onToChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const hasRange = from || to;
  const shortLabel = hasRange
    ? `${from ? from.slice(5) : '…'} → ${to ? to.slice(5) : '…'}`
    : 'Follow-up';
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="input" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', height: 30,
          padding: '5px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          borderColor: hasRange ? 'var(--m3-primary)' : 'var(--m3-outline-variant)', background: hasRange ? 'var(--m3-primary-container)' : '#fff',
          color: hasRange ? 'var(--m3-primary)' : 'var(--m3-on-surface)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> {shortLabel} <span style={{ fontSize: 10, color: 'var(--m3-on-surface-variant)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--m3-surface-container-lowest)',
          border: '1px solid var(--m3-outline-variant)', borderRadius: 8, boxShadow: 'var(--elevation-2)',
          zIndex: 20, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--m3-on-surface-variant)' }}>
            From
            <input type="date" className="input" style={{ width: '100%', fontSize: 11, marginTop: 2 }}
              value={from} onChange={e => onFromChange(e.target.value)} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--m3-on-surface-variant)' }}>
            To
            <input type="date" className="input" style={{ width: '100%', fontSize: 11, marginTop: 2 }}
              value={to} min={from || undefined} onChange={e => onToChange(e.target.value)} />
          </label>
          {hasRange && (
            <button type="button" className="btn btn-sm" style={{ fontSize: 11, justifyContent: 'center' }}
              onClick={() => { onFromChange(''); onToChange(''); }}>Clear</button>
          )}
        </div>
      )}
    </div>
  );
}

const PHASES = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Order Expected', 'Won', 'Lost', 'On Hold'];
const SOURCES = ['Channel Partner', 'Account Manager', 'Direct Sales', 'Referral Partner'];

// Confidence band of a lead (matches the Dashboard's Pipeline Confidence card).
const leadConfBand = (l) => {
  if (l.confidence_score === null || l.confidence_score === undefined) return null;
  const c = Number(l.confidence_score);
  return c >= 60 ? 'high' : c >= 30 ? 'medium' : 'low';
};

// Lead-scoring filter buckets (quartiles of the confidence %). Replaces the old Rating filter.
const SCORE_BANDS = ['0–25%', '25–50%', '50–75%', '75–100%'];
const scoreBandOf = (l) => {
  const n = Number(l.confidence_score);
  if (!Number.isFinite(n)) return null;   // unscored leads fall out when a band filter is active
  if (n < 25) return '0–25%';
  if (n < 50) return '25–50%';
  if (n < 75) return '50–75%';
  return '75–100%';
};

// Week-over-week confidence trend indicator shown beside the score.
function TrendArrow({ trend }) {
  if (trend === 'up')   return <span title="Up vs last week"   style={{ color: 'var(--m3-success)', fontSize: 12, fontWeight: 700 }}>▲</span>;
  if (trend === 'down') return <span title="Down vs last week" style={{ color: 'var(--m3-error)', fontSize: 12, fontWeight: 700 }}>▼</span>;
  if (trend === 'hold') return <span title="Frozen (On Hold)"  style={{ color: 'var(--m3-tertiary)', fontSize: 12 }}>❄</span>;
  return <span title="No change vs last week" style={{ color: 'var(--m3-outline)', fontSize: 9 }}>●</span>;
}

// ── Export dropdown with format + column selection ──
function ExportMenu({ onExportExcel, onExportPdf }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg> Export ▾
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 8, boxShadow: 'var(--elevation-2)', zIndex: 20, minWidth: 140, padding: 4 }}>
          <button onClick={() => { onExportExcel(); setOpen(false); }} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--m3-on-surface)', borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--m3-surface-container)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export as Excel
          </button>
          <button onClick={() => { onExportPdf(); setOpen(false); }} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--m3-on-surface)', borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--m3-surface-container)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ── Column layout system ──
const ALL_COLUMNS = [
  { key: 'sr',        label: 'Sr',               locked: true },
  { key: 'customer',  label: 'Customer',         locked: true },
  { key: 'sales_rep', label: 'Sales Rep',        locked: true },
  { key: 'phase',     label: 'Phase' },
  { key: 'aging',     label: 'Aging' },
  { key: 'location',  label: 'Location' },
  { key: 'qty',       label: 'Qty' },
  { key: 'deal_value',label: 'Deal Value (₹L)' },
  { key: 'scoring',   label: 'Scoring' },
  { key: 'followup',  label: 'Next Follow-Up' },
  { key: 'source',    label: 'Source' },
  { key: 'new_renewal', label: 'New/Renewal' },
  { key: 'competitor', label: 'Competitor' },
  { key: 'contract',  label: 'Contract Period' },
  { key: 'billing',   label: 'Billing Cycle' },
  { key: 'created',   label: 'Created' },
];
const DEFAULT_COL_KEYS = ['sr', 'customer', 'sales_rep', 'phase', 'aging', 'location', 'qty', 'deal_value', 'scoring', 'followup'];
const LOCKED_KEYS = new Set(ALL_COLUMNS.filter(c => c.locked).map(c => c.key));
const MAX_COLS = 10;

function LayoutPicker({ columns, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const selected = new Set(columns);
  const toggle = (key) => {
    if (LOCKED_KEYS.has(key)) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else if (next.size < MAX_COLS) next.add(key);
    onChange([...next]);
  };
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h7" /></svg> Layout
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--m3-surface-container-lowest)', border: '1px solid var(--m3-outline-variant)', borderRadius: 8, boxShadow: 'var(--elevation-2)', zIndex: 50, width: 220, padding: 6, maxHeight: 340, overflowY: 'auto' }}>
          <div style={{ padding: '4px 8px 6px', fontSize: 11, color: 'var(--m3-on-surface-variant)', borderBottom: '1px solid var(--m3-surface-container-high)', marginBottom: 4 }}>
            Columns ({selected.size}/{MAX_COLS} max)
          </div>
          <button style={{ width: '100%', textAlign: 'center', padding: '4px', fontSize: 11, border: 'none', background: 'var(--m3-surface-container)', borderRadius: 4, cursor: 'pointer', marginBottom: 4, color: 'var(--m3-primary)', fontWeight: 600 }}
            onClick={() => onChange([...DEFAULT_COL_KEYS])}>Reset to default</button>
          {ALL_COLUMNS.map(col => (
            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: col.locked ? 'not-allowed' : 'pointer', opacity: col.locked ? 0.6 : 1, fontSize: 12 }}>
              <input type="checkbox" checked={selected.has(col.key)} disabled={col.locked || (!selected.has(col.key) && selected.size >= MAX_COLS)} onChange={() => toggle(col.key)} />
              {col.label}
              {col.locked && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--m3-outline)' }}>default</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const { user, isAdmin, canEdit, canFull, canAct } = useAuth();
  const { meta: businessOf } = useBusinessUnits();
  // Create and delete are Full-Access capabilities. Chains is module-level configuration, which
  // Edit deliberately excludes. Bulk update mutates records, so it needs Edit.
  // canAct is false for a Read-only Super Admin, who sees no action affordance on any platform.
  const leadsCanEdit = canAct && canEdit('leads');
  const leadsCanFull = canAct && canFull('leads');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [bds, setBds] = useState([]);
  const [dropdowns, setDropdowns] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPhases, setFilterPhases] = useState([]);
  const [filterTemps, setFilterTemps] = useState([]);      // kept for the Dashboard "hot" deep-link
  const [filterScores, setFilterScores] = useState([]);    // Lead Scoring bands (replaces Rating in the bar)
  const [filterSources, setFilterSources] = useState([]);
  const [filterBDs, setFilterBDs] = useState([]);
  const [filterCustomers, setFilterCustomers] = useState([]);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterFollowFrom, setFilterFollowFrom] = useState('');  // Next Follow-up date range filter
  const [filterFollowTo, setFilterFollowTo] = useState('');
  const [filterConf, setFilterConf] = useState('');   // '' | 'high' | 'medium' | 'low' (from the Dashboard)
  const [filterIds, setFilterIds] = useState([]);     // explicit lead-id set (from Dashboard drill-downs)
  const [idsLabel, setIdsLabel] = useState('');       // human label for the id-set chip
  const [view, setView] = useState('table');
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  // Expansion flow: picker modal + the "source" lead (fetched full, with contacts) whose static
  // fields prefill the new lead. Reset together with the form.
  const [showExpansionPicker, setShowExpansionPicker] = useState(false);
  const [expansionFrom, setExpansionFrom] = useState(null);
  const [expansionMode, setExpansionMode] = useState(null); // 'additional' | 'renewal'
  const [tab, setTab] = useState('form');
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkValue, setBulkValue] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [cameFromDashboard, setCameFromDashboard] = useState(false);
  const [showChains, setShowChains] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [buConfig, setBuConfig] = useState(null);
  const [tatMap, setTatMap] = useState({});                 // { phase: tat_days } for aging colour

  // Column layout — persisted per user
  const [visibleCols, setVisibleCols] = usePersistedState('leads_cols', DEFAULT_COL_KEYS);
  const [colOrder, setColOrder] = usePersistedState('leads_col_order', DEFAULT_COL_KEYS);
  const orderedCols = useMemo(() => {
    const vis = new Set(visibleCols);
    const ordered = colOrder.filter(k => vis.has(k));
    vis.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
    return ordered;
  }, [visibleCols, colOrder]);
  const handleColChange = (keys) => { setVisibleCols(keys); setColOrder(keys); };
  const [dragCol, setDragCol] = useState(null);
  const handleColDragStart = (key) => setDragCol(key);
  const handleColDrop = (targetKey) => {
    if (!dragCol || dragCol === targetKey) { setDragCol(null); return; }
    const next = [...orderedCols];
    const fromIdx = next.indexOf(dragCol);
    const toIdx = next.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) { setDragCol(null); return; }
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragCol);
    setColOrder(next);
    setDragCol(null);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [ld, sh] = await Promise.all([getLeads(), getStageHistory()]);
    setLeads(ld); setStageHistory(sh);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { getBds(user.business_unit).then(setBds); }, [user.business_unit]);
  const bdNameCount = useMemo(() => buildNameCount(bds), [bds]);
  const bdLabel = (b) => _bdLabel(b, bdNameCount);
  const ownerLabel = (owner) => _ownerLabel(owner, bdNameCount);
  useEffect(() => { getBusinessUnitConfig(user.business_unit).then(setBuConfig).catch(() => {}); }, [user.business_unit]);
  // Per-stage TAT days (SLA target), used to colour the Aging column against each stage's own target.
  useEffect(() => {
    getTat(user.business_unit)
      .then(r => { const m = {}; for (const s of (r?.stages || [])) m[s.stage] = Number(s.tat_days); setTatMap(m); })
      .catch(() => setTatMap({}));
  }, [user.business_unit]);
  useEffect(() => { getDropdowns().then(setDropdowns).catch(() => {}); }, []);

  // Pre-filter from dashboard KPI/phase-chip clicks
  useEffect(() => {
    const f = searchParams.get('filter');
    const phase = searchParams.get('phase');
    const bd = searchParams.get('bd');
    const source = searchParams.get('source');
    const conf = searchParams.get('conf');
    const ids = searchParams.get('ids');
    if (!f && !phase && !bd && !source && !conf && !ids) return;
    setCameFromDashboard(true);
    if (f === 'hot') setFilterTemps(['Hot']);
    else if (f === 'won') setFilterPhases(['Won']);
    else if (f === 'overdue') setFilterOverdue(true);
    else if (f === 'active') setFilterPhases(['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Order Expected']);
    if (phase) setFilterPhases(phase.split(','));
    if (source) setFilterSources(source.split(','));
    if (bd && isAdmin) setFilterBDs([bd]);
    if (conf) setFilterConf(conf);
    if (ids) { setFilterIds(ids.split(',').filter(Boolean)); setIdsLabel(searchParams.get('idslabel') || 'Selected leads'); }
  }, [searchParams, isAdmin]);

  // Deep link from the Forecast dashboard (?lead=<id>&from=forecast): open that lead's detail
  // straight away, and offer a way back. The forecast's column selection is persisted client-side,
  // so returning there restores the view the user left.
  const deepLinkId = searchParams.get('lead');
  const cameFromForecast = searchParams.get('from') === 'forecast';
  const cameFromActivity = searchParams.get('from') === 'activity';
  const [deepLinkError, setDeepLinkError] = useState('');
  const navTs = location.state?.ts;
  useEffect(() => {
    if (!deepLinkId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const full = await getLead(deepLinkId);
        if (cancelled) return;
        setTab('form'); setEditLead(full); setShowForm(true);
      } catch {
        if (!cancelled) setDeepLinkError('That lead could not be opened — it may belong to another team member.');
      }
    })();
    return () => { cancelled = true; };
  }, [deepLinkId, navTs]);

  // Rot/stuck metrics removed from table display
  const renewedIds = useMemo(() => buildRenewedSet(leads), [leads]);

  // Ranked with the shared prioritization order (stage → confidence → chain → TCV), with
  // won leads pushed to the very end — see utils/leadPriority.js. Re-derived per render, so
  // the list always reflects current scores rather than the server's sr_no ordering.
  const filtered = useMemo(() => sortWithWonLast(leads.filter(l => {
    const s = search.toLowerCase();
    const matchSearch = !s || [l.customer_name, l.city, l.state, l.lead_source, l.competitor, l.device_sku, l.lead_ref, l.customer_code]
      .some(f => f?.toLowerCase().includes(s));
    // Next follow-up date range filter
    const followOk = (() => {
      if (!filterFollowFrom && !filterFollowTo) return true;
      if (!l.next_followup_date) return false;
      if (filterFollowFrom && l.next_followup_date < filterFollowFrom) return false;
      if (filterFollowTo && l.next_followup_date > filterFollowTo) return false;
      return true;
    })();
    return matchSearch
      && (!filterPhases.length || filterPhases.includes(l.phase))
      && (!filterTemps.length || filterTemps.includes(l.lead_temperature))
      && (!filterScores.length || filterScores.includes(scoreBandOf(l)))
      && (!filterSources.length || filterSources.includes(l.lead_source))
      && (!filterBDs.length || filterBDs.includes(String(l.owner?.id)))
      && (!filterCustomers.length || filterCustomers.includes(l.customer_name))
      && (!filterOverdue || isOverdue(l))
      && followOk
      && (!filterConf || leadConfBand(l) === filterConf)
      && (!filterIds.length || filterIds.includes(String(l.id)));
  })), [leads, search, filterPhases, filterTemps, filterScores, filterSources, filterBDs, filterCustomers, filterOverdue, filterFollowFrom, filterFollowTo, filterConf, filterIds]);

  const openCount = filtered.filter(l => !['Lost', 'On Hold', 'Won'].includes(l.phase)).length;

  const openNew = () => { setEditLead(null); setExpansionFrom(null); setExpansionMode(null); setTab('form'); setShowForm(true); };

  // + Additional PO flow: user picks a source PO (and mode) in the modal → we fetch the full source
  // lead (with contacts) → open the lead form prefilled. mode 'additional' copies statics only;
  // 'renewal' copies statics + services + deal size and links the new lead to the source PO.
  const openExpansionFrom = async (sourceLead, mode) => {
    try {
      const full = await getLead(sourceLead.id);
      setExpansionFrom(full);
      setExpansionMode(mode || 'additional');
      setEditLead(null);
      setShowExpansionPicker(false);
      setTab('form');
      setShowForm(true);
    } catch {
      setDeepLinkError('Could not load that customer’s details.');
      setShowExpansionPicker(false);
    }
  };
  // Fetch the FULL lead (the list row from GET /leads omits contacts, stage history, etc.) so the
  // edit form shows the saved POC contacts instead of an empty section.
  const openEdit = async (l) => {
    setTab('form');
    const full = await getLead(l.id).catch(() => l);
    setEditLead(full);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false); setEditLead(null); setExpansionFrom(null); setExpansionMode(null);
    if (searchParams.get('lead')) {
      searchParams.delete('lead');
      setSearchParams(searchParams, { replace: true });
    }
  };
  const onSaved = () => { closeForm(); fetchAll(); };

  // Won, Lost and On Hold need a few details (order document and number, a reason, a resume date), so
  // dropping a lead there opens a small dialog asking only for those. Other moves save straight away.
  const [stageDialog, setStageDialog] = useState(null); // { lead, toPhase }
  const openFullFormAt = (full, toPhase) => {
    setStageDialog(null);
    setTab('form');
    setEditLead({ ...full, phase: toPhase, _savedPhase: full.phase });
    setShowForm(true);
  };
  const handlePhaseChangeKanban = async (leadId, newPhase) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.phase === newPhase) return;
    const full = await getLead(leadId).catch(() => lead);
    if (STAGES_WITH_DIALOG.includes(newPhase)) {
      setStageDialog({ lead: full, toPhase: newPhase });
      return;
    }
    // Send the lead's complete saved values with only the stage changed. The server treats a missing
    // field as cleared, so sending a partial lead used to wipe City, State, Customer Type and others.
    const scalars = Object.fromEntries(Object.entries(full).filter(([, v]) => v === null || typeof v !== 'object'));
    await updateLead(leadId, {
      ...scalars,
      phase: newPhase, phase_date: undefined,
      // Resend the Services Offered lines so the backend re-persists them unchanged.
      services: parseServiceLines(full.services_json),
    });
    fetchAll();
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectAll = () => setSelectedIds(new Set(filtered.map(l => l.id)));
  const clearSelect = () => setSelectedIds(new Set());

  const executeBulk = async () => {
    if (!bulkValue || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (bulkAction === 'reassign') await bulkUpdateLeads(ids, { owner_id: bulkValue });
    else if (bulkAction === 'phase') await bulkUpdateLeads(ids, { phase: bulkValue });
    setBulkAction(null); setBulkValue(''); clearSelect(); fetchAll();
  };

  const executeBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      await Promise.all(ids.map(id => deleteLead(id)));
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
      clearSelect();
      fetchAll();
    }
  };

  // True when every currently-filtered lead is selected (drives the header select-all checkbox).
  const allSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));
  const toggleSelectAll = () => { if (allSelected) clearSelect(); else selectAll(); };

  const exportExcel = async () => {
    const toExport = selectedIds.size > 0 ? filtered.filter(l => selectedIds.has(l.id)) : filtered;
    const XLSX = await import('xlsx');

    // Services Offered is now one unified JSON list for every business (services_json). Render it as a
    // single readable column rather than per-service columns, so a mixed export stays consistent.
    const FREQ_SHORT = { monthly: 'mo', quarterly: 'qtr', semi_annual: 'half-yr', annual: 'yr' };
    const fmtComp = (c) => c ? `₹${c.rate ?? 0}×${c.qty ?? 0} ${c.nature === 'opex' ? `opex/${FREQ_SHORT[c.frequency] || c.frequency}` : 'capex'}` : '';
    const formatServiceLines = (l) => {
      let lines = [];
      try { lines = l.services_json ? JSON.parse(l.services_json) : []; } catch {}
      return lines.map(line => {
        const parts = [];
        if (line.hw) parts.push(`HW ${line.hw.sku ? line.hw.sku + ' ' : ''}${fmtComp(line.hw)}`);
        if (line.svc) parts.push(`SVC ${fmtComp(line.svc)}`);
        return `${line.label} [${line.category}]: ${parts.join(', ')}`;
      }).join(' | ');
    };

    const rows = toExport.map(l => {
      const poc = primaryContact(l);
      const row = {
        'Sr No': l.sr_no, 'Lead Ref': l.lead_ref || '', 'Customer Code': l.customer_code || '',
        'Business': businessOf(l.business_unit).name, 'Customer': l.customer_name,
        'City': l.city || '', 'State': l.state || '', 'Lead Owner': bdLabel(l.owner) || '',
        // Contact / POC details (primary contact; any additional POCs listed in "Other Contacts").
        'Contact Name': poc.name, 'Contact Phone': poc.phone, 'Contact Email': poc.email, 'Contact Designation': poc.designation,
        'Other Contacts': formatOtherContacts(l),
        'Lead Source': l.lead_source, 'Channel Partner': l.channel_partner_name || '', 'Account Manager': l.kam_name || '', 'Referral Partner Name': l.affiliate_name || '',
        'New/Renewal': l.new_or_renewal, 'Lead Rating': l.lead_temperature, 'Competitor': l.competitor || '',
        'Quantity (Total)': l.quantity, 'Potential Deal Value (L)': l.potential_tcv_lakhs, 'Contract Period (Mo)': l.contract_period_months,
        'Order Validity (Mo)': l.po_validity_months || '', 'Annual Value (L/yr)': l.acv_lakhs, 'Contract Value (L)': l.contract_value_lakhs || '',
        'Phase': l.phase, 'Confidence %': l.confidence_score ?? '', 'Next Follow-Up': l.next_followup_date || '', 'Order Expected Date': l.po_expected_date || '',
        'Order Start': l.service_start_date || '', 'Order End': l.service_end_date || '',
        'Billing Cycle': l.billing_cycle || '', 'Payment Terms': l.payment_terms || '',
      };

      // Unified Services Offered summary + the hardware-expected date.
      row['Services Offered'] = formatServiceLines(l);
      row['Delivery Requested Date'] = l.device_requested_date || '';
      row['Actual Order Value (L)'] = l.po_actual_value_lakhs || '';
      row['Lost Reason'] = l.lost_reason || '';
      row['Additional Notes'] = stripHtml(l.additional_notes);
      row['Created At'] = l.createdAt ? fmtDate(l.createdAt) : '';
      return row;
    });
    writeFormattedSheet(XLSX, rows, 'Leads', `Sales_CRM_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // PDF export shows a curated, readable column set (not all 30+ Excel columns —
  // full detail belongs in Excel; PDF is for a quick printable summary).
  const exportPdf = () => {
    const toExport = selectedIds.size > 0 ? filtered.filter(l => selectedIds.has(l.id)) : filtered;
    if (!toExport.length) return;
    exportRowsToPdf({
      title: `${APP_NAME} — Leads`,
      subtitle: `${toExport.length} lead${toExport.length > 1 ? 's' : ''} · generated ${fmtDate(new Date())}`,
      tables: [{
        columns: ['Sr', 'Customer', 'Sales Rep', 'Phase', 'Rating', 'Deal Value (₹L)', 'Conf %', 'Source', 'Next Follow-Up'],
        rows: toExport.map(l => [
          l.sr_no, l.customer_name, ownerLabel(l.owner) || '', l.phase, l.lead_temperature,
          l.potential_tcv_lakhs, hasConfidence(l) ? `${Math.round(Number(l.confidence_score))}%` : '—', l.lead_source,
          ['On Hold', 'Lost', 'Won'].includes(l.phase) ? '—' : (l.next_followup_date ? fmtDate(l.next_followup_date) : '—'),
        ]),
      }],
      filename: `Sales_CRM_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const bdOpts = bds.map(b => ({ value: String(b.id), label: b.label || b.name }));
  // customerNames removed from filter bar but state kept for deep-link compatibility
  // Filter options come from the per-business dropdowns, unioned with any values present in the data.
  const sourceOpts = [...new Set([...(dropdowns.lead_source || SOURCES), ...leads.map(l => l.lead_source).filter(Boolean)])];

  return (
    <Layout>
      <div style={{ background: 'var(--m3-surface-container-lowest)', borderBottom: '1px solid var(--m3-outline-variant)', padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cameFromDashboard && <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => { const dtab = searchParams.get('dtab'); navigate(dtab ? `/dashboard?tab=${dtab}` : '/dashboard'); }}>← Dashboard</button>}
          {cameFromForecast && <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => navigate('/forecast')}>← Inventory</button>}
          {cameFromActivity && <button className="btn btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => navigate('/activity')}>← Activity</button>}
          <div>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Leads</h1>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>{openCount} active · {filtered.length} total</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {leadsCanFull && <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setShowChains(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> Master Orders</button>}
          <ExportMenu onExportExcel={exportExcel} onExportPdf={exportPdf} />
          <div style={{ display: 'flex', border: '1px solid var(--m3-outline-variant)', borderRadius: 6, overflow: 'hidden' }}>
            <button className="btn btn-sm" style={{ border: 'none', borderRadius: 0, fontSize: 11, padding: '5px 12px', background: view === 'table' ? 'var(--m3-primary-container)' : '#fff' }} onClick={() => setView('table')}>Table</button>
            <button className="btn btn-sm" style={{ border: 'none', borderRadius: 0, fontSize: 11, padding: '5px 12px', background: view === 'kanban' ? 'var(--m3-primary-container)' : '#fff' }} onClick={() => setView('kanban')}>Kanban</button>
          </div>
          {isAdmin && <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setShowBulkUpload(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Bulk Import</button>}
          {leadsCanFull && <button className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: '5px 12px' }} onClick={openNew}>+ New Lead</button>}
          {leadsCanFull && <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 12px', background: 'var(--color-bg)', color: 'var(--m3-primary)', borderColor: 'var(--m3-primary-container)' }} onClick={() => setShowExpansionPicker(true)}>+ Existing Customer</button>}
        </div>
      </div>

      <div style={{ padding: '8px 16px' }}>
        {deepLinkError && (
          <div style={{ marginBottom: 16, background: 'var(--m3-error-container)', border: '1px solid #fecaca', color: 'var(--m3-error)', borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span>{deepLinkError}</span>
            <button className="btn btn-sm" onClick={() => setDeepLinkError('')}>Dismiss</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'nowrap', alignItems: 'center', background: 'var(--m3-surface-container)', borderRadius: 8, padding: '5px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--m3-on-surface-variant)', whiteSpace: 'nowrap' }}>Filters</span>
          <input className="input" style={{ width: 150, height: 28, fontSize: 11, padding: '4px 8px', background: 'var(--m3-surface-container-lowest)' }} placeholder="Search customer, city…" value={search} onChange={e => setSearch(e.target.value)} />
          <MultiSelect label="Phase" options={PHASES} selected={filterPhases} onChange={setFilterPhases} />
          <MultiSelect label="Scoring" options={SCORE_BANDS} selected={filterScores} onChange={setFilterScores} />
          <MultiSelect label="Source" options={sourceOpts} selected={filterSources} onChange={setFilterSources} />
          {isAdmin && <MultiSelect label="Sales Rep" options={bdOpts} selected={filterBDs} onChange={setFilterBDs} />}
          <FollowUpDatePicker from={filterFollowFrom} to={filterFollowTo}
            onFromChange={setFilterFollowFrom} onToChange={setFilterFollowTo} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--m3-on-surface-variant)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={filterOverdue} onChange={e => setFilterOverdue(e.target.checked)} /> Followup overdue
          </label>
          <div style={{ marginLeft: 'auto' }}>
            <LayoutPicker columns={visibleCols} onChange={handleColChange} />
          </div>
          {/* Rating has no bar control anymore, but the Dashboard "Hot leads" KPI still deep-links to
              it — surface it as a dismissible chip so the user can see and clear that filter. */}
          {filterTemps.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: 'var(--m3-tertiary-container)', border: '1px solid #fed7aa', borderRadius: 999, padding: '4px 10px', color: 'var(--m3-error)' }}>
              Rating: {filterTemps.join(', ')}
              <button type="button" onClick={() => setFilterTemps([])} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--m3-error)', fontWeight: 700, padding: 0 }}>✕</button>
            </span>
          )}
          {filterConf && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: 'var(--m3-primary-container)', border: '1px solid #c7d2fe', borderRadius: 999, padding: '4px 10px', color: 'var(--m3-primary)' }}>
              Confidence: {filterConf === 'high' ? 'High ≥60' : filterConf === 'medium' ? 'Medium 30–59' : 'Low <30'}
              <button type="button" onClick={() => setFilterConf('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--m3-primary)', fontWeight: 700, padding: 0 }}>✕</button>
            </span>
          )}
          {filterIds.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: 'var(--m3-success-container)', border: '1px solid #a7f3d0', borderRadius: 999, padding: '4px 10px', color: 'var(--m3-success)' }}>
              {idsLabel} ({filterIds.length})
              <button type="button" onClick={() => { setFilterIds([]); setIdsLabel(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--m3-success)', fontWeight: 700, padding: 0 }}>✕</button>
            </span>
          )}
        </div>

        {isAdmin && selectedIds.size > 0 && (
          <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, background: 'var(--m3-primary-container)', borderColor: 'var(--m3-primary-container)' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{selectedIds.size} selected</span>
            <button className="btn btn-sm" onClick={() => { setBulkAction('reassign'); setBulkValue(''); }}>Reassign</button>
            <button className="btn btn-sm" onClick={() => { setBulkAction('phase'); setBulkValue(''); }}>Change Phase</button>
            {bulkAction && (
              <>
                <select className="input" style={{ width: 160 }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
                  <option value="">Select…</option>
                  {(bulkAction === 'reassign' ? bds.map(b => ({ id: b.id, label: b.label || b.name })) : PHASES.map(p => ({ id: p, label: p })))
                    .map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button className="btn btn-sm btn-primary" onClick={executeBulk}>Apply</button>
              </>
            )}
            {leadsCanFull && <button className="btn btn-sm btn-danger" onClick={() => setConfirmBulkDelete(true)}>Delete</button>}
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={clearSelect}>Clear</button>
          </div>
        )}

        {loading ? <p style={{ color: 'var(--m3-outline)' }}>Loading…</p> : view === 'kanban' ? (
          <KanbanView leads={filtered} onOpen={openEdit} onPhaseChange={handlePhaseChangeKanban} tatMap={tatMap} bds={bds} />
        ) : (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && (
                    <th onClick={e => e.stopPropagation()} style={{ width: 28 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                        title={allSelected ? 'Deselect all' : `Select all ${filtered.length}`} />
                    </th>
                  )}
                  {orderedCols.map(key => {
                    if (key === 'sales_rep' && !isAdmin) return null;
                    const col = ALL_COLUMNS.find(c => c.key === key);
                    const align = ['qty', 'deal_value'].includes(key) ? 'right' : 'left';
                    return (
                      <th key={key} draggable onDragStart={() => handleColDragStart(key)}
                        onDragOver={e => e.preventDefault()} onDrop={() => handleColDrop(key)}
                        style={{ textAlign: align, cursor: 'grab', userSelect: 'none', background: dragCol === key ? 'var(--m3-primary-container)' : undefined }}
                        title={key === 'aging' ? 'Days in current stage (coloured vs TAT target)' : undefined}>
                        {col?.label || key}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, idx) => {
                  const tatBad = isTATBreached(l);
                  const overdue = isOverdue(l);
                  const poRenewal = renewalStatus(l, renewedIds);
                  const showExpiry = poRenewal && poRenewal.band !== 'ok' && poRenewal.band !== 'renewed';
                  const isClosed = ['On Hold', 'Lost', 'Won'].includes(l.phase);
                  const isLost = l.phase === 'Lost';
                  const conf = hasConfidence(l) ? Number(l.confidence_score) : null;

                  const cellMap = {
                    sr: <td key="sr" style={{ color: 'var(--m3-outline)' }}>{idx + 1}</td>,
                    customer: (
                      <td key="customer">
                        <p style={{ fontWeight: 700, margin: 0 }}>{l.customer_name}</p>
                        {l.lead_ref && <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--m3-primary)', margin: '1px 0 0' }}>{l.lead_ref}</p>}
                        {showExpiry && (() => {
                          const s = RENEWAL_BAND_STYLE[poRenewal.band] || RENEWAL_BAND_STYLE.ok;
                          return <span style={{ display: 'inline-block', marginTop: 3, background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{renewalLabel(poRenewal)}</span>;
                        })()}
                      </td>
                    ),
                    sales_rep: isAdmin ? <td key="sales_rep">{ownerLabel(l.owner)}</td> : null,
                    phase: <td key="phase"><span className={`badge ${PHASE_BADGE[l.phase]}`}>{l.phase}</span></td>,
                    aging: (
                      <td key="aging">
                        {(() => {
                          const a = stageAging(l, tatMap);
                          if (a.days === null) return <span style={{ color: 'var(--m3-outline-variant)' }}>—</span>;
                          const color = a.level === 'over' ? 'var(--m3-error)' : a.level === 'warn' ? 'var(--color-warning)' : a.level === 'ok' ? 'var(--m3-success)' : 'var(--m3-on-surface-variant)';
                          const bg    = a.level === 'over' ? 'var(--m3-error-container)' : a.level === 'warn' ? 'var(--m3-tertiary-container)' : a.level === 'ok' ? 'var(--m3-success-container)' : 'var(--m3-surface-container)';
                          return <span className="badge" style={{ background: bg, color, border: `1px solid ${color}22`, fontWeight: 700 }} title={a.target != null ? `${a.days}d in ${l.phase} · target ${a.target}d` : `${a.days}d in ${l.phase}`}>{a.days}d</span>;
                        })()}
                      </td>
                    ),
                    location: <td key="location">{l.state || <span style={{ color: 'var(--m3-outline-variant)' }}>—</span>}</td>,
                    qty: <td key="qty" style={{ textAlign: 'right' }}>{l.quantity || <span style={{ color: 'var(--m3-outline-variant)' }}>—</span>}</td>,
                    deal_value: <td key="deal_value" style={{ textAlign: 'right', fontWeight: 700 }}>{hasMoney(l.potential_tcv_lakhs) ? `₹${l.potential_tcv_lakhs}` : '—'}</td>,
                    scoring: (
                      <td key="scoring">
                        {conf === null ? <span style={{ color: 'var(--m3-outline-variant)' }}>—</span> : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span className={`badge ${conf >= 60 ? 'badge-green' : conf >= 30 ? 'badge-amber' : 'badge-gray'}`} style={{ minWidth: 40, justifyContent: 'center' }}>{Math.round(conf)}%</span>
                            <TrendArrow trend={confidenceTrend(l)} />
                          </span>
                        )}
                      </td>
                    ),
                    followup: (
                      <td key="followup">
                        {isClosed ? <span style={{ color: 'var(--m3-outline-variant)' }}>—</span> :
                          l.next_followup_date ? <span style={{ color: overdue ? 'var(--m3-error)' : 'var(--m3-on-surface)', fontWeight: overdue ? 700 : 400 }}>{overdue && '⚠ '}{fmtDate(l.next_followup_date)}</span> :
                          <span style={{ color: 'var(--m3-outline-variant)' }}>—</span>}
                      </td>
                    ),
                    source: <td key="source">{l.lead_source || '—'}</td>,
                    new_renewal: <td key="new_renewal">{l.new_or_renewal || '—'}</td>,
                    competitor: <td key="competitor">{l.competitor || <span style={{ color: 'var(--m3-outline-variant)' }}>—</span>}</td>,
                    contract: <td key="contract">{l.contract_period_months ? `${l.contract_period_months}mo` : '—'}</td>,
                    billing: <td key="billing">{l.billing_cycle || '—'}</td>,
                    created: <td key="created">{l.createdAt ? fmtDate(l.createdAt) : '—'}</td>,
                  };

                  return (
                    <tr key={l.id} onClick={() => openEdit(l)} style={{ background: isLost ? 'var(--m3-surface-container-high)' : (tatBad ? 'var(--m3-error-container)' : undefined), color: isLost ? 'var(--m3-outline)' : undefined, opacity: isLost ? 0.75 : 1 }}>
                      {isAdmin && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} /></td>}
                      {orderedCols.map(key => {
                        if (key === 'sales_rep' && !isAdmin) return null;
                        return cellMap[key] || null;
                      })}
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={orderedCols.length + (isAdmin ? 1 : 0)} style={{ textAlign: 'center', color: 'var(--m3-outline)', padding: 16 }}>No leads match your filters.</td></tr>}
              </tbody>
            </table>
            {isAdmin && filtered.length > 0 && (
              <div style={{ padding: 8 }}>
                {leadsCanEdit && <button className="btn btn-sm" onClick={selectAll}>Select all ({filtered.length})</button>}
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        // Deliberately NO close-on-backdrop-click here: a stray click outside must not discard a
        // half-filled lead. Only the ✕ or Cancel button closes the form.
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', gap: 4 }}>
                <span className={`tab ${tab === 'form' ? 'active' : ''}`} onClick={() => setTab('form')}>{editLead ? `Edit Lead${editLead.lead_ref ? ` · ${editLead.lead_ref}` : ''}` : (expansionFrom ? `${expansionMode === 'renewal' ? 'Renewal' : 'Additional Order'} · ${expansionFrom.customer_name}` : 'New Lead')}</span>
                {editLead && <span className={`tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editLead && isAdmin && leadsCanFull && <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(editLead.id)}>Delete</button>}
                <button className="btn btn-sm" onClick={closeForm}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              {tab === 'form'
                // Every business uses the template-driven form, built from its own lead template.
                ? <CustomLeadForm lead={editLead} onSave={onSaved} onCancel={closeForm} buConfig={buConfig} expansionFrom={expansionFrom} expansionMode={expansionMode} />
                : <ActivityLogView leadId={editLead.id} />}
            </div>
          </div>
        </div>
      )}

      {showChains && <GlobalPosView onClose={() => setShowChains(false)} />}

      {stageDialog && (
        <StageChangeDialog
          lead={stageDialog.lead}
          toPhase={stageDialog.toPhase}
          buConfig={buConfig}
          onCancel={() => setStageDialog(null)}
          onDone={() => { setStageDialog(null); fetchAll(); }}
          onOpenForm={() => openFullFormAt(stageDialog.lead, stageDialog.toPhase)}
        />
      )}

      {showExpansionPicker && (
        <ExpansionPicker leads={leads} onPick={openExpansionFrom} onClose={() => setShowExpansionPicker(false)} />
      )}

      {showBulkUpload && (
        <BulkUploadModal
          businessUnit={user.business_unit}
          config={buConfig}
          onClose={() => setShowBulkUpload(false)}
          onImported={fetchAll}
        />
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body">
              <p style={{ fontWeight: 700, marginBottom: 8 }}>Delete this lead?</p>
              <p style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginBottom: 20 }}>This permanently removes the lead, its contacts, and its activity history. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setDeleteId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={async () => { await deleteLead(deleteId); setDeleteId(null); closeForm(); fetchAll(); }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setConfirmBulkDelete(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body">
              <p style={{ fontWeight: 700, marginBottom: 8 }}>Delete {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''}?</p>
              <p style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginBottom: 20 }}>This permanently removes the selected lead{selectedIds.size > 1 ? 's' : ''}, their contacts, and their activity history. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" disabled={bulkDeleting} onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
                <button className="btn btn-danger" disabled={bulkDeleting} onClick={executeBulkDelete}>{bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
