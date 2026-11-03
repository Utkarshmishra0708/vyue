// Shared name-disambiguation helpers (P3-2c, issue #39).
// When two Sales Reps share a name, these add "(username)" so they stay distinguishable.

export function buildNameCount(bds) {
  const c = {};
  (bds || []).forEach(b => { const k = String(b.name).trim().toLowerCase(); c[k] = (c[k] || 0) + 1; });
  return c;
}

// Full label: "Riya Shah (Riya.Shah)" when duplicated, else "Riya Shah".
export function bdLabel(b, nameCount) {
  if (!b) return '';
  return nameCount[String(b.name).trim().toLowerCase()] > 1
    ? `${b.name} (${b.username || b.label?.match(/\((.+)\)/)?.[1] || b.id})`
    : b.name;
}

// Compact label for tickers / table cells: "Riya (Riya.Shah)" when duplicated, else "Riya".
export function ownerLabel(owner, nameCount) {
  if (!owner) return '';
  const dup = nameCount[String(owner.name).trim().toLowerCase()] > 1;
  return dup && owner.username ? `${owner.name.split(' ')[0]} (${owner.username})` : owner.name.split(' ')[0];
}
