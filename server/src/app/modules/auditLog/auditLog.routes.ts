import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { AuditLogController } from './auditLog.controller';

const router = express.Router();

router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    AuditLogController.getAuditLog,
);

export const auditRoutes = router;
