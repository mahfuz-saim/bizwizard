import { SystemTag } from '@prisma/client';
import prisma from '../../../../shared/prisma';
import ApiError from '../../../../errors/ApiError';
import httpStatus from 'http-status';
import { ITagAssign, ITagCreate, ITagUpdate } from './tag.interface';

const createTag = async (payload: ITagCreate, tenantId: string) => {
    await prisma.shop.findFirstOrThrow({
        where: {
            id: payload.shopId,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    const result = await prisma.customTag.upsert({
        where: {
            name_shopId: {
                name: payload.name,
                shopId: payload.shopId,
            },
        },
        create: {
            name: payload.name,
            shopId: payload.shopId,
            tenantID: tenantId,
            description: payload.description,
        },
        update: {
            name: payload.name,
            description: payload.description,
        },
    });

    return result;
};

const updateTag = async (payload: ITagUpdate, tenantId: string) => {
    const teg = await prisma.customTag.findFirstOrThrow({
        where: {
            id: payload.tagId,
            tenantID: tenantId,
        },
    });

    const result = await prisma.customTag.update({
        where: {
            id: payload.tagId,
        },
        data: {
            name: payload.name ?? teg.name,
            description: payload.description ?? teg.description,
        },
    });
    return result;
};
const getTagsByShopId = async (shopId: string, tenantId: string) => {
    await prisma.shop.findFirstOrThrow({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    const customTags = await prisma.customTag.findMany({
        where: {
            shopId: shopId,
            tenantID: tenantId,
        },
    });

    const systemTags = Object.entries(SystemTag).map(([key, value]) => ({
        key,
        name: value,
    }));
    const result = {
        customTags,
        systemTags,
    };

    return result;
};

const deleteTag = async (tagId: string, tenantId: string) => {
    await prisma.customTag.findFirstOrThrow({
        where: {
            id: tagId,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    const result = await prisma.$transaction(async tx => {
        await tx.buyerCustomTag.deleteMany({
            where: {
                tagId: tagId,
                tenantID: tenantId,
            },
        });

        const result = await tx.customTag.delete({
            where: {
                id: tagId,
            },
        });

        return result;
    });

    return result;
};

const assignTagToCustomer = async (payload: ITagAssign, tenantId: string) => {
    await prisma.customTag.findFirstOrThrow({
        where: {
            id: payload.tagId,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    const buyers = await prisma.shopBuyer.findMany({
        where: {
            id: {
                in: payload.customerId,
            },
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (buyers.length !== payload.customerId.length) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'One or more buyers are outside this tenant scope.',
        );
    }

    await prisma.buyerCustomTag.createMany({
        data: buyers.map(buyer => ({
            tenantID: tenantId,
            buyerId: buyer.id,
            tagId: payload.tagId,
        })),
        skipDuplicates: true,
    });
    return null;
};

const removeTagFromCustomer = async (payload: ITagAssign, tenantId: string) => {
    await prisma.customTag.findFirstOrThrow({
        where: {
            id: payload.tagId,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    await prisma.buyerCustomTag.deleteMany({
        where: {
            tagId: payload.tagId,
            tenantID: tenantId,
            buyerId: {
                in: payload.customerId,
            },
        },
    });
    return null;
};

export const tagService = {
    createTag,
    updateTag,
    getTagsByShopId,
    deleteTag,
    assignTagToCustomer,
    removeTagFromCustomer,
};
