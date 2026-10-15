import httpStatus from 'http-status';
import prisma from '../../../shared/prisma';
import ApiError from '../../../errors/ApiError';
import { JwtPayload } from '../../../interfaces/common';
import { Prisma } from '@prisma/client';

const getAllCredit = async (shopId: any, tenantId: string | null) => {
    const whereParams: Prisma.CreditTopupWhereInput = {};

    if (shopId) {
        if (!tenantId) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant ID is missing');
        }

        const shop = await prisma.shop.findFirst({
            where: {
                id: shopId as string,
                tenantID: tenantId,
            },
        });

        if (!shop) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop Not Found');
        }

        whereParams.shopId = shopId;
        whereParams.tenantID = tenantId;
    }

    const result = await prisma.creditTopup.findMany({
        where: whereParams,
    });

    return result;
};

export const creditService = { getAllCredit };
