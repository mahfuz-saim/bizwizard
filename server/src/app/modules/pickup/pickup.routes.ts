import express from 'express';
import { pickupController } from './pickup.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { pickupZodSchema } from './pickup.validation';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/',
    auth(UserRole.BUYER),
    verifyTenantAccess,
    validateRequest(pickupZodSchema.createPickupValidation),
    pickupController.createPickup,
);

router.get(
    '/',
    auth(UserRole.OWNER, UserRole.BUYER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    pickupController.getAllPickup,
);

router.get(
    '/:id',
    auth(UserRole.OWNER, UserRole.BUYER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    pickupController.getSinglePickup,
);

router.put(
    '/:id',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    pickupController.updatePickup,
);

router.delete(
    '/:id',
    auth(UserRole.OWNER, UserRole.EMPLOYEE, UserRole.BUYER),
    verifyTenantAccess,
    pickupController.deletePickup,
);

export const pickupRoutes = router;
