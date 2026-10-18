import { z } from 'zod';

const shopId = z.string().min(1, 'shopId is required');
const categories = z.enum(['SALES_COLLECTION', 'INVOICE_PAYMENT', 'PRODUCT_PURCHASE', 'OPERATING_EXPENSE', 'SALARY', 'RENT', 'UTILITY', 'TAX', 'LOAN_REPAYMENT', 'LOAN_DISBURSEMENT', 'FINANCING_FEE', 'OWNER_DRAWING', 'TRANSFER', 'OTHER']);
export const cashflowValidation = {
  settleCommitment: z.object({ query: z.object({ shopId }), body: z.object({ expenseItemID: z.string().min(1) }).strict() }),
  collectionEvidence: z.object({ query: z.object({ shopId }), body: z.object({ paymentID: z.string().min(1) }).strict() }),
  alertRecommendation: z.object({ query: z.object({ shopId }), body: z.object({ actionIndex: z.number().int().min(0) }).strict() }),
  alertStatus: z.object({ query: z.object({ shopId }), body: z.object({ action: z.enum(['ack', 'dismiss', 'resolve']) }).strict() }),
  shopQuery: z.object({ query: z.object({ shopId }) }),
  createAccount: z.object({ body: z.object({ shopId, name: z.string().min(1), accountType: z.enum(['CASH', 'BANK', 'EWALLET', 'CARD', 'CREDIT_LINE']).optional(), currency: z.string().optional(), openingBalance: z.coerce.number().optional(), isPrimary: z.boolean().optional() }) }),
  listTransactions: z.object({ query: z.object({ shopId, from: z.string().optional(), to: z.string().optional(), page: z.coerce.number().optional(), limit: z.coerce.number().optional() }) }),
  createTransaction: z.object({ body: z.object({ shopId, accountID: z.string().optional(), direction: z.enum(['IN', 'OUT']), amount: z.coerce.number(), category: categories.optional(), occurredAt: z.string().optional(), description: z.string().optional() }) }),
  idAction: z.object({ query: z.object({ shopId }), params: z.object({ id: z.string().min(1) }), body: z.object({}).passthrough().optional() }),
  backfill: z.object({ body: z.object({ shopId }) }),
  projection: z.object({ query: z.object({ shopId, horizon: z.coerce.number().int().min(7).max(180).optional() }) }),
  createCommitment: z.object({ body: z.object({ shopId, name: z.string().min(1), amount: z.coerce.number().positive().finite(), dueDate: z.string().datetime({ offset: true }).or(z.string().date()), category: categories.optional(), supplierPayable: z.boolean().optional(), recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(), confidence: z.coerce.number().min(0).max(1).optional(), note: z.string().optional() }) }),
  extractCommitment: z.object({ body: z.object({ shopId, text: z.string().min(3) }) }),
};
