import express, { NextFunction, Request, Response } from 'express';
import { salesRepresentativeController } from './saleRepresentative.controller';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import validateRequest from '../../middlewares/validateRequest';
import { salesRepresentativeValidation } from './saleRepresentative.validation';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    salesRepresentativeController.getAllSalesRepresentatives,
);
router.get(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    salesRepresentativeController.getSalesRepresentativeByID,
);
router.get(
    '/referral/:referralCode',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    salesRepresentativeController.getSalesRepresentativeByReferralCode,
);
router.delete(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    salesRepresentativeController.deleteSalesRepresentative,
);
router.put(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    FileUploadHelper.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = JSON.parse(req.body.data);
        next();
    },
    validateRequest(salesRepresentativeValidation.updateSalesRepresentative),
    salesRepresentativeController.updateSalesRepresentative,
);

export const salesRepresentativeRoutes = router;
