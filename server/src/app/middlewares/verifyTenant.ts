import httpstatus from 'http-status';
import { Request, NextFunction, Response } from 'express';
import { JwtPayload } from '../../interfaces/common';
import { UserRole } from '@prisma/client';
import ApiError from '../../errors/ApiError';
import prisma from '../../shared/prisma';

// Routes that a SalesRepresentative may access without an x-tenant-id header.
// SRs don't own tenants; their referral listing / claims don't need one.
function isSalesRepNoTenantRoute(req: Request): boolean {
    return (
        req.user?.role === UserRole.SALES_REPRESENTATIVE &&
        req.originalUrl.startsWith('/referral/')
    );
}

async function verifyTenantAccess(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;

        // SRs are allowed on /referral/* routes without a tenant header.
        if (!tenantId && isSalesRepNoTenantRoute(req)) {
            req.tenantId = null;
            return next();
        }

        if (!tenantId) {
            console.log('☣️ hit url: ', req.originalUrl);
            throw new ApiError(
                httpstatus.BAD_REQUEST,
                'Tenant ID is required in x-tenant-id header',
            );
        }
        const user = req.user as JwtPayload;
        const accessVerified = await verifyAccess(user, tenantId);
        if (!accessVerified) {
            throw new ApiError(
                httpstatus.FORBIDDEN,
                'You do not have access to this tenant',
            );
        }
        req.tenantId = tenantId; // Attach tenantId to the request object for downstream use

        next();
    } catch (err) {
        next(err);
    }
}

async function verifyAccess(user: JwtPayload, tenantId: string) {
    let accessVerified = false;
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
        accessVerified = true;
    } else if (user.role === UserRole.OWNER) {
        const tenant = await prisma.tenant.findFirst({
            where: {
                ownerID: user.userID,
                id: tenantId,
            },
        });
        if (tenant) {
            accessVerified = true;
        }
    } else if (user.role === UserRole.EMPLOYEE) {
        const tenant = await prisma.employee.findFirst({
            where: {
                userID: user.userID,
                tenantID: tenantId,
            },
        });
        if (tenant) {
            accessVerified = true;
        }
    }

    return accessVerified;
}

export { verifyTenantAccess };
