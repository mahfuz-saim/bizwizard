import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { productService } from './product.service';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import ApiError from '../../../errors/ApiError';
import pick from '../../../shared/pick';

const getTenantIdFromRequest = (req: Request) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant context is missing');
    }
    return tenantId;
};

const addProductInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.addProductInShop(
            req.body,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: "Product is added into your shop's inventory",
            data: result,
        });
    },
);

const deleteProductFromShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { productId } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.deleteProductFromShop(
            productId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: "Product is deleted from your shop's inventory",
            data: result,
        });
    },
);

const updateProductInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { productId } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.updateProductInShop(
            productId,
            req.body,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Product is updated successfully',
            data: result,
        });
    },
);

const updateLotInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { lotId } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.updateLotInShop(
            lotId,
            req.body,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Lot is updated successfully',
            data: result,
        });
    },
);

const getAllLotsInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { variantId } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.getAllLotsInShop(
            variantId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Lot fetched successfully',
            data: result,
        });
    },
);

const deleteLotInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.deleteLotInShop(
            req.body,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Lot is Deleted Successfully',
            data: result,
        });
    },
);

const getProductByVariantCode = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { variantCode } = req.params;
        const { shopId } = req.query;
        const tenantId = getTenantIdFromRequest(req);
        if (!shopId || typeof shopId !== 'string') {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Shop ID is required and must be a string',
            );
        }

        const result = await productService.getProductByVariantCode(
            variantCode,
            shopId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Successfully Fetched Product by Variant Code',
            data: result,
        });
    },
);

const getProductByOCR = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        let filters = pick(req.query, ['searchTerm']);
        const tenantId = getTenantIdFromRequest(req);
        if (filters?.searchTerm) {
            if (!Array.isArray(filters.searchTerm)) {
                filters.searchTerm = filters.searchTerm
                    ? [filters.searchTerm]
                    : [];
            }
        }

        const { shopId } = req.query;
        if (!shopId || typeof shopId !== 'string' || !filters.searchTerm) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Shop ID and Search Term required and must be a string',
            );
        }

        const result = await productService.getProductByOCR(
            shopId,
            filters.searchTerm as string[],
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Successfully Fetched Product by OCR',
            data: result,
        });
    },
);

const getProductById = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { productId } = req.params;
        const tenantId = getTenantIdFromRequest(req);

        const result = await productService.getProductById(productId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Successfully Fetched Product by ID',
            data: result,
        });
    },
);

const getProductByVariantId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { variantId } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.getProductByVariantId(
            variantId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Successfully Fetched Product by Variant ID',
            data: result,
        });
    },
);

const getSingleLotInShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { lotId } = req.params;
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.getSingleLotInShop(lotId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Successfully Fetched Lot by ID',
            data: result,
        });
    },
);

const createProductWithVariants = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = getTenantIdFromRequest(req);
        const result = await productService.createProductWithVariants(
            req.body,
            tenantId,
        );
        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Product and variants created successfully',
            data: result,
        });
    },
);

export const productController = {
    addProductInShop,
    createProductWithVariants,
    deleteProductFromShop,
    updateProductInShop,
    updateLotInShop,
    getAllLotsInShop,
    deleteLotInShop,
    getProductByVariantCode,
    getProductByOCR,
    getProductById,
    getProductByVariantId,
    getSingleLotInShop,
};
