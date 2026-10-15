import exporess from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { draftOrderController } from './draftOrder.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = exporess.Router();

router.get(
    '/shop/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    draftOrderController.getAllDraftOrder,
);

router.get(
    '/:orderId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    draftOrderController.getSingleDraftOrder,
);

router.delete(
    '/:orderId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    draftOrderController.deleteDraftOrder,
);
router.get(
    '/count/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    draftOrderController.getDraftCount,
);

export const draftOrderRoutes = router;

//TODO: Resource Access Validation middleware
