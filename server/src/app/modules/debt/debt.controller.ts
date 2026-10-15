import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { debtService } from './debt.service';

const getAllDebt = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.params;
        const tenantId = req.tenantId as string;
        const filters = pick(req.query, [
            'searchTerm',
            'date',
            'includeCompleted',
            'status',
        ]);

        const options = pick(req.query, paginationFields);
        const result = await debtService.getAllDebt(
            shopId,
            tenantId,
            filters,
            options,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Debt Retrieved Successfully!',
            data: result,
        });
    },
);

const getSingleDebt = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { debtId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await debtService.getSingleDebt(debtId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Debt Retrieved Successfully!',
            data: result,
        });
    },
);

const resolveSingleDebt = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await debtService.resolveSingleDebt(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Debt Resolved Successfully!',
            data: result,
        });
    },
);

const resolveBulkDebt = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await debtService.resolveBulkDebt(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Bulk Debt Resolved Successfully!',
            data: result,
        });
    },
);

const getUserDebt = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await debtService.getUserDebt(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'User Debt Retrieved Successfully!',
            data: result,
        });
    },
);

const addPreviousDebt = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await debtService.addPreviousDebt(
            req.body,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'User Previoud Debt Added Successfully!',
            data: result,
        });
    },
);

const getBuyerLedger = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId, buyerId } = req.params;
        const tenantId = req.tenantId as string;
        const options = pick(req.query, paginationFields);
        const result = await debtService.getBuyerLedger(
            shopId,
            buyerId,
            tenantId,
            options,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Buyer Ledger Retrieved Successfully!',
            data: result,
        });
    },
);

export const debtController = {
    getAllDebt,
    getSingleDebt,
    resolveSingleDebt,
    resolveBulkDebt,
    getUserDebt,
    addPreviousDebt,
    getBuyerLedger,
};
