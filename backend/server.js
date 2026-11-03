// Settings come from backend\.env (found by its path, so the server can be started from any folder).
// On a hosted site the same names are set in the host's own settings instead of a file.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const { runMigrations } = require('./scripts/migrate');
const { jwtSecretProblem, corsOptions, corsProblem } = require('./config/security');

const app = express();

// --------------------------------------------------------------------------
// Global middleware — order matches reference app
// --------------------------------------------------------------------------
// Only the websites listed in CORS_ORIGINS (and, while developing, pages on this computer) may call
// the API from a browser. See config/security.js.
app.use(cors(corsOptions()));
app.use(express.json({ limit: '50mb' }));

// Static: uploaded order documents, available at /uploads/<file>.
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// --------------------------------------------------------------------------
// Routes — one file per resource, mounted at /api/<resource>.
// --------------------------------------------------------------------------
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/business-units', require('./routes/businessUnits'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/leads',         require('./routes/leads'));
app.use('/api/global-pos',    require('./routes/globalPos'));
app.use('/api/voc',           require('./routes/voc'));
app.use('/api/activity-log',  require('./routes/activityLog'));
app.use('/api/stage-history', require('./routes/stageHistory'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/sla',           require('./routes/sla'));
app.use('/api/dropdowns',     require('./routes/dropdowns'));
app.use('/api/uploads',       require('./routes/uploads'));
app.use('/api/forecast',      require('./routes/forecast')); // public, no auth
app.use('/api/activities',    require('./routes/activities'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/contacts',      require('./routes/contacts'));
app.use('/api/campaigns',     require('./routes/campaigns'));
app.use('/api/search',        require('./routes/search'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/change-log',    require('./routes/changeLog'));

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', at: new Date().toISOString() }));

// --------------------------------------------------------------------------
// Boot — schema is owned entirely by versioned SQL files in migrations/, applied in order and
// tracked in schema_migrations. sequelize.sync() is NOT used, so the DB schema always matches
// what's checked into git.
//
// Migrations run and the port is bound only when this file is started directly (`npm run dev`);
// `module.exports = app` below lets tests and other tools load the app without starting it.
// In production, prefer running `npm run migrate` once during deploy.
// --------------------------------------------------------------------------
if (require.main === module) {
  // Refuse to start with an unsafe setup, and say how to fix it.
  const problems = [
    jwtSecretProblem(process.env.JWT_SECRET) && `${jwtSecretProblem(process.env.JWT_SECRET)}\n  Fix: run  npm run new-secret  and start the backend again.`,
    corsProblem(),
  ].filter(Boolean);
  if (problems.length) {
    console.error('\nThe server was not started:\n');
    problems.forEach(p => console.error(`  - ${p}`));
    console.error('');
    process.exit(1);
  }
  (async () => {
    try {
      await runMigrations();

      // One-time: convert bd_weekly_targets from name-keyed to id-keyed (P3-2c, issue 39).
      const { Setting, User: UserBoot } = require('./models');
      const bdtRow = await Setting.findByPk('bd_weekly_targets');
      if (bdtRow && bdtRow.value && bdtRow.value !== '{}') {
        try {
          const obj = JSON.parse(bdtRow.value);
          const keys = Object.keys(obj);
          const hasNameKey = keys.some(k => !/^\d+$/.test(k));
          if (hasNameKey) {
            const allUsers = await UserBoot.findAll({ attributes: ['id', 'name'], where: { active: true } });
            const nameToId = {};
            for (const u of allUsers) {
              const n = String(u.name).trim();
              if (!nameToId[n]) nameToId[n] = String(u.id);
            }
            const converted = {};
            for (const [k, v] of Object.entries(obj)) {
              if (/^\d+$/.test(k)) { converted[k] = v; continue; }
              const uid = nameToId[k];
              if (uid) { converted[uid] = v; }
              else { console.log(`[bd_targets] no active user found for name "${k}" — target dropped`); }
            }
            bdtRow.value = JSON.stringify(converted);
            await bdtRow.save();
            console.log(`[bd_targets] converted name-keyed targets to id-keyed`);
          }
        } catch (e) { console.error('[bd_targets] conversion error:', e.message); }
      }

      // People created before usernames existed get theirs now (in the order they were created).
      const { User: UserModel } = require('./models');
      const madeUsernames = await require('./services/username').ensureUsernames(UserModel, await require('./services/ownerSession').ownerCopyIds(UserModel));
      if (madeUsernames) console.log(`[usernames] created ${madeUsernames} username(s)`);

      // Assign customer_code / lead_ref to any leads missing them (one-time, idempotent).
      const { backfillLeadCodes } = require('./services/leadCodes');
      await backfillLeadCodes();

      // Lead Confidence Scoring runs with no manual intervention: recompute once on boot, then hourly,
      // to apply time-based SLA decay. (Every lead save also recomputes itself — event-triggered.) In
      // production, prefer an external cron running `npm run recompute` instead of this interval.
      const { recomputeAll } = require('./services/scoringEngine');
      const runScoring = () => recomputeAll()
        .then(r => console.log(`[scoring] recomputed ${r.updated}/${r.total} lead(s)`))
        .catch(e => console.error('[scoring] recompute failed:', e.message));
      await runScoring();
      setInterval(runScoring, 60 * 60 * 1000).unref();

      const { startScheduler } = require('./services/notifications/scheduler');
      startScheduler();

      const port = Number(process.env.PORT) || 4000;
      app.listen(port, () => console.log(`Sales CRM API listening on http://localhost:${port}`));
    } catch (err) {
      console.error('Failed to boot:', err);
      process.exit(1);
    }
  })();
}

module.exports = app;
