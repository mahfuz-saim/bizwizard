import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { buyerService } from './buyer.service';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { createAuditLogInfo } from '../../../helpers/browserData';
import { JwtPayload } from '../../../interfaces/common';
import ApiError from '../../../errors/ApiError';

const getTenantIdFromRequest = (req: Request) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant context is missing');
    }

    return tenantId;
};

const getBuyer = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const filters = pick(req.query, ['name', 'number', 'searchTerm']);
        const options = pick(req.query, paginationFields);
        const result = await buyerService.getBuyer(filters, options, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Buyer is fetched successfully',
            data: result,
        });
    },
);
const getBuyerByID = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const { id } = req.params;
        const result = await buyerService.getBuyerByID(id, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Buyer is fetched successfully',
            data: result,
        });
    },
);

const updateBuyer = catchAsync(async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = req.params;
    const auditLogData = createAuditLogInfo(req);

    const result = await buyerService.updateBuyer(
        id,
        req.body,
        auditLogData,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Buyer updated successfully',
        data: result,
    });
});

const deleteShopBuyer = catchAsync(async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = req.params;
    const result = await buyerService.deleteShopBuyer(id, tenantId);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Shop Buyer deleted successfully',
        data: result,
    });
});

const deleteBuyer = catchAsync(async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = req.params;
    const auditLogData = createAuditLogInfo(req);

    const result = await buyerService.deleteBuyer(id, auditLogData, tenantId);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Buyer deleted successfully',
        data: result,
    });
});
const addBuyer = catchAsync(async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromRequest(req);
    const result = await buyerService.addBuyer(req.body, tenantId);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Buyer Added successfully',
        data: result,
    });
});

const updateShopBuyer = catchAsync(async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromRequest(req);
    const result = await buyerService.updateShopBuyer(
        req.body,
        req.user as JwtPayload,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Shop Buyer Updated Successfully',
        data: result,
    });
});

const getShopBuyer = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const { shopId } = req.params;

        let filters = pick(req.query, ['searchTerm', 'customTag', 'systemTag']);
        if (filters?.customTag) {
            if (!Array.isArray(filters.customTag)) {
                filters.customTag = filters.customTag
                    ? [filters.customTag]
                    : [];
            }
        }

        if (filters?.systemTag) {
            if (!Array.isArray(filters.systemTag)) {
                filters.systemTag = filters.systemTag
                    ? [filters.systemTag]
                    : [];
            }
        }
        const options = pick(req.query, paginationFields);
        const result = await buyerService.getShopBuyer(
            shopId,
            filters,
            options,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Shop Buyers Retrieved successfully',
            data: result,
        });
    },
);

const getCheckoutByBuyerId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const { buyerId } = req.params;
        const { shopId } = req.query;
        const options = pick(req.query, paginationFields);
        const result = await buyerService.getCheckoutByBuyerId(
            buyerId,
            shopId as string,
            options,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Checkouts by Buyers Retrieved successfully',
            data: result,
        });
    },
);

export const buyerController = {
    getBuyer,
    getBuyerByID,
    updateBuyer,
    deleteBuyer,
    addBuyer,
    updateShopBuyer,
    deleteShopBuyer,
    getShopBuyer,
    getCheckoutByBuyerId,
};
