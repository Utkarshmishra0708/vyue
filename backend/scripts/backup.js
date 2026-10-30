// Makes a full copy of the database, as a second database named <name>_backup_<date-time>, so it can
// be returned to later. Also used automatically by `npm run reset` before it deletes anything.
//
//   npm run backup              copy the database named in backend\.env
//   npm run backup -- --list    list the copies that exist
//
// To go back to a copy: set DB_NAME in backend\.env to the copy's name and restart the backend.
// (A copy keeps all tables and data. It doesn't keep the links between tables that the setup adds,
// which the app doesn't need to run.)
const path = require('path');
const env = require('dotenv').config({ path: path.join(__dirname, '..', '.env') }).parsed || {};
const mysql = require('mysql2/promise');

const SAFE_NAME = /^[A-Za-z0-9_]+$/;

async function connect() {
  return mysql.createConnection({
    host: env.DB_HOST || 'localhost', port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root', password: env.DB_PASSWORD || '',
  });
}

// Copy every table of `dbName` into a new database. Returns { name, tables, rows }, or null when
// `dbName` doesn't exist (nothing to back up).
async function backupDatabase(conn, dbName) {
  if (!SAFE_NAME.test(dbName)) throw new Error(`Unexpected database name: ${dbName}`);
  const [exists] = await conn.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = ?', [dbName]);
  if (!exists.length) return null;
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const name = `${dbName}_backup_${stamp}`;
  const [tables] = await conn.query(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'", [dbName]);
  await conn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  let rows = 0;
  try {
    for (const { t } of tables) {
      await conn.query(`CREATE TABLE \`${name}\`.\`${t}\` LIKE \`${dbName}\`.\`${t}\``);
      const [r] = await conn.query(`INSERT INTO \`${name}\`.\`${t}\` SELECT * FROM \`${dbName}\`.\`${t}\``);
      rows += r.affectedRows || 0;
    }
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }
  return { name, tables: tables.length, rows };
}

async function listBackups(conn, dbName) {
  const [rows] = await conn.query(
    'SELECT schema_name AS n FROM information_schema.schemata WHERE schema_name LIKE ? ORDER BY schema_name', [`${dbName}\\_backup\\_%`]);
  return rows.map(r => r.n);
}

if (require.main === module) {
  (async () => {
    const dbName = env.DB_NAME || 'sales_crm';
    const conn = await connect();
    try {
      if (process.argv.includes('--list')) {
        const list = await listBackups(conn, dbName);
        console.log(list.length ? `Copies of "${dbName}":\n  ${list.join('\n  ')}` : `No copies of "${dbName}" yet.`);
      } else {
        const b = await backupDatabase(conn, dbName);
        if (!b) console.log(`Database "${dbName}" doesn't exist, so there is nothing to copy.`);
        else console.log(`✓ Copied "${dbName}" to "${b.name}" (${b.tables} tables, ${b.rows} rows).\n  To go back to it: set DB_NAME=${b.name} in backend\\.env and restart the backend.`);
      }
    } finally {
      await conn.end();
    }
  })().catch(e => { console.error('Backup failed:', e.message); process.exit(1); });
}

module.exports = { backupDatabase, listBackups, connect };
