import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../../interfaces/common';
import { attendanceService } from './attendance.service';
import pick from '../../../../shared/pick';

const clockInAttendance = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await attendanceService.clockInAttendance(
            req.user as JwtPayload,
            req.body.date,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Clock In Successfully',
            data: result,
        });
    },
);

const clockOutAttendance = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await attendanceService.clockOutAttendance(
            req.user as JwtPayload,
            req.body.date,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Clock Out Successfully',
            data: result,
        });
    },
);

const getAttendance = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const filters = pick(req.query, [
            'shopId',
            'employeeId',
            'month',
            'year',
        ]);
        const result = await attendanceService.getAttendance(
            req.user as JwtPayload,
            filters,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Attendece Retrieved Successfully',
            data: result,
        });
    },
);

const updateAttendance = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await attendanceService.updateAttendance(
            req.body,
            req.user as JwtPayload,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Attendece Update Successfully',
            data: result,
        });
    },
);

const getClockRequests = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.params;
        const result = await attendanceService.getClockRequests(
            shopId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Attendece Requests Retrieved Successfully',
            data: result,
        });
    },
);

export const attendanceController = {
    clockInAttendance,
    clockOutAttendance,
    getAttendance,
    updateAttendance,
    getClockRequests,
};
