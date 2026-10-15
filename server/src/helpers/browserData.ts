import { Request } from 'express';
import { IAuditLogInfo } from '../interfaces/common';
import { UserRole } from '@prisma/client';

export const createAuditLogInfo = (req: Request): IAuditLogInfo => {
    return {
        ipAddress: req.ip as string,
        userAgent: req.headers['user-agent'] as string,
        userId: req.user?.userID as string,
        userRole: req.user?.role as UserRole,
    };
};
