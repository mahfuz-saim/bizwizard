import { ShopCategory } from '@prisma/client';
import { z } from 'zod';

const createShopZodSchema = z.object({
    body: z.object({
        shopName: z.string(),
        contact: z.string(),
        tradeLicense: z.string().optional(),
        category: z.nativeEnum(ShopCategory),
        address: z.object({
            street: z.string(),
            upazila: z.string(),
            district: z.string(),
        }),
    }),
});

const updateShopZodSchema = z.object({
    body: z.object({
        shopName: z.string().optional(),
        contact: z.string().optional(),
        tradeLicense: z.string().optional(),
        category: z.nativeEnum(ShopCategory).optional(),
    }).strict(),
});

const employeeRequestUpdate = z.object({
    body: z.object({
        shopId: z.string(),
        employeeId: z.string(),
        status: z.enum(['ACCEPTED', 'REJECTED']),
    }),
});

const configSchema = z.object({
    body: z.object({
        shopId: z.string(),
        defaultExpirationThreshold: z.number().int().optional(),
        defaultNotSoldThreshold: z.number().int().optional(),
        defaultLowStockThreshold: z.number().int().optional(),
    }),
});

export const shopValidation = {
    createShopZodSchema,
    updateShopZodSchema,
    employeeRequestUpdate,
    configSchema,
};
