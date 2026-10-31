// Creates a new random secret key and saves it in backend\.env (JWT_SECRET=...).
//
//   npm run new-secret
//
// Changing the key signs everyone out: they sign in again with their normal passwords. No data and
// no passwords are affected. Restart the backend afterwards.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error(`No settings file found at ${envPath}.\nCopy .env.example to .env first, then run this again.`);
  process.exit(1);
}
const secret = crypto.randomBytes(48).toString('base64url');
const text = fs.readFileSync(envPath, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const line = `JWT_SECRET=${secret}`;
let out;
if (/^JWT_SECRET=.*$/m.test(text)) out = text.replace(/^JWT_SECRET=.*$/m, line);
else out = text.replace(/\s*$/, '') + eol + line + eol;
fs.writeFileSync(envPath, out);
console.log('✓ A new secret key was saved in backend\\.env (it is not shown here, and should never be shared).');
console.log('  Restart the backend. Everyone will need to sign in again.');
