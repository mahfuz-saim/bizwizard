import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import { supplierService } from './supplier.service';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import ApiError from '../../../errors/ApiError';

const getTenantIdFromRequest = (req: Request) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant context is missing');
    }
    return tenantId;
};

const supplierAddToShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const result = await supplierService.supplierAddToShop(
            req.body,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Supplier added to Shop successfully',
            data: result,
        });
    },
);

const getSupplierByShopId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const filters = pick(req.query, [
            'name',
            'number',
            'searchTerm',
            'company',
        ]);
        const options = pick(req.query, paginationFields);
        const result = await supplierService.getSupplierByShopId(
            shopId as string,
            filters,
            options,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Shop Supplier fetched successfully',
            data: result,
        });
    },
);

const updateSupplier = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const result = await supplierService.updateSupplier(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Supplier Updated Successfully',
            data: result,
        });
    },
);

const deleteSupplier = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await supplierService.deleteSupplier(id, tenantId);
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Supplier Deleted Successfully',
            data: result,
        });
    },
);

export const supplierController = {
    supplierAddToShop,
    getSupplierByShopId,
    updateSupplier,
    deleteSupplier,
};
