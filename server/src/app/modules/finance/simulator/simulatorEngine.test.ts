import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seedFromString,
  mulberry32,
  buildSimulationPlan,
  amplifierTopUp,
  buildAnomalyInsight,
  buildGuardBlockedOfferScenario,
  buildReconciledTreasuryAction,
} from './simulatorEngine';

const ASOF = new Date('2026-10-17T00:00:00.000Z');

test('seedFromString is deterministic and shop-specific', () => {
  assert.equal(seedFromString('shop-1'), seedFromString('shop-1'));
  assert.notEqual(seedFromString('shop-1'), seedFromString('shop-2'));
});

test('mulberry32 produces the same sequence for the same seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  for (const v of seqA) {
    assert.ok(v >= 0 && v < 1);
  }
});

test('buildSimulationPlan is deterministic for a fixed seed and spans exactly 30 days ending at asOf', () => {
  const input = { seed: seedFromString('shop-demo'), asOf: ASOF, baselineDailyRevenue: 8000, baselineDailyOutflow: 5000 };
  const planA = buildSimulationPlan(input);
  const planB = buildSimulationPlan(input);
  assert.deepEqual(planA, planB);
  assert.equal(planA.days.length, 30);
  assert.equal(planA.days[29].date, '2026-10-17');
  assert.equal(planA.days[0].date, '2026-09-18');
});

test('buildSimulationPlan guarantees exactly one anomaly day with a large one-off expense', () => {
  const plan = buildSimulationPlan({ seed: 7, asOf: ASOF, baselineDailyRevenue: 8000, baselineDailyOutflow: 5000 });
  const anomalyDays = plan.days.filter((d) => d.phase === 'ANOMALY');
  assert.equal(anomalyDays.length, 1);
  assert.equal(anomalyDays[0].day, plan.anomalyDay);
  assert.ok(anomalyDays[0].expense && anomalyDays[0].expense.amount === plan.anomalyAmount);
  // anomaly must dwarf a normal day's expense (>5x baseline outflow)
  assert.ok(plan.anomalyAmount > 5000 * 5);
});

test('buildSimulationPlan guarantees a large unpaid receivable and an earlier small debt that gets collected', () => {
  const plan = buildSimulationPlan({ seed: 123, asOf: ASOF, baselineDailyRevenue: 6000, baselineDailyOutflow: 4000 });
  const bigDebtDay = plan.days.find((d) => d.day === plan.bigDebtDay);
  assert.ok(bigDebtDay?.debtIssued);
  assert.equal(bigDebtDay?.debtIssued?.amount, plan.bigDebtAmount);
  assert.ok(plan.bigDebtAmount > 6000 * 3);

  const smallDebtDay = plan.days.find((d) => d.day === plan.smallDebtDay);
  assert.ok(smallDebtDay?.debtIssued);
  const collectDay = plan.days.find((d) => d.day === plan.smallDebtCollectDay);
  assert.ok(collectDay?.debtCollectsEarlierDebt);
  assert.ok(plan.smallDebtCollectDay > plan.smallDebtDay);
});

test('buildSimulationPlan worsens materially in the last week (CRISIS) vs the opening (HEALTHY)', () => {
  const plan = buildSimulationPlan({ seed: 99, asOf: ASOF, baselineDailyRevenue: 10000, baselineDailyOutflow: 6000 });
  const healthy = plan.days.filter((d) => d.phase === 'HEALTHY');
  const crisis = plan.days.filter((d) => d.phase === 'CRISIS');
  assert.ok(crisis.length >= 5);
  const avgNet = (rows: typeof healthy) =>
    rows.reduce((a, d) => a + (d.sale?.amount ?? 0) - (d.expense?.amount ?? 0), 0) / rows.length;
  assert.ok(avgNet(crisis) < avgNet(healthy), 'crisis-phase net cash flow should be worse than the healthy opening');
});

test('buildSimulationPlan falls back to sane floors for a brand-new shop with ~0 history', () => {
  const plan = buildSimulationPlan({ seed: 1, asOf: ASOF, baselineDailyRevenue: 0, baselineDailyOutflow: 0 });
  assert.ok(plan.days.every((d) => (d.sale?.amount ?? 0) > 0));
  assert.ok(plan.anomalyAmount > 0);
});

test("buildSimulationPlan 'LESS' template mirrors sale/expense 1:1 and is identical to the untemplated plan", () => {
  const input = { seed: seedFromString('shop-template'), asOf: ASOF, baselineDailyRevenue: 7000, baselineDailyOutflow: 4500 };
  const untemplated = buildSimulationPlan(input);
  const less = buildSimulationPlan({ ...input, template: 'LESS' as const });
  assert.deepEqual(untemplated, less, "omitting template must behave exactly like template: 'LESS'");
  for (const d of less.days) {
    assert.equal(d.sales.length, d.sale ? 1 : 0);
    assert.equal(d.expenses.length, d.expense ? 1 : 0);
    if (d.sale) assert.equal(d.sales[0].amount, d.sale.amount);
    if (d.expense) assert.equal(d.expenses[0].amount, d.expense.amount);
  }
});

test("buildSimulationPlan 'MORE' template produces roughly 3x the transaction rows of 'LESS', and every day's split rows reconstruct that day's own sale total", () => {
  const input = { seed: seedFromString('shop-template-2'), asOf: ASOF, baselineDailyRevenue: 9000, baselineDailyOutflow: 5500 };
  const less = buildSimulationPlan({ ...input, template: 'LESS' as const });
  const more = buildSimulationPlan({ ...input, template: 'MORE' as const });

  const countRows = (plan: typeof less) => plan.days.reduce((n, d) => n + d.sales.length + d.expenses.length, 0);
  const lessCount = countRows(less);
  const moreCount = countRows(more);
  assert.ok(moreCount > lessCount * 2, `expected 'MORE' (${moreCount} rows) to be well over 2x 'LESS' (${lessCount} rows)`);
  // 'MORE' always fans a sale out into (at least) 3 rows/day.
  assert.ok(more.days.every((d) => d.sales.length === 3));

  // Each day's split sale rows must reconstruct that same day's own aggregate
  // total exactly (no money invented or lost by the fan-out), for both plans.
  for (const d of more.days) {
    const splitTotal = d.sales.reduce((a, s) => a + s.amount, 0);
    assert.ok(Math.abs(splitTotal - (d.sale?.amount ?? 0)) < 0.01);
  }
  for (const d of less.days) {
    const splitTotal = d.sales.reduce((a, s) => a + s.amount, 0);
    assert.ok(Math.abs(splitTotal - (d.sale?.amount ?? 0)) < 0.01);
  }
});

test('amplifierTopUp grows with each retry attempt and stays deterministic per attempt', () => {
  const a1 = amplifierTopUp(1, 5000, 42);
  const a2 = amplifierTopUp(2, 5000, 42);
  assert.ok(a2 > a1);
  assert.equal(amplifierTopUp(1, 5000, 42), a1);
});

test('buildAnomalyInsight is VERIFIED by construction (candidate contribution == full gap)', () => {
  const plan = buildSimulationPlan({ seed: 5, asOf: ASOF, baselineDailyRevenue: 8000, baselineDailyOutflow: 5000 });
  const insight = buildAnomalyInsight(plan);
  assert.equal(insight.verification.status, 'VERIFIED');
  assert.ok(insight.verification.residualPct <= 10);
  assert.equal(insight.candidate.contribution, plan.anomalyAmount);
});

test('buildGuardBlockedOfferScenario is rejected by the real guard (high APR, short tenor, thin affordability)', () => {
  const product = {
    maxAmount: 600000,
    minAmount: 25000,
    minTenorMonths: 2,
    maxTenorMonths: 8,
    interestRateMax: 30,
    interestRateMin: 20,
    processingFeePct: 3,
    collateralRequired: false,
  };
  const scenario = buildGuardBlockedOfferScenario(product, 8000, 42);
  assert.equal(scenario.verdict.passed, false);
  assert.ok(scenario.verdict.reasons.length > 0);
  assert.ok(scenario.effectiveAprPct > 20);
  assert.match(scenario.toastMessage, /GUARD BLOCKED/);
  assert.match(scenario.toastMessage, /affordability cap/);
});

test('buildReconciledTreasuryAction passes once the collection is applied to the trajectory, and reports alpha-positive realized impact', () => {
  const dailyClosingBalances = [10000, 5000, -2000, -8000, -12000, -5000, 3000, 9000];
  const result = buildReconciledTreasuryAction({
    debtAmount: 15000,
    dailyClosingBalances,
    effectDayIndex: 2,
    maxExposure: 500000,
    seed: 42,
  });
  assert.equal(result.verdict.passed, true);
  assert.ok(Math.min(...result.adjustedBalances.slice(2)) >= 0, 'the lowest post-collection balance should clear the floor');
  assert.ok(result.realizedImpact > result.projectedImpact, 'realized should beat the conservative projection');
});

test('buildReconciledTreasuryAction is rejected when it would still breach the floor (e.g. collection too small)', () => {
  const dailyClosingBalances = [1000, -50000, -60000];
  const result = buildReconciledTreasuryAction({
    debtAmount: 100,
    dailyClosingBalances,
    effectDayIndex: 0,
    maxExposure: 500000,
    seed: 1,
  });
  assert.equal(result.verdict.passed, false);
});
