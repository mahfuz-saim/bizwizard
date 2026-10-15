import prisma from '../../../shared/prisma';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';

const getAllDraftOrder = async (shopId: string, tenantId: string) => {
    const shop = await prisma.shop.findFirst({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop Not Found');
    }

    const result = await prisma.checkout.findMany({
        where: {
            shopID: shopId,
            tenantID: tenantId,
            isDraft: true,
        },
        include: {
            items: {
                include: {
                    Lot: {
                        include: {
                            ShopVariant: true,
                        },
                    },
                },
            },
            buyer: {
                include: {
                    Shops: {
                        where: {
                            shopID: shopId,
                        },
                    },
                },
            },
        },
    });
    return result;
};

const getSingleDraftOrder = async (orderId: string, tenantId: string) => {
    const result = await prisma.checkout.findFirstOrThrow({
        where: {
            id: orderId,
            tenantID: tenantId,
        },
        include: {
            items: {
                include: {
                    Lot: {
                        include: {
                            ShopVariant: true,
                        },
                    },
                },
            },
        },
    });
    return result;
};

const deleteDraftOrder = async (orderId: string, tenantId: string) => {
    const draftOrder = await prisma.checkout.findFirst({
        where: {
            id: orderId,
            tenantID: tenantId,
        },
    });

    if (!draftOrder) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Draft Order Not Found');
    }

    const result = await prisma.checkout.delete({
        where: {
            id: orderId,
        },
    });
    return result;
};
const getDraftCount = async (shopId: string, tenantId: string) => {
    const shop = await prisma.shop.findFirst({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop Not Found');
    }

    const result = await prisma.checkout.aggregate({
        _count: {
            _all: true,
        },
        where: {
            shopID: shopId,
            tenantID: tenantId,
            isDraft: true,
        },
    });
    return { total: result._count._all };
};

export const draftOrderService = {
    getAllDraftOrder,
    getSingleDraftOrder,
    deleteDraftOrder,
    getDraftCount,
};
