const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, BusinessUnit, ServiceDefinition } = require('../models');
const { authenticate } = require('../middleware/auth');
const { lockStatus, afterFailedAttempt, lockedMessage } = require('../services/lockout');
const {
  effectivePermissions, PERMISSION_MANAGER_ROLES, isSuperAdmin, superAdminScope, canSeeActivityFeed,
  MODULES, moduleEnabledForBu,
} = require('../services/permissions');

// The user object every authenticated response returns. Must match GET /auth/me exactly: the
// client gates its entire navigation on `permissions`, so a login response that omits them makes
// the app think the user has no modules until the next background refresh.
async function authUserPayload(user) {
  // GA scope is email-level: if ANY row sharing this email holds a super_admin_scope grant,
  // this session inherits it. This covers auto-provisioned accounts that may not have the
  // column set yet (race with sync, legacy rows, etc.).
  if (user.email && !user.super_admin_scope) {
    const { Op } = require('sequelize');
    const sibling = await User.findOne({
      where: { email: user.email, super_admin_scope: { [Op.ne]: null } },
      attributes: ['super_admin_scope'],
    });
    if (sibling) user.super_admin_scope = sibling.super_admin_scope;
  }

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
  // Platforms this person can switch between in-tool (N1): every active account under the same
  // email. One email holds at most one account per business unit (migration 002), so this is the
  // set of platforms they may hop to without re-entering credentials. A BD (no email) has just one.
  if (user.email) {
    const siblings = await User.findAll({
      where: { email: user.email, active: true },
      attributes: ['business_unit'],
    });
    safe.platforms = [...new Set(siblings.map(s => s.business_unit))].sort();
  } else {
    safe.platforms = [user.business_unit];
  }
  return safe;
}


const signToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
);

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

    if (role === 'super_admin' || (!role && !business_unit && !legacyEmail)) {
      // --- Global Admin login: email with a super_admin_scope grant ---
      const { Op } = require('sequelize');
      user = await User.findOne({
        where: { email: ident, super_admin_scope: { [Op.ne]: null } },
      });
    } else if (business_unit) {
      // --- Platform login: find by email first, then by name, on this platform ---
      // Try email match (covers Business Admin, Manager, and any Team Member with an email)
      user = await User.findOne({ where: { email: ident, business_unit } });
      // Fallback: match by full name on this platform (Team Members typically have no email)
      if (!user) {
        user = await User.findOne({ where: { name: ident, business_unit } });
      }
    } else {
      // Legacy: email-only lookup (old frontend without business_unit)
      user = await User.findOne({ where: { email: ident } });
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

    const token = signToken(user);
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

// POST /api/auth/switch-platform — body { business_unit }  (N1: in-tool platform switching)
//
// Hops the signed-in user to their account on another platform WITHOUT re-entering credentials.
// Safe because the caller is already authenticated, and it only ever issues a token for another
// account with the SAME email — one email holds at most one account per business unit (migration
// 002), so the email is the person's identity across platforms. A BD (no email) cannot switch.
router.post('/switch-platform', authenticate, async (req, res) => {
  try {
    const { business_unit } = req.body;
    if (!business_unit) return res.status(400).json({ message: 'business_unit is required' });
    if (!req.user.email) return res.status(400).json({ message: 'This account is not able to switch platforms.' });
    if (business_unit === req.user.business_unit) {
      // Already there — hand back a fresh token for the same account rather than erroring.
      return res.json({ token: signToken(req.user), user: await authUserPayload(req.user) });
    }

    const target = await User.findOne({ where: { email: req.user.email, business_unit } });
    if (!target)         return res.status(404).json({ message: 'You do not have an account on that platform.' });
    if (!target.active)  return res.status(403).json({ message: 'Your account on that platform is disabled.' });

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
    await user.save();
    return res.json({ message: 'Password updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
