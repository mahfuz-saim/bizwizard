import { roundCurrency, totalRepaymentOf } from '../shared/money';

/**
 * The pinned benchmark baseline policies (PLAN §1.1.1). Deterministic, no LLM.
 * Alpha = realizedImpactSum − benchmarkImpact is only honest if these are
 * exact, share the AI's universe, and share its PD/LGD model. Policy version
 * is stored on every AgentPerformance row so history stays interpretable.
 */
export const BENCHMARK_POLICY_VERSION = 'pinned-v1';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/* ------------------------------- LENDER (flat rate) ------------------------------ */
export interface LenderBenchmarkLoan {
  amount: number;
  baseRate: number;
  interestRateMin: number;
  interestRateMax: number;
  fundingCostPct: number;
  tenorMonths: number;
  pd: number; // from the SAME risk model the LENDER_AGENT uses
  lgd: number;
  expectedTenorFraction: number;
}
export function lenderBenchmarkRate(l: Pick<LenderBenchmarkLoan, 'baseRate' | 'interestRateMin' | 'interestRateMax'>): number {
  // Clamp is required: baseRate + half-band may exceed the product's own max.
  return clamp(l.baseRate + (l.interestRateMax - l.interestRateMin) / 2, l.interestRateMin, l.interestRateMax);
}
export function lenderBenchmarkImpact(loans: LenderBenchmarkLoan[]): number {
  // Same ELIGIBLE universe as the AI — including loans the AI declined, whose
  // expected loss is counted against the benchmark. That is how "declining
  // the right loan" becomes positive alpha.
  return roundCurrency(
    loans.reduce((acc, l) => {
      const rate = lenderBenchmarkRate(l) / 100;
      const funding = l.fundingCostPct / 100;
      const spread = l.amount * (rate - funding) * l.expectedTenorFraction;
      const expectedLoss = l.amount * l.pd * l.lgd;
      return acc + spread - expectedLoss;
    }, 0),
  );
}

/* --------------------------- BORROWER (round-0 APR) ------------------------------ */
export interface OfferLike {
  id: string;
  offeredAmount: number;
  effectiveApr: number;
  totalRepayment: number;
}
export function borrowerBenchmarkPick<T extends OfferLike>(offers: T[]): T | null {
  if (!offers.length) return null;
  return [...offers].sort((a, b) => a.effectiveApr - b.effectiveApr)[0];
}
/** Benchmark cost = totalRepayment − offeredAmount on the round-0 pick. */
export function borrowerBenchmarkCost(offers: OfferLike[]): number {
  const pick = borrowerBenchmarkPick(offers);
  return pick ? roundCurrency(pick.totalRepayment - pick.offeredAmount) : 0;
}
export function borrowerCostOf(offer: OfferLike): number {
  return roundCurrency(offer.totalRepayment - offer.offeredAmount);
}
/** Positive when negotiation beat the benchmark's round-0 acceptance. */
export function borrowerAlpha(aiOffer: OfferLike, round0Offers: OfferLike[]): number {
  return roundCurrency(borrowerBenchmarkCost(round0Offers) - borrowerCostOf(aiOffer));
}

/* ------------------------- TREASURER (hold, collect @60d) ------------------------ */
export interface TreasurerBenchmarkDebt {
  amount: number;
  daysOverdue: number;
  collectedWithinHorizon: boolean;
}
export function treasurerBenchmarkImpact(debts: TreasurerBenchmarkDebt[]): number {
  // HOLD_CASH always; COLLECT_DEBT only once a debt passes 60 days overdue.
  return roundCurrency(
    debts
      .filter((d) => d.daysOverdue > 60 && d.collectedWithinHorizon)
      .reduce((a, d) => a + d.amount, 0),
  );
}

/* --------------------- ANALYST (equal weight, revenue rank) --------------------- */
export interface AnalystBenchmarkSku {
  key: string;
  revenue: number;
  realizedProfitImpact: number;
}
export function analystBenchmarkAllocation(skus: AnalystBenchmarkSku[], capital: number, topN = 5) {
  const top = [...skus].sort((a, b) => b.revenue - a.revenue).slice(0, topN);
  const weight = top.length ? 1 / top.length : 0;
  return top.map((s) => ({ key: s.key, allocated: roundCurrency(capital * weight), weight }));
}
export function analystBenchmarkImpact(skus: AnalystBenchmarkSku[], topN = 5): number {
  const top = [...skus].sort((a, b) => b.revenue - a.revenue).slice(0, topN);
  return roundCurrency(top.reduce((a, s) => a + s.realizedProfitImpact, 0));
}

export { totalRepaymentOf };
