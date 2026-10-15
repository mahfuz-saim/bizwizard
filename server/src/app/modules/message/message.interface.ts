import { ApprovalStatus } from '@prisma/client';

export interface IMessage {
    shopId: string;
    msgBody: string;
    receiverNumber?: string[]; // Must not be empty if provided
    receiverId?: string[]; // Must not be empty if provided
    scheduledAt: Date;
    messageType: 'DEBT_REMINDER' | 'PROMOTIONAL' | 'TRANSACTIONAL' | 'GENERAL';
}

export interface IMessageUpdate {
    id: string;
    status: ApprovalStatus;
}
