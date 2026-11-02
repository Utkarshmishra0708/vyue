const test = require('node:test');
const assert = require('node:assert');
const { sessionBusiness } = require('../services/ownerSession');

const ACTIVE = ['signage', 'jhes', 'acme'];

test('a pass naming an active business is honoured', () => {
  assert.strictEqual(sessionBusiness('jhes', ACTIVE), 'jhes');
});

test('no claim means no choice (the Owner stays in their home business)', () => {
  assert.strictEqual(sessionBusiness(undefined, ACTIVE), null);
  assert.strictEqual(sessionBusiness('', ACTIVE), null);
  assert.strictEqual(sessionBusiness(null, ACTIVE), null);
});

test('an unknown or disabled business is ignored', () => {
  assert.strictEqual(sessionBusiness('nowhere', ACTIVE), null);
  assert.strictEqual(sessionBusiness('jhes', ['signage']), null);
  assert.strictEqual(sessionBusiness('jhes', []), null);
  assert.strictEqual(sessionBusiness('jhes', undefined), null);
});
