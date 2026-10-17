import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { simulatorController } from './simulator.controller';
import { simulatorValidation } from './simulator.validation';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess];

// Judge-facing demo tool for the SME Finance Copilot: plays 30 fabricated-but-real
// business days into the owner's currently open shop in one fast transaction, then
// re-runs the real deterministic pipeline (cashEngine, alerts, guard, verifier,
// agent scorecards) on top of it. See server/docs/FINANCE_COPILOT.md.
router.post('/fast-forward', ...guard, validateRequest(simulatorValidation.fastForward), simulatorController.fastForward);
router.get('/inspect', ...guard, validateRequest(simulatorValidation.inspect), simulatorController.inspect);
router.post('/reset', ...guard, validateRequest(simulatorValidation.shopBody), simulatorController.reset);

export const simulatorRoutes = router;
