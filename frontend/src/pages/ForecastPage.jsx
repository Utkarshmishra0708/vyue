import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getForecastDevices } from '../services/api';
import { fmtDate, fmtMonthYear } from '../utils/leadHelpers';
import { exportRowsToPdf } from '../utils/pdfExport';

const monthKey = (d) => d ? new Date(d).toISOString().slice(0, 7) : 'unscheduled';
const monthLabel = (k) => k === 'unscheduled' ? 'Unscheduled' : fmtMonthYear(k + '-01');

export default function ForecastPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bu, setBu] = useState('all');

  useEffect(() => { getForecastDevices().then(setLeads).finally(() => setLoading(false)); }, []);

  const deviceLeads = useMemo(() => leads.filter(l => bu === 'all' || l.business_unit === bu), [leads, bu]);
  const units = (l) => l.device_qty ?? l.quantity ?? 0;

  const skus = useMemo(() => [...new Set(deviceLeads.map(l => l.device_sku || 'Unspecified'))].sort(), [deviceLeads]);
  const months = useMemo(() => {
    const m = [...new Set(deviceLeads.map(l => monthKey(l.po_expected_date)))];
    return m.sort((a, b) => a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b));
  }, [deviceLeads]);

  const pivot = useMemo(() => {
    const grid = {};
    months.forEach(m => { grid[m] = {}; skus.forEach(s => grid[m][s] = 0); });
    deviceLeads.forEach(l => { grid[monthKey(l.po_expected_date)][l.device_sku || 'Unspecified'] += units(l); });
    return grid;
  }, [deviceLeads, months, skus]);

  const skuTotal = (s) => deviceLeads.filter(l => (l.device_sku || 'Unspecified') === s).reduce((sum, l) => sum + units(l), 0);
  const monthTotal = (m) => skus.reduce((sum, s) => sum + (pivot[m]?.[s] || 0), 0);
  const grandTotal = deviceLeads.reduce((sum, l) => sum + units(l), 0);

  const exportExcel = async () => {
    if (!deviceLeads.length) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const pivotRows = months.map(m => {
      const row = { Month: monthLabel(m) };
      skus.forEach(s => row[s] = pivot[m][s]);
      row.Total = monthTotal(m);
      return row;
    });
    const totalsRow = { Month: 'TOTAL' };
    skus.forEach(s => totalsRow[s] = skuTotal(s));
    totalsRow.Total = grandTotal;
    pivotRows.push(totalsRow);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pivotRows), 'Units by Month');

    const detailRows = deviceLeads.map(l => ({
      Customer: l.customer_name, 'Business Unit': (l.business_unit || '').toUpperCase(), BD: l.owner?.name || '',
      'Device SKU': l.device_sku || 'Unspecified', Units: units(l),
      'Device Requested Date': l.device_requested_date ? fmtDate(l.device_requested_date) : '',
      'PO Expected': l.po_expected_date ? fmtMonthYear(l.po_expected_date) : 'Unscheduled', Phase: l.phase,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Detail');
    XLSX.writeFile(wb, `Hardware_Forecast_${bu.toUpperCase()}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportPdf = () => {
    if (!deviceLeads.length) return;
    exportRowsToPdf({
      title: 'Sales CRM — Hardware Forecast',
      subtitle: `${bu === 'all' ? 'All business units' : bu.toUpperCase()} · ${grandTotal} total units · generated ${fmtDate(new Date())}`,
      tables: [
        {
          heading: 'Units by Month & SKU',
          columns: ['Month', ...skus, 'Total'],
          rows: [
            ...months.map(m => [monthLabel(m), ...skus.map(s => pivot[m][s] || 0), monthTotal(m)]),
            ['TOTAL', ...skus.map(s => skuTotal(s)), grandTotal],
          ],
        },
        {
          heading: 'Device Demand — Detail',
          columns: ['Customer', 'BU', 'BD', 'Device SKU', 'Units', 'Device Requested', 'PO Expected', 'Phase'],
          rows: deviceLeads.map(l => [
            l.customer_name, (l.business_unit || '').toUpperCase(), l.owner?.name?.split(' ')[0] || '',
            l.device_sku || 'Unspecified', units(l),
            l.device_requested_date ? fmtDate(l.device_requested_date) : '—',
            l.po_expected_date ? fmtMonthYear(l.po_expected_date) : 'Unscheduled', l.phase,
          ]),
        },
      ],
      filename: `Hardware_Forecast_${bu.toUpperCase()}_${new Date().toISOString().slice(0,10)}.pdf`,
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-sm" onClick={() => navigate('/')}>← Back</button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Forecast Dashboard</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Hardware units expected — by month & SKU · public view</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'signage', 'jhes'].map(b => (
            <button key={b} className="btn btn-sm" style={{ background: bu === b ? '#eef2ff' : '#fff' }} onClick={() => setBu(b)}>
              {b === 'all' ? 'All' : b === 'jhes' ? 'JHES' : 'Signage'}
            </button>
          ))}
          {deviceLeads.length > 0 && <button className="btn btn-success" onClick={exportExcel}>Export Excel</button>}
          {deviceLeads.length > 0 && <button className="btn" onClick={exportPdf}>Export PDF</button>}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? <p style={{ color: '#94a3b8' }}>Loading…</p> : deviceLeads.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hardware (device) leads found for this selection.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div className="kpi-card"><p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Total Units Forecast</p><p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{grandTotal.toLocaleString()}</p></div>
              <div className="kpi-card"><p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Device Deals</p><p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{deviceLeads.length}</p></div>
              <div className="kpi-card"><p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Distinct SKUs</p><p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{skus.length}</p></div>
              <div className="kpi-card"><p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Won Units</p><p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0', color: '#059669' }}>{deviceLeads.filter(l => l.phase === 'PO Received').reduce((s,l) => s + units(l), 0).toLocaleString()}</p></div>
            </div>

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Units by Month & SKU</p>
              </div>
              <table className="data-table">
                <thead><tr><th>Month</th>{skus.map(s => <th key={s} style={{ textAlign: 'right' }}>{s}</th>)}<th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {months.map(m => (
                    <tr key={m}><td>{monthLabel(m)}</td>{skus.map(s => <td key={s} style={{ textAlign: 'right' }}>{pivot[m][s] || '—'}</td>)}<td style={{ textAlign: 'right', fontWeight: 700 }}>{monthTotal(m)}</td></tr>
                  ))}
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td>TOTAL</td>{skus.map(s => <td key={s} style={{ textAlign: 'right' }}>{skuTotal(s)}</td>)}<td style={{ textAlign: 'right' }}>{grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Device Demand — Detail</p>
              </div>
              <table className="data-table">
                <thead><tr><th>Customer</th><th>BU</th><th>BD</th><th>Device SKU</th><th style={{ textAlign: 'right' }}>Units</th><th>Device Requested</th><th>PO Expected</th><th>Phase</th></tr></thead>
                <tbody>
                  {deviceLeads.map(l => (
                    <tr key={l.id}>
                      <td>{l.customer_name}</td><td>{(l.business_unit || '').toUpperCase()}</td><td>{l.owner?.name?.split(' ')[0]}</td>
                      <td>{l.device_sku || 'Unspecified'}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{units(l)}</td>
                      <td>{l.device_requested_date ? fmtDate(l.device_requested_date) : '—'}</td>
                      <td>{l.po_expected_date ? fmtMonthYear(l.po_expected_date) : '—'}</td><td>{l.phase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
