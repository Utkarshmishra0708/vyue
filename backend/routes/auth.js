const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const signToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
);

// Password-based auth (email/BD login + self-service change-password) is DEV-ONLY.
// In production the app is SSO-only (see /sso and /sso/select below), so these
// routes reject with 403. Mirrors the production guard the SSO endpoints use.
const passwordAuthDevOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Password login is disabled in production. Please sign in through the portal (SSO).' });
  }
  next();
};

// POST /api/auth/login — admin/PMO login with email + password (dev only)
router.post('/login', passwordAuthDevOnly, async (req, res) => {
  try {
    const { email, password, business_unit } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    // Scope the lookup to the chosen business unit when supplied. The same corporate email may hold a
    // separate account per business unit (signage / jhes) — see migration 002 — so matching on email
    // alone would return whichever row happens to come first and log a JHES admin into signage (or
    // vice-versa). With business_unit set, each PMO signs into their own business unit's account.
    const where = { email };
    if (business_unit) where.business_unit = business_unit;
    const user = await User.findOne({ where });
    if (!user)                 return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.active)          return res.status(403).json({ message: 'User is inactive' });
    if (!['admin', 'pmo'].includes(user.role)) return res.status(403).json({ message: 'Not an admin account' });
    if (!user.password_hash)   return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    const safeUser = user.toJSON();
    delete safeUser.password_hash;
    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/bd-login — BD login with { userId, password }.
// Each BD has their own bcrypt-hashed password (set by PMO on creation,
// changeable by the BD themselves via /auth/change-password afterward).
router.post('/bd-login', passwordAuthDevOnly, async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ message: 'BD id and password required' });

    const user = await User.findByPk(userId);
    if (!user)                return res.status(404).json({ message: 'BD not found' });
    if (!user.active)         return res.status(403).json({ message: 'BD is inactive' });
    if (user.role !== 'bd')   return res.status(403).json({ message: 'Not a BD account' });
    if (!user.password_hash)  return res.status(500).json({ message: 'This BD has no password set. Ask PMO to reset it.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Incorrect password' });

    const token = signToken(user);
    const safeUser = user.toJSON();
    delete safeUser.password_hash;
    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// === JIOAUTIFY INTEGRATION: SSO bridge (mirrors JioTCM / Jio Inventory / Release Planner
// POST /api/auth/sso). The STB ("Jioautify") portal calls this with the logged-in user's email.
// Production-only, exactly like the other modules; the user must already exist in Sales CRM as an
// ACTIVE, email-bearing account (BDs log in with bd-login, not SSO). No auto-provisioning.
//
// A corporate email may hold up to two accounts — one per business unit (signage / jhes), see
// migration 002. So this endpoint returns one of two shapes:
//   • exactly one account  -> { token, user }  (portal opens /sales_crm?token=&data= -> home)
//   • two accounts         -> { multiple: true, accounts: [...], ticket }  (portal opens
//                             /sales_crm?ssoTicket=<ticket>; the Sales CRM page renders the account
//                             chooser and calls /sso/select to redeem a token for the chosen BU)
// `ticket` is a short-lived JWT that only names the (already portal-authenticated) email — it is
// redeemed at /sso/select. We put the ticket, not the raw email, in the redirect URL. ===
const SSO_SELECT_PURPOSE = 'salescrm-sso-select';

function ssoAccountSummary(u) {
  return { business_unit: u.business_unit, role: u.role, name: u.name };
}

router.post('/sso', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return res.status(403).json({ message: 'SSO is only available in production' });
    }
    const email = (req.body && req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email required' });

    const users = await User.findAll({ where: { email, active: true }, order: [['business_unit', 'ASC']] });
    if (!users.length) {
      return res.status(401).json({ message: 'User not provisioned in Sales CRM. Ask an admin to create your account.' });
    }

    // Two accounts (one per BU) -> hand back a chooser ticket instead of a token.
    if (users.length > 1) {
      const ticket = jwt.sign(
        { email, purpose: SSO_SELECT_PURPOSE },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ multiple: true, accounts: users.map(ssoAccountSummary), ticket });
    }

    // Single account -> straight to a token (unchanged behaviour).
    const user = users[0];
    const token = signToken(user);
    const safeUser = user.toJSON();
    delete safeUser.password_hash;
    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// === JIOAUTIFY INTEGRATION: redeem an SSO chooser ticket. Called by the Sales CRM redirect page:
//   • { ticket }                       -> { accounts: [...] }  (to render the chooser)
//   • { ticket, business_unit: 'jhes' } -> { token, user }     (after the user picks an account)
// Production-only; the ticket is a 5-minute JWT issued by /sso that only carries the already
// portal-authenticated email, so this grants no more access than /sso itself. ===
router.post('/sso/select', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return res.status(403).json({ message: 'SSO is only available in production' });
    }
    const { ticket, business_unit } = req.body || {};
    if (!ticket) return res.status(400).json({ message: 'Ticket required' });

    let payload;
    try {
      payload = jwt.verify(ticket, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'SSO session expired. Please open Sales CRM from the portal again.' });
    }
    if (!payload || payload.purpose !== SSO_SELECT_PURPOSE || !payload.email) {
      return res.status(401).json({ message: 'Invalid SSO ticket' });
    }
    const email = payload.email;

    const users = await User.findAll({ where: { email, active: true }, order: [['business_unit', 'ASC']] });
    if (!users.length) {
      return res.status(401).json({ message: 'User not provisioned in Sales CRM. Ask an admin to create your account.' });
    }

    // No BU chosen yet -> return the account list so the page can render the chooser.
    if (!business_unit) {
      return res.json({ accounts: users.map(ssoAccountSummary) });
    }

    // BU chosen -> issue a token for that specific account.
    const user = users.find(u => u.business_unit === business_unit);
    if (!user) return res.status(404).json({ message: 'No Sales CRM account for that business unit.' });

    const token = signToken(user);
    const safeUser = user.toJSON();
    delete safeUser.password_hash;
    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// === JIOAUTIFY INTEGRATION: logout endpoint called by the STB portal on sign-out (mirrors the
// JioTCM / Jio Inventory / Release Planner logout). Auth is stateless JWT, so there is no server
// session to destroy — this simply acknowledges the request so the portal's best-effort logout
// call succeeds. ===
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me — return the current authenticated user
router.get('/me', authenticate, async (req, res) => {
  try {
    return res.json(req.user);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/change-password — any authenticated user (admin, PMO, or BD)
// changes their own password. Dev only; passwords are not used in production (SSO).
router.post('/change-password', passwordAuthDevOnly, authenticate, async (req, res) => {
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
