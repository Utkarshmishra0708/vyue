const test = require('node:test');
const assert = require('node:assert');
const { nameParts, pickUsername } = require('../services/username');

test('the first person called Priya Nair is Priya.Nair', () => {
  assert.strictEqual(pickUsername('Priya Nair', new Set()), 'Priya.Nair');
});

test('the second, third and fourth get a number after the first name', () => {
  const taken = new Set();
  const made = [];
  for (let i = 0; i < 4; i++) { const u = pickUsername('Priya Nair', taken); taken.add(u.toLowerCase()); made.push(u); }
  assert.deepStrictEqual(made, ['Priya.Nair', 'Priya1.Nair', 'Priya2.Nair', 'Priya3.Nair']);
});

test('a free number is reused (a gap is filled), and capitals do not matter', () => {
  assert.strictEqual(pickUsername('Priya Nair', new Set(['priya.nair', 'priya2.nair'])), 'Priya1.Nair');
  assert.strictEqual(pickUsername('PRIYA NAIR', new Set(['priya.nair'])), 'Priya1.Nair');
});

test('the same name in different capitals is the same person-name', () => {
  assert.strictEqual(pickUsername('priya nair', new Set()), 'Priya.Nair');
  assert.strictEqual(pickUsername('PRIYA NAIR', new Set()), 'Priya.Nair');
});

test('a middle name is skipped: first word and last word are used', () => {
  assert.deepStrictEqual(nameParts('Mary Ann Smith'), { first: 'Mary', last: 'Smith' });
});

test('one word only: just that word, then numbered', () => {
  assert.strictEqual(pickUsername('Rishab', new Set()), 'Rishab');
  assert.strictEqual(pickUsername('Rishab', new Set(['rishab'])), 'Rishab1');
});

test('a note in brackets is ignored', () => {
  assert.strictEqual(pickUsername('Riya Shah (Acme Sales)', new Set()), 'Riya.Shah');
  assert.strictEqual(pickUsername('Priya Nair (Pune)', new Set()), 'Priya.Nair');
});

test('accents and punctuation are removed', () => {
  assert.strictEqual(pickUsername('José Álvarez', new Set()), 'Jose.Alvarez');
  assert.strictEqual(pickUsername("D'Souza Rao", new Set()), 'DSouza.Rao');
  assert.strictEqual(pickUsername('Anna-Maria O’Neil', new Set()), 'AnnaMaria.ONeil');
});

test('names typed in mixed case keep their capitals', () => {
  assert.strictEqual(pickUsername('Ronan McDonald', new Set()), 'Ronan.McDonald');
});

test('an empty or symbol-only name still gets a username', () => {
  assert.strictEqual(pickUsername('', new Set()), 'User');
  assert.strictEqual(pickUsername('???', new Set()), 'User');
  assert.strictEqual(pickUsername('', new Set(['user'])), 'User1');
});

test('very long names are shortened', () => {
  const u = pickUsername('A'.repeat(80) + ' ' + 'B'.repeat(80), new Set());
  assert.ok(u.length <= 62, u.length);
});
