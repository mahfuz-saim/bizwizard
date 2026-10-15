import { z } from 'zod';

const createPickupValidation = z.object({
    body: z.object({
        shopID: z.string().uuid(),
        buyerID: z.string().uuid().optional(),
        items: z.array(
            z.object({
                lotID: z.string().uuid(),
                barcode: z.string().optional(),
                quantity: z.number().int().positive(),
            }),
        ),
    }),
});

export const pickupZodSchema = {
    createPickupValidation,
};
