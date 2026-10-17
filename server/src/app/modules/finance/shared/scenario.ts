import { roundCurrency } from './money';

/**
 * Deterministic scenario simulator (PLAN §6.5). Levers are owner-editable
 * constants; the analyst only ranks finished simulations by expected value.
 */
export const PRICE_ELASTICITY = -1.2;

export interface ScenarioLever {
  key: string;
  label: string;
  from: number;
  to: number;
  unit: string;
}
export interface ScenarioBase {
  monthlyRevenue: number;
  grossMarginPct: number;
  monthlyOpex: number;
  currentCash: number;
  ccc: number;
  dso: number;
}

export function simulateScenario(base: ScenarioBase, levers: ScenarioLever[]) {
  let revenue = base.monthlyRevenue;
  let marginPct = base.grossMarginPct;
  let opex = base.monthlyOpex;
  let cccDelta = 0;
  const riskFlags: string[] = [];
  for (const lever of levers) {
    const delta = lever.to - lever.from;
    if (lever.key === 'price_change_pct') {
      const volumeEffect = 1 + (PRICE_ELASTICITY * delta) / 100;
      revenue = revenue * (1 + delta / 100) * volumeEffect;
      marginPct = Math.min(95, marginPct + delta * 0.6);
      if (delta > 5) riskFlags.push('Price rise above 5% may churn price-sensitive buyers.');
    } else if (lever.key === 'collect_faster_days') {
      cccDelta -= Math.abs(delta);
    } else if (lever.key === 'opex_change_pct') {
      opex = opex * (1 + delta / 100);
    } else if (lever.key === 'revenue_change_pct') {
      revenue = revenue * (1 + delta / 100);
    } else if (lever.key === 'drop_bottom_skus_pct') {
      revenue = revenue * (1 - Math.abs(delta) / 100 / 4); // bottom SKUs carry little revenue
      marginPct = Math.min(95, marginPct + Math.abs(delta) / 10);
    }
  }
  const profit = roundCurrency((revenue * marginPct) / 100 - opex);
  const baseProfit = roundCurrency((base.monthlyRevenue * base.grossMarginPct) / 100 - base.monthlyOpex);
  return {
    revenue: roundCurrency(revenue),
    revenueDelta: roundCurrency(revenue - base.monthlyRevenue),
    profit,
    profitDelta: roundCurrency(profit - baseProfit),
    cashTrough: roundCurrency(base.currentCash + (profit - baseProfit)),
    ccc: roundCurrency((base.ccc + cccDelta) * 10) / 10,
    cccDelta: roundCurrency(cccDelta * 10) / 10,
    riskFlags,
  };
}

/** EV = p×upside − (1−p)×downside, computed in code (PLAN §6.5). */
export function expectedValue(upside: number, downside: number, probability: number): number {
  const p = Math.max(0, Math.min(1, probability));
  return roundCurrency(p * upside - (1 - p) * Math.abs(downside));
}
