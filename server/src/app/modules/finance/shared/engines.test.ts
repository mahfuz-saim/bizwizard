import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProfile, productEconomics, concentration, detectAnomalies, forecastDaily } from './metricEngine';
import { dailyNetSeries, buildProjection } from './cashEngine';
import { evaluateEligibility, type ProductLike } from './eligibility';
import { guardOffer, guardTreasuryActions, clampAiScore } from './guard';
import { verifyHypothesis } from './verifier';

const profile = buildProfile({
  windowDays: 90,
  salesByDay: Array.from({ length: 20 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, amount: 10000 })),
  revenue: 900000, grossSales: 950000, discounts: 50000, cogs: 630000, opex: 150000, shrinkage: 0,
  transactionCount: 300, currentCash: 120000, receivables: 90000, payables: 0, inventoryValue: 210000,
  debtOutstanding: 0, existingMonthlyDebtService: 0, daysWithSales: 60,
  firstActivityDate: '2024-01-01', asOf: new Date('2026-10-01T00:00:00Z'),
});

test('metric engine: margins, CCC components and completeness', () => {
  assert.equal(profile.grossMargin, 30);
  assert.equal(profile.monthlyRevenue, 300000);
  assert.ok(profile.dataCompleteness > 0.6);
  assert.ok(profile.cashConversionCycle === profile.dso + profile.dio - profile.dpo);
});

test('sparse-data profile falls below the matching gate', () => {
  const sparse = buildProfile({
    windowDays: 90, salesByDay: [], revenue: 5000, grossSales: 5000, discounts: 0, cogs: 3000, opex: 1000,
    shrinkage: 0, transactionCount: 4, currentCash: 0, receivables: 0, payables: 0, inventoryValue: 0,
    debtOutstanding: 0, existingMonthlyDebtService: 0, daysWithSales: 5,
    firstActivityDate: '2026-09-01', asOf: new Date('2026-10-01T00:00:00Z'),
  });
  assert.ok(sparse.dataCompleteness < 0.6);
});

const product: ProductLike = {
  id: 'p1', name: 'WC', productType: 'WORKING_CAPITAL', minAmount: 50000, maxAmount: 1000000,
  minTenorMonths: 3, maxTenorMonths: 12, interestRateMin: 13, interestRateMax: 19, processingFeePct: 1.5,
  collateralRequired: false, minBusinessAgeMonths: 6, minMonthlyRevenue: 80000, maxDebtToRevenue: 0.5,
  requiresGSTIN: false, requiresBankStatements: true, sectorFit: ['*'], renewalAllowed: true,
};

test('eligibility: eligible, near-miss and ineligible gates', () => {
  const req = { requestedAmount: 300000, tenorMonths: 6, hasBankStatements: true };
  assert.equal(evaluateEligibility(product, profile, req).status, 'ELIGIBLE');
  const lowRevenue = { ...profile, monthlyRevenue: 76000 }; // 5% below the 80k floor, one soft rule
  assert.equal(evaluateEligibility(product, lowRevenue, req).status, 'NEAR_MISS');
  const twoFails = { ...profile, monthlyRevenue: 1000, businessAgeMonths: 1 };
  assert.equal(evaluateEligibility(product, twoFails, req).status, 'INELIGIBLE');
  assert.equal(evaluateEligibility(product, profile, { ...req, requestedAmount: 5000000 }).status, 'INELIGIBLE');
});

test('guard blocks affordability breaches and clamps AI scores', () => {
  const verdict = guardOffer({
    offeredAmount: 900000, offeredRate: 18, tenorMonths: 6, advanceRate: 0.8,
    maxAffordableAmount: 400000, productMinTenor: 3, productMaxTenor: 12, productRateMax: 19,
  });
  assert.equal(verdict.passed, false);
  assert.ok(verdict.reasons.some((r) => r.includes('affordability')));
  assert.equal(clampAiScore(50, 90), 65);
  assert.equal(clampAiScore(50, 10), 35);
  const floor = guardTreasuryActions({
    actions: [{ actionType: 'SWEEP_IDLE_CASH', amount: 1000, projectedImpact: 10 }],
    maxExposure: 5000, projectedBalancesAfter: [100, -5], bufferFloorAmount: 0,
  });
  assert.equal(floor.passed, false);
});

test('cash projection: hand-computed 7-day fixture finds trough and shortfall', () => {
  const asOf = new Date('2026-10-01T00:00:00Z');
  const txns = Array.from({ length: 28 }, (_, i) => ({
    occurredAt: new Date(asOf.getTime() - i * 86400000), direction: (i % 2 ? 'OUT' : 'IN') as 'IN' | 'OUT', amount: 1000,
  }));
  const history = dailyNetSeries(txns, 28, asOf);
  const result = buildProjection({
    openingBalance: 5000, history, asOf, horizonDays: 7,
    commitments: [{ name: 'Rent', amount: 20000, dueDate: new Date(asOf.getTime() + 2 * 86400000), recurrence: 'NONE', confidence: 1 }],
    receivables: [],
  });
  assert.equal(result.dailyBuckets.length, 7);
  assert.ok(result.minProjectedBalance < 5000);
  assert.ok(result.shortfallDate !== null);
});

test('verifier: verified when the candidate explains the gap, refuted otherwise', () => {
  const verified = verifyHypothesis(-17300, { id: 'c1', label: 'Tea (Wholesale)', kind: 'CUSTOMER', contribution: -16700 });
  assert.equal(verified.status, 'VERIFIED');
  assert.ok(verified.residualPct <= 10);
  const refuted = verifyHypothesis(-17300, { id: 'c2', label: 'Walk-ins', kind: 'CUSTOMER', contribution: -1000 });
  assert.equal(refuted.status, 'REFUTED');
});

test('product economics quadrants and concentration HHI', () => {
  const econ = productEconomics([
    { productKey: 'a', productName: 'Rice', revenue: 50000, cogs: 30000, units: 100, inventoryValue: 5000, daysSinceLastSale: 1 },
    { productKey: 'b', productName: 'Old stock', revenue: 100, cogs: 90, units: 1, inventoryValue: 40000, daysSinceLastSale: 90 },
  ]);
  assert.equal(econ[0].productKey, 'a');
  const conc = concentration([{ key: 'x', label: 'X', amount: 800 }, { key: 'y', label: 'Y', amount: 200 }]);
  assert.equal(conc.top1Share, 80);
  assert.ok(conc.hhi > 0.25);
});

test('anomaly detector flags a DOW-adjusted crash; forecast reports MAPE', () => {
  const series = Array.from({ length: 60 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10),
    amount: 10000 + (i % 7) * 100,
  }));
  series[59] = { ...series[59], amount: 500 };
  const anomalies = detectAnomalies(series);
  assert.ok(anomalies.some((a) => a.date === series[59].date));
  const forecast = forecastDaily(series, 14, new Date('2026-10-01T00:00:00Z'));
  assert.equal(forecast.series.length, 14);
  assert.ok(forecast.backtestMAPE === null || forecast.backtestMAPE >= 0);
});
