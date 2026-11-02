// Rescue command: set a new password for an account when nobody can do it from the screens (for example a
// forgotten Owner password). It also lifts any sign-in lock on the account.
//
//   npm run set-password -- --email you@company.com
//
// It asks for the new password twice (what you type is hidden). Run it on the computer where the app is
// installed. Whoever can run it already controls the data.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');

const MIN_LENGTH = 8;
const args = process.argv.slice(2);
const emailIdx = args.indexOf('--email');
const email = emailIdx !== -1 ? args[emailIdx + 1] : null;

// One reader for the whole run. At a real terminal what you type is shown as stars; when the input is
// piped in (for example from a script) the lines are simply read in order.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
let muted = false;
if (process.stdin.isTTY) {
  rl._writeToOutput = (str) => {
    if (!muted) return rl.output.write(str);
    return rl.output.write(/[\r\n]/.test(str) ? '\n' : '*');
  };
}
const queue = [];
let waiting = null;
let closed = false;
rl.on('line', (line) => { if (waiting) { const w = waiting; waiting = null; w(line); } else queue.push(line); });
rl.on('close', () => { closed = true; if (waiting) { const w = waiting; waiting = null; w(''); } });

function ask(question, hidden) {
  process.stdout.write(question);
  muted = !!(hidden && process.stdin.isTTY);
  return new Promise((resolve) => {
    const done = (value) => { muted = false; resolve(value); };
    if (queue.length) return done(queue.shift());
    if (closed) return done('');
    waiting = done;
  });
}

(async () => {
  if (!email || email === true || String(email).startsWith('--')) {
    console.log('Use:  npm run set-password -- --email you@company.com');
    process.exit(0);
  }
  // The email identifies the person, and one email can be on several accounts (for example older copies of
  // an Owner), so the new password is set on every account that has it.
  const users = await User.findAll({ where: { email } });
  if (!users.length) { console.error(`No account found with the email ${email}.`); process.exit(1); }
  console.log(`Setting a new password for ${users[0].name} (${email}).${users.length > 1 ? ` This email is on ${users.length} accounts; all of them get the new password.` : ''}`);
  const first = await ask('New password: ', true);
  if (first.length < MIN_LENGTH) { console.error(`That is too short. Use at least ${MIN_LENGTH} characters.`); process.exit(1); }
  const second = await ask('Type it again: ', true);
  if (first !== second) { console.error('The two passwords do not match. Nothing was changed.'); process.exit(1); }
  await User.update({ password_hash: await bcrypt.hash(first, 10), failed_login_count: 0, locked_until: null }, { where: { email } });
  console.log('✓ Password changed. The account is unlocked, and you can sign in with the new password.');
  rl.close();
  await sequelize.close();
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
