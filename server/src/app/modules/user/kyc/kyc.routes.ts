import express, { NextFunction, Request, Response } from 'express';
import validateRequest from '../../../middlewares/validateRequest';
import { FileUploadHelper } from '../../../../helpers/fileUploadHelper';
import { UserRole } from '@prisma/client';
import auth from '../../../middlewares/auth';
import { KycValidation } from './kyc.validations';
import { kycController } from './kyc.controller';

const router = express.Router();

router.post(
    '/submit-kyc',
    auth(
        UserRole.BUYER,
        UserRole.OWNER,
        UserRole.EMPLOYEE,
        UserRole.SALES_REPRESENTATIVE,
    ),
    FileUploadHelper.upload.fields([
        { name: 'documentFront', maxCount: 1 },
        { name: 'documentBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
    ]),
    (req, _, next) => {
        req.body = JSON.parse(req.body.data);
        next();
    },
    validateRequest(KycValidation.submitKYC),
    kycController.submitKYC,
);

router.get(
    '/kyc-status/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE, UserRole.ADMIN),
    kycController.getKYCStatus,
);

router.get(
    '/all-kyc-requests',
    auth(UserRole.ADMIN),
    kycController.getAllKYCRequests,
);

router.post(
    '/approve-kyc',
    auth(UserRole.ADMIN),
    validateRequest(KycValidation.kycApproval),
    kycController.approveKYC,
);

export const kycRoutes = router;
