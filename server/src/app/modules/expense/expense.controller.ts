import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { JwtPayload } from '../../../interfaces/common';
import { createAuditLogInfo } from '../../../helpers/browserData';
import { ExpenseService } from './expense.service';

const createExpense = catchAsync(async (req: Request, res: Response) => {
    // const auditLogData = createAuditLogInfo(req);
    const tenantId = req.tenantId as string;
    const result = await ExpenseService.createExpense(
        req.body,
        tenantId,
        req.user as JwtPayload,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: 'Expense created successfully',
        data: result,
    });
});

const getExpenses = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopID } = req.params;
        const tenantId = req.tenantId as string;
        const filters = pick(req.query, [
            'searchTerm',
            'month',
            'year',
            'expenseType',
        ]);
        const options = pick(req.query, paginationFields);
        const result = await ExpenseService.getExpenses(
            shopID,
            tenantId,
            filters,
            options,
            req.user as JwtPayload,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Expenses fetched successfully',
            data: result,
        });
    },
);

const getExpenseById = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const tenantId = req.tenantId as string;
        const result = await ExpenseService.getExpenseById(
            id,
            tenantId,
            req.user as JwtPayload,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Expense fetched successfully',
            data: result,
        });
    },
);

const updateExpense = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = req.tenantId as string;
    //const auditLogData = createAuditLogInfo(req);
    const result = await ExpenseService.updateExpense(
        id,
        req.body,
        tenantId,
        req.user as JwtPayload,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Expense updated successfully',
        data: result,
    });
});

const deleteExpense = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = req.tenantId as string;
    const auditLogData = createAuditLogInfo(req);
    const result = await ExpenseService.deleteExpense(
        id,
        tenantId,
        req.user as JwtPayload,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Expense deleted successfully',
        data: result,
    });
});

const deleteExpenseItem = catchAsync(async (req: Request, res: Response) => {
    const { itemId } = req.params;
    const tenantId = req.tenantId as string;
    const result = await ExpenseService.deleteExpenseItem(
        itemId,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Expense item deleted successfully',
        data: result,
    });
});

export const expenseController = {
    createExpense,
    getExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense,
    deleteExpenseItem,
};
