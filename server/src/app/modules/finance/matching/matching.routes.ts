import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { matchingController } from './matching.controller';
import { matchingValidation } from './matching.validation';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess];

router.get('/profile', ...guard, validateRequest(matchingValidation.profile), matchingController.getProfile);
router.get('/providers', ...guard, matchingController.listProviders);
router.post('/market', ...guard, validateRequest(matchingValidation.createMarket), matchingController.createMarket);
router.post('/run', ...guard, validateRequest(matchingValidation.run), matchingController.runMatching);
router.get('/results', ...guard, validateRequest(matchingValidation.results), matchingController.getResults);
router.post('/offers/:id/negotiate', ...guard, validateRequest(matchingValidation.offerAction), matchingController.negotiate);
router.post('/offers/:id/accept', ...guard, validateRequest(matchingValidation.accept), matchingController.accept);
router.post('/offers/:id/reject', ...guard, validateRequest(matchingValidation.offerAction), matchingController.reject);
router.get('/applications', ...guard, validateRequest(matchingValidation.applications), matchingController.listApplications);

export const matchingRoutes = router;
