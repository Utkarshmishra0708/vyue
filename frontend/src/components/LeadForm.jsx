import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from '../context/AuthContext';
import { createLead, updateLead, uploadPoDocument, fileUrl, getBds } from '../services/api';
import { DEVICE_SKU_MAP, LOST_REASONS, SIGNAGE_SERVICES } from '../utils/constants';
import { todayStr, addDaysStr, computeTcvLakhs, computeAcvLakhs, computeTcvBreakdown } from '../utils/leadHelpers';

const NOTES_TOOLBAR = [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']];

const PHASES = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'PO Expected', 'PO Received', 'Lost', 'On Hold'];
const SOURCES = ['Channel Partner', 'KAM', 'Direct Sales'];
const RENEWALS = ['New', 'Renewal', 'Expansion'];
const RATINGS = ['Hot', 'Warm', 'Cold'];

const emptyForm = {
  customer_name: '', owner_id: '', city: '', state: '', lead_source: '', channel_partner_name: '', kam_name: '',
  new_or_renewal: '', lead_temperature: '', competitor: '',
  includes_platform: false, platform_rate: '', platform_qty: '',
  includes_cms: false, cms_rate: '', cms_qty: '',
  includes_connectivity: false, connectivity_rate: '', connectivity_qty: '',
  includes_amc: false, amc_rate: '', amc_qty: '',
  includes_display: false, display_rate: '', display_qty: '',
  includes_installation: false, installation_rate: '', installation_qty: '',
  includes_device: false, device_sku: '', device_cost_type: 'capex', device_rate: '', device_qty: '', device_requested_date: '',
  jhes_product: '',
  potential_tcv_lakhs: '', tcv_manual: false, contract_period_months: '', po_validity_months: '',
  phase: 'New', next_followup_date: '', po_expected_date: '', lost_reason: '', po_actual_value_lakhs: '',
  additional_notes: '',
};

function Field({ label, children, required }) {
  return (
    <div>
      <label className="field-label">{label}{required && ' *'}</label>
      {children}
    </div>
  );
}

// Small tag showing a service's cost nature, so BDs can see how it feeds the TCV calc.
function NatureChip({ nature }) {
  const opex = nature === 'opex';
  return (
    <span className={`badge ${opex ? 'badge-blue' : 'badge-amber'}`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700 }}>
      {opex ? 'Opex · recurring' : 'Capex · one-time'}
    </span>
  );
}

export default function LeadForm({ lead, onSave, onCancel }) {
  const { user, isAdmin } = useAuth();
  const isJHES = user.business_unit === 'jhes';

  const [form, setForm] = useState(emptyForm);
  const [contacts, setContacts] = useState([]);
  const [bds, setBds] = useState([]);
  const [phaseChanged, setPhaseChanged] = useState(false);
  const [phaseDate, setPhaseDate] = useState(todayStr());
  const [poFile, setPoFile] = useState(null);
  const [existingPoUrl, setExistingPoUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lostOther, setLostOther] = useState('');

  useEffect(() => { getBds(user.business_unit).then(setBds).catch(() => {}); }, [user.business_unit]);

  useEffect(() => {
    if (lead) {
      setForm({
        customer_name: lead.customer_name || '', owner_id: lead.owner_id || '',
        city: lead.city || '', state: lead.state || '', lead_source: lead.lead_source || '',
        channel_partner_name: lead.channel_partner_name || '', kam_name: lead.kam_name || '',
        new_or_renewal: lead.new_or_renewal || '', lead_temperature: lead.lead_temperature || '', competitor: lead.competitor || '',
        includes_platform: !!lead.includes_platform, platform_rate: lead.platform_rate || '', platform_qty: lead.platform_qty || '',
        includes_cms: !!lead.includes_cms, cms_rate: lead.cms_rate || '', cms_qty: lead.cms_qty || '',
        includes_connectivity: !!lead.includes_connectivity, connectivity_rate: lead.connectivity_rate || '', connectivity_qty: lead.connectivity_qty || '',
        includes_amc: !!lead.includes_amc, amc_rate: lead.amc_rate || '', amc_qty: lead.amc_qty || '',
        includes_display: !!lead.includes_display, display_rate: lead.display_rate || '', display_qty: lead.display_qty || '',
        includes_installation: !!lead.includes_installation, installation_rate: lead.installation_rate || '', installation_qty: lead.installation_qty || '',
        includes_device: !!lead.includes_device, device_sku: lead.device_sku || '', device_cost_type: lead.device_cost_type || 'capex', device_rate: lead.device_rate || '',
        device_qty: lead.device_qty || '', device_requested_date: lead.device_requested_date || '',
        jhes_product: lead.jhes_product || '',
        potential_tcv_lakhs: lead.potential_tcv_lakhs || '', tcv_manual: lead.tcv_manual === undefined ? true : !!lead.tcv_manual,
        contract_period_months: lead.contract_period_months || '',
        po_validity_months: lead.po_validity_months || '',
        phase: lead.phase || 'New', next_followup_date: lead.next_followup_date || '', po_expected_date: lead.po_expected_date || '',
        lost_reason: lead.lost_reason?.startsWith('Other: ') ? 'Other' : (lead.lost_reason || ''),
        po_actual_value_lakhs: lead.po_actual_value_lakhs || '', additional_notes: lead.additional_notes || '',
      });
      setLostOther(lead.lost_reason?.startsWith('Other: ') ? lead.lost_reason.slice(7) : '');
      setContacts((lead.contacts || []).map(c => ({ name: c.name, phone: c.phone || '', email: c.email || '', designation: c.designation || '' })));
      setExistingPoUrl(lead.po_document_url || null);
      setPhaseChanged(false);
    } else {
      // JHES leads have no itemized services to auto-calc from, so they enter TCV by hand.
      setForm({ ...emptyForm, owner_id: !isAdmin ? user.id : '', next_followup_date: addDaysStr(todayStr(), 14), tcv_manual: isJHES });
      setContacts([]);
      setExistingPoUrl(null);
      setPhaseChanged(true);
      setPhaseDate(todayStr());
    }
  }, [lead, isAdmin, user]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handlePhaseChange = (newPhase) => {
    const inactive = ['PO Received', 'Lost'].includes(newPhase);
    setForm(f => ({ ...f, phase: newPhase, next_followup_date: inactive ? '' : addDaysStr(todayStr(), 14) }));
    setPhaseDate(todayStr());
    setPhaseChanged(true);
  };

  // TCV auto-calculates from the ticked services × contract period, unless the BD overrides it
  // (tcv_manual). effectiveTcv is what's shown in the field and persisted on save.
  const computedTcv = computeTcvLakhs(form);
  const effectiveTcv = form.tcv_manual ? form.potential_tcv_lakhs : computedTcv;
  const overrideTcv = () => setForm(f => ({ ...f, tcv_manual: true, potential_tcv_lakhs: computeTcvLakhs(f) }));
  const useAutoTcv = () => setForm(f => ({ ...f, tcv_manual: false }));

  // First-year ACV: OPEX is annualised over the contract term, but CAPEX (one-time) is realised in
  // full in year 1. JHES / manual-TCV leads have no service breakdown, so the whole TCV is
  // annualised evenly. Mirrors the backend ACV rule in normalizePayload().
  const acv = () => computeAcvLakhs(form, { manual: form.tcv_manual || isJHES, manualTcv: form.potential_tcv_lakhs });

  const addContact = () => setContacts(c => [...c, { name: '', phone: '', email: '', designation: '' }]);
  const updateContact = (i, key, val) => setContacts(c => c.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  const removeContact = (i) => setContacts(c => c.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        business_unit: user.business_unit,
        // In auto mode form.potential_tcv_lakhs isn't kept in sync — send the computed value.
        potential_tcv_lakhs: form.tcv_manual ? form.potential_tcv_lakhs : (computedTcv || ''),
        lost_reason: form.phase === 'Lost' && form.lost_reason === 'Other' && lostOther.trim()
          ? `Other: ${lostOther.trim()}` : form.lost_reason,
        contacts,
        phase_date: phaseChanged ? phaseDate : undefined,
        po_document_url: existingPoUrl,
      };

      let saved = lead ? await updateLead(lead.id, payload) : await createLead(payload);

      if (poFile) {
        const { url } = await uploadPoDocument(saved.id, poFile);
        saved = await updateLead(saved.id, { ...payload, po_document_url: url });
      }

      onSave(saved);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // "New" can't be backdated (a lead starts today at the earliest); every other phase move may
  // have happened up to 2 days ago. The high end is always today+2.
  const isNewPhase = form.phase === 'New';
  const minPhaseDate = isNewPhase ? todayStr() : addDaysStr(todayStr(), -2);
  const maxPhaseDate = addDaysStr(todayStr(), 2);
  const inactivePhase = ['PO Received', 'Lost'].includes(form.phase);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {error && <div className="badge badge-red" style={{ padding: '8px 12px', fontSize: 13 }}>{error}</div>}

      {/* Section 1: Lead Info */}
      <section>
        <p className="section-title">Lead Information</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Customer Name" required>
            <input required className="input" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
          </Field>
          <Field label="Lead Owner" required>
            {isAdmin ? (
              <select required className="input" value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">Select BD</option>
                {bds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <input className="input" value={user.name} readOnly disabled style={{ background: '#f8fafc' }} />
            )}
          </Field>
          <Field label="City"><input className="input" value={form.city} onChange={e => set('city', e.target.value)} /></Field>
          <Field label="State"><input className="input" value={form.state} onChange={e => set('state', e.target.value)} /></Field>
          <Field label="Lead Source" required>
            <select required className="input" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}>
              <option value="">Select</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          {form.lead_source === 'Channel Partner' && (
            <Field label="Channel Partner Name" required>
              <input required className="input" value={form.channel_partner_name} onChange={e => set('channel_partner_name', e.target.value)} />
            </Field>
          )}
          {form.lead_source === 'KAM' && (
            <Field label="KAM Name" required>
              <input required className="input" value={form.kam_name} onChange={e => set('kam_name', e.target.value)} placeholder="Key Account Manager name" />
            </Field>
          )}
          <Field label="New / Renewal" required>
            <select required className="input" value={form.new_or_renewal} onChange={e => set('new_or_renewal', e.target.value)}>
              <option value="">Select</option>
              {RENEWALS.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Lead Rating" required>
            <select required className="input" value={form.lead_temperature} onChange={e => set('lead_temperature', e.target.value)}>
              <option value="">Select</option>
              {RATINGS.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Competitor"><input className="input" value={form.competitor} onChange={e => set('competitor', e.target.value)} placeholder="Optional" /></Field>
        </div>
      </section>

      {/* Section 2: Services / Product — right after Competitor */}
      {isJHES ? (
        <section>
          <p className="section-title">Product</p>
          <Field label="Product Name">
            <input className="input" value={form.jhes_product} onChange={e => set('jhes_product', e.target.value)} placeholder="e.g. C2Av2" />
          </Field>
        </section>
      ) : (
        <section>
          <p className="section-title">Services Offered</p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '-6px 0 10px' }}>
            Tick each service, then enter its unit rate and quantity. <b>Opex</b> is recurring (billed monthly over the contract);
            <b> Capex</b> is one-time. These feed the auto-calculated TCV below.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SIGNAGE_SERVICES.map(svc => {
              const on = form[`includes_${svc.key}`];
              return (
                <div key={svc.key} className="card-sm" style={{ borderColor: on ? '#c7d2fe' : '#e2e8f0', background: on ? '#eef2ff' : '#fff' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={on} onChange={e => {
                      set(`includes_${svc.key}`, e.target.checked);
                      if (!e.target.checked) { set(`${svc.key}_rate`, ''); set(`${svc.key}_qty`, ''); }
                    }} />
                    {svc.label}
                    <NatureChip nature={svc.nature} />
                  </label>
                  {on && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <Field label={svc.nature === 'opex' ? 'Unit Rate (₹/month)' : 'Unit Rate (₹, one-time)'}>
                        <input type="number" step="0.01" min="0" className="input" value={form[`${svc.key}_rate`]} onChange={e => set(`${svc.key}_rate`, e.target.value)} />
                      </Field>
                      <Field label="Quantity" required><input required type="number" min="1" className="input" value={form[`${svc.key}_qty`]} onChange={e => set(`${svc.key}_qty`, e.target.value)} /></Field>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="card-sm" style={{ borderColor: form.includes_device ? '#c7d2fe' : '#e2e8f0', background: form.includes_device ? '#eef2ff' : '#fff' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={form.includes_device} onChange={e => {
                  set('includes_device', e.target.checked);
                  if (e.target.checked) { if (!form.device_cost_type) set('device_cost_type', 'capex'); }
                  else { set('device_sku', ''); set('device_rate', ''); set('device_qty', ''); set('device_requested_date', ''); set('device_cost_type', 'capex'); }
                }} />
                Device
                <NatureChip nature={form.device_cost_type === 'opex' ? 'opex' : 'capex'} />
              </label>
              {form.includes_device && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <Field label="Cost Type" required>
                    <div style={{ display: 'flex', gap: 18 }}>
                      {[['capex', 'Capex (one-time)'], ['opex', 'Opex (recurring)']].map(([ct, lbl]) => (
                        <label key={ct} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                          <input type="radio" name="device_cost_type" checked={(form.device_cost_type || 'capex') === ct} onChange={() => set('device_cost_type', ct)} />
                          {lbl}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Device SKU" required>
                      <select required className="input" value={form.device_sku} onChange={e => set('device_sku', e.target.value)}>
                        <option value="">Select SKU</option>
                        {Object.keys(DEVICE_SKU_MAP).map(sku => <option key={sku}>{sku}</option>)}
                      </select>
                    </Field>
                    {form.device_sku && <Field label="Device Type"><input className="input" readOnly disabled value={DEVICE_SKU_MAP[form.device_sku]} style={{ background: '#f8fafc' }} /></Field>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label={form.device_cost_type === 'opex' ? 'Unit Rate (₹/month)' : 'Unit Rate (₹, one-time)'}><input type="number" step="0.01" min="0" className="input" value={form.device_rate} onChange={e => set('device_rate', e.target.value)} /></Field>
                    <Field label="Quantity" required><input required type="number" min="1" className="input" value={form.device_qty} onChange={e => set('device_qty', e.target.value)} /></Field>
                  </div>
                  <Field label="Device Requested Date">
                    <input type="date" className="input" value={form.device_requested_date} onChange={e => set('device_requested_date', e.target.value)} />
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>When the BD requested these devices — used in the Forecast Dashboard.</p>
                  </Field>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 3: Deal Size — Contract Period first, since the auto-calculated TCV depends on it */}
      <section>
        <p className="section-title">Deal Size</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Contract Period (Months)" required><input required type="number" min="1" className="input" value={form.contract_period_months} onChange={e => set('contract_period_months', e.target.value)} /></Field>
          <Field label="Potential TCV (Lakhs)" required>
            {isJHES ? (
              <input required type="number" step="0.01" min="0" className="input" value={form.potential_tcv_lakhs} onChange={e => set('potential_tcv_lakhs', e.target.value)} />
            ) : (
              <>
                <input
                  required type="number" step="0.01" min="0" className="input"
                  value={effectiveTcv}
                  readOnly={!form.tcv_manual}
                  onChange={e => set('potential_tcv_lakhs', e.target.value)}
                  style={!form.tcv_manual ? { background: '#f8fafc', color: '#334155' } : undefined}
                  title={!form.tcv_manual ? 'Auto-calculated — click Override to edit' : undefined}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {form.tcv_manual ? (
                    <>
                      <button type="button" className="btn btn-sm" onClick={useAutoTcv}>↻ Use auto-calc</button>
                      {computedTcv !== '' && <span style={{ fontSize: 11, color: '#94a3b8' }}>Auto-calc: ₹{computedTcv} L</span>}
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-sm" onClick={overrideTcv}>✎ Override</button>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {computedTcv === ''
                          ? 'Auto-calc: add services with rate & quantity (and contract period), or Override to type a value.'
                          : 'Auto-calculated from services × contract period.'}
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </Field>
          <Field label="PO Validity (Months)">
            <input type="number" min="1" className="input" value={form.po_validity_months} onChange={e => set('po_validity_months', e.target.value)} />
          </Field>
        </div>
        {acv() !== null && (
          <div className="badge badge-blue" style={{ marginTop: 10, padding: '6px 12px' }}>
            First-Year ACV: ₹{acv()} L/yr
            {!form.tcv_manual && !isJHES && computeTcvBreakdown(form).capexLakhs > 0 && (
              <span style={{ marginLeft: 6, fontWeight: 500 }}>· incl. one-time CAPEX in year 1</span>
            )}
          </div>
        )}
      </section>

      {/* Section 4: Phase & Timeline */}
      <section>
        <p className="section-title">Phase & Timeline</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Current Phase" required>
            <select required className="input" value={form.phase} onChange={e => handlePhaseChange(e.target.value)}>
              {PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          {!inactivePhase && (
            <Field label="Next Follow-Up Date">
              <input type="date" className="input" value={form.next_followup_date} onChange={e => set('next_followup_date', e.target.value)} />
            </Field>
          )}
          {phaseChanged && (
            <Field label={`"${form.phase}" Date ${isNewPhase ? '(today to +2 days)' : '(±2 days)'}`}>
              <input type="date" className="input" value={phaseDate} min={minPhaseDate} max={maxPhaseDate} onChange={e => setPhaseDate(e.target.value)} />
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {isNewPhase
                  ? 'Defaults to today. A new lead can be dated today up to 2 days ahead.'
                  : 'Defaults to today. Adjust ±2 days if this phase actually happened earlier or later.'}
              </p>
            </Field>
          )}
          {form.phase === 'Lost' && (
            <Field label="Lost Reason" required>
              <select required className="input" value={form.lost_reason} onChange={e => set('lost_reason', e.target.value)}>
                <option value="">Select reason</option>
                {LOST_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
              {form.lost_reason === 'Other' && (
                <textarea className="input" rows={2} style={{ marginTop: 8, resize: 'none' }} value={lostOther} onChange={e => setLostOther(e.target.value)} placeholder="Please describe the reason…" />
              )}
            </Field>
          )}
          {form.phase === 'PO Received' && (
            <Field label="Actual PO Value (Lakhs)">
              <input type="number" step="0.01" min="0" className="input" value={form.po_actual_value_lakhs} onChange={e => set('po_actual_value_lakhs', e.target.value)} />
            </Field>
          )}
          <Field label="PO Expected Date">
            <input type="date" className="input" value={form.po_expected_date} onChange={e => set('po_expected_date', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Section 5: Contacts */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="section-title" style={{ margin: 0 }}>Contacts</p>
          <button type="button" className="btn btn-sm" onClick={addContact}>+ Add Contact</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {contacts.map((c, i) => (
            <div key={i} className="card-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <Field label="Name"><input className="input" value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} /></Field>
              <Field label="Phone"><input className="input" value={c.phone} onChange={e => updateContact(i, 'phone', e.target.value)} /></Field>
              <Field label="Email"><input className="input" value={c.email} onChange={e => updateContact(i, 'email', e.target.value)} /></Field>
              <Field label="Designation"><input className="input" value={c.designation} onChange={e => updateContact(i, 'designation', e.target.value)} /></Field>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeContact(i)}>✕</button>
            </div>
          ))}
          {contacts.length === 0 && <p style={{ fontSize: 12, color: '#94a3b8' }}>No contacts added yet.</p>}
        </div>
      </section>

      {/* Section 6: PO Document */}
      <section>
        <p className="section-title">PO Document</p>
        {existingPoUrl && !poFile && (
          <div className="badge badge-green" style={{ marginBottom: 8, padding: '6px 12px' }}>
            <a href={fileUrl(existingPoUrl)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>📄 View uploaded document</a>
          </div>
        )}
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setPoFile(e.target.files[0] || null)} />
      </section>

      {/* Section 7: Notes */}
      <section>
        <p className="section-title">Additional Notes</p>
        <ReactQuill
          theme="snow"
          value={form.additional_notes}
          onChange={val => set('additional_notes', val)}
          modules={{ toolbar: NOTES_TOOLBAR }}
          style={{ background: '#fff' }}
        />
      </section>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : (lead ? 'Save Changes' : 'Create Lead')}</button>
      </div>
    </form>
  );
}
