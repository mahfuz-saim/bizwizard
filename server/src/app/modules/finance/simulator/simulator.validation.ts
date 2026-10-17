import { z } from 'zod';

const shopId = z.string().min(1, 'shopId is required');

export const simulatorValidation = {
  shopBody: z.object({ body: z.object({ shopId }) }),
  shopQuery: z.object({ query: z.object({ shopId }) }),
  inspect: z.object({
    query: z.object({
      shopId,
      type: z.enum(['CHECKOUT', 'EXPENSE_ITEM', 'DEBT_PAYMENT', 'CASH_TRANSACTION']),
      id: z.string().min(1, 'id is required'),
    }),
  }),
};
