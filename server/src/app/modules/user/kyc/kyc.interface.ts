import { ApprovalStatus, IdType } from '@prisma/client';

export interface IKycInput {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    nationality: string;
    address: string;
    idType: IdType;
    idNumber: string;
}

export interface IKycApproval {
    userId: string;
    status: ApprovalStatus;
}
