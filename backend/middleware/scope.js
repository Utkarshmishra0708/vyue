// Data isolation, enforced at the API layer (not just in the UI).
// Every account belongs to exactly ONE business (one account per business per person), so ALL
// roles are scoped to their own business_unit: a user of one business never sees another business's
// leads. On top of that, a Sales Rep (role 'bd') only ever sees rows they own.

function leadScopeWhere(user, extra = {}) {
  // A Super Admin is scoped to the business they signed into, exactly like a normal PMO — logging
  // into Signage shows Signage only. Their cross-platform reach comes from being able to sign into
  // any business (each business is a separate account under the same email), plus the dedicated
  // cross-platform sections in Settings — NOT from mixing every platform into one business's list.
  // This keeps Leads / Dashboard / Reports consistent with the Forecast, which is already
  // business-scoped.
  const where = { ...extra, business_unit: user.business_unit };
  if (user.role === 'bd') where.owner_id = user.id;
  return where;
}

module.exports = { leadScopeWhere };
