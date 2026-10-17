/**
 * Money & rounding contract (PLAN §2.2).
 * Every currency value that crosses a boundary (Prisma write, API response,
 * Json column) goes through roundCurrency. Aggregate raw, round once at the
 * boundary — except running balances, which round at every step.
 */
export const roundCurrency = (val: number): number => {
  if (val === null || val === undefined || !Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

export const sumMoney = (vals: number[]): number =>
  roundCurrency(vals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0));

/** Amortizing monthly payment (PMT). annualRatePct is % p.a. */
export const monthlyPayment = (
  principal: number,
  annualRatePct: number,
  months: number,
): number => {
  const P = Math.max(0, principal);
  const n = Math.max(1, Math.floor(months));
  const r = Math.max(0, annualRatePct) / 100 / 12;
  if (r === 0) return roundCurrency(P / n);
  const pmt = (P * r) / (1 - Math.pow(1 + r, -n));
  return roundCurrency(pmt);
};

export interface Installment {
  installmentNo: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  balanceAfter: number;
}

/**
 * Deterministic amortization schedule. Each installment is rounded; the
 * residual (≤ ৳0.05 drift) is absorbed by the final installment (PLAN §2.2.3).
 */
export const amortizationSchedule = (
  principal: number,
  annualRatePct: number,
  months: number,
): Installment[] => {
  const n = Math.max(1, Math.floor(months));
  const r = Math.max(0, annualRatePct) / 100 / 12;
  const pmt = monthlyPayment(principal, annualRatePct, months);
  let balance = roundCurrency(principal);
  const rows: Installment[] = [];
  for (let i = 1; i <= n; i++) {
    const interestDue = roundCurrency(balance * r);
    let principalDue = roundCurrency(pmt - interestDue);
    let totalDue = roundCurrency(principalDue + interestDue);
    if (i === n || principalDue >= balance) {
      principalDue = balance;
      totalDue = roundCurrency(principalDue + interestDue);
    }
    balance = roundCurrency(balance - principalDue);
    rows.push({ installmentNo: i, principalDue, interestDue, totalDue, balanceAfter: balance });
    if (balance <= 0) break;
  }
  return rows;
};

export const totalRepaymentOf = (
  principal: number,
  annualRatePct: number,
  months: number,
  processingFeePct = 0,
): number => {
  const schedule = amortizationSchedule(principal, annualRatePct, months);
  const fee = roundCurrency((principal * Math.max(0, processingFeePct)) / 100);
  return roundCurrency(sumMoney(schedule.map((s) => s.totalDue)) + fee);
};

/** Effective APR ≈ (total cost / principal) annualised, deterministic. */
export const effectiveApr = (
  principal: number,
  annualRatePct: number,
  months: number,
  processingFeePct = 0,
): number => {
  if (principal <= 0) return 0;
  const total = totalRepaymentOf(principal, annualRatePct, months, processingFeePct);
  const years = Math.max(1, months) / 12;
  return roundCurrency(((total - principal) / principal / years) * 100);
};

export const annuityFactor = (annualRatePct: number, months: number): number => {
  const n = Math.max(1, Math.floor(months));
  const r = Math.max(0, annualRatePct) / 100 / 12;
  if (r === 0) return n;
  return (1 - Math.pow(1 + r, -n)) / r;
};
