import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { shopService } from './shop.service';
import { JwtPayload } from '../../../interfaces/common';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';

const createShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await shopService.createShop(
            req.user as JwtPayload,
            req.body,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Shop is created successfully',
            data: result,
        });
    },
);

const getAllShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const filters = pick(req.query, ['searchTerm']);
        const options = pick(req.query, paginationFields);

        const result = await shopService.getAllShop(
            req.user as JwtPayload,
            filters,
            options,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All shop is fetched',
            data: result,
        });
    },
);

const getProductInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.params;
        const filters = pick(req.query, [
            'searchTerm',
            'supplierId',
            'barcode',
            'includeProduct',
            'expireSoon',
        ]);
        const options = pick(req.query, paginationFields);

        const result = await shopService.getProductInShop(
            shopId,
            filters,
            options,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Product in shop is fetched',
            data: result,
        });
    },
);

const deleteShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { id } = req.params;
        const result = await shopService.deleteShop(
            req.user as JwtPayload,
            id,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop is deleted',
            data: result,
        });
    },
);

const updateShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { id } = req.params;
        const result = await shopService.updateShop(
            req.user as JwtPayload,
            id,
            req.body,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop is updated',
            data: result,
        });
    },
);

const getEmployeeRequests = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.params;
        const result = await shopService.getEmployeeRequests(shopId, tenantId);
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Employee Request Retrieved Successfully',
            data: result,
        });
    },
);

const updateEmployeeRequest = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await shopService.updateEmployeeRequest(
            req.body,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Employee Request Updated Successfully',
            data: result,
        });
    },
);

const getShopInfo = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.params;
        const result = await shopService.getShopInfo(shopId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop Info Retrieved successfully',
            data: result,
        });
    },
);

const getAllCategory = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await shopService.getAllCategory();

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Shop Category Retrieved successfully',
            data: result,
        });
    },
);

const getAllPlans = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await shopService.getAllPlans();
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Subscription Plans Retrieved successfully',
            data: result,
        });
    },
);

const verifyShopCode = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopCode } = req.params;
        const result = await shopService.verifyShopCode(shopCode);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop code verified successfully',
            data: result,
        });
    },
);

const getAllLotInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.params;
        const options = pick(req.query, paginationFields);

        const result = await shopService.getAllLotInShop(
            shopId,
            options,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Lots in shop fetched',
            data: result,
        });
    },
);

const createShopConfig = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await shopService.createShopConfig(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop configuration created Successfully',
            data: result,
        });
    },
);

const getShopConfig = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.params;
        const result = await shopService.getShopConfig(shopId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop configuration Retrieved Successfully',
            data: result,
        });
    },
);

const getShopsByTenant = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { tenantId } = req.params;

        const result = await shopService.getShopsByTenant(tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shops of tenant fetched',
            data: result,
        });
    },
);

export const shopController = {
    createShop,
    getAllShop,
    getShopsByTenant,
    getProductInShop,
    deleteShop,
    updateShop,
    getEmployeeRequests,
    updateEmployeeRequest,
    getShopInfo,
    verifyShopCode,
    getAllCategory,
    getAllPlans,
    getAllLotInShop,
    createShopConfig,
    getShopConfig,
};
