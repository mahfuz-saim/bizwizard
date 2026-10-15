import { z } from 'zod';

// Either activeShopId (owner/employee claim) or salesRepId (SR claim) is required,
// and they are mutually exclusive. The route-level controller enforces the role split.
const referralClaimSchema = z
    .object({
        body: z.object({
            rewardId: z.string(),
            rewardType: z.enum(['CREDITS', 'SUBSCRIPTION_EXTENSION']),
            userType: z.enum(['referrer', 'referred']),
            activeShopId: z.string().optional(),
            salesRepId: z.string().optional(),
        }),
    })
    .refine(
        data => {
            const hasShop = !!data.body.activeShopId;
            const hasSr = !!data.body.salesRepId;
            // exactly one must be set
            return hasShop !== hasSr;
        },
        {
            message: 'Exactly one of activeShopId or salesRepId is required',
            path: ['body'],
        },
    );

export const referralValidation = { referralClaimSchema };
