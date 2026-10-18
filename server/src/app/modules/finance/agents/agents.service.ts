/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma, { shopClock } from '../shared/database';
import { roundCurrency, sumMoney } from '../shared/money';
import { ensureDefaultPolicies } from '../shared/catalog';
import { assertShop, loadOpenDebts } from '../shared/shopData';
import { compositeScore, probabilityOfDefault, lossGivenDefault } from './agentCore';
import {
  BENCHMARK_POLICY_VERSION, lenderBenchmarkImpact, borrowerBenchmarkCost, borrowerCostOf,
  treasurerBenchmarkImpact, analystBenchmarkImpact,
} from './benchmarks';
import { buildProfile } from '../shared/metricEngine';
import { loadProfileAggregates } from '../shared/shopData';

const db = () => prisma as any;
const AGENTS = ['LENDER_AGENT', 'BORROWER_AGENT', 'TREASURER_AGENT', 'ANALYST_AGENT'] as const;

export const agentsService = {
  async listPolicies(tenantId: string) {
    void tenantId;
    await ensureDefaultPolicies(db());
    return db().aiAgentPolicy.findMany({ where: { isActive: true }, orderBy: { agentType: 'asc' } });
  },

  async updatePolicy(id: string, body: any) {
    const existing = await db().aiAgentPolicy.findUnique({ where: { id } });
    if (!existing) throw Object.assign(new Error('Policy not found'), { statusCode: 404 });
    return db().aiAgentPolicy.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.objective !== undefined ? { objective: body.objective } : {}),
        ...(body.riskAppetite !== undefined ? { riskAppetite: Number(body.riskAppetite) } : {}),
        ...(body.maxExposure !== undefined ? { maxExposure: body.maxExposure } : {}),
        ...(body.bufferTargetDays !== undefined ? { bufferTargetDays: body.bufferTargetDays } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        version: (existing.version ?? 1) + 1,
      },
    });
  },

  async listDecisions(tenantId: string, shopId: string, agentType?: string) {
    await assertShop(tenantId, shopId);
    return db().aiDecision.findMany({
      where: { tenantID: tenantId, shopID: shopId, ...(agentType ? { agentType: agentType as any } : {}) },
      orderBy: { decidedAt: 'desc' }, take: 100,
    });
  },

  async listRuns(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [runs, spent] = await Promise.all([
      db().aiRun.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []),
      db().aiRun.aggregate({ where: { createdAt: { gte: monthStart }, ...(tenantId ? { tenantID: tenantId } : {}) }, _sum: { costUsd: true } }).catch(() => ({ _sum: { costUsd: 0 } })),
    ]);
    return { runs, spentUsdThisMonth: roundCurrency(spent?._sum?.costUsd ?? 0), budgetUsd: Number(process.env.AI_PLAN_BUDGET_USD || 2) };
  },

  /** Scorecards: alpha = realized − benchmark, same universe, same PD/LGD (§1.1.1). */
  async performance(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const periodEnd = await shopClock(tenantId, shopId);
    const periodStart = new Date(periodEnd.getTime() - 90 * 86400000);
    const profile = buildProfile(await loadProfileAggregates(tenantId, shopId, 90));
    const pd = probabilityOfDefault(profile);
    const results: any[] = [];
    for (const agentType of AGENTS) {
      const decisions = await db().aiDecision.findMany({ where: { tenantID: tenantId, shopID: shopId, agentType: agentType as any } }).catch(() => []);
      const projectedSum = sumMoney(decisions.map((d: any) => d.projectedImpact));
      let realizedSum = sumMoney(decisions.map((d: any) => d.realizedImpact ?? 0));
      let benchmarkImpact = 0;
      let avoidedShortfallAmount = 0;
      let offerAcceptanceRate: number | null = null;
      let costSavedVsBaseline: number | null = null;
      if (agentType === 'LENDER_AGENT') {
        const offers = await db().financingOffer.findMany({ where: { tenantID: tenantId, shopID: shopId } }).catch(() => []);
        const applications = await db().financingApplication.findMany({ where: { tenantID: tenantId, shopID: shopId } }).catch(() => []);
        offerAcceptanceRate = offers.length ? roundCurrency((applications.length / offers.length) * 10000) / 100 : null;
        benchmarkImpact = lenderBenchmarkImpact(
          offers.map((o: any) => ({
            amount: o.offeredAmount, baseRate: 13, interestRateMin: Math.max(1, o.offeredRate - 4),
            interestRateMax: o.offeredRate + 3, fundingCostPct: 8, tenorMonths: o.tenorMonths,
            pd, lgd: lossGivenDefault(o.collateralRequired), expectedTenorFraction: 0.85,
          })),
        );
        realizedSum = sumMoney(applications.map((a: any) => a.requestedAmount * 0.02));
      }
      if (agentType === 'BORROWER_AGENT') {
        const offers = await db().financingOffer.findMany({ where: { tenantID: tenantId, shopID: shopId } }).catch(() => []);
        const accepted = offers.filter((o: any) => o.status === 'ACCEPTED');
        if (accepted.length && offers.length) {
          costSavedVsBaseline = roundCurrency(borrowerBenchmarkCost(offers) - borrowerCostOf(accepted[0]));
          realizedSum = costSavedVsBaseline;
          benchmarkImpact = borrowerBenchmarkCost(offers);
        }
      }
      if (agentType === 'TREASURER_AGENT') {
        const actions = await db().treasuryAction.findMany({ where: { tenantID: tenantId, shopID: shopId } }).catch(() => []);
        realizedSum = sumMoney(actions.map((a: any) => a.realizedImpact ?? (a.status === 'EXECUTED' || a.status === 'RECONCILED' ? a.projectedImpact : 0)));
        avoidedShortfallAmount = sumMoney(actions.filter((a: any) => a.actionType === 'COLLECT_DEBT').map((a: any) => a.realizedImpact ?? 0));
        const debts = await loadOpenDebts(tenantId, shopId);
        benchmarkImpact = treasurerBenchmarkImpact(
          debts.map((d) => ({
            amount: d.amount,
            daysOverdue: Math.floor((periodEnd.getTime() - d.createdAt.getTime()) / 86400000),
            collectedWithinHorizon: d.status === 'PAID',
          })),
        );
      }
      if (agentType === 'ANALYST_AGENT') {
        const decisionsRows = await db().capitalDecision.findMany({ where: { tenantID: tenantId, shopID: shopId } }).catch(() => []);
        realizedSum = sumMoney(decisionsRows.map((d: any) => d.realizedProfitImpact ?? 0));
        benchmarkImpact = analystBenchmarkImpact(
          [{ key: 'all', revenue: profile.revenue, realizedProfitImpact: roundCurrency(profile.netProfit * 0.1) }],
        );
      }
      const executed = decisions.filter((d: any) => d.status === 'EXECUTED' || d.status === 'RECONCILED').length;
      const guardRejects = decisions.filter((d: any) => d.guardResult === 'REJECTED_BY_GUARD').length;
      const alpha = roundCurrency(realizedSum - benchmarkImpact);
      const score = compositeScore({ decisions: decisions.length, executed, guardRejects, projectedSum, realizedSum });
      const row = await db().agentPerformance.create({
        data: {
          tenantID: tenantId, shopID: shopId, agentType: agentType as any, periodStart, periodEnd,
          decisionsCount: decisions.length, executedCount: executed, guardRejects,
          projectedImpactSum: projectedSum, realizedImpactSum: realizedSum,
          avoidedShortfallAmount, forecastMAPE: null, offerAcceptanceRate, costSavedVsBaseline,
          benchmarkImpact, alpha, benchmarkPolicyVersion: BENCHMARK_POLICY_VERSION, score,
        },
      }).catch(() => ({
        tenantID: tenantId, shopID: shopId, agentType, periodStart, periodEnd,
        decisionsCount: decisions.length, executedCount: executed, guardRejects,
        projectedImpactSum: projectedSum, realizedImpactSum: realizedSum, avoidedShortfallAmount,
        offerAcceptanceRate, costSavedVsBaseline, benchmarkImpact, alpha,
        benchmarkPolicyVersion: BENCHMARK_POLICY_VERSION, score,
      }));
      results.push(row);
    }
    return { performance: results, benchmarkPolicyVersion: BENCHMARK_POLICY_VERSION, profile: { pd, dataCompleteness: profile.dataCompleteness } };
  },

  async auditExport(tenantId: string, shopId: string) {
    const [policies, decisions, runs] = await Promise.all([
      this.listPolicies(tenantId),
      this.listDecisions(tenantId, shopId),
      db().aiRun.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }).catch(() => []),
    ]);
    const { performance } = await this.performance(tenantId, shopId);
    return {
      exportedAt: new Date().toISOString(),
      howThisWorks:
        'Deterministic engines compute every number. AI agents select and explain within guard limits. Each decision is logged with model, prompt version, input hash, projected impact and (after reconciliation) realized impact. Alpha compares realized impact with the pinned rule-based benchmark in benchmarks.ts.',
      policies, decisions, performance, runs,
    };
  },
};
