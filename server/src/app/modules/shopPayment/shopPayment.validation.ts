import { PaymentType } from '@prisma/client';
import { z } from 'zod';

const paymentSchema = z.object({
    body: z
        .object({
            total_amount: z.number().nonnegative(),
            success_url: z.string().url(),
            fail_url: z.string().url(),
            cancel_url: z.string().url(),
            paymentType: z.nativeEnum(PaymentType),
            planId: z.string().optional(),
            employeeCount: z.number().int().optional(),
            shopId: z.string(),
            coupon: z.string().optional(),
        })
        .superRefine((data, ctx) => {
            if (
                data.paymentType !== PaymentType.CREDIT &&
                data.paymentType !== PaymentType.RENEW_PLAN &&
                !data.planId
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        'planId is required when paymentType is not CREDIT',
                    path: ['body', 'planId'],
                });
            }

            if (
                data.paymentType === PaymentType.EMPLOYEE &&
                !data.employeeCount
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        'employeeCount is required when paymentType is EMPLOYEE',
                    path: ['body', 'employeeCount'],
                });
            }
        }),
});

export const paymentValidationSchema = { paymentSchema };
