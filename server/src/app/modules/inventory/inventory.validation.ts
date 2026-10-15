import { ProductCategory } from '@prisma/client';
import { z } from 'zod';

const createProductZodSchema = z.object({
    body: z.object({
        productName: z.string(),
        barcode: z.string(),
        measuringUnit: z.string(),
        category: z.nativeEnum(ProductCategory),
        genericName: z.string().optional(),
        image: z.string().optional(),
    }),
});
const updateProductZodSchema = z.object({
    body: z.object({
        productName: z.string().optional(),
        barcode: z.string().optional(),
        measuringUnit: z.string().optional(),
        genericName: z.string().optional(),
        image: z.string().optional(),
    }),
});

export const inventoryZodSchema = {
    createProductZodSchema,
    updateProductZodSchema,
};
