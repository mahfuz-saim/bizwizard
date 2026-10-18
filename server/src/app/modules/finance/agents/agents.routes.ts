import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { agentsController } from './agents.controller';
import { agentsValidation } from './agents.validation';
import { verifyFinanceShopAccess } from '../../../middlewares/verifyFinanceShopAccess';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess, verifyFinanceShopAccess];

router.get('/policies', ...guard, validateRequest(agentsValidation.shopQuery), agentsController.listPolicies);
router.patch('/policies/:id', auth(UserRole.ADMIN, UserRole.OWNER), verifyTenantAccess, validateRequest(agentsValidation.updatePolicy), agentsController.updatePolicy);
router.get('/decisions', ...guard, validateRequest(agentsValidation.decisions), agentsController.listDecisions);
router.get('/runs', ...guard, validateRequest(agentsValidation.shopQuery), agentsController.listRuns);
router.get('/performance', ...guard, validateRequest(agentsValidation.shopQuery), agentsController.performance);
router.get('/audit-export', ...guard, validateRequest(agentsValidation.shopQuery), agentsController.auditExport);

export const agentsRoutes = router;
