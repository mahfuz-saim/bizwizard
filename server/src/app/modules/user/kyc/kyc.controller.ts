import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { IUploadFile } from '../../../../interfaces/file';
import { JwtPayload } from '../../../../interfaces/common';
import { kycService } from './kyc.service';
import ApiError from '../../../../errors/ApiError';

const submitKYC = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const files = req.files as Record<string, IUploadFile[]>;
        const result = await kycService.submitKYC(
            req.user as JwtPayload,
            req.body,
            files,
        );

        sendResponse(res, {
            statusCode: httpStatus.CREATED,
            success: true,
            message: 'KYC submitted successfully!',
            data: result,
        });
    },
);

const getKYCStatus = catchAsync(
    async (req: Request, res: Response, _: NextFunction) => {
        const { shopId } = req.params;
        const result = await kycService.getKYCStatus(
            req.user as JwtPayload,
            shopId as string,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: 'KYC Status Retrieved successfully!',
            data: result,
        });
    },
);

const approveKYC = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await kycService.approveKYC(
            req.body,
            req.tenantId as string,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: 'KYC Status Approved successfully!',
            data: result,
        });
    },
);

const getAllKYCRequests = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await kycService.getAllKYCRequests();

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: 'All KYC Request Retrieved Successfully!',
            data: result,
        });
    },
);

export const kycController = {
    submitKYC,
    getKYCStatus,
    approveKYC,
    getAllKYCRequests,
};
