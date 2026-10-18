import { roundCurrency } from './money';

export function expenseSpikeRatio(items: Array<{ amount: number; expenseType: string; createdAt: Date }>, asOf: Date): number {
  const cutoff = asOf.getTime() - 7 * 86400000;
  let largest = 0;
  for (const item of items.filter(i => i.createdAt.getTime() > cutoff && i.createdAt <= asOf)) {
    const prior = items.filter(i => i.expenseType === item.expenseType && i.createdAt.getTime() <= cutoff && i.amount > 0)
      .map(i => i.amount).sort((a, b) => a - b);
    if (!prior.length) continue;
    const mid = Math.floor(prior.length / 2);
    const median = prior.length % 2 ? prior[mid] : (prior[mid - 1] + prior[mid]) / 2;
    largest = Math.max(largest, item.amount / median);
  }
  return roundCurrency(largest);
}
