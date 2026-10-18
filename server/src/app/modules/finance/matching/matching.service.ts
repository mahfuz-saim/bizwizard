/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma, { shopClock } from '../shared/database';
import type { z } from 'zod';
import { callStructured, hashInput } from '../../../../lib/ai/client';
import * as prompts from '../../../../lib/ai/prompts';
import { roundCurrency, amortizationSchedule, effectiveApr, totalRepaymentOf } from '../shared/money';
import { mapWithConcurrency, withTimeout } from '../shared/concurrency';
import { buildProfile, INSUFFICIENT_DATA_THRESHOLD } from '../shared/metricEngine';
import { loadProfileAggregates, assertShop } from '../shared/shopData';
import { evaluateEligibility, deterministicScore, type ProductLike } from '../shared/eligibility';
import { guardOffer, clampAiScore, blendScore } from '../shared/guard';
import { ensureCatalog, ensureDefaultPolicies } from '../shared/catalog';
import { priceOfferCore, runNegotiation } from '../agents/agentCore';

const db = () => prisma as any;

async function persistProfile(tenantId: string, shopId: string, days: number) {
  const aggregates = await loadProfileAggregates(tenantId, shopId, days);
  const profile = buildProfile(aggregates);
  const dayKey = new Date(profile.periodEnd);
  dayKey.setUTCHours(0, 0, 0, 0);
  const row = await db().businessFinancialProfile.upsert({
    where: { shopID_periodEnd: { shopID: shopId, periodEnd: dayKey } },
    update: { ...profileFields(profile), computedAt: new Date() },
    create: { tenantID: tenantId, shopID: shopId, ...profileFields(profile), periodEnd: dayKey },
  }).catch(async () => {
    // Unique key name may differ pre-migration; fall back to create.
    return db().businessFinancialProfile.create({
      data: { tenantID: tenantId, shopID: shopId, ...profileFields(profile), periodEnd: dayKey },
    });
  });
  return { profile, profileID: row.id as string };
}
function profileFields(p: ReturnType<typeof buildProfile>) {
  const { monthlyRevenue: _mr, monthlyFreeCashFlow: _mf, periodStart, periodEnd, ...rest } = p;
  return { ...rest, periodStart, periodEnd };
}

export const matchingService = {
  async getProfile(tenantId: string, shopId: string, days = 90) {
    await assertShop(tenantId, shopId);
    const { profile } = await persistProfile(tenantId, shopId, days);
    return {
      ...profile,
      periodStart: profile.periodStart.toISOString(),
      periodEnd: profile.periodEnd.toISOString(),
      sufficientData: profile.dataCompleteness >= INSUFFICIENT_DATA_THRESHOLD,
    };
  },

  async listProviders(tenantId: string) {
    void tenantId;
    await ensureCatalog(db());
    await ensureDefaultPolicies(db());
    const providers = await db().financeProvider.findMany({
      where: { isActive: true },
      include: { products: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
    return { providers, simulatedMarket: true, notice: 'Simulated market for evaluation — no real lender is contacted.' };
  },

  async createMarket(tenantId: string, shopId: string, body: any) {
    await assertShop(tenantId, shopId);
    return db().financingMarketState.create({
      data: {
        tenantID: tenantId,
        shopID: shopId,
        requestedAmount: roundCurrency(body.requestedAmount),
        purpose: body.purpose ?? 'WORKING_CAPITAL',
        preferredTenorMonths: body.preferredTenorMonths ?? null,
        maxRate: body.maxRate ?? null,
        maxCollateral: body.maxCollateral ?? null,
        status: 'OPEN',
      },
    });
  },

  async runMatching(tenantId: string, shopId: string, body: any) {
    const shop = await assertShop(tenantId, shopId);
    await ensureCatalog(db());
    await ensureDefaultPolicies(db());
    const requestedAmount = roundCurrency(body.requestedAmount);
    const tenorMonths = Number(body.preferredTenorMonths ?? body.tenorMonths ?? 6);
    const { profile, profileID } = await persistProfile(tenantId, shopId, 90);
    if (profile.dataCompleteness < INSUFFICIENT_DATA_THRESHOLD) {
      return {
        insufficientData: true,
        message: `Only ${(profile.dataCompleteness * 100).toFixed(0)}% of the last 90 days have sales data. Matching needs at least 60% before it will guess.`,
        profile,
        matches: [],
        offers: [],
      };
    }
    const market = body.marketID
      ? await db().financingMarketState.findFirst({ where: { id: body.marketID, tenantID: tenantId, shopID: shopId } })
      : await this.createMarket(tenantId, shopId, { ...body, preferredTenorMonths: tenorMonths });
    const products = await db().financeProduct.findMany({
      where: { isActive: true },
      include: { provider: true },
    });
    const req = {
      requestedAmount,
      tenorMonths,
      shopCategory: (shop as any).category as string,
      hasGSTIN: Boolean(body.hasGSTIN),
      hasBankStatements: body.hasBankStatements !== false,
    };
    const evaluated = products.map((p: any) => {
      const eligibility = evaluateEligibility(p as ProductLike, profile, req);
      const scored = deterministicScore(p as ProductLike, profile, req);
      return { product: p, ...eligibility, ...scored };
    });
    const eligible = evaluated.filter((e: any) => e.status === 'ELIGIBLE');
    // AI re-rank sees ONLY the eligible set (§1.2 rule 2); offline fallback keeps deterministic scores.
    const rerank = await callStructured<z.infer<typeof prompts.rankFinancingProducts.outputSchema>>({
      agentType: 'BORROWER_AGENT',
      purpose: 'rank_financing_products',
      promptVersion: prompts.rankFinancingProducts.version,
      tier: 'reasoning',
      pillar: 'matching',
      system: prompts.rankFinancingProducts.system,
      tenantID: tenantId,
      shopID: shopId,
      input: {
        profile: { grossMargin: profile.grossMargin, dso: profile.dso, debtToRevenue: profile.debtToRevenue, monthlyRevenue: profile.monthlyRevenue, dataCompleteness: profile.dataCompleteness },
        products: eligible.map((e: any) => ({ productId: e.product.id, deterministicScore: e.deterministicScore, subScores: e.subScores, estimatedApr: e.estimatedCost })),
      },
      outputSchema: prompts.rankFinancingProducts.outputSchema,
      fallback: () => ({
        results: eligible.map((e: any) => ({
          productId: e.product.id as string,
          aiScore: e.deterministicScore as number,
          rationale: `Fits on numbers: deterministic score ${e.deterministicScore}/100 with estimated APR ${e.estimatedCost}% against a gross margin of ${profile.grossMargin}% and DSO of ${profile.dso} days.`,
          tradeoffs: [
            `Estimated APR ${e.estimatedCost}% vs gross margin ${profile.grossMargin}%`,
            e.product.collateralRequired ? 'Requires collateral' : 'No collateral required',
          ],
        })),
      }),
    });
    const aiById = new Map(rerank.data.results.map((r) => [r.productId, r]));
    const matches = [] as any[];
    for (const e of evaluated) {
      const ai = aiById.get(e.product.id);
      const aiScore = ai ? clampAiScore(e.deterministicScore, ai.aiScore) : null;
      const row = await db().financingMatch.create({
        data: {
          tenantID: tenantId,
          shopID: shopId,
          profileID,
          financeProductID: e.product.id,
          eligibilityStatus: e.status,
          failedRules: e.failedRules,
          deterministicScore: e.deterministicScore,
          aiScore,
          finalScore: blendScore(e.deterministicScore, aiScore),
          aiRationale: ai?.rationale ?? (e.status === 'ELIGIBLE' ? 'Eligible on the rule gate.' : `Not eligible: ${e.failedRules.join(', ')}.`),
          aiTradeoffs: ai?.tradeoffs ?? [],
          aiConfidence: ai ? 0.75 : 0.5,
          aiModel: rerank.model,
          promptVersion: prompts.rankFinancingProducts.version,
          estimatedCost: e.estimatedCost,
          maxAffordableAmount: e.maxAffordableAmount,
        },
      });
      matches.push({ ...row, product: e.product, subScores: e.subScores });
    }
    // Lender pricing: concurrent, bounded, per-call sub-budget (§4.3 step 5.5).
    const top = [...matches]
      .filter((m: any) => m.eligibilityStatus === 'ELIGIBLE')
      .sort((a: any, b: any) => b.finalScore - a.finalScore)
      .slice(0, 5);
    const priced = await mapWithConcurrency(top, 4, async (m: any) => {
      return withTimeout(
        (async () => {
          const pricedOffer = priceOfferCore({
            product: m.product,
            profile,
            requestedAmount,
            tenorMonths,
            providerBaseRate: m.product.provider?.baseRate ?? m.product.interestRateMin,
            providerRiskAppetite: m.product.provider?.riskAppetite ?? 0.5,
            maxAffordableAmount: m.maxAffordableAmount,
          });
          const verdict = guardOffer({
            offeredAmount: pricedOffer.offeredAmount,
            offeredRate: pricedOffer.offeredRate,
            tenorMonths: pricedOffer.tenorMonths,
            advanceRate: pricedOffer.advanceRate,
            maxAffordableAmount: m.maxAffordableAmount,
            ownerMaxRate: market?.maxRate ?? null,
            productMinTenor: m.product.minTenorMonths,
            productMaxTenor: m.product.maxTenorMonths,
            productRateMax: m.product.interestRateMax,
          });
          await db().aiDecision.create({
            data: {
              tenantID: tenantId,
              shopID: shopId,
              agentType: 'LENDER_AGENT',
              decisionType: pricedOffer.decline ? 'DECLINE_OFFER' : 'ISSUE_OFFER',
              action: pricedOffer.decline ? `Declined ${m.product.name}` : `Offer on ${m.product.name} at ${pricedOffer.offeredRate}%`,
              rationale: pricedOffer.rationale,
              confidence: pricedOffer.confidence,
              model: 'deterministic-core',
              promptVersion: prompts.priceOffer.version,
              inputHash: hashInput({ product: m.product.id, profileID }),
              inputSnapshot: { profileID, pd: pricedOffer.pd, lgd: pricedOffer.lgd },
              output: JSON.parse(JSON.stringify(pricedOffer)),
              projectedImpact: roundCurrency(pricedOffer.offeredAmount * (pricedOffer.offeredRate / 100) * (pricedOffer.tenorMonths / 12)),
              guardResult: verdict.passed ? 'PASSED' : 'REJECTED_BY_GUARD',
              guardReason: verdict.reasons.join('; ') || null,
              status: verdict.passed && !pricedOffer.decline ? 'PROPOSED' : 'REJECTED',
            },
          }).catch(() => undefined);
          if (pricedOffer.decline || !verdict.passed) return null;
          return db().financingOffer.create({
            data: {
              tenantID: tenantId,
              shopID: shopId,
              financeProductID: m.product.id,
              providerID: m.product.providerID,
              offeredAmount: pricedOffer.offeredAmount,
              offeredRate: pricedOffer.offeredRate,
              tenorMonths: pricedOffer.tenorMonths,
              advanceRate: pricedOffer.advanceRate,
              effectiveApr: pricedOffer.effectiveApr,
              totalRepayment: pricedOffer.totalRepayment,
              collateralRequired: m.product.collateralRequired,
              collateralTypes: m.product.collateralTypes,
              conditions: pricedOffer.conditions,
              rationale: pricedOffer.rationale,
              issuedBy: 'AI_AGENT',
              status: 'ISSUED',
              confidence: pricedOffer.confidence,
              aiModel: 'deterministic-core',
              promptVersion: prompts.priceOffer.version,
              expiresAt: new Date((await shopClock(tenantId, shopId)).getTime() + 7 * 86400000),
            },
          });
        })(),
        8000,
        'lender pricing',
      );
    });
    const offers = priced
      .filter((r): r is { status: 'fulfilled'; value: any } => r.status === 'fulfilled' && !!r.value)
      .map((r) => r.value);
    if (market?.id)
      await db().financingMarketState.update({ where: { id: market.id }, data: { status: offers.length ? 'MATCHED' : 'OPEN' } }).catch(() => undefined);
    return { insufficientData: false, profile, market, matches, offers, aiModel: rerank.model };
  },

  async getResults(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const [matches, offers, markets] = await Promise.all([
      db().financingMatch.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 24 }),
      db().financingOffer.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      db().financingMarketState.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    const products = await db().financeProduct.findMany({ include: { provider: true } });
    const byId = new Map(products.map((p: any) => [p.id, p]));
    return {
      matches: matches.map((m: any) => ({ ...m, product: byId.get(m.financeProductID) ?? null })),
      offers,
      markets,
      simulatedMarket: true,
    };
  },

  async negotiate(tenantId: string, shopId: string, offerID: string) {
    const offer = await db().financingOffer.findFirst({ where: { id: offerID, tenantID: tenantId, shopID: shopId } });
    if (!offer) throw Object.assign(new Error('Offer not found'), { statusCode: 404 });
    const product = await db().financeProduct.findUnique({ where: { id: offer.financeProductID }, include: { provider: true } });
    const { profile } = await persistProfile(tenantId, shopId, 90);
    const existing = await db().financingNegotiation.findMany({ where: { offerID }, orderBy: { round: 'asc' } });
    const result = runNegotiation({
      offeredAmount: offer.offeredAmount,
      offeredRate: offer.offeredRate,
      tenorMonths: offer.tenorMonths,
      processingFeePct: product?.processingFeePct ?? 0,
      monthlyFreeCashFlow: profile.monthlyFreeCashFlow,
      grossMarginPct: profile.grossMargin,
      ownerMaxRate: null,
      productRateMin: product?.interestRateMin ?? 1,
      riskAppetite: product?.provider?.riskAppetite ?? 0.5,
    });
    const baseRound = existing.length ? Math.max(...existing.map((e: any) => e.round)) : 0;
    const rows = [] as any[];
    for (const step of result.steps) {
      rows.push(await db().financingNegotiation.create({
        data: {
          tenantID: tenantId,
          shopID: shopId,
          offerID,
          round: Math.min(3, baseRound + step.round),
          fromParty: step.fromParty,
          toParty: step.fromParty === 'LENDER_AGENT' ? 'BORROWER_AGENT' : 'LENDER_AGENT',
          proposedAmount: offer.offeredAmount,
          proposedRate: step.proposedRate,
          proposedTenorMonths: step.proposedTenorMonths,
          message: step.message,
          reasoning: step.reasoning,
          accepted: step.decision === 'ACCEPT',
        },
      }));
    }
    const fee = product?.processingFeePct ?? 0;
    const updated = await db().financingOffer.update({
      where: { id: offerID },
      data: {
        offeredRate: result.finalRate,
        tenorMonths: result.finalTenor,
        effectiveApr: effectiveApr(offer.offeredAmount, result.finalRate, result.finalTenor, fee),
        totalRepayment: totalRepaymentOf(offer.offeredAmount, result.finalRate, result.finalTenor, fee),
        status: result.outcome === 'REJECTED' ? 'REJECTED' : 'COUNTERED',
      },
    });
    await db().aiDecision.create({
      data: {
        tenantID: tenantId, shopID: shopId, agentType: 'BORROWER_AGENT', decisionType: 'NEGOTIATE_OFFER',
        action: `Negotiated ${product?.name ?? 'offer'} to ${result.finalRate}%`,
        rationale: result.steps.map((s) => s.reasoning).join(' '),
        confidence: 0.8, model: 'deterministic-core', promptVersion: prompts.evaluateOffer.version,
        inputHash: hashInput({ offerID, rate: offer.offeredRate }),
        inputSnapshot: { offerID }, output: JSON.parse(JSON.stringify(result)),
        projectedImpact: roundCurrency(offer.totalRepayment - updated.totalRepayment),
        guardResult: 'PASSED', status: result.outcome === 'REJECTED' ? 'REJECTED' : 'EXECUTED',
      },
    }).catch(() => undefined);
    return { offer: updated, negotiation: [...existing, ...rows], outcome: result.outcome };
  },

  async acceptOffer(tenantId: string, shopId: string, offerID: string, body: any) {
    const offer = await db().financingOffer.findFirst({ where: { id: offerID, tenantID: tenantId, shopID: shopId } });
    if (!offer) throw Object.assign(new Error('Offer not found'), { statusCode: 404 });
    const schedule = amortizationSchedule(offer.offeredAmount, offer.offeredRate, offer.tenorMonths);
    const application = await db().financingApplication.create({
      data: {
        tenantID: tenantId, shopID: shopId, financeProductID: offer.financeProductID, offerID,
        requestedAmount: offer.offeredAmount, requestedTenorMonths: offer.tenorMonths,
        status: 'SUBMITTED', submittedDocs: body?.submittedDocs ?? offer.conditions ?? [],
        ownerApproved: true, disbursedAt: await shopClock(tenantId, shopId),
        firstRepaymentAt: new Date((await shopClock(tenantId, shopId)).getTime() + 30 * 86400000),
      },
    });
    const now = await shopClock(tenantId, shopId);
    await db().loanSchedule.createMany({
      data: schedule.map((s) => ({
        tenantID: tenantId, shopID: shopId, applicationID: application.id,
        installmentNo: s.installmentNo,
        dueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + s.installmentNo, now.getUTCDate())),
        principalDue: s.principalDue, interestDue: s.interestDue, totalDue: s.totalDue,
        status: 'DUE',
      })),
    });
    const updatedOffer = await db().financingOffer.update({ where: { id: offerID }, data: { status: 'ACCEPTED' } });
    return { application, offer: updatedOffer, schedule };
  },

  async rejectOffer(tenantId: string, shopId: string, offerID: string) {
    const offer = await db().financingOffer.findFirst({ where: { id: offerID, tenantID: tenantId, shopID: shopId } });
    if (!offer) throw Object.assign(new Error('Offer not found'), { statusCode: 404 });
    return db().financingOffer.update({ where: { id: offerID }, data: { status: 'REJECTED' } });
  },

  async listApplications(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const applications = await db().financingApplication.findMany({
      where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' },
    });
    const schedules = applications.length
      ? await db().loanSchedule.findMany({ where: { applicationID: { in: applications.map((a: any) => a.id) } }, orderBy: { installmentNo: 'asc' } })
      : [];
    return applications.map((a: any) => ({ ...a, schedule: schedules.filter((s: any) => s.applicationID === a.id) }));
  },
};
