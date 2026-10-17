import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { analysisController } from './analysis.controller';
import { analysisValidation } from './analysis.validation';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess];

router.get('/metrics', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getMetrics);
router.get('/product-economics', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getProductEconomics);
router.get('/working-capital', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getWorkingCapital);
router.get('/breakeven', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getBreakeven);
router.get('/concentration', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getConcentration);
router.get('/insights', ...guard, validateRequest(analysisValidation.insights), analysisController.listInsights);
router.post('/insights/generate', ...guard, validateRequest(analysisValidation.generate), analysisController.generateInsights);
router.post('/insights/:id/verify', ...guard, analysisController.verifyInsight);
router.post('/insights/:id/dismiss', ...guard, analysisController.dismissInsight);
router.post('/scenarios', ...guard, validateRequest(analysisValidation.createScenario), analysisController.createScenario);
router.get('/scenarios', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.listScenarios);
router.post('/scenarios/:id/recommend', ...guard, analysisController.recommendScenario);
router.get('/forecast', ...guard, validateRequest(analysisValidation.forecast), analysisController.getForecast);
router.post('/capital-decisions', ...guard, validateRequest(analysisValidation.createCapitalDecision), analysisController.createCapitalDecision);
router.get('/capital-decisions', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.listCapitalDecisions);
router.post('/capital-decisions/:id/approve', ...guard, analysisController.approveCapitalDecision);
router.get('/report', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getReport);

export const analysisRoutes = router;
