// Sign-in lockout rules, kept free of the database so they are easy to test.
// After MAX_FAILED_ATTEMPTS wrong passwords in a row, the account is locked for LOCK_MINUTES.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 30;

// Is this account locked right now, and for how many more minutes (rounded up)?
function lockStatus(user, now = new Date()) {
  const until = user && user.locked_until ? new Date(user.locked_until) : null;
  if (!until || until <= now) return { locked: false, minutesLeft: 0 };
  return { locked: true, minutesLeft: Math.ceil((until - now) / 60000) };
}

// The values to save after a wrong password. A lock that has already ended starts the count again.
function afterFailedAttempt(user, now = new Date()) {
  const expired = user.locked_until && new Date(user.locked_until) <= now;
  const count = (expired ? 0 : (user.failed_login_count || 0)) + 1;
  if (count >= MAX_FAILED_ATTEMPTS) {
    return { failed_login_count: 0, locked_until: new Date(now.getTime() + LOCK_MINUTES * 60000), justLocked: true };
  }
  return { failed_login_count: count, locked_until: expired ? null : (user.locked_until || null), justLocked: false };
}

function lockedMessage(minutesLeft) {
  return `This account is locked after too many wrong passwords. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}, or ask an admin to unlock it.`;
}

module.exports = { MAX_FAILED_ATTEMPTS, LOCK_MINUTES, lockStatus, afterFailedAttempt, lockedMessage };
