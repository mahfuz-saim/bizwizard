import { ApprovalStatus, IdType } from '@prisma/client';
import { z } from 'zod';

const submitKYC = z.object({
    body: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        dateOfBirth: z.coerce.date(),
        nationality: z.string().min(1),
        address: z.string().min(1),
        idType: z.nativeEnum(IdType),
        idNumber: z.string().min(1),
    }),
});

const kycApproval = z.object({
    body: z.object({
        userId: z.string().min(1),
        status: z.nativeEnum(ApprovalStatus),
    }),
});

export const KycValidation = {
    submitKYC,
    kycApproval,
};
