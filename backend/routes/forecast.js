const router = require('express').Router();
const { Lead, User } = require('../models');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');

// Forecast is login-gated. The admin tier (super_admin/business_admin/pmo) and dedicated 'forecast'
// accounts have access by default; other users (e.g. BDs) only if granted forecast_access.
function forecastAccess(req, res, next) {
  if (req.user && (['super_admin', 'business_admin', 'pmo', 'forecast'].includes(req.user.role) || req.user.forecast_access)) return next();
  return res.status(403).json({ message: 'You do not have access to the Forecast dashboard. Ask an admin to grant it.' });
}

// GET /api/forecast/devices — requires login + forecast access. Scoped to the caller's own business
// unit (forecast is per-business). Returns only the fields the forecast needs (never contact info,
// rates, or notes).
router.get('/devices', authenticate, forecastAccess, async (req, res) => {
  try {
    const rows = await Lead.findAll({
      where: { includes_device: true, phase: { [Op.ne]: 'Lost' }, business_unit: req.user.business_unit },
      attributes: ['id', 'customer_name', 'business_unit', 'city', 'state', 'device_sku', 'quantity', 'device_qty', 'po_expected_date', 'device_requested_date', 'phase'],
      include: [{ model: User, as: 'owner', attributes: ['name'] }],
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
