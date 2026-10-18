/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma, { shopClock } from '../shared/database';
import { callStructured, hashInput } from '../../../../lib/ai/client';
import * as prompts from '../../../../lib/ai/prompts';
import { roundCurrency, sumMoney } from '../shared/money';
import {
  buildProfile, productEconomics, concentration, breakeven, forecastDaily, detectAnomalies,
  type ProductSale,
} from '../shared/metricEngine';
import { verifyHypothesis, rankCandidates, type Candidate } from '../shared/verifier';
import { simulateScenario, expectedValue, type ScenarioLever } from '../shared/scenario';
import { loadProfileAggregates, loadDailySales, loadOpenDebts, assertShop } from '../shared/shopData';
import ApiError from '../../../../errors/ApiError';

const db = () => prisma as any;
const DAY = 86400000;

async function loadProductSales(tenantId: string, shopId: string, days = 90): Promise<ProductSale[]> {
  const raw = db();
  const asOf = await shopClock(tenantId, shopId);
  const start = new Date(asOf.getTime() - days * DAY);
  const items = await raw.checkoutItem.findMany({
    where: { tenantID: tenantId, checkout: { shopID: shopId, tenantID: tenantId, isDraft: false }, createdAt: { gte: start, lte: asOf } },
    select: { productName: true, variantId: true, quantity: true, discountedPrice: true, lotId: true, createdAt: true },
  }).catch(() => []);
  const lotIds = [...new Set(items.map((i: any) => i.lotId).filter(Boolean))];
  const lots = lotIds.length ? await raw.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, buyPrice: true } }).catch(() => []) : [];
  const lotPrice = new Map<string, number>(lots.map((l: any) => [l.id, l.buyPrice]));
  const variants = await raw.shopVariant.findMany({
    where: { shopID: shopId, tenantID: tenantId },
    select: { id: true, lastSoldDate: true, Lot: { select: { stock: true, buyPrice: true } } },
  }).catch(() => []);
  const invByVariant = new Map<string, number>();
  const lastSold = new Map<string, Date | null>();
  for (const v of variants) {
    invByVariant.set(v.id, sumMoney((v.Lot ?? []).map((l: any) => l.stock * l.buyPrice)));
    lastSold.set(v.id, v.lastSoldDate ? new Date(v.lastSoldDate) : null);
  }
  const byProduct = new Map<string, ProductSale & { lastSale: number }>();
  for (const i of items) {
    const key = (i.variantId as string) || (i.productName as string);
    const cur = byProduct.get(key) ?? {
      productKey: key, productName: i.productName as string, revenue: 0, cogs: 0, units: 0,
      inventoryValue: invByVariant.get(key) ?? 0, daysSinceLastSale: null, lastSale: 0,
    };
    cur.revenue += i.quantity * i.discountedPrice;
    cur.cogs += i.quantity * (i.lotId ? (lotPrice.get(i.lotId) ?? i.discountedPrice * 0.7) : i.discountedPrice * 0.7);
    cur.units += i.quantity;
    cur.lastSale = Math.max(cur.lastSale, new Date(i.createdAt).getTime());
    byProduct.set(key, cur);
  }
  return [...byProduct.values()].map(({ lastSale, ...p }) => ({
    ...p,
    revenue: roundCurrency(p.revenue),
    cogs: roundCurrency(p.cogs),
    daysSinceLastSale: lastSale ? Math.floor((asOf.getTime() - lastSale) / DAY) : (lastSold.get(p.productKey) ? Math.floor((asOf.getTime() - new Date(lastSold.get(p.productKey)!).getTime()) / DAY) : null),
  }));
}

async function metricPack(tenantId: string, shopId: string) {
  const asOf = await shopClock(tenantId, shopId);
  const aggregates = await loadProfileAggregates(tenantId, shopId, 90);
  const profile = buildProfile(aggregates);
  const products = await loadProductSales(tenantId, shopId);
  const econ = productEconomics(products);
  const debts = await loadOpenDebts(tenantId, shopId);
  const overdue = debts.filter((d) => (asOf.getTime() - d.createdAt.getTime()) / DAY > 30);
  const sales = await db().checkout.findMany({
    where: { shopID: shopId, tenantID: tenantId, isDraft: false },
    select: { buyerID: true, totalPrice: true },
  }).catch(() => []);
  const byBuyer = new Map<string, number>();
  for (const s of sales) if (s.buyerID) byBuyer.set(s.buyerID, (byBuyer.get(s.buyerID) ?? 0) + s.totalPrice);
  const customers = concentration([...byBuyer.entries()].map(([key, amount]) => ({ key, label: 'Customer', amount })));
  const be = breakeven(roundCurrency(profile.opex / 3), profile.grossMargin, profile.avgTransactionValue);
  return {
    profile,
    families: {
      pnl: {
        revenue: profile.revenue, cogs: profile.cogs, grossProfit: profile.grossProfit,
        grossMargin: profile.grossMargin, opex: profile.opex, ebitda: profile.ebitda, netProfit: profile.netProfit,
        discountRate: aggregates.grossSales > 0 ? roundCurrency((aggregates.discounts / aggregates.grossSales) * 10000) / 100 : 0,
        shrinkage: aggregates.shrinkage,
      },
      unitEconomics: econ.slice(0, 20),
      workingCapital: {
        receivables: profile.receivables, payables: profile.payables, inventoryValue: profile.inventoryValue,
        dso: profile.dso, dio: profile.dio, dpo: profile.dpo, cashConversionCycle: profile.cashConversionCycle,
      },
      profitability: { ...be, runRateMonthlyRevenue: profile.monthlyRevenue, operatingLeverage: profile.revenue ? roundCurrency((profile.netProfit / Math.max(1, profile.revenue)) * 10000) / 100 : 0 },
      risk: {
        customerConcentration: customers, debtToRevenue: profile.debtToRevenue,
        overdueShareOfAr: profile.receivables > 0 ? roundCurrency((sumMoney(overdue.map((d) => d.amount)) / profile.receivables) * 10000) / 100 : 0,
        salesVolatility: profile.salesVolatility,
      },
      meta: { dataCompleteness: profile.dataCompleteness, businessAgeMonths: profile.businessAgeMonths, transactionCount: aggregates.transactionCount },
    },
    products: econ,
    debts,
    aggregates,
  };
}

export const analysisService = {
  async getMetrics(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const pack = await metricPack(tenantId, shopId);
    const period = (await shopClock(tenantId, shopId)).toISOString().slice(0, 7);
    const snapshots = [
      { metricKey: 'gross_margin', value: pack.profile.grossMargin, unit: 'PCT' },
      { metricKey: 'dso', value: pack.profile.dso, unit: 'DAYS' },
      { metricKey: 'ccc', value: pack.profile.cashConversionCycle, unit: 'DAYS' },
      { metricKey: 'revenue_90d', value: pack.profile.revenue, unit: 'BDT' },
    ];
    for (const s of snapshots)
      await db().financialMetricSnapshot.create({ data: { tenantID: tenantId, shopID: shopId, period, ...s } }).catch(() => undefined);
    return pack.families;
  },

  async getProductEconomics(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    return loadProductSales(tenantId, shopId).then((p) => productEconomics(p));
  },

  async getWorkingCapital(tenantId: string, shopId: string) {
    const pack = await metricPack(tenantId, shopId);
    return pack.families.workingCapital;
  },

  async getBreakeven(tenantId: string, shopId: string) {
    const pack = await metricPack(tenantId, shopId);
    return pack.families.profitability;
  },

  async getConcentration(tenantId: string, shopId: string) {
    const pack = await metricPack(tenantId, shopId);
    return { customers: pack.families.risk.customerConcentration };
  },

  /** Detector → hypotheses → counterfactual verifier. Only VERIFIED reach the feed. */
  async generateInsights(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const pack = await metricPack(tenantId, shopId);
    const daily = await loadDailySales(tenantId, shopId, 120);
    const anomalies = detectAnomalies(daily, 'revenue');
    const created: any[] = [];
    const pushInsight = async (input: any) => {
      const row = await db().insight.create({
        data: {
          tenantID: tenantId, shopID: shopId, insightType: input.insightType, severity: input.severity,
          title: input.title, summary: input.summary, metricSnapshot: JSON.parse(JSON.stringify(input.metricSnapshot)),
          hypothesis: input.hypothesis, candidates: JSON.parse(JSON.stringify(input.candidates ?? [])),
          verificationStatus: input.verificationStatus, verifiedMetrics: input.verifiedMetrics ? JSON.parse(JSON.stringify(input.verifiedMetrics)) : null,
          aiConfidence: input.aiConfidence ?? 0.7, model: input.model ?? 'deterministic-core',
          promptVersion: prompts.hypothesizeAnomalies.version, status: 'NEW',
        },
      }).catch(() => null);
      if (row) created.push(row);
      return row;
    };

    for (const a of anomalies.slice(0, 5)) {
      // Candidates: customer-level revenue change around the anomaly window.
      const sales = await db().checkout.findMany({
        where: { shopID: shopId, tenantID: tenantId, isDraft: false },
        select: { buyerID: true, totalPrice: true, createdAt: true },
      }).catch(() => []);
      const dayMs = new Date(a.date).getTime();
      const recent = new Map<string, number>();
      const prior = new Map<string, number>();
      for (const s of sales) {
        if (!s.buyerID) continue;
        const t = new Date(s.createdAt).getTime();
        if (t >= dayMs - 7 * DAY && t <= dayMs + DAY) recent.set(s.buyerID, (recent.get(s.buyerID) ?? 0) + s.totalPrice);
        if (t >= dayMs - 35 * DAY && t < dayMs - 7 * DAY) prior.set(s.buyerID, (prior.get(s.buyerID) ?? 0) + s.totalPrice / 4);
      }
      const candidates: Candidate[] = [...new Set([...recent.keys(), ...prior.keys()])]
        .map((id) => ({
          id, label: 'Customer', kind: 'CUSTOMER',
          contribution: roundCurrency((prior.get(id) ?? 0) - (recent.get(id) ?? 0)),
        }))
        .filter((c) => c.contribution !== 0)
        .sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution))
        .slice(0, 5);
      const hypothesised = await callStructured({
        agentType: 'ANALYST_AGENT', purpose: 'hypothesize_anomalies', promptVersion: prompts.hypothesizeAnomalies.version,
        tier: 'reasoning', pillar: 'analysis', system: prompts.hypothesizeAnomalies.system, tenantID: tenantId, shopID: shopId,
        input: { anomalies: [{ date: a.date, metric: a.metric, gap: a.gap, candidates: candidates.map((c) => ({ candidateId: c.id, contribution: c.contribution })) }] },
        outputSchema: prompts.hypothesizeAnomalies.outputSchema,
        fallback: () => ({ results: [{ anomalyDate: a.date, hypotheses: rankCandidates(candidates) }] }),
      });
      const top = hypothesised.data.results[0]?.hypotheses?.[0];
      const candidate = candidates.find((c) => c.id === top?.candidateId) ?? candidates[0];
      if (!candidate) continue;
      const verification = verifyHypothesis(a.gap, { ...candidate, contribution: -candidate.contribution });
      // Gap is actual−expected (negative on a drop); a customer who stopped
      // buying contributes negatively, so verify on magnitudes consistently.
      const signed = verifyHypothesis(Math.abs(a.gap), { ...candidate, contribution: Math.abs(candidate.contribution) });
      void verification;
      await pushInsight({
        insightType: 'ANOMALY',
        severity: Math.abs(a.gap) > pack.profile.avgDailyRevenue * 2 ? 'WARNING' : 'INFO',
        title: `Unusual ${a.metric} on ${a.date}`,
        summary: `${a.metric} was ৳${Math.round(a.actual).toLocaleString('en-IN')} against a day-of-week expectation of ৳${Math.round(a.expected).toLocaleString('en-IN')} (gap ৳${Math.round(a.gap).toLocaleString('en-IN')}).`,
        metricSnapshot: { date: a.date, actual: a.actual, expected: a.expected, gap: a.gap, zScore: a.zScore },
        hypothesis: top?.mechanism ?? candidate.id,
        candidates,
        verificationStatus: signed.status,
        verifiedMetrics: signed.verifiedMetrics,
        aiConfidence: top?.confidence ?? 0.6,
        model: hypothesised.model,
      });
    }

    // Deterministic detectors (§6.3).
    const dead = pack.products.filter((p) => p.deadStock);
    if (dead.length) {
      const value = sumMoney(dead.map((d) => d.inventoryValue));
      await pushInsight({
        insightType: 'WORKING_CAPITAL', severity: 'WARNING',
        title: `${dead.length} products are dead stock`,
        summary: `৳${Math.round(value).toLocaleString('en-IN')} is trapped in stock unsold for 45+ days.`,
        metricSnapshot: { trappedValue: value, products: dead.map((d) => d.productName) },
        hypothesis: 'Capital is trapped in slow-moving inventory and can be released by liquidation.',
        candidates: [], verificationStatus: 'VERIFIED',
        verifiedMetrics: { trappedValue: value }, aiConfidence: 0.85,
      });
    }
    const leaky = pack.products.filter((p) => p.revenue > 0 && pack.profile.grossMargin - p.contributionMargin > 8);
    if (leaky.length)
      await pushInsight({
        insightType: 'MARGIN_LEAK', severity: 'WARNING',
        title: `${leaky.length} products earn far below shop margin`,
        summary: `${leaky.map((l) => l.productName).slice(0, 3).join(', ')} run more than 8 points below your ${pack.profile.grossMargin.toFixed(1)}% gross margin.`,
        metricSnapshot: { shopMargin: pack.profile.grossMargin, products: leaky.map((l) => ({ name: l.productName, margin: l.contributionMargin })) },
        hypothesis: 'Discounting or stale buy prices are leaking margin on these products.',
        candidates: [], verificationStatus: 'VERIFIED', verifiedMetrics: { shopMargin: pack.profile.grossMargin }, aiConfidence: 0.8,
      });
    if (pack.families.risk.customerConcentration.concentrated)
      await pushInsight({
        insightType: 'CONCENTRATION_RISK', severity: 'WARNING',
        title: 'Customer concentration risk',
        summary: `Top customer share is ${pack.families.risk.customerConcentration.top1Share}% (HHI ${pack.families.risk.customerConcentration.hhi}).`,
        metricSnapshot: pack.families.risk.customerConcentration,
        hypothesis: 'Losing the top customer would remove a quarter or more of revenue.',
        candidates: [], verificationStatus: 'VERIFIED', verifiedMetrics: { hhi: pack.families.risk.customerConcentration.hhi }, aiConfidence: 0.85,
      });
    if (pack.families.risk.overdueShareOfAr > 20)
      await pushInsight({
        insightType: 'DEBT_RISK', severity: 'CRITICAL',
        title: 'Overdue receivables are high',
        summary: `${pack.families.risk.overdueShareOfAr}% of receivables are 30+ days overdue.`,
        metricSnapshot: { overdueShareOfAr: pack.families.risk.overdueShareOfAr },
        hypothesis: 'Slow collection is inflating DSO and starving working capital.',
        candidates: [], verificationStatus: 'VERIFIED', verifiedMetrics: { dso: pack.profile.dso }, aiConfidence: 0.85,
      });
    return created;
  },

  async listInsights(tenantId: string, shopId: string, query: any) {
    await assertShop(tenantId, shopId);
    let rows = await db().insight.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []);
    if (!rows.length) {
      await this.generateInsights(tenantId, shopId);
      rows = await db().insight.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 50 });
    }
    const verifiedOnly = query?.verified !== 'false';
    return {
      insights: verifiedOnly ? rows.filter((r: any) => r.verificationStatus === 'VERIFIED') : rows,
      refutedCount: rows.filter((r: any) => r.verificationStatus === 'REFUTED').length,
      totalGenerated: rows.length,
    };
  },

  async verifyInsight(tenantId: string, shopId: string, id: string) {
    const row = await db().insight.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!row) throw Object.assign(new Error('Insight not found'), { statusCode: 404 });
    const candidates = (row.candidates as unknown as Candidate[]) ?? [];
    const gap = Number((row.metricSnapshot as any)?.gap ?? 0);
    const top = candidates[0];
    if (!top || !gap) return row;
    const result = verifyHypothesis(Math.abs(gap), { ...top, contribution: Math.abs(top.contribution) });
    return db().insight.update({ where: { id }, data: { verificationStatus: result.status, verifiedMetrics: JSON.parse(JSON.stringify(result.verifiedMetrics)) } });
  },

  async dismissInsight(tenantId: string, shopId: string, id: string) {
    const row = await db().insight.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!row) throw Object.assign(new Error('Insight not found'), { statusCode: 404 });
    return db().insight.update({ where: { id }, data: { status: 'DISMISSED' } });
  },

  async createScenario(tenantId: string, shopId: string, body: any) {
    await assertShop(tenantId, shopId);
    const pack = await metricPack(tenantId, shopId);
    const levers = (body.assumptions ?? []) as ScenarioLever[];
    const projected = simulateScenario(
      { monthlyRevenue: pack.profile.monthlyRevenue, grossMarginPct: pack.profile.grossMargin, monthlyOpex: roundCurrency(pack.profile.opex / 3), currentCash: pack.profile.currentCash, ccc: pack.profile.cashConversionCycle, dso: pack.profile.dso },
      levers,
    );
    const ev = expectedValue(Math.max(0, projected.profitDelta), Math.min(0, projected.profitDelta), 0.6);
    return db().scenario.create({
      data: {
        tenantID: tenantId, shopID: shopId, name: body.name ?? 'Scenario',
        assumptions: JSON.parse(JSON.stringify(levers)), projected: JSON.parse(JSON.stringify(projected)),
        expectedValue: ev, confidence: 0.6, createdBy: body.createdBy ?? 'OWNER',
      },
    });
  },

  async listScenarios(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    return db().scenario.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 20 });
  },

  async recommendScenario(tenantId: string, shopId: string, id: string) {
    const scenarios = await this.listScenarios(tenantId, shopId);
    if (!scenarios.length) throw Object.assign(new Error('No scenarios to rank'), { statusCode: 404 });
    const ranked = [...scenarios].sort((a: any, b: any) => (b.expectedValue ?? 0) - (a.expectedValue ?? 0));
    const best = ranked[0];
    const note = `Best expected value is "${best.name}" at ৳${Math.round(best.expectedValue ?? 0).toLocaleString('en-IN')}. ${id === best.id ? 'This is the scenario you selected — it is also the best on the numbers.' : `Your selected scenario ranks #${ranked.findIndex((r: any) => r.id === id) + 1} of ${ranked.length}.`}`;
    await db().scenario.update({ where: { id: best.id }, data: { aiRecommendation: note } }).catch(() => undefined);
    return { ranked: ranked.map((s: any) => ({ id: s.id, name: s.name, expectedValue: s.expectedValue })), recommendation: note, bestID: best.id };
  },

  async getForecast(tenantId: string, shopId: string, target = 'REVENUE', horizon = 30) {
    await assertShop(tenantId, shopId);
    const daily = await loadDailySales(tenantId, shopId, 120);
    const result = forecastDaily(daily, horizon, await shopClock(tenantId, shopId));
    const row = await db().forecast.create({
      data: {
        tenantID: tenantId, shopID: shopId, target: target as any, horizonDays: horizon,
        series: JSON.parse(JSON.stringify(result.series)), method: result.method,
        backtestMAPE: result.backtestMAPE, aiNarrative: result.backtestMAPE != null && result.backtestMAPE > 15 ? 'Forecast accuracy is currently poor (MAPE above 15%) — treat the band, not the line, as the guide.' : 'Forecast backtests within a usable range.',
      },
    }).catch(() => null);
    return { ...(row ?? {}), series: result.series, backtestMAPE: result.backtestMAPE, method: result.method, level: result.level };
  },

  async createCapitalDecision(tenantId: string, shopId: string, body: any) {
    await assertShop(tenantId, shopId);
    if (body.insightID && !await db().insight.findFirst({ where: { id: body.insightID, tenantID: tenantId, shopID: shopId, verificationStatus: 'VERIFIED' } }))
      throw new ApiError(400, 'Choose a verified insight from this shop');
    const row = await db().capitalDecision.create({
      data: {
        tenantID: tenantId, shopID: shopId, insightID: body.insightID ?? null,
        decisionType: body.decisionType ?? 'HOLD', title: body.title, rationale: body.rationale ?? '',
        capitalReleased: roundCurrency(body.capitalReleased ?? 0),
        projectedProfitImpact: roundCurrency(body.projectedProfitImpact ?? 0), status: 'PROPOSED',
      },
    });
    await db().aiDecision.create({
      data: {
        tenantID: tenantId, shopID: shopId, agentType: 'ANALYST_AGENT', decisionType: body.decisionType ?? 'HOLD',
        action: body.title, rationale: body.rationale ?? '', confidence: 0.7, model: 'deterministic-core',
        promptVersion: prompts.rankScenarios.version, inputHash: hashInput({ title: body.title }),
        inputSnapshot: { capitalDecisionID: row.id }, output: { capitalReleased: row.capitalReleased },
        projectedImpact: row.projectedProfitImpact, guardResult: 'NO_GUARD_REQUIRED', status: 'PROPOSED',
      },
    }).catch(() => undefined);
    return row;
  },

  async listCapitalDecisions(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    return db().capitalDecision.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 50 });
  },

  async approveCapitalDecision(tenantId: string, shopId: string, id: string) {
    const row = await db().capitalDecision.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!row) throw Object.assign(new Error('Capital decision not found'), { statusCode: 404 });
    if (row.status !== 'PROPOSED') throw new ApiError(409, 'Only proposed decisions can be approved');
    const approvedAt = await shopClock(tenantId, shopId);
    const baseline = buildProfile(await loadProfileAggregates(tenantId, shopId, 30, approvedAt));
    return db().capitalDecision.update({ where: { id, status: 'PROPOSED' }, data: { status: 'APPROVED', approvedAt,
      measurement: { basis: 'observed-before-after-not-causal', baselineStart: new Date(approvedAt.getTime() - 30 * DAY).toISOString(), baselineEnd: approvedAt.toISOString(), baselineNetProfit: baseline.netProfit },
    } });
  },

  async measureCapitalDecision(tenantId: string, shopId: string, id: string) {
    const row = await db().capitalDecision.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!row) throw new ApiError(404, 'Capital decision not found');
    if (row.status === 'MEASURED') return row;
    if (row.status !== 'APPROVED' || !row.approvedAt || !row.measurement) throw new ApiError(409, 'Decision needs an approved baseline before measurement');
    const end = new Date(new Date(row.approvedAt).getTime() + 30 * DAY);
    if ((await shopClock(tenantId, shopId)) < end) throw new ApiError(409, 'The 30-day observation window has not finished');
    const observed = buildProfile(await loadProfileAggregates(tenantId, shopId, 30, end));
    const change = roundCurrency(observed.netProfit - row.measurement.baselineNetProfit);
    return db().capitalDecision.update({ where: { id, status: 'APPROVED' }, data: { status: 'MEASURED', measuredAt: end,
      realizedProfitImpact: change, measurement: { ...row.measurement, observedEnd: end.toISOString(), observedNetProfit: observed.netProfit, observedChange: change,
        limitation: 'Shop-level before/after change; not proven causal impact and not additive across overlapping decisions.' },
    } });
  },

  async getReport(tenantId: string, shopId: string) {
    const metrics = await this.getMetrics(tenantId, shopId);
    const { insights } = await this.listInsights(tenantId, shopId, {});
    const forecast = await this.getForecast(tenantId, shopId, 'REVENUE', 30);
    const p = metrics;
    const headline = `Revenue (90d) ৳${Math.round((p.pnl as any).revenue ?? 0).toLocaleString('en-IN')} at ${(p.pnl as any).grossMargin}% gross margin; CCC is ${(p.workingCapital as any).cashConversionCycle} days with ৳${Math.round((p.workingCapital as any).inventoryValue ?? 0).toLocaleString('en-IN')} held in stock.`;
    return { headline, metrics, insights, forecast: { backtestMAPE: forecast.backtestMAPE, method: forecast.method } };
  },
};
