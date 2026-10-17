import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { UserServices } from './user.service';
import { IUploadFile } from '../../../interfaces/file';
import config from '../../../config';
import { JwtPayload } from '../../../interfaces/common';

const createAdmin = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const file = req.file as IUploadFile;
        const result = await UserServices.createAdmin(req.body, file);

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: 'Admin is created successfully!',
            data: result,
        });
    },
);

const createSale = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const file = req.file as IUploadFile;
        const result = await UserServices.createSale(req.body, file);

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: 'Sale Representative is created successfully!',
            data: result,
        });
    },
);

const createBuyer = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await UserServices.createBuyer(req.body);

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: 'Buyer is created successfully!',
            data: result,
        });
    },
);

const createEmployee = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await UserServices.createEmployee(req.body);

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: 'Employee is created successfully!',
            data: result,
        });
    },
);

const getAllUser = catchAsync(async (req: Request, res: Response) => {
    const result = await UserServices.getAllUser();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Users retrieval successfully',
        data: result,
    });
});
const createUser = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await UserServices.createUser(req.body);

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
            message: 'User Created successfully !',
            data: {
                accessToken: result.accessToken,
            },
        });
    },
);

const verifyReferral = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { referralCode } = req.params;
        const result = await UserServices.verifyReferral(referralCode);

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Referral Code Verified Successfully !',
            data: result,
        });
    },
);

const createSupplier = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await UserServices.createSupplier(req.body);

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: 'Supplier is created successfully!',
            data: result,
        });
    },
);

const getProfile = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await UserServices.getProfile(req.user as JwtPayload);

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: 'User Profile Fetched successfully!',
            data: result,
        });
    },
);
export const UserController = {
    createAdmin,
    createBuyer,
    createEmployee,
    createSale,
    getAllUser,
    createUser,
    verifyReferral,
    createSupplier,
    getProfile,
};
