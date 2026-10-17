import { roundCurrency, sumMoney } from './money';

/**
 * Deterministic metric engine (PLAN §4.3[1], §6.3). Pure functions over plain
 * aggregates — the service layer loads Prisma rows and maps them into these
 * shapes, which keeps every number unit-testable without a database and
 * guarantees no LLM ever computes a figure (PLAN §1.2 rule 1).
 */
export interface DailyAmount {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface ProfileAggregates {
  windowDays: number;
  salesByDay: DailyAmount[]; // net collected/accrued sales per day
  revenue: number; // net of discounts
  grossSales: number;
  discounts: number;
  cogs: number;
  opex: number;
  shrinkage: number;
  transactionCount: number;
  currentCash: number;
  receivables: number;
  payables: number;
  inventoryValue: number;
  debtOutstanding: number;
  existingMonthlyDebtService: number;
  daysWithSales: number;
  firstActivityDate?: string | null;
  asOf: Date;
}

export interface BusinessProfile {
  periodStart: Date;
  periodEnd: Date;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  opex: number;
  ebitda: number;
  netProfit: number;
  burnRate: number;
  avgDailyRevenue: number;
  avgDailySpend: number;
  currentCash: number;
  receivables: number;
  payables: number;
  inventoryValue: number;
  dso: number;
  dio: number;
  dpo: number;
  cashConversionCycle: number;
  debtOutstanding: number;
  debtToRevenue: number;
  interestCoverage: number | null;
  avgTransactionValue: number;
  salesVolatility: number;
  businessAgeMonths: number;
  dataCompleteness: number;
  monthlyRevenue: number;
  monthlyFreeCashFlow: number;
}

const DAY = 86400000;
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return roundCurrency((Math.sqrt(variance) / Math.abs(mean)) * 100) / 100;
}

export function buildProfile(a: ProfileAggregates): BusinessProfile {
  const days = Math.max(1, a.windowDays);
  const months = days / 30;
  const revenue = roundCurrency(a.revenue);
  const cogs = roundCurrency(a.cogs);
  const opex = roundCurrency(a.opex);
  const grossProfit = roundCurrency(revenue - cogs);
  const ebitda = roundCurrency(grossProfit - opex);
  const netProfit = roundCurrency(ebitda - a.shrinkage);
  const monthlyRevenue = roundCurrency(revenue / months);
  // Working-capital days on the window, annualised (DSO/DIO/DPO convention §4.3[1]).
  const dso = revenue > 0 ? roundCurrency((a.receivables / revenue) * days * 10) / 10 : 0;
  const dio = cogs > 0 ? roundCurrency((a.inventoryValue / cogs) * days * 10) / 10 : 0;
  const dpo = cogs > 0 ? roundCurrency((a.payables / cogs) * days * 10) / 10 : 0;
  const first = a.firstActivityDate ? new Date(a.firstActivityDate).getTime() : NaN;
  const businessAgeMonths = Number.isFinite(first)
    ? Math.max(0, Math.floor((a.asOf.getTime() - first) / (30 * DAY)))
    : 0;
  const monthlyFcf = roundCurrency(monthlyRevenue - cogs / months - opex / months - a.existingMonthlyDebtService);
  return {
    periodStart: new Date(a.asOf.getTime() - days * DAY),
    periodEnd: a.asOf,
    revenue,
    cogs,
    grossProfit,
    grossMargin: revenue > 0 ? roundCurrency((grossProfit / revenue) * 10000) / 100 : 0,
    opex,
    ebitda,
    netProfit,
    burnRate: roundCurrency(-(netProfit / months)),
    avgDailyRevenue: roundCurrency(revenue / days),
    avgDailySpend: roundCurrency((cogs + opex) / days),
    currentCash: roundCurrency(a.currentCash),
    receivables: roundCurrency(a.receivables),
    payables: roundCurrency(a.payables),
    inventoryValue: roundCurrency(a.inventoryValue),
    dso,
    dio,
    dpo,
    cashConversionCycle: roundCurrency((dso + dio - dpo) * 10) / 10,
    debtOutstanding: roundCurrency(a.debtOutstanding),
    debtToRevenue: revenue > 0 ? roundCurrency((a.debtOutstanding / revenue) * 100) / 100 : 0,
    interestCoverage:
      a.existingMonthlyDebtService > 0
        ? roundCurrency((ebitda / months / a.existingMonthlyDebtService) * 100) / 100
        : null,
    avgTransactionValue:
      a.transactionCount > 0 ? roundCurrency(revenue / a.transactionCount) : 0,
    salesVolatility: coefficientOfVariation(a.salesByDay.map((s) => s.amount)),
    businessAgeMonths,
    dataCompleteness: roundCurrency(Math.min(1, a.daysWithSales / days) * 100) / 100,
    monthlyRevenue,
    monthlyFreeCashFlow: monthlyFcf,
  };
}

export const INSUFFICIENT_DATA_THRESHOLD = 0.6;

/* ------------------------------ unit economics ----------------------------- */
export interface ProductSale {
  productKey: string;
  productName: string;
  revenue: number;
  cogs: number;
  units: number;
  inventoryValue: number;
  daysSinceLastSale: number | null;
}
export type Quadrant = 'STAR' | 'CASH_COW' | 'QUESTIONABLE' | 'DOG';
export interface ProductEconomics extends ProductSale {
  contribution: number;
  contributionMargin: number;
  revenueShare: number;
  marginShare: number;
  deadStock: boolean;
  quadrant: Quadrant;
}

export function productEconomics(products: ProductSale[]): ProductEconomics[] {
  const totalRevenue = sumMoney(products.map((p) => p.revenue));
  const totalMargin = sumMoney(products.map((p) => roundCurrency(p.revenue - p.cogs)));
  return products
    .map((p) => {
      const contribution = roundCurrency(p.revenue - p.cogs);
      const revenueShare = totalRevenue > 0 ? p.revenue / totalRevenue : 0;
      const marginShare = totalMargin > 0 ? contribution / totalMargin : 0;
      const deadStock = (p.daysSinceLastSale ?? 0) > 45 && totalRevenue >= 0 && p.inventoryValue > 0 &&
        sumMoney(products.map((x) => x.inventoryValue)) > 0 &&
        p.inventoryValue / Math.max(1, sumMoney(products.map((x) => x.inventoryValue))) > 0.05;
      const quadrant: Quadrant =
        revenueShare >= 0.05 && marginShare >= revenueShare
          ? 'STAR'
          : revenueShare >= 0.05
            ? 'CASH_COW'
            : marginShare > revenueShare && contribution > 0
              ? 'QUESTIONABLE'
              : 'DOG';
      return {
        ...p,
        contribution,
        contributionMargin: p.revenue > 0 ? roundCurrency((contribution / p.revenue) * 10000) / 100 : 0,
        revenueShare: roundCurrency(revenueShare * 10000) / 100,
        marginShare: roundCurrency(marginShare * 10000) / 100,
        deadStock,
        quadrant,
      };
    })
    .sort((x, y) => y.contribution - x.contribution);
}

/* ------------------------------- concentration ----------------------------- */
export function concentration(shares: Array<{ key: string; label: string; amount: number }>) {
  const total = sumMoney(shares.map((s) => s.amount));
  const sorted = [...shares].sort((a, b) => b.amount - a.amount);
  const shareOf = (n: number) =>
    total > 0 ? roundCurrency((sumMoney(sorted.slice(0, n).map((s) => s.amount)) / total) * 10000) / 100 : 0;
  const hhi =
    total > 0
      ? roundCurrency(sorted.reduce((acc, s) => acc + (s.amount / total) ** 2, 0) * 10000) / 10000
      : 0;
  return {
    total,
    top1Share: shareOf(1),
    top3Share: shareOf(3),
    top5Share: shareOf(5),
    hhi,
    concentrated: shareOf(1) > 25 || hhi > 0.25,
    leaders: sorted.slice(0, 5).map((s) => ({
      key: s.key,
      label: s.label,
      amount: roundCurrency(s.amount),
      share: total > 0 ? roundCurrency((s.amount / total) * 10000) / 100 : 0,
    })),
  };
}

/* --------------------------------- breakeven -------------------------------- */
export function breakeven(fixedCostsMonthly: number, grossMarginPct: number, avgTransactionValue: number) {
  const margin = grossMarginPct / 100;
  const revenueNeeded = margin > 0 ? roundCurrency(fixedCostsMonthly / margin) : 0;
  return {
    fixedCostsMonthly: roundCurrency(fixedCostsMonthly),
    breakevenRevenue: revenueNeeded,
    breakevenUnits:
      avgTransactionValue > 0 ? Math.ceil(revenueNeeded / avgTransactionValue) : 0,
  };
}

/* --------------------------- forecast + backtesting -------------------------- */
export interface ForecastPoint {
  date: string;
  value: number;
  lower: number;
  upper: number;
}

export function dowFactors(series: DailyAmount[]): number[] {
  if (!series.length) return [1, 1, 1, 1, 1, 1, 1];
  const overall = series.reduce((a, s) => a + s.amount, 0) / series.length;
  if (overall === 0) return [1, 1, 1, 1, 1, 1, 1];
  const byDow: number[][] = [[], [], [], [], [], [], []];
  for (const s of series) byDow[new Date(`${s.date}T00:00:00Z`).getUTCDay()].push(s.amount);
  return byDow.map((vals) => {
    if (!vals.length) return 1;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length / overall;
    return roundCurrency(Math.min(2, Math.max(0.2, m)) * 1000) / 1000;
  });
}

/** Linear trend slope per day, clipped to ±30% of level (PLAN §5.3[1]). */
export function robustTrend(series: DailyAmount[]): number {
  if (series.length < 7) return 0;
  const ma: number[] = [];
  for (let i = 6; i < series.length; i++)
    ma.push(series.slice(i - 6, i + 1).reduce((a, s) => a + s.amount, 0) / 7);
  const n = ma.length;
  const meanX = (n - 1) / 2;
  const meanY = ma.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  ma.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const level = Math.abs(meanY) || 1;
  const slope = den === 0 ? 0 : num / den;
  return roundCurrency(Math.max(-0.3 * level, Math.min(0.3 * level, slope)) * 100) / 100;
}

export function forecastDaily(series: DailyAmount[], horizonDays: number, asOf: Date) {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const level = sorted.length
    ? roundCurrency(sorted.slice(-28).reduce((a, s) => a + s.amount, 0) / Math.min(28, sorted.length))
    : 0;
  const factors = dowFactors(sorted);
  const trend = robustTrend(sorted);
  const points: ForecastPoint[] = [];
  for (let d = 1; d <= horizonDays; d++) {
    const date = new Date(asOf.getTime() + d * DAY);
    const expected = Math.max(0, roundCurrency((level + trend * d) * factors[date.getUTCDay()]));
    const band = roundCurrency(expected * 0.25 + Math.abs(level) * 0.05);
    points.push({
      date: isoDay(date),
      value: expected,
      lower: Math.max(0, roundCurrency(expected - band)),
      upper: roundCurrency(expected + band),
    });
  }
  // Honest backtest: hold out the last 14 days, forecast them, report MAPE.
  let backtestMAPE: number | null = null;
  if (sorted.length >= 28) {
    const train = sorted.slice(0, -14);
    const test = sorted.slice(-14);
    const tf = dowFactors(train);
    const tLevel = train.slice(-28).reduce((a, s) => a + s.amount, 0) / Math.min(28, train.length);
    const tTrend = robustTrend(train);
    const errs = test.map((t, i) => {
      const pred = Math.max(0, (tLevel + tTrend * (i + 1)) * tf[new Date(`${t.date}T00:00:00Z`).getUTCDay()]);
      return t.amount === 0 ? 0 : Math.abs(t.amount - pred) / Math.abs(t.amount);
    });
    backtestMAPE = roundCurrency((errs.reduce((a, b) => a + b, 0) / errs.length) * 10000) / 100;
  }
  return { series: points, backtestMAPE, method: 'DOW_SEASONAL_TREND', level, trendPerDay: trend };
}

/* ------------------------------ anomaly detection --------------------------- */
export interface Anomaly {
  date: string;
  metric: string;
  actual: number;
  expected: number;
  gap: number;
  zScore: number;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** DOW-adjusted robust (MAD) z-score detector, |z| > 3.5 (PLAN §6.3). */
export function detectAnomalies(series: DailyAmount[], metric = 'revenue'): Anomaly[] {
  const factors = dowFactors(series);
  const adjusted = series.map((s) => ({
    ...s,
    adj: s.amount / (factors[new Date(`${s.date}T00:00:00Z`).getUTCDay()] || 1),
  }));
  const med = median(adjusted.map((a) => a.adj));
  const mad = median(adjusted.map((a) => Math.abs(a.adj - med))) || 1;
  return adjusted
    .map((a) => {
      const z = (0.6745 * (a.adj - med)) / mad;
      const expected = roundCurrency(med * (factors[new Date(`${a.date}T00:00:00Z`).getUTCDay()] || 1));
      return {
        date: a.date,
        metric,
        actual: roundCurrency(a.amount),
        expected,
        gap: roundCurrency(a.amount - expected),
        zScore: roundCurrency(z * 100) / 100,
      };
    })
    .filter((a) => Math.abs(a.zScore) > 3.5);
}
