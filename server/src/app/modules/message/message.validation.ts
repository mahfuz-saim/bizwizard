import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';

const messageSchema = z
    .object({
        body: z.object({
            shopId: z.string(),
            msgBody: z.string().min(1, 'Message body cannot be empty'),
            receiverNumber: z.array(z.string()).optional(),
            receiverId: z.array(z.string()).optional(),
            scheduledAt: z.preprocess(val => {
                if (typeof val === 'string') return new Date(val);
                return val;
            }, z.date()),
            messageType: z
                .enum([
                    'DEBT_REMINDER',
                    'PROMOTIONAL',
                    'TRANSACTIONAL',
                    'GENERAL',
                ])
                .optional(),
        }),
    })
    .refine(
        data => {
            if (
                data.body?.receiverNumber &&
                data.body?.receiverId &&
                data.body.receiverNumber.length === 0 &&
                data.body.receiverId.length === 0
            ) {
                return false;
            } else if (
                data.body?.receiverNumber &&
                data.body.receiverNumber.length === 0
            ) {
                return false;
            } else if (
                data.body?.receiverId &&
                data.body.receiverId.length === 0
            ) {
                return false;
            } else if (!data.body?.receiverNumber && !data.body?.receiverId) {
                return false;
            }

            return true;
        },
        {
            message:
                'At least one of receiverNumber or receiverId must be provided',
            path: ['body', 'receiverNumber', 'receiverId'],
        },
    );

const messageApprveSchema = z.object({
    body: z.object({
        id: z.string(),
        status: z.nativeEnum(ApprovalStatus),
    }),
});

export const MessageValidation = { messageSchema, messageApprveSchema };
