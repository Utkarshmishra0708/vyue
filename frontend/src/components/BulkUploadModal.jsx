import React, { useEffect, useRef, useState } from 'react';
import { bulkImportLeads, getManagedUsers } from '../services/api';
import { parseUploadedFile, downloadTemplate } from '../utils/bulkTemplate';
import useBusinessUnits from '../utils/useBusinessUnits';

export default function BulkUploadModal({ businessUnit, config, onClose, onImported }) {
  const { meta: businessOf } = useBusinessUnits();
  const businessName = businessOf(businessUnit).name;
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [users, setUsers] = useState([]);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getManagedUsers(businessUnit).then(setUsers).catch(() => {});
  }, [businessUnit]);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErr('');
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const parsed = await parseUploadedFile(XLSX, f, businessUnit, config);
      if (parsed.length === 0) { setErr('No data rows found in the file.'); setBusy(false); return; }
      if (parsed.length > 500) { setErr(`Too many rows (${parsed.length}). Maximum is 500.`); setBusy(false); return; }
      setRows(parsed);
      const res = await bulkImportLeads(parsed, businessUnit, true);
      setResult(res);
      setStep('preview');
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message || 'Error parsing file.');
    } finally { setBusy(false); }
  };

  const handleImport = async () => {
    setBusy(true);
    setErr('');
    setStep('importing');
    try {
      const res = await bulkImportLeads(rows, businessUnit, false);
      setResult(res);
      setStep('done');
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message || 'Import failed.');
      setStep('preview');
    } finally { setBusy(false); }
  };

  const handleDownloadTemplate = async () => {
    setErr('');
    try {
      await downloadTemplate(businessUnit, config, users, businessName);
    } catch (ex) {
      console.error('Template download failed:', ex);
      setErr(ex?.message || 'Could not generate the template. Please try again.');
    }
  };

  // No close-on-backdrop-click: a parsed upload / current step must not be discarded by a stray
  // click. Use the × button to close.
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Bulk Import Leads</span>
          <button className="btn btn-sm" onClick={onClose} disabled={busy}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 'upload' && (
            <>
              <p style={{ fontSize: 13, color: 'var(--m3-on-surface)', margin: 0 }}>
                Upload an Excel file (.xlsx) to import leads in bulk. Use the template to ensure the correct format.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn" onClick={handleDownloadTemplate}>⬇ Download Template</button>
                <span style={{ fontSize: 12, color: 'var(--m3-outline)' }}>for {businessName}</span>
              </div>
              <div style={{ border: '2px dashed #e8eaf0', borderRadius: 12, padding: 32, textAlign: 'center', background: 'var(--m3-surface-container)' }}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
                <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                  {busy ? 'Parsing…' : 'Choose File to Upload'}
                </button>
                <p style={{ fontSize: 12, color: 'var(--m3-outline)', margin: '10px 0 0' }}>
                  .xlsx only · max 500 rows · dates in YYYY-MM-DD
                </p>
              </div>
            </>
          )}

          {step === 'preview' && result && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--m3-surface-container)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', margin: 0 }}>Total Rows</p>
                  <p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{result.totalRows}</p>
                </div>
                <div style={{ background: 'var(--m3-success-container)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--m3-success)', margin: 0 }}>Valid</p>
                  <p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0', color: 'var(--m3-success)' }}>{result.validCount}</p>
                </div>
                <div style={{ background: result.errorCount > 0 ? 'var(--m3-error-container)' : 'var(--m3-surface-container)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: result.errorCount > 0 ? 'var(--m3-error)' : 'var(--m3-on-surface-variant)', margin: 0 }}>Errors</p>
                  <p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0', color: result.errorCount > 0 ? 'var(--m3-error)' : 'var(--m3-on-surface-variant)' }}>{result.errorCount}</p>
                </div>
              </div>

              {result.errorCount > 0 && (
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #fecaca', borderRadius: 8, padding: 12, background: 'var(--m3-error-container)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--m3-error)', margin: '0 0 8px' }}>Errors — these rows will be skipped</p>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #fecaca' }}>
                      <strong>Row {e.row}:</strong>{' '}
                      {e.errors.map((err, j) => <span key={j}>{err.field} — {err.message}{j < e.errors.length - 1 ? '; ' : ''}</span>)}
                    </div>
                  ))}
                </div>
              )}

              {result.validCount === 0 && (
                <p style={{ fontSize: 13, color: 'var(--m3-error)', fontWeight: 600 }}>No valid rows to import. Fix the errors and re-upload.</p>
              )}

              <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
                {file && <span>File: <strong>{file.name}</strong></span>}
              </div>
            </>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--m3-on-surface)' }}>Importing {result?.validCount} leads…</p>
              <p style={{ fontSize: 12, color: 'var(--m3-outline)' }}>Please do not close this window.</p>
            </div>
          )}

          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--m3-success)', margin: '0 0 8px' }}>{result.message}</p>
              {result.errorCount > 0 && (
                <p style={{ fontSize: 12, color: 'var(--color-warning)' }}>{result.errorCount} row(s) were skipped due to errors.</p>
              )}
            </div>
          )}

          {err && <div style={{ background: 'var(--m3-error-container)', color: 'var(--m3-error)', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            {step === 'upload' && <button className="btn" onClick={onClose}>Cancel</button>}
            {step === 'preview' && (
              <>
                <button className="btn" onClick={() => { setStep('upload'); setFile(null); setRows([]); setResult(null); setErr(''); }} disabled={busy}>
                  ← Re-upload
                </button>
                <button className="btn btn-primary" onClick={handleImport} disabled={busy || result.validCount === 0}>
                  Import {result.validCount} Lead{result.validCount !== 1 ? 's' : ''}
                </button>
              </>
            )}
            {step === 'done' && (
              <button className="btn btn-primary" onClick={() => { onImported(); onClose(); }}>Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
