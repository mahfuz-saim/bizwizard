import express from 'express';
import { checkoutController } from './checkout.controller';
import validateRequest from '../../middlewares/validateRequest';
import { checkoutZodSchema } from './checkout.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/receipt/:id',
    validateRequest(checkoutZodSchema.getReciptByIdValidation),
    checkoutController.getReciptById,
);

router.get(
    '/sold-by/:userId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE, UserRole.ADMIN),
    verifyTenantAccess,
    checkoutController.getCheckOutByMe,
);

router.post(
    '/quick',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(checkoutZodSchema.createCheckoutValidation),
    checkoutController.createCheckout,
);
router.post(
    '/',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(checkoutZodSchema.createCheckoutValidation),
    checkoutController.createCheckout,
);
router.get(
    '/',
    auth(
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.EMPLOYEE,
        UserRole.OWNER,
    ),
    verifyTenantAccess,
    checkoutController.getCheckOut,
);
router.get(
    '/:id',
    auth(
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER,
        UserRole.EMPLOYEE,
    ),
    verifyTenantAccess,
    checkoutController.getCheckOutByID,
);

export const checkoutRoutes = router;
