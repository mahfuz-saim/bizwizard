import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import { creditService } from './credit.service';

const getAllCredit = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId = null } = req.query;
        const { status = null } = req.query;
        const tenantId = req.tenantId;
        //TODO: maybe add multiple status filter
        const result = await creditService.getAllCredit(shopId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'ALl Topup Request Retrieved Successfully!',
            data: result,
        });
    },
);
export const creditController = { getAllCredit };
