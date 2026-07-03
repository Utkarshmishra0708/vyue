import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getLeads, getStageHistory, getSettings, setSetting, getBds } from '../services/api';
import { STAGE_ORDER, STAGE_WIN_PCT, PHASE_BADGE } from '../utils/constants';
import { fmtDate, isOverdue, daysBetween } from '../utils/leadHelpers';

function Kpi({ icon, label, value, sub, onClick }) {
  return (
    <div className={`kpi-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [bds, setBds] = useState([]);
  const [settings, setSettings] = useState({});
  const [filterBD, setFilterBD] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingTarget, setEditingTarget] = useState(null); // bd name or 'weekly'
  const [targetInput, setTargetInput] = useState('');

  useEffect(() => {
    Promise.all([getLeads(), getStageHistory(), getSettings(), getBds(user.business_unit)])
      .then(([ld, sh, st, bl]) => { setLeads(ld); setStageHistory(sh); setSettings(st); setBds(bl); })
      .finally(() => setLoading(false));
  }, [user.business_unit]);

  const weeklyTarget = parseFloat(settings.weekly_target_lakhs) || 5.3;
  const bdTargets = useMemo(() => { try { return JSON.parse(settings.bd_weekly_targets || '{}'); } catch { return {}; } }, [settings]);

  const filtered = useMemo(() => isAdmin && filterBD ? leads.filter(l => l.owner?.name === filterBD) : leads, [leads, isAdmin, filterBD]);

  const navigateWithFilter = (filter) => {
    const params = new URLSearchParams({ filter });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    navigate(`/leads?${params}`);
  };
  const navigateWithPhase = (phase) => {
    const params = new URLSearchParams({ phase });
    if (isAdmin && filterBD) params.set('bd', filterBD);
    navigate(`/leads?${params}`);
  };

  const active = filtered.filter(l => !['Lost', 'On Hold', 'PO Received'].includes(l.phase));
  const won = filtered.filter(l => l.phase === 'PO Received');
  const hot = filtered.filter(l => l.lead_temperature === 'Hot' && !['Lost', 'PO Received'].includes(l.phase));
  const overdue = filtered.filter(isOverdue);
  const openTCV = active.reduce((s, l) => s + (parseFloat(l.potential_tcv_lakhs) || 0), 0);
  const wonTCV = won.reduce((s, l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
  const weightedForecast = filtered.filter(l => !['Lost', 'PO Received'].includes(l.phase))
    .reduce((s, l) => s + (parseFloat(l.potential_tcv_lakhs) || 0) * ((STAGE_WIN_PCT[l.phase] || 0) / 100), 0);

  // Data quality — only mandatory fields (State/City are optional, so excluded)
  const missingTCV = filtered.filter(l => !l.potential_tcv_lakhs || parseFloat(l.potential_tcv_lakhs) === 0).length;
  const missingFollowup = filtered.filter(l => !l.next_followup_date && !['PO Received', 'Lost', 'On Hold'].includes(l.phase)).length;
  const missingQuantity = filtered.filter(l => !l.quantity || l.quantity === 0).length;
  const dataQualityIssues = [
    { label: 'Missing TCV', count: missingTCV, badge: 'badge-red' },
    { label: 'No Follow-Up Date', count: missingFollowup, badge: 'badge-amber' },
    { label: 'Missing Quantity', count: missingQuantity, badge: 'badge-amber' },
  ].filter(d => d.count > 0);
  const totalDataIssues = dataQualityIssues.reduce((s, d) => s + d.count, 0);

  // Weekly won — Monday-anchored week
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
  const weeklyWon = filtered.filter(l => l.phase === 'PO Received').filter(l => {
    const d = new Date(l.po_received_date || l.phase_changed_at);
    return d >= weekStart && d <= weekEnd;
  }).reduce((s, l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
  const weeklyPct = Math.min(100, Math.round((weeklyWon / weeklyTarget) * 100));

  const phaseCounts = STAGE_ORDER.concat(['Lost', 'On Hold']).map(p => ({ phase: p, count: filtered.filter(l => l.phase === p).length }));
  const funnelData = STAGE_ORDER.map(p => ({ name: p, count: filtered.filter(l => l.phase === p).length }));

  // Funnel & conversion (from stage_history)
  const filteredLeadIds = new Set(filtered.map(l => l.id));
  const scopedHistory = stageHistory.filter(sh => filteredLeadIds.has(sh.lead_id));
  const stageRanks = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i]));
  const maxRankPerLead = {};
  for (const sh of scopedHistory) {
    const r = stageRanks[sh.to_stage];
    if (r === undefined) continue;
    maxRankPerLead[sh.lead_id] = Math.max(maxRankPerLead[sh.lead_id] ?? -1, r);
  }
  const funnelStages = STAGE_ORDER.map((stage, i) => ({
    stage, count: Object.values(maxRankPerLead).filter(r => r >= i).length, winPct: STAGE_WIN_PCT[stage] || 0,
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

  const overdueForTicker = leads.filter(isOverdue);

  // Annual BD performance — BDs see only their own, admin sees all
  const currentYear = new Date().getFullYear();
  const bdsToShow = isAdmin ? bds.map(b => b.name) : [user.name];
  const annualBDPerf = bdsToShow.map(name => {
    const bdLeads = leads.filter(l => l.owner?.name === name);
    const wonThisYear = bdLeads.filter(l => l.phase === 'PO Received' && new Date(l.po_received_date || l.phase_changed_at).getFullYear() === currentYear);
    const closedThisYear = bdLeads.filter(l => ['PO Received','Lost'].includes(l.phase) && new Date(l.po_received_date || l.phase_changed_at || l.createdAt).getFullYear() === currentYear);
    const wonTCVYear = wonThisYear.reduce((s,l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
    const convRate = closedThisYear.length ? Math.round((wonThisYear.length / closedThisYear.length) * 100) : 0;
    const activeNow = bdLeads.filter(l => !['Lost','On Hold','PO Received'].includes(l.phase));
    return { name, totalLeads: bdLeads.length, wonDeals: wonThisYear.length, wonTCV: wonTCVYear, convRate, activeLeads: activeNow.length };
  });

  // Renewal alerts
  const renewalAlerts = filtered.filter(l => l.new_or_renewal === 'Renewal' && l.po_received_date && l.contract_period_months).map(l => {
    const start = new Date(l.po_received_date);
    const expiry = new Date(start); expiry.setMonth(expiry.getMonth() + l.contract_period_months);
    return { ...l, daysToExpiry: daysBetween(new Date(), expiry) };
  }).filter(l => l.daysToExpiry >= 0 && l.daysToExpiry <= 90).sort((a,b) => a.daysToExpiry - b.daysToExpiry);

  const saveWeeklyTarget = async () => {
    const v = parseFloat(targetInput);
    if (isNaN(v) || v <= 0) return;
    await setSetting('weekly_target_lakhs', String(v));
    setSettings(s => ({ ...s, weekly_target_lakhs: String(v) }));
    setEditingTarget(null);
  };
  const saveBdTarget = async (bdName) => {
    const v = parseFloat(targetInput);
    if (isNaN(v) || v <= 0) return;
    const next = { ...bdTargets, [bdName]: v };
    await setSetting('bd_weekly_targets', JSON.stringify(next));
    setSettings(s => ({ ...s, bd_weekly_targets: JSON.stringify(next) }));
    setEditingTarget(null);
  };

  if (loading) return <Layout><div style={{ padding: 32, color: '#94a3b8' }}>Loading…</div></Layout>;

  return (
    <Layout>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Dashboard</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Pipeline overview & analytics</p>
        </div>
        {isAdmin && (
          <select className="input" style={{ width: 180 }} value={filterBD} onChange={e => setFilterBD(e.target.value)}>
            <option value="">All BDs</option>
            {bds.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {overdueForTicker.length > 0 && (
          <div style={{ background: '#dc2626', color: '#fff', borderRadius: 10, padding: '8px 14px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700, marginRight: 12 }}>⏰ OVERDUE</span>
            {overdueForTicker.map(l => `${l.customer_name} · ${l.owner?.name?.split(' ')[0]} · Due ${fmtDate(l.next_followup_date)}`).join('   |   ')}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <Kpi icon="💰" label="Open Pipeline" value={`₹${openTCV.toFixed(1)}L`} sub={`${active.length} active`} onClick={() => navigateWithFilter('active')} />
          <Kpi icon="🎯" label="Weighted Forecast" value={`₹${weightedForecast.toFixed(1)}L`} sub="TCV × stage win %" />
          <Kpi icon="🏆" label="Won TCV" value={`₹${wonTCV.toFixed(1)}L`} sub={`${won.length} deals`} onClick={() => navigateWithFilter('won')} />
          <Kpi icon="🔥" label="Hot Leads" value={String(hot.length)} sub="Tap to view" onClick={() => navigateWithFilter('hot')} />
          <Kpi icon="⏰" label="Overdue Follow-Ups" value={String(overdue.length)} sub="Tap to view" onClick={() => navigateWithFilter('overdue')} />
        </div>

        {totalDataIssues > 0 && (
          <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: 0 }}>
                Data Quality — {totalDataIssues} incomplete field{totalDataIssues > 1 ? 's' : ''} across leads
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dataQualityIssues.map(d => (
                <span key={d.label} className={`badge ${d.badge}`} style={{ padding: '6px 12px' }}>
                  {d.label}: <strong style={{ marginLeft: 4 }}>{d.count}</strong> lead{d.count > 1 ? 's' : ''}
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
              <p className="section-title" style={{ margin: 0 }}>Weekly Pipeline Target</p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>POs this week vs ₹{weeklyTarget}L target</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>₹{weeklyWon.toFixed(2)}L</p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{weeklyPct}%</p>
            </div>
          </div>
          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
            <div style={{ height: 8, width: `${weeklyPct}%`, background: weeklyPct >= 100 ? '#059669' : '#4f46e5', borderRadius: 99 }} />
          </div>
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
              {bds.map(b => {
                const target = bdTargets[b.name] ?? weeklyTarget;
                const bdWon = leads.filter(l => l.owner?.name === b.name && l.phase === 'PO Received').filter(l => {
                  const d = new Date(l.po_received_date || l.phase_changed_at); return d >= weekStart && d <= weekEnd;
                }).reduce((s,l) => s + (parseFloat(l.po_actual_value_lakhs) || parseFloat(l.potential_tcv_lakhs) || 0), 0);
                const pct = Math.min(100, Math.round((bdWon / target) * 100));
                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{b.name.split(' ')[0]}</span>
                      {editingTarget === b.name ? (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <input className="input" style={{ width: 70 }} type="number" step="0.1" value={targetInput} onChange={e => setTargetInput(e.target.value)} />
                          <button className="btn btn-sm btn-primary" onClick={() => saveBdTarget(b.name)}>✓</button>
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>₹{bdWon.toFixed(1)}L / ₹{target}L <button className="btn btn-sm" style={{ marginLeft: 6, padding: '2px 6px' }} onClick={() => { setEditingTarget(b.name); setTargetInput(String(target)); }}>✏️</button></span>
                      )}
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, marginTop: 4 }}>
                      <div style={{ height: 6, width: `${pct}%`, background: pct >= 100 ? '#059669' : '#818cf8', borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <p className="section-title">Pipeline by Phase</p>
            <ResponsiveContainer width="100%" height={200}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {funnelWithConv.map((f, i) => {
                const maxCount = Math.max(...funnelWithConv.map(x => x.count), 1);
                return (
                  <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <div style={{ width: 80, fontWeight: 600 }}>{f.stage}</div>
                    <div style={{ flex: 1, height: 20, background: '#f8fafc', borderRadius: 6, position: 'relative' }}>
                      <div style={{ height: '100%', width: `${Math.max(8, Math.round((f.count/maxCount)*100))}%`, background: '#a5b4fc', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                        <span style={{ fontWeight: 700 }}>{f.count}</span>
                      </div>
                    </div>
                    <div style={{ width: 40, textAlign: 'right', color: f.conv !== null && f.conv < 50 ? '#dc2626' : '#059669', fontWeight: 700 }}>{i === 0 || f.conv === null ? '—' : `${f.conv}%`}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <p className="section-title">Bottlenecks — Avg Days per Stage</p>
            {avgTimeInStage.every(s => s.avgDays === null) ? (
              <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No completed stage transitions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {avgTimeInStage.map(s => {
                  const maxAvg = Math.max(...avgTimeInStage.map(x => x.avgDays || 0), 1);
                  return (
                    <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <div style={{ width: 80, fontWeight: 600 }}>{s.stage}</div>
                      <div style={{ flex: 1, height: 16, background: '#f8fafc', borderRadius: 6 }}>
                        {s.avgDays !== null && <div style={{ height: '100%', width: `${Math.max(4, Math.round((s.avgDays/maxAvg)*100))}%`, background: s.avgDays > 21 ? '#f87171' : s.avgDays > 14 ? '#fbbf24' : '#34d399', borderRadius: 6 }} />}
                      </div>
                      <div style={{ width: 60, textAlign: 'right' }}>{s.avgDays === null ? '—' : `${s.avgDays}d (${s.samples})`}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {renewalAlerts.length > 0 && (
            <div className="card">
              <p className="section-title">🔔 Renewal Alerts</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {renewalAlerts.map(l => (
                  <div key={l.id} className="card-sm" style={{ display: 'flex', justifyContent: 'space-between', background: l.daysToExpiry <= 30 ? '#fef2f2' : '#fffbeb' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{l.customer_name}</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{l.owner?.name?.split(' ')[0]} · ₹{l.potential_tcv_lakhs}L</p>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: l.daysToExpiry <= 30 ? '#dc2626' : '#92400e' }}>{l.daysToExpiry}d left</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <p className="section-title">🏅 Annual BD Performance — {currentYear}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {annualBDPerf.map(bd => (
              <div key={bd.name} className="card-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, margin: 0, fontSize: 13 }}>{bd.name}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{bd.totalLeads} total leads</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, color: '#059669', margin: 0 }}>₹{bd.wonTCV.toFixed(1)}L won</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{bd.wonDeals} deals</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: 6, textAlign: 'center' }}><div style={{ color: '#94a3b8' }}>Active</div><div style={{ fontWeight: 700 }}>{bd.activeLeads}</div></div>
                  <div style={{ background: '#ecfdf5', borderRadius: 8, padding: 6, textAlign: 'center' }}><div style={{ color: '#94a3b8' }}>Won {currentYear}</div><div style={{ fontWeight: 700 }}>{bd.wonDeals}</div></div>
                  <div style={{ background: '#eff6ff', borderRadius: 8, padding: 6, textAlign: 'center' }}><div style={{ color: '#94a3b8' }}>Conv. Rate</div><div style={{ fontWeight: 700 }}>{bd.convRate}%</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
