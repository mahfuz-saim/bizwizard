/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma, { shopClock } from '../shared/database';
import { roundCurrency, sumMoney } from '../shared/money';
import { ensureDefaultPolicies } from '../shared/catalog';
import { assertShop } from '../shared/shopData';
import { probabilityOfDefault } from './agentCore';
import { BENCHMARK_POLICY_VERSION } from './benchmarks';
import { buildProfile } from '../shared/metricEngine';
import { loadProfileAggregates } from '../shared/shopData';
import ApiError from '../../../../errors/ApiError';
import { comparisonInput, fixtureChoice, measureComparison } from './comparison';
import { matchedEvaluationService } from './matchedEvaluation.service';

const db = () => prisma as any;
const AGENTS = ['LENDER_AGENT', 'BORROWER_AGENT', 'TREASURER_AGENT', 'ANALYST_AGENT'] as const;

export const agentsService = {
  async sandboxComparison(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    return { mode: 'fixture-policy-not-AI', note: 'Synthetic role models, not this shop\'s measured outcomes or live AI. Use the standalone --live benchmark to evaluate provider-generated choices.',
      cases: [0.05, 0.2, 0.5].map(risk => { const input = comparisonInput(risk); return measureComparison(input,fixtureChoice(input)); }) };
  },
  async listPolicies(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    await ensureDefaultPolicies(db(), tenantId, shopId);
    return db().aiAgentPolicy.findMany({ where: { tenantID: tenantId, shopID: shopId, isActive: true }, orderBy: { agentType: 'asc' } });
  },

  async updatePolicy(tenantId: string, shopId: string, id: string, body: any) {
    await assertShop(tenantId, shopId);
    return db().$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM ai_agent_policies WHERE id = ${id} AND "tenantID" = ${tenantId} AND "shopID" = ${shopId} FOR UPDATE`;
      const existing = await tx.aiAgentPolicy.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
      if (!existing) throw new ApiError(404, 'Policy not found');
      if (!existing.isActive) throw new ApiError(409, 'This mandate has a newer version. Refresh before saving.');
      const { id: previousID, createdAt, updatedAt, ...previous } = existing;
      void previousID; void createdAt; void updatedAt;
      await tx.aiAgentPolicy.update({ where: { id }, data: { isActive: false } });
      return tx.aiAgentPolicy.create({ data: {
        ...previous,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.objective !== undefined ? { objective: body.objective } : {}),
        ...(body.riskAppetite !== undefined ? { riskAppetite: Number(body.riskAppetite) } : {}),
        ...(body.maxExposure !== undefined ? { maxExposure: body.maxExposure } : {}),
        ...(body.bufferTargetDays !== undefined ? { bufferTargetDays: body.bufferTargetDays } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        version: (existing.version ?? 1) + 1,
        isActive: true,
      } });
    });
  },

  async listDecisions(tenantId: string, shopId: string, agentType?: string) {
    await assertShop(tenantId, shopId);
    return db().aiDecision.findMany({
      where: { tenantID: tenantId, shopID: shopId, ...(agentType ? { agentType: agentType as any } : {}) },
      orderBy: { decidedAt: 'desc' }, take: 100,
    });
  },

  async listRuns(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [runs, spent, budget] = await Promise.all([
      db().aiRun.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db().aiRun.aggregate({ where: { createdAt: { gte: monthStart }, tenantID: tenantId }, _sum: { costUsd: true } }),
      db().aiBudgetMonth.findUnique({ where: { tenantID_periodStart: { tenantID: tenantId, periodStart: monthStart } } }),
    ]);
    return { runs, spentUsdThisMonth: budget?.spentUsd ?? spent?._sum?.costUsd ?? 0, reservedUsd: budget?.reservedUsd ?? 0, budgetUsd: Number(process.env.AI_PLAN_BUDGET_USD ?? 2) };
  },

  /** Missing measured outcomes and matched counterfactuals remain unknown, never fabricated. */
  async performance(tenantId: string, shopId: string) {
    const shop = await assertShop(tenantId, shopId);
    const periodEnd = await shopClock(tenantId, shopId);
    const periodStart = new Date(periodEnd.getTime() - 90 * 86400000);
    const profile = buildProfile(await loadProfileAggregates(tenantId, shopId, 90));
    const pd = probabilityOfDefault(profile);
    const results: any[] = [];
    for (const agentType of AGENTS) {
      const decisions = await db().aiDecision.findMany({ where: { tenantID: tenantId, shopID: shopId, agentType: agentType as any, decidedAt: { gte: periodStart, lte: periodEnd } } });
      const projectedSum = sumMoney(decisions.map((d: any) => d.projectedImpact));
      let realizedSum: number | null = null;
      const benchmarkImpact = null;
      const avoidedShortfallAmount = null;
      let outcomeBasis = 'Pending recorded financial outcomes; accepted applications are not earned returns.';
      let offerAcceptanceRate: number | null = null;
      let costSavedVsBaseline: number | null = null;
      if (agentType === 'LENDER_AGENT') {
        const offers = await db().financingOffer.findMany({ where: { tenantID: tenantId, shopID: shopId } }).catch(() => []);
        const applications = await db().financingApplication.findMany({ where: { tenantID: tenantId, shopID: shopId } }).catch(() => []);
        offerAcceptanceRate = offers.length ? roundCurrency((applications.length / offers.length) * 10000) / 100 : null;
      }
      if (agentType === 'BORROWER_AGENT') {
        outcomeBasis = 'Contracted repayment terms are estimates, not realized savings. A comparable original offer and repayment evidence are required.';
      }
      if (agentType === 'TREASURER_AGENT') {
        if (shop.simulationSourceShopID) {
          const actions = await db().treasuryAction.findMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: true, status: 'RECONCILED', reconciledAt: { gte: periodStart, lte: periodEnd } } });
          if (actions.length) realizedSum = sumMoney(actions.map((a: any) => a.realizedImpact ?? 0));
          outcomeBasis = 'Scripted sandbox collection outcomes, not real-world profit or proven causal benefit.';
        } else {
          const evidence = await db().treasuryActionEvidence.findMany({ where: { tenantID: tenantId, shopID: shopId, createdAt: { gte: periodStart, lte: periodEnd } } });
          if (evidence.length) realizedSum = sumMoney(evidence.map((e: any) => e.amount));
          outcomeBasis = 'Unique recorded debt payments linked to approved plans. Gross collection, not incremental profit or causal alpha.';
        }
      }
      if (agentType === 'ANALYST_AGENT') {
        outcomeBasis = '30-day before/after observations are shown per capital decision; overlapping windows are not summed or treated as causal alpha.';
      }
      const executed = decisions.filter((d: any) => d.status === 'EXECUTED' || d.status === 'RECONCILED').length;
      const guardRejects = decisions.filter((d: any) => d.guardResult === 'REJECTED_BY_GUARD').length;
      const row = {
          tenantID: tenantId, shopID: shopId, agentType: agentType as any, periodStart, periodEnd,
          decisionsCount: decisions.length, executedCount: executed, guardRejects,
          projectedImpactSum: projectedSum, realizedImpactSum: realizedSum,
          avoidedShortfallAmount, forecastMAPE: null, offerAcceptanceRate, costSavedVsBaseline,
          benchmarkImpact, alpha: null, benchmarkPolicyVersion: BENCHMARK_POLICY_VERSION, score: null,
          outcomeBasis, comparisonStatus: 'PENDING_MATCHED_COUNTERFACTUAL',
      };
      results.push(row);
    }
    return { performance: results, benchmarkPolicyVersion: BENCHMARK_POLICY_VERSION, profile: { pd, dataCompleteness: profile.dataCompleteness } };
  },

  async auditExport(tenantId: string, shopId: string) {
    const [policies, decisions, runs, evaluations] = await Promise.all([
      this.listPolicies(tenantId, shopId),
      this.listDecisions(tenantId, shopId),
      db().aiRun.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 200 }),
      matchedEvaluationService.list(tenantId,shopId),
    ]);
    const { performance } = await this.performance(tenantId, shopId);
    return {
      exportedAt: new Date().toISOString(),
      howThisWorks:
        'Deterministic engines compute financial arithmetic. Model-assisted decisions and deterministic fallbacks are labeled separately. Recorded collection evidence and sandbox outcomes are distinguished. Unknown returns, causal attribution, matched benchmark alpha and scores remain null rather than inferred from projections.',
      policies, decisions, performance, runs, evaluations,
    };
  },
};
