import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { analyticsController } from './analytics.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();
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
