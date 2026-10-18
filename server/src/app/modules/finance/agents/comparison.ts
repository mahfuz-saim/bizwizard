import { z } from 'zod';
import { borrowerBenchmarkPick, lenderBenchmarkImpact, treasurerBenchmarkImpact, analystBenchmarkAllocation, BENCHMARK_POLICY_VERSION } from './benchmarks';
import { roundCurrency, sumMoney, totalRepaymentOf, effectiveApr, monthlyPayment } from '../shared/money';

export const comparisonChoice = z.object({
  lend: z.boolean(),
  offerID: z.enum(['low-apr', 'low-cost', 'short-term']),
  collect: z.array(z.enum(['recent', 'overdue'])).max(2).refine(ids => new Set(ids).size === ids.length),
  allocation: z.array(z.number().min(0).max(1)).length(3).refine(weights => Math.abs(weights.reduce((a,b) => a+b,0) - 1) < 0.000001),
});
export type ComparisonChoice = z.infer<typeof comparisonChoice>;

export function comparisonInput(risk: number) {
  const offer = (id: string, rate: number, months: number) => ({ id, offeredAmount: 100000,
    effectiveApr: effectiveApr(100000,rate,months), totalRepayment: totalRepaymentOf(100000,rate,months),
    monthlyInstallment: monthlyPayment(100000,rate,months), tenorMonths: months });
  return {
    caseID: `risk-${risk}`,
    loan: { amount: 100000, baseRate: 10, interestRateMin: 10, interestRateMax: 20, fundingCostPct: 5, tenorMonths: 12, pd: risk, lgd: 0.55, expectedTenorFraction: 1 },
    offers: [
      offer('low-apr',12,24), offer('low-cost',16,12), offer('short-term',20,6),
    ],
    maxInstallment: 10000,
    debts: [{ id: 'recent', amount: 3000, daysOverdue: 40 }, { id: 'overdue', amount: 1000, daysOverdue: 90 }],
    skus: [
      { key: 'high-revenue', revenue: 10000, margin: 0.1 },
      { key: 'high-margin', revenue: 6000, margin: 0.3 },
      { key: 'balanced', revenue: 7000, margin: 0.2 },
    ],
    capital: 3000,
  };
}

export function fixtureChoice(input: ReturnType<typeof comparisonInput>): ComparisonChoice {
  const feasible = input.offers.filter(o => o.monthlyInstallment <= input.maxInstallment).sort((a,b) => a.totalRepayment - b.totalRepayment);
  return { lend: input.loan.pd < 0.2, offerID: feasible[0].id as ComparisonChoice['offerID'], collect: ['recent','overdue'], allocation: [0,1,0] };
}

export function measureComparison(input: ReturnType<typeof comparisonInput>, rawChoice: ComparisonChoice) {
  const choice = comparisonChoice.parse(rawChoice);
  const selected = input.offers.find(o => o.id === choice.offerID)!;
  if (selected.monthlyInstallment > input.maxInstallment) throw new Error('Borrower choice violates the shared affordability constraint');
  const baselineOffer = borrowerBenchmarkPick(input.offers.filter(o => o.monthlyInstallment <= input.maxInstallment))!;
  const benchmarkLender = lenderBenchmarkImpact([input.loan]);
  const rate = Math.min(input.loan.interestRateMax, input.loan.baseRate + input.loan.pd * 20);
  const participantLender = choice.lend ? roundCurrency(input.loan.amount * ((rate - input.loan.fundingCostPct) / 100) * input.loan.expectedTenorFraction - input.loan.amount * input.loan.pd * input.loan.lgd) : 0;
  const benchmarkTreasurer = treasurerBenchmarkImpact(input.debts.map(d => ({ ...d, daysOverdue: d.daysOverdue + 29, collectedWithinHorizon: true })));
  const participantTreasurer = sumMoney(input.debts.filter(d => choice.collect.includes(d.id as 'recent' | 'overdue')).map(d => d.amount));
  const baselineAlloc = analystBenchmarkAllocation(input.skus.map(s => ({ ...s, realizedProfitImpact: 0 })), input.capital, 3);
  const benchmarkAnalyst = sumMoney(baselineAlloc.map(a => a.allocated * input.skus.find(s => s.key === a.key)!.margin));
  const participantAnalyst = sumMoney(input.skus.map((s,i) => input.capital * choice.allocation[i] * s.margin));
  const row = (agent: string, metric: string, baseline: number, participant: number, higherIsBetter = true) => ({
    agent, metric, currency: 'BDT', baseline: roundCurrency(baseline), participant: roundCurrency(participant),
    differenceInFavourOfParticipant: roundCurrency((participant - baseline) * (higherIsBetter ? 1 : -1)),
  });
  return {
    caseID: input.caseID, policyVersion: BENCHMARK_POLICY_VERSION, input, choice,
    basis: 'synthetic-model-comparison-not-realized-profit',
    assumptions: [
      'Lender values are model-expected returns, not observed repayments; both policies share PD, LGD, funding cost and eligible universe.',
      'Borrower compares contracted total cost for equal principal; tenors differ, and both choices respect the same installment ceiling. No loan is disbursed.',
      'Treasury replay assumes requested collections succeed: the participant requests on day 1; the baseline requests once a debt exceeds 60 days overdue during the same 30-day horizon. Gross collections are not profit; timing benefits and collection costs are not scored.',
      'Analyst assumes the stated margin is the incremental return per allocated taka, with no demand or capacity constraint. This is a deliberately simplified model, not causal evidence.',
    ],
    measurements: [
      row('LENDER_AGENT','expected-net-return',benchmarkLender,participantLender),
      row('BORROWER_AGENT','contracted-borrowing-cost',baselineOffer.totalRepayment-baselineOffer.offeredAmount,selected.totalRepayment-selected.offeredAmount,false),
      row('TREASURER_AGENT','30-day-modeled-gross-collections',benchmarkTreasurer,participantTreasurer),
      row('ANALYST_AGENT','modeled-capital-return',benchmarkAnalyst,participantAnalyst),
    ],
  };
}
