import { z } from 'zod';

const createCheckoutValidation = z
    .object({
        body: z.object({
            shopID: z.string(),
            status: z.enum(['PAID', 'UNPAID']),
            paidAmount: z.number().optional(),
            buyerID: z.string().optional(),
            sendSMS: z.boolean().optional(),
            items: z.array(
                z.object({
                    lotId: z.string(),
                    quantity: z.number().int().positive(),
                    discountAmount: z.number(),
                    discountPercentage: z.number(),
                    discountType: z.enum(['PERCENTAGE', 'AMOUNT']),
                }),
            ),
            customItems: z
                .array(
                    z.object({
                        name: z.string(),
                        quantity: z.number().int().positive(),
                        unitPrice: z.number().positive(),
                        discountAmount: z.number(),
                        discountPercentage: z.number(),
                        discountType: z.enum(['PERCENTAGE', 'AMOUNT']),
                    }),
                )
                .optional(),
            discountAmount: z.number(),
            discountPercentage: z.number(),
            discountType: z.enum(['PERCENTAGE', 'AMOUNT']),
            isDraft: z.boolean(),
        }),
    })
    .refine(
        data => {
            if (
                data.body.status === 'UNPAID' &&
                data.body.isDraft === false &&
                !data.body.buyerID
            ) {
                return false;
            }
            return true;
        },
        {
            message: 'buyerID is required when status is UNPAID',
            path: ['body', 'buyerID'],
        },
    );

const getReciptByIdValidation = z.object({
    body: z.object({
        pin: z.number(),
    }),
});

export const checkoutZodSchema = {
    createCheckoutValidation,
    getReciptByIdValidation,
};
