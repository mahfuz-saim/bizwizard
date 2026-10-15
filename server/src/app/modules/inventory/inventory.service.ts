import { Prisma } from '@prisma/client';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { IUploadFile } from '../../../interfaces/file';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import { IInventory, IInventorySearchField } from './inventory.interface';
import { inventorySearchField } from './inventory.const';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { notificationService } from '../notification/notification.service';

const createProductInInventory = async (
    payload: IInventory,
    file: IUploadFile,
) => {
    if (file) {
        const upload = await FileUploadHelper.uploadToCloudinary(file);
        payload.image = upload?.secure_url;
    }

    const result = await prisma.inventory.create({
        data: payload,
    });

    //NOTE: sending notification to users
    await notificationService.sendSyncTrigger(
        [
            {
                dataType: 'SYNC',
                data: [
                    {
                        id: result.barcode,
                        entity: 'PRODUCT',
                        operation: 'UPDATE',
                        updatedAt: result.updatedAt.toISOString(),
                    },
                ],
            },
        ],
        null,
    );

    return result;
};

const getProductFromInventory = async (
    filters: IInventorySearchField,
    options: IPaginationOptions,
    tenantId: string,
) => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);
    let { searchTerm, ...remaining } = filters as Record<string, any>;

    const andConditions: Prisma.InventoryWhereInput[] = [];

    andConditions.push({
        OR: [
            { isPrivate: false },
            {
                shopVariants: {
                    some: {
                        tenantID: tenantId,
                    },
                },
            },
        ],
    });

    if (searchTerm) {
        andConditions.push({
            OR: inventorySearchField.map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            })),
        });
    }

    if (Object.keys(remaining).length > 0) {
        andConditions.push({
            AND: Object.keys(remaining).map(field => ({
                [field]: {
                    equals: remaining[field],
                },
            })),
        });
    }

    const whereConditions: Prisma.InventoryWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    // Execute query and count in parallel
    const [result, total] = await Promise.all([
        prisma.inventory.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy:
                sortBy && sortOrder
                    ? { [sortBy]: sortOrder }
                    : { createdAt: 'desc' },
        }),
        prisma.inventory.count({
            where: whereConditions,
        }),
    ]);

    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result,
    };
};

const getSingleProduct = async (id: string, shopID: any, tenantId: string) => {
    const visibilityScope: Prisma.InventoryWhereInput = {
        OR: [
            { isPrivate: false },
            {
                shopVariants: {
                    some: {
                        tenantID: tenantId,
                    },
                },
            },
        ],
    };

    let result = await prisma.inventory.findFirst({
        where: {
            barcode: id,
            ...visibilityScope,
        },
    });

    if (shopID) {
        const shop = await prisma.shop.findFirst({
            where: {
                id: shopID,
                tenantID: tenantId,
            },
        });

        if (!shop) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
        }

        if (!result) {
            const customBarcode = `${id}-custom-${shop?.shopCode}`;
            result = await prisma.inventory.findFirst({
                where: {
                    barcode: customBarcode,
                    ...visibilityScope,
                },
            });
        }

        if (!result) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
        }

        const priceResult = await prisma.shopVariant.findMany({
            where: {
                productID: result?.id || '',
                shopID: shopID,
                tenantID: tenantId,
            },
        });
        const combinedResult = {
            ...result,
            variants: priceResult,
        };
        return combinedResult;
    }

    return result;
};

const updateProductInInventory = async (
    id: string,
    payload: Partial<IInventory>,
    file: IUploadFile,
) => {
    if (file) {
        const upload = await FileUploadHelper.uploadToCloudinary(file);
        payload.image = upload?.secure_url;
    }

    const result = await prisma.inventory.update({
        where: {
            id,
        },
        data: payload,
    });

    //NOTE: sending notification to users
    await notificationService.sendSyncTrigger(
        [
            {
                dataType: 'SYNC',
                data: [
                    {
                        id: result.barcode,
                        entity: 'PRODUCT',
                        operation: 'UPDATE',
                        updatedAt: result.updatedAt.toISOString(),
                    },
                ],
            },
        ],
        null,
    );
    return result;
};

const deleteProductInInventory = async (id: string) => {
    const result = await prisma.inventory.delete({
        where: {
            id,
        },
    });

    //NOTE: sending notification to users
    await notificationService.sendSyncTrigger(
        [
            {
                dataType: 'SYNC',
                data: [
                    {
                        id: result.barcode,
                        entity: 'PRODUCT',
                        operation: 'DELETE',
                        updatedAt: result.updatedAt.toISOString(),
                    },
                ],
            },
        ],
        null,
    );

    return result;
};

const getProductGenericNames = async (
    filters: { searchTerm?: string },
    options: IPaginationOptions,
) => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);
    let { searchTerm } = filters as Record<string, any>;
    const whereConditions: Prisma.InventoryWhereInput = {};

    if (searchTerm) {
        whereConditions.genericName = {
            contains: searchTerm,
            mode: 'insensitive',
        };
    } else {
        whereConditions.genericName = { not: null };
    }
    const result = await prisma.inventory.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
        select: {
            genericName: true,
        },
    });

    const total = await prisma.inventory.count({
        where: whereConditions,
    });

    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result.map(item => item.genericName),
    };
};

export const inventoryService = {
    createProductInInventory,
    getProductFromInventory,
    updateProductInInventory,
    deleteProductInInventory,
    getSingleProduct,
    getProductGenericNames,
};
