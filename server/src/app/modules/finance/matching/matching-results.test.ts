import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { simulationContext } from '../shared/database';
import { matchingService } from './matching.service';

test('matching results explain only the latest shop request, including legacy decisions', async () => {
  const createdAt = new Date('2026-10-20T10:00:00Z');
  const client = {
    shop: { findFirst: async (query: unknown) => {
      assert.deepEqual((query as { where: unknown }).where, { id: 'shop', tenantID: 'tenant' });
      return { id: 'shop' };
    } },
    financingMatch: { findMany: async () => [] },
    financingOffer: { findMany: async () => [] },
    financeProduct: { findMany: async () => [] },
    financingMarketState: { findMany: async () => [{ id: 'latest', createdAt }] },
    aiDecision: { findMany: async (query: unknown) => {
      assert.deepEqual(query, {
        where: { tenantID: 'tenant', shopID: 'shop', agentType: 'LENDER_AGENT', status: 'REJECTED',
          decisionType: { in: ['ISSUE_OFFER', 'DECLINE_OFFER'] }, decidedAt: { gte: createdAt } },
        select: { inputSnapshot: true, guardReason: true, decisionType: true },
      });
      return [
        { inputSnapshot: { marketID: 'latest' }, guardReason: 'rate 13.19 exceeds owner ceiling 12', decisionType: 'ISSUE_OFFER' },
        { inputSnapshot: {}, guardReason: 'rate 13.19 exceeds owner ceiling 12; advance rate 1 exceeds policy cap 0.85', decisionType: 'ISSUE_OFFER' },
        { inputSnapshot: { marketID: 'other' }, guardReason: 'rate 99 exceeds owner ceiling 1', decisionType: 'ISSUE_OFFER' },
        { inputSnapshot: { marketID: 'latest' }, guardReason: null, decisionType: 'DECLINE_OFFER' },
      ];
    } },
  };
  const result = await simulationContext.run({ client: client as unknown as Prisma.TransactionClient, asOf: createdAt },
    () => matchingService.getResults('tenant', 'shop'));
  assert.deepEqual(result.offerBlockers, [
    "The lender's rate is 13.19%, above your 12% maximum.",
    "The lender's advance rate is 100%, above the allowed 85%.",
    'The lender declined based on risk or affordability.',
  ]);
});

test('a shop with no financing requests has no offer blockers', async () => {
  const client = {
    shop: { findFirst: async () => ({ id: 'shop' }) },
    financingMatch: { findMany: async () => [] },
    financingOffer: { findMany: async () => [] },
    financingMarketState: { findMany: async () => [] },
    financeProduct: { findMany: async () => [] },
    aiDecision: { findMany: async () => { throw new Error('No request to explain'); } },
  };
  const result = await simulationContext.run({ client: client as unknown as Prisma.TransactionClient, asOf: new Date() },
    () => matchingService.getResults('tenant', 'shop'));
  assert.deepEqual(result.offerBlockers, []);
});
