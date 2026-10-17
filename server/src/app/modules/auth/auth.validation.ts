import { z } from 'zod';

const loginZodSchema = z.object({
    body: z
        .object({
            number: z.string().optional(),
            email: z.string().email('Invalid email').optional(),
            password: z.string({
                required_error: 'Password is required',
            }),
        })
        .refine((data) => data.number || data.email, {
            message: 'Either number or email is required',
            path: ['number'],
        }),
});

const registerZodSchema = z.object({
    body: z
        .object({
            name: z.string().optional(),
            number: z.string().optional(),
            email: z.string().email('Invalid email').optional(),
            password: z
                .string({ required_error: 'Password is required' })
                .min(6, 'Password must be at least 6 characters'),
            shopName: z.string().optional(),
            address: z.string().optional(),
        })
        .refine((data) => data.number || data.email, {
            message: 'Either number or email is required',
            path: ['number'],
        }),
});

const refreshTokenZodSchema = z.object({
    cookies: z.object({
        refreshToken: z.string({
            required_error: 'Refresh Token is required',
        }),
    }),
});

const changePasswordZodSchema = z.object({
    body: z.object({
        oldPassword: z.string({
            required_error: 'Old password  is required',
        }),
        newPassword: z.string({
            required_error: 'New password  is required',
        }),
    }),
});

export const AuthValidation = {
    loginZodSchema,
    registerZodSchema,
    refreshTokenZodSchema,
    changePasswordZodSchema,
};
