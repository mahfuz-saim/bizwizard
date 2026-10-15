import express from 'express';
import { MetaController } from './meta.controller';
import auth from '../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../enums/user';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN),
    MetaController.fetchDashboardMetadata,
);

export const MetaRoutes = router;
