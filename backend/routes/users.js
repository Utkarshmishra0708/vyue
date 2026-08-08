const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Lead } = require('../models');
const { authenticate, adminOnly } = require('../middleware/auth');

const COLOR_ROTATION = ['bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500'];
const DEFAULT_BD_PASSWORD = '123456'; // system default — the BD is expected to change it after first login

// === JIOAUTIFY INTEGRATION: provisioning a portal-facing Sales CRM user (one with an email — i.e.
// an admin/pmo who signs in via the STB portal's SSO) must ALSO register that user in the central
// Jio STB store (userlogin + AccessControl) and grant the Sales CRM module — exactly like Jio
// Inventory (module 20) and Release Planner (module 21) do. Sales CRM is module_code 22 (see the
// `modules` table + the AccessControl `Sales_CRM` column added during setup — see SALESCRM setup
// notes). The STB registration router is require()d in-process because this app is mounted inside
// the STB backend in production; in dev the require is skipped so the standalone server still boots
// without the STB tree present. BD accounts (no email) are NOT portal users, so they never trigger
// this. Set STB_MODULE_CODE in .env if the allocated id differs from 22. ===
const SALES_CRM_MODULE_CODE = Number(22);
const externalService = process.env.NODE_ENV === 'production'
  ? require('../../../src/routers/registrationRoute.js')
  : null;

// Mirror of Jio Inventory / Release Planner callModuleAccessAPI: swap req.body to the module
// payload and run the STB module-access handler through captureResponse, which returns
// {statusCode, ...} without sending.
function callModuleAccessAPI(modulePayload, req, res) {
  req.body = modulePayload;
  return externalService.captureResponse(externalService.userAdditionFromJioTcm, req, res);
}

// === JIOAUTIFY INTEGRATION — cross-business-unit aggregation ================================
// In sales_crm.users the SAME person (same email) may hold TWO rows: one for `signage` and one for
// `jhes` (email is unique PER business_unit — see migration 002). jioautify / AccessControl, however,
// tracks Sales CRM access by EMAIL ONLY — a single central record per email. So the central state
// must be the UNION across every row that shares the email, otherwise an add/edit/disable/delete in
// one business unit overwrites (and wrongly toggles) the access the user still holds via the other.
//
// aggregateModulePayload builds that union from a projected list of the person's rows (each
// `{ active, role }`) — the list already reflects the pending operation (row added / role or active
// changed / row removed):
//   - module_access 'true' if the user is active in ANY business unit; 'false' only when disabled
//     (or absent) in ALL of them;
//   - module_admin  'true' if the user is a PMO in ANY business unit where they are still active.
// For a person who exists in only one business unit this reduces to that single row's state, i.e. the
// same result as calling the API directly for that row.
function aggregateModulePayload(email, mobile, rows) {
  const activeRows = rows.filter(r => r.active);
  return {
    email,
    mobile,
    module_code: SALES_CRM_MODULE_CODE,
    module_access: activeRows.length ? 'true' : 'false',
    module_admin: activeRows.some(r => r.role === 'pmo') ? 'true' : 'false',
  };
}

// All sales_crm.users rows sharing an email (the person's jioautify identity), across business units.
// Returns a lightweight projection used only to compute the aggregate central state.
function rowsForEmail(email) {
  return User.findAll({ where: { email }, attributes: ['id', 'active', 'role', 'business_unit'] });
}

// The "Unassigned" placeholder BD holds leads orphaned when a BD is deleted. One per business unit,
// created on demand. It has no password (cannot log in) and is inactive, so it stays out of the login
// list and BD dropdowns while still showing as the owner on the transferred leads.
async function getOrCreateUnassignedBd(businessUnit) {
  let u = await User.findOne({ where: { name: 'Unassigned', role: 'bd', business_unit: businessUnit } });
  if (!u) {
    u = await User.create({
      name: 'Unassigned', email: null, mobile: null, password_hash: null, role: 'bd',
      business_unit: businessUnit, initials: 'UN', color: 'bg-slate-500', active: false, sort_order: 999,
    });
  }
  return u;
}

// Push one aggregated payload to jioautify. On failure it SENDS the 400 response and returns false so
// the caller can `if (!(await syncCentralAccess(...))) return;` and skip the local write. On success
// it returns true without sending.
async function syncCentralAccess(payload, req, res, phase) {
  try {
    const response = await callModuleAccessAPI(payload, req, res);
    if (!response || response.statusCode !== 200) {
      res.status(400).json({ message: (response && response.message) || 'Jio STB module access API failed' });
      return false;
    }
    return true;
  } catch (apiError) {
    console.error(`STB MODULE ACCESS ERROR (${phase}):`, apiError.message);
    res.status(400).json({ message: 'Jio STB module access API failed' });
    return false;
  }
}

// GET /api/users — list users. Used by the login page to show BD cards.
// Query params: role, business_unit
// Public-ish read (no auth) so the login screen can render BDs.
router.get('/', async (req, res) => {
  try {
    const where = { active: true };
    if (req.query.role)          where.role = req.query.role;
    if (req.query.business_unit) where.business_unit = req.query.business_unit;

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password_hash', 'email'] }, // never leak these to unauthenticated callers
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/users/manage — admin/PMO only. Full user records (BD + PMO) for a business unit, used by
// the Settings page to list, edit and manage the team. Unlike the public GET /, this includes email
// and mobile because the caller is an authenticated admin.
router.get('/manage', authenticate, adminOnly, async (req, res) => {
  try {
    // Include inactive (disabled) users too, so the Settings page can re-enable them.
    const where = { role: ['super_admin', 'business_admin', 'pmo', 'bd', 'forecast'] };
    // Non-super-admins only ever see their own business's users. super_admin may switch business via
    // the business_unit query param (defaulting to their own).
    where.business_unit = req.user.role === 'super_admin' ? (req.query.business_unit || req.user.business_unit) : req.user.business_unit;
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [['role', 'ASC'], ['sort_order', 'ASC'], ['name', 'ASC']],
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Validate the add/edit payload shared by POST and PUT. Returns an error string or null.
// Roles that can be created/edited through the UI (super_admin is set up out-of-band — one for now).
const VALID_ROLES = ['business_admin', 'pmo', 'bd', 'forecast'];
function validateUserPayload({ name, email, mobile, role }) {
  if (!name || !name.trim())   return 'Name is required';
  if (!email || !email.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email';
  if (!mobile || !mobile.trim()) return 'Mobile is required';
  if (!/^\d{10}$/.test(mobile.trim())) return 'Mobile must be exactly 10 digits';
  if (!VALID_ROLES.includes(role)) return 'Role must be Business Admin, PMO, BD or Forecast';
  return null;
}

// Role hierarchy — which roles each admin-tier actor may create/edit/delete/manage.
//   super_admin    → Business Admin, PMO, BD, Forecast (in ANY business)
//   business_admin → PMO, BD, Forecast (their business)
//   pmo            → BD only (their business)
const ASSIGNABLE_ROLES = {
  super_admin:    ['business_admin', 'pmo', 'bd', 'forecast'],
  business_admin: ['pmo', 'bd', 'forecast'],
  pmo:            ['bd'],
};
const canManageRole = (actorRole, targetRole) => (ASSIGNABLE_ROLES[actorRole] || []).includes(targetRole);

// The business a created user lands in: super_admin may target any business; everyone else is confined
// to their own.
const resolveBusinessUnit = (actor, requestedBu) => (actor.role === 'super_admin' ? (requestedBu || actor.business_unit) : actor.business_unit);

// Can `actor` manage the existing `target` user? Must be allowed by the role hierarchy AND (unless the
// actor is super_admin) within the actor's own business.
function canActOn(actor, target) {
  if (!canManageRole(actor.role, target.role)) return false;
  if (actor.role !== 'super_admin' && target.business_unit !== actor.business_unit) return false;
  return true;
}

// POST /api/users — admin/PMO only. Add a user. Body: { name, email, mobile, role, business_unit }.
// role is 'pmo' (main admin, portal/SSO login) or 'bd' (user). All fields are mandatory.
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, email, mobile, role } = req.body;
    const business_unit = resolveBusinessUnit(req.user, req.body.business_unit);
    if (!business_unit) return res.status(400).json({ message: 'business_unit is required' });
    const invalid = validateUserPayload({ name, email, mobile, role });
    if (invalid) return res.status(400).json({ message: invalid });
    if (!canManageRole(req.user.role, role)) return res.status(403).json({ message: `You are not allowed to create a ${role} account.` });

    // Email is unique per business unit (see migration 002).
    const clash = await User.findOne({ where: { email: email.trim(), business_unit } });
    if (clash) return res.status(409).json({ message: `A ${business_unit} user with email ${email.trim()} already exists` });

    // === JIOAUTIFY INTEGRATION: both BD and PMO are portal-facing Sales CRM users, so register them
    // in the central STB store and grant the Sales CRM module (code 22) BEFORE creating the local
    // record — only persist locally if the central update succeeds, exactly like Jio Inventory /
    // Release Planner. The payload is the UNION across business units: the new (active) row plus any
    // existing row this email already holds in the OTHER business unit, so creating a signage account
    // for someone who is already a jhes admin keeps their admin/access intact. ===
    if (process.env.NODE_ENV === 'production') {
      const siblings = await rowsForEmail(email.trim()); // rows in the other business unit (same-BU clash already rejected)
      const projected = siblings.map(r => ({ active: r.active, role: r.role }))
        .concat([{ active: true, role }]); // the row about to be created
      const payload = aggregateModulePayload(email.trim(), mobile.trim(), projected);
      if (!(await syncCentralAccess(payload, req, res, 'create'))) return;
    }

    const count = await User.count({ where: { business_unit, role } });
    const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const color = COLOR_ROTATION[count % COLOR_ROTATION.length];
    const maxOrder = (await User.max('sort_order', { where: { business_unit, role } })) || 0;
    const password_hash = await bcrypt.hash(DEFAULT_BD_PASSWORD, 10);

    const created = await User.create({
      name: name.trim(), email: email.trim(), mobile: mobile.trim(), business_unit, role,
      initials, color, sort_order: maxOrder + 1, active: true, password_hash,
    });
    const safe = created.toJSON();
    delete safe.password_hash;
    return res.status(201).json({ ...safe, defaultPassword: DEFAULT_BD_PASSWORD });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id — admin/PMO only. Edit a user's name, email, mobile and role.
// Does not change the password (use reset-password for that).
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, email, mobile, role } = req.body;
    const invalid = validateUserPayload({ name, email, mobile, role });
    if (invalid) return res.status(400).json({ message: invalid });

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const isSelf = String(user.id) === String(req.user.id);
    // Anyone can edit their own profile (but not their own role, below); managing others follows the
    // role hierarchy.
    if (!isSelf && !canActOn(req.user, user)) return res.status(403).json({ message: 'You are not allowed to manage this user.' });
    if (!isSelf && role !== user.role && !canManageRole(req.user.role, role)) return res.status(403).json({ message: `You are not allowed to assign the ${role} role.` });

    // A user cannot change their own role.
    if (isSelf && role !== user.role) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    // Email stays unique per business unit — reject a clash with a *different* user.
    const clash = await User.findOne({ where: { email: email.trim(), business_unit: user.business_unit } });
    if (clash && clash.id !== user.id) {
      return res.status(409).json({ message: `Another ${user.business_unit} user already uses ${email.trim()}` });
    }

    // === JIOAUTIFY INTEGRATION: mirror the edit into the central Jio STB store (Sales CRM module 22)
    // BEFORE persisting locally — only persist if the central update succeeds. Edit only changes this
    // ONE row's role/email (not its active flag), so both affected emails are recomputed as the UNION
    // across their business units:
    //  - the NEW email's aggregate = its other-BU rows + this edited row (active unchanged, new role);
    //  - if the email CHANGED, the OLD email's aggregate is recomputed from whatever rows remain under
    //    it (revoked only if none remain / all disabled). This prevents a role change or email move in
    //    one business unit from clobbering the access the person still holds in the other.
    // Read the current identity from `user` BEFORE mutating it below. ===
    if (process.env.NODE_ENV === 'production') {
      const oldEmail = user.email;
      const newEmail = email.trim();

      // NEW email: its rows in other business units, plus this row with its (unchanged) active state
      // and the new role. Exclude this row from the fetched set so we don't double-count it.
      const newRows = (await rowsForEmail(newEmail))
        .filter(r => r.id !== user.id)
        .map(r => ({ active: r.active, role: r.role }))
        .concat([{ active: user.active, role }]);
      if (!(await syncCentralAccess(aggregateModulePayload(newEmail, mobile.trim(), newRows), req, res, 'edit'))) return;

      // OLD email (only when the email changed): recompute from the rows that remain under it, i.e.
      // everything except this row (which is moving to newEmail).
      if (oldEmail !== newEmail) {
        const oldRows = (await rowsForEmail(oldEmail))
          .filter(r => r.id !== user.id)
          .map(r => ({ active: r.active, role: r.role }));
        if (!(await syncCentralAccess(aggregateModulePayload(oldEmail, user.mobile, oldRows), req, res, 'edit-old'))) return;
      }
    }

    // Persist via an explicit UPDATE (see the active handler) so the write does not depend on the
    // in-memory instance's dirty-tracking after the preceding STB call path.
    const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    await User.update(
      { name: name.trim(), email: email.trim(), mobile: mobile.trim(), role, initials },
      { where: { id: user.id } },
    );

    const updated = await User.findByPk(user.id);
    const safe = updated.toJSON();
    delete safe.password_hash;
    return res.json(safe);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/reset-password — admin/PMO only. Resets a BD's forgotten
// password to a value PMO chooses. Body: { newPassword }
router.put('/:id/reset-password', authenticate, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'bd') return res.status(400).json({ message: 'Only BD accounts can be reset here' });
    if (!canActOn(req.user, user)) return res.status(403).json({ message: 'You are not allowed to manage this user.' });

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: `Password reset for ${user.name}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/active — admin/PMO only. Enable or disable (soft) a BD or PMO. A disabled user
// keeps all their data and leads but can no longer log in or appear in the login list. Body:
// { active: true|false }. You cannot disable your own account.
router.put('/:id/active', authenticate, adminOnly, async (req, res) => {
  try {
    const active = !!req.body.active;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!canActOn(req.user, user)) return res.status(403).json({ message: 'You are not allowed to manage this user.' });
    if (!active && String(user.id) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot disable your own account' });
    }

    // === JIOAUTIFY INTEGRATION: mirror the enable/disable into the central Jio STB store (Sales CRM
    // module 22) BEFORE persisting locally — only persist if the central update succeeds. The central
    // record is shared across business units, so send the UNION: flip THIS row's active flag in the
    // projected set and recompute. Disabling here only revokes central access when the user ends up
    // disabled in EVERY business unit; if they are still active in the other, access stays enabled
    // (and admin stays enabled if they are a PMO there). ===
    if (process.env.NODE_ENV === 'production') {
      const projected = (await rowsForEmail(user.email))
        .map(r => (r.id === user.id ? { active, role: r.role } : { active: r.active, role: r.role }));
      const payload = aggregateModulePayload(user.email, user.mobile, projected);
      if (!(await syncCentralAccess(payload, req, res, 'active'))) return;
    }

    // Persist via an explicit UPDATE rather than instance .save() so the write does not depend on
    // Sequelize's dirty-tracking of the in-memory instance (which the preceding STB call path can
    // leave stale).
    await User.update({ active }, { where: { id: user.id } });
    return res.json({ message: `${active ? 'Enabled' : 'Disabled'} ${user.name}`, active });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/forecast-access — admin/PMO only. Grant or revoke a user's access to the
// (login-gated) Forecast dashboard. Body: { forecast_access: true|false }.
router.put('/:id/forecast-access', authenticate, adminOnly, async (req, res) => {
  try {
    const forecast_access = !!req.body.forecast_access;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!canActOn(req.user, user)) return res.status(403).json({ message: 'You are not allowed to manage this user.' });
    await User.update({ forecast_access }, { where: { id: user.id } });
    return res.json({ message: `${forecast_access ? 'Granted' : 'Revoked'} Forecast access for ${user.name}`, forecast_access });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id — admin/PMO only. PERMANENTLY delete a BD or PMO. Blocked for your own
// account, and blocked when the user still owns leads (owner_id is a RESTRICT foreign key) — disable
// them instead, or reassign their leads first.
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!canActOn(req.user, user)) return res.status(403).json({ message: 'You are not allowed to manage this user.' });
    if (String(user.id) === String(req.user.id)) return res.status(400).json({ message: 'You cannot delete your own account' });

    // Reassign any leads this user owns before deleting (owner_id is a RESTRICT FK). The PMO chooses
    // the target: 'unassigned' routes them to the system "Unassigned" BD (auto-created per business
    // unit); a specific BD/PMO id transfers them to that person.
    const leadCount = await Lead.count({ where: { owner_id: user.id } });
    const reassignTo = req.body && req.body.reassign_to;
    let target = null;
    if (leadCount > 0) {
      if (!reassignTo) {
        return res.status(409).json({ message: `${user.name} owns ${leadCount} lead(s). Choose who to transfer them to.`, requiresReassign: true, leadCount });
      }
      if (reassignTo === 'unassigned') {
        target = await getOrCreateUnassignedBd(user.business_unit);
      } else {
        target = await User.findByPk(reassignTo);
        if (!target || target.business_unit !== user.business_unit || !['bd', 'pmo'].includes(target.role)) {
          return res.status(400).json({ message: 'Invalid transfer target.' });
        }
        if (String(target.id) === String(user.id)) return res.status(400).json({ message: 'Cannot transfer leads to the account being deleted.' });
      }
    }

    // === JIOAUTIFY INTEGRATION: update the user's central Sales CRM access (module 22) BEFORE deleting
    // locally. The central record is shared across business units, so recompute the UNION from the
    // rows that REMAIN after removing this one: central access is revoked (module_access/admin 'false')
    // only when this was the person's last row; if they still have a row in the other business unit,
    // that row's state is preserved centrally instead of being wrongly revoked. ===
    if (process.env.NODE_ENV === 'production') {
      const remaining = (await rowsForEmail(user.email))
        .filter(r => r.id !== user.id)
        .map(r => ({ active: r.active, role: r.role }));
      const payload = aggregateModulePayload(user.email, user.mobile, remaining);
      if (!(await syncCentralAccess(payload, req, res, 'delete'))) return;
    }

    if (target) await Lead.update({ owner_id: target.id }, { where: { owner_id: user.id } });
    await user.destroy();
    return res.json({ message: `Permanently deleted ${user.name}${target ? ` and transferred ${leadCount} lead(s) to ${target.name}` : ''}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
