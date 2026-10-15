import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { notificationZodSchema } from './notification.validation';
import { notificationController } from './notification.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/register-device',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    (req, res, next) => {
        if (req.body?.shopId) {
            return verifyTenantAccess(req, res, next);
        }
        return next();
    },
    validateRequest(notificationZodSchema.deviceRegisterSchema),
    notificationController.registerDevice,
);

router.post(
    '/',
    auth(UserRole.ADMIN),
    validateRequest(notificationZodSchema.notificationValidationSchema),
    notificationController.sendNotification,
);

router.get(
    '/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    notificationController.getNotifications,
);

router.post(
    '/mark-read/:notificationId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    notificationController.markNotificationAsRead,
);
export const notificationRoutes = router;
