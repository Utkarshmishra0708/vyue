// Data isolation, enforced at the API layer (not just in the UI).
// Every user belongs to exactly ONE business unit (signage or jhes) — see the JIOAUTIFY
// per-BU account model — so ALL roles are scoped to their own business_unit: a signage PMO
// never sees jhes leads and vice-versa. On top of that, a BD only ever sees rows they own.
function leadScopeWhere(user, extra = {}) {
  const where = { ...extra, business_unit: user.business_unit };
  if (user.role === 'bd') where.owner_id = user.id;
  return where;
}

module.exports = { leadScopeWhere };
