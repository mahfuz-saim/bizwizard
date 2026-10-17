import { z } from 'zod';

const shopId = z.string().min(1, 'shopId is required');
export const agentsValidation = {
  shopQuery: z.object({ query: z.object({ shopId }) }),
  decisions: z.object({ query: z.object({ shopId, agentType: z.enum(['LENDER_AGENT', 'BORROWER_AGENT', 'TREASURER_AGENT', 'ANALYST_AGENT']).optional() }) }),
  updatePolicy: z.object({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      name: z.string().optional(), objective: z.string().optional(),
      riskAppetite: z.coerce.number().min(0).max(1).optional(),
      maxExposure: z.coerce.number().nullable().optional(),
      bufferTargetDays: z.coerce.number().int().nullable().optional(),
      config: z.record(z.unknown()).optional(),
    }),
  }),
};
