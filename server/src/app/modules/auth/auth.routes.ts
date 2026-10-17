import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

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
export const AuthRoutes = router;
