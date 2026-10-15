import { z } from 'zod';

const tagCreateSchema = z.object({
    body: z.object({
        name: z.string(),
        shopId: z.string(),
        description: z.string().optional(),
    }),
});
const tagUpdateSchema = z.object({
    body: z.object({
        tagId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
    }),
});

const tagAssignBuyerSchema = z.object({
    body: z.object({
        tagId: z.string(),
        customerId: z.array(z.string()),
    }),
});

export const tagZodSchema = {
    tagCreateSchema,
    tagUpdateSchema,
    tagAssignBuyerSchema,
};
