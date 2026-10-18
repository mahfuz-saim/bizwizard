import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { analysisController } from './analysis.controller';
import { analysisValidation } from './analysis.validation';
import { verifyFinanceShopAccess } from '../../../middlewares/verifyFinanceShopAccess';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess, verifyFinanceShopAccess];
const ownerGuard = [auth(UserRole.ADMIN, UserRole.OWNER), verifyTenantAccess];

router.get('/metrics', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getMetrics);
router.get('/product-economics', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getProductEconomics);
router.get('/working-capital', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getWorkingCapital);
router.get('/breakeven', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getBreakeven);
router.get('/concentration', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getConcentration);
router.get('/insights', ...guard, validateRequest(analysisValidation.insights), analysisController.listInsights);
router.post('/insights/generate', ...ownerGuard, validateRequest(analysisValidation.generate), analysisController.generateInsights);
router.post('/insights/:id/verify', ...ownerGuard, validateRequest(analysisValidation.idAction), analysisController.verifyInsight);
router.post('/insights/:id/dismiss', ...ownerGuard, validateRequest(analysisValidation.idAction), analysisController.dismissInsight);
router.post('/scenarios', ...ownerGuard, validateRequest(analysisValidation.createScenario), analysisController.createScenario);
router.get('/scenarios', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.listScenarios);
router.post('/scenarios/:id/recommend', ...ownerGuard, validateRequest(analysisValidation.idAction), analysisController.recommendScenario);
router.get('/forecast', ...guard, validateRequest(analysisValidation.forecast), analysisController.getForecast);
router.post('/capital-decisions', ...ownerGuard, validateRequest(analysisValidation.createCapitalDecision), analysisController.createCapitalDecision);
router.get('/capital-decisions', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.listCapitalDecisions);
router.post('/capital-decisions/:id/approve', ...ownerGuard, validateRequest(analysisValidation.idAction), analysisController.approveCapitalDecision);
router.post('/capital-decisions/:id/measure', ...ownerGuard, validateRequest(analysisValidation.idAction), analysisController.measureCapitalDecision);
router.get('/report', ...guard, validateRequest(analysisValidation.shopQuery), analysisController.getReport);

export const analysisRoutes = router;
