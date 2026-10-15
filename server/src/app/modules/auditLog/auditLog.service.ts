import { OperationType, Prisma, UserRole } from '@prisma/client';
import { JwtPayload } from '../../../interfaces/common';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import { paginationHelpers } from '../../../helpers/paginationHelper';

interface IFilters {
    searchTerm?: string;
    operationType?: OperationType;
    userRole?: UserRole;
}

const getAuditLog = async (
    filters: IFilters,
    options: IPaginationOptions,
    user: JwtPayload,
) => {
    const { searchTerm, userRole, operationType } = filters;
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const andCondition: Prisma.AuditLogWhereInput[] = [];

    // Apply search filters
    if (searchTerm) {
        andCondition.push({
            OR: [
                {
                    userId: {
                        contains: searchTerm,
                        mode: 'insensitive',
                    },
                },
                {
                    operationTable: {
                        contains: searchTerm,
                        mode: 'insensitive',
                    },
                },
            ],
        });
    }

    // Filter by userRole if provided
    if (userRole) {
        andCondition.push({
            userRole,
        });
    }

    // Filter by operationType if provided
    if (operationType) {
        andCondition.push({
            operationType,
        });
    }

    // Apply role-based access control
    if (user.role === UserRole.SUPER_ADMIN) {
        // Super admin can access all tables, no additional filters needed
    } else if (user.role === UserRole.ADMIN) {
        // Admin can access all tables except user-related operations
        andCondition.push({
            operationTable: {
                not: 'users',
            },
        });
    } else if (user.role === UserRole.OWNER) {
        // Owner can only access specific tables
        andCondition.push({
            operationTable: {
                in: ['shops', 'checkout', 'shopVariant', 'pickup'],
            },
        });
    }
    // Other roles (BUYER, EMPLOYEE, SALES_REPRESENTATIVE) handled by middleware

    const whereConditions =
        andCondition.length > 0 ? { AND: andCondition } : {};

    // Get total count for pagination
    const total = await prisma.auditLog.count({
        where: whereConditions,
    });

    // Get audit logs with pagination and sorting
    const result = await prisma.auditLog.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    id: true,
                    number: true,
                    role: true,
                },
            },
        },
    });

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: result,
    };
};

export const AuditLogService = {
    getAuditLog,
};
