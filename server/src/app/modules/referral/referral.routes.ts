import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { referralController } from './referral.controller';
import { referralValidation } from './referral.validation';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();
router.get(
    '/available-rewards',
    auth(UserRole.OWNER, UserRole.SALES_REPRESENTATIVE),
    verifyTenantAccess,
    referralController.getAllReferralRewards,
);

router.post(
    '/claim-reward/',
    auth(UserRole.OWNER, UserRole.SALES_REPRESENTATIVE),
    verifyTenantAccess,
    validateRequest(referralValidation.referralClaimSchema),
    referralController.claimReferralReward,
);

export const referralRouters = router;
