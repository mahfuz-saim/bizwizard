import { z } from 'zod';

const fullPaymentSchema = z.object({
    type: z.literal('FULL'),
    debtId: z.string(),
    amount: z.number().optional(), // optional or can validate fixed value
});

const partialPaymentSchema = z.object({
    type: z.literal('PARTIAL'),
    debtId: z.string(),
    amount: z.number().positive(), // required and must be positive
});

const singleDebtResolveSchema = z.object({
    body: z.discriminatedUnion('type', [
        fullPaymentSchema,
        partialPaymentSchema,
    ]),
});

const bulkDebtResolveSchema = z.object({
    body: z.object({
        amount: z.number(),
        buyerId: z.string(),
        shopId: z.string(),
        }),
});

const getUserDebtZodSchema = z.object({
    body: z.object({
        buyerId: z.string(),
        shopId: z.string(),
    }),
});

const addPreviousDebtZodSchema = z.object({
    body: z.object({
        buyerId: z.string(),
        shopId: z.string(),
        amount: z.number().positive(),
        paidAmount: z.number().positive(),
    }),
});

export const debtValidation = {
    singleDebtResolveSchema,
    bulkDebtResolveSchema,
    getUserDebtZodSchema,
    addPreviousDebtZodSchema,
};
