import exporess from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { debtController } from './debt.controller';
import validateRequest from '../../middlewares/validateRequest';
import { debtValidation } from './debt.validation';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = exporess.Router();

router.post(
    '/add-previous-debt',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(debtValidation.getUserDebtZodSchema),
    debtController.addPreviousDebt,
);
router.get(
    '/all/:shopId',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    debtController.getAllDebt,
);

router.get(
    '/details/:debtId',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    debtController.getSingleDebt,
);

router.post(
    '/user',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(debtValidation.getUserDebtZodSchema),
    debtController.getUserDebt,
);

router.post(
    '/resolve',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(debtValidation.singleDebtResolveSchema),
    debtController.resolveSingleDebt,
);

router.post(
    '/bulk-resolve',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(debtValidation.bulkDebtResolveSchema),
    debtController.resolveBulkDebt,
);

router.get(
    '/ledger/:shopId/:buyerId',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    debtController.getBuyerLedger,
);

export const debtRoutes = router;

//TODO: handle small discrepencies
