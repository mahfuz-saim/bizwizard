import { CouponStatus, DiscountType } from '@prisma/client';
import { z } from 'zod';

const createCouponSchema = z.object({
    body: z.object({
        code: z.string(),
        description: z.string().optional(),
        discount: z.number(),
        discountType: z.nativeEnum(DiscountType),
        validFrom: z.coerce.date(),
        validUntil: z.coerce.date(),
        usageLimit: z.number(),
    }),
});

export const UpdateCouponSchema = z.object({
    description: z.string().optional(),
    validFrom: z.date().optional(),
    validUntil: z.date().optional(),
    usageLimit: z.number().optional(),
    status: z.nativeEnum(CouponStatus).optional(),
});

export const couponValidation = { createCouponSchema, UpdateCouponSchema };
