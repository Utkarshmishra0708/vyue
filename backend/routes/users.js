const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authenticate, adminOnly } = require('../middleware/auth');

const COLOR_ROTATION = ['bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500'];
const DEFAULT_BD_PASSWORD = '123456'; // system default — the BD is expected to change it after first login

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

// POST /api/users — admin/PMO only. Add a new BD. Body: { name, business_unit }
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, business_unit } = req.body;
    if (!name || !business_unit) return res.status(400).json({ message: 'name and business_unit are required' });

    const existing = await User.findOne({ where: { name, business_unit, role: 'bd' } });
    if (existing) return res.status(409).json({ message: `"${name}" already exists in ${business_unit}` });

    const count = await User.count({ where: { business_unit, role: 'bd' } });
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const color = COLOR_ROTATION[count % COLOR_ROTATION.length];
    const maxOrder = (await User.max('sort_order', { where: { business_unit, role: 'bd' } })) || 0;
    const password_hash = await bcrypt.hash(DEFAULT_BD_PASSWORD, 10);

    const bd = await User.create({ name, business_unit, role: 'bd', initials, color, sort_order: maxOrder + 1, active: true, password_hash });
    const safeBd = bd.toJSON();
    delete safeBd.password_hash;
    return res.status(201).json({ ...safeBd, defaultPassword: DEFAULT_BD_PASSWORD });
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

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: `Password reset for ${user.name}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id — admin/PMO only. Soft-delete a BD (their leads keep
// the owner_id reference; they just can no longer log in or appear in lists).
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'bd') return res.status(400).json({ message: 'Only BD accounts can be removed here' });

    user.active = false;
    await user.save();
    return res.json({ message: `Removed ${user.name}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
