const router = require('express').Router();
const { sequelize, Lead, LeadContact, ActivityLog, StageHistory, User } = require('../models');
const { authenticate, adminOnly } = require('../middleware/auth');
const { leadScopeWhere } = require('../middleware/scope');
const { Op } = require('sequelize');

router.use(authenticate);

// Phases that have their own dedicated date column on the lead.
const PHASE_DATE_MAP = {
  New: 'start_date',
  Qualified: 'qualified_date',
  Demo: 'demo_date',
  Proposal: 'proposal_date',
  Negotiation: 'negotiation_date',
  'PO Received': 'po_received_date',
};

const FIELD_LABELS = {
  customer_name: 'Customer Name', city: 'City', state: 'State', lead_source: 'Lead Source',
  channel_partner_name: 'Channel Partner', kam_name: 'KAM Name', new_or_renewal: 'New/Renewal',
  lead_temperature: 'Lead Rating', competitor: 'Competitor', quantity: 'Quantity',
  potential_tcv_lakhs: 'Potential TCV (L)', contract_period_months: 'Contract Period (Mo)',
  po_validity_months: 'PO Validity (Mo)', phase: 'Phase', next_followup_date: 'Next Follow-Up Date',
  po_expected_date: 'PO Expected Date', lost_reason: 'Lost Reason', po_actual_value_lakhs: 'Actual PO Value (L)',
  includes_platform: 'Service: Platform', platform_rate: 'Platform Rate', platform_qty: 'Platform Qty',
  includes_cms: 'Service: CMS', cms_rate: 'CMS Rate', cms_qty: 'CMS Qty',
  includes_connectivity: 'Service: Connectivity', connectivity_rate: 'Connectivity Rate', connectivity_qty: 'Connectivity Qty',
  includes_display: 'Service: Display', display_rate: 'Display Rate', display_qty: 'Display Qty',
  includes_device: 'Service: Device', device_sku: 'Device SKU', device_cost_type: 'Device Cost Type',
  device_rate: 'Device Rate', device_qty: 'Device Qty', device_requested_date: 'Device Requested Date',
  includes_amc: 'Service: AMC', amc_rate: 'AMC Rate', amc_qty: 'AMC Qty',
  includes_installation: 'Service: Installation', installation_rate: 'Installation Rate', installation_qty: 'Installation Qty',
  jhes_product: 'JHES Product', additional_notes: 'Additional Notes',
};

// Signage services and their cost nature, used to auto-calculate TCV. OPEX services bill monthly
// over the contract term; CAPEX services are one-time. Device's nature is per-lead (device_cost_type).
// Mirror of frontend SIGNAGE_SERVICES in frontend/src/utils/constants.js — keep the two in sync.
const TCV_SERVICES = [
  { key: 'platform',     nature: 'opex' },
  { key: 'cms',          nature: 'opex' },
  { key: 'connectivity', nature: 'opex' },
  { key: 'amc',          nature: 'opex' },
  { key: 'display',      nature: 'capex' },
  { key: 'installation', nature: 'capex' },
];

// Auto-calculated Total Contract Value, in lakhs (₹ / 100,000), from the ticked services:
//   OPEX  → qty × rate × contract months   (recurring)
//   CAPEX → qty × rate                      (one-time)
// Device uses its per-lead cost type (defaults to capex). Returns 0 when nothing is calculable.
// Mirror of computeTcvLakhs() in frontend/src/utils/leadHelpers.js — keep the two in sync.
function computeTcvLakhs(body) {
  const months = parseInt(body.contract_period_months, 10) || 0;
  let rupees = 0;
  const add = (included, rate, qty, nature) => {
    if (!included) return;
    const r = parseFloat(rate) || 0;
    const q = parseInt(qty, 10) || 0;
    if (!r || !q) return;
    rupees += nature === 'opex' ? r * q * months : r * q;
  };
  for (const svc of TCV_SERVICES) {
    add(body[`includes_${svc.key}`], body[`${svc.key}_rate`], body[`${svc.key}_qty`], svc.nature);
  }
  add(body.includes_device, body.device_rate, body.device_qty, body.device_cost_type === 'opex' ? 'opex' : 'capex');
  return rupees > 0 ? +(rupees / 100000).toFixed(2) : 0;
}

// Date-only helpers — deliberately avoid toISOString()/UTC conversion.
// A DATEONLY value like "2026-07-02" must mean the same calendar day
// regardless of server timezone; round-tripping through Date+toISOString
// shifts it by a day on any positive-UTC-offset server (e.g. IST), because
// "local midnight" converts to "yesterday, 18:30 UTC". We work in local
// calendar fields (getFullYear/getMonth/getDate) throughout instead.
function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDaysLocal(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateString(dt);
}

// Clamp a phase date — defense-in-depth for the "BD can adjust the phase date" business rule.
// Window is [today+2] on the high end for every phase; the low end depends on the phase:
//   * "New"   → today (a brand-new lead can't have started in the past)
//   * others  → today-2 (a phase move may have actually happened up to 2 days ago)
function clampPhaseDate(input, phase) {
  const todayStr = localDateString();
  const minStr = phase === 'New' ? todayStr : addDaysLocal(todayStr, -2);
  const maxStr = addDaysLocal(todayStr, 2);
  let val = (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) ? input : todayStr;
  if (val < minStr) val = minStr;
  if (val > maxStr) val = maxStr;
  return val;
}

// Build the persisted payload from a raw request body, applying all
// business rules server-side (quantity totals, phase-gated fields, etc).
function normalizePayload(body, { isCreate, existing }) {
  // TCV is either hand-typed (tcv_manual) or auto-calculated from the services × contract period.
  // Computing it server-side keeps the stored value authoritative regardless of the client.
  const tcvManual = !!body.tcv_manual;
  const months = parseInt(body.contract_period_months, 10) || null;
  const tcv = tcvManual ? (parseFloat(body.potential_tcv_lakhs) || 0) : computeTcvLakhs(body);
  const acv = tcv && months ? +(tcv / (months / 12)).toFixed(2) : 0;
  const phase = body.phase || 'New';

  const svcQty = (included, qty) => (included && qty) ? (parseInt(qty, 10) || 0) : 0;
  const platformQty = svcQty(body.includes_platform, body.platform_qty);
  const cmsQty = svcQty(body.includes_cms, body.cms_qty);
  const connQty = svcQty(body.includes_connectivity, body.connectivity_qty);
  const displayQty = svcQty(body.includes_display, body.display_qty);
  const deviceQty = svcQty(body.includes_device, body.device_qty);
  const amcQty = svcQty(body.includes_amc, body.amc_qty);
  const installationQty = svcQty(body.includes_installation, body.installation_qty);
  // `quantity` stays the sum of the original hardware/service lines so the device Forecast
  // (which falls back to it) is unaffected; AMC/installation counts live in their own columns.
  const totalQty = platformQty + cmsQty + connQty + displayQty + deviceQty;

  const phaseChanged = isCreate || (existing && existing.phase !== phase);
  const inactivePhase = ['PO Received', 'Lost'].includes(phase);

  const payload = {
    customer_name: body.customer_name,
    owner_id: body.owner_id,
    business_unit: body.business_unit || 'signage',
    city: body.city || null,
    state: body.state || null,
    lead_source: body.lead_source || null,
    channel_partner_name: body.lead_source === 'Channel Partner' ? (body.channel_partner_name || null) : null,
    kam_name: body.lead_source === 'KAM' ? (body.kam_name || null) : null,
    new_or_renewal: body.new_or_renewal || null,
    lead_temperature: body.lead_temperature || null,
    competitor: body.competitor || null,
    quantity: totalQty,
    potential_tcv_lakhs: tcv,
    tcv_manual: tcvManual,
    contract_period_months: months,
    po_validity_months: body.po_validity_months ? (parseInt(body.po_validity_months, 10) || null) : null,
    acv_lakhs: acv,
    contract_value_lakhs: phase === 'PO Received' ? tcv : null,
    phase,
    po_expected_date: body.po_expected_date || null,
    next_followup_date: inactivePhase
      ? null
      : (body.next_followup_date || (phaseChanged ? defaultFollowup() : (existing ? existing.next_followup_date : defaultFollowup()))),
    includes_platform: !!body.includes_platform,
    includes_cms: !!body.includes_cms,
    includes_connectivity: !!body.includes_connectivity,
    includes_display: !!body.includes_display,
    includes_device: !!body.includes_device,
    includes_amc: !!body.includes_amc,
    includes_installation: !!body.includes_installation,
    platform_rate: body.includes_platform && body.platform_rate ? parseFloat(body.platform_rate) : null,
    cms_rate: body.includes_cms && body.cms_rate ? parseFloat(body.cms_rate) : null,
    connectivity_rate: body.includes_connectivity && body.connectivity_rate ? parseFloat(body.connectivity_rate) : null,
    display_rate: body.includes_display && body.display_rate ? parseFloat(body.display_rate) : null,
    device_rate: body.includes_device && body.device_rate ? parseFloat(body.device_rate) : null,
    amc_rate: body.includes_amc && body.amc_rate ? parseFloat(body.amc_rate) : null,
    installation_rate: body.includes_installation && body.installation_rate ? parseFloat(body.installation_rate) : null,
    platform_qty: platformQty || null,
    cms_qty: cmsQty || null,
    connectivity_qty: connQty || null,
    display_qty: displayQty || null,
    device_qty: deviceQty || null,
    amc_qty: amcQty || null,
    installation_qty: installationQty || null,
    device_sku: body.includes_device ? (body.device_sku || null) : null,
    // Device cost nature: BD's choice, defaulting to capex when a device is included; null otherwise.
    device_cost_type: body.includes_device ? (body.device_cost_type === 'opex' ? 'opex' : 'capex') : null,
    device_requested_date: body.includes_device ? (body.device_requested_date || null) : null,
    jhes_product: body.business_unit === 'jhes' ? (body.jhes_product || null) : null,
    additional_notes: body.additional_notes || null,
    po_document_url: body.po_document_url !== undefined ? body.po_document_url : (existing ? existing.po_document_url : null),
    lost_reason: phase === 'Lost' ? (body.lost_reason || null) : null,
    po_actual_value_lakhs: (phase === 'PO Received' && body.po_actual_value_lakhs) ? parseFloat(body.po_actual_value_lakhs) : null,
  };

  // Phase date handling — only touched on an actual phase transition.
  if (phaseChanged) {
    const dateCol = PHASE_DATE_MAP[phase];
    const clamped = clampPhaseDate(body.phase_date, phase);
    payload.phase_changed_at = new Date(`${clamped}T12:00:00`);
    if (dateCol) payload[dateCol] = clamped;
  } else if (existing) {
    payload.phase_changed_at = existing.phase_changed_at;
  }

  return { payload, phaseChanged, fromPhase: existing ? existing.phase : null };
}

function defaultFollowup() {
  return addDaysLocal(localDateString(), 14);
}

// Diff two field sets and return one activity_log-shaped row per change.
// Sequelize returns DECIMAL columns as fixed-format strings ("12.50"), while
// the incoming request has plain JS numbers (12.5). Compare numerically when
// both sides parse as numbers, so re-saving an unchanged value never logs a
// false "changed" entry.
function valuesEqual(o, n) {
  const os = o === null || o === undefined ? '' : String(o);
  const ns = n === null || n === undefined ? '' : String(n);
  if (os === '' && ns === '') return true;
  const of = parseFloat(os), nf = parseFloat(ns);
  const bothNumeric = os !== '' && ns !== '' && !isNaN(of) && !isNaN(nf) && String(of) !== 'NaN';
  if (bothNumeric) return Math.abs(of - nf) < 0.001;
  return os === ns;
}

function diffActivity(before, after, leadId, srNo, customerName, actingUser) {
  const rows = [];
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const o = before ? before[key] : undefined;
    const n = after[key];
    const os = o === null || o === undefined ? '' : String(o);
    const ns = n === null || n === undefined ? '' : String(n);
    if (!valuesEqual(o, n)) {
      rows.push({
        lead_id: leadId, lead_sr_no: srNo, customer_name: customerName, user_name: actingUser,
        action_type: key === 'phase' ? 'phase_change' : 'field_update',
        field_changed: label, old_value: os || '(empty)', new_value: ns || '(empty)',
      });
    }
  }
  return rows;
}

// --------------------------------------------------------------------------
// GET /api/leads — list, scoped to owner for BDs, with filters
// --------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { business_unit, phase, lead_temperature, lead_source, owner_id, search, overdue } = req.query;
    const where = leadScopeWhere(req.user);
    if (business_unit) where.business_unit = business_unit;
    if (phase) where.phase = { [Op.in]: phase.split(',') };
    if (lead_temperature) where.lead_temperature = { [Op.in]: lead_temperature.split(',') };
    if (lead_source) where.lead_source = { [Op.in]: lead_source.split(',') };
    if (owner_id && req.user.role !== 'bd') where.owner_id = { [Op.in]: owner_id.split(',') };
    if (search) {
      const s = `%${search}%`;
      where[Op.or] = ['customer_name', 'city', 'state', 'competitor', 'additional_notes', 'device_sku']
        .map(f => ({ [f]: { [Op.like]: s } }));
    }
    if (overdue === 'true') {
      where.next_followup_date = { [Op.lt]: new Date() };
      where.phase = { [Op.notIn]: ['Lost', 'PO Received', 'On Hold'] };
    }

    const leads = await Lead.findAll({
      where,
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'color', 'initials'] }],
      order: [['sr_no', 'ASC']],
    });
    return res.json(leads);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// --------------------------------------------------------------------------
// GET /api/leads/:id — single lead with contacts, activity, stage history
// --------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: User, as: 'owner', attributes: ['id', 'name', 'color', 'initials'] },
        { model: LeadContact, as: 'contacts' },
        { model: ActivityLog, as: 'activity', order: [['createdAt', 'DESC']] },
        { model: StageHistory, as: 'stageHistory', order: [['changed_at', 'ASC']] },
      ],
    });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (req.user.role === 'bd' && lead.owner_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    return res.json(lead);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// --------------------------------------------------------------------------
// POST /api/leads — create
// --------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const body = { ...req.body };
    if (req.user.role === 'bd') body.owner_id = req.user.id; // BDs can only create leads for themselves

    const { payload } = normalizePayload(body, { isCreate: true });

    const maxSrNo = await Lead.max('sr_no') || 0;
    const lead = await Lead.create({ ...payload, sr_no: maxSrNo + 1, created_by: req.user.id, updated_by: req.user.id }, { transaction: t });

    // Contacts
    if (Array.isArray(body.contacts) && body.contacts.length) {
      await LeadContact.bulkCreate(
        body.contacts.map(c => ({ lead_id: lead.id, name: c.name, phone: c.phone || null, email: c.email || null, designation: c.designation || null })),
        { transaction: t }
      );
    }

    // Stage history — first entry, no "from"
    await StageHistory.create({
      lead_id: lead.id, from_stage: null, to_stage: payload.phase,
      changed_by: req.user.name, changed_at: payload.phase_changed_at || new Date(),
    }, { transaction: t });

    // Activity log — creation event
    await ActivityLog.create({
      lead_id: lead.id, lead_sr_no: lead.sr_no, customer_name: lead.customer_name,
      user_name: req.user.name, action_type: 'lead_created', note: 'New lead created',
    }, { transaction: t });

    await t.commit();
    const full = await Lead.findByPk(lead.id, { include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'color', 'initials'] }] });
    return res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: err.message });
  }
});

// --------------------------------------------------------------------------
// PUT /api/leads/:id — update
// --------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const existing = await Lead.findByPk(req.params.id, { transaction: t });
    if (!existing) { await t.rollback(); return res.status(404).json({ message: 'Lead not found' }); }
    if (req.user.role === 'bd' && existing.owner_id !== req.user.id) {
      await t.rollback();
      return res.status(403).json({ message: 'Forbidden' });
    }

    const body = { ...req.body };
    if (req.user.role === 'bd') body.owner_id = existing.owner_id; // BDs cannot reassign leads

    const before = existing.toJSON();
    const { payload, phaseChanged, fromPhase } = normalizePayload(body, { isCreate: false, existing: before });

    await existing.update({ ...payload, updated_by: req.user.id }, { transaction: t });

    // Contacts — replace-all, matching original app behavior
    if (Array.isArray(body.contacts)) {
      await LeadContact.destroy({ where: { lead_id: existing.id }, transaction: t });
      if (body.contacts.length) {
        await LeadContact.bulkCreate(
          body.contacts.map(c => ({ lead_id: existing.id, name: c.name, phone: c.phone || null, email: c.email || null, designation: c.designation || null })),
          { transaction: t }
        );
      }
    }

    if (phaseChanged) {
      await StageHistory.create({
        lead_id: existing.id, from_stage: fromPhase, to_stage: payload.phase,
        changed_by: req.user.name, changed_at: payload.phase_changed_at || new Date(),
      }, { transaction: t });
    }

    const rows = diffActivity(before, payload, existing.id, existing.sr_no, existing.customer_name, req.user.name);
    if (rows.length) await ActivityLog.bulkCreate(rows, { transaction: t });

    await t.commit();
    const full = await Lead.findByPk(existing.id, { include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'color', 'initials'] }] });
    return res.json(full);
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: err.message });
  }
});

// --------------------------------------------------------------------------
// PUT /api/leads/bulk — bulk reassign or bulk phase change (admin only)
// --------------------------------------------------------------------------
router.put('/bulk/update', adminOnly, async (req, res) => {
  try {
    const { ids, owner_id, phase } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: 'ids[] required' });

    const updates = { updated_by: req.user.id };
    if (owner_id) updates.owner_id = owner_id;
    if (phase) { updates.phase = phase; updates.phase_changed_at = new Date(); }

    await Lead.update(updates, { where: { id: { [Op.in]: ids } } });
    return res.json({ message: `Updated ${ids.length} lead(s)` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// --------------------------------------------------------------------------
// DELETE /api/leads/:id — admin only
// --------------------------------------------------------------------------
router.delete('/:id', adminOnly, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction: t });
    if (!lead) { await t.rollback(); return res.status(404).json({ message: 'Lead not found' }); }

    await LeadContact.destroy({ where: { lead_id: lead.id }, transaction: t });
    await ActivityLog.destroy({ where: { lead_id: lead.id }, transaction: t });
    await StageHistory.destroy({ where: { lead_id: lead.id }, transaction: t });
    await lead.destroy({ transaction: t });

    await t.commit();
    return res.json({ message: 'Lead deleted' });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
