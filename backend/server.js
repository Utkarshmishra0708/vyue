require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { runMigrations } = require('./scripts/migrate');

const app = express();

// --------------------------------------------------------------------------
// Global middleware — order matches reference app
// --------------------------------------------------------------------------
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Static: uploaded PO documents accessible at /uploads/<file>
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// --------------------------------------------------------------------------
// Routes — one file per resource, mounted at /api/<resource>
// --------------------------------------------------------------------------
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/leads',         require('./routes/leads'));
app.use('/api/activity-log',  require('./routes/activityLog'));
app.use('/api/stage-history', require('./routes/stageHistory'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/dropdowns',     require('./routes/dropdowns'));
app.use('/api/uploads',       require('./routes/uploads'));
app.use('/api/forecast',      require('./routes/forecast')); // public, no auth

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', at: new Date().toISOString() }));

// --------------------------------------------------------------------------
// Boot — schema is owned entirely by versioned SQL files in migrations/,
// applied in order and tracked in schema_migrations. sequelize.sync() is
// NOT used, so the DB schema always matches what's checked into git.
// --------------------------------------------------------------------------
(async () => {
  try {
    await runMigrations();

    const port = Number(process.env.PORT) || 4000;
    app.listen(port, () => console.log(`Sales CRM API listening on http://localhost:${port}`));
  } catch (err) {
    console.error('Failed to boot:', err);
    process.exit(1);
  }
})();
