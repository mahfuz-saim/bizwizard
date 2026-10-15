import express from 'express';
import { shopController } from './shop.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { shopValidation } from './shop.validation';
import { tagRoutes } from './tag/tag.routes';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.use('/tag', tagRoutes);
router.post(
    '/config',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(shopValidation.configSchema),
    shopController.createShopConfig,
);
router.get(
    '/config/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    shopController.getShopConfig,
);
router.get('/all-category', shopController.getAllCategory);
router.post(
    '/',
    auth(UserRole.OWNER),
    validateRequest(shopValidation.createShopZodSchema),
    shopController.createShop,
);
router.get(
    '/',
    auth(UserRole.OWNER, UserRole.ADMIN),
    shopController.getAllShop,
);

// Admin-only: resolve a tenant to its shop(s) + owner + active subscription.
// Global route (no x-tenant-id required) — used by the admin dashboard's
// store-scope shell to validate the tenant id present in the URL.
router.get(
    '/admin/tenant/:tenantId',
    auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    shopController.getShopsByTenant,
);

router.get(
    '/employee-requests/:shopId',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    shopController.getEmployeeRequests,
);
router.post(
    '/employee-requests',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(shopValidation.employeeRequestUpdate),
    shopController.updateEmployeeRequest,
);

router.get(
    '/get-info/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    shopController.getShopInfo,
);

router.get('/verify-code/:shopCode', shopController.verifyShopCode);

router.get('/get-all-plans', shopController.getAllPlans);

router.get(
    '/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE, UserRole.ADMIN),
    verifyTenantAccess,
    shopController.getProductInShop,
);

router.get(
    '/all-lot/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE, UserRole.ADMIN),
    verifyTenantAccess,
    shopController.getAllLotInShop,
);

router.delete(
    '/:id',
    auth(UserRole.OWNER, UserRole.ADMIN),
    verifyTenantAccess,
    shopController.deleteShop,
);
router.put(
    '/:id',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(shopValidation.updateShopZodSchema),
    shopController.updateShop,
);
export const shopRoutes = router;

//TODO: implement middleware to check if user owns shop
