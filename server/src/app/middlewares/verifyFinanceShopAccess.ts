import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import prisma from '../../shared/prisma';
import ApiError from '../../errors/ApiError';

export async function verifyFinanceShopAccess(req: Request, _res: Response, next: NextFunction) {
    try {
        if (req.user?.role === UserRole.EMPLOYEE) {
            const shopID = req.query.shopId ?? req.body?.shopId;
            if (shopID) {
                const employee = await prisma.employee.findFirst({ where: {
                    userID: req.user.userID, tenantID: req.tenantId!, shopID: String(shopID), isDeleted: false,
                }, select: { id: true } });
                if (!employee) throw new ApiError(403, 'You do not have access to this shop');
            }
        }
        next();
    } catch (error) { next(error); }
}
