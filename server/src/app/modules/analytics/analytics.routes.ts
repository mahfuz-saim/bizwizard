import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { analyticsController } from './analytics.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';
import { z } from 'zod';
import { navigationService } from './navigation.service';
import catchAsync from '../../../shared/catchAsync';
import { JwtPayload } from '../../../interfaces/common';

const router = express.Router();
const navigationSchema = z.object({
    params: z.object({ section: z.enum(['directories', 'transactions', 'expenses', 'reports']) }),
    query: z.object({ shopId: z.string().min(1), page: z.coerce.number().int().min(1).max(100000).default(1),
        search: z.string().max(200).default(''), type: z.enum(['all', 'sale', 'buy']).default('all'), variantId: z.string().min(1).optional() }),
});
router.get('/navigation/:section', auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess,
    validateRequest(navigationSchema), catchAsync(async (req, res) => {
        const { params, query } = navigationSchema.parse(req);
        const data = await navigationService.get(req.tenantId as string, params.section, query, (req.user as JwtPayload).role !== 'EMPLOYEE');
        res.json({ success: true, data });
    }));
router.get(
    '/dashboard',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getDashboard,
);

router.get(
    '/variant/:variantId/purchases',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getPurchasesByVariantId,
);

router.get(
    '/variant/:variantId/losses',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getLossesByVariantId,
);

router.get(
    '/variant/:variantId/financials',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getVariantFinancials,
);

router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getAnalytics,
);

router.get(
    '/not-sold',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getNotSoldProducts,
);

router.get(
    '/expired',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getExpiredProducts,
);

router.get(
    '/low-stock',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    analyticsController.getLowStockProducts,
);

export const analyticsRoutes = router;
