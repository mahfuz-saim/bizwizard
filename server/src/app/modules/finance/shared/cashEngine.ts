import { roundCurrency, sumMoney } from './money';
import { dowFactors, robustTrend, isoDay } from './metricEngine';

/**
 * Cash engine (PLAN §5.3). Deterministic: DOW seasonality + clipped trend +
 * scheduled commitments/receivables. The LLM never touches these numbers.
 */
export interface CashTxnLike {
  occurredAt: Date | string;
  direction: 'IN' | 'OUT';
  amount: number;
  category?: string;
}
export interface DailyNet {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}
export interface CommitmentLike {
  name: string;
  amount: number;
  dueDate: Date | string;
  recurrence: string;
  confidence: number;
  isPaid?: boolean;
}
export interface ReceivableLike {
  id: string;
  amount: number; // outstanding
  createdAt: Date | string;
}

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function dailyNetSeries(txns: CashTxnLike[], days: number, asOf: Date): DailyNet[] {
  const start = startOfDay(new Date(asOf.getTime() - (days - 1) * DAY));
  const buckets = new Map<string, DailyNet>();
  for (let i = 0; i < days; i++) {
    const date = isoDay(new Date(start.getTime() + i * DAY));
    buckets.set(date, { date, inflow: 0, outflow: 0, net: 0 });
  }
  for (const t of txns) {
    const date = isoDay(startOfDay(new Date(t.occurredAt)));
    const b = buckets.get(date);
    if (!b) continue;
    if (t.direction === 'IN') b.inflow += t.amount;
    else b.outflow += t.amount;
  }
  const out = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const b of out) {
    b.inflow = roundCurrency(b.inflow);
    b.outflow = roundCurrency(b.outflow);
    b.net = roundCurrency(b.inflow - b.outflow);
  }
  return out;
}

export function ageBucket(createdAt: Date | string, asOf: Date): string {
  const age = Math.floor((startOfDay(asOf).getTime() - startOfDay(new Date(createdAt)).getTime()) / DAY);
  if (age <= 7) return '0-7';
  if (age <= 15) return '8-15';
  if (age <= 30) return '16-30';
  if (age <= 60) return '31-60';
  return '61+';
}
/** Probability a receivable in a bucket is collected within ~7 days. */
export const COLLECTION_PROB: Record<string, number> = {
  '0-7': 0.7,
  '8-15': 0.55,
  '16-30': 0.4,
  '31-60': 0.25,
  '61+': 0.12,
};
export const MEDIAN_DAYS_TO_COLLECT: Record<string, number> = {
  '0-7': 5,
  '8-15': 9,
  '16-30': 16,
  '31-60': 32,
  '61+': 55,
};

export function expandCommitments(
  commitments: CommitmentLike[],
  asOf: Date,
  horizonDays: number,
): Array<{ date: string; name: string; amount: number }> {
  const out: Array<{ date: string; name: string; amount: number }> = [];
  const end = asOf.getTime() + horizonDays * DAY;
  for (const c of commitments) {
    if (c.isPaid) continue;
    let due = startOfDay(new Date(c.dueDate)).getTime();
    const step =
      c.recurrence === 'DAILY' ? DAY
      : c.recurrence === 'WEEKLY' ? 7 * DAY
      : c.recurrence === 'MONTHLY' ? 30 * DAY
      : c.recurrence === 'QUARTERLY' ? 90 * DAY
      : c.recurrence === 'YEARLY' ? 365 * DAY
      : 0;
    let guard = 0;
    while (due <= end && guard++ < 400) {
      if (due >= startOfDay(asOf).getTime())
        out.push({ date: isoDay(new Date(due)), name: c.name, amount: roundCurrency(c.amount * (c.confidence ?? 1)) });
      if (!step) break;
      due += step;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface ProjectionResult {
  dailyBuckets: Array<{ date: string; inflow: number; outflow: number; closingBalance: number }>;
  expectedInflows: number;
  expectedOutflows: number;
  closingBalance: number;
  minProjectedBalance: number;
  troughDate: string | null;
  shortfallDate: string | null;
  shortfallAmount: number;
  daysOfBuffer: number;
}

export function buildProjection(input: {
  openingBalance: number;
  history: DailyNet[];
  commitments: CommitmentLike[];
  receivables: ReceivableLike[];
  asOf: Date;
  horizonDays?: number;
}): ProjectionResult {
  const horizon = input.horizonDays ?? 90;
  const asOf = startOfDay(input.asOf);
  const scheduledOut = expandCommitments(input.commitments, asOf, horizon);
  const outByDay = new Map<string, number>();
  for (const s of scheduledOut) outByDay.set(s.date, (outByDay.get(s.date) ?? 0) + s.amount);
  const inByDay = new Map<string, number>();
  for (const r of input.receivables) {
    const bucket = ageBucket(r.createdAt, asOf);
    const eta = new Date(asOf.getTime() + (MEDIAN_DAYS_TO_COLLECT[bucket] ?? 16) * DAY);
    if (eta.getTime() > asOf.getTime() + horizon * DAY) continue;
    const key = isoDay(eta);
    inByDay.set(key, (inByDay.get(key) ?? 0) + r.amount * (COLLECTION_PROB[bucket] ?? 0.3));
  }
  const inSeries = input.history.map((h) => ({ date: h.date, amount: h.inflow }));
  const outSeries = input.history.map((h) => ({ date: h.date, amount: h.outflow }));
  const inFactors = dowFactors(inSeries);
  const outFactors = dowFactors(outSeries);
  const avg = (xs: Array<{ amount: number }>) =>
    xs.length ? xs.slice(-28).reduce((a, s) => a + s.amount, 0) / Math.min(28, xs.length) : 0;
  const inLevel = avg(inSeries);
  const outLevel = avg(outSeries);
  const inTrend = robustTrend(inSeries);
  const outTrend = robustTrend(outSeries);

  let balance = roundCurrency(input.openingBalance);
  let min = balance;
  let troughDate: string | null = null;
  let shortfallDate: string | null = null;
  let shortfallAmount = 0;
  const buckets: ProjectionResult['dailyBuckets'] = [];
  for (let d = 1; d <= horizon; d++) {
    const date = new Date(asOf.getTime() + d * DAY);
    const key = isoDay(date);
    const dow = date.getUTCDay();
    const forecastIn = Math.max(0, (inLevel + inTrend * d) * inFactors[dow]);
    const baselineOut = Math.max(0, (outLevel + outTrend * d) * outFactors[dow]);
    const inflow = roundCurrency(forecastIn + (inByDay.get(key) ?? 0));
    const outflow = roundCurrency(baselineOut + (outByDay.get(key) ?? 0));
    balance = roundCurrency(balance + inflow - outflow); // running balance: round each step (§2.2)
    if (balance < min) {
      min = balance;
      troughDate = key;
    }
    if (shortfallDate === null && balance < 0) {
      shortfallDate = key;
      shortfallAmount = roundCurrency(Math.abs(balance));
    }
    buckets.push({ date: key, inflow, outflow, closingBalance: balance });
  }
  const avgDailyOut = input.history.length
    ? input.history.slice(-28).reduce((a, h) => a + h.outflow, 0) / Math.min(28, input.history.length)
    : 0;
  return {
    dailyBuckets: buckets,
    expectedInflows: sumMoney(buckets.map((b) => b.inflow)),
    expectedOutflows: sumMoney(buckets.map((b) => b.outflow)),
    closingBalance: balance,
    minProjectedBalance: roundCurrency(min),
    troughDate,
    shortfallDate,
    shortfallAmount,
    daysOfBuffer: avgDailyOut > 0 ? roundCurrency((input.openingBalance / avgDailyOut) * 10) / 10 : 0,
  };
}
