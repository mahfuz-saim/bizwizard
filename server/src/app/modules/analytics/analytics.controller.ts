import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import pick from '../../../shared/pick';
import { dateFilters, paginationFields } from '../../../const';
import { analyticsService } from './analytics.service';

const getAnalytics = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.query;
        const tenantId = req.tenantId as string;
        const filters = pick(req.query, dateFilters);
        const result = await analyticsService.getAnalytics(
            tenantId,
            shopId as string,
            filters,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Analytics Retrieved successfully!',
            data: result,
        });
    },
);

const getNotSoldProducts = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.query;
        const tenantId = req.tenantId as string;
        const result = await analyticsService.getNotSoldProducts(
            tenantId,
            shopId as string,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Not Sold Products Retrieved successfully!',
            data: result,
        });
    },
);

const getExpiredProducts = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId, expiresIn } = req.query;
        const tenantId = req.tenantId as string;
        const result = await analyticsService.getExpiredProducts(
            tenantId,
            shopId as string,
            expiresIn as string,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Expired Products Retrieved successfully!',
            data: result,
        });
    },
);

const getLowStockProducts = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.query;
        const tenantId = req.tenantId as string;
        const result = await analyticsService.getLowStockProducts(
            tenantId,
            shopId as string,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Low Stock Products Retrieved successfully!',
            data: result,
        });
    },
);

const getPurchasesByVariantId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { variantId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await analyticsService.getPurchasesByVariantId(
            tenantId,
            variantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Purchases Retrieved successfully!',
            data: result,
        });
    },
);

const getLossesByVariantId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { variantId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await analyticsService.getLossesByVariantId(
            tenantId,
            variantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Losses Retrieved successfully!',
            data: result,
        });
    },
);

const getVariantFinancials = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { variantId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await analyticsService.getVariantFinancials(
            tenantId,
            variantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Variant Financials Retrieved successfully!',
            data: result,
        });
    },
);

export const analyticsController = {
    getAnalytics,
    getNotSoldProducts,
    getExpiredProducts,
    getLowStockProducts,
    getPurchasesByVariantId,
    getLossesByVariantId,
    getVariantFinancials,
};
