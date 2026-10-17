import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  lenderBenchmarkRate, lenderBenchmarkImpact, borrowerBenchmarkCost, borrowerAlpha,
  treasurerBenchmarkImpact, analystBenchmarkAllocation, BENCHMARK_POLICY_VERSION,
} from './benchmarks';
import { runNegotiation, priceOfferCore, borrowerDecision } from './agentCore';
import { buildProfile } from '../shared/metricEngine';

test('benchmark policy is pinned and versioned', () => {
  assert.equal(BENCHMARK_POLICY_VERSION, 'pinned-v1');
});

test('lender benchmark: flat rate is clamped to the product band', () => {
  assert.equal(lenderBenchmarkRate({ baseRate: 18, interestRateMin: 10, interestRateMax: 20 }), 20);
  assert.equal(lenderBenchmarkRate({ baseRate: 10, interestRateMin: 10, interestRateMax: 20 }), 15);
});

test('lender benchmark counts expected loss on loans the AI declined (same universe)', () => {
  const impact = lenderBenchmarkImpact([
    { amount: 100000, baseRate: 10, interestRateMin: 10, interestRateMax: 20, fundingCostPct: 5, tenorMonths: 12, pd: 0.5, lgd: 0.5, expectedTenorFraction: 1 },
  ]);
  // spread 100000*(0.15-0.05)=10000 minus expected loss 25000 => -15000
  assert.equal(impact, -15000);
});

test('borrower benchmark accepts round-0 lowest APR; alpha is on total cost', () => {
  const offers = [
    { id: 'a', offeredAmount: 100000, effectiveApr: 14, totalRepayment: 128000 }, // cheap APR, expensive total
    { id: 'b', offeredAmount: 100000, effectiveApr: 16, totalRepayment: 116000 },
  ];
  assert.equal(borrowerBenchmarkCost(offers), 28000);
  assert.equal(borrowerAlpha(offers[1], offers), 12000);
});

test('treasurer benchmark only collects after 60 days', () => {
  assert.equal(
    treasurerBenchmarkImpact([
      { amount: 1000, daysOverdue: 30, collectedWithinHorizon: true },
      { amount: 2000, daysOverdue: 90, collectedWithinHorizon: true },
      { amount: 4000, daysOverdue: 90, collectedWithinHorizon: false },
    ]),
    2000,
  );
});

test('analyst benchmark allocates equally across revenue-top SKUs', () => {
  const alloc = analystBenchmarkAllocation(
    [{ key: 'a', revenue: 100, realizedProfitImpact: 5 }, { key: 'b', revenue: 50, realizedProfitImpact: 7 }],
    1000,
  );
  assert.deepEqual(alloc.map((a) => a.allocated), [500, 500]);
});

const richProfile = buildProfile({
  windowDays: 90,
  salesByDay: Array.from({ length: 60 }, (_, i) => ({ date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`, amount: 9000 })),
  revenue: 900000, grossSales: 900000, discounts: 0, cogs: 630000, opex: 120000, shrinkage: 0,
  transactionCount: 300, currentCash: 150000, receivables: 60000, payables: 0, inventoryValue: 200000,
  debtOutstanding: 0, existingMonthlyDebtService: 0, daysWithSales: 70,
  firstActivityDate: '2023-01-01', asOf: new Date('2026-10-01T00:00:00Z'),
});

test('negotiation converges within 3 rounds (10 seeded runs)', () => {
  for (let i = 0; i < 10; i++) {
    const result = runNegotiation({
      offeredAmount: 300000, offeredRate: 18 + (i % 3), tenorMonths: 6, processingFeePct: 1.5,
      monthlyFreeCashFlow: 25000, grossMarginPct: 30, ownerMaxRate: 20,
      productRateMin: 12, riskAppetite: 0.4 + (i % 5) * 0.1,
    });
    assert.ok(result.steps.length <= 6, `run ${i} exceeded round cap`);
    assert.ok(['ACCEPTED', 'REJECTED', 'MAX_ROUNDS'].includes(result.outcome));
  }
});

test('lender can decline a high-risk, sparse-data profile', () => {
  const risky = buildProfile({
    windowDays: 90, salesByDay: [{ date: '2026-09-01', amount: 100 }], revenue: 2000, grossSales: 2000,
    discounts: 0, cogs: 1900, opex: 500, shrinkage: 0, transactionCount: 2, currentCash: 0,
    receivables: 5000, payables: 0, inventoryValue: 0, debtOutstanding: 5000,
    existingMonthlyDebtService: 0, daysWithSales: 20, firstActivityDate: '2026-08-01',
    asOf: new Date('2026-10-01T00:00:00Z'),
  });
  // Force the volatility/DSO drivers high so PD crosses the decline line.
  const priced = priceOfferCore({
    product: {
      id: 'p', name: 'Loan', productType: 'TERM_LOAN', minAmount: 1000, maxAmount: 100000,
      minTenorMonths: 3, maxTenorMonths: 12, interestRateMin: 10, interestRateMax: 30,
      processingFeePct: 2, collateralRequired: false, collateralTypes: [], requiredDocs: [],
      minBusinessAgeMonths: 0, minMonthlyRevenue: 0, maxDebtToRevenue: 1,
      requiresGSTIN: false, requiresBankStatements: false, sectorFit: ['*'], renewalAllowed: false,
    },
    profile: { ...richProfile, ...risky, salesVolatility: 3, dso: 300, dataCompleteness: 0.1 },
    requestedAmount: 50000, tenorMonths: 6, providerBaseRate: 15, providerRiskAppetite: 0.2,
    maxAffordableAmount: 50000,
  });
  assert.equal(priced.decline, true);
});

test('borrower rejects an APR above gross margin', () => {
  const decision = borrowerDecision({
    offeredAmount: 100000, offeredRate: 40, tenorMonths: 6, processingFeePct: 3,
    monthlyFreeCashFlow: 100000, grossMarginPct: 22,
  });
  assert.equal(decision.decision, 'REJECT');
});
