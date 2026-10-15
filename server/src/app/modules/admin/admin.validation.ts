import { z } from 'zod';

const updateAdmin = z.object({
    body: z.object({
        name: z.string(),
    }),
});

export const adminValidation = {
    updateAdmin,
};
