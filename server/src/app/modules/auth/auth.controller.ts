import { Request, Response } from 'express';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import { JWTHelper } from '../../../helpers/jwtHelpers';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ILoginUserResponse, IRefreshTokenResponse } from './auth.interface';
import { AuthService } from './auth.service';

function issueTokens(res: Response, accessToken: string, refreshToken?: string) {
    const cookieOptions = {
        secure: config.env === 'production',
        httpOnly: true,
        sameSite: 'lax' as const,
    };
    if (refreshToken) res.cookie('refreshToken', refreshToken, cookieOptions);
    res.cookie('accessToken', accessToken, cookieOptions);
}

const loginUser = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.loginUser(req.body);
    const { refreshToken, accessToken } = result;
    issueTokens(res, accessToken, refreshToken);

    const decoded = JWTHelper.verifyToken(
        accessToken,
        config.jwt.secret as Secret,
    ) as { userID: string; role: string };
    const me = await AuthService.getMe(decoded);

    sendResponse<any>(res, {
        statusCode: 200,
        success: true,
        message: 'User logged in successfully !',
        data: { accessToken, ...me },
    });
});

const registerUser = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.registerUser(req.body);
    const { refreshToken, accessToken, tenantId, shopId } = result;
    issueTokens(res, accessToken, refreshToken);
    sendResponse<any>(res, {
        statusCode: 201,
        success: true,
        message: 'Account created successfully',
        data: { accessToken, tenantId, shopId },
    });
});

const adminUserLogin = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.adminUserLogin(req.body);
    const { refreshToken, accessToken } = result;
    // set refresh token into cookie
    const cookieOptions = {
        secure: config.env === 'production',
        httpOnly: true,
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.cookie('accessToken', accessToken, cookieOptions);

    sendResponse<ILoginUserResponse>(res, {
        statusCode: 200,
        success: true,
        message: 'User logged in successfully !',
        data: {
            accessToken: result.accessToken,
        },
    });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.cookies;

    const result = await AuthService.refreshToken(refreshToken);

    sendResponse<IRefreshTokenResponse>(res, {
        statusCode: 200,
        success: true,
        message: 'User logged in successfully !',
        data: result,
    });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const { ...passwordData } = req.body;

    await AuthService.changePassword(user, passwordData);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: '',
        data: {
            status: 200,
            message: 'Password changed successfully!',
        },
    });
});

const forgotPass = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.forgotPass(req.body.number);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'check your phone for OTP',
        data: result,
    });
});

const checkOTP = catchAsync(async (req, res) => {
    const token = req.headers.authorization || '';
    const OTP = req.body.OTP;
    const result = await AuthService.checkOTP(token, OTP);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Set your new password',
        data: result,
    });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
    const token = req.headers.authorization || '';

    await AuthService.resetPassword(token, req.body.newPassword);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Account recovered!',
        data: {
            status: 200,
            message: 'Password Reset Successfully',
        },
    });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.getMe(req.user);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Your Information is fetched successfully',
        data: result,
    });
});

const getOTP = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.getOTP(req.body.number);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'OTP Sent Successfully',
        data: result,
    });
});

const appLogin = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.appLogin(req.body);
    const { refreshToken } = result;
    // set refresh token into cookie
    const cookieOptions = {
        secure: config.env === 'production',
        httpOnly: true,
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'User logged in successfully !',
        data: {
            accessToken: result.accessToken,
            isOtpVerified: result.isOtpVerified,
            isExists: result.isExists,
        },
    });
});

const logOutUser = catchAsync(async (req: Request, res: Response) => {
    const cookieOptions = {
        secure: config.env === 'production',
        httpOnly: true,
    };

    const { refreshToken } = req.cookies;
    await AuthService.logOutUser(refreshToken);

    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('accessToken', cookieOptions);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'User logged out successfully !',
        data: null,
    });
});

const setUserOTP = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.setUserOTP(req.body.number);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'OTP Set Successfully',
        data: result,
    });
});
export const AuthController = {
    loginUser,
    registerUser,
    refreshToken,
    changePassword,
    forgotPass,
    resetPassword,
    checkOTP,
    getMe,
    getOTP,
    appLogin,
    logOutUser,
    setUserOTP,
    adminUserLogin,
};
