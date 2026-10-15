import { z } from 'zod';

const updateOwner = z.object({
    body: z.object({
        name: z.string(),
    }),
});

export const ownerValidation = {
    updateOwner,
};
