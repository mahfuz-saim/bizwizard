import { Owner, Prisma, UserStatus } from '@prisma/client';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import { IAuditLogInfo, IGenericResponse } from '../../../interfaces/common';
import { IUploadFile } from '../../../interfaces/file';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import { IOwnerFilterRequest } from './owner.interface';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { AuditLogService } from '../../../helpers/createAuditlog';

const getAllOwner = async (
    filters: IOwnerFilterRequest,
    options: IPaginationOptions,
): Promise<IGenericResponse<Owner[]>> => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);
    const { searchTerm, ...filterData } = filters;

    const andConditions = [];

    if (searchTerm) {
        andConditions.push({
            OR: ['name', 'number'].map(field => ({
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
        isDeleted: false,
    });

    const whereConditions: Prisma.OwnerWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.owner.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
    });

    const total = await prisma.owner.count({
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
const getOwnerByID = async (id: string) => {
    const result = await prisma.owner.findUnique({
        where: {
            userID: id,
        },
    });

    return result;
};
const deleteOwner = async (id: string, auditLogData: IAuditLogInfo) => {
    const deletedOwner = await prisma.$transaction(async tx => {
        // Get owner data before deletion
        const owner = await tx.owner.findUnique({
            where: { userID: id },
            include: { user: true, ShopPayments: true },
        });

        if (!owner) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Owner not found');
        }

        // Perform soft delete
        await tx.owner.update({
            where: { userID: id },
            data: { isDeleted: true },
        });

        await tx.user.update({
            where: { id },
            data: { status: UserStatus.DELETED },
        });

        return owner;
    });

    // Create audit log
    await AuditLogService.create({
        operationType: 'DELETE',
        operationTable: 'owner',
        oldData: {
            ...deletedOwner,
        },
        newData: null,
        ...auditLogData,
    });

    return { message: 'Owner is deleted' };
};

const updateOwner = async (
    id: string,
    payload: { name?: string; image?: string },
    file: IUploadFile,
    auditLogData: IAuditLogInfo,
) => {
    if (auditLogData.userRole === 'OWNER' && auditLogData.userId !== id) {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            'You can only update your own profile',
        );
    }

    // Get current data before update
    const oldData = await prisma.owner.findUnique({
        where: { userID: id },
        include: { user: true },
    });

    if (!oldData) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Owner not found');
    }

    // Handle file upload
    if (file) {
        const uploadedImage = await FileUploadHelper.uploadToCloudinary(file);
        payload.image = uploadedImage?.secure_url;
    }

    // Perform update
    const updatedOwner = await prisma.owner.update({
        where: { userID: id },
        data: payload,
        include: { user: true },
    });

    // Create audit log
    await AuditLogService.create({
        operationType: 'UPDATE',
        operationTable: 'owner',
        oldData: {
            ...oldData,
        },
        newData: {
            ...updatedOwner,
        },
        ...auditLogData,
    });

    return updatedOwner;
};

export const ownerService = {
    getAllOwner,
    getOwnerByID,
    deleteOwner,
    updateOwner,
};
