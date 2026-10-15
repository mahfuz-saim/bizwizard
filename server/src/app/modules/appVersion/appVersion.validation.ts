import { AppType } from '@prisma/client';
import { z } from 'zod';

const appVersionSchema = z.object({
    body: z.object({
        version: z.string(),
        description: z.string().optional(),
        appType: z.nativeEnum(AppType),
        isMandatory: z.boolean().optional(),
    }),
});

export const appVersionZodSchema = { appVersionSchema };
