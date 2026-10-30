require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, Setting, DropdownOption, BusinessUnit, SlaConfig, ServiceDefinition } = require('../models');
const { runMigrations } = require('./migrate');
const { STAGES_WITH_SLA, DEFAULT_SLA } = require('../services/scoring');

// What a brand-new install starts with: one Owner account and one neutral starter business. No people,
// partner names, device codes or products of any particular company. Safe to run again: it only
// creates what is missing, and never changes an existing business, user or list.
//
// The Owner comes from backend\.env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and SEED_ADMIN_NAME.

const STARTER_BUSINESS = {
  slug: 'my-business',
  name: 'My Business',
  description: 'Your first business. Rename it under Businesses.',
  color: '#4f46e5',
};

// A small, generic catalog so the lead form works straight away. Every item can be renamed, removed
// or re-marked under Businesses, then Edit template, Services.
const STARTER_SERVICES = [
  { slug: 'product',               label: 'Product',               category: 'hardware', nature: 'capex' },
  { slug: 'software_subscription', label: 'Software Subscription', category: 'software', nature: 'opex' },
  { slug: 'installation',          label: 'Installation',          category: 'software', nature: 'capex' },
  { slug: 'annual_maintenance',    label: 'Annual Maintenance',    category: 'software', nature: 'opex' },
];

const SETTINGS_PLAIN = [
  { key_name: 'weekly_target_lakhs', value: '5.3' },
  { key_name: 'bd_weekly_targets',   value: '{}' },
];

// The stage list is shared by every business; the other lists are kept per business.
const STAGES = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Order Expected', 'Won', 'Lost', 'On Hold'];
const PER_BUSINESS_LISTS = [
  ['lead_source',      ['Channel Partner', 'Account Manager', 'Direct Sales', 'Referral Partner']],
  ['new_or_renewal',   ['New', 'Renewal', 'Expansion']],
  ['lead_temperature', ['Hot', 'Warm', 'Cold']],
];

async function seedOption(field, bu, value, i) {
  await DropdownOption.findOrCreate({
    where: { field_name: field, business_unit: bu, value },
    defaults: { field_name: field, business_unit: bu, value, sort_order: i + 1, active: true },
  });
}

(async () => {
  try {
    await runMigrations({ silent: true });

    // 1. Starter business, only when no business exists yet (a brand-new install)
    if ((await BusinessUnit.count()) === 0) {
      await BusinessUnit.create({ ...STARTER_BUSINESS, status: 'active', sort_order: 1, config: null });
      for (const stage of STAGES_WITH_SLA) {
        await SlaConfig.create({ business_unit: STARTER_BUSINESS.slug, stage, sla_days: DEFAULT_SLA[stage] });
      }
      for (const [i, svc] of STARTER_SERVICES.entries()) {
        await ServiceDefinition.create({
          business_unit: STARTER_BUSINESS.slug, ...svc,
          hardware: svc.category === 'hardware' || svc.category === 'hardware_software', sort_order: i + 1,
        });
      }
      console.log(`✓ Starter business created: ${STARTER_BUSINESS.name} (rename it under Businesses)`);
    } else {
      console.log('⋯ Businesses already exist, none added');
    }

    // 2. Owner account
    const units = await BusinessUnit.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    const wantedBu = process.env.SEED_ADMIN_BU;
    const ownerBu = (wantedBu && units.find(u => u.slug === wantedBu)) ? wantedBu : units[0].slug;
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    let admin = await User.findOne({ where: { email: adminEmail } });
    if (!admin) {
      const name = process.env.SEED_ADMIN_NAME || 'Owner';
      const initials = name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'OW';
      admin = await User.create({
        name, email: adminEmail,
        password_hash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'changeme', 10),
        role: 'super_admin', super_admin_scope: 'write', business_unit: ownerBu,
        initials, color: 'bg-slate-700',
      });
      console.log(`✓ Owner created: ${adminEmail}`);
    } else {
      console.log(`⋯ Owner exists: ${adminEmail}`);
    }

    // 3. Settings
    for (const s of SETTINGS_PLAIN) await Setting.findOrCreate({ where: { key_name: s.key_name }, defaults: s });
    console.log('✓ Settings ready');

    // 4. Default lists: the shared stage list, and generic lists for every business
    for (const [i, stage] of STAGES.entries()) await seedOption('phase', null, stage, i);
    for (const unit of units) {
      for (const [field, values] of PER_BUSINESS_LISTS) {
        for (const [i, v] of values.entries()) await seedOption(field, unit.slug, v, i);
      }
    }
    console.log('✓ Default lists ready');

    console.log('\nSeed complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();
