import {
    Employee,
    Prisma,
    ShopJoinRequestStatus,
    SubscriptionStatus,
    UserStatus,
} from '@prisma/client';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { IAuditLogInfo, JwtPayload } from '../../../interfaces/common';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { AuditLogService } from '../../../helpers/createAuditlog';

const getEmployee = async (
    filters: any,
    options: IPaginationOptions,
    user: JwtPayload,
    tenantId: string,
) => {
    const andCondition: Prisma.EmployeeWhereInput[] = [];
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const { searchTerm, ...filterData } = filters;

    if (user.role === 'OWNER') {
        andCondition.push({
            shop: {
                ownerID: user.userID,
            },
        });
    }

    andCondition.push({
        tenantID: tenantId,
    });

    if (searchTerm) {
        andCondition.push({
            OR: ['name', 'number', 'address'].map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            })),
        });
    }

    if (Object.keys(filterData).length > 0) {
        andCondition.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: (filterData as any)[key],
                },
            })),
        });
    }

    const whereConditions: Prisma.EmployeeWhereInput =
        andCondition.length > 0 ? { AND: andCondition } : {};

    const result = await prisma.employee.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
    });

    const total = await prisma.employee.count({
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

const getEmployeeByID = async (
    id: string,
    user: JwtPayload,
    tenantId: string,
) => {
    const andCondition: Prisma.EmployeeWhereInput[] = [
        {
            id,
        },
        {
            tenantID: tenantId,
        },
    ];

    if (user.role === 'OWNER') {
        andCondition.push({
            shop: {
                ownerID: user.userID,
            },
        });
    }

    const whereConditions: Prisma.EmployeeWhereInput =
        andCondition.length > 0 ? { AND: andCondition } : {};

    const result = await prisma.employee.findFirst({
        where: whereConditions,
    });

    return result;
};

const updateEmployee = async (
    id: string,
    payload: Partial<Employee>,
    auditLogData: IAuditLogInfo,
    tenantId: string,
) => {
    // Role-based access control
    if (auditLogData.userRole === 'EMPLOYEE' && auditLogData.userId !== id) {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            'You can only update your own profile',
        );
    }

    // Get current data before update
    const oldData = await prisma.employee.findFirst({
        where: {
            userID: id,
            tenantID: tenantId,
        },
        include: { user: true },
    });

    if (!oldData) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Employee not found');
    }

    // Perform update
    const updatedEmployee = await prisma.employee.update({
        where: { userID: id },
        data: payload,
        include: { user: true },
    });

    // Create audit log
    await AuditLogService.create({
        operationType: 'UPDATE',
        operationTable: 'employee',
        oldData: {
            ...oldData,
        },
        newData: {
            ...updatedEmployee,
        },
        ...auditLogData,
    });

    return updatedEmployee;
};

const deleteEmployee = async (
    id: string,
    auditLogData: IAuditLogInfo,
    tenantId: string,
) => {
    // Only allow deletion by admins/super_admins
    if (auditLogData.userRole === 'EMPLOYEE') {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            'You are not authorized to delete employees',
        );
    }

    const deletedData = await prisma.$transaction(async tx => {
        // Get data before deletion
        const employee = await tx.employee.findFirst({
            where: {
                userID: id,
                tenantID: tenantId,
            },
            include: { user: true },
        });

        if (!employee) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Employee not found');
        }

        // Perform soft delete
        await tx.employee.update({
            where: { userID: id },
            data: { isDeleted: true },
        });

        await tx.user.update({
            where: { id },
            data: { status: UserStatus.DELETED },
        });

        return employee;
    });

    // Create audit log
    await AuditLogService.create({
        operationType: 'DELETE',
        operationTable: 'employee',
        oldData: deletedData,
        newData: null,
        ...auditLogData,
    });

    return { message: 'Employee is deleted' };
};

const joinShop = async (shopCode: string, user: JwtPayload) => {
    const shop = await prisma.shop.findFirst({
        where: {
            shopCode,
        },
    });
    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    const employee = await prisma.employee.findFirst({
        where: {
            userID: user.userID,
        },
    });

    if (!employee) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Employee not found');
    }

    if (employee?.shopID && employee?.shopID !== shop.id) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "You are already an employee of another shop. Employee can't join multiple shops",
        );
    }

    const result = await prisma.shopJoinRequest.upsert({
        where: {
            shopID_userID: {
                shopID: shop.id,
                userID: user.userID,
            },
        },
        create: {
            shopID: shop.id,
            userID: user.userID,
            tenantID: shop.tenantID,
            requestCount: 1,
        },
        update: {
            requestCount: {
                increment: 1,
            },
            status: ShopJoinRequestStatus.PENDING,
            tenantID: shop.tenantID,
        },
    });

    if (result.requestCount > 3) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Maximum Request Limit Exceeded',
        );
    }

    return result;
};

const getJoinRequests = async (user: JwtPayload) => {
    const result = await prisma.shopJoinRequest.findFirst({
        where: {
            userID: user.userID,
        },
        include: {
            Shop: true,
        },
    });
    return result;
};

const deleteJoinRequest = async (
    shopCode: string,
    user: JwtPayload,
    tenantId: string,
) => {
    const shop = await prisma.shop.findFirst({
        where: {
            shopCode,
            tenantID: tenantId,
        },
    });
    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    const joinRequest = await prisma.shopJoinRequest.findFirst({
        where: {
            shopID: shop.id,
            userID: user.userID,
            tenantID: tenantId,
        },
    });

    if (!joinRequest) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Join request not found');
    }

    const result = await prisma.shopJoinRequest.delete({
        where: {
            shopID_userID: {
                shopID: shop.id,
                userID: user.userID,
            },
        },
    });
    return result;
};
const getMyShop = async (user: JwtPayload, tenantId: string) => {
    const result = await prisma.shop.findFirst({
        where: {
            tenantID: tenantId,
            Employee: {
                some: {
                    userID: user.userID,
                    tenantID: tenantId,
                },
            },
        },
        include: {
            Subscription: {
                where: {
                    status: SubscriptionStatus.ACTIVE,
                },
            },
        },
    });
    return result;
};
export const employeeService = {
    getEmployee,
    getEmployeeByID,
    updateEmployee,
    deleteEmployee,
    joinShop,
    getJoinRequests,
    deleteJoinRequest,
    getMyShop,
};
