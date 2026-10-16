import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { userRoutes } from '../user/user.routes';

const router = express.Router();

router.post(
    '/set-otp-admin',
    validateRequest(AuthValidation.setUserOTPZodSchema),
    auth(UserRole.ADMIN),
    AuthController.setUserOTP,
);

router.post(
    '/admin-login',
    validateRequest(AuthValidation.loginZodSchema),
    AuthController.adminUserLogin,
);
router.post(
    '/login',
    validateRequest(AuthValidation.loginZodSchema),
    AuthController.loginUser,
);

router.post(
    '/register',
    validateRequest(AuthValidation.registerZodSchema),
    AuthController.registerUser,
);

router.post('/logout', AuthController.logOutUser);

router.post(
    '/refresh-token',
    validateRequest(AuthValidation.refreshTokenZodSchema),
    AuthController.refreshToken,
);

router.post(
    '/change-password',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE, UserRole.BUYER),
    validateRequest(AuthValidation.changePasswordZodSchema),
    AuthController.changePassword,
);

router.get(
    '/me',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE, UserRole.BUYER),
    AuthController.getMe,
);
router.post(
    '/forget-password',
    validateRequest(AuthValidation.forgetPasswordZodSchema),
    AuthController.forgotPass,
);
router.post(
    '/check-otp',
    validateRequest(AuthValidation.checkOTPZodSchema),
    AuthController.checkOTP,
);

router.post(
    '/reset-password',
    validateRequest(AuthValidation.resetPasswordZodSchema),
    AuthController.resetPassword,
);

router.post(
    '/get-otp',
    validateRequest(AuthValidation.getOTPZodSchema),
    AuthController.getOTP,
);

router.post(
    '/app-login',
    validateRequest(AuthValidation.appLoginZodSchema),
    AuthController.appLogin,
);

export const AuthRoutes = router;
