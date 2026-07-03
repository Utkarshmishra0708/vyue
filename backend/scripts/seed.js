require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, Setting, DropdownOption } = require('../models');
const { runMigrations } = require('./migrate');

const SIGNAGE_BDS = [
  { name: 'Hardik Bhagat', initials: 'HB', color: 'bg-violet-500',  sort_order: 1 },
  { name: 'Karan Amin',    initials: 'KA', color: 'bg-sky-500',     sort_order: 2 },
  { name: 'Mudit Singhal', initials: 'MS', color: 'bg-emerald-500', sort_order: 3 },
  { name: 'Rishab Mangal', initials: 'RM', color: 'bg-amber-500',   sort_order: 4 },
];
const JHES_BDS = [
  { name: 'Paras Soni', initials: 'PS', color: 'bg-orange-500', sort_order: 1 },
  { name: 'Samir Apte', initials: 'SA', color: 'bg-teal-500',   sort_order: 2 },
];

const SETTINGS_PLAIN = [
  { key_name: 'weekly_target_lakhs',   value: '5.3' },
  { key_name: 'bd_weekly_targets',     value: '{}' },
];
// Every BD starts on this password individually (own bcrypt-hashed row, not a
// shared secret) and is expected to change it after logging in.
const DEFAULT_BD_PASSWORD = '123456';

const DROPDOWNS = [
  ['phase', ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'PO Expected', 'PO Received', 'Lost', 'On Hold']],
  ['lead_source', ['Channel Partner', 'KAM', 'Direct Sales']],
  ['new_or_renewal', ['New', 'Renewal', 'Expansion']],
  ['lead_temperature', ['Hot', 'Warm', 'Cold']],
];

(async () => {
  try {
    await runMigrations({ silent: true });

    // 1. PMO admin
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    let admin = await User.findOne({ where: { email: adminEmail } });
    if (!admin) {
      const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'changeme', 10);
      admin = await User.create({
        name: process.env.SEED_ADMIN_NAME || 'PMO',
        email: adminEmail,
        password_hash: hash,
        role: 'pmo',
        business_unit: process.env.SEED_ADMIN_BU || 'signage',
        initials: 'PM',
        color: 'bg-slate-700',
      });
      console.log(`✓ Admin created: ${adminEmail}`);
    } else {
      console.log(`⋯ Admin exists: ${adminEmail}`);
    }

    // 2. BDs — each gets their own bcrypt-hashed password, defaulting to
    // DEFAULT_BD_PASSWORD. Backfills any existing BD (created before this
    // change) that still has no password_hash.
    const defaultBdHash = await bcrypt.hash(DEFAULT_BD_PASSWORD, 10);
    let backfilled = 0;
    for (const bd of [...SIGNAGE_BDS.map(b => ({ ...b, business_unit: 'signage' })), ...JHES_BDS.map(b => ({ ...b, business_unit: 'jhes' }))]) {
      const [user] = await User.findOrCreate({
        where: { name: bd.name, business_unit: bd.business_unit, role: 'bd' },
        defaults: { ...bd, role: 'bd', password_hash: defaultBdHash },
      });
      if (!user.password_hash) {
        user.password_hash = defaultBdHash;
        await user.save();
        backfilled++;
      }
    }
    console.log(`✓ BDs seeded (${SIGNAGE_BDS.length} signage, ${JHES_BDS.length} jhes)${backfilled ? ` — backfilled password for ${backfilled} existing BD(s)` : ''}, all default to "${DEFAULT_BD_PASSWORD}"`);

    // 3. Settings
    for (const s of SETTINGS_PLAIN) {
      await Setting.findOrCreate({ where: { key_name: s.key_name }, defaults: s });
    }
    console.log('✓ Settings seeded');

    // 4. Dropdowns
    for (const [field, values] of DROPDOWNS) {
      for (let i = 0; i < values.length; i++) {
        await DropdownOption.findOrCreate({
          where: { field_name: field, value: values[i] },
          defaults: { field_name: field, value: values[i], sort_order: i + 1, active: true },
        });
      }
    }
    console.log('✓ Dropdowns seeded');

    console.log('\nSeed complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();
