import { annuityFactor, roundCurrency } from './money';

export interface AffordabilityInput {
  monthlyRevenue: number;
  monthlyCogs: number;
  monthlyOpex: number;
  existingMonthlyDebtService: number;
  availableCollateralValue: number;
}

/** PLAN §4.4 debt-service-coverage policy constant. */
export const DEBT_SERVICE_COVERAGE = 0.5;
export const MAX_ADVANCE_RATE = 0.85;

export function monthlyFreeCashFlow(i: AffordabilityInput): number {
  return roundCurrency(
    i.monthlyRevenue - i.monthlyCogs - i.monthlyOpex - i.existingMonthlyDebtService,
  );
}

export function maxMonthlyEmi(i: AffordabilityInput): number {
  return roundCurrency(Math.max(0, monthlyFreeCashFlow(i)) * DEBT_SERVICE_COVERAGE);
}

/** Max principal serviceable at (rate, tenor) without breaching the DSCR cap. */
export function maxPrincipal(i: AffordabilityInput, annualRatePct: number, tenorMonths: number): number {
  return roundCurrency(maxMonthlyEmi(i) * annuityFactor(annualRatePct, tenorMonths));
}

export function maxAffordableAmount(
  i: AffordabilityInput,
  annualRatePct: number,
  tenorMonths: number,
): number {
  const byCashFlow = maxPrincipal(i, annualRatePct, tenorMonths);
  const byCollateral = roundCurrency(i.availableCollateralValue * MAX_ADVANCE_RATE);
  // Unsecured products have no collateral value bound from the borrower side;
  // callers pass availableCollateralValue = Infinity for those.
  const cap = Number.isFinite(byCollateral) && byCollateral > 0 ? Math.min(byCashFlow, byCollateral) : byCashFlow;
  return roundCurrency(Math.max(0, cap));
}

/** Installment as a share of monthly free cash flow (borrower feasibility, §4.3[6]). */
export function installmentBurden(monthlyInstallment: number, i: AffordabilityInput): number {
  const fcf = monthlyFreeCashFlow(i);
  if (fcf <= 0) return Number.POSITIVE_INFINITY;
  return roundCurrency((monthlyInstallment / fcf) * 100) / 100;
}
export const MAX_INSTALLMENT_FCF_SHARE = 0.35;
