const test = require('node:test');
const assert = require('node:assert');
const { MAX_FAILED_ATTEMPTS, LOCK_MINUTES, lockStatus, afterFailedAttempt, lockedMessage } = require('../services/lockout');

const NOW = new Date('2026-10-31T10:00:00Z');
const minutesFromNow = (m) => new Date(NOW.getTime() + m * 60000);

test('an account with no lock is not locked', () => {
  assert.deepStrictEqual(lockStatus({ locked_until: null }, NOW), { locked: false, minutesLeft: 0 });
  assert.strictEqual(lockStatus({}, NOW).locked, false);
});

test('a lock in the future is reported with the minutes left, rounded up', () => {
  assert.deepStrictEqual(lockStatus({ locked_until: minutesFromNow(30) }, NOW), { locked: true, minutesLeft: 30 });
  assert.strictEqual(lockStatus({ locked_until: new Date(NOW.getTime() + 61000) }, NOW).minutesLeft, 2);
});

test('a lock that has ended no longer locks', () => {
  assert.strictEqual(lockStatus({ locked_until: minutesFromNow(-1) }, NOW).locked, false);
});

test('wrong passwords 1 to 4 only count; the 5th locks for 30 minutes and resets the count', () => {
  let user = { failed_login_count: 0, locked_until: null };
  for (let n = 1; n < MAX_FAILED_ATTEMPTS; n++) {
    const next = afterFailedAttempt(user, NOW);
    assert.strictEqual(next.justLocked, false);
    assert.strictEqual(next.failed_login_count, n);
    assert.strictEqual(next.locked_until, null);
    user = { ...user, ...next };
  }
  const last = afterFailedAttempt(user, NOW);
  assert.strictEqual(last.justLocked, true);
  assert.strictEqual(last.failed_login_count, 0);
  assert.strictEqual(last.locked_until.getTime(), minutesFromNow(LOCK_MINUTES).getTime());
});

test('a wrong password after an expired lock starts counting again from one', () => {
  const next = afterFailedAttempt({ failed_login_count: 0, locked_until: minutesFromNow(-5) }, NOW);
  assert.strictEqual(next.failed_login_count, 1);
  assert.strictEqual(next.locked_until, null);
  assert.strictEqual(next.justLocked, false);
});

test('the lock message names the minutes and says an admin can unlock', () => {
  assert.match(lockedMessage(30), /30 minutes/);
  assert.match(lockedMessage(1), /1 minute[^s]/);
  assert.match(lockedMessage(5), /admin/);
});
