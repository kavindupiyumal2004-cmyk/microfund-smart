const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');
const rules = require('../src/middleware/loanTypeValidation');

async function errors(overrides = {}) {
  const req = { body: { name: 'Business loan', min_amount: 1000, max_amount: 100000,
    annual_interest_rate: 12.5, duration_months: 12, ...overrides } };
  for (const rule of rules()) await rule.run(req);
  return validationResult(req).array();
}

test('loan product accepts valid decimal values and zero interest', async () => {
  assert.deepEqual(await errors({ min_amount: 1000.50, annual_interest_rate: 0 }), []);
});
test('loan product rejects reversed amount range', async () => {
  assert.ok((await errors({ max_amount: 999 })).some((error) => error.path === 'max_amount'));
});
test('loan product rejects invalid duration, interest and blank name', async () => {
  for (const [field, value] of [['duration_months', 0], ['duration_months', 1.5], ['annual_interest_rate', -1], ['name', '   ']]) {
    assert.ok((await errors({ [field]: value })).some((error) => error.path === field));
  }
});
