import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import prisma from '../../../shared/prisma';
import { INote, IUpdateNote } from './note.interface';
import { JwtPayload } from '../../../interfaces/common';

const createNote = async (payload: INote, tenantId: string) => {
    const isShopThere = await prisma.shop.findFirst({
        where: {
            id: payload.shopID,
            tenantID: tenantId,
        },
    });

    if (!isShopThere) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Shop doesn't exist");
    }

    const result = await prisma.note.create({
        data: {
            ...payload,
            tenantID: tenantId,
        },
    });

    return result;
};

const getNotesByShopId = async (
    shopID: string,
    date: any,
    tenantId: string,
) => {
    // First check if the shop exists
    const shopExists = await prisma.shop.findFirst({
        where: {
            id: shopID,
            tenantID: tenantId,
        },
    });

    if (!shopExists) {
        throw new ApiError(httpStatus.NOT_FOUND, "Shop doesn't exist");
    }

    const startUTC = new Date(date);

    const endUTC = new Date(startUTC);
    endUTC.setDate(endUTC.getDate() + 1);

    // Query notes within the full date range
    const notes = await prisma.note.findMany({
        where: {
            shopID: shopID,
            tenantID: tenantId,
            isDeleted: false,
            dueDate: {
                gte: startUTC,
                lt: endUTC,
            },
        },
    });

    return notes;
};

const deleteNote = async (id: string, user: JwtPayload, tenantId: string) => {
    // First check if the note exists
    const existingNote = await prisma.note.findFirst({
        where: {
            id: id,
            tenantID: tenantId,
        },
    });

    if (!existingNote) {
        throw new ApiError(httpStatus.NOT_FOUND, "Note doesn't exist");
    }

    const shopID = existingNote.shopID;

    // Check authorization based on user role
    if (user.role === 'OWNER') {
        // For owners, verify they own this shop
        const ownerData = await prisma.owner.findUnique({
            where: {
                userID: user.userID,
            },
            select: {
                shops: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        const ownedShopIds = ownerData?.shops.map(shop => shop.id) || [];
        const hasAccess = ownedShopIds.includes(shopID);

        if (!hasAccess) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                "You don't have permission to update notes for this shop",
            );
        }
    } else if (user.role === 'EMPLOYEE') {
        // For employees, verify they work at this shop
        const employeeData = await prisma.employee.findFirstOrThrow({
            where: {
                userID: user.userID,
                tenantID: tenantId,
            },
            select: {
                shopID: true,
            },
        });

        if (employeeData.shopID !== shopID) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                "You don't have permission to update notes for this shop",
            );
        }
    }

    // Update the note after authorization checks pass
    const updatedNote = await prisma.note.update({
        where: {
            id: id,
        },
        data: {
            isDeleted: true,
        },
    });

    return updatedNote;
};

const updateNote = async (
    id: string,
    payload: IUpdateNote,
    user: JwtPayload,
    tenantId: string,
) => {
    // First check if the note exists
    const existingNote = await prisma.note.findFirst({
        where: {
            id: id,
            tenantID: tenantId,
        },
    });

    if (!existingNote) {
        throw new ApiError(httpStatus.NOT_FOUND, "Note doesn't exist");
    }

    const shopID = existingNote.shopID;

    // Check authorization based on user role
    if (user.role === 'OWNER') {
        // For owners, verify they own this shop
        const ownerData = await prisma.owner.findUnique({
            where: {
                userID: user.userID,
            },
            select: {
                shops: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        const ownedShopIds = ownerData?.shops.map(shop => shop.id) || [];
        const hasAccess = ownedShopIds.includes(shopID);

        if (!hasAccess) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                "You don't have permission to update notes for this shop",
            );
        }
    } else if (user.role === 'EMPLOYEE') {
        // For employees, verify they work at this shop
        const employeeData = await prisma.employee.findFirstOrThrow({
            where: {
                userID: user.userID,
                tenantID: tenantId,
            },
            select: {
                shopID: true,
            },
        });

        if (employeeData.shopID !== shopID) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                "You don't have permission to update notes for this shop",
            );
        }
    }

    // Update the note after authorization checks pass
    const updatedNote = await prisma.note.update({
        where: {
            id: id,
        },
        data: payload,
    });

    return updatedNote;
};

export const noteService = {
    createNote,
    getNotesByShopId,
    updateNote,
    deleteNote,
};
