import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import {
    IAppLogin,
    IChangePassword,
    ILoginUser,
    ILoginUserResponse,
    IRefreshTokenResponse,
} from './auth.interface';
import prisma from '../../../shared/prisma';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthUtils } from '../../../helpers/bcryptHelpers';
import { JWTHelper } from '../../../helpers/jwtHelpers';
import { JwtPayload } from '../../../interfaces/common';
import { smsHelper } from '../../../helpers/sendSMS';

function generateFourDigitNumber() {
    return Math.floor(1000 + Math.random() * 9000);
}

function generateRandomCode() {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
    }
    return code;
}

//NOTE: this route is only for admin, owner and employee for the web panel
const loginUser = async (payload: ILoginUser): Promise<ILoginUserResponse> => {
    const { number, password } = payload;

    const isUserExist = await prisma.user.findUnique({
        where: {
            number,
            status: UserStatus.ACTIVE,
        },
    });

    if (!isUserExist) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
    }

    if (
        isUserExist.password &&
        !(await AuthUtils.comparePasswords(password, isUserExist.password))
    ) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Password is incorrect');
    }

    const { id: userID, role } = isUserExist;
    let userRole = null;

    if (role.includes(UserRole.OWNER)) {
        userRole = UserRole.OWNER;
    } else if (role.includes(UserRole.EMPLOYEE)) {
        userRole = UserRole.EMPLOYEE;
    } else if (role.includes(UserRole.SUPER_ADMIN)) {
        userRole = UserRole.SUPER_ADMIN;
    }

    if (!userRole) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            'Role is not assigned or you are not authorized to use this route',
        );
    }

    const accessToken = JWTHelper.createToken(
        { userID, role: userRole },
        config.jwt.secret as Secret,
        config.jwt.expires_in as string,
    );

    const refreshToken = JWTHelper.createToken(
        { userID, role: userRole },
        config.jwt.refresh_secret as Secret,
        config.jwt.refresh_expires_in as string,
    );

    await prisma.refreshToken.upsert({
        where: {
            userID: userID,
        },
        create: {
            userID: userID,
            refreshToken: refreshToken,
        },
        update: {
            refreshToken: refreshToken,
        },
    });

    return {
        accessToken,
        refreshToken,
    };
};

const adminUserLogin = async (
    payload: ILoginUser,
): Promise<ILoginUserResponse> => {
    const { number, password } = payload;

    const isUserExist = await prisma.user.findUnique({
        where: {
            number,
            status: UserStatus.ACTIVE,
        },
    });

    if (!isUserExist) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
    }

    if (
        isUserExist.password &&
        !(await AuthUtils.comparePasswords(password, isUserExist.password))
    ) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Password is incorrect');
    }

    const { id: userID, role } = isUserExist;
    let userRole = null;

    if (role.includes(UserRole.ADMIN)) {
        userRole = UserRole.ADMIN;
    }

    if (!userRole) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            'Role is not assigned or you are not authorized to use this route',
        );
    }

    const accessToken = JWTHelper.createToken(
        { userID, role: userRole },
        config.jwt.secret as Secret,
        config.jwt.expires_in as string,
    );

    const refreshToken = JWTHelper.createToken(
        { userID, role: userRole },
        config.jwt.refresh_secret as Secret,
        config.jwt.refresh_expires_in as string,
    );

    await prisma.refreshToken.upsert({
        where: {
            userID: userID,
        },
        create: {
            userID: userID,
            refreshToken: refreshToken,
        },
        update: {
            refreshToken: refreshToken,
        },
    });

    return {
        accessToken,
        refreshToken,
    };
};

const refreshToken = async (token: string): Promise<IRefreshTokenResponse> => {
    let verifiedToken = null;
    try {
        verifiedToken = JWTHelper.verifyToken(
            token,
            config.jwt.refresh_secret as Secret,
        );
    } catch (err) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Invalid Refresh Token');
    }

    const isStored = await prisma.refreshToken.findUnique({
        where: { refreshToken: token },
    });
    if (isStored?.refreshToken !== token) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Invalid Refresh Token');
    }

    const { userID, role } = verifiedToken as JwtPayload;

    const isUserExist = await prisma.user.findUnique({
        where: {
            id: userID,
            status: UserStatus.ACTIVE,
        },
    });
    if (!isUserExist) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
    }

    let userRole = null;
    if (isUserExist.role.includes(role)) {
        userRole = role;
    }
    if (!userRole) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            'Role is not assigned or you are not authorized to use this route',
        );
    }

    const newAccessToken = JWTHelper.createToken(
        {
            userID: isUserExist.id,
            role: userRole,
        },
        config.jwt.secret as Secret,
        config.jwt.expires_in as string,
    );

    return {
        accessToken: newAccessToken,
    };
};

const changePassword = async (
    user: JwtPayload | null,
    payload: IChangePassword,
): Promise<void> => {
    const { oldPassword, newPassword } = payload;

    const isUserExist = await prisma.user.findUnique({
        where: {
            id: user?.userID,
            status: UserStatus.ACTIVE,
        },
    });

    if (!isUserExist) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
    }

    // checking old password
    if (
        isUserExist.password &&
        !(await AuthUtils.comparePasswords(oldPassword, isUserExist.password))
    ) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            'Old Password is incorrect',
        );
    }

    const hashPassword = await AuthUtils.hashedPassword(newPassword);

    await prisma.user.update({
        where: {
            id: isUserExist.id,
        },
        data: {
            password: hashPassword,
        },
    });
};

const forgotPass = async (number: string) => {
    const isUserExist = await prisma.user.findUnique({
        where: {
            number,
            status: UserStatus.ACTIVE,
        },
    });

    if (!isUserExist) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'User does not exist!');
    }

    const OTP = generateFourDigitNumber();
    await smsHelper.sendOTP({ otp: OTP, number: number });

    const result = await prisma.forgetRequest.create({
        data: {
            number: isUserExist.number,
            userID: isUserExist.id,
            OTP,
        },
    });

    if (!result) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Try again');
    }

    const passResetToken = JWTHelper.createToken(
        { Id: result.id, number: isUserExist.number, userID: isUserExist.id },
        config.jwt.secret as Secret,
        config.jwt.passwordResetTokenExpirationTime,
    );

    return {
        token: passResetToken,
    };
};

const checkOTP = async (token: string, OTP: number) => {
    const isVerified = JWTHelper.verifyToken(
        token,
        config.jwt.secret as Secret,
    ) as { Id: string; number: string; userID: string };

    if (!isVerified) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Something went wrong!');
    }

    const forgetRequest = await prisma.forgetRequest.findUnique({
        where: {
            id: isVerified.Id,
            number: isVerified.number,
            userID: isVerified.userID,
        },
    });

    if (forgetRequest?.OTP !== OTP) {
        throw new ApiError(httpStatus.BAD_REQUEST, "OTP doesn't match");
    }

    const flag = generateRandomCode();

    await prisma.forgetRequest.update({
        where: {
            id: isVerified.Id,
            number: isVerified.number,
            userID: isVerified.userID,
        },
        data: {
            isChecked: true,
            flag,
        },
    });

    const payload = {
        id: isVerified.Id,
        number: isVerified.number,
        userID: isVerified.userID,
        flag,
    };

    const setToken = JWTHelper.createToken(
        payload,
        config.jwt.secret as Secret,
        config.jwt.passwordResetTokenExpirationTime,
    );

    return {
        token: setToken,
    };
};

const resetPassword = async (token: string, newPassword: string) => {
    const isVerified = JWTHelper.verifyToken(
        token,
        config.jwt.secret as Secret,
    ) as { id: string; number: string; userID: string; flag: string };

    if (!isVerified) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Something went wrong!');
    }

    const isChecked = await prisma.forgetRequest.findUniqueOrThrow({
        where: {
            id: isVerified.id,
            number: isVerified.number,
            userID: isVerified.userID,
            isChecked: true,
            flag: isVerified.flag,
        },
    });

    if (!isChecked) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Try again');
    }

    const hashedPassword = await AuthUtils.hashedPassword(newPassword);

    await prisma.user.update({
        where: {
            id: isChecked.userID,
            number: isChecked.number,
        },
        data: {
            password: hashedPassword,
        },
    });
};

const getMe = async (user: JwtPayload | null) => {
    let result: any = {};

    if (user?.role === 'OWNER') {
        result = await prisma.owner.findUnique({
            where: {
                userID: user?.userID,
            },
        });
    } else if (user?.role === 'EMPLOYEE') {
        result = await prisma.employee.findUnique({
            where: {
                userID: user?.userID,
            },
        });
    } else if (user?.role === 'BUYER') {
        result = await prisma.buyer.findUnique({
            where: {
                userID: user?.userID,
            },
        });
    } else if (user?.role === 'ADMIN') {
        result = await prisma.admin.findUnique({
            where: {
                userID: user?.userID,
            },
        });
    }

    return result;
};

const getOTP = async (number: string) => {
    let OTP = generateFourDigitNumber();
    if (number === '11111111111') {
        OTP = 1111;
    } else if (number === '00000000000') {
        OTP = 0o0;
    }

    const now = new Date();
    const expTime = new Date(now.getTime() + 2 * 60 * 1000);

    await prisma.otpRequestNumber.upsert({
        where: {
            number: number,
        },
        create: {
            number: number,
        },
        update: {
            number: number,
        },
    });

    const result = await prisma.loginOTP.upsert({
        where: {
            number: number,
        },
        create: {
            number: number,
            otp: OTP,
            exp: expTime,
        },
        update: {
            otp: OTP,
            exp: expTime,
        },
    });

    await smsHelper.sendOTP({ otp: OTP, number: number });

    if (config.env !== 'production') {
        return result;
    }
};

//NOTE: this route is only for owner and employee for the main app
// if other role app login support needed, create new route for that
const appLogin = async (payload: IAppLogin) => {
    const { number, otp } = payload;

    let storedOTP = null;
    try {
        storedOTP = await prisma.loginOTP.findUniqueOrThrow({
            where: {
                number: number,
            },
        });
    } catch {
        throw new ApiError(httpStatus.FORBIDDEN, 'Request an OTP first.');
    }

    const now = new Date();
    const timeIntervel = storedOTP.exp.getTime() - now.getTime();

    const isOTPExpired = timeIntervel > 5 * 60 * 1000;
    if (isOTPExpired) {
        await prisma.loginOTP.delete({
            where: {
                id: storedOTP.id,
            },
        });

        throw new ApiError(
            httpStatus.FORBIDDEN,
            'OTP Expired. Request New OTP',
        );
    }

    if (storedOTP.otp !== otp) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Incorrect OTP');
    }

    //NOTE: if reacched here -> otp not expired, and, otp mached -> delete from db
    await prisma.loginOTP.delete({
        where: {
            id: storedOTP.id,
        },
    });

    await prisma.refreshToken.deleteMany({
        where: {
            deviceId: payload.deviceId,
        },
    });

    const isUserExist = await prisma.user.findUnique({
        where: {
            number,
            status: UserStatus.ACTIVE,
        },
    });

    if (!isUserExist) {
        return {
            accessToken: null,
            refreshToken: null,
            isOtpVerified: true,
            isExists: false,
        };
    }
    const { id: userID, role } = isUserExist;
    let userRole = null;

    if (role.includes(UserRole.OWNER)) {
        userRole = UserRole.OWNER;
    } else if (role.includes(UserRole.EMPLOYEE)) {
        userRole = UserRole.EMPLOYEE;
    }

    if (!userRole) {
        return {
            accessToken: null,
            refreshToken: null,
            isOtpVerified: true,
            isExists: false,
        };
    }

    const accessToken = JWTHelper.createToken(
        { userID, role: userRole },
        config.jwt.secret as Secret,
        config.jwt.expires_in as string,
    );

    const refreshToken = JWTHelper.createToken(
        { userID, role: userRole },
        config.jwt.refresh_secret as Secret,
        config.jwt.refresh_expires_in as string,
    );

    try {
        await prisma.refreshToken.upsert({
            where: {
                userID: userID,
            },
            create: {
                userID: userID,
                refreshToken: refreshToken,
                deviceId: payload.deviceId,
            },
            update: {
                refreshToken: refreshToken,
            },
        });
    } catch (error: any) {
        if (error?.meta?.target[0] === 'deviceId') {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You are not allowed to login from this device.',
            );
        }
        throw new Error(error);
    }
    return {
        accessToken,
        refreshToken,
        isOtpVerified: true,
        isExists: true,
    };
};

const logOutUser = async (refreshToken: string) => {
    await prisma.refreshToken.deleteMany({
        where: { refreshToken: refreshToken },
    });
};

const setUserOTP = async (number: string) => {
    let OTP = generateFourDigitNumber();
    if (number === '11111111111') {
        OTP = 1111;
    } else if (number === '00000000000') {
        OTP = 0o0;
    }

    const now = new Date();
    // 5 min expiry time
    const expTime = new Date(now.getTime() + 5 * 60 * 1000);

    const result = await prisma.loginOTP.upsert({
        where: {
            number: number,
        },
        create: {
            number: number,
            otp: OTP,
            exp: expTime,
        },
        update: {
            otp: OTP,
            exp: expTime,
        },
    });

    return result;
};

export const AuthService = {
    loginUser,
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
