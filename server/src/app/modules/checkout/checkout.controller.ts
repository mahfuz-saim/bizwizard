import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { checkoutService } from './checkout.service';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import pick from '../../../shared/pick';
import { JwtPayload } from '../../../interfaces/common';
import { paginationFields } from '../../../const';
import ApiError from '../../../errors/ApiError';

const getTenantIdFromRequest = (req: Request) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant context is missing');
    }

    return tenantId;
};

const createCheckout = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const result = await checkoutService.createCheckout(
            req.body,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Product is sold successfully!',
            data: result,
        });
    },
);

const getCheckOut = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const filters = pick(req.query, [
            'shopName',
            'totalPriceGt',
            'totalQuantityGt',
            'productName',
            'totalPriceLt',
            'totalQuantityLt',
            'date',
            'shopId',
        ]);
        const options = pick(req.query, paginationFields);

        const result = await checkoutService.getCheckOut(
            req.user as JwtPayload,
            tenantId,
            filters,
            options,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Checkout data is fetched successfully!',
            data: result,
        });
    },
);

const getCheckOutByID = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await checkoutService.getSingleCheckout(id, tenantId);
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Checkout data is fetched successfully!',
            data: result,
        });
    },
);

const getCheckOutByMe = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const { userId } = req.params;
        const { shopId } = req.query;
        const options = pick(req.query, paginationFields);
        const result = await checkoutService.getCheckOutByMe(
            req.user as JwtPayload,
            tenantId,
            userId as string,
            shopId as string,
            options,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Checkout Handled By User is fetched successfully!',
            data: result,
        });
    },
);

const getReciptById = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const result = await checkoutService.getReciptById(id, req.body.pin);
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Checkout Data fetched successfully!',
            data: result,
        });
    },
);

export const checkoutController = {
    createCheckout,
    getCheckOut,
    getCheckOutByID,
    getCheckOutByMe,
    getReciptById,
};
