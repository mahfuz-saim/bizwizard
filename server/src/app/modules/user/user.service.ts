import { IUploadFile } from '../../../interfaces/file';
import { Jwt, Secret } from 'jsonwebtoken';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import {
    IAdmin,
    IBuyer,
    IEmployee,
    ISale,
    ISupplier,
    IUser,
} from './user.interface';
import prisma from '../../../shared/prisma';
import { AuthUtils } from '../../../helpers/bcryptHelpers';
import { UserRole, UserStatus, ReferralCodeOwnerType } from '@prisma/client';
import { JWTHelper } from '../../../helpers/jwtHelpers';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { smsHelper } from '../../../helpers/sendSMS';
import { nanoIdHelper } from '../../../helpers/nanoidHelper';
import { JwtPayload } from '../../../interfaces/common';

// Reward amounts are hard-coded per docs/referral.md §8.
const REFERRER_CREDITS = 100;
const CHAIN_HALF_AMOUNT = REFERRER_CREDITS / 2;

//TODO:
//add referral reward in other routes

function generateFourDigitNumber() {
    return Math.floor(1000 + Math.random() * 9000);
}

const createAdmin = async (payload: IAdmin, file: IUploadFile) => {
    const { password, admin } = payload;
    const hashPassword = await AuthUtils.hashedPassword(password);

    if (file) {
        const uploadedProfileImage =
            await FileUploadHelper.uploadToCloudinary(file);
        payload.admin.image = uploadedProfileImage?.secure_url;
    }

    const OTP = generateFourDigitNumber();

    const result = await prisma.$transaction(async tx => {
        const createUser = await tx.user.upsert({
            where: {
                number: admin.number,
            },
            create: {
                number: admin.number,
                password: hashPassword,
                role: [UserRole.ADMIN],
                status: UserStatus.ACTIVE,
                OTP,
            },
            update: {
                password: hashPassword,
                role: {
                    push: UserRole.ADMIN,
                },
            },
        });

        const createAdmin = await tx.admin.create({
            data: {
                userID: createUser.id,
                ...admin,
            },
        });

        return createAdmin;
    });

    return result;
};

const createSale = async (payload: ISale, file: IUploadFile) => {
    const { password, sale, referralCode: incomingReferralCode } = payload;
    const hashPassword = await AuthUtils.hashedPassword(password);

    const newSrReferralCode = await nanoIdHelper.generateCustomNanoId(6);

    if (file) {
        const uploadedProfileImage =
            await FileUploadHelper.uploadToCloudinary(file);
        payload.sale.image = uploadedProfileImage?.secure_url;
    }

    const OTP = generateFourDigitNumber();

    // Resolve + validate the upstream referral code (if any) before we start a tx.
    // Rule 5: Owners cannot refer SRs — reject if the code is owner-owned.
    let upstreamCode: Awaited<
        ReturnType<typeof prisma.referralCode.findUnique>
    > = null;
    if (incomingReferralCode) {
        upstreamCode = await prisma.referralCode.findUnique({
            where: { code: incomingReferralCode },
        });
        if (!upstreamCode) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Referral Code');
        }
        if (upstreamCode.userType === ReferralCodeOwnerType.OWNER) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Owners cannot refer Sales Representatives',
            );
        }
    }

    const result = await prisma.$transaction(async tx => {
        const createUser = await tx.user.upsert({
            where: {
                number: sale.number,
            },
            create: {
                number: sale.number,
                password: hashPassword,
                role: [UserRole.SALES_REPRESENTATIVE],
                status: UserStatus.ACTIVE,
                OTP,
            },
            update: {
                password: hashPassword,
                role: { push: UserRole.SALES_REPRESENTATIVE },
            },
        });

        const createSale = await tx.salesRepresentative.create({
            data: {
                userID: createUser.id,
                ...sale,
                ReferralCode: {
                    create: {
                        code: newSrReferralCode,
                        userType: ReferralCodeOwnerType.SALES_REPRESENTATIVE,
                    },
                },
            },
        });

        // If a referral code was provided, link the new SR to it as the
        // referred party and create a chain promise for the upstream SR.
        if (upstreamCode && upstreamCode.salesRepresentativeId) {
            const createdReferral = await tx.referral.create({
                data: {
                    referralCodeId: upstreamCode.id,
                    referredSalesRepresentativeId: createSale.userID,
                },
            });

            // downstreamSalesRepId is UNIQUE — if a promise already exists
            // for this downstream SR, the second referrer hits the unique
            // constraint and the whole transaction is rolled back.
            try {
                await tx.referralChainPromise.create({
                    data: {
                        upstreamSalesRepId: upstreamCode.salesRepresentativeId,
                        downstreamSalesRepId: createSale.userID,
                        halfAmount: CHAIN_HALF_AMOUNT,
                    },
                });
            } catch (err: any) {
                if (
                    err?.code === 'P2002' &&
                    (err?.meta?.target as string[] | undefined)?.some(t =>
                        String(t).includes('downstreamSalesRepId'),
                    )
                ) {
                    throw new ApiError(
                        httpStatus.BAD_REQUEST,
                        'This Sales Representative is already part of an existing referral chain',
                    );
                }
                throw err;
            }

            // refId is loose — we don't need it but it's a useful breadcrumb.
            void createdReferral;
        }

        return createSale;
    });

    return result;
};

const createBuyer = async (payload: IBuyer) => {
    const { password, buyer } = payload;
    const hashPassword = await AuthUtils.hashedPassword(password);

    const OTP = generateFourDigitNumber();

    const result = await prisma.$transaction(async tx => {
        const createUser = await tx.user.upsert({
            where: {
                number: buyer.number,
            },
            create: {
                number: buyer.number,
                password: hashPassword,
                role: [UserRole.BUYER],
                OTP,
            },

            update: {
                password: hashPassword,
                role: { push: UserRole.BUYER },
            },
        });

        const createBuyer = await tx.buyer.create({
            data: {
                userID: createUser.id,
                ...buyer,
            },
        });

        return createBuyer;
    });

    const JwtPayload = {
        number: result.number,
        userID: result.userID,
    };

    const token = JWTHelper.createToken(
        JwtPayload,
        config.jwt.secret as string,
        config.jwt.passwordResetTokenExpirationTime,
    );

    await smsHelper.sendOTP({ number: result.number, otp: OTP });
    return {
        data: result,
        verifyToken: token,
    };
};

const createEmployee = async (payload: IEmployee) => {
    const { password, employee } = payload;
    if (!employee.tenantID) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'tenantID is required');
    }
    const hashPassword = await AuthUtils.hashedPassword(password);

    const OTP = generateFourDigitNumber();

    const result = await prisma.$transaction(async tx => {
        const createUser = await tx.user.upsert({
            where: {
                number: employee.number,
            },
            create: {
                number: employee.number,
                password: hashPassword,
                role: [UserRole.EMPLOYEE],
                OTP,
            },
            update: {
                password: hashPassword,
                role: { push: UserRole.EMPLOYEE },
            },
        });

        const createEmployee = await tx.employee.create({
            data: {
                userID: createUser.id,
                ...employee,
                shopID: employee.shopID || null,
            },
        });

        return createEmployee;
    });

    const JwtPayload = {
        number: result.number,
        userID: result.userID,
    };

    const token = JWTHelper.createToken(
        JwtPayload,
        config.jwt.secret as string,
        config.jwt.passwordResetTokenExpirationTime,
    );

    return {
        data: result,
        verifyToken: token,
    };
};

const getAllUser = async () => {
    const result = await prisma.user.findMany({
        select: {
            id: true,
            number: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return result;
};

const verifyUser = async (
    { number, userID }: { number: string; userID: string },
    OTP: number,
) => {
    const isUserExist = await prisma.user.findUniqueOrThrow({
        where: {
            number,
            id: userID,
            status: UserStatus.PENDING,
        },
    });

    if (isUserExist.OTP !== OTP) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "OTP doesn't match");
    }

    await prisma.user.update({
        where: {
            id: userID,
        },
        data: {
            status: UserStatus.ACTIVE,
        },
    });

    return {
        message: 'User is verified',
    };
};

//NOTE: this in only for owner or employee creation
const createUser = async (payload: IUser) => {
    const { user, userType } = payload;

    let referralCode = null;

    if (payload?.referralCode) {
        referralCode = await prisma.referralCode.findUnique({
            where: {
                code: payload.referralCode,
            },
        });
        if (!referralCode) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Referral Code');
        }
    }
    let hashPassword = null;
    if (payload.password) {
        hashPassword = await AuthUtils.hashedPassword(payload.password);
    }

    const OTP = generateFourDigitNumber();
    const usrRole = userType === 'owner' ? UserRole.OWNER : UserRole.EMPLOYEE;
    const userReferralCode = await nanoIdHelper.generateCustomNanoId(6);

    const result = await prisma.$transaction(async tx => {
        let createUser = await tx.user.upsert({
            where: {
                number: user.number,
            },
            create: {
                number: user.number,
                password: hashPassword,
                role: [usrRole],
                status: UserStatus.ACTIVE,
                OTP,
                email: user?.email || null,
            },
            update: {
                password: hashPassword,
                role: { push: usrRole },
                email: user?.email || null,
            },
        });

        if (
            usrRole === UserRole.OWNER &&
            createUser.role.includes(UserRole.EMPLOYEE)
        ) {
            //NOTE: employee is trying to create owner acc
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You are not allowed to create owner account',
            );
        }
        if (
            usrRole === UserRole.EMPLOYEE &&
            createUser.role.includes(UserRole.OWNER)
        ) {
            //NOTE: owner is trying to create employee acc
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'You are not allowed to create employee account',
            );
        }

        let result = null;
        if (userType === 'owner') {
            result = await tx.owner.create({
                data: {
                    userID: createUser.id,
                    ...user,
                    ReferralCode: {
                        create: {
                            code: userReferralCode,
                            userType: ReferralCodeOwnerType.OWNER,
                        },
                    },
                    email: payload.user.email || '',
                },
            });
            //TODO: refactor this code, it is too long and complex, maybe move to a separate function
            if (referralCode) {
                // created referral record, this table tracks who referred whom
                const createdReferral = await tx.referral.create({
                    data: {
                        referralCodeId: referralCode.id,
                    },
                });
                await tx.owner.update({
                    where: {
                        id: result.id,
                    },
                    data: {
                        referral: {
                            connect: {
                                id: createdReferral.id,
                            },
                        },
                    },
                });
                // adding reward, single row tracks both referrer and referee
                const mainReward = await tx.referralReward.create({
                    data: {
                        referralId: createdReferral.id,
                    },
                });

                // If the referrer is an SR (case 3), mark referrerSalesRepId on the
                // main reward so the SR sees it in their asReferrer[] bucket.
                if (
                    referralCode.userType ===
                        ReferralCodeOwnerType.SALES_REPRESENTATIVE &&
                    referralCode.salesRepresentativeId
                ) {
                    await tx.referralReward.update({
                        where: { id: mainReward.id },
                        data: {
                            referrerSalesRepId:
                                referralCode.salesRepresentativeId,
                        },
                    });
                }

                // Chain resolution: if the SR-side referrer has an upstream
                // promise that is still PENDING, fulfill it and emit a chain-bonus
                // reward row in the same transaction (race-safe via the unique
                // constraint on fulfilledByReferralId).
                if (
                    referralCode.userType ===
                        ReferralCodeOwnerType.SALES_REPRESENTATIVE &&
                    referralCode.salesRepresentativeId
                ) {
                    const downstreamSrId = referralCode.salesRepresentativeId;

                    const pendingPromise =
                        await tx.referralChainPromise.findUnique({
                            where: { downstreamSalesRepId: downstreamSrId },
                        });

                    if (pendingPromise && pendingPromise.status === 'PENDING') {
                        try {
                            await tx.referralChainPromise.update({
                                where: {
                                    id: pendingPromise.id,
                                },
                                data: {
                                    status: 'FULFILLED',
                                    fulfilledAt: new Date(),
                                    fulfilledByReferralId: createdReferral.id,
                                },
                            });
                        } catch (err: any) {
                            if (err?.code === 'P2002') {
                                throw new ApiError(
                                    httpStatus.CONFLICT,
                                    'Referral chain is being processed, please retry',
                                );
                            }
                            throw err;
                        }

                        // Chain-bonus reward: tied to the upstream SR via referrerSalesRepId,
                        // half-amount snapshotted from the promise. The main reward already
                        // owns createdReferral.id via referralId, so the chain bonus uses
                        // chainBonusReferralId as its alternate inverse.
                        await tx.referralReward.create({
                            data: {
                                chainBonusReferralId: createdReferral.id,
                                referrerSalesRepId:
                                    pendingPromise.upstreamSalesRepId,
                                referrerCredits: pendingPromise.halfAmount,
                                referrerStatus: 'PENDING',
                                referrerRewardType: 'CREDITS',
                            },
                        });
                    }
                }
                //TODO: if success notify referrer about reward
            }
        } else if (userType === 'employee') {
            const employeeData = user;
            result = await tx.employee.create({
                data: {
                    userID: createUser.id,
                    ...employeeData,
                },
            });
        }

        return createUser;
    });

    const JwtPayload = {
        userID: result?.id,
        role: usrRole,
    };

    const accessToken = JWTHelper.createToken(
        JwtPayload,
        config.jwt.secret as Secret,
        config.jwt.expires_in as string,
    );

    const refreshToken = JWTHelper.createToken(
        JwtPayload,
        config.jwt.refresh_secret as Secret,
        config.jwt.refresh_expires_in as string,
    );

    return {
        accessToken,
        refreshToken,
    };
};

const verifyReferral = async (referralCode: string) => {
    const result = await prisma.referralCode.findUniqueOrThrow({
        where: {
            code: referralCode,
        },
    });
    return result;
};

const createSupplier = async (payload: ISupplier) => {
    const { password, supplier } = payload;
    const hashPassword = await AuthUtils.hashedPassword(password);

    const OTP = generateFourDigitNumber();

    const result = await prisma.$transaction(async tx => {
        const createUser = await tx.user.upsert({
            where: {
                number: supplier.number,
            },
            create: {
                number: supplier.number,
                password: hashPassword,
                role: [UserRole.SUPPLIER],
                OTP,
            },
            update: {
                password: hashPassword,
                role: { push: UserRole.SUPPLIER },
                OTP,
            },
        });

        const createSupplier = await tx.supplier.create({
            data: {
                userID: createUser.id,
                ...supplier,
            },
        });

        return createUser;
    });

    const JwtPayload = {
        number: result.number,
        userID: result.id,
    };

    const token = JWTHelper.createToken(
        JwtPayload,
        config.jwt.secret as string,
        config.jwt.passwordResetTokenExpirationTime,
    );

    await smsHelper.sendOTP({ number: result.number, otp: OTP });
    return {
        data: result,
        verifyToken: token,
    };
};

const getProfile = async (user: JwtPayload) => {
    const result = await prisma.user.findUnique({
        where: {
            id: user.userID,
        },
        include: {
            admin: true,
            Buyer: true,
            Employee: true,
            SalesRepresentative: {
                include: {
                    ReferralCode: true,
                },
            },
            Supplier: true,
            Owner: {
                include: {
                    ReferralCode: true,
                },
            },
        },
    });

    return result;
};

export const UserServices = {
    createAdmin,
    createBuyer,
    createEmployee,
    createSale,
    getAllUser,
    verifyUser,
    createUser,
    verifyReferral,
    createSupplier,
    getProfile,
};
