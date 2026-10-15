import prisma from '../../../shared/prisma';
import { IMessage, IMessageUpdate } from './message.interface';
import { smsHelper } from '../../../helpers/sendSMS';
import { JwtPayload } from '../../../interfaces/common';
import {
    ApprovalStatus,
    MessageType,
    SuccessStatus,
    UserRole,
} from '@prisma/client';
import { scheduleJob } from 'node-schedule';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { sendEmailAlertToAdmins } from '../../../helpers/sendEmail';

const validateTenantId = (tenantId: string) => {
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant ID is required');
    }
};

const validateShopByTenant = async (tenantId: string, shopId: string) => {
    const shop = await prisma.shop.findFirst({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
        include: {
            owner: true,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    return shop;
};

const sendMessage = async (payload: IMessage, tenantId: string) => {
    validateTenantId(tenantId);

    const shop = await validateShopByTenant(tenantId, payload.shopId);

    const kyc = await prisma.kYC.findUnique({
        where: {
            userId: shop.ownerID,
        },
    });
    if (!kyc || !kyc.isVerified) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'KYC_ERR');
    }
    const receivers: string[] = [];
    if (payload.receiverNumber) {
        receivers.push(...payload.receiverNumber);
    }
    if (payload.receiverId) {
        const users = await prisma.shopBuyer.findMany({
            where: {
                buyerID: {
                    in: payload.receiverId,
                },
                shopID: payload.shopId,
                tenantID: tenantId,
            },
            select: {
                number: true,
            },
        });
        receivers.push(...users.map(user => user.number));
    }

    //WARN: TEMPORARY
    //Store the cost of sending SMS in db
    const costPerMsg = parseFloat(process.env.SMS_PER_MESSAGE_COST || '0');

    const totalMessageCost = costPerMsg * receivers.length;

    if (totalMessageCost > shop.credit) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Insufficient credit to send message',
        );
    }

    // to distinguish in admin panel. msg body will be updated with debt content upon sending
    if (payload.messageType === 'DEBT_REMINDER') {
        payload.msgBody = 'Please pay me';
    }

    const result = await prisma.$transaction(async tx => {
        const sentMessage = await tx.messages.create({
            data: {
                shopId: payload.shopId,
                tenantID: tenantId,
                message: payload.msgBody,
                phoneNumbers: receivers,
                scheduledAt: payload.scheduledAt,
                totalCost: totalMessageCost,
                messgeType: payload.messageType as MessageType,
            },
        });

        await tx.shop.update({
            where: {
                id: shop.id,
            },
            data: {
                credit: {
                    decrement: totalMessageCost,
                },
            },
        });
        return sentMessage;
    });

    try {
        await sendEmailAlertToAdmins(
            'New SMS Message Scheduled for Sending',
            'A new SMS message has been scheduled for sending from a shop. Please review and approve it in the admin panel.',
        );
    } catch (err) {
        console.error(
            'Failed to send KYC submission alert email to admins:',
            err,
        );
    }

    return result;
};

const resolveScheduledMessage = async (messageId: string, tenantId: string) => {
    const message = await prisma.messages.findFirstOrThrow({
        where: {
            id: messageId,
            tenantID: tenantId,
        },
    });

    const receiverNumString = '88' + message.phoneNumbers.join(',88');
    let msgSendStatus;

    if (message.messgeType === MessageType.DEBT_REMINDER) {
        const msgData: {
            MobNumber: string;
            Message: string;
        }[] = [];

        type DebtSqlResult = {
            buyerId: string;
            phoneNumber: string;
            totalPaid: number;
            totalCheckoutPrice: number;
        };
        const result: DebtSqlResult[] = await prisma.$queryRaw`
           SELECT
        	d."buyerID" AS "buyerId",
        	b."number" AS "phoneNumber",
        	SUM(d."paidAmount") AS "totalPaid",
        	SUM(c."totalPrice") AS "totalCheckoutPrice"
           FROM "debt" d
           JOIN "checkouts" c ON c.id = d."checkoutID"
           JOIN "buyer" b ON b."userID" = d."buyerID"
           WHERE b."number" = ANY(${message.phoneNumbers}::text[])
              AND d."tenantID" = ${tenantId}
           GROUP BY d."buyerID", b."number";
         `;

        result.forEach(item =>
            msgData.push({
                MobNumber: item.phoneNumber as string,
                Message: `Dear Customer, your remaining debt is ${item.totalCheckoutPrice - item.totalPaid} so far. Please settle your remaining debt at your earliest convenience. Thank you!`,
            }),
        );

        msgSendStatus = await smsHelper.sendDynamicMessage(msgData);
    } else {
        const param = {
            msgBody: message.message,
            number: receiverNumString,
        };
        msgSendStatus = await smsHelper.sendGeneralMessage(param);
    }
    await prisma.$transaction(async tx => {
        await tx.messages.update({
            where: {
                id: messageId,
            },
            data: {
                sentStatus: msgSendStatus?.success
                    ? SuccessStatus.SUCCESS
                    : SuccessStatus.FAILED,
            },
        });

        if (!msgSendStatus?.success) {
            //Returning credits
            await prisma.shop.updateMany({
                where: {
                    id: message.shopId,
                    tenantID: tenantId,
                },
                data: {
                    credit: {
                        increment: message.totalCost,
                    },
                },
            });
        }
    });
};

const updateMessage = async (
    payload: IMessageUpdate,
    user: JwtPayload,
    tenantId: string,
) => {
    validateTenantId(tenantId);

    const message = await prisma.messages.findFirstOrThrow({
        where: {
            id: payload.id,
            tenantID: tenantId,
        },
    });

    const result = await prisma.messages.update({
        where: {
            id: message.id,
        },
        data: {
            approvalStatus: payload.status,
            approvedById: user.userID,
        },
    });

    if (payload.status === ApprovalStatus.APPROVED) {
        scheduleJob(
            new Date(message.scheduledAt),
            async function (msgId: string) {
                await resolveScheduledMessage(msgId, tenantId);
            }.bind(null, message.id),
        );
    }

    if (payload.status === ApprovalStatus.REJECTED) {
        await prisma.shop.updateMany({
            where: {
                id: message.shopId,
                tenantID: tenantId,
            },
            data: {
                credit: {
                    increment: message.totalCost,
                },
            },
        });
    }

    return result;
};

const deleteMessage = async (id: string, tenantId: string) => {
    validateTenantId(tenantId);

    const message = await prisma.messages.findFirstOrThrow({
        where: {
            id: id,
            tenantID: tenantId,
        },
    });

    if (message.approvalStatus !== ApprovalStatus.PENDING) {
        throw new Error('Only pending messages can be deleted');
    }

    const result = await prisma.$transaction(async tx => {
        const msgDeletion = await tx.messages.delete({
            where: {
                id: message.id,
            },
        });

        await tx.shop.updateMany({
            where: {
                id: message.shopId,
                tenantID: tenantId,
            },
            data: {
                credit: {
                    increment: message.totalCost,
                },
            },
        });
        return msgDeletion;
    });
    return result;
};

const getAllMessages = async (
    shopId: string,
    user: JwtPayload,
    tenantId: string,
) => {
    validateTenantId(tenantId);

    if (!shopId && user.role !== 'ADMIN') {
        throw new Error('Shop ID is required for non-admin users');
    }

    if (shopId) {
        await validateShopByTenant(tenantId, shopId);
    }

    //TODO: add filters
    const whereCondition =
        user.role === UserRole.ADMIN
            ? { tenantID: tenantId, ...(shopId ? { shopId } : {}) }
            : { tenantID: tenantId, shopId };

    const result = await prisma.messages.findMany({
        where: whereCondition,
        include: {
            shop: user.role === UserRole.ADMIN ? true : false,
        },
    });
    return result;
};

const getSingleMessage = async (msgId: string, tenantId: string) => {
    validateTenantId(tenantId);

    //TODO: add filters
    const message = await prisma.messages.findFirstOrThrow({
        where: {
            id: msgId,
            tenantID: tenantId,
        },
    });
    const users = await prisma.shopBuyer.findMany({
        where: {
            number: {
                in: message.phoneNumbers,
            },
            shopID: message.shopId,
            tenantID: tenantId,
        },
    });
    return {
        ...message,
        receivers: users,
    };
};

export const messageService = {
    sendMessage,
    updateMessage,
    deleteMessage,
    getAllMessages,
    getSingleMessage,
};
