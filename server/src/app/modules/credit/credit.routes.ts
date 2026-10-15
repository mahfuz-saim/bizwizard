import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { creditZodSchema } from './credit.validation';
import { creditController } from './credit.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.get(
    '/',
    auth(UserRole.ADMIN),
    verifyTenantAccess,
    creditController.getAllCredit,
);

export const creditRoutes = router;
