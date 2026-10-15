import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { appVersionController } from './appVersion.controller';
import { appVersionZodSchema } from './appVersion.validation';

const router = express.Router();

router.get('/:appType', appVersionController.getAppVersion);

router.post(
    '/',
    auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    validateRequest(appVersionZodSchema.appVersionSchema),
    appVersionController.createAppVersion,
);

export const appVersionRoutes = router;
