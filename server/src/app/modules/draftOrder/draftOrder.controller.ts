import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { JwtPayload } from '../../../interfaces/common';
import httpStatus from 'http-status';
import { draftOrderService } from './draftOrder.service';

const getAllDraftOrder = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await draftOrderService.getAllDraftOrder(
            shopId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Draft Order Retrieved successfully',
            data: result,
        });
    },
);

const getSingleDraftOrder = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { orderId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await draftOrderService.getSingleDraftOrder(
            orderId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Draft Order Retrieved successfully',
            data: result,
        });
    },
);

const deleteDraftOrder = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { orderId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await draftOrderService.deleteDraftOrder(
            orderId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Draft Order Deleted successfully',
            data: result,
        });
    },
);

const getDraftCount = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await draftOrderService.getDraftCount(shopId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Draft Order Count Retrieved successfully',
            data: result,
        });
    },
);
export const draftOrderController = {
    getAllDraftOrder,
    getSingleDraftOrder,
    deleteDraftOrder,
    getDraftCount,
};
