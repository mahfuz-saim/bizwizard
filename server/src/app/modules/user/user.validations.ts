import { z } from 'zod';

const createAdmin = z.object({
    body: z.object({
        password: z.string(),
        admin: z.object({
            name: z.string(),
            number: z.string(),
        }),
    }),
});
const createSale = z.object({
    body: z.object({
        password: z.string(),
        sale: z.object({
            name: z.string(),
            number: z.string(),
        }),
        // optional SR-side referral: if present, must belong to a SalesRepresentative
        referralCode: z.string().optional(),
    }),
});

const createBuyer = z.object({
    body: z.object({
        password: z.string(),
        buyer: z.object({
            name: z.string(),
            number: z.string(),
            address: z.string(),
        }),
    }),
});

const createEmployee = z.object({
    body: z.object({
        password: z.string(),
        employee: z.object({
            name: z.string(),
            number: z.string(),
            address: z.string(),
            dob: z.string(),
            nid: z.string().optional(),
            birthCertificate: z.string().optional(),
        }),
    }),
});

const createUser = z.object({
    body: z.object({
        user: z.object({
            name: z.string(),
            number: z.string(),
            address: z.string(),
            dob: z.string(),
            nid: z.string().optional(),
            birthCertificate: z.string().optional(),
            email: z.string().email().optional(),
        }),
        userType: z.enum(['owner', 'employee']),
        referralCode: z.string().optional(),
        password: z.string().optional(),
    }),
});

const createSupplier = z.object({
    body: z.object({
        password: z.string(),
        supplier: z.object({
            name: z.string(),
            number: z.string(),
            company: z.string(),
            image: z.string().optional(),
        }),
    }),
});
export const UserValidation = {
    createAdmin,
    createSale,
    createBuyer,
    createEmployee,
    createUser,
    createSupplier,
};
