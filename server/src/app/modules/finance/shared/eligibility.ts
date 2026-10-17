import { roundCurrency, effectiveApr } from './money';
import { maxAffordableAmount, installmentBurden, monthlyFreeCashFlow } from './affordability';
import type { BusinessProfile } from './metricEngine';

/** Rule engine + deterministic scorer (PLAN §4.3[2][3]). No LLM involvement. */
export interface ProductLike {
  id: string;
  name: string;
  productType: string;
  minAmount: number;
  maxAmount: number;
  minTenorMonths: number;
  maxTenorMonths: number;
  interestRateMin: number;
  interestRateMax: number;
  processingFeePct: number;
  collateralRequired: boolean;
  minBusinessAgeMonths: number;
  minMonthlyRevenue: number;
  maxDebtToRevenue: number;
  requiresGSTIN: boolean;
  requiresBankStatements: boolean;
  sectorFit: string[];
  renewalAllowed: boolean;
}

export interface MatchRequest {
  requestedAmount: number;
  tenorMonths: number;
  shopCategory?: string;
  hasGSTIN?: boolean;
  hasBankStatements?: boolean;
}

export type Eligibility = 'ELIGIBLE' | 'NEAR_MISS' | 'INELIGIBLE';

interface RuleResult {
  rule: string;
  passed: boolean;
  /** fractional shortfall for numeric rules (0 = pass, 0.05 = 5% short) */
  shortfall: number;
  soft: boolean;
}

function evaluateRules(p: ProductLike, profile: BusinessProfile, req: MatchRequest): RuleResult[] {
  const numeric = (
    rule: string,
    actual: number,
    required: number,
    mode: 'min' | 'max',
    soft = true,
  ): RuleResult => {
    const passed = mode === 'min' ? actual >= required : actual <= required;
    const shortfall = passed
      ? 0
      : required === 0
        ? 1
        : Math.abs(actual - required) / Math.abs(required);
    return { rule, passed, shortfall, soft };
  };
  return [
    numeric('MIN_AMOUNT', req.requestedAmount, p.minAmount, 'min', false),
    numeric('MAX_AMOUNT', req.requestedAmount, p.maxAmount, 'max', false),
    numeric('MIN_TENOR', req.tenorMonths, p.minTenorMonths, 'min', false),
    numeric('MAX_TENOR', req.tenorMonths, p.maxTenorMonths, 'max', false),
    numeric('MIN_BUSINESS_AGE', profile.businessAgeMonths, p.minBusinessAgeMonths, 'min'),
    numeric('MIN_REVENUE', profile.monthlyRevenue, p.minMonthlyRevenue, 'min'),
    numeric('MAX_D_R', profile.debtToRevenue, p.maxDebtToRevenue, 'max'),
    {
      rule: 'SECTOR_FIT',
      passed:
        !p.sectorFit?.length || p.sectorFit.includes('*') ||
        (!!req.shopCategory && p.sectorFit.includes(req.shopCategory)),
      shortfall: 1,
      soft: false,
    },
    { rule: 'GSTIN', passed: !p.requiresGSTIN || !!req.hasGSTIN, shortfall: 1, soft: false },
    {
      rule: 'BANK_STATEMENTS',
      passed: !p.requiresBankStatements || !!req.hasBankStatements,
      shortfall: 1,
      soft: false,
    },
  ];
}

export function evaluateEligibility(
  p: ProductLike,
  profile: BusinessProfile,
  req: MatchRequest,
): { status: Eligibility; failedRules: string[] } {
  const results = evaluateRules(p, profile, req);
  const failed = results.filter((r) => !r.passed);
  if (!failed.length) return { status: 'ELIGIBLE', failedRules: [] };
  // NEAR_MISS = exactly one failed rule, soft, and within 20% (PLAN §4.3[2]).
  if (failed.length === 1 && failed[0].soft && failed[0].shortfall <= 0.2)
    return { status: 'NEAR_MISS', failedRules: failed.map((f) => f.rule) };
  return { status: 'INELIGIBLE', failedRules: failed.map((f) => f.rule) };
}

export interface ScoredProduct {
  deterministicScore: number;
  subScores: { affordability: number; cost: number; liquidity: number; collateral: number; flexibility: number };
  estimatedCost: number;
  maxAffordableAmount: number;
  midRate: number;
}

export function deterministicScore(
  p: ProductLike,
  profile: BusinessProfile,
  req: MatchRequest,
): ScoredProduct {
  const midRate = roundCurrency(((p.interestRateMin + p.interestRateMax) / 2) * 100) / 100;
  const affordInput = {
    monthlyRevenue: profile.monthlyRevenue,
    monthlyCogs: profile.monthlyRevenue - (profile.grossMargin / 100) * profile.monthlyRevenue,
    monthlyOpex: Math.max(0, profile.monthlyRevenue - profile.monthlyFreeCashFlow -
      (profile.monthlyRevenue - (profile.grossMargin / 100) * profile.monthlyRevenue)),
    existingMonthlyDebtService: 0,
    availableCollateralValue: profile.inventoryValue + profile.receivables,
  };
  // Prefer the profile's own free-cash-flow when available.
  const maxAfford = maxAffordableAmount(
    { ...affordInput, monthlyOpex: 0, monthlyRevenue: profile.monthlyFreeCashFlow + affordInput.monthlyCogs },
    midRate,
    req.tenorMonths,
  );
  const apr = effectiveApr(req.requestedAmount, midRate, req.tenorMonths, p.processingFeePct);
  const clamp01 = (n: number) => Math.max(0, Math.min(100, roundCurrency(n)));
  const affordability = clamp01(
    maxAfford <= 0 ? 0 : Math.min(100, (maxAfford / Math.max(1, req.requestedAmount)) * 100),
  );
  const cost = clamp01(100 - Math.max(0, apr - Math.max(0, profile.grossMargin)) * 3 - apr * 0.8);
  const burden = installmentBurden(req.requestedAmount / Math.max(1, req.tenorMonths), {
    ...affordInput,
    monthlyRevenue: profile.monthlyFreeCashFlow + affordInput.monthlyCogs,
    monthlyOpex: 0,
  });
  const liquidity = clamp01(Number.isFinite(burden) ? 100 - burden * 120 : 10);
  const collateralValue = profile.inventoryValue + profile.receivables;
  const collateral = p.collateralRequired
    ? clamp01((collateralValue / Math.max(1, req.requestedAmount)) * 70)
    : 85; // unsecured bonus for SMEs (§4.3[3])
  const flexibility = clamp01((p.renewalAllowed ? 70 : 45) + (p.processingFeePct <= 1 ? 25 : 10));
  const score = roundCurrency(
    affordability * 0.3 + cost * 0.25 + liquidity * 0.2 + collateral * 0.15 + flexibility * 0.1,
  );
  return {
    deterministicScore: score,
    subScores: {
      affordability: clamp01(affordability),
      cost: clamp01(cost),
      liquidity: clamp01(liquidity),
      collateral: clamp01(collateral),
      flexibility: clamp01(flexibility),
    },
    estimatedCost: apr,
    maxAffordableAmount: roundCurrency(Math.max(0, maxAfford)),
    midRate,
  };
}

export { monthlyFreeCashFlow };
