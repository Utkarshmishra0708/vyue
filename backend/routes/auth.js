const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, BusinessUnit, ServiceDefinition, Setting } = require('../models');
const { authenticate } = require('../middleware/auth');
const { lockStatus, afterFailedAttempt, lockedMessage } = require('../services/lockout');
const { Op } = require('sequelize');
const { ownerCopyIds } = require('../services/ownerSession');
const {
  effectivePermissions, PERMISSION_MANAGER_ROLES, isSuperAdmin, superAdminScope, canSeeActivityFeed,
  MODULES, moduleEnabledForBu,
} = require('../services/permissions');

// The user object every authenticated response returns. Must match GET /auth/me exactly: the
// client gates its entire navigation on `permissions`, so a login response that omits them makes
// the app think the user has no modules until the next background refresh.
async function authUserPayload(user) {
  const safe = user.toJSON();
  delete safe.password_hash;
  delete safe.module_permissions;          // the resolved map below is the contract
  safe.permissions = effectivePermissions(user);
  safe.can_manage_permissions = PERMISSION_MANAGER_ROLES.includes(user.role) || isSuperAdmin(user);
  // Cross-platform Super Admin grant (migration 021) — additive to `role`, so it is reported
  // separately rather than folded into it.
  safe.super_admin_scope = superAdminScope(user);
  safe.is_super_admin = isSuperAdmin(user);
  safe.super_admin_read_only = user.super_admin_scope === 'read';
  // Platform-wide Activity feed visibility (J1) — resolved so the client just reads a boolean.
  safe.can_see_activity_feed = canSeeActivityFeed(user);
  // Per-BU module enablement — which modules the caller's business unit has switched on. The
  // frontend sidebar / router combines this with the per-user permission to decide what to show.
  // Kept next to permissions so both dimensions travel together and refresh on the same poll.
  try {
    const bu = await BusinessUnit.findOne({ where: { slug: user.business_unit }, attributes: ['config'] });
    const cfg = bu?.config || null;
    const map = {};
    for (const m of MODULES) map[m] = moduleEnabledForBu(cfg, m);
    // The Inventory Pipeline only exists for a business that sells hardware: even when its switch is
    // on, it stays hidden until the catalog has at least one Hardware (or Hardware + Software) service.
    if (map.forecast) {
      map.forecast = (await ServiceDefinition.count({ where: { business_unit: user.business_unit, active: true, hardware: true } })) > 0;
    }
    safe.bu_modules = map;
  } catch {
    safe.bu_modules = null;
  }
  // Businesses this person can switch between without signing in again. An Owner can enter every active
  // business. Anyone else can switch only between businesses where they have an account under the same
  // email (a person with no email has just their own).
  if (isSuperAdmin(user)) {
    const all = await BusinessUnit.findAll({ where: { status: 'active' }, attributes: ['slug'], order: [['sort_order', 'ASC'], ['name', 'ASC']] });
    safe.platforms = all.map(b => b.slug);
  } else if (user.email) {
    const siblings = await User.findAll({ where: { email: user.email, active: true }, attributes: ['business_unit'] });
    safe.platforms = [...new Set(siblings.map(x => x.business_unit))].sort();
  } else {
    safe.platforms = [user.business_unit];
  }
  return safe;
}


// `businessSlug` is only for an Owner: it names the business the session is working in.
const signToken = (user, businessSlug) => jwt.sign(
  businessSlug ? { id: user.id, role: user.role, bu: businessSlug } : { id: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
);

// An Owner's account, found by email, regardless of which business it is stored under.
const findOwnerByEmail = (email) => User.findOne({
  where: { email, super_admin_scope: { [Op.ne]: null } },
  order: [['id', 'ASC']],
});
// An Owner found by email, or by username (the Owner's username is on their own account). A username that
// two Owners share can't pick one, so it finds nobody.
const findOwnerByLogin = async (ident) => {
  if (ident.includes('@')) return findOwnerByEmail(ident);
  const rows = await User.findAll({ where: { username: ident, super_admin_scope: { [Op.ne]: null } } });
  return rows.length === 1 ? rows[0] : null;
};
// Several accounts can share an email (one per business, for a person who works in more than one), so
// a company-wide sign-in may match more than one. Prefer an active account whose password matches; if
// none matches, return the first one that is not locked, so a wrong password is counted against it.
// A username belongs to a single account. Leftover Owner copies are ignored.
const findCompanyAccount = async (ident, password) => {
  const copies = await ownerCopyIds(User);
  const where = ident.includes('@') ? { email: ident } : { username: ident };
  if (copies.length) where.id = { [Op.notIn]: copies };
  const rows = await User.findAll({ where, order: [['id', 'ASC']] });
  if (!rows.length) return null;
  const active = rows.filter(r => r.active);
  if (!active.length) return rows[0];                    // only a disabled account: it gets its own message
  for (const r of active) {
    if (!r.password_hash || lockStatus(r).locked) continue;
    if (await bcrypt.compare(password, r.password_hash)) return r;
  }
  return active.find(r => !lockStatus(r).locked) || active[0];
};
const activeBusiness = (slug) => BusinessUnit.findOne({ where: { slug, status: 'active' }, attributes: ['slug'] });

// GET /api/auth/setup-status — is this a fresh install that needs first-run registration?
// Public (no auth): the login page checks this before anyone is signed in.
router.get('/setup-status', async (req, res) => {
  try {
    const owner = await User.findOne({ where: { super_admin_scope: { [Op.ne]: null } } });
    const companyRow = await Setting.findByPk('company_name');
    return res.json({ needsSetup: !owner, companyName: companyRow?.value || null });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/setup — first-run registration: create the company's first Owner and business.
// Public (no auth), one-time: refuses if any Owner already exists.
router.post('/setup', async (req, res) => {
  try {
    const existing = await User.findOne({ where: { super_admin_scope: { [Op.ne]: null } } });
    if (existing) return res.status(409).json({ message: 'This app is already set up. Please sign in.' });

    const { ownerName, email, password, companyName } = req.body;
    if (!ownerName || !email || !password || !companyName) {
      return res.status(400).json({ message: 'All fields are required: name, email, password, and company name.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    await Setting.findOrCreate({ where: { key_name: 'company_name' }, defaults: { value: companyName.trim(), updated_at: new Date() } });

    const user = await User.create({
      name: ownerName.trim(),
      email: email.trim().toLowerCase(),
      password_hash: await bcrypt.hash(password, 10),
      role: 'super_admin',
      super_admin_scope: 'write',
      active: true,
    });

    const token = signToken(user, null);
    return res.json({ token, user: await authUserPayload(user) });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'That business name or email is already taken.' });
    }
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login — unified credential login.
//
// The login screen sends { identifier, password, business_unit, role? }.
//   • Global Admin (role='super_admin'): `identifier` is an email; the account must hold a
//     super_admin_scope grant. No business_unit.
//   • Platform login (business_unit set, no role): `identifier` is an email or a full name.
//     The backend finds the user on that platform by email first, then by name, regardless of
//     role. The user's role and module access are determined by what the admin assigned — the
//     login screen does not ask for a role.
//   • Legacy: { email, password, business_unit } still works for backward compatibility.
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, business_unit, role,
            /* legacy field */
            email: legacyEmail } = req.body;
    const ident = (identifier || legacyEmail || '').trim();
    if (!ident || !password) return res.status(400).json({ message: 'Credentials required' });

    let user;
    let enterBusiness = null;   // set when an Owner signs in to a particular business

    if (role === 'super_admin') {
      // --- Owner only: an email or username that holds the Owner grant ---
      user = await findOwnerByLogin(ident);
    } else if (!business_unit) {
      // --- Sign in first, businesses after: no business is named. The person is found by email or
      // username across the whole company (a username belongs to one person company-wide). An Owner
      // comes first; otherwise one of the accounts with that email or username. ---
      user = await findOwnerByLogin(ident);
      if (!user) user = await findCompanyAccount(ident, password);
    } else if (business_unit) {
      // --- Business sign-in: an Owner's email works for every business, because an Owner has one
      // account for the whole company and can enter any business. ---
      const owner = ident.includes('@') ? await findOwnerByEmail(ident) : null;
      if (owner) {
        user = owner;
        enterBusiness = business_unit;
      } else {
        // Everyone else: by email or username, within this business
        // (Leftover, disabled copies of an Owner's account are ignored: the Owner is found below.)
        const copies = await ownerCopyIds(User);
        const notCopy = copies.length ? { id: { [Op.notIn]: copies } } : {};
        user = await User.findOne({ where: { email: ident, business_unit, ...notCopy } });
        // Otherwise by username (never by full name, because several people can share one).
        if (!user) user = await User.findOne({ where: { username: ident, business_unit, ...notCopy } });
        // Nobody here has that username: it may be an Owner's, and an Owner can enter any business.
        if (!user && !ident.includes('@')) {
          const ownerByName = await findOwnerByLogin(ident);
          if (ownerByName) { user = ownerByName; enterBusiness = business_unit; }
        }
      }
    }

    if (!user)                return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.active)         return res.status(403).json({ message: 'User is inactive' });
    if (!user.password_hash)  return res.status(401).json({ message: 'Invalid credentials' });

    // Locked after too many wrong passwords: refuse even a correct password until the lock ends.
    const lock = lockStatus(user);
    if (lock.locked) return res.status(423).json({ message: lockedMessage(lock.minutesLeft) });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const next = afterFailedAttempt(user);
      await User.update({ failed_login_count: next.failed_login_count, locked_until: next.locked_until }, { where: { id: user.id } });
      if (next.justLocked) return res.status(423).json({ message: lockedMessage(lockStatus(next).minutesLeft) });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.failed_login_count || user.locked_until) {
      await User.update({ failed_login_count: 0, locked_until: null }, { where: { id: user.id } });
    }

    // An Owner signing in to a business: the pass names that business, if it exists and is active.
    if (enterBusiness) {
      if (!(await activeBusiness(enterBusiness))) {
        return res.status(404).json({ message: 'That business does not exist or is not active.' });
      }
      user.setDataValue('business_unit', enterBusiness);
    }

    const token = signToken(user, enterBusiness);
    return res.json({ token, user: await authUserPayload(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/logout — sign-in passes are stateless, so there is no server session to end; this
// simply acknowledges the request.
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me — the current authenticated user, plus their effective per-module access.
// The frontend re-polls this (on focus and on an interval) so a permission change an admin makes
// applies to the affected user without them re-logging in. `permissions` is always the resolved
// map, never the raw column, so the client never has to know about defaults.
router.get('/me', authenticate, async (req, res) => {
  try {
    return res.json(await authUserPayload(req.user));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/enter-business — body { business_unit }. Owner only.
// An Owner has one account for the whole company. Picking a business issues a new sign-in pass that
// names it, with no second sign-in and no copy of the account.
async function enterBusinessHandler(req, res) {
  try {
    const { business_unit } = req.body;
    if (!business_unit) return res.status(400).json({ message: 'business_unit is required' });
    if (!isSuperAdmin(req.user)) return res.status(403).json({ message: 'Only an Owner can enter any business.' });
    if (!(await activeBusiness(business_unit))) return res.status(404).json({ message: 'That business does not exist or is not active.' });
    req.user.setDataValue('business_unit', business_unit);
    return res.json({ token: signToken(req.user, business_unit), user: await authUserPayload(req.user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
router.post('/enter-business', authenticate, enterBusinessHandler);

// POST /api/auth/switch-platform — body { business_unit }. Switching business without signing in again.
// An Owner enters any business (see above). Anyone else hops to their account on another business under
// the same email (one email holds at most one account per business); a person with no email can't switch.
router.post('/switch-platform', authenticate, async (req, res) => {
  try {
    if (isSuperAdmin(req.user)) return enterBusinessHandler(req, res);
    const { business_unit } = req.body;
    if (!business_unit) return res.status(400).json({ message: 'business_unit is required' });
    if (!req.user.email) return res.status(400).json({ message: 'This account is not able to switch businesses.' });
    if (business_unit === req.user.business_unit) {
      return res.json({ token: signToken(req.user), user: await authUserPayload(req.user) });
    }
    const target = await User.findOne({ where: { email: req.user.email, business_unit } });
    if (!target)         return res.status(404).json({ message: 'You do not have an account in that business.' });
    if (!target.active)  return res.status(403).json({ message: 'Your account in that business is disabled.' });
    return res.json({ token: signToken(target), user: await authUserPayload(target) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/change-password — any authenticated user (admin, PMO, or BD)
// changes their own password.
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password too short (min 6)' });

    const user = await User.findByPk(req.user.id);
    if (!user || !user.password_hash) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Current password is wrong' });

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.must_change_password = false;
    await user.save();
    return res.json({ message: 'Password updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
