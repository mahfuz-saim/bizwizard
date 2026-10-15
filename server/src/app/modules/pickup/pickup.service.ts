import { PaymentStatus, PickupStatus, Prisma } from '@prisma/client';
import { JwtPayload } from '../../../interfaces/common';
import prisma from '../../../shared/prisma';
import { ICreatePickup, IPickUpFilterRequest } from './pickup.interface';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';

const createPickup = async (
    payload: ICreatePickup,
    user: JwtPayload,
    tenantId: string,
) => {
    if (!payload.shopID) throw new Error('Shop ID is required');
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error('At least one pickup item is required');
    }

    return prisma.$transaction(async tx => {
        // Ensure the target shop exists within the current tenant.
        const shop = await tx.shop.findFirst({
            where: {
                id: payload.shopID,
                tenantID: tenantId,
            },
        });

        if (!shop) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
        }

        let buyerId = payload.buyerID;
        if (user.role === 'BUYER') {
            const buyer = await tx.buyer.findUnique({
                where: {
                    userID: user.userID,
                },
            });

            if (!buyer) {
                throw new ApiError(httpStatus.NOT_FOUND, 'Buyer not found');
            }

            const tenantBuyer = await tx.shopBuyer.findFirst({
                where: {
                    buyerID: buyer.userID,
                    shopID: payload.shopID,
                    tenantID: tenantId,
                    isDeleted: false,
                },
            });

            if (!tenantBuyer) {
                throw new ApiError(
                    httpStatus.FORBIDDEN,
                    'You do not have access to this shop',
                );
            }

            buyerId = buyer.id;
        } else if (buyerId) {
            const buyer = await tx.buyer.findUnique({
                where: {
                    id: buyerId,
                },
            });

            if (!buyer) {
                throw new ApiError(httpStatus.NOT_FOUND, 'Buyer not found');
            }

            const tenantBuyer = await tx.shopBuyer.findFirst({
                where: {
                    buyerID: buyer.userID,
                    shopID: payload.shopID,
                    tenantID: tenantId,
                    isDeleted: false,
                },
            });

            if (!tenantBuyer) {
                throw new ApiError(
                    httpStatus.FORBIDDEN,
                    'Buyer does not belong to this tenant shop',
                );
            }
        }

        if (!buyerId) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Buyer ID is required');
        }

        let totalPrice = 0;
        let totalQuantity = 0;

        const lotIDs = payload.items.map(item => item.lotID);
        const lots = await tx.lot.findMany({
            where: {
                id: { in: lotIDs },
                tenantID: tenantId,
            },
            include: {
                ShopVariant: {
                    include: { product: true }, // To get product name
                },
            },
        });

        const lotMap = new Map(lots.map(lot => [lot.id, lot]));
        const pickupItemsToCreate = [];
        const lotUpdateOperations = [];

        for (const item of payload.items) {
            const lot = lotMap.get(item.lotID);
            if (!lot) {
                throw new Error(
                    `E_LOT_NOT_FOUND: Lot with ID ${item.lotID} not found`,
                );
            }

            const shopVariant = lot.ShopVariant;
            const product = shopVariant.product;

            if (shopVariant.shopID !== payload.shopID) {
                throw new Error(
                    `E_INVALID_SHOP: Lot does not belong to the provided shop`,
                );
            }

            if (lot.stock < item.quantity) {
                throw new Error(
                    `E_INSUFFICIENT_STOCK: Not enough stock for product "${product?.productName ?? 'Unnamed'}" (requested: ${item.quantity}, available: ${lot.stock})`,
                );
            }

            const lineTotal = lot.sellPrice * item.quantity;
            totalPrice += lineTotal;
            totalQuantity += item.quantity;

            pickupItemsToCreate.push({
                tenantID: tenantId,
                lotId: lot.id,
                productName: product?.productName ?? 'Unnamed',
                unitPrice: lot.sellPrice,
                quantity: item.quantity,
                inventoryId: product?.id ?? null,
            });

            lotUpdateOperations.push(
                tx.lot.updateMany({
                    where: {
                        id: item.lotID,
                        tenantID: tenantId,
                    },
                    data: { stock: { decrement: item.quantity } },
                }),
            );
        }

        // Apply stock decrements
        await Promise.all(lotUpdateOperations);

        // Create the pickup record
        const newPickup = await tx.pickup.create({
            data: {
                shopID: payload.shopID,
                tenantID: tenantId,
                buyerID: buyerId,
                totalPrice,
                totalQuantity,
                pickupItems: {
                    create: pickupItemsToCreate,
                },
            },
            include: {
                shop: { include: { owner: true } },
                pickupItems: true,
            },
        });

        return newPickup;
    });
};

const updatePickup = async (
    pickupID: string,
    payload: { status?: PickupStatus; paymentStatus?: PaymentStatus },
    tenantId: string,
) => {
    return await prisma.$transaction(async tx => {
        const existingPickup = await tx.pickup.findFirst({
            where: {
                id: pickupID,
                tenantID: tenantId,
            },
            include: { pickupItems: true, shop: true },
        });

        if (!existingPickup) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Pickup not found');
        }

        // Validate payment status transition
        if (
            payload.paymentStatus === 'UNPAID' &&
            existingPickup.paymentStatus === 'PAID'
        ) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Cannot change payment status from PAID to UNPAID',
            );
        }

        // Validate status transitions with CANCELED
        if (payload.status) {
            const validTransitions: Record<PickupStatus, PickupStatus[]> = {
                PENDING: ['ACCEPTED', 'PROCESSING', 'COMPLETE', 'CANCELED'],
                ACCEPTED: ['PROCESSING', 'COMPLETE', 'CANCELED'],
                PROCESSING: ['COMPLETE', 'CANCELED'],
                COMPLETE: [],
                CANCELED: [], // No transitions allowed from CANCELED
            };

            const currentStatus = existingPickup.status;
            const newStatus = payload.status;

            if (currentStatus === newStatus) return existingPickup;

            if (!validTransitions[currentStatus].includes(newStatus)) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    `Invalid status transition from ${currentStatus} to ${newStatus}`,
                );
            }

            // Restore stock when canceling
            if (newStatus === 'CANCELED') {
                for (const item of existingPickup.pickupItems) {
                    await tx.lot.updateMany({
                        where: {
                            id: item.lotId,
                            tenantID: tenantId,
                        },
                        data: { stock: { increment: item.quantity } },
                    });
                }
            }
        }

        await tx.pickup.updateMany({
            where: {
                id: pickupID,
                tenantID: tenantId,
            },
            data: payload,
        });

        const updatedPickup = await tx.pickup.findFirst({
            where: {
                id: pickupID,
                tenantID: tenantId,
            },
            include: { pickupItems: true, shop: true },
        });

        if (!updatedPickup) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Pickup not found');
        }

        return updatedPickup;
    });
};

const getAllPickup = async (
    filters: IPickUpFilterRequest,
    options: IPaginationOptions,
    user: JwtPayload,
    tenantId: string,
) => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);
    const { searchTerm, status, paymentStatus, date } = filters;

    const andConditions: Prisma.PickupWhereInput[] = [{ tenantID: tenantId }];

    // Add search term filter
    if (searchTerm) {
        andConditions.push({
            OR: [
                {
                    buyer: {
                        name: { contains: searchTerm, mode: 'insensitive' },
                    },
                },
                {
                    pickupItems: {
                        some: {
                            productName: {
                                contains: searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
            ],
        });
    }

    // Add status filter
    if (status) {
        andConditions.push({ status: { equals: status } });
    }

    // Add payment status filter
    if (paymentStatus) {
        andConditions.push({ paymentStatus: { equals: paymentStatus } });
    }

    // Add date filter
    if (date) {
        const startDate = new Date(date);
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setUTCHours(23, 59, 59, 999);

        andConditions.push({
            createdAt: { gte: startDate, lte: endDate },
        });
    }

    // Role-based conditions
    if (user.role === 'OWNER') {
        const ownerShops = await prisma.shop.findMany({
            where: {
                ownerID: user.userID,
                tenantID: tenantId,
            },
            select: {
                id: true,
            },
        });

        const shopIds = ownerShops.map(shop => shop.id);
        if (shopIds.length === 0) {
            return {
                meta: { page, limit, total: 0 },
                data: [],
            };
        }

        andConditions.push({ shopID: { in: shopIds } });
    } else if (user.role === 'EMPLOYEE') {
        const employee = await prisma.employee.findFirst({
            where: {
                userID: user.userID,
                tenantID: tenantId,
            },
        });

        if (!employee?.shopID) throw new Error('Employee shop not found');
        andConditions.push({ shopID: employee.shopID });
    } else if (user.role === 'BUYER') {
        const buyer = await prisma.buyer.findUnique({
            where: {
                userID: user.userID,
            },
        });

        if (!buyer) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Buyer not found');
        }

        andConditions.push({ buyerID: buyer.id });
    }

    const whereConditions: Prisma.PickupWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const data = await prisma.pickup.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
            shop: true,
            buyer: true,
            pickupItems: true,
        },
    });

    const total = await prisma.pickup.count({
        where: whereConditions,
    });

    // Format response for OWNER role
    if (user.role === 'OWNER') {
        const groupedResult = data.reduce(
            (acc, pickup) => {
                const shopKey = pickup.shopID;
                if (!acc[shopKey]) {
                    acc[shopKey] = {
                        shop: {
                            id: pickup.shopID,
                            shopName: pickup.shop.shopName,
                            createdAt: pickup.shop.createdAt,
                        },
                        pickData: [],
                    };
                }
                acc[shopKey].pickData.push(pickup);
                return acc;
            },
            {} as Record<string, { shop: any; pickData: any[] }>,
        );

        return {
            meta: { page, limit, total },
            data: Object.values(groupedResult),
        };
    }

    return {
        meta: { page, limit, total },
        data,
    };
};

const getSinglePickup = async (
    id: string,
    user: JwtPayload,
    tenantId: string,
) => {
    const pickup = await prisma.pickup.findFirst({
        where: {
            id,
            tenantID: tenantId,
        },
        include: {
            shop: {
                include: {
                    owner: true,
                },
            },
            buyer: true,
            pickupItems: true,
        },
    });

    if (!pickup) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Pickup not found');
    }

    switch (user.role) {
        case 'OWNER':
            const ownerShop = await prisma.shop.findFirst({
                where: {
                    id: pickup.shopID,
                    ownerID: user.userID,
                    tenantID: tenantId,
                },
            });

            if (!ownerShop) {
                throw new ApiError(
                    httpStatus.FORBIDDEN,
                    'You are not authorized to view this pickup',
                );
            }
            break;

        case 'EMPLOYEE':
            const employee = await prisma.employee.findFirst({
                where: {
                    userID: user.userID,
                    tenantID: tenantId,
                },
            });

            if (employee?.shopID !== pickup.shopID) {
                throw new ApiError(
                    httpStatus.FORBIDDEN,
                    'You are not authorized to view this pickup',
                );
            }
            break;

        case 'BUYER':
            const buyer = await prisma.buyer.findUnique({
                where: {
                    userID: user.userID,
                },
            });

            if (!buyer || pickup.buyerID !== buyer.id) {
                throw new ApiError(
                    httpStatus.FORBIDDEN,
                    'You are not authorized to view this pickup',
                );
            }
            break;
        default:
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You are not authorized to view pickups',
            );
    }

    return pickup;
};

const deletePickup = async (pickupID: string, tenantId: string) => {
    return await prisma.$transaction(async tx => {
        const existingPickup = await tx.pickup.findFirst({
            where: {
                id: pickupID,
                tenantID: tenantId,
            },
            include: { pickupItems: true },
        });

        if (!existingPickup) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Pickup not found');
        }

        // Allow deletion only for PENDING or CANCELED statuses
        if (!['PENDING', 'CANCELED'].includes(existingPickup.status)) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                `Pickup cannot be deleted in ${existingPickup.status} status`,
            );
        }

        // Restore stock only for PENDING pickups
        if (existingPickup.status === 'PENDING') {
            for (const item of existingPickup.pickupItems) {
                await tx.lot.updateMany({
                    where: {
                        id: item.lotId,
                        tenantID: tenantId,
                    },
                    data: { stock: { increment: item.quantity } },
                });
            }
        }

        await tx.pickupItem.deleteMany({
            where: {
                pickupID,
                tenantID: tenantId,
            },
        });
        await tx.pickup.deleteMany({
            where: {
                id: pickupID,
                tenantID: tenantId,
            },
        });

        return {
            message: 'Pickup deleted successfully',
            deletedPickupId: pickupID,
        };
    });
};

export const PickupService = {
    createPickup,
    getAllPickup,
    updatePickup,
    getSinglePickup,
    deletePickup,
};
