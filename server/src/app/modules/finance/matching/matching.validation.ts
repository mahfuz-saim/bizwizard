import { z } from 'zod';

const shopId = z.string().min(1, 'shopId is required');
export const matchingValidation = {
  profile: z.object({ query: z.object({ shopId, days: z.coerce.number().int().min(7).max(365).optional() }) }),
  results: z.object({ query: z.object({ shopId }) }),
  createMarket: z.object({
    body: z.object({
      shopId,
      requestedAmount: z.coerce.number().positive(),
      purpose: z.enum(['WORKING_CAPITAL', 'INVENTORY', 'EXPANSION', 'EQUIPMENT', 'DEBT_CONSOLIDATION', 'EMERGENCY']).optional(),
      preferredTenorMonths: z.coerce.number().int().min(1).max(60).optional(),
      maxRate: z.coerce.number().min(0).max(100).optional(),
      maxCollateral: z.coerce.number().min(0).optional(),
    }),
  }),
  run: z.object({
    body: z.object({
      shopId,
      marketID: z.string().optional(),
      requestedAmount: z.coerce.number().positive(),
      purpose: z.enum(['WORKING_CAPITAL', 'INVENTORY', 'EXPANSION', 'EQUIPMENT', 'DEBT_CONSOLIDATION', 'EMERGENCY']).optional(),
      preferredTenorMonths: z.coerce.number().int().min(1).max(60).optional(),
      tenorMonths: z.coerce.number().int().min(1).max(60).optional(),
      maxRate: z.coerce.number().min(0).max(100).optional(),
      hasGSTIN: z.boolean().optional(),
      hasBankStatements: z.boolean().optional(),
    }),
  }),
  offerAction: z.object({ query: z.object({ shopId }), params: z.object({ id: z.string().min(1) }) }),
  accept: z.object({
    query: z.object({ shopId }),
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ submittedDocs: z.array(z.string()).optional() }).optional(),
  }),
  applications: z.object({ query: z.object({ shopId }) }),
};
