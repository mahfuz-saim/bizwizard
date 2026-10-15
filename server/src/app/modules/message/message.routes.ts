import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { MessageValidation } from './message.validation';
import { messageController } from './message.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(MessageValidation.messageSchema),
    messageController.sendMessage,
);

// Approval is tenant-scoped: the controller/service read `req.tenantId`, which
// is only populated by verifyTenantAccess. Without it every approval failed
// with "Tenant ID is required".
router.put(
    '/',
    auth(UserRole.ADMIN),
    verifyTenantAccess,
    validateRequest(MessageValidation.messageApprveSchema),
    messageController.updateMessage,
);

router.delete(
    '/:id',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    messageController.deleteMessage,
);

router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    messageController.getAllMessages,
);

router.get(
    '/:msgId',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    messageController.getSingleMessage,
);

export const messageRoutes = router;
