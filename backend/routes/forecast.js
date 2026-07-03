const router = require('express').Router();
const { Lead, User } = require('../models');
const { Op } = require('sequelize');

// GET /api/forecast/devices — PUBLIC, no auth. Returns only the fields
// needed for the hardware forecast (never contact info, rates, or notes).
router.get('/devices', async (req, res) => {
  try {
    const rows = await Lead.findAll({
      where: { includes_device: true, phase: { [Op.ne]: 'Lost' } },
      attributes: ['id', 'customer_name', 'business_unit', 'device_sku', 'quantity', 'device_qty', 'po_expected_date', 'device_requested_date', 'phase'],
      include: [{ model: User, as: 'owner', attributes: ['name'] }],
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
