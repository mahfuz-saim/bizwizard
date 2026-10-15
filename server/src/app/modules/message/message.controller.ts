import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { messageService } from './message.service';
import { JwtPayload } from '../../../interfaces/common';

const sendMessage = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await messageService.sendMessage(req.body, tenantId);
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Message sent successfully!',
            data: result,
        });
    },
);

const updateMessage = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await messageService.updateMessage(
            req.body,
            req.user as JwtPayload,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Message updated successfully!',
            data: result,
        });
    },
);

const deleteMessage = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { id } = req.params;
        const result = await messageService.deleteMessage(id, tenantId);
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Message Deleted successfully!',
            data: result,
        });
    },
);

const getAllMessages = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.query;
        const result = await messageService.getAllMessages(
            shopId as string,
            req.user as JwtPayload,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Message Retrieved successfully!',
            data: result,
        });
    },
);

const getSingleMessage = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { msgId } = req.params;
        const result = await messageService.getSingleMessage(
            msgId as string,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Message Details Retrieved successfully!',
            data: result,
        });
    },
);

export const messageController = {
    sendMessage,
    updateMessage,
    deleteMessage,
    getAllMessages,
    getSingleMessage,
};
