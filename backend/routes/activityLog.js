const router = require('express').Router();
const { ActivityLog, Lead } = require('../models');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/activity-log?lead_id=123
router.get('/', async (req, res) => {
  try {
    const { lead_id } = req.query;
    if (!lead_id) return res.status(400).json({ message: 'lead_id is required' });

    const lead = await Lead.findByPk(lead_id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (req.user.role === 'bd' && lead.owner_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

    const rows = await ActivityLog.findAll({ where: { lead_id }, order: [['createdAt', 'DESC']] });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
