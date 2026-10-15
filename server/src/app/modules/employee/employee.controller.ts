import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { employeeService } from './employee.service';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { JwtPayload } from '../../../interfaces/common';
import { createAuditLogInfo } from '../../../helpers/browserData';
import ApiError from '../../../errors/ApiError';

const getEmployee = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const filters = pick(req.query, [
            'name',
            'number',
            'shopID',
            'searchTerm',
        ]);
        const options = pick(req.query, paginationFields);
        const result = await employeeService.getEmployee(
            filters,
            options,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Employee is fetched successfully',
            data: result,
        });
    },
);

const getEmployeeByID = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { id } = req.params;
        const result = await employeeService.getEmployeeByID(
            id,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Employee is fetched successfully',
            data: result,
        });
    },
);

const updateEmployee = catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const { id } = req.params;
    const auditLogData = createAuditLogInfo(req);

    const result = await employeeService.updateEmployee(
        id,
        req.body,
        auditLogData,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Employee updated successfully',
        data: result,
    });
});

const deleteEmployee = catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const { id } = req.params;
    const auditLogData = createAuditLogInfo(req);

    const result = await employeeService.deleteEmployee(
        id,
        auditLogData,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Employee deleted successfully',
        data: result,
    });
});

const joinShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopCode } = req.params;
        if (!shopCode) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Shop code is required');
        }
        const result = await employeeService.joinShop(
            shopCode,
            req.user as JwtPayload,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop Join Request sent successfully',
            data: result,
        });
    },
);

const getJoinRequests = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await employeeService.getJoinRequests(
            req.user as JwtPayload,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Join Requests Retrieved Successfully',
            data: result,
        });
    },
);

const deleteJoinRequest = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopCode } = req.params;
        const result = await employeeService.deleteJoinRequest(
            shopCode,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Join Request Deleted Successfully',
            data: result,
        });
    },
);
const getMyShop = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await employeeService.getMyShop(
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'User Shop Retrieved Successfully',
            data: result,
        });
    },
);
export const employeeController = {
    getEmployee,
    getEmployeeByID,
    updateEmployee,
    deleteEmployee,
    joinShop,
    getJoinRequests,
    deleteJoinRequest,
    getMyShop,
};
