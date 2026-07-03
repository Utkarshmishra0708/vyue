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

// POST /api/auth/login — admin/PMO login with email + password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ where: { email } });
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
router.post('/bd-login', async (req, res) => {
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

// GET /api/auth/me — return the current authenticated user
router.get('/me', authenticate, async (req, res) => {
  try {
    return res.json(req.user);
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
