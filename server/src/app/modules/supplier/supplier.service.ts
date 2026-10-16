import prisma from '../../../shared/prisma';
import { ISupplierAddToShop, IUpdateSupplier } from './supplier.interface';
import { Prisma, UserRole } from '@prisma/client';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';

const getTenantShopOrThrow = async (shopId: string, tenantId: string) => {
    const shop = await prisma.shop.findFirst({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    return shop;
};

const supplierAddToShop = async (
    payload: ISupplierAddToShop,
    tenantId: string,
) => {
    await getTenantShopOrThrow(payload.shopId, tenantId);

    const result = await prisma.$transaction(async tx => {
        let supplier = await tx.supplier.findFirst({
            where: {
                number: payload.number,
            },
        });
        if (!supplier) {
            const generateOTP = () => Math.floor(1000 + Math.random() * 9000);
            const user = await tx.user.upsert({
                where: {
                    number: payload.number,
                },
                create: {
                    number: payload.number,
                    role: [UserRole.SUPPLIER],
                    password: null,
                    OTP: generateOTP(),
                },
                update: {
                    role: { push: UserRole.SUPPLIER },
                },
            });
            supplier = await tx.supplier.create({
                data: {
                    name: payload.name,
                    number: payload.number,
                    company: '',
                    userID: user.id,
                },
            });
        }

        const isExists = await tx.shopSupplier.findFirst({
            where: {
                shopId: payload.shopId,
                supplierId: supplier.userID,
                tenantID: tenantId,
            },
        });

        const result = isExists
            ? await tx.shopSupplier.update({
                  where: {
                      id: isExists.id,
                  },
                  data: {
                      isDeleted: false,
                      supplierName: payload.name,
                      comment: payload?.comment || isExists.comment || '',
                      company: payload?.company || isExists.company || '',
                  },
              })
            : await tx.shopSupplier.create({
                  data: {
                      shopId: payload.shopId,
                      supplierId: supplier.userID,
                      tenantID: tenantId,
                      supplierName: payload.name,
                      comment: payload?.comment || '',
                      company: payload?.company || '',
                      number: payload.number,
                  },
              });
        return result;
    });

    return result;
};

const getSupplierByShopId = async (
    shopId: string,
    filters: any,
    options: IPaginationOptions,
    tenantId: string,
) => {
    await getTenantShopOrThrow(shopId, tenantId);

    const andCondition: Prisma.ShopSupplierWhereInput[] = [
        { shopId: shopId },
        { tenantID: tenantId },
        { isDeleted: false },
    ];

    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const { searchTerm, ...filterData } = filters;

    if (searchTerm) {
        andCondition.push({
            OR: ['supplierName', 'company', 'number'].map(field => ({
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

    const whereConditions: Prisma.ShopSupplierWhereInput = {
        AND: andCondition,
    };

    const result = await prisma.shopSupplier.findMany({
        where: whereConditions,
        orderBy: [{ lastSuppliedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
        include: {
            supplier: true,
        },
        skip,
        take: limit,
    });
    const total = await prisma.shopSupplier.count({
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

const updateSupplier = async (payload: IUpdateSupplier, tenantId: string) => {
    const { supplierId, shopId, ...data } = payload;
    await getTenantShopOrThrow(shopId, tenantId);

    const supplier = await prisma.shopSupplier.findFirst({
        where: {
            id: supplierId,
            shopId,
            tenantID: tenantId,
            isDeleted: false,
        },
    });

    if (!supplier) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Supplier not found');
    }

    const result = await prisma.shopSupplier.update({
        where: {
            id: supplier.id,
        },
        data,
    });
    return result;
};

const deleteSupplier = async (id: string, tenantId: string) => {
    const supplier = await prisma.shopSupplier.findFirst({
        where: {
            id,
            tenantID: tenantId,
            isDeleted: false,
        },
    });

    if (!supplier) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Supplier not found');
    }

    const result = await prisma.shopSupplier.update({
        where: {
            id: supplier.id,
        },
        data: {
            isDeleted: true,
        },
    });
    return result;
};
export const supplierService = {
    supplierAddToShop,
    getSupplierByShopId,
    updateSupplier,
    deleteSupplier,
};
