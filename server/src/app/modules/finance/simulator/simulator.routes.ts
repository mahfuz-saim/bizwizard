import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { simulatorController } from './simulator.controller';
import { simulatorValidation } from './simulator.validation';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER), verifyTenantAccess];

router.post('/prepare', ...guard, validateRequest(simulatorValidation.shopBody), simulatorController.prepare);
router.get('/workspace', ...guard, validateRequest(simulatorValidation.shopQuery), simulatorController.workspace);
router.post('/fast-forward', ...guard, validateRequest(simulatorValidation.fastForward), simulatorController.fastForward);
router.get('/inspect', ...guard, validateRequest(simulatorValidation.inspect), simulatorController.inspect);
router.post('/reset', ...guard, validateRequest(simulatorValidation.shopBody), simulatorController.reset);

export const simulatorRoutes = router;
