import { z } from 'zod';

const createSubscriptionZodSchema = z.object({
    body: z.object({
        name: z.string(),
        price: z.number(),
        months: z.number().int(),
        features: z.record(z.unknown()).optional(),
        discount: z.number().optional(),
    }),
});

const createEmployeeZodSchema = z.object({
    body: z.object({
        name: z.string(),
        pricePerEmployee: z.number(),
        discount: z.number().optional(),
    }),
});

const deletePlanZodSchema = z.object({
    body: z.object({
        id: z.string(),
        type: z.enum(['subscription', 'employee']),
    }),
});

export const subscriptionValidation = {
    createSubscriptionZodSchema,
    createEmployeeZodSchema,
    deletePlanZodSchema,
};
