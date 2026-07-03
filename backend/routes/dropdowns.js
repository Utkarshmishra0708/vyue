const router = require('express').Router();
const { DropdownOption } = require('../models');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dropdowns — grouped by field_name: { phase: [...], lead_source: [...] }
router.get('/', async (req, res) => {
  try {
    const rows = await DropdownOption.findAll({ where: { active: true }, order: [['field_name', 'ASC'], ['sort_order', 'ASC']] });
    const grouped = {};
    for (const r of rows) (grouped[r.field_name] ||= []).push(r.value);
    return res.json(grouped);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/dropdowns — admin only. Body: { field_name, value }
router.post('/', adminOnly, async (req, res) => {
  try {
    const { field_name, value } = req.body;
    if (!field_name || !value) return res.status(400).json({ message: 'field_name and value are required' });

    const maxOrder = (await DropdownOption.max('sort_order', { where: { field_name } })) || 0;
    const [row, created] = await DropdownOption.findOrCreate({
      where: { field_name, value },
      defaults: { field_name, value, sort_order: maxOrder + 1, active: true },
    });
    if (!created && !row.active) { row.active = true; await row.save(); }
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// DELETE /api/dropdowns/:id — admin only (soft delete)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const row = await DropdownOption.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Option not found' });
    row.active = false;
    await row.save();
    return res.json({ message: 'Option removed' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
