// Rescue command: lift a sign-in lock when nobody can do it from the screens (for example the only Owner
// was locked out after 5 wrong passwords).
//
//   npm run unlock -- --list                 show accounts that are locked right now
//   npm run unlock -- --email you@company.com   unlock that account
//   npm run unlock -- --all                  unlock every locked account
//
// Run it on the computer where the app is installed. Whoever can run it already controls the data.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Op } = require('sequelize');
const { User, sequelize } = require('../models');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };

(async () => {
  const lockedWhere = { [Op.or]: [{ locked_until: { [Op.gt]: new Date() } }, { failed_login_count: { [Op.gt]: 0 } }] };
  if (flag('list')) {
    const rows = await User.findAll({ where: lockedWhere, attributes: ['id', 'name', 'email', 'business_unit', 'failed_login_count', 'locked_until'] });
    if (!rows.length) console.log('No accounts are locked.');
    rows.forEach(u => console.log(`  ${u.name} <${u.email || 'no email'}> in ${u.business_unit}: ${u.locked_until && u.locked_until > new Date() ? 'LOCKED until ' + u.locked_until.toLocaleString() : u.failed_login_count + ' wrong password(s) so far'}`));
  } else if (flag('all')) {
    const [n] = await User.update({ failed_login_count: 0, locked_until: null }, { where: lockedWhere });
    console.log(`✓ Unlocked ${n} account(s).`);
  } else if (typeof flag('email') === 'string') {
    const email = flag('email');
    const [n] = await User.update({ failed_login_count: 0, locked_until: null }, { where: { email } });
    console.log(n ? `✓ Unlocked ${email}.` : `No account found with the email ${email}.`);
    if (!n) process.exitCode = 1;
  } else {
    console.log('Use one of:\n  npm run unlock -- --list\n  npm run unlock -- --email you@company.com\n  npm run unlock -- --all');
  }
  await sequelize.close();
})().catch(e => { console.error('Unlock failed:', e.message); process.exit(1); });
