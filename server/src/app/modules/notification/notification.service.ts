import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import prisma from '../../../shared/prisma';
import { JwtPayload } from '../../../interfaces/common';
import { INotification } from './notification.interface';
import { sendNotificationToTokens } from '../../../helpers/sendPushNotification';
import { Prisma } from '@prisma/client';
import { SyncTriggerPayload } from '../../../interfaces/notificationPayload';

const registerDevice = async (
    deviceToken: string,
    user: JwtPayload,
    shopId: string | null,
    tenantId: string | null,
) => {
    // Validate shop belongs to tenant if shopId is provided
    if (shopId && tenantId) {
        const shop = await prisma.shop.findFirst({
            where: {
                id: shopId,
                tenantID: tenantId,
            },
            select: { id: true },
        });
        if (!shop) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                'Shop not found or does not belong to this tenant',
            );
        }
    }
    await prisma.fCM_Token.deleteMany({
        where: {
            token: deviceToken,
        },
    });

    const createData: Prisma.FCM_TokenCreateInput = {
        token: deviceToken,
        userId: user.userID,
    };
    const updateData: Prisma.FCM_TokenUpdateInput = {
        token: deviceToken,
    };
    if (tenantId) {
        createData.tenantId = tenantId;
        updateData.tenantId = tenantId;
    }
    if (shopId) {
        createData.shopId = shopId;
        updateData.shopId = shopId;
    }

    const result = await prisma.fCM_Token.upsert({
        where: {
            userId: user.userID,
        },
        create: createData,
        update: updateData,
    });
    return result;
};

/**
 * Sends push notifications and persists notification rows.
 *
 * Targeting behavior:
 * 1) No userIds and no shopIds: broadcast to all devices (or tenant-scoped devices when tenantIds is provided).
 * 2) shopIds provided: notify devices bound to those shops.
 * 3) userIds provided: notify devices bound to those users.
 */
const sendNotification = async (payload: INotification) => {
    let tokens: string[] = [];
    const notificationTableUpdates: Prisma.NotificationCreateManyInput[] = [];
    const fcmWhereConditions: Prisma.FCM_TokenWhereInput = {};

    const hasShopIds = (payload.shopIds?.length ?? 0) > 0;
    const hasUserIds = (payload.userIds?.length ?? 0) > 0;
    const isPublic = !hasShopIds && !hasUserIds;

    if (hasShopIds && hasUserIds) {
        fcmWhereConditions.OR = [
            { shopId: { in: payload.shopIds! } },
            { userId: { in: payload.userIds! } },
        ];
    } else if (hasShopIds) {
        fcmWhereConditions.shopId = { in: payload.shopIds! };
    } else if (hasUserIds) {
        fcmWhereConditions.userId = { in: payload.userIds! };
    }

    const devices = await prisma.fCM_Token.findMany({
        where: fcmWhereConditions,
    });

    devices.map(item => {
        tokens.push(item.token);
        notificationTableUpdates.push({
            title: payload.title,
            body: payload.body,
            isPublic: isPublic,
            data: payload?.data as Prisma.InputJsonValue,
            role: payload?.role || [],
            tenantID: item?.tenantId,
            shopId: item?.shopId,
            userId: item?.userId,
        });
    });

    await prisma.notification.createMany({
        data: notificationTableUpdates,
    });

    const notifyResult = await sendNotificationToTokens(tokens, {
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: payload.data,
    });
    //TODO: handle errors
    //find defective tokens and remove them from the database
    return notifyResult;
};

export const notificationVisibility = (
    shopId: string,
    user: JwtPayload,
    tenantId: string,
): Prisma.NotificationWhereInput => ({
    tenantID: tenantId,
    AND: [
        { OR: [{ userId: null }, { userId: user.userID }] },
        { OR: [{ shopId: null }, { shopId }] },
        {
            OR: [
                { userId: user.userID },
                { shopId },
                { role: { has: user.role } },
                { isPublic: true },
            ],
        },
    ],
});

const assertShopAccess = async (
    shopId: string,
    user: JwtPayload,
    tenantId: string,
) => {
    const shop = await prisma.shop.findFirst({
        where: { id: shopId, tenantID: tenantId },
        select: { id: true },
    });
    if (!shop) throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    if (user.role === 'EMPLOYEE') {
        const employee = await prisma.employee.findFirst({
            where: {
                userID: user.userID,
                tenantID: tenantId,
                shopID: shopId,
                isDeleted: false,
            },
        });
        if (!employee)
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You do not have access to this shop',
            );
    }
};

const getNotifications = async (
    shopId: string,
    user: JwtPayload,
    tenantId: string,
) => {
    await assertShopAccess(shopId, user, tenantId);
    return prisma.notification.findMany({
        where: notificationVisibility(shopId, user, tenantId),
        include: {
            ReadStatus: { where: { userId: user.userID, tenantID: tenantId } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
};

const markNotificationAsRead = async (
    notificationId: string,
    user: JwtPayload,
    tenantId: string,
    shopId: string,
) => {
    await assertShopAccess(shopId, user, tenantId);
    const notification = await prisma.notification.findFirst({
        where: {
            id: notificationId,
            ...notificationVisibility(shopId, user, tenantId),
        },
    });
    if (!notification)
        throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
    // Serialize per notification so retries/concurrent tabs do not create duplicate read rows.
    return prisma.$transaction(async tx => {
        await tx.notification.update({
            where: { id: notificationId },
            data: { updatedAt: new Date() },
        });
        const where = {
            notificationId,
            userId: user.userID,
            tenantID: tenantId,
        };
        const existing = await tx.notificationRead.findFirst({ where });
        if (existing)
            return tx.notificationRead.update({
                where: { id: existing.id },
                data: { isRead: true },
            });
        return tx.notificationRead.create({ data: { ...where, isRead: true } });
    });
};

const sendSyncTrigger = async (
    payload: {
        dataType: 'SYNC' | 'ALERT' | 'MESSAGE' | 'LOW_STOCK_ALERT' | 'OTHER';
        data: SyncTriggerPayload[];
    }[],
    shopId: string | null,
) => {
    const whereConditions: Prisma.FCM_TokenWhereInput = {};
    if (shopId) {
        whereConditions.shopId = shopId;
    }
    const devices = await prisma.fCM_Token.findMany({
        where: whereConditions,
        select: {
            token: true,
        },
    });

    const tokens = devices.map(item => item.token);
    const notifyResult = await sendNotificationToTokens(tokens, {
        data: payload,
    });

    //TODO: handle errors
    //find defective tokens and remove them from the database
    return notifyResult;
};

export const notificationService = {
    registerDevice,
    sendNotification,
    getNotifications,
    markNotificationAsRead,
    sendSyncTrigger,
};
