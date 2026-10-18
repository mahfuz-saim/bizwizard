import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';
import { cashflowController } from './cashflow.controller';
import { cashflowValidation } from './cashflow.validation';
import { verifyFinanceShopAccess } from '../../../middlewares/verifyFinanceShopAccess';

const router = express.Router();
const guard = [auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE), verifyTenantAccess, verifyFinanceShopAccess];
const ownerGuard = [auth(UserRole.ADMIN, UserRole.OWNER), verifyTenantAccess];

router.get('/accounts', ...guard, validateRequest(cashflowValidation.shopQuery), cashflowController.listAccounts);
router.post('/accounts', ...ownerGuard, validateRequest(cashflowValidation.createAccount), cashflowController.createAccount);
router.get('/transactions', ...guard, validateRequest(cashflowValidation.listTransactions), cashflowController.listTransactions);
router.post('/transactions', ...ownerGuard, validateRequest(cashflowValidation.createTransaction), cashflowController.createTransaction);
router.post('/transactions/:id/recategorize', ...ownerGuard, validateRequest(cashflowValidation.idAction), cashflowController.recategorize);
router.get('/commitments', ...guard, validateRequest(cashflowValidation.shopQuery), cashflowController.listCommitments);
router.post('/commitments', ...ownerGuard, validateRequest(cashflowValidation.createCommitment), cashflowController.createCommitment);
router.post('/commitments/:id/settle', ...ownerGuard, validateRequest(cashflowValidation.settleCommitment), cashflowController.settleCommitment);
router.post('/extract-commitment', ...ownerGuard, validateRequest(cashflowValidation.extractCommitment), cashflowController.extractCommitment);
router.get('/projection', ...guard, validateRequest(cashflowValidation.projection), cashflowController.getProjection);
router.post('/run', ...ownerGuard, validateRequest(cashflowValidation.backfill), cashflowController.runTreasury);
router.get('/alerts', ...guard, validateRequest(cashflowValidation.shopQuery), cashflowController.listAlerts);
router.post('/alerts/:id/ack', ...guard, validateRequest(cashflowValidation.alertStatus), cashflowController.ackAlert);
router.post('/alerts/:id/execute', ...ownerGuard, validateRequest(cashflowValidation.alertRecommendation), cashflowController.executeAlert);
router.get('/treasury-actions', ...guard, validateRequest(cashflowValidation.shopQuery), cashflowController.listTreasuryActions);
router.get('/treasury-actions/:id/evidence', ...ownerGuard, validateRequest(cashflowValidation.shopQuery), cashflowController.collectionEvidence);
router.post('/treasury-actions/:id/evidence', ...ownerGuard, validateRequest(cashflowValidation.collectionEvidence), cashflowController.recordCollection);
router.post('/treasury-actions/:id/approve', ...ownerGuard, validateRequest(cashflowValidation.idAction), cashflowController.approveAction);
router.post('/treasury-actions/:id/reject', ...ownerGuard, validateRequest(cashflowValidation.idAction), cashflowController.rejectAction);
router.post('/backfill', ...ownerGuard, validateRequest(cashflowValidation.backfill), cashflowController.backfill);

export const cashflowRoutes = router;
