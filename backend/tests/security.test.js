const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { jwtSecretProblem, corsOptions, corsProblem, parseOrigins } = require('../config/security');

test('a missing, short or placeholder secret key is refused', () => {
  assert.match(jwtSecretProblem(''), /missing/);
  assert.match(jwtSecretProblem(undefined), /missing/);
  assert.match(jwtSecretProblem('short-key'), /too short/);
  assert.match(jwtSecretProblem('change-me-in-production-please-change-this-now'), /placeholder/);
  assert.match(jwtSecretProblem('testsecret-testsecret-testsecret-testsecret'), /placeholder/);
});

test('a long random key is accepted', () => {
  assert.strictEqual(jwtSecretProblem(crypto.randomBytes(48).toString('base64url')), null);
});

const allowed = (opts, origin) => new Promise(resolve => opts.origin(origin, (err, ok) => resolve(ok)));

test('development: pages on this computer are allowed, other websites are not', async () => {
  const opts = corsOptions({ NODE_ENV: 'development' });
  assert.strictEqual(await allowed(opts, 'http://localhost:3001'), true);
  assert.strictEqual(await allowed(opts, 'http://127.0.0.1:3005'), true);
  assert.strictEqual(await allowed(opts, 'https://evil.example.com'), false);
  assert.strictEqual(await allowed(opts, undefined), true);   // not a cross-site browser call
});

test('production: only the listed websites are allowed, not even localhost', async () => {
  const opts = corsOptions({ NODE_ENV: 'production', CORS_ORIGINS: 'https://crm.example.com/, https://app.example.com' });
  assert.strictEqual(await allowed(opts, 'https://crm.example.com'), true);
  assert.strictEqual(await allowed(opts, 'https://app.example.com'), true);
  assert.strictEqual(await allowed(opts, 'http://localhost:3001'), false);
  assert.strictEqual(await allowed(opts, 'https://evil.example.com'), false);
});

test('production without a list of allowed websites is refused; development does not need one', () => {
  assert.match(corsProblem({ NODE_ENV: 'production', CORS_ORIGINS: '' }), /CORS_ORIGINS/);
  assert.strictEqual(corsProblem({ NODE_ENV: 'production', CORS_ORIGINS: 'https://crm.example.com' }), null);
  assert.strictEqual(corsProblem({ NODE_ENV: 'development' }), null);
});

test('origins are trimmed and trailing slashes removed', () => {
  assert.deepStrictEqual(parseOrigins(' https://a.com/ ,https://b.com '), ['https://a.com', 'https://b.com']);
});
