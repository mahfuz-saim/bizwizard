import { Prisma, SystemTag, UserRole, UserStatus } from '@prisma/client';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import {
    IAddBuyer,
    IBuyer,
    ICustomerFilterRequest,
    IUpdateShopBuyer,
} from './buyer.interface';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { AuditLogService } from '../../../helpers/createAuditlog';
import { IAuditLogInfo } from '../../../interfaces/common';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';

const getBuyer = async (
    filters: any,
    options: IPaginationOptions,
    tenantId: string,
) => {
    const andCondition: Prisma.BuyerWhereInput[] = [];
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const { searchTerm, ...filterData } = filters;

    if (searchTerm) {
        andCondition.push({
            OR: ['name', 'number', 'address'].map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            })),
        });
    }

    if (Object.keys(filterData).length > 0) {
        andCondition.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: (filterData as any)[key],
                },
            })),
        });
    }

    andCondition.push({ isDeleted: false });
    andCondition.push({
        Shops: {
            some: {
                tenantID: tenantId,
                isDeleted: false,
            },
        },
    });

    const whereConditions: Prisma.BuyerWhereInput = { AND: andCondition };

    const result = await prisma.buyer.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
    });

    const total = await prisma.buyer.count({
        where: whereConditions,
    });

    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result,
    };
};

const getBuyerByID = async (id: string, tenantId: string) => {
    const result = await prisma.buyer.findFirstOrThrow({
        where: {
            id,
            isDeleted: false,
            Shops: {
                some: {
                    tenantID: tenantId,
                    isDeleted: false,
                },
            },
        },
        include: {
            Debt: {
                where: {
                    tenantID: tenantId,
                },
                include: {
                    checkout: {
                        include: {
                            items: true,
                        },
                    },
                },
            },
        },
    });

    return result;
};

const updateBuyer = async (
    id: string,
    payload: Partial<IBuyer>,
    auditLogData: IAuditLogInfo,
    tenantId: string,
) => {
    if (auditLogData.userRole === 'BUYER' && auditLogData.userId !== id) {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            "You can't update other buyer's data",
        );
    }

    // 1. Get current data before update
    const oldData = await prisma.shopBuyer.findFirst({
        where: {
            id,
            tenantID: tenantId,
            isDeleted: false,
        },
        include: { Buyer: { include: { user: true } } },
    });

    if (!oldData) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Buyer not found');
    }

    // 2. Perform update
    const updatedBuyer = await prisma.shopBuyer.update({
        where: { id },
        data: payload,
        include: { Buyer: { include: { user: true } } },
    });

    // 3. Create audit log
    await AuditLogService.create({
        operationType: 'UPDATE',
        operationTable: 'buyer',
        oldData: {
            ...oldData,
            user: {
                id: oldData.Buyer.user.id,
                number: oldData.Buyer.user.number,
                status: oldData.Buyer.user.status,
            },
        },
        newData: {
            ...updatedBuyer,
            user: {
                id: updatedBuyer.Buyer.user.id,
                number: updatedBuyer.Buyer.user.number,
                status: updatedBuyer.Buyer.user.status,
            },
        },
        ...auditLogData,
    });

    return updatedBuyer;
};

const deleteBuyer = async (
    id: string,
    auditLogData: IAuditLogInfo,
    tenantId: string,
) => {
    const deletedData = await prisma.$transaction(async tx => {
        // 1. Get data before deletion
        const buyer = await tx.buyer.findFirst({
            where: {
                userID: id,
                Shops: {
                    some: {
                        tenantID: tenantId,
                        isDeleted: false,
                    },
                },
            },
            include: { user: true },
        });

        if (!buyer) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Buyer not found');
        }

        // 2. Remove buyer association in current tenant only
        await tx.shopBuyer.updateMany({
            where: {
                buyerID: id,
                tenantID: tenantId,
                isDeleted: false,
            },
            data: { isDeleted: true },
        });

        // 3. Fully delete buyer profile only when it has no active tenant associations left
        const activeTenantLinks = await tx.shopBuyer.count({
            where: {
                buyerID: id,
                isDeleted: false,
            },
        });

        if (activeTenantLinks === 0) {
            await tx.buyer.update({
                where: { userID: id },
                data: { isDeleted: true },
            });

            await tx.user.update({
                where: { id },
                data: { status: UserStatus.DELETED },
            });
        }

        return buyer;
    });

    // 3. Create audit log
    await AuditLogService.create({
        operationType: 'DELETE',
        operationTable: 'buyer',
        oldData: deletedData,
        newData: null,
        ...auditLogData,
    });

    return { message: 'Buyer is deleted' };
};

const addBuyer = async (payload: IAddBuyer, tenantId: string) => {
    const result = await prisma.$transaction(async tx => {
        const shop = await tx.shop.findFirst({
            where: {
                id: payload.shopID,
                tenantID: tenantId,
            },
        });

        if (!shop) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
        }

        let buyer = await tx.buyer.findUnique({
            where: {
                number: payload.number,
            },
        });

        if (!buyer) {
            const user = await tx.user.upsert({
                where: {
                    number: payload.number,
                },

                create: {
                    number: payload.number,
                    status: UserStatus.ACTIVE,
                    role: [UserRole.BUYER],
                    password: null,
                    OTP: 0,
                },
                update: {
                    role: { push: UserRole.BUYER },
                },
            });

            if (payload.name && payload.address) {
                buyer = await tx.buyer.create({
                    data: {
                        name: payload.name,
                        number: payload.number,
                        address: payload.address,
                        userID: user.id,
                    },
                });
            } else {
                throw new ApiError(httpStatus.NOT_FOUND, 'Buyer not found');
            }
        }

        const isExist = await tx.shopBuyer.findFirst({
            where: {
                shopID: payload.shopID,
                buyerID: buyer.userID,
                tenantID: tenantId,
            },
        });
        const result = await tx.shopBuyer.upsert({
            where: {
                id: isExist?.id || '',
            },
            create: {
                shopID: payload.shopID,
                buyerID: buyer.userID,
                tenantID: tenantId,
                number: payload.number,
                name: payload.name,
                address: payload.address,
            },
            update: {
                name: payload.name,
                address: payload.address,
            },
        });
        return result;
    });
    return result;
};

const updateShopBuyer = async (
    payload: IUpdateShopBuyer,
    user: JwtPayload,
    tenantId: string,
) => {
    const shopWhere: Prisma.ShopWhereInput = {
        id: payload.shopID,
        tenantID: tenantId,
    };

    if (user.role === UserRole.OWNER) {
        shopWhere.ownerID = user.userID;
    }

    if (user.role === UserRole.EMPLOYEE) {
        shopWhere.Employee = {
            some: {
                userID: user.userID,
                tenantID: tenantId,
            },
        };
    }

    const shop = await prisma.shop.findFirst({
        where: shopWhere,
    });
    if (!shop && user.role !== UserRole.ADMIN) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    const updated = await prisma.shopBuyer.updateMany({
        where: {
            shopID: payload.shopID,
            buyerID: payload.buyerID,
            tenantID: tenantId,
            isDeleted: false,
        },
        data: {
            name: payload.name,
            address: payload.address,
        },
    });

    if (updated.count === 0) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Buyer not found');
    }

    const result = await prisma.shopBuyer.findFirstOrThrow({
        where: {
            shopID: payload.shopID,
            buyerID: payload.buyerID,
            tenantID: tenantId,
        },
    });

    return result;
};

const deleteShopBuyer = async (id: string, tenantId: string) => {
    await prisma.shopBuyer.findFirstOrThrow({
        where: {
            id,
            tenantID: tenantId,
            isDeleted: false,
        },
    });

    const result = await prisma.shopBuyer.update({
        where: {
            id,
        },
        data: {
            isDeleted: true,
        },
    });
    return result;
};

const getShopBuyer = async (
    shopId: string,
    filters: ICustomerFilterRequest,
    options: IPaginationOptions,
    tenantId: string,
) => {
    await prisma.shop.findFirstOrThrow({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const { searchTerm, customTag, systemTag, ...filterData } = filters;

    const validSystemTags = systemTag?.filter((tag): tag is SystemTag =>
        Object.values(SystemTag).includes(tag as SystemTag),
    );

    const andConditions: Prisma.ShopBuyerWhereInput[] = [
        {
            isDeleted: false,
        },
        {
            tenantID: tenantId,
        },
    ];

    if (searchTerm) {
        andConditions.push({
            OR: ['name', 'number', 'address'].map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            })),
        });
    }

    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: (filterData as any)[key],
                },
            })),
        });
    }

    andConditions.push({
        shopID: shopId,
    });

    if (validSystemTags && validSystemTags.length > 0) {
        andConditions.push({
            systemTags: {
                some: {
                    tag: {
                        in: validSystemTags,
                    },
                },
            },
        });
    }

    if (customTag && customTag.length > 0) {
        andConditions.push({
            customTags: {
                some: {
                    tag: {
                        name: {
                            in: customTag,
                        },
                    },
                },
            },
        });
    }

    const whereConditions: Prisma.ShopBuyerWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.shopBuyer.findMany({
        where: whereConditions,
        include: {
            customTags: {
                include: {
                    tag: true,
                },
            },
            systemTags: true,
        },
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
    });

    const total = await prisma.shopBuyer.count({
        where: whereConditions,
    });

    return {
        meta: { total, page, limit },
        data: result,
    };
};

const getCheckoutByBuyerId = async (
    buyerId: string,
    shopId: string,
    options: IPaginationOptions,
    tenantId: string,
) => {
    if (!shopId || !buyerId) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Shop ID and BuyerId is required',
        );
    }

    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    await prisma.shop.findFirstOrThrow({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    await prisma.shopBuyer.findFirstOrThrow({
        where: {
            buyerID: buyerId,
            tenantID: tenantId,
            isDeleted: false,
        },
    });

    const result = await prisma.checkout.findMany({
        where: {
            buyerID: buyerId,
            shopID: shopId,
            tenantID: tenantId,
        },
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
    });

    const total = await prisma.checkout.count({
        where: {
            buyerID: buyerId,
            shopID: shopId,
            tenantID: tenantId,
        },
    });

    return {
        meta: { total, page, limit },
        data: result,
    };
};

export const buyerService = {
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
