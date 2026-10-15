import { UserRole, OperationType } from '@prisma/client';
import prisma from '../shared/prisma';

interface IAuditLogData {
    [key: string]: any;
}

interface IAuditLogInput {
    operationType: OperationType;
    userId: string;
    userRole: UserRole;
    operationTable: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    oldData?: IAuditLogData | null;
    newData?: IAuditLogData | null;
}

const createAuditLog = async (data: IAuditLogInput) => {
    try {
        await prisma.auditLog.create({
            data: {
                operationType: data.operationType,
                userId: data.userId,
                userRole: data.userRole,
                operationTable: data.operationTable,
                ipAddress: data.ipAddress ?? null,
                userAgent: data.userAgent ?? null,
                oldData: data.oldData ?? undefined,
                newData: data.newData ?? undefined,
            },
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
};

export const AuditLogService = {
    create: createAuditLog,
};
