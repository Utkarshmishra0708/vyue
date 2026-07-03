// BD data isolation, enforced at the API layer (not just in the UI).
// Admin/PMO see everything; a BD only ever sees rows they own.
function leadScopeWhere(user, extra = {}) {
  if (user.role === 'bd') return { ...extra, owner_id: user.id };
  return extra;
}

module.exports = { leadScopeWhere };
