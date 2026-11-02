// Usernames: every person gets a readable, unique sign-in name made from their full name.
//   first person called "Priya Nair"   -> Priya.Nair
//   second                              -> Priya1.Nair
//   third                               -> Priya2.Nair
// The number goes after the first name (name(n-1).surname). Anyone can sign in with their email or their
// username, never with their full name, so any number of people can share a name.
// A username is made once and then kept: renaming a person does not change it, so nobody gets locked out.
const { Op } = require('sequelize');

const MAX_PART = 30;

// Letters and digits only (accents removed), in a tidy case.
function cleanToken(t) {
  const plain = String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
  if (!plain) return '';
  const tidy = (plain === plain.toUpperCase() || plain === plain.toLowerCase())
    ? plain.charAt(0).toUpperCase() + plain.slice(1).toLowerCase()
    : plain.charAt(0).toUpperCase() + plain.slice(1);   // keep names like McDonald as typed
  return tidy.slice(0, MAX_PART);
}

// The first name and the surname (the first and the last word; a note in brackets is ignored).
function nameParts(fullName) {
  const words = String(fullName || '').replace(/\([^)]*\)/g, ' ').split(/\s+/).map(cleanToken).filter(Boolean);
  if (!words.length) return { first: 'User', last: null };
  return { first: words[0], last: words.length > 1 ? words[words.length - 1] : null };
}

const candidate = (parts, k) => (parts.last ? `${parts.first}${k || ''}.${parts.last}` : `${parts.first}${k || ''}`);

// The first free username for this name: Priya.Nair, then Priya1.Nair, Priya2.Nair... `taken` holds the
// usernames already used in the business, in lower case.
function pickUsername(fullName, taken) {
  const parts = nameParts(fullName);
  const used = taken instanceof Set ? taken : new Set([...(taken || [])].map(x => String(x).toLowerCase()));
  for (let k = 0; k < 10000; k++) {
    const c = candidate(parts, k);
    if (!used.has(c.toLowerCase())) return c;
  }
  throw new Error('Could not make a username');
}

async function takenUsernames(User, businessUnit, transaction) {
  const rows = await User.findAll({ where: { business_unit: businessUnit, username: { [Op.ne]: null } }, attributes: ['username'], transaction });
  return new Set(rows.map(r => r.username.toLowerCase()));
}

// Used when a person is created.
async function nextUsername(User, fullName, businessUnit, transaction) {
  return pickUsername(fullName, await takenUsernames(User, businessUnit, transaction));
}

// Gives a username to everyone who has none (accounts made before usernames existed), in the order the
// accounts were created, so the first Priya Nair keeps Priya.Nair. Safe to run again.
async function ensureUsernames(User, skipIds = []) {
  // Leftover copies of an Owner's account (disabled) never sign in, so they hold no username.
  if (skipIds.length) await User.update({ username: null }, { where: { id: skipIds, username: { [Op.ne]: null } } });
  const where = { username: null };
  if (skipIds.length) where.id = { [Op.notIn]: skipIds };
  const missing = await User.findAll({ where, attributes: ['id', 'name', 'business_unit'], order: [['id', 'ASC']] });
  if (!missing.length) return 0;
  const taken = new Map();
  for (const u of missing) {
    if (!taken.has(u.business_unit)) taken.set(u.business_unit, await takenUsernames(User, u.business_unit));
    const set = taken.get(u.business_unit);
    const username = pickUsername(u.name, set);
    set.add(username.toLowerCase());
    await User.update({ username }, { where: { id: u.id } });
  }
  return missing.length;
}

module.exports = { nameParts, pickUsername, nextUsername, ensureUsernames };
