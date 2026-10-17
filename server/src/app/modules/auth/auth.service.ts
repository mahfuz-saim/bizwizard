import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import {
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

//NOTE: this route is only for admin, owner and employee for the web panel
const loginUser = async (payload: {
    number?: string;
    email?: string;
    password: string;
}): Promise<ILoginUserResponse> => {
    const { number, email, password } = payload;

    if (!number && !email) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Phone number or email is required',
        );
    }

    const isUserExist = await prisma.user.findFirst({
        where: {
            OR: [
                number ? { number, status: UserStatus.ACTIVE } : undefined,
                email ? { email: email.toLowerCase(), status: UserStatus.ACTIVE } : undefined,
            ].filter(Boolean) as any,
        },
    });

    if (!isUserExist) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
    }

    if (
        !isUserExist.password ||
        !(await AuthUtils.comparePasswords(
            password,
            isUserExist.password,
            isUserExist.passwordSalt,
        ))
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

const adminUserLogin = async (payload: {
    number?: string;
    email?: string;
    password: string;
}): Promise<ILoginUserResponse> => {
    const { number, email, password } = payload;

    if (!number && !email) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Phone number or email is required',
        );
    }

    const isUserExist = await prisma.user.findFirst({
        where: {
            OR: [
                number ? { number, status: UserStatus.ACTIVE } : undefined,
                email ? { email: email.toLowerCase(), status: UserStatus.ACTIVE } : undefined,
            ].filter(Boolean) as any,
        },
    });

    if (!isUserExist) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
    }

    if (
        !isUserExist.password ||
        !(await AuthUtils.comparePasswords(
            password,
            isUserExist.password,
            isUserExist.passwordSalt,
        ))
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
        !isUserExist.password ||
        !(await AuthUtils.comparePasswords(
            oldPassword,
            isUserExist.password,
            isUserExist.passwordSalt,
        ))
    ) {
        throw new ApiError(
            httpStatus.UNAUTHORIZED,
            'Old Password is incorrect',
        );
    }

    const { hash, salt } = await AuthUtils.hashedPassword(newPassword);

    await prisma.user.update({
        where: {
            id: isUserExist.id,
        },
        data: {
            password: hash,
            passwordSalt: salt,
        },
    });
};

const getMe = async (user: JwtPayload | null) => {
    if (!user) return null;

    let profile: any = null;
    let tenants: { id: string; name: string; shops: { id: string; shopName: string }[] }[] = [];
    let defaultTenantId: string | null = null;
    let defaultShopId: string | null = null;

    if (user.role === 'OWNER') {
        profile = await prisma.owner.findUnique({ where: { userID: user.userID } });
        if (profile) {
            const t = await prisma.tenant.findMany({
                where: { ownerID: user.userID, isDeleted: false },
                include: { shops: { select: { id: true, shopName: true } } },
            });
            tenants = t.map((x: any) => ({ id: x.id, name: x.name, shops: x.shops }));
            defaultTenantId = t[0]?.id || null;
            defaultShopId = t[0]?.shops?.[0]?.id || null;
        }
    } else if (user.role === 'EMPLOYEE') {
        profile = await prisma.employee.findUnique({ where: { userID: user.userID } });
        if (profile) {
            defaultTenantId = profile.tenantID;
            defaultShopId = profile.shopID;
        }
    } else if (user.role === 'BUYER') {
        profile = await prisma.buyer.findUnique({ where: { userID: user.userID } });
    } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        profile = await prisma.admin.findUnique({ where: { userID: user.userID } });
    }

    const userRecord = await prisma.user.findUnique({
        where: { id: user.userID },
        select: { id: true, number: true, email: true, name: true, role: true, status: true },
    });

    return {
        user: userRecord,
        profile,
        role: user.role,
        tenants,
        defaultTenantId,
        defaultShopId,
    };
};

const logOutUser = async (refreshToken: string) => {
    await prisma.refreshToken.deleteMany({
        where: { refreshToken: refreshToken },
    });
};

/**
 * Register a new OWNER account with email+password (or phone+password),
 * create a Tenant + Shop for them, and return an access/refresh token pair.
 */
const registerUser = async (payload: {
    name?: string;
    number?: string;
    email?: string;
    password: string;
    shopName?: string;
    address?: string;
}): Promise<ILoginUserResponse & { tenantId: string; shopId: string }> => {
    const { name, number, email, password, shopName, address } = payload;

    const emailNormalized = email ? email.toLowerCase() : null;
    if (!number && !emailNormalized) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Number or email is required');
    }

    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                number ? { number } : undefined,
                emailNormalized ? { email: emailNormalized } : undefined,
            ].filter(Boolean) as any,
        },
    });
    if (existing) {
        throw new ApiError(httpStatus.CONFLICT, 'An account with this phone or email already exists');
    }

    const { hash, salt } = await AuthUtils.hashedPassword(password);

    const identifier = number || emailNormalized!;
    const displayName = name?.trim() || (emailNormalized ? emailNormalized.split('@')[0] : 'Store Owner');

    // Create User + Owner + Tenant + Shop atomically
    const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                number: number || `dev-${Date.now()}`,
                email: emailNormalized,
                password: hash,
                passwordSalt: salt,
                role: [UserRole.OWNER],
                status: UserStatus.ACTIVE,
                OTP: 0,
                name: displayName,
            },
        });

        const owner = await tx.owner.create({
            data: {
                userID: user.id,
                name: displayName,
                number: number || '00000000000',
                email: emailNormalized || `${user.id}@local.dev`,
                dob: '',
                address: address || '',
            },
        });

        const tenant = await tx.tenant.create({
            data: {
                name: shopName || `${displayName}'s Store`,
                code: `TEN-${user.id.slice(0, 8).toUpperCase()}`,
                ownerID: user.id,
            },
        });

        const shop = await tx.shop.create({
            data: {
                shopName: shopName || `${displayName}'s Store`,
                contact: number || '',
                tenantID: tenant.id,
                ownerID: user.id,
                category: 'OTHER' as any,
            },
        });

        return { user, tenant, shop };
    });

    const accessToken = JWTHelper.createToken(
        { userID: created.user.id, role: UserRole.OWNER },
        config.jwt.secret as Secret,
        config.jwt.expires_in as string,
    );
    const refreshToken = JWTHelper.createToken(
        { userID: created.user.id, role: UserRole.OWNER },
        config.jwt.refresh_secret as Secret,
        config.jwt.refresh_expires_in as string,
    );

    await prisma.refreshToken.upsert({
        where: { userID: created.user.id },
        create: { userID: created.user.id, refreshToken },
        update: { refreshToken },
    });

    return {
        accessToken,
        refreshToken,
        tenantId: created.tenant.id,
        shopId: created.shop.id,
    };
};

export const AuthService = {
    loginUser,
    registerUser,
    refreshToken,
    changePassword,
    getMe,
    logOutUser,
    adminUserLogin,
};
