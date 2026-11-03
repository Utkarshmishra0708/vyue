// Sample data for TESTING. Safe to run more than once: every run first removes the previous sample
// rows (all tagged "[SAMPLE]" or named "Sample ...") and then recreates them. Real data is never touched.
//
//   npm run sample            create / refresh the sample data
//   npm run sample -- --clear remove the sample data only
//
// DEVELOPMENT ONLY. It refuses to run when NODE_ENV=production.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  sequelize, BusinessUnit, ServiceDefinition, User, Lead, LeadContact, ActivityLog, StageHistory, GlobalPo, Voc, VocActivity,
  Activity, ActivityTab, Contact, Campaign,
} = require('../models');
const { runMigrations } = require('./migrate');
const { assignLeadCodes } = require('../services/leadCodes');
const { recomputeAll } = require('../services/scoringEngine');
const { computeServicesTotals } = require('../services/pricing');

const TAG = '[SAMPLE]';
const TEST_PASSWORD = 'Test@1234';
const MODULE_SLUGS = ['leads', 'dashboard', 'forecast', 'reports', 'voc', 'activities', 'campaigns', 'customers'];

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const dateOnly = (n) => daysAgo(n).toISOString().slice(0, 10);
const addDays = (n) => dateOnly(-n);

// Generic, made-up customers. Each business gets the full list.
const CUSTOMERS = [
  { name: 'Acme Traders',          city: 'Mumbai',     state: 'Maharashtra', cat: 'Retail',    type: 'Standalone' },
  { name: 'Northwind Foods',       city: 'Pune',       state: 'Maharashtra', cat: 'Retail',    type: 'Standalone' },
  { name: 'Bluepeak Logistics',    city: 'Bengaluru',  state: 'Karnataka',   cat: 'Corporate Office', type: 'Standalone' },
  { name: 'Greenfield Textiles',   city: 'Surat',      state: 'Gujarat',     cat: 'Manufacturing', type: 'Standalone' },
  { name: 'Sunrise Hospitality - Delhi',  city: 'New Delhi', state: 'Delhi',  cat: 'Hotels', type: 'Part of a group', chain: 0 },
  { name: 'Sunrise Hospitality - Jaipur', city: 'Jaipur',    state: 'Rajasthan', cat: 'Hotels', type: 'Part of a group', chain: 0 },
  { name: 'Sunrise Hospitality - Goa',    city: 'Panaji',    state: 'Goa',   cat: 'Hotels', type: 'Part of a group', chain: 0 },
  { name: 'Lakeview Care Hospitals - Pune',   city: 'Pune',      state: 'Maharashtra', cat: 'Hospital', type: 'Part of a group', chain: 1 },
  { name: 'Lakeview Care Hospitals - Nagpur', city: 'Nagpur',    state: 'Maharashtra', cat: 'Hospital', type: 'Part of a group', chain: 1 },
  { name: 'Orchid Finance',        city: 'Chennai',    state: 'Tamil Nadu',  cat: 'BFSI',      type: 'Standalone' },
  { name: 'Silverline Retail',     city: 'Hyderabad',  state: 'Telangana',   cat: 'Retail',    type: 'Standalone' },
  { name: 'Harbor Engineering',    city: 'Kochi',      state: 'Kerala',      cat: 'Manufacturing', type: 'Standalone' },
  { name: 'Metro Education Trust', city: 'Kolkata',    state: 'West Bengal', cat: 'Education', type: 'Standalone' },
  { name: 'Riverstone Pharma',     city: 'Ahmedabad',  state: 'Gujarat',     cat: 'Other', type: 'Standalone' },
];
const CHAINS = [
  { name: 'Sample Sunrise Hospitality Group', total: 60, price: 42.5 },
  { name: 'Sample Lakeview Care Group',       total: 40, price: 28.0 },
];
// One scenario per customer, in order: [phase, temperature, source, new/renewal, value(L), qty, extras]
const SCENARIOS = [
  ['New',         'Cold', 'Direct Sales',    'New',       3.5,  4,  {}],
  ['Qualified',   'Warm', 'Channel Partner', 'New',       6.0,  8,  {}],
  ['Demo',        'Warm', 'Account Manager',             'New',       9.5,  10, { device: true }],
  ['Proposal',    'Hot',  'Direct Sales',    'New',       14.0, 20, { device: true }],
  ['Negotiation', 'Hot',  'Referral Partner',  'New',       22.0, 25, { device: true }],
  ['Order Expected', 'Hot',  'Channel Partner', 'New',       18.0, 15, { device: true }],
  ['Won', 'Hot',  'Account Manager',             'New',       12.0, 12, { device: true, sent: true }],
  ['Won', 'Hot',  'Direct Sales',    'New',       7.5,  6,  { device: true }],
  ['Lost',        'Cold', 'Channel Partner', 'New',       5.0,  5,  { lost: 'Price too high' }],
  ['On Hold',     'Warm', 'Direct Sales',    'New',       8.0,  7,  { hold: 'Demo' }],
  ['Won', 'Hot',  'Channel Partner', 'New',       30.0, 30, { device: true, renewalSource: true }],
  ['Negotiation', 'Warm', 'Account Manager',             'Renewal',   11.0, 9,  { renewalOfSource: true }],
  ['Qualified',   'Warm', 'Direct Sales',    'Expansion', 4.5,  5,  {}],
  ['Proposal',    'Warm', 'Channel Partner', 'New',       16.0, 14, { device: true }],
];
const STAGE_ORDER = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Order Expected', 'Won'];
const DEVICE_SKUS = ['HW-100', 'HW-200', 'HW-300', 'HW-400', 'HW-500'];

async function clearSample(t) {
  const leads = await Lead.findAll({ where: { additional_notes: { [Op.like]: `${TAG}%` } }, attributes: ['id'], transaction: t });
  const leadIds = leads.map(l => l.id);
  if (leadIds.length) {
    await LeadContact.destroy({ where: { lead_id: leadIds }, transaction: t });
    await StageHistory.destroy({ where: { lead_id: leadIds }, transaction: t });
    await ActivityLog.destroy({ where: { lead_id: leadIds }, transaction: t });
    await Activity.destroy({ where: { lead_id: leadIds }, transaction: t });
    await Lead.destroy({ where: { id: leadIds }, transaction: t });
  }
  await GlobalPo.destroy({ where: { chain_name: { [Op.like]: 'Sample %' } }, transaction: t });
  const vocs = await Voc.findAll({ where: { description: { [Op.like]: `${TAG}%` } }, attributes: ['id'], transaction: t });
  if (vocs.length) {
    await VocActivity.destroy({ where: { voc_id: vocs.map(v => v.id) }, transaction: t });
    await Voc.destroy({ where: { id: vocs.map(v => v.id) }, transaction: t });
  }
  await Activity.destroy({ where: { title: { [Op.like]: 'Sample %' } }, transaction: t });
  await ActivityTab.destroy({ where: { label: { [Op.like]: 'Sample %' } }, transaction: t });
  await Contact.destroy({ where: { notes: { [Op.like]: `${TAG}%` } }, transaction: t });
  await Campaign.destroy({ where: { description: { [Op.like]: `${TAG}%` } }, transaction: t });
  await User.destroy({ where: { email: { [Op.like]: '%.sample@example.com' } }, transaction: t });
  return leadIds.length;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to create sample data when NODE_ENV=production.');
  await runMigrations({ silent: true });
  const clearOnly = process.argv.includes('--clear');

  const removed = await sequelize.transaction(t => clearSample(t));
  if (removed) console.log(`- Removed ${removed} earlier sample lead(s) and their related rows.`);
  if (clearOnly) { console.log('Sample data cleared.'); return; }

  const units = await BusinessUnit.findAll({ where: { status: 'active' }, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  if (!units.length) throw new Error('No businesses found. Run "npm run seed" first.');
  let owner = await User.findOne({ where: { super_admin_scope: { [Op.in]: ['read', 'write'] } }, order: [['id', 'ASC']] });
  if (!owner) {
    // The seeded admin is created without the Owner (Global Admin) permission; grant it so the Owner can sign in.
    owner = await User.findOne({ where: { role: 'super_admin' }, order: [['id', 'ASC']] });
    if (owner) { owner.super_admin_scope = 'write'; await owner.save(); console.log(`- Granted Owner access to ${owner.email}.`); }
  }
  const testHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const summary = [];
  for (const bu of units) {
    const slug = bu.slug;
    const stats = { leads: 0, chains: 0, vocs: 0, cards: 0, contacts: 0, campaigns: 0 };

    // 1. Switch every module on for this business (so Customers, Feedback, Task Board, Campaigns show).
    const cfg = { ...(bu.config || {}) };
    const old = new Map((cfg.modules || []).map(m => [m.slug, m]));
    cfg.modules = MODULE_SLUGS.map(s => ({ ...(old.get(s) || {}), slug: s, enabled: true }));
    bu.config = cfg;
    bu.changed('config', true);
    await bu.save();

    // 2. Test sign-ins: a Business Admin and a Manager.
    //    (The Owner needs no account here: an Owner can enter every business.)
    const mk = async (where, defaults) => (await User.findOrCreate({ where, defaults: { ...where, ...defaults } }))[0];
    const admin = await mk({ email: `admin.${slug}.sample@example.com`, business_unit: slug },
      { name: `Sample Admin (${bu.name})`, initials: 'SA', color: 'bg-slate-700', role: 'business_admin', password_hash: testHash });
    await mk({ email: `manager.${slug}.sample@example.com`, business_unit: slug },
      { name: `Sample Manager (${bu.name})`, initials: 'SM', color: 'bg-teal-600', role: 'pmo', password_hash: testHash });
    // Sales reps for this business (seeded ones if present, otherwise two samples).
    let reps = await User.findAll({ where: { business_unit: slug, role: 'bd', active: true }, order: [['id', 'ASC']] });
    if (!reps.length) {
      reps = [];
      for (const [n, i] of [['Riya Shah', 'RS'], ['Arjun Mehta', 'AM']]) {
        reps.push(await User.create({ name: `${n} (${bu.name})`, initials: i, color: 'bg-sky-500', role: 'bd', business_unit: slug, password_hash: testHash }));
      }
    }
    const createdBy = admin.id;

    // 2b. The Inventory Pipeline only lists services tagged as hardware in the business's catalog. The
    //     seeded catalog tags none, so tag the obvious hardware items so that screen has something to show.
    const defs = await ServiceDefinition.findAll({ where: { business_unit: slug, active: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    for (const d of defs) {
      if (!d.hardware && /device|camera|display|kit|bridge/i.test(d.label)) {
        d.category = 'hardware'; d.hardware = true; await d.save(); stats.hwTagged = (stats.hwTagged || 0) + 1;
      }
    }
    const hwDefs = defs.filter(d => d.hardware);
    const swDefs = defs.filter(d => !d.hardware);

    // 3. Master orders (parent accounts)
    const chainRows = [];
    for (const c of CHAINS) {
      chainRows.push(await GlobalPo.create({
        business_unit: slug, chain_name: c.name, device_total: c.total, device_type: 'Hardware', status: 'New',
        notes: `${TAG} Parent account used for testing.`, price_lakhs: c.price,
        expected_start_date: addDays(30), expected_end_date: addDays(395), created_by: createdBy, updated_by: createdBy,
      }));
      stats.chains++;
    }

    // 4. Campaigns
    const campaigns = [];
    for (const [n, st] of [['Sample Spring Outreach', 'active'], ['Sample Partner Webinar', 'completed']]) {
      campaigns.push(await Campaign.create({
        name: n, description: `${TAG} Test campaign.`, start_date: dateOnly(60), end_date: addDays(30),
        budget_lakhs: 2.5, status: st, business_unit: slug, created_by: createdBy,
      }));
      stats.campaigns++;
    }

    // 5. Leads
    let nextSr = ((await Lead.max('sr_no')) || 0) + 1;
    const made = {};
    let sourceLeadId = null;
    for (let i = 0; i < CUSTOMERS.length; i++) {
      const cu = CUSTOMERS[i];
      const [phase, temp, source, nor, value, qty, ex] = SCENARIOS[i];
      const rep = reps[i % reps.length];
      const age = 10 + i * 6;
      const codes = await assignLeadCodes(slug, cu.name, cu.city, cu.state);
      const stageIdx = STAGE_ORDER.indexOf(phase);
      const reached = (s) => stageIdx >= STAGE_ORDER.indexOf(s);
      // Services Offered lines (the unified model). Lead 0 deliberately has none, so "Missing Deal Value" has a case.
      const lines = [];
      let hwDef = null;
      if (i !== 0) {
        if (ex.device && hwDefs.length) {
          hwDef = hwDefs[i % hwDefs.length];
          lines.push({
            category: hwDef.category === 'hardware_software' ? 'hardware_software' : 'hardware', label: hwDef.label,
            hw: { sku: DEVICE_SKUS[i % DEVICE_SKUS.length], nature: 'capex', frequency: null, rate: 8000 + value * 400, qty },
            svc: hwDef.category === 'hardware_software' ? { nature: 'opex', frequency: 'monthly', rate: 300, qty } : null,
          });
        }
        for (let k = 0; k < Math.min(2, swDefs.length); k++) {
          const d = swDefs[(i + k) % swDefs.length];
          lines.push({ category: 'software', label: d.label, hw: null, svc: { nature: 'opex', frequency: 'monthly', rate: 250 + value * 20 + k * 100, qty: Math.max(1, Math.ceil(qty / 2)) } });
        }
      }
      const totals = computeServicesTotals(lines, 12);
      const row = {
        sr_no: nextSr++, ...codes, customer_name: cu.name, owner_id: rep.id, business_unit: slug,
        property_type: cu.type, property_category: cu.cat, po_type: 'individual',
        global_po_id: cu.type === 'Part of a group' ? chainRows[cu.chain].id : null,
        city: cu.city, state: cu.state, lead_source: source,
        channel_partner_name: source === 'Channel Partner' ? 'Sample Partner Co' : null,
        kam_name: source === 'Account Manager' ? 'Sample Account Manager' : null,
        affiliate_name: source === 'Referral Partner' ? 'Sample Referral Partner' : null,
        // quantity = total hardware units (the app recalculates it this way on every save)
        new_or_renewal: nor, lead_temperature: temp, quantity: lines.reduce((n, l) => n + (l.hw ? l.hw.qty : 0), 0),
        potential_tcv_lakhs: lines.length ? totals.tcvLakhs : null, acv_lakhs: lines.length ? totals.acvLakhs : null, tcv_manual: false,
        services_json: JSON.stringify(lines), contract_period_months: 12, po_validity_months: 12,
        phase, phase_changed_at: daysAgo(Math.max(1, age - 8)), last_activity_at: daysAgo(Math.max(1, i % 5 + 1)),
        start_date: dateOnly(age + 20),
        qualified_date: reached('Qualified') ? dateOnly(age + 14) : null,
        demo_date: reached('Demo') ? dateOnly(age + 9) : null,
        proposal_date: reached('Proposal') ? dateOnly(age + 5) : null,
        negotiation_date: reached('Negotiation') ? dateOnly(age + 2) : null,
        po_expected_date: reached('Order Expected') ? addDays(10 + i) : null,
        next_followup_date: ['Lost', 'Won'].includes(phase) ? null : addDays(2 + (i % 6)),
        additional_notes: `${TAG} Test lead.`, campaign_id: campaigns[i % 2].id, created_by: rep.id, updated_by: rep.id,
      };
      if (phase === 'Won') {
        Object.assign(row, {
          po_received_date: dateOnly(age), po_number: `SAMPLE-ORD-${1000 + i}`, po_actual_value_lakhs: totals.tcvLakhs || value,
          service_start_date: dateOnly(Math.max(0, age - 5)), service_end_date: addDays(360 - age),
        });
      }
      if (phase === 'Lost') row.lost_reason = ex.lost;
      if (phase === 'On Hold') {
        Object.assign(row, { pre_hold_stage: ex.hold, hold_entered_at: daysAgo(6), hold_end_date: addDays(20), hold_frozen_confidence: 40 });
      }
      if (ex.device) row.device_requested_date = addDays(15 + i * 3);
      if (ex.sent) {
        Object.assign(row, { sent_to_scm: true, sent_to_scm_at: daysAgo(2), sent_to_scm_by: admin.name });
        if (hwDef) row.sent_to_scm_lines = { [hwDef.slug]: { sent_at: daysAgo(2).toISOString(), sent_by: admin.name } };
      }
      if (ex.renewalOfSource && sourceLeadId) row.renewed_from_lead_id = sourceLeadId;

      const lead = await Lead.create(row);
      if (ex.renewalSource) sourceLeadId = lead.id;
      made[i] = lead;
      stats.leads++;

      await LeadContact.create({ lead_id: lead.id, name: `${cu.name.split(' ')[0]} Contact`, phone: `98000${String(10000 + i * 7).slice(-5)}`, email: `contact${i}@example.com`, designation: 'Manager' });
      // Stage history: walk up to the current stage.
      const path = stageIdx >= 0 ? STAGE_ORDER.slice(0, stageIdx + 1) : ['New'];
      for (let k = 0; k < path.length; k++) {
        await StageHistory.create({ lead_id: lead.id, from_stage: k ? path[k - 1] : null, to_stage: path[k], changed_by: rep.name, changed_at: daysAgo(Math.max(1, age - k * 2)), notes: k ? null : 'Lead created' });
      }
      if (phase === 'Lost') await StageHistory.create({ lead_id: lead.id, from_stage: 'Negotiation', to_stage: 'Lost', changed_by: rep.name, changed_at: daysAgo(3), notes: ex.lost });
      await ActivityLog.create({ lead_id: lead.id, entity_type: 'lead', entity_id: lead.id, business_unit: slug, lead_sr_no: lead.sr_no, customer_name: cu.name, user_name: rep.name, user_id: rep.id, action_type: 'lead_created', note: 'New lead created' });
      if (stageIdx > 0) await ActivityLog.create({ lead_id: lead.id, entity_type: 'lead', entity_id: lead.id, business_unit: slug, lead_sr_no: lead.sr_no, customer_name: cu.name, user_name: rep.name, user_id: rep.id, action_type: 'phase_change', field_changed: 'phase', old_value: 'New', new_value: phase });

      // Customers & contacts module
      await Contact.create({ customer_name: cu.name, contact_name: `${cu.name.split(' ')[0]} Buyer`, role: 'Decision Maker', designation: 'Head of Operations', phone: `97000${String(20000 + i * 11).slice(-5)}`, email: `buyer${i}@example.com`, notes: `${TAG} Test contact.`, business_unit: slug, created_by: createdBy });
      stats.contacts++;
    }

    // 6. Customer feedback entries
    const catalogLabels = defs.map(d => d.label);   // feedback names products from this business's own services
    let vocNo = ((await Voc.max('voc_no')) || 0) + 1;
    const VOCS = [
      ['Acme Traders', 'Feature Gap', 'Deal Blocker', 'Critical', 'New', 'Needs a bulk export option.'],
      ['Bluepeak Logistics', 'Enhancement Request', 'Nice to Have', 'Low', 'Under Review', 'Wants a dark mode.'],
      ['Orchid Finance', 'Integration Requirement', 'Deal Delay', 'High', 'Planned', 'Needs accounting software integration.'],
      ['Silverline Retail', 'Performance Issue', 'Competitive Gap', 'Medium', 'In Development', 'Reports load slowly.'],
      ['Harbor Engineering', 'Commercial Gap', 'Deal Delay', 'Medium', 'Closed', 'Asked for a longer payment term.'],
    ];
    for (let k = 0; k < VOCS.length; k++) {
      const [cust, type, impact, prio, status, desc] = VOCS[k];
      const v = await Voc.create({
        voc_no: vocNo++, business_unit: slug, date_of_entry: dateOnly(5 + k * 4), customer_name: cust, total_account_value_lakhs: 10 + k * 3,
        bd_owner_id: reps[k % reps.length].id, pmo_owner: 'Sample Manager', region_state: 'Maharashtra', customer_segment: 'SMB',
        product_solution: (catalogLabels[k % Math.max(catalogLabels.length, 1)] || 'Other'), voc_type: type, description: `${TAG} ${desc}`, business_impact: impact, revenue_impact_lakhs: 2 + k,
        priority: prio, status, created_by: reps[k % reps.length].id, updated_by: reps[k % reps.length].id,
      });
      await VocActivity.create({ voc_id: v.id, user_name: reps[k % reps.length].name, action_type: 'created', note: 'Feedback logged' });
      stats.vocs++;
    }

    // 7. Task board
    const tab = await ActivityTab.create({ business_unit: slug, label: 'Sample Follow-ups', sort_order: 99, created_by: createdBy });
    const CARDS = [['to_do', 'High'], ['in_progress', 'Medium'], ['delayed', 'High'], ['blocked', 'Low'], ['completed', 'Medium'], ['to_do', 'Low']];
    for (let k = 0; k < CARDS.length; k++) {
      await Activity.create({
        business_unit: slug, tab_id: tab.id, title: `Sample task ${k + 1}`, description: 'Test task card.', status: CARDS[k][0], priority: CARDS[k][1],
        owner_name: reps[k % reps.length].name, start_date: dateOnly(10), next_followup_date: addDays(k + 1),
        lead_id: made[k].id, sort_order: k, created_by: createdBy, created_by_name: admin.name,
      });
      stats.cards++;
    }
    summary.push({ slug, name: bu.name, hw: hwDefs.length, ...stats });
  }

  const r = await recomputeAll();
  console.log(`- Confidence scores recomputed for ${r.updated}/${r.total} lead(s).`);

  console.log('\nSample data created:');
  for (const s of summary) console.log(`  ${s.name}: ${s.leads} leads, ${s.chains} master orders, ${s.contacts} contacts, ${s.campaigns} campaigns, ${s.vocs} feedback entries, ${s.cards} task cards, ${s.hw} hardware service(s) in the catalog`);
  console.log('\nTest sign-ins (the sign-in page has one form: an email or a username, and a password):');
  console.log(`  Business Admin: admin.<business>.sample@example.com   e.g. ${summary.map(s => `admin.${s.slug}.sample@example.com`).join('  |  ')}`);
  console.log(`  Manager:        manager.<business>.sample@example.com`);
  console.log(`  Password for both: ${TEST_PASSWORD}`);
  console.log(`  Sales Reps: sign in with their username (shown in Settings → Users, for example Riya.Shah) and the password ${TEST_PASSWORD}.`);
  if (owner) console.log(`  Owner: ${owner.email} (or the Owner's username) signs in once, then picks a business.`);
  console.log('\nTo remove all sample data later:  npm run sample -- --clear');
}

main().then(() => process.exit(0)).catch((e) => { console.error('Sample data failed:', e.message); process.exit(1); });
