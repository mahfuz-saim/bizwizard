import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { referralService } from './referral.service';
import { JwtPayload } from '../../../interfaces/common';

const getAllReferralRewards = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as JwtPayload;
        const tenantId = req.tenantId as string;
        const result = await referralService.getAllReferralRewards(
            user,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All referral rewards retrieved successfully',
            data: result,
        });
    },
);

const claimReferralReward = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as JwtPayload;
    const tenantId = req.tenantId as string;
    const result = await referralService.claimReferralReward(
        user,
        req.body,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Referral reward claimed successfully',
        data: result,
    });
});

export const referralController = {
    getAllReferralRewards,
    claimReferralReward,
};
