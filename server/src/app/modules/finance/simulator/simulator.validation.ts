import { z } from 'zod';

const shopId = z.string().min(1, 'shopId is required');
const template = z.enum(['LESS', 'MORE']).optional();

export const simulatorValidation = {
  shopBody: z.object({ body: z.object({ shopId }) }),
  fastForward: z.object({ body: z.object({ shopId, template }) }),
  shopQuery: z.object({ query: z.object({ shopId }) }),
  inspect: z.object({
    query: z.object({
      shopId,
      type: z.enum(['CHECKOUT', 'EXPENSE_ITEM', 'DEBT_PAYMENT', 'CASH_TRANSACTION']),
      id: z.string().min(1, 'id is required'),
    }),
  }),
};
