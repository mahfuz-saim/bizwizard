import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import { notificationService } from './notification.service';

const registerDevice = catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.tenantId;
    const result = await notificationService.registerDevice(
        req.body.token,
        req.user as JwtPayload,
        req.body.shopId,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: 'Device Registered Successfully',
        data: result,
    });
});

const sendNotification = catchAsync(async (req: Request, res: Response) => {
    const result = await notificationService.sendNotification(req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: 'Notification Sent Successfully',
        data: result,
    });
});

const getNotifications = catchAsync(async (req: Request, res: Response) => {
    const { shopId } = req.params;
    const tenantId = req.tenantId as string;
    const result = await notificationService.getNotifications(
        shopId,
        req.user as JwtPayload,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: 'Notification Retrieved Successfully',
        data: result,
    });
});

const markNotificationAsRead = catchAsync(
    async (req: Request, res: Response) => {
        const { notificationId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await notificationService.markNotificationAsRead(
            notificationId,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Notification Marked Read Successfully',
            data: result,
        });
    },
);
export const notificationController = {
    registerDevice,
    sendNotification,
    getNotifications,
    markNotificationAsRead,
};
