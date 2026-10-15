import { z } from 'zod';

const updateBuyer = z.object({
    body: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
    }),
});
const addBuyer = z.object({
    body: z.object({
        number: z.string(),
        name: z.string(),
        address: z.string(),
        shopID: z.string(),
    }),
});

const updateShopBuyer = z.object({
    body: z.object({
        name: z.string(),
        address: z.string(),
        shopID: z.string(),
        buyerID: z.string(),
    }),
});

export const buyerZodSchema = { updateBuyer, addBuyer, updateShopBuyer };
