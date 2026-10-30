// The browser shows a running deal-value total using its own copy of the price formula
// (frontend/src/utils/pricing.js), while the server recalculates the saved value with
// backend/services/pricing.js. This test runs both copies on the same examples and fails if they
// ever disagree, so the two can't drift apart unnoticed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const server = require('../services/pricing');

// Load the browser copy: it has no imports, so dropping the `export` keywords makes it plain script.
function loadBrowserCopy() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'pricing.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'frontend pricing.js gained an import; update this test');
  const names = [...src.matchAll(/^export\s+(?:function|const)\s+([A-Za-z0-9_]+)/gm)].map(m => m[1]);
  const body = src.replace(/^export\s+/gm, '') + `\nreturn { ${names.join(', ')} };`;
  return new Function(body)();
}
const browser = loadBrowserCopy();

const EXAMPLES = [
  { months: 12, lines: [] },
  { months: 12, lines: [{ category: 'software', label: 'Subscription', hw: null, svc: { nature: 'opex', frequency: 'monthly', rate: 1000, qty: 10 } }] },
  { months: 36, lines: [{ category: 'hardware', label: 'Product', hw: { sku: 'HW-1', nature: 'capex', frequency: null, rate: 12000, qty: 7 }, svc: null }] },
  { months: 24, lines: [{ category: 'hardware_software', label: 'Kit', hw: { sku: 'HW-2', nature: 'opex', frequency: 'monthly', rate: 800, qty: 5 }, svc: { nature: 'opex', frequency: 'quarterly', rate: 1500, qty: 5 } }] },
  { months: 18, lines: [
    { category: 'software', label: 'Install', hw: null, svc: { nature: 'capex', frequency: null, rate: 25000, qty: 1 } },
    { category: 'software', label: 'Support', hw: null, svc: { nature: 'opex', frequency: 'yearly', rate: 30000, qty: 2 } },
    { category: 'hardware', label: 'Device', hw: { sku: 'HW-3', nature: 'capex', frequency: null, rate: 9999.5, qty: 3 }, svc: null },
  ] },
  { months: null, lines: [{ category: 'software', label: 'No period', hw: null, svc: { nature: 'opex', frequency: 'monthly', rate: 500, qty: 4 } }] },
];

test('browser and server price formulas give the same totals', () => {
  for (const ex of EXAMPLES) {
    const a = server.computeServicesTotals(ex.lines, ex.months);
    const b = browser.computeServicesTotals(ex.lines, ex.months);
    assert.strictEqual(Number(b.tcvLakhs), Number(a.tcvLakhs), `Deal Value differs for ${JSON.stringify(ex)}`);
    assert.strictEqual(Number(b.acvLakhs), Number(a.acvLakhs), `Annual Value differs for ${JSON.stringify(ex)}`);
  }
});
