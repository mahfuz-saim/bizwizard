import { ExpenseType, Prisma } from '@prisma/client';
import { IDateFilters } from '../../../interfaces/common';
import prisma from '../../../shared/prisma';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { shopClock } from '../finance/shared/database';

const validateTenantId = (tenantId: string) => {
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant ID is required');
    }
};

const validateShopByTenant = async (tenantId: string, shopId: string) => {
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
};

const validateVariantByTenant = async (tenantId: string, variantId: string) => {
    const variant = await prisma.shopVariant.findFirst({
        where: {
            id: variantId,
            tenantID: tenantId,
        },
        select: { id: true },
    });

    if (!variant) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Variant not found');
    }
};

const getAnalytics = async (
    tenantId: string,
    shopId: string,
    filters: IDateFilters,
) => {
    validateTenantId(tenantId);
    if (!shopId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Shop ID is required');
    }

    await validateShopByTenant(tenantId, shopId);

    const result = await prisma.$transaction(async tx => {
        filters.startDate = filters.startDate
            ? new Date(new Date(filters.startDate).setUTCHours(0, 0, 0, 0))
            : new Date(new Date().setUTCHours(0, 0, 0, 0));

        filters.endDate = filters.endDate
            ? new Date(new Date(filters.endDate).setUTCHours(23, 59, 59, 999))
            : new Date(new Date().setUTCHours(23, 59, 59, 999));

        const totalBuy = await tx.expenseItem.aggregate({
            where: {
                tenantID: tenantId,
                expense: {
                    shopID: shopId,
                    tenantID: tenantId,
                },
                expenseType: ExpenseType.PRODUCT,
                createdAt: {
                    gte: filters.startDate,
                    lte: filters.endDate,
                },
            },
            _sum: {
                amount: true,
            },
        });
        const totalSell = await tx.checkout.aggregate({
            where: {
                shopID: shopId,
                tenantID: tenantId,
                createdAt: {
                    gte: filters.startDate,
                    lte: filters.endDate,
                },
                isDraft: false,
            },
            _sum: {
                totalPrice: true,
                totalDiscount: true,
                totalQuantity: true,
            },
        });

        const totalLoss = await tx.lotDeletion.aggregate({
            where: {
                tenantID: tenantId,
                Lot: {
                    ShopVariant: {
                        shopID: shopId,
                        tenantID: tenantId,
                    },
                },
                createdAt: {
                    gte: filters.startDate,
                    lte: filters.endDate,
                },
            },
            _sum: {
                lossAmount: true,
            },
        });

        //Total Debt Calculatio
        const allDebts = await tx.debt.findMany({
            where: {
                shopID: shopId,
                tenantID: tenantId,
                createdAt: {
                    gte: filters.startDate,
                    lte: filters.endDate,
                },
            },
            include: {
                checkout: true,
            },
        });
        const totalDebt = allDebts.reduce(
            (total, debt) => total + debt.checkout.totalPrice,
            0,
        );

        // Total Buy Price Calculatio
        const checkoutItems = await tx.checkoutItem.findMany({
            where: {
                AND: [
                    {
                        createdAt: {
                            gte: filters.startDate,
                            lte: filters.endDate,
                        },
                    },
                    {
                        checkout: {
                            shopID: shopId,
                            tenantID: tenantId,
                            isDraft: false,
                        },
                    },
                    {
                        tenantID: tenantId,
                    },
                ],
            },
            select: {
                quantity: true,
                Lot: {
                    select: {
                        buyPrice: true,
                    },
                },
            },
        });

        const totalBuyPrice = checkoutItems.reduce(
            (total, item) => total + item.quantity * (item?.Lot?.buyPrice ?? 0),
            0,
        );
        const profit = (totalSell._sum.totalPrice || 0) - totalBuyPrice;
        const result = {
            totalBuy: totalBuy._sum.amount || 0,
            totalSell: totalSell._sum.totalPrice || 0,
            profit: profit,
            totalDebt: totalDebt,
            totalDiscount: totalSell._sum.totalDiscount || 0,
            totalquantity: totalSell._sum.totalQuantity || 0,
            totalLoss: totalLoss._sum.lossAmount || 0,
        };

        return result;
    });
    return result;
};
const getDashboard = async (tenantId: string, shopId: string, includePurchases: boolean) => {
    validateTenantId(tenantId);
    if (!shopId) throw new ApiError(httpStatus.BAD_REQUEST, 'Shop ID is required');
    await validateShopByTenant(tenantId, shopId);
    const asOf = await shopClock(tenantId, shopId);
    const today = asOf.toISOString().slice(0, 10);
    const yesterday = new Date(asOf.getTime() - 86400000).toISOString().slice(0, 10);
    const salesWhere: Prisma.CheckoutWhereInput = {
        tenantID: tenantId, shopID: shopId, isDraft: false,
        status: { in: ['PAID', 'UNPAID', 'PENDING'] },
    };
    const [todayStats, yesterdayStats, buyers, totalSuppliers, recentCheckouts, recentPurchases, todaySales] = await Promise.all([
        getAnalytics(tenantId, shopId, { startDate: new Date(today), endDate: new Date(today) }),
        getAnalytics(tenantId, shopId, { startDate: new Date(yesterday), endDate: new Date(yesterday) }),
        prisma.shopBuyer.findMany({ where: { tenantID: tenantId, shopID: shopId, isDeleted: false }, select: { buyerID: true } }),
        prisma.shopSupplier.count({ where: { tenantID: tenantId, shopId, isDeleted: false } }),
        prisma.checkout.findMany({
            where: salesWhere, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: {
                items: { include: { Lot: { select: { buyPrice: true, shopVariantId: true } } } },
                Debt: { select: { paidAmount: true, status: true } },
                buyer: { select: { name: true } },
                soldByOwner: { select: { name: true } }, soldByEmployee: { select: { name: true } },
            },
        }),
        includePurchases ? prisma.expenseItem.findMany({
            where: { tenantID: tenantId, expenseType: 'PRODUCT', expense: { shopID: shopId, tenantID: tenantId } },
            take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: { supplier: { select: { supplierName: true } } },
        }) : Promise.resolve([]),
        prisma.checkout.findMany({
            where: { ...salesWhere, createdAt: { gte: new Date(today), lt: new Date(new Date(today).getTime() + 86400000) } },
            select: { totalDiscount: true, items: { select: { unitPrice: true, discountedPrice: true, quantity: true } } },
        }),
    ]);
    const debts = await prisma.debt.findMany({
        where: { tenantID: tenantId, shopID: shopId, checkout: { ...salesWhere, buyerID: { in: buyers.map(b => b.buyerID) } } },
        select: { paidAmount: true, checkout: { select: { totalPrice: true } } },
    });
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
        today: todayStats, yesterday: yesterdayStats,
        totalCustomers: buyers.length, totalSuppliers,
        outstandingDebt: round(debts.reduce((total, d) => total + Math.max(0, d.checkout.totalPrice - (d.paidAmount || 0)), 0)),
        todayDiscount: round(todaySales.reduce((total, s) => total + s.totalDiscount + s.items.reduce((n, i) => n + (i.unitPrice - i.discountedPrice) * i.quantity, 0), 0)),
        recentCheckouts, recentPurchases,
    };
};

const getNotSoldProducts = async (tenantId: string, shopId: string) => {
    validateTenantId(tenantId);
    if (!shopId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Shop ID is required');
    }

    await validateShopByTenant(tenantId, shopId);

    const result = await prisma.shopVariant.findMany({
        where: {
            shopID: shopId,
            tenantID: tenantId,
            AND: [
                {
                    notifyAfterNotSold: { not: null },
                },
                {
                    notifyAt: {
                        lte: new Date(),
                    },
                },
            ],
        },
        include: { product: true },
    });
    return result;
};
const getExpiredProducts = async (
    tenantId: string,
    shopId: string,
    expiresIn: string,
) => {
    validateTenantId(tenantId);
    if (!shopId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Shop ID is required');
    }

    await validateShopByTenant(tenantId, shopId);

    const expiresInInt = expiresIn ? parseInt(expiresIn) : 7;
    const today = new Date();
    const expireBuffer = new Date(today);
    expireBuffer.setDate(today.getDate() + expiresInInt);

    const result = await prisma.lot.findMany({
        where: {
            tenantID: tenantId,
            ShopVariant: {
                shopID: shopId,
                tenantID: tenantId,
            },
            expDate: {
                gte: today,
                lte: expireBuffer,
            },
        },
        include: {
            ShopVariant: true,
        },
    });
    return result;
};
const getLowStockProducts = async (tenantId: string, shopId: string) => {
    validateTenantId(tenantId);
    if (!shopId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Shop ID is required');
    }

    await validateShopByTenant(tenantId, shopId);

    const result = await prisma.shopVariant.findMany({
        where: {
            shopID: shopId,
            tenantID: tenantId,
            totalProducts: {
                lte: prisma.shopVariant.fields.lowStock,
            },
        },
        include: {
            product: true,
        },
    });
    return result;
};

const getPurchasesByVariantId = async (tenantId: string, variantId: string) => {
    validateTenantId(tenantId);
    await validateVariantByTenant(tenantId, variantId);

    const result = await prisma.expenseItem.findMany({
        where: {
            shopVariantId: variantId,
            tenantID: tenantId,
            expenseType: ExpenseType.PRODUCT,
        },
        include: {
            lot: true,
            supplier: {
                select: {
                    id: true,
                    supplierName: true,
                    company: true,
                    number: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    return result;
};

const getLossesByVariantId = async (tenantId: string, variantId: string) => {
    validateTenantId(tenantId);
    await validateVariantByTenant(tenantId, variantId);

    const result = await prisma.lotDeletion.findMany({
        where: {
            shopVariantId: variantId,
            tenantID: tenantId,
        },
        include: {
            Lot: true,
        },
        orderBy: {
            deletionDate: 'desc',
        },
    });
    return result;
};

const getVariantFinancials = async (tenantId: string, variantId: string) => {
    validateTenantId(tenantId);
    await validateVariantByTenant(tenantId, variantId);

    const [purchases, losses, sales] = await prisma.$transaction([
        // Total purchases
        prisma.expenseItem.aggregate({
            where: {
                shopVariantId: variantId,
                tenantID: tenantId,
                expenseType: ExpenseType.PRODUCT,
            },
            _sum: {
                amount: true,
                quantity: true,
            },
        }),
        // Total losses
        prisma.lotDeletion.aggregate({
            where: {
                shopVariantId: variantId,
                tenantID: tenantId,
            },
            _sum: {
                lossAmount: true,
                stock: true,
            },
        }),
        // Total sales revenue
        prisma.checkoutItem.aggregate({
            where: {
                tenantID: tenantId,
                Lot: {
                    shopVariantId: variantId,
                    tenantID: tenantId,
                },
            },
            _sum: {
                discountedPrice: true,
                quantity: true,
            },
        }),
    ]);

    const totalPurchaseAmount = purchases._sum.amount || 0;
    const totalPurchaseQuantity = purchases._sum.quantity || 0;
    const totalLossAmount = losses._sum.lossAmount || 0;
    const totalLossQuantity = losses._sum.stock || 0;
    const totalSalesRevenue = sales._sum.discountedPrice || 0;
    const totalSalesQuantity = sales._sum.quantity || 0;

    const avgBuyPrice =
        totalPurchaseQuantity > 0
            ? totalPurchaseAmount / totalPurchaseQuantity
            : 0;
    const netInvestment = totalPurchaseAmount - totalLossAmount;
    const profit = totalSalesRevenue - totalPurchaseAmount;
    const netProfit = profit + totalLossAmount; // losses already reduce profit

    return {
        purchases: {
            totalAmount: totalPurchaseAmount,
            totalQuantity: totalPurchaseQuantity,
            averagePrice: avgBuyPrice,
        },
        losses: {
            totalAmount: totalLossAmount,
            totalQuantity: totalLossQuantity,
        },
        sales: {
            totalRevenue: totalSalesRevenue,
            totalQuantity: totalSalesQuantity,
        },
        financials: {
            netInvestment,
            grossProfit: profit,
            netProfit,
        },
    };
};

export const analyticsService = {
    getDashboard,
    getAnalytics,
    getNotSoldProducts,
    getExpiredProducts,
    getLowStockProducts,
    getPurchasesByVariantId,
    getLossesByVariantId,
    getVariantFinancials,
};
