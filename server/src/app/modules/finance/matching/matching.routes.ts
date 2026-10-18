import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { matchingController } from './matching.controller';
import { matchingValidation } from './matching.validation';
import { verifyFinanceShopAccess } from '../../../middlewares/verifyFinanceShopAccess';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess, verifyFinanceShopAccess];
const ownerGuard = [auth(UserRole.ADMIN, UserRole.OWNER), verifyTenantAccess];

router.get('/profile', ...guard, validateRequest(matchingValidation.profile), matchingController.getProfile);
router.get('/providers', ...guard, matchingController.listProviders);
router.post('/market', ...ownerGuard, validateRequest(matchingValidation.createMarket), matchingController.createMarket);
router.post('/run', ...ownerGuard, validateRequest(matchingValidation.run), matchingController.runMatching);
router.get('/results', ...guard, validateRequest(matchingValidation.results), matchingController.getResults);
router.post('/offers/:id/negotiate', ...ownerGuard, validateRequest(matchingValidation.offerAction), matchingController.negotiate);
router.post('/offers/:id/accept', ...ownerGuard, validateRequest(matchingValidation.accept), matchingController.accept);
router.post('/offers/:id/reject', ...ownerGuard, validateRequest(matchingValidation.offerAction), matchingController.reject);
router.get('/applications', ...guard, validateRequest(matchingValidation.applications), matchingController.listApplications);

export const matchingRoutes = router;
