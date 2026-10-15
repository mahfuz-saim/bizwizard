import express from 'express';
import { buyerController } from './buyer.controller';
import validateRequest from '../../middlewares/validateRequest';
import { buyerZodSchema } from './buyer.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.get(
    '/checkout/:buyerId',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    buyerController.getCheckoutByBuyerId,
);

router.get(
    '/shop-buyer/:shopId',
    auth(
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER,
        UserRole.EMPLOYEE,
    ),
    verifyTenantAccess,
    buyerController.getShopBuyer,
);

router.put(
    '/shop-buyer',
    validateRequest(buyerZodSchema.updateShopBuyer),
    auth(UserRole.ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    buyerController.updateShopBuyer,
);

router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    buyerController.getBuyer,
);

router.get(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    buyerController.getBuyerByID,
);

router.delete(
    '/shop-buyer/:id',
    auth(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    verifyTenantAccess,
    buyerController.deleteShopBuyer,
);

router.delete(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    buyerController.deleteBuyer,
);

router.put(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.BUYER),
    validateRequest(buyerZodSchema.updateBuyer),
    verifyTenantAccess,
    buyerController.updateBuyer,
);

router.post(
    '/add-buyer',
    auth(
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER,
        UserRole.EMPLOYEE,
    ),
    verifyTenantAccess,
    validateRequest(buyerZodSchema.addBuyer),
    buyerController.addBuyer,
);

export const buyerRoutes = router;
