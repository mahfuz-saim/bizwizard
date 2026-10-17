import { roundCurrency } from '../shared/money';
import { effectiveApr } from '../shared/money';
import { guardOffer, guardTreasuryActions, type GuardVerdict } from '../shared/guard';
import { verifyHypothesis, type Candidate, type VerificationResult } from '../shared/verifier';

/**
 * Finance Copilot simulator — pure, unit-testable "30-day business" narrative
 * generator for the judge-facing "Live Business Stream" demo
 * (POST /finance/simulator/fast-forward). No DB, no network, no AI call: the
 * service layer (simulator.service.ts) persists what this module plans into
 * the SAME real tables the rest of the app reads (Checkout, ExpenseItem,
 * Debt/DebtPayments, CashTransaction), then re-runs the real deterministic
 * engines (cashEngine/alerts/guard/verifier) on top of it. This file only
 * decides *what happens on which day* and *whether a guard should fire* —
 * every money figure still flows through the same engines as production.
 */

const DAY = 86400000;
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Deterministic string → 32-bit seed (djb2). Same shopId ⇒ same hash. */
export function seedFromString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** mulberry32 — tiny, deterministic PRNG. Same seed ⇒ same sequence forever. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rand: () => number, lo: number, hi: number) => lo + rand() * (hi - lo);

export type SimPhase = 'HEALTHY' | 'ANOMALY' | 'STRAIN' | 'CRISIS';

/** 'LESS' keeps today's pace (one sale + occasional expense per day — this is
 *  the "present data" behaviour). 'MORE' fans the SAME daily totals (plus a
 *  touch of extra incidental spend) out into several smaller transactions so
 *  the live stream feels roughly 3x busier, for shops that want a richer demo. */
export type SimTemplate = 'LESS' | 'MORE';

export const TRANSACTION_TEMPLATES: Array<{ id: SimTemplate; label: string; description: string }> = [
  { id: 'LESS', label: 'Less transactions', description: 'Present pace — one sale and occasional expenses per day.' },
  { id: 'MORE', label: 'More transactions', description: '~3x busier — several sales and expenses every day.' },
];

export interface SimSaleEntry {
  amount: number;
  quantity: number;
  unitPrice: number;
}

export interface SimExpenseEntry {
  amount: number;
  label: string;
  expenseType: 'GENERAL' | 'PRODUCT' | 'EMPLOYEE_SALARY';
}

export interface SimDayPlan {
  day: number; // 1..30
  date: string; // YYYY-MM-DD, day 30 === asOf
  phase: SimPhase;
  /** Aggregate daily figures — always a single number, independent of the
   *  transaction template. The narrative/insight/test logic reads these. */
  sale: SimSaleEntry | null;
  expense: SimExpenseEntry | null;
  /** What actually gets persisted as individual rows/stream events. Under the
   *  'LESS' template these mirror `sale`/`expense` exactly (0 or 1 entries) so
   *  behaviour is byte-identical to before this field existed. Under 'MORE'
   *  the same totals (plus a little extra) are split into several entries. */
  sales: SimSaleEntry[];
  expenses: SimExpenseEntry[];
  debtIssued: { amount: number; label: string } | null;
  debtCollectsEarlierDebt: boolean; // true on the day the small demo debt is collected
}

export interface SimulationPlan {
  seed: number;
  horizonDays: number;
  days: SimDayPlan[];
  anomalyDay: number;
  anomalyAmount: number;
  anomalyLabel: string;
  bigDebtDay: number;
  bigDebtAmount: number;
  bigDebtLabel: string;
  smallDebtDay: number;
  smallDebtAmount: number;
  smallDebtCollectDay: number;
}

export interface SimulationPlanInput {
  seed: number;
  asOf: Date;
  /** Real recent daily averages from the shop's own ledger (with sane floors applied by the caller). */
  baselineDailyRevenue: number;
  baselineDailyOutflow: number;
  horizonDays?: number;
  /** Defaults to 'LESS' — unchanged present-day behaviour. */
  template?: SimTemplate;
}

const EXPENSE_LABELS = ['Packaging materials', 'Utility bill', 'Staff tea & snacks', 'Transport & delivery', 'Shop maintenance'];

/** Splits `total` into `parts` positive amounts that sum back to exactly
 *  `roundCurrency(total)`. parts<=1 returns a single-element array without
 *  consuming any randomness, so the 'LESS' template's rand() sequence (and
 *  therefore every amount it produces) is completely unaffected by this
 *  helper existing. */
function splitAmount(rand: () => number, total: number, parts: number): number[] {
  if (parts <= 1 || total <= 0) return [roundCurrency(total)];
  const weights = Array.from({ length: parts }, () => between(rand, 0.55, 1.45));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => roundCurrency((total * w) / weightSum));
  const sumSoFar = amounts.slice(0, -1).reduce((a, b) => a + b, 0);
  amounts[amounts.length - 1] = roundCurrency(Math.max(0, total - sumSoFar));
  return amounts;
}

/** Splits an integer quantity into `parts` whole pieces (min 1 each). Purely
 *  cosmetic (feeds CheckoutItem.quantity) — never touches `rand`. */
function splitQuantity(total: number, parts: number): number[] {
  if (parts <= 1) return [Math.max(1, Math.round(total))];
  const base = Math.max(1, Math.floor(total / parts));
  const out = Array.from({ length: parts }, () => base);
  out[out.length - 1] = Math.max(1, Math.round(total) - base * (parts - 1));
  return out;
}

/**
 * Builds a 30-day (default) narrative that is guaranteed, by construction, to
 * contain: a clean "healthy" opening, one unmistakable one-off expense
 * anomaly (feeds the verified counterfactual insight), a large unpaid
 * receivable (feeds the treasurer's collection action), a small debt that
 * gets collected mid-run (stream variety), and a worsening last ~18 days so
 * the real 90-day projection trends toward a shortfall.
 */
export function buildSimulationPlan(input: SimulationPlanInput): SimulationPlan {
  const horizonDays = input.horizonDays ?? 30;
  const template: SimTemplate = input.template === 'MORE' ? 'MORE' : 'LESS';
  const rand = mulberry32(input.seed);
  const rev = Math.max(1500, roundCurrency(input.baselineDailyRevenue));
  const out = Math.max(800, roundCurrency(input.baselineDailyOutflow));

  const anomalyDay = Math.max(8, Math.min(horizonDays - 18, 10));
  const bigDebtDay = Math.min(horizonDays - 16, anomalyDay + 2);
  const smallDebtDay = 4;
  const smallDebtCollectDay = 8;
  const strainStart = Math.min(horizonDays - 6, 13);
  const crisisStart = Math.max(strainStart + 1, horizonDays - 6);

  const anomalyAmount = roundCurrency(out * between(rand, 5.5, 6.5));
  const bigDebtAmount = roundCurrency(rev * between(rand, 4, 5.5));
  const smallDebtAmount = roundCurrency(rev * between(rand, 0.8, 1.3));

  const days: SimDayPlan[] = [];
  for (let day = 1; day <= horizonDays; day++) {
    const date = isoDay(new Date(input.asOf.getTime() - (horizonDays - day) * DAY));
    const phase: SimPhase = day === anomalyDay ? 'ANOMALY' : day >= crisisStart ? 'CRISIS' : day >= strainStart ? 'STRAIN' : 'HEALTHY';

    let saleFactor: [number, number];
    if (phase === 'CRISIS') saleFactor = [0.35, 0.55];
    else if (phase === 'STRAIN') saleFactor = [0.55, 0.78];
    else saleFactor = [0.85, 1.15];
    const saleAmount = roundCurrency(rev * between(rand, saleFactor[0], saleFactor[1]));
    const quantity = Math.max(1, Math.round(between(rand, 1, 4)));

    let expense: SimDayPlan['expense'] = null;
    if (phase === 'ANOMALY') {
      expense = { amount: anomalyAmount, label: 'Emergency generator repair + bulk restock', expenseType: 'GENERAL' };
    } else if (phase === 'CRISIS') {
      expense = { amount: roundCurrency(out * between(rand, 0.9, 1.15)), label: EXPENSE_LABELS[day % EXPENSE_LABELS.length], expenseType: 'GENERAL' };
    } else if (phase === 'STRAIN') {
      expense = { amount: roundCurrency(out * between(rand, 0.75, 0.95)), label: EXPENSE_LABELS[day % EXPENSE_LABELS.length], expenseType: 'GENERAL' };
    } else if (day % 3 === 0) {
      expense = { amount: roundCurrency(out * between(rand, 0.6, 0.9)), label: EXPENSE_LABELS[day % EXPENSE_LABELS.length], expenseType: day % 6 === 0 ? 'EMPLOYEE_SALARY' : 'GENERAL' };
    }

    let debtIssued: SimDayPlan['debtIssued'] = null;
    if (day === bigDebtDay) debtIssued = { amount: bigDebtAmount, label: 'Wholesale order on credit — Rahim Traders' };
    else if (day === smallDebtDay) debtIssued = { amount: smallDebtAmount, label: 'Local shop credit sale' };

    const saleEntry: SimSaleEntry = { amount: saleAmount, quantity, unitPrice: roundCurrency(saleAmount / quantity) };

    // --- Transaction-template fan-out: 'LESS' mirrors sale/expense 1:1 (zero
    // extra rand() calls, so it is byte-identical to the pre-template plan).
    // 'MORE' splits the same totals into several smaller rows, plus a small
    // incidental expense on days that otherwise wouldn't have one. ---
    const salesPerDay = template === 'MORE' ? 3 : 1;
    const saleAmounts = splitAmount(rand, saleEntry.amount, salesPerDay);
    const saleQuantities = splitQuantity(saleEntry.quantity, salesPerDay);
    const sales: SimSaleEntry[] = saleAmounts.map((amount, i) => ({
      amount,
      quantity: saleQuantities[i],
      unitPrice: roundCurrency(amount / Math.max(1, saleQuantities[i])),
    }));

    const expenses: SimExpenseEntry[] = [];
    if (expense) {
      const resolvedExpense = expense;
      const expenseParts = template === 'MORE' && phase !== 'ANOMALY' ? 2 : 1;
      const amounts = splitAmount(rand, resolvedExpense.amount, expenseParts);
      amounts.forEach((amount, i) => expenses.push({
        amount,
        label: expenseParts > 1 ? `${resolvedExpense.label} (${i + 1}/${expenseParts})` : resolvedExpense.label,
        expenseType: resolvedExpense.expenseType,
      }));
    } else if (template === 'MORE' && phase === 'HEALTHY') {
      expenses.push({
        amount: roundCurrency(out * between(rand, 0.12, 0.28)),
        label: EXPENSE_LABELS[(day + 2) % EXPENSE_LABELS.length],
        expenseType: 'GENERAL',
      });
    }

    days.push({
      day,
      date,
      phase,
      sale: saleEntry,
      expense,
      sales,
      expenses,
      debtIssued,
      debtCollectsEarlierDebt: day === smallDebtCollectDay,
    });
  }

  return {
    seed: input.seed,
    horizonDays,
    days,
    anomalyDay,
    anomalyAmount,
    anomalyLabel: 'Emergency generator repair + bulk restock',
    bigDebtDay,
    bigDebtAmount,
    bigDebtLabel: 'Wholesale order on credit — Rahim Traders',
    smallDebtDay,
    smallDebtAmount,
    smallDebtCollectDay,
  };
}

/** Extra "late outflow" top-ups used by the service if the real projection did not
 *  cross into a CRITICAL shortfall on the first pass — keeps the demo reliable
 *  on shops whose own trailing history is unusually cash-rich. Deterministic
 *  per attempt number. */
export function amplifierTopUp(attempt: number, baselineDailyOutflow: number, seed: number): number {
  const rand = mulberry32(seed + attempt * 7919);
  const base = Math.max(800, roundCurrency(baselineDailyOutflow));
  return roundCurrency(base * (3 + attempt * 2) * between(rand, 0.9, 1.1));
}

/* ------------------------- Verified insight (Layer 2) ------------------------- */

export interface AnomalyInsightPlan {
  title: string;
  summary: string;
  hypothesis: string;
  candidate: Candidate;
  verification: VerificationResult;
}

/**
 * The anomaly day's expense is engineered, so we know its exact contribution
 * to the 30-day opex gap — verifyHypothesis() (the real counterfactual
 * verifier, PLAN §6.4) is still the thing that decides VERIFIED vs REFUTED;
 * we are not hand-waving the badge.
 */
export function buildAnomalyInsight(plan: SimulationPlan): AnomalyInsightPlan {
  const originalGap = plan.anomalyAmount; // the entire excess is this one line item, by construction
  const candidate: Candidate = {
    id: `sim-anomaly-${plan.anomalyDay}`,
    label: plan.anomalyLabel,
    kind: 'EXPENSE',
    contribution: plan.anomalyAmount,
  };
  const verification = verifyHypothesis(originalGap, candidate);
  return {
    title: `Expense spike on day ${plan.anomalyDay} explains the opex jump`,
    summary: `A single one-off expense ("${plan.anomalyLabel}") of ${plan.anomalyAmount} accounts for the period's opex anomaly. Removing it from the ledger collapses the gap to ${verification.residualPct}% of the original — within the 10% verification threshold.`,
    hypothesis: `"${plan.anomalyLabel}" on day ${plan.anomalyDay} is a one-off, not a trend — it should not be extrapolated into the forward forecast.`,
    candidate,
    verification,
  };
}

/* ------------------------- Guard-blocked lender offer (Layer 3) ------------------------- */

export interface GuardBlockedOfferPlan {
  offeredAmount: number;
  offeredRate: number;
  tenorMonths: number;
  advanceRate: number;
  effectiveAprPct: number;
  maxAffordableAmount: number;
  ownerMaxRate: number;
  verdict: GuardVerdict;
  toastMessage: string;
}

export interface GuardProductLike {
  maxAmount: number;
  minAmount: number;
  minTenorMonths: number;
  maxTenorMonths: number;
  interestRateMax: number;
  interestRateMin: number;
  processingFeePct: number;
  collateralRequired: boolean;
}

/**
 * Deliberately prices a short-tenor, max-rate offer on a high-APR product
 * (e.g. a merchant-cash-advance style catalog product) so the real
 * guardOffer() rejects it — exactly the "guards beat instructions" contract
 * the rest of the matching pillar relies on (PLAN §1.2 rule 5).
 */
export function buildGuardBlockedOfferScenario(product: GuardProductLike, baselineDailyRevenue: number, seed: number): GuardBlockedOfferPlan {
  const rand = mulberry32(seed + 104729);
  const offeredAmount = roundCurrency(
    Math.min(product.maxAmount, Math.max(product.minAmount, baselineDailyRevenue * between(rand, 2.5, 3.5))),
  );
  const offeredRate = product.interestRateMax;
  const tenorMonths = product.minTenorMonths;
  const advanceRate = product.collateralRequired ? 0.6 : 0;
  const effectiveAprPct = effectiveApr(offeredAmount, offeredRate, tenorMonths, product.processingFeePct);
  // The owner's real affordability cap right now (cash is strained) is well
  // below what this product would hand out, and well below the owner's
  // stated rate ceiling — both are genuine guard conditions, not a single
  // special-cased flag.
  const maxAffordableAmount = roundCurrency(offeredAmount * 0.45);
  const ownerMaxRate = 22;
  const verdict = guardOffer({
    offeredAmount,
    offeredRate,
    tenorMonths,
    advanceRate,
    maxAffordableAmount,
    ownerMaxRate,
    productMinTenor: product.minTenorMonths,
    productMaxTenor: product.maxTenorMonths,
    productRateMax: product.interestRateMax,
  });
  return {
    offeredAmount,
    offeredRate,
    tenorMonths,
    advanceRate,
    effectiveAprPct,
    maxAffordableAmount,
    ownerMaxRate,
    verdict,
    toastMessage: `GUARD BLOCKED: Offer rejected — effective APR (${Math.round(effectiveAprPct)}%) exceeds affordability cap.`,
  };
}

/* ------------------------- Treasury collection + reconciliation (Layer 3) ------------------------- */

export interface ReconciledTreasuryPlan {
  verdict: GuardVerdict;
  projectedImpact: number;
  realizedImpact: number;
  adjustedBalances: number[];
}

/**
 * Applies a COLLECT_DEBT action's effect to the projected balance series
 * (every day on/after `effectDayIndex` gains `amount`) and re-checks the real
 * guardTreasuryActions() against the *corrected* trajectory — i.e. we do not
 * assume the action passes, we prove it raises the floor back above zero.
 */
export function buildReconciledTreasuryAction(input: {
  debtAmount: number;
  dailyClosingBalances: number[];
  effectDayIndex: number;
  maxExposure: number | null;
  seed: number;
}): ReconciledTreasuryPlan {
  const adjustedBalances = input.dailyClosingBalances.map((b, i) => (i >= input.effectDayIndex ? roundCurrency(b + input.debtAmount) : b));
  const verdict = guardTreasuryActions({
    actions: [{ actionType: 'COLLECT_DEBT', amount: input.debtAmount, projectedImpact: input.debtAmount }],
    maxExposure: input.maxExposure,
    projectedBalancesAfter: adjustedBalances,
    bufferFloorAmount: 0,
  });
  const rand = mulberry32(input.seed + 271828);
  // Realized slightly beats projected — the "alpha vs benchmark" flavor in the
  // reconciliation toast — because collection landed a little faster/larger
  // than the conservative projection assumed.
  const realizedImpact = roundCurrency(input.debtAmount * between(rand, 1.04, 1.18));
  return { verdict, projectedImpact: roundCurrency(input.debtAmount), realizedImpact, adjustedBalances };
}
