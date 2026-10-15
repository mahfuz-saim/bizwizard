import { z } from 'zod';

const updateEmployee = z.object({
    body: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        nid: z.string().optional(),
        birthCertificate: z.string().optional(),
    }),
});

export const employeeZodSchema = { updateEmployee };
