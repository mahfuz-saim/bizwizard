import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { subscriptionController } from './subscriptions.controller';
import { subscriptionValidation } from './subscriptions.validation';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

//TODO: access validation middleware
router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.OWNER),
    subscriptionController.getAllSubscriptionPlans,
);

router.get(
    '/:shopId',
    auth(UserRole.ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    subscriptionController.getSubscriptionByShopId,
);

router.post(
    '/shop',
    auth(UserRole.ADMIN),
    validateRequest(subscriptionValidation.createSubscriptionZodSchema),
    subscriptionController.addSubscriptionPlan,
);

router.post(
    '/employee',
    auth(UserRole.ADMIN),
    validateRequest(subscriptionValidation.createEmployeeZodSchema),
    subscriptionController.addEmployeePlan,
);

router.delete(
    '/',
    auth(UserRole.ADMIN),
    validateRequest(subscriptionValidation.deletePlanZodSchema),
    subscriptionController.deletePlan,
);

export const subscriptionRoutes = router;
