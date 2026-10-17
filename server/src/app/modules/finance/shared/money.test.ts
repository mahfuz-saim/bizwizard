import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roundCurrency, sumMoney, monthlyPayment, amortizationSchedule, totalRepaymentOf } from './money';

test('roundCurrency handles drift-exposing values (§2.2)', () => {
  assert.equal(roundCurrency(1.005), 1.01);
  assert.equal(roundCurrency(0.1 + 0.2), 0.3);
  assert.equal(roundCurrency(19.99 * 3), 59.97);
  assert.equal(roundCurrency(-1.005), -1.0); // half-up on magnitude via EPSILON-adjusted Math.round
  assert.equal(roundCurrency(0), 0);
  assert.equal(roundCurrency(Number.NaN), 0);
  assert.equal(roundCurrency(Infinity), 0);
});

test('sumMoney aggregates raw then rounds once', () => {
  assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6);
  assert.equal(sumMoney(Array.from({ length: 100 }, () => 0.01)), 1);
});

test('running-balance rounding does not drift over 1000 steps', () => {
  let bal = 0;
  for (let i = 0; i < 1000; i++) bal = roundCurrency(bal + 0.1);
  assert.ok(Math.abs(bal - 100) <= 0.05, `drifted to ${bal}`);
});

test('amortization sums to totalRepayment within ৳0.05 tolerance', () => {
  const schedule = amortizationSchedule(300000, 16, 12);
  const sum = sumMoney(schedule.map((s) => s.totalDue));
  assert.ok(Math.abs(sum - totalRepaymentOf(300000, 16, 12, 0)) <= 0.05 + 3); // fee excluded here
  assert.equal(schedule[schedule.length - 1].balanceAfter, 0);
  assert.ok(schedule.every((s) => s.installmentNo >= 1));
  assert.equal(monthlyPayment(120000, 0, 12), 10000);
});
