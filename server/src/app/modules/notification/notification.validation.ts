import { z } from 'zod';

const deviceRegisterSchema = z.object({
    body: z.object({
        token: z.string(),
        shopId: z.string().optional(),
    }),
});

const notificationValidationSchema = z.object({
    body: z.object({
        title: z.string(),
        body: z.string(),
        image: z.string().optional(),
        userIds: z.array(z.string()).optional(),
        shopIds: z.array(z.string()).optional(),
        data: z.object({}).passthrough().optional(),
    }),
});

export const notificationZodSchema = {
    deviceRegisterSchema,
    notificationValidationSchema,
};
