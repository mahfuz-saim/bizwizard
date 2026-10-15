import { Prisma, UserRole, LedgerEntryType } from '@prisma/client';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { JwtPayload } from '../../../interfaces/common';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import { ICreateCheckout } from './checkout.interface';
import { smsHelper } from '../../../helpers/sendSMS';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { SyncTriggerPayload } from '../../../interfaces/notificationPayload';
import { notificationService } from '../notification/notification.service';
import { number, string } from 'zod';
import { getNameOfDeclaration } from 'typescript';
import { INotification } from '../notification/notification.interface';
import { database } from 'firebase-admin';

function generatePIN() {
    return Math.floor(1000 + Math.random() * 9000);
}

const createCheckout = async (
    payload: ICreateCheckout,
    user: JwtPayload,
    tenantId: string,
) => {
    //console.log('🚀 checkout status : ', payload.status);
    const syncData: SyncTriggerPayload[] = [];
    const msgData: {
        number: string;
        totalPrice: number;
    } = { number: '', totalPrice: 0 };
    let sendSMSVerified = false;

    type LowStockProduct = {
        variantName: string;
        notifyAt: number;
        currentStock: number;
        sendSms?: boolean;
    };

    const lowStockProucts: LowStockProduct[] = [];
    const lowStockProuctsMap = new Map<string, LowStockProduct>();

    const checkoutPIN = generatePIN();

    if (!payload.shopID) throw new Error('Shop ID is required');
    if (
        !Array.isArray(payload.items) ||
        (payload.items.length === 0 && payload.customItems?.length === 0)
    ) {
        throw new Error('At least one item is required');
    }
    if (!payload.status) throw new Error('Checkout status is required');

    const result = await prisma.$transaction(
        async tx => {
            // Fetch shop with owner info
            const shop = await tx.shop.findFirst({
                where: {
                    id: payload.shopID,
                    tenantID: tenantId,
                },
                include: { owner: true },
            });

            if (!shop) {
                throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
            }

            const lotIds = payload.items.map(item => item.lotId);

            // Fetch all relevant lots
            const lots = await tx.lot.findMany({
                where: {
                    id: { in: lotIds },
                    tenantID: tenantId,
                },
                include: {
                    ShopVariant: { include: { product: true } },
                },
            });

            const lotMap = new Map(lots.map(lot => [lot.id, lot]));

            let totalPrice = 0;
            let totalQuantity = 0;
            const checkoutItemsToCreate = [];
            const lotUpdateOperations = [];

            for (const item of payload.items) {
                const lot = lotMap.get(item.lotId);
                if (!lot) {
                    throw new Error(
                        `E_LOT_NOT_FOUND: Lot with ID ${item.lotId} not found`,
                    );
                }

                const shopVariant = lot.ShopVariant;
                if (!shopVariant || shopVariant.shopID !== payload.shopID) {
                    throw new Error(
                        `E_INVALID_SHOP: Lot ${item.lotId} does not belong to the given shop`,
                    );
                }

                if (lot.tenantID !== tenantId) {
                    throw new ApiError(
                        httpStatus.FORBIDDEN,
                        'You do not have access to this lot',
                    );
                }

                if (lot.stock < item.quantity) {
                    throw new Error(
                        `E_INSUFFICIENT_STOCK: Lot for product "${shopVariant.product?.productName || 'Unnamed'}" has insufficient stock (requested: ${item.quantity}, available: ${lot.stock})`,
                    );
                }

                // if (lot.stock - item.quantity <= (shopVariant?.lowStock || 0) {
                //     lowStockProucts.push({
                //         lotId: lot.id,
                //         notifyAt: shopVariant.lowStock || 0,
                //         availableStock: lot.stock - item.quantity,
                //         sendSms: shopVariant.lowStockSMS || false,
                //     });
                // }
                const totalLotAfterSale =
                    (lowStockProuctsMap.get(shopVariant.id)?.currentStock ||
                        shopVariant.totalProducts) - item.quantity;

                lowStockProuctsMap.set(shopVariant.id, {
                    variantName: shopVariant.variantName || '',
                    notifyAt: shopVariant.lowStock || 0,
                    currentStock: totalLotAfterSale,
                    sendSms: shopVariant.lowStockSMS || false,
                });

                let lineDiscount = 0;
                if (item.discountType === 'PERCENTAGE') {
                    lineDiscount =
                        (lot.sellPrice * item.discountPercentage) / 100;
                } else if (item.discountType === 'AMOUNT') {
                    lineDiscount = item.discountAmount;
                }
                const lineTotal =
                    (lot.sellPrice - lineDiscount) * item.quantity;
                totalPrice += lineTotal;
                totalQuantity += item.quantity;

                checkoutItemsToCreate.push({
                    tenantID: tenantId,
                    lotId: lot.id,
                    productName: shopVariant.product?.productName || 'Unnamed',
                    variantId: shopVariant.variantCode,
                    variantName: shopVariant.variantName,
                    unitPrice: lot.sellPrice,
                    quantity: item.quantity,
                    discountedPrice: lot.sellPrice - lineDiscount,
                    itemDiscount: lineDiscount,
                    discountType: item.discountType,
                    inventoryId: shopVariant.productID || null,
                });

                if (!payload.isDraft) {
                    lotUpdateOperations.push(
                        tx.lot.update({
                            where: { id: item.lotId },
                            data: {
                                stock: {
                                    decrement: item.quantity,
                                },
                                ShopVariant: {
                                    update: {
                                        totalProducts: {
                                            decrement: item.quantity,
                                        },
                                        lastSoldDate: new Date(),
                                        notifyAt: computeNotifyAt(
                                            new Date(),
                                            shopVariant.notifyAfterNotSold,
                                        ),
                                    },
                                },
                            },
                        }),
                    );

                    // Prepare sync data for lot update. only if not a draft
                    syncData.push({
                        entity: 'LOT',
                        operation: 'UPDATE',
                        id: lot.id,
                        updatedAt: new Date().toISOString(),
                        shopId: payload.shopID,
                    });

                    syncData.push({
                        entity: 'VARIANT',
                        operation: 'UPDATE',
                        id: lot.shopVariantId,
                        updatedAt: new Date().toISOString(),
                        shopId: payload.shopID,
                    });

                    function computeNotifyAt(
                        lastSoldDate?: Date | null,
                        notifyAfterNotSold?: number | null,
                    ): Date | null {
                        if (!lastSoldDate || !notifyAfterNotSold) return null;
                        return new Date(
                            lastSoldDate.getTime() +
                                notifyAfterNotSold * 86400000,
                        );
                    }
                }
            }
            for (const item of payload?.customItems ?? []) {
                let lineDiscount = 0;
                if (item.discountType === 'PERCENTAGE') {
                    lineDiscount =
                        (item.unitPrice * item.discountPercentage) / 100;
                } else if (item.discountType === 'AMOUNT') {
                    lineDiscount = item.discountAmount;
                }
                const lineTotal =
                    (item.unitPrice - lineDiscount) * item.quantity;
                totalPrice += lineTotal;
                totalQuantity += item.quantity;

                checkoutItemsToCreate.push({
                    tenantID: tenantId,
                    productName: item.name || 'Unnamed',
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    discountedPrice: item.unitPrice - lineDiscount,
                    itemDiscount: lineDiscount,
                    discountType: item.discountType,
                });
            }

            // Apply inventory decrements
            await Promise.all(lotUpdateOperations);

            let cartTotalDiscount = 0;
            if (payload.discountType === 'PERCENTAGE') {
                cartTotalDiscount =
                    (totalPrice * payload.discountPercentage) / 100;
            } else if (payload.discountType === 'AMOUNT') {
                cartTotalDiscount = payload.discountAmount;
            }
            // Create the checkout
            const newCheckout = await tx.checkout.create({
                data: {
                    shopID: payload.shopID,
                    tenantID: tenantId,
                    buyerID: payload.buyerID,
                    totalPrice: totalPrice - cartTotalDiscount,
                    totalQuantity,
                    totalDiscount: cartTotalDiscount,
                    discountType: payload.discountType,
                    status: payload.status,
                    items: {
                        create: checkoutItemsToCreate,
                    },
                    isDraft: payload.isDraft,
                    soldBy: user.role,
                    soldByEmployeeId:
                        user.role === 'EMPLOYEE' ? user.userID : null,
                    soldByOwnerId: user.role === 'OWNER' ? user.userID : null,
                    pin: checkoutPIN,
                },
                include: {
                    shop: { include: { owner: true, address: true } },
                    items: true,
                    buyer: {
                        include: {
                            Shops: {
                                where: {
                                    shopID: payload.shopID,
                                },
                            },
                        },
                    },
                    soldByEmployee: {
                        select: {
                            name: true,
                            number: true,
                        },
                    },
                    soldByOwner: {
                        select: {
                            name: true,
                            number: true,
                        },
                    },
                },
            });

            // Create debt if checkout is unpaid
            let debt = null;
            if (payload.status === 'UNPAID' && !payload.isDraft) {
                if (!payload.buyerID) {
                    throw new Error(
                        'E_MISSING_BUYER: Buyer ID is required for UNPAID checkouts',
                    );
                }

                debt = await tx.debt.create({
                    data: {
                        checkoutID: newCheckout.id,
                        buyerID: payload.buyerID,
                        shopID: shop.id,
                        tenantID: tenantId,
                        paidAmount: payload.paidAmount || 0,
                    },
                });
                if (payload.paidAmount && payload.paidAmount > 0) {
                    await tx.debtPayments.create({
                        data: {
                            debtId: debt.id,
                            amount: payload.paidAmount,
                        },
                    });
                }

                // Create ledger entry for debt creation
                const previousBalance = await (async () => {
                    const lastEntry = await tx.buyerDebtLedger.findFirst({
                        where: {
                            shopId: shop.id,
                            buyerId: payload.buyerID,
                            tenantID: tenantId,
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                        select: {
                            newBalance: true,
                        },
                    });
                    return lastEntry?.newBalance || 0;
                })();

                const newBalance = previousBalance + newCheckout.totalPrice;

                await tx.buyerDebtLedger.create({
                    data: {
                        shopId: shop.id,
                        buyerId: payload.buyerID,
                        tenantID: tenantId,
                        type: LedgerEntryType.DEBT_CREATED,
                        amount: newCheckout.totalPrice,
                        previousBalance,
                        newBalance: Number(newBalance.toFixed(2)),
                        debtId: debt.id,
                        checkoutId: newCheckout.id,
                        description: `Debt created from checkout #${newCheckout.id.slice(-8)}`,
                    },
                });
            }

            // Optional: Send SMS receipt
            if (
                payload.sendSMS &&
                newCheckout.buyer?.number &&
                payload.isDraft === false
            ) {
                const items = newCheckout.items.map(item => ({
                    itemName: item.productName,
                    quantity: item.quantity,
                }));
                msgData.number = newCheckout.buyer.number;
                msgData.totalPrice = newCheckout.totalPrice;
                sendSMSVerified = true;
            }
            if (debt) {
                const result = { ...newCheckout, Debt: debt };
                return result;
            }

            return newCheckout;
        },
        {
            timeout: 10000,
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
    );

    if (sendSMSVerified) {
        // this try catch is to ensure that even if sms fails, checkout is created successfully
        try {
            const smsResponse = await smsHelper.sendReceipt({
                number: msgData.number,
                totalPrice: msgData.totalPrice!,
                pin: checkoutPIN,
                receiptId: result.id,
                shopName: result.shop.shopName,
            });
            //NOTE: decrease shop credit
            if (smsResponse?.success) {
                await prisma.shop.update({
                    where: { id: payload.shopID },
                    data: {
                        credit: {
                            decrement: 1,
                        },
                    },
                });
            }
        } catch (err) {
            //TODO:  notify user?
            console.error('Failed to send SMS receipt:', err);
        }
    }
    // await notificationService.sendSyncTrigger(syncData, payload.shopID);
    lowStockProuctsMap.forEach((values, key) => {
        if (values.currentStock <= values.notifyAt) {
            lowStockProucts.push({
                variantName: values.variantName,
                notifyAt: values.notifyAt,
                currentStock: values.currentStock,
                sendSms: values.sendSms,
            });
        }
    });

    // Send low stock notification if any. otherwise, just send sync trigger
    const notificationData: INotification = {
        shopIds: [payload.shopID],
        title: 'Low Stock Alert',
        body: `There are ${lowStockProucts.length} product(s) low in stock.`,
        data: [
            {
                dataType: 'LOW_STOCK_ALERT',
                data: lowStockProucts,
            },
            {
                dataType: 'SYNC',
                data: syncData,
            },
        ],
        role: [UserRole.OWNER, UserRole.EMPLOYEE],
    };
    if (lowStockProucts.length > 0) {
        await notificationService.sendNotification(notificationData);
    } else {
        await notificationService.sendSyncTrigger(
            [
                {
                    dataType: 'SYNC',
                    data: syncData,
                },
            ],
            null,
        );
    }

    return result;
};

const getCheckOut = async (
    user: JwtPayload,
    tenantId: string,
    filters: any,
    options: IPaginationOptions,
) => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const {
        shopName,
        totalPriceGt,
        totalPriceLt,
        totalQuantityGt,
        totalQuantityLt,
        productName,
        date,
        shopId,
    } = filters;

    const modifiedDate = date ? `${date}T00:00:00.000Z` : undefined;

    const andConditions: Prisma.CheckoutWhereInput[] = [];

    andConditions.push({ tenantID: tenantId });

    if (user.role === 'OWNER') {
        andConditions.push({
            shop: {
                owner: {
                    userID: user.userID,
                },
            },
        });
    }

    if (shopName) {
        andConditions.push({ shop: { shopName } });
    }
    if (productName) {
        andConditions.push({ items: { some: { productName } } });
    }
    if (totalPriceGt || totalPriceLt) {
        andConditions.push({
            totalPrice: {
                gte: totalPriceGt ?? undefined,
                lte: totalPriceLt ?? undefined,
            },
        });
    }
    if (totalQuantityGt || totalQuantityLt) {
        andConditions.push({
            totalQuantity: {
                gte: totalQuantityGt ?? undefined,
                lte: totalQuantityLt ?? undefined,
            },
        });
    }
    if (modifiedDate) {
        andConditions.push({ createdAt: { gte: modifiedDate } });
    }
    if (shopId) {
        const shop = await prisma.shop.findFirst({
            where: {
                id: shopId,
                tenantID: tenantId,
            },
            select: { id: true },
        });

        if (!shop) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
        }

        andConditions.push({ shopID: shopId });
    }

    const whereConditions: Prisma.CheckoutWhereInput = andConditions.length
        ? { AND: andConditions }
        : {};

    const result = await prisma.checkout.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
        include: {
            buyer: {
                include: {
                    Shops: {
                        where: {
                            shopID: shopId || '',
                        },
                    },
                },
            },
        },
    });

    const total = await prisma.checkout.count({ where: whereConditions });

    return {
        meta: { total, page, limit },
        data: result,
    };
};

const getSingleCheckout = async (id: string, tenantId: string) => {
    const shopId = await prisma.checkout.findFirstOrThrow({
        where: {
            id,
            tenantID: tenantId,
        },
        select: { shopID: true },
    });
    const checkout = await prisma.checkout.findFirst({
        where: {
            id,
            tenantID: tenantId,
        },
        include: {
            items: true,
            buyer: {
                include: {
                    Shops: {
                        where: {
                            shopID: shopId.shopID,
                        },
                    },
                },
            },
            Debt: true,
            soldByEmployee: true,
            soldByOwner: true,
            shop: {
                include: { address: true, owner: true },
            },
        },
    });

    return checkout;
};

const getCheckOutByMe = async (
    user: JwtPayload,
    tenantId: string,
    userId: string,
    shopId: string,
    options: IPaginationOptions,
) => {
    const owner = await prisma.owner.findUnique({
        where: {
            userID: user.userID,
        },
        include: {
            shops: true,
        },
    });
    const employee = await prisma.employee.findUnique({
        where: {
            userID: user.userID,
            tenantID: tenantId,
        },
    });

    if (!owner && !employee) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'User is not an owner or employee',
        );
    }

    let shop = null;
    if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
        if (!shopId) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Shop ID is required for owner or admin role',
            );
        }

        shop = await prisma.shop.findFirst({
            where: {
                id: shopId,
                tenantID: tenantId,
            },
            include: { owner: true },
        });

        if (!shop) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
        }

        if (user.role === UserRole.OWNER && shop.ownerID !== user.userID) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You do not have access to this shop',
            );
        }
    }

    if (user.role === UserRole.OWNER) {
        if (owner && owner.userID !== user.userID) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You do not have access to this owner',
            );
        }
        if (employee && employee.shopID !== shop?.id) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You do not have access to this employee in the specified shop',
            );
        }
    } else if (user.role === UserRole.EMPLOYEE) {
        if (user.userID !== employee?.userID) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You do not have access to this employee',
            );
        }
    }

    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const result = await prisma.checkout.findMany({
        where: {
            tenantID: tenantId,
            soldByEmployeeId: employee?.userID || undefined,
            soldByOwnerId: owner?.userID || undefined,
            shopID: shopId || undefined,
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
            tenantID: tenantId,
            soldByEmployeeId:
                user.role === 'EMPLOYEE' ? user.userID : undefined,
            soldByOwnerId: user.role === 'OWNER' ? user.userID : undefined,
            shopID: shopId || undefined,
        },
    });

    return {
        meta: { total, page, limit },
        data: result,
    };
};

const getReciptById = async (id: string, pin: number) => {
    const checkout = await prisma.checkout.findUniqueOrThrow({
        where: { id },
        select: { pin: true, shopID: true },
    });

    if (checkout.pin !== pin) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid PIN provided');
    }

    const result = await prisma.checkout.findUniqueOrThrow({
        where: {
            id: id,
        },
        include: {
            items: true,
            shop: {
                include: {
                    address: true,
                    owner: true,
                },
            },
            buyer: {
                include: {
                    Shops: {
                        where: {
                            shopID: checkout.shopID,
                        },
                    },
                },
            },
            soldByEmployee: true,
            soldByOwner: true,
            Debt: true,
        },
    });

    return result;
};

export const checkoutService = {
    createCheckout,
    getCheckOut,
    getSingleCheckout,
    getCheckOutByMe,
    getReciptById,
};
