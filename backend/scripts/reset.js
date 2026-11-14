// Resets the database to a brand-new install: first saves a full copy of it (see backup.js), then
// deletes it, recreates it empty, and runs the setup (migrations) and the seed.
//
//   npm run reset -- --yes
//
// DEVELOPMENT ONLY. It refuses to run when NODE_ENV=production, or without --yes.
const path = require('path');
const { spawnSync } = require('child_process');
const env = require('dotenv').config({ path: path.join(__dirname, '..', '.env') }).parsed || {};
const { backupDatabase, connect } = require('./backup');

(async () => {
  if ((env.NODE_ENV || process.env.NODE_ENV) === 'production') {
    console.error('Refusing to reset: NODE_ENV is production.'); process.exit(1);
  }
  const dbName = env.DB_NAME || 'sales_crm';
  if (!process.argv.includes('--yes')) {
    console.log(`This deletes EVERYTHING in the database "${dbName}" and starts again as a brand-new install.`);
  console.log('A backup copy is saved first, so it can be undone.');
    console.log('To go ahead, run:  npm run reset -- --yes');
    process.exit(0);
  }
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) { console.error(`Unexpected database name: ${dbName}`); process.exit(1); }
  const conn = await connect();
  // Safety first: copy the database before deleting anything, so a mistaken reset can be undone.
  const backup = await backupDatabase(conn, dbName);
  if (backup) console.log(`✓ Backup saved as "${backup.name}" (${backup.tables} tables, ${backup.rows} rows). To go back: set DB_NAME=${backup.name} in backend\\.env and restart the backend.`);
  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
  await conn.end();
  console.log(`✓ Database "${dbName}" emptied`);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  process.exit(r.status || 0);
})().catch(e => { console.error('Reset failed:', e.message); process.exit(1); });
