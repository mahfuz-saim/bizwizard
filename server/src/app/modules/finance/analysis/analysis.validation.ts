import { z } from 'zod';

const shopId = z.string().min(1, 'shopId is required');
export const analysisValidation = {
  shopQuery: z.object({ query: z.object({ shopId }) }),
  insights: z.object({ query: z.object({ shopId, verified: z.string().optional(), type: z.string().optional(), severity: z.string().optional() }) }),
  generate: z.object({ body: z.object({ shopId }) }),
  idAction: z.object({ query: z.object({ shopId }), params: z.object({ id: z.string().min(1) }), body: z.object({}).passthrough().optional() }),
  createScenario: z.object({
    body: z.object({
      shopId, name: z.string().min(1), createdBy: z.enum(['AI', 'OWNER']).optional(),
      assumptions: z.array(z.object({ key: z.string(), label: z.string(), from: z.coerce.number(), to: z.coerce.number(), unit: z.string() })).min(1),
    }),
  }),
  forecast: z.object({ query: z.object({ shopId, target: z.enum(['REVENUE', 'NET_CASH_FLOW', 'PROFIT']).optional(), horizon: z.coerce.number().int().min(7).max(90).optional() }) }),
  createCapitalDecision: z.object({
    body: z.object({
      shopId, insightID: z.string().optional(),
      decisionType: z.enum(['LIQUIDATE_STOCK', 'PUSH_PRODUCT', 'STOP_SERVING_CUSTOMER', 'RENEGOTIATE_SUPPLIER', 'PRICE_CHANGE', 'COLLECT_FAST', 'HOLD']).optional(),
      title: z.string().min(3), rationale: z.string().optional(),
      capitalReleased: z.coerce.number().optional(), projectedProfitImpact: z.coerce.number().optional(),
    }),
  }),
};
