// The Owner has ONE account for the whole company. Which business an Owner is working in is decided
// per sign-in session, by a "business" claim inside their sign-in pass (see routes/auth.js). Picking
// another business just issues a new pass: no copies of the account are made.
const { Op } = require('sequelize');

// The business a pass names, if it is one of the active businesses. Anything else (no claim, an unknown
// or disabled business) means "no valid choice", and the Owner falls back to their home business.
function sessionBusiness(claim, activeSlugs) {
  if (!claim) return null;
  return (activeSlugs || []).includes(claim) ? claim : null;
}

// Earlier versions copied every Owner into each business as a Business Admin (so they could sign in
// there). Migration 059 disables those copies. This returns their ids so lists can hide them, in case
// any remain. The Owner's own account is the lowest-numbered account that holds the Owner grant.
async function ownerCopyIds(User) {
  const owners = await User.findAll({
    where: { super_admin_scope: { [Op.ne]: null }, email: { [Op.ne]: null } },
    attributes: ['id', 'email'], order: [['id', 'ASC']],
  });
  if (!owners.length) return [];
  const primary = new Map();
  for (const o of owners) if (!primary.has(o.email)) primary.set(o.email, o.id);
  const rows = await User.findAll({ where: { email: [...primary.keys()] }, attributes: ['id', 'email'] });
  return rows.filter(r => r.id !== primary.get(r.email)).map(r => r.id);
}

module.exports = { sessionBusiness, ownerCopyIds };
