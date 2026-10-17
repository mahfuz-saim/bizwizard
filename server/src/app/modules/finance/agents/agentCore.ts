import { roundCurrency, monthlyPayment, totalRepaymentOf, effectiveApr } from '../shared/money';
import { clampAiScore } from '../shared/guard';
import type { BusinessProfile } from '../shared/metricEngine';
import type { ProductLike } from '../shared/eligibility';

/**
 * Agent decision cores (PLAN §4.3[5][6], §5.3[5]). The *numbers* here are
 * deterministic functions of the profile; an LLM (when configured) only picks
 * positioning/wording around them. These cores are what the benchmarks in
 * benchmarks.ts are scored against, so they must stay pure.
 */
export function probabilityOfDefault(p: BusinessProfile): number {
  const vol = Math.min(0.35, Math.max(0, p.salesVolatility) * 0.12);
  const dsoRisk = Math.min(0.2, Math.max(0, (p.dso - 30) / 300));
  const drRisk = Math.min(0.2, Math.max(0, p.debtToRevenue) * 0.15);
  const dataRisk = (1 - p.dataCompleteness) * 0.15;
  return Math.round(Math.min(0.6, 0.03 + vol + dsoRisk + drRisk + dataRisk) * 10000) / 10000;
}
export function lossGivenDefault(hasCollateral: boolean): number {
  return hasCollateral ? 0.35 : 0.55;
}
export function riskPremiumBps(p: BusinessProfile, riskAppetite: number): number {
  // Deterministic premium: PD-driven, softened by lender risk appetite (0..1).
  const pd = probabilityOfDefault(p);
  const premium = pd * 40 * (1.2 - Math.max(0, Math.min(1, riskAppetite)));
  return Math.round(Math.max(0.5, Math.min(18, premium)) * 100) / 100;
}

export interface PricedOffer {
  decline: boolean;
  offeredAmount: number;
  offeredRate: number;
  tenorMonths: number;
  advanceRate: number;
  effectiveApr: number;
  totalRepayment: number;
  confidence: number;
  rationale: string;
  conditions: string[];
  pd: number;
  lgd: number;
}

export function priceOfferCore(input: {
  product: ProductLike & { processingFeePct: number; collateralTypes: string[]; requiredDocs: string[] };
  profile: BusinessProfile;
  requestedAmount: number;
  tenorMonths: number;
  providerBaseRate: number;
  providerRiskAppetite: number;
  maxAffordableAmount: number;
}): PricedOffer {
  const { product, profile } = input;
  const pd = probabilityOfDefault(profile);
  const lgd = lossGivenDefault(product.collateralRequired);
  const premium = riskPremiumBps(profile, input.providerRiskAppetite);
  const rawRate = input.providerBaseRate + premium;
  const offeredRate = roundCurrency(
    Math.max(product.interestRateMin, Math.min(product.interestRateMax, rawRate)) * 100,
  ) / 100;
  const confidence =
    Math.round(
      Math.max(
        0,
        Math.min(1, 0.9 - pd * 1.2 - (1 - profile.dataCompleteness) * 0.3 + input.providerRiskAppetite * 0.1),
      ) * 100,
    ) / 100;
  const offeredAmount = roundCurrency(
    Math.min(input.requestedAmount, Math.max(0, input.maxAffordableAmount), product.maxAmount),
  );
  const advanceRate = product.collateralRequired ? 0.75 : 1;
  // A lender that won't lend is a valid, valuable outcome (§4.3[5]).
  const decline = confidence < 0.35 || pd > 0.45 || offeredAmount <= 0;
  return {
    decline,
    offeredAmount,
    offeredRate,
    tenorMonths: Math.max(product.minTenorMonths, Math.min(product.maxTenorMonths, input.tenorMonths)),
    advanceRate,
    effectiveApr: effectiveApr(offeredAmount, offeredRate, input.tenorMonths, product.processingFeePct),
    totalRepayment: totalRepaymentOf(offeredAmount, offeredRate, input.tenorMonths, product.processingFeePct),
    confidence,
    pd,
    lgd,
    conditions: product.requiredDocs.slice(0, 4),
    rationale: decline
      ? `Declined: default risk ${(pd * 100).toFixed(1)}% with ${(profile.dataCompleteness * 100).toFixed(0)}% data completeness leaves confidence at ${confidence}.`
      : `Priced at ${offeredRate}% (base ${input.providerBaseRate}% + risk premium ${premium}%) — volatility ${profile.salesVolatility}, DSO ${profile.dso} days, debt/revenue ${profile.debtToRevenue}.`,
  };
}

/* ------------------------------ negotiation (pure) ------------------------------ */
export interface NegotiationStep {
  round: number;
  fromParty: 'LENDER_AGENT' | 'BORROWER_AGENT';
  proposedAmount: number;
  proposedRate: number;
  proposedTenorMonths: number;
  decision: 'ACCEPT' | 'COUNTER' | 'REJECT';
  message: string;
  reasoning: string;
}

export function borrowerDecision(input: {
  offeredAmount: number;
  offeredRate: number;
  tenorMonths: number;
  processingFeePct: number;
  monthlyFreeCashFlow: number;
  grossMarginPct: number;
  ownerMaxRate?: number | null;
}): { decision: 'ACCEPT' | 'COUNTER' | 'REJECT'; proposedRate: number; proposedTenorMonths: number; reasoning: string } {
  const emi = monthlyPayment(input.offeredAmount, input.offeredRate, input.tenorMonths);
  const burden = input.monthlyFreeCashFlow > 0 ? emi / input.monthlyFreeCashFlow : Infinity;
  const apr = effectiveApr(input.offeredAmount, input.offeredRate, input.tenorMonths, input.processingFeePct);
  if (input.ownerMaxRate != null && input.offeredRate > input.ownerMaxRate + 4)
    return { decision: 'REJECT', proposedRate: input.offeredRate, proposedTenorMonths: input.tenorMonths, reasoning: `Rate ${input.offeredRate}% is far above your ceiling of ${input.ownerMaxRate}%.` };
  if (apr > input.grossMarginPct && input.grossMarginPct > 0)
    return { decision: 'REJECT', proposedRate: input.offeredRate, proposedTenorMonths: input.tenorMonths, reasoning: `Effective APR ${apr}% exceeds your gross margin ${input.grossMarginPct}% — this loan destroys value.` };
  if (burden <= 0.35 && (input.ownerMaxRate == null || input.offeredRate <= input.ownerMaxRate))
    return { decision: 'ACCEPT', proposedRate: input.offeredRate, proposedTenorMonths: input.tenorMonths, reasoning: `Installment ৳${emi.toLocaleString('en-IN')} is ${(burden * 100).toFixed(0)}% of monthly free cash flow — feasible.` };
  // Counter: ask for a lower rate and/or longer tenor to reach feasibility.
  const targetRate = Math.max(1, roundCurrency((input.offeredRate - 2) * 100) / 100);
  const targetTenor = burden > 0.35 ? Math.min(60, input.tenorMonths + 6) : input.tenorMonths;
  return {
    decision: 'COUNTER',
    proposedRate: input.ownerMaxRate != null ? Math.min(targetRate, input.ownerMaxRate) : targetRate,
    proposedTenorMonths: targetTenor,
    reasoning: `Installment is ${(burden * 100).toFixed(0)}% of free cash flow (cap 35%). Countering at ${targetRate}% over ${targetTenor} months.`,
  };
}

export function lenderResponse(input: {
  currentRate: number;
  proposedRate: number;
  productRateMin: number;
  riskAppetite: number;
  round: number;
}): { decision: 'ACCEPT' | 'COUNTER' | 'REJECT'; rate: number; reasoning: string } {
  const floor = input.productRateMin;
  if (input.proposedRate >= input.currentRate)
    return { decision: 'ACCEPT', rate: input.currentRate, reasoning: 'Terms already meet the ask.' };
  if (input.proposedRate >= floor) {
    // Concede a fraction scaled by risk appetite; more generous in later rounds.
    const concession = (input.currentRate - input.proposedRate) * Math.min(1, 0.4 + input.riskAppetite * 0.3 + input.round * 0.15);
    const rate = roundCurrency(Math.max(input.proposedRate, input.currentRate - concession) * 100) / 100;
    const done = rate <= input.proposedRate + 0.05;
    return {
      decision: done ? 'ACCEPT' : 'COUNTER',
      rate: done ? input.proposedRate : rate,
      reasoning: done ? 'Revised pricing still clears the risk floor.' : `Can move to ${rate}% this round; floor is ${floor}%.`,
    };
  }
  return { decision: 'REJECT', rate: input.currentRate, reasoning: `Ask ${input.proposedRate}% is below the product floor ${floor}%.` };
}

/** Full deterministic agent-vs-agent loop, capped at 3 rounds (PLAN §4.3[6]). */
export function runNegotiation(input: {
  offeredAmount: number;
  offeredRate: number;
  tenorMonths: number;
  processingFeePct: number;
  monthlyFreeCashFlow: number;
  grossMarginPct: number;
  ownerMaxRate?: number | null;
  productRateMin: number;
  riskAppetite: number;
}): { steps: NegotiationStep[]; finalRate: number; finalTenor: number; outcome: 'ACCEPTED' | 'REJECTED' | 'MAX_ROUNDS' } {
  const steps: NegotiationStep[] = [];
  let rate = input.offeredRate;
  let tenor = input.tenorMonths;
  for (let round = 1; round <= 3; round++) {
    const b = borrowerDecision({ ...input, offeredRate: rate, tenorMonths: tenor });
    steps.push({
      round,
      fromParty: 'BORROWER_AGENT',
      proposedAmount: input.offeredAmount,
      proposedRate: b.proposedRate,
      proposedTenorMonths: b.proposedTenorMonths,
      decision: b.decision,
      message:
        b.decision === 'ACCEPT' ? 'These terms work for the business.' :
        b.decision === 'REJECT' ? 'We must decline these terms.' :
        `Could you do ${b.proposedRate}% over ${b.proposedTenorMonths} months?`,
      reasoning: b.reasoning,
    });
    if (b.decision === 'ACCEPT') return { steps, finalRate: rate, finalTenor: tenor, outcome: 'ACCEPTED' };
    if (b.decision === 'REJECT') return { steps, finalRate: rate, finalTenor: tenor, outcome: 'REJECTED' };
    tenor = b.proposedTenorMonths;
    const l = lenderResponse({ currentRate: rate, proposedRate: b.proposedRate, productRateMin: input.productRateMin, riskAppetite: input.riskAppetite, round });
    steps.push({
      round,
      fromParty: 'LENDER_AGENT',
      proposedAmount: input.offeredAmount,
      proposedRate: l.rate,
      proposedTenorMonths: tenor,
      decision: l.decision,
      message:
        l.decision === 'ACCEPT' ? `Agreed at ${l.rate}%.` :
        l.decision === 'REJECT' ? 'We cannot go below our floor.' : `We can offer ${l.rate}% this round.`,
      reasoning: l.reasoning,
    });
    rate = l.rate;
    if (l.decision === 'ACCEPT') return { steps, finalRate: rate, finalTenor: tenor, outcome: 'ACCEPTED' };
    if (l.decision === 'REJECT') return { steps, finalRate: rate, finalTenor: tenor, outcome: 'REJECTED' };
  }
  return { steps, finalRate: rate, finalTenor: tenor, outcome: 'MAX_ROUNDS' };
}

/** Composite 0–100 scorecard score (PLAN §3.5 AgentPerformance.score). */
export function compositeScore(input: {
  decisions: number;
  executed: number;
  guardRejects: number;
  projectedSum: number;
  realizedSum: number;
}): number {
  if (input.decisions === 0) return 0;
  const executionRate = input.executed / input.decisions;
  const accuracy =
    input.projectedSum !== 0
      ? Math.max(0, 1 - Math.abs(input.realizedSum - input.projectedSum) / Math.abs(input.projectedSum))
      : input.realizedSum === 0 ? 1 : 0;
  const discipline = Math.max(0, 1 - input.guardRejects / input.decisions);
  return Math.round((executionRate * 40 + accuracy * 40 + discipline * 20) * 100) / 100;
}

export { clampAiScore };
