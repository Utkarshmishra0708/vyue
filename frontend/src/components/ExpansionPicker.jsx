import React, { useMemo, useState } from 'react';
import { renewalStatus, renewalLabel, RENEWAL_BAND_STYLE, fmtDate, buildRenewedSet } from '../utils/leadHelpers';

// "+ Existing Customer": start a new lead for a customer you already have. It asks one question at a
// time:
//   1. What would you like to do? Renew an order, or add a new order.
//   2. Renew: pick the WON ORDER being renewed (soonest-ending first). The new lead copies that
//      order's details, services and value, and is linked to it. onPick(order, 'renewal').
//      Add:   pick the CUSTOMER. The new lead copies their details (Sales Rep, location, rating,
//      contacts); the services are filled in fresh. onPick(latestLeadOfCustomer, 'additional').
// It is self-contained, so any screen can open it.
export default function ExpansionPicker({ leads, onPick, onClose }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'renew' | 'add'
  const [search, setSearch] = useState('');
  const renewedIds = useMemo(() => buildRenewedSet(leads || []), [leads]);

  // Customers: grouped by customer code, with their most recent lead as the source of details.
  const customers = useMemo(() => {
    const map = new Map();
    for (const l of (leads || [])) {
      if (!l.customer_code) continue;
      let c = map.get(l.customer_code);
      if (!c) { c = { code: l.customer_code, name: l.customer_name, cities: new Set(), leads: [] }; map.set(l.customer_code, c); }
      c.leads.push(l);
      if (l.city) c.cities.add(l.city);
    }
    for (const c of map.values()) {
      c.source = c.leads.reduce((a, b) => ((b.id || 0) > (a.id || 0) ? b : a), c.leads[0]);
      c.won = c.leads.filter(l => l.phase === 'Won').length;
      c.open = c.leads.filter(l => !['Won', 'Lost'].includes(l.phase)).length;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  // Won orders: those not yet renewed first, soonest end date first; orders without an end date last.
  const orders = useMemo(() => {
    const won = (leads || []).filter(l => l.phase === 'Won');
    const key = (l) => (l.service_end_date ? new Date(l.service_end_date).getTime() : Infinity);
    return won.sort((a, b) => key(a) - key(b));
  }, [leads]);
  const toRenew = orders.filter(o => !renewedIds.has(o.id));
  const alreadyRenewed = orders.filter(o => renewedIds.has(o.id));

  const q = search.trim().toLowerCase();
  const match = (...vals) => !q || vals.some(v => String(v || '').toLowerCase().includes(q));
  const go = (next) => { setStep(next); setSearch(''); };

  const st = {
    card: { flex: 1, minWidth: 220, textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#fff', cursor: 'pointer' },
    cardTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 },
    cardText: { fontSize: 12.5, color: '#475569', lineHeight: 1.45 },
    cardCount: { marginTop: 10, fontSize: 12, fontWeight: 600, color: '#4338ca' },
    list: { border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 380, overflowY: 'auto' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left' },
    name: { fontWeight: 700, color: '#0f172a', fontSize: 13 },
    sub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
    empty: { padding: 24, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 13 },
    back: { background: 'none', border: 'none', color: '#4338ca', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 },
  };
  const badge = (status) => {
    if (!status) return null;
    const s = RENEWAL_BAND_STYLE[status.band] || RENEWAL_BAND_STYLE.ok;
    return <span style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{renewalLabel(status)}</span>;
  };
  const value = (o) => {
    const v = parseFloat(o.po_actual_value_lakhs ?? o.potential_tcv_lakhs);
    return Number.isFinite(v) ? `₹${v.toFixed(2)} L` : '';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
              {step === 'choose' ? 'Existing customer' : step === 'renew' ? 'Renew an order' : 'Add a new order'}
            </div>
            {step !== 'choose' && (
              <button type="button" style={{ ...st.back, marginTop: 4 }} onClick={() => go('choose')}>← Back</button>
            )}
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {step === 'choose' && (<>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>What do you want to do?</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" style={st.card} onClick={() => go('renew')}>
                <div style={st.cardTitle}>🔁 Renew an order</div>
                <div style={st.cardText}>The customer is extending a won order that is ending.</div>
                <div style={st.cardCount}>{toRenew.length} order{toRenew.length === 1 ? '' : 's'} to choose from</div>
              </button>
              <button type="button" style={st.card} onClick={() => go('add')}>
                <div style={st.cardTitle}>➕ Add a new order</div>
                <div style={st.cardText}>The customer is buying something more from you.</div>
                <div style={st.cardCount}>{customers.length} customer{customers.length === 1 ? '' : 's'} to choose from</div>
              </button>
            </div>
          </>)}

          {step === 'renew' && (<>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Pick the order the customer is extending.</p>
            <input className="input" placeholder="Search customer or order no." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div style={st.list}>
              {toRenew.filter(o => match(o.customer_name, o.po_number, o.customer_code)).map(o => (
                <button key={o.id} type="button" style={st.row} onClick={() => onPick(o, 'renewal')}>
                  <div>
                    <div style={st.name}>{o.customer_name}</div>
                    <div style={st.sub}>
                      {[o.po_number, value(o), o.service_end_date && `ends ${fmtDate(o.service_end_date)}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {badge(renewalStatus(o, renewedIds))}
                    <span style={{ color: '#4338ca', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>Renew →</span>
                  </div>
                </button>
              ))}
              {toRenew.filter(o => match(o.customer_name, o.po_number, o.customer_code)).length === 0 && (
                <div style={st.empty}>{toRenew.length === 0 ? 'Nothing to renew yet.' : 'No matches.'}</div>
              )}
              {alreadyRenewed.filter(o => match(o.customer_name, o.po_number, o.customer_code)).map(o => (
                <div key={o.id} style={{ ...st.row, cursor: 'default', background: '#f8fafc' }}>
                  <div>
                    <div style={{ ...st.name, color: '#64748b' }}>{o.customer_name}</div>
                    <div style={st.sub}>{[o.po_number, value(o)].filter(Boolean).join(' · ')}</div>
                  </div>
                  {badge(renewalStatus(o, renewedIds))}
                </div>
              ))}
            </div>
          </>)}

          {step === 'add' && (<>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Pick the customer who is buying more.</p>
            <input className="input" placeholder="Search customer" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div style={st.list}>
              {customers.filter(c => match(c.name, c.code)).map(c => {
                const cities = [...c.cities];
                const where = cities.length === 0 ? 'No city' : cities.length === 1 ? cities[0] : `${cities.length} cities`;
                const parts = [c.won && `${c.won} won`, c.open && `${c.open} open`].filter(Boolean).join(' · ') || '—';
                return (
                  <button key={c.code} type="button" style={st.row} onClick={() => onPick(c.source, 'additional')}>
                    <div>
                      <div style={st.name}>{c.name}</div>
                      <div style={st.sub}>{where} · {parts}</div>
                    </div>
                    <span style={{ color: '#4338ca', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>Add →</span>
                  </button>
                );
              })}
              {customers.filter(c => match(c.name, c.code)).length === 0 && (
                <div style={st.empty}>{customers.length === 0 ? 'No customers yet.' : 'No matches.'}</div>
              )}
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
