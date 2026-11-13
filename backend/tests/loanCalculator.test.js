const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFlatRateLoan } = require('../src/utils/loanCalculator');

test('calculates a 12-month flat-rate loan', () => {
  const result = calculateFlatRateLoan({ principal: 120000, annualInterestRate: 12, durationMonths: 12, startDate: '2026-08-01' });
  assert.equal(result.totalInterest, 14400);
  assert.equal(result.totalPayable, 134400);
  assert.equal(result.startDate, '2026-08-01');
  assert.equal(result.endDate, '2027-07-01');
  assert.equal(result.schedule.length, 12);
  assert.equal(result.schedule.reduce((sum, row) => Number((sum + row.amount_due).toFixed(2)), 0), result.totalPayable);
});

test('keeps end-of-month schedules valid', () => {
  const result = calculateFlatRateLoan({ principal: 120000, annualInterestRate: 0, durationMonths: 3, startDate: '2026-01-31' });
  assert.deepEqual(result.schedule.map((row) => row.due_date), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('rejects invalid values', () => {
  assert.throws(() => calculateFlatRateLoan({ principal: -1, annualInterestRate: 12, durationMonths: 12, startDate: '2026-08-01' }));
  assert.throws(() => calculateFlatRateLoan({ principal: 1000, annualInterestRate: 12, durationMonths: 0, startDate: '2026-08-01' }));
  assert.throws(() => calculateFlatRateLoan({ principal: 1000, annualInterestRate: 12, durationMonths: 1, startDate: 'invalid' }));
});

test('uses weekly installments through 100000 and monthly above the threshold', () => {
  for (const principal of [30000, 100000, 100000.01]) {
    const result = calculateFlatRateLoan({ principal, annualInterestRate: 12, durationMonths: 3, startDate: '2026-01-31' });
    const weekly = principal <= 100000;
    assert.equal(result.repaymentFrequency, weekly ? 'WEEKLY' : 'MONTHLY');
    assert.equal(result.schedule.length, weekly ? 13 : 3);
    assert.equal(result.schedule[1].due_date, weekly ? '2026-02-07' : '2026-02-28');
    assert.equal(result.schedule.reduce((sum, row) => Number((sum + row.amount_due).toFixed(2)), 0), result.totalPayable);
  }
});
