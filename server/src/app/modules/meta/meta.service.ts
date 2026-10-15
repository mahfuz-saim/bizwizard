import { UserRole } from '@prisma/client';
import prisma from '../../../shared/prisma';
import { JwtPayload } from '../../../interfaces/common';

const fetchDashboardMetadata = async (user: any) => {
    let metadata;
    switch (user.role) {
        case UserRole.ADMIN:
            metadata = await getAdminDashboardMetadata();
            break;
        case UserRole.SUPER_ADMIN:
            metadata = await getSuperAdminDashboardMetadata();
            break;
        case UserRole.OWNER:
            metadata = await getCustomerDashboardMetadata(user);
            break;
        default:
            throw new Error('Invalid user role');
    }

    return metadata;
};

const getAdminDashboardMetadata = async () => {
    const customerCount = await prisma.owner.count();
    const shopCount = await prisma.shop.count();
    const inventoryCount = await prisma.inventory.count();
    const checkoutCount = await prisma.checkout.count();
    const totalSold = await prisma.checkout.aggregate({
        _sum: { totalPrice: true },
    });
    const totalItem = await prisma.checkout.aggregate({
        _sum: { totalQuantity: true },
    });

    // const barChartData = await getBarChartData();
    // const pieChartData = await getPieChartData();

    return {
        customerCount,
        shopCount,
        inventoryCount,
        checkoutCount,
        totalItem,
        totalSold,
    };
};

const getSuperAdminDashboardMetadata = async () => {
    const customerCount = await prisma.owner.count();
    const shopCount = await prisma.shop.count();
    const inventoryCount = await prisma.inventory.count();
    const checkoutCount = await prisma.checkout.count();
    const totalSold = await prisma.checkout.aggregate({
        _sum: { totalPrice: true },
    });
    const totalItem = await prisma.checkout.aggregate({
        _sum: { totalQuantity: true },
    });
    const adminCount = await prisma.admin.count();

    return {
        customerCount,
        shopCount,
        inventoryCount,
        checkoutCount,
        totalItem,
        totalSold,
    };
};

const getCustomerDashboardMetadata = async (user: JwtPayload) => {
    const shops = await prisma.shop.findMany({
        where: { ownerID: user.userID },
        select: { id: true, shopName: true },
    });

    const shopIDs = shops.map(shop => shop.id);

    if (shopIDs.length === 0) {
        return {
            totalSoldCount: 0,
            totalProductCount: 0,
            totalRevenue: 0,
            weeklySales: 0,
            monthlySales: 0,
            totalGainOrLoss: 0,
            shopWiseStats: {},
        };
    }

    const totalSoldCount = await prisma.checkout.count({
        where: { shopID: { in: shopIDs } },
    });

    const totalRevenueResult = await prisma.checkout.aggregate({
        where: { shopID: { in: shopIDs } },
        _sum: { totalPrice: true },
    });

    const totalRevenue = totalRevenueResult._sum.totalPrice || 0;

    const totalProductCount = await prisma.checkoutItem.count({
        where: { checkout: { shopID: { in: shopIDs } } },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklySalesResult = await prisma.checkout.aggregate({
        where: {
            shopID: { in: shopIDs },
            createdAt: { gte: oneWeekAgo },
        },
        _sum: { totalPrice: true },
    });

    const weeklySales = weeklySalesResult._sum.totalPrice || 0;

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const monthlySalesResult = await prisma.checkout.aggregate({
        where: {
            shopID: { in: shopIDs },
            createdAt: { gte: oneMonthAgo },
        },
        _sum: { totalPrice: true },
    });

    const monthlySales = monthlySalesResult._sum.totalPrice || 0;

    const totalGainOrLossResult = await prisma.checkoutItem.aggregate({
        where: { checkout: { shopID: { in: shopIDs } } },
        _sum: {
            unitPrice: true,
        },
    });

    const totalBuyPriceResult = await prisma.lot.aggregate({
        where: {
            ShopVariant: {
                shopID: { in: shopIDs },
            },
        },
        _sum: {
            buyPrice: true,
        },
    });
    const totalBuyPrice = totalBuyPriceResult._sum.buyPrice || 0;

    const totalSellPrice = totalGainOrLossResult._sum.unitPrice || 0;
    const totalGainOrLoss = totalSellPrice - totalBuyPrice;

    const shopWiseStats: Record<string, any> = {};

    for (const shop of shops) {
        const productSales = await prisma.checkoutItem.groupBy({
            by: ['lotId'],
            where: { checkout: { shopID: shop.id } },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
        });

        if (productSales.length > 0) {
            const highestSoldProduct = await prisma.inventory.findUnique({
                where: { id: productSales[0]?.lotId ?? '' },
                select: { id: true, productName: true, barcode: true },
            });

            const lowestSoldProduct = await prisma.inventory.findUnique({
                where: {
                    id: productSales[productSales.length - 1]?.lotId ?? '',
                },
                select: { id: true, productName: true, barcode: true },
            });

            shopWiseStats[shop.shopName] = {
                highestSoldProduct,
                lowestSoldProduct,
            };
        } else {
            shopWiseStats[shop.shopName] = {
                highestSoldProduct: null,
                lowestSoldProduct: null,
            };
        }
    }

    return {
        totalSoldCount,
        totalProductCount,
        totalRevenue,
        weeklySales,
        monthlySales,
        totalGainOrLoss,
        shopWiseStats,
    };
};

// const getBarChartData = async () => {
//     const appointmentCountByMonth: { month: Date, count: bigint }[] = await prisma.$queryRaw`
//         SELECT DATE_TRUNC('month', "createdAt") AS month,
//                COUNT(*) AS count
//         FROM "appointments"
//         GROUP BY month
//         ORDER BY month ASC
//     `;

//     const formattedMetadata = appointmentCountByMonth.map(({ month, count }) => ({
//         month,
//         count: Number(count), // Convert BigInt to integer
//     }));
//     return formattedMetadata;
// }

// const getPieChartData = async () => {
//     const appointmentStatusDistribution = await prisma.appointment.groupBy({
//         by: ['status'],
//         _count: { id: true },
//     });

//     const formattedData = appointmentStatusDistribution.map(({ status, _count }) => ({
//         status,
//         count: Number(_count.id),
//     }));

//     return formattedData;
// }

export const metaServices = {
    fetchDashboardMetadata,
};
