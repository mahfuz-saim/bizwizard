import { LossType, LotDeletionReason, ProductCategory } from '@prisma/client';
import { z } from 'zod';

const createProductValidation = z.object({
    body: z.object({
        productID: z.string().optional(),
        variantId: z.string().optional(),
        name: z.string().optional(),
        category: z.nativeEnum(ProductCategory),
        variantName: z.string().optional(),
        variantCode: z.string().optional(),
        packOf: z.number().int().optional(),
        shopID: z.string(),
        lowStock: z.number().int().optional(),
        lastSoldDate: z.coerce.date().optional(),
        notifyAfterNotSold: z.number().int().optional(),
        notifyBeforeExp: z.number().int().optional(),
        barcode: z.string().optional(),
        measuringUnit: z.string().optional(),
        supplierId: z.string().nullable().optional(),
        genericName: z.string().optional(),
        lot: z.object({
            stock: z.number(),
            mrp: z.number(),
            isMRPDefault: z.boolean(),
            retail: z.number(),
            includeVAT: z.boolean(),
            buyPrice: z.number(),
            sellPrice: z.number(),
            vat: z.number().optional(),
            mfgDate: z.coerce.date().optional(),
            expDate: z.coerce.date().optional(),
            locationAtStore: z.string().optional(),
            note: z.string().optional(),
        }),
    }),
});

const lotUpdateValidation = z.object({
    body: z.object({
        mrp: z.number().optional(),
        isMRPDefault: z.boolean().optional(),
        retail: z.number().optional(),
        includeVAT: z.boolean().optional(),
        sellPrice: z.number().optional(),
        vat: z.number().optional(),
        mfgDate: z.coerce.date().optional(),
        expDate: z.coerce.date().optional(),
        locationAtStore: z.string().optional(),
        note: z.string().optional(),
    }),
});

const updateProductValidation = z.object({
    body: z.object({
        name: z.string().optional(),
        variantName: z.string().optional(),
        variantCode: z.string().optional(),
        packOf: z.number().int().optional(),
        lowStock: z.number().int().optional(),
        lastSoldDate: z.coerce.date().optional(),
        notifyAfterNotSold: z.number().int().optional(),
    }),
});

const lotDeletionValidation = z.object({
    body: z.object({
        lotId: z.string(),
        stock: z.number().positive(),
        reason: z.nativeEnum(LotDeletionReason),
        lossType: z.nativeEnum(LossType),
        lossAmount: z.number().min(0),
        note: z.string().optional(),
    }),
});

const createCatalogValidation = z.object({
    body: z.object({
        shopID: z.string(),
        productID: z.string().optional(),
        name: z.string().min(1),
        category: z.nativeEnum(ProductCategory),
        measuringUnit: z.string().min(1),
        barcode: z.string().optional(),
        genericName: z.string().optional(),
        variants: z
            .array(
                z.object({
                    variantName: z.string().min(1, 'Variant name is required'),
                    variantCode: z.string().optional(),
                    packOf: z.number().int().min(1).optional(),
                    lowStock: z.number().int().min(0).optional(),
                                notifyAfterNotSold: z.number().int().min(0).optional(),
                    notifyBeforeExp: z.number().int().min(0).optional(),
                            }),
            )
            .min(1, 'At least one variant is required'),
    }),
});

export const productZodSchema = {
    createProductValidation,
    lotUpdateValidation,
    updateProductValidation,
    lotDeletionValidation,
    createCatalogValidation,
};
