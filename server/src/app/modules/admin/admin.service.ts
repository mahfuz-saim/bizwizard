import { Admin, Prisma, UserStatus } from '@prisma/client';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { IAdminFilterRequest } from './admin.interface';
import prisma from '../../../shared/prisma';
import {
    IAuditLogInfo,
    IGenericResponse,
    JwtPayload,
} from '../../../interfaces/common';
import { IUploadFile } from '../../../interfaces/file';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import { AuditLogService } from '../../../helpers/createAuditlog';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';

const getAllAdmin = async (
    filters: IAdminFilterRequest,
    options: IPaginationOptions,
): Promise<IGenericResponse<Admin[]>> => {
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

    const whereConditions: Prisma.AdminWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.admin.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
    });

    const total = await prisma.admin.count({
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
const getAdminByID = async (id: string) => {
    const result = await prisma.admin.findUnique({
        where: {
            userID: id,
        },
    });

    return result;
};

const deleteAdmin = async (id: string, auditLogData: IAuditLogInfo) => {
    const deletedAdmin = await prisma.$transaction(async tx => {
        const admin = await tx.admin.findUniqueOrThrow({
            where: { userID: id },
            include: { user: true },
        });

        const result = await tx.admin.update({
            where: { userID: id },
            data: { isDeleted: true },
        });

        await tx.user.update({
            where: { id },
            data: { status: UserStatus.DELETED },
        });

        return { admin, result };
    });

    // Audit log for deletion
    await AuditLogService.create({
        operationType: 'DELETE',
        operationTable: 'admin',
        oldData: deletedAdmin.admin,
        newData: deletedAdmin.result,
        ...auditLogData,
    });

    return { message: 'Admin is deleted' };
};

const updateAdmin = async (
    id: string,
    payload: { name?: string; image?: string },
    file: IUploadFile,
    auditLogData: IAuditLogInfo,
) => {
    if (auditLogData.userRole === 'ADMIN' && auditLogData.userId !== id) {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            'You can only update your own profile',
        );
    }

    const oldData = await prisma.admin.findUnique({
        where: { userID: id },
    });

    if (file) {
        const uploadedProfileImage =
            await FileUploadHelper.uploadToCloudinary(file);
        payload.image = uploadedProfileImage?.secure_url;
    }

    const updatedAdmin = await prisma.admin.update({
        where: { userID: id },
        data: payload,
    });

    await AuditLogService.create({
        operationType: 'UPDATE',
        operationTable: 'admin',
        oldData: oldData,
        newData: updatedAdmin,
        ...auditLogData,
    });

    return updatedAdmin;
};

export const adminService = {
    getAllAdmin,
    getAdminByID,
    deleteAdmin,
    updateAdmin,
};
