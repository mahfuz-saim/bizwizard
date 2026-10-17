import express, { NextFunction, Request, Response } from 'express';
import { UserController } from './user.controller';
import validateRequest from '../../middlewares/validateRequest';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import { UserValidation } from './user.validations';
import { kycRoutes } from './kyc/kyc.routes';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.use('/kyc', kycRoutes);
router.get('/', auth(UserRole.ADMIN), UserController.getAllUser);
router.get(
    '/profile',
    auth(
        UserRole.ADMIN,
        UserRole.EMPLOYEE,
        UserRole.OWNER,
        UserRole.SUPPLIER,
        UserRole.SALES_REPRESENTATIVE,
        UserRole.BUYER,
    ),
    UserController.getProfile,
);

router.post(
    '/create-admin',
    auth(UserRole.SUPER_ADMIN),
    FileUploadHelper.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = JSON.parse(req.body.data);
        next();
    },
    validateRequest(UserValidation.createAdmin),
    UserController.createAdmin,
);

router.post(
    '/create-sale',
    FileUploadHelper.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = JSON.parse(req.body.data);
        next();
    },
    validateRequest(UserValidation.createSale),
    UserController.createSale,
);

router.post(
    '/create-buyer',
    validateRequest(UserValidation.createBuyer),
    UserController.createBuyer,
);

router.post(
    '/create-employee',
    validateRequest(UserValidation.createEmployee),
    UserController.createEmployee,
);

router.post(
    '/create-user',
    validateRequest(UserValidation.createUser),
    UserController.createUser,
);

router.get('/verify-referral/:referralCode', UserController.verifyReferral);

router.post(
    '/create-supplier',
    validateRequest(UserValidation.createSupplier),
    UserController.createSupplier,
);

export const userRoutes = router;
