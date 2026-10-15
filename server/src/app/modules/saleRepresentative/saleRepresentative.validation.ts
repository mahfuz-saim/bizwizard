import { z } from 'zod';

const updateSalesRepresentative = z.object({
    body: z.object({
        name: z.string().optional(),
        ReferralCode: z
            .string()
            .min(6)
            .max(8)
            .optional()
            .refine(
                value => {
                    if (!value) return true; // optional
                    return /^[A-Z0-9]+$/.test(value); // Alphanumeric uppercase
                },
                {
                    message:
                        'Referral code must be 6-8 alphanumeric characters in uppercase',
                },
            ),
    }),
});

const getByReferralCode = z.object({
    params: z.object({
        referralCode: z.string().min(6).max(8),
    }),
});

export const salesRepresentativeValidation = {
    updateSalesRepresentative,
    getByReferralCode,
};
