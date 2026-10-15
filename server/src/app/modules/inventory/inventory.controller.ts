import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { inventoryService } from './inventory.service';
import { IUploadFile } from '../../../interfaces/file';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { inventoryFilterField } from './inventory.const';
import ApiError from '../../../errors/ApiError';

const getTenantIdFromRequest = (req: Request) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant context is missing');
    }
    return tenantId;
};

const createProductInInventory = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const file = req.file as IUploadFile;
        const tenantId = getTenantIdFromRequest(req);
        const result = await inventoryService.createProductInInventory(
            req.body,
            file,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Product is added into inventory',
            data: result,
        });
    },
);

const getProductFromInventory = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const filters = pick(req.query, inventoryFilterField);
        const options = pick(req.query, paginationFields);
        const tenantId = getTenantIdFromRequest(req);
        const result = await inventoryService.getProductFromInventory(
            filters,
            options,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Product is fetched successfully from inventory',
            data: result,
        });
    },
);
const getSingleProduct = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { shopID = null } = req.query;
        const tenantId = getTenantIdFromRequest(req);
        const result = await inventoryService.getSingleProduct(
            id,
            shopID,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Product is fetched successfully ',
            data: result,
        });
    },
);

const deleteProductInInventory = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const result = await inventoryService.deleteProductInInventory(id);
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Product is deleted from inventory',
            data: result,
        });
    },
);

const updateProductInInventory = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const file = req.file as IUploadFile;
        const result = await inventoryService.updateProductInInventory(
            id,
            req.body,
            file,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Product is updated successfully',
            data: result,
        });
    },
);

const getProductGenericNames = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const filters = pick(req.query, ['searchTerm']);
        const options = pick(req.query, paginationFields);
        const result = await inventoryService.getProductGenericNames(
            filters,
            options,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Generic names are fetched successfully',
            data: result,
        });
    },
);

export const inventoryController = {
    createProductInInventory,
    getProductFromInventory,
    deleteProductInInventory,
    updateProductInInventory,
    getSingleProduct,
    getProductGenericNames,
};
