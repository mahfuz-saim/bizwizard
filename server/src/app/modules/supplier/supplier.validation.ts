import { z } from 'zod';

const suppllierShopAddSchema = z.object({
    body: z.object({
        shopId: z.string(),
        name: z.string(),
        number: z.string(),
        comment: z.string().optional(),
        company: z.string().optional(),
    }),
});
const updateSupplierSchema = z.object({
    body: z.object({
        supplierId: z.string(),
        shopId: z.string(),
        supplierName: z.string(),
        comment: z.string().optional(),
        company: z.string().optional(),
    }),
});

export const supplierValidation = {
    suppllierShopAddSchema,
    updateSupplierSchema,
};
