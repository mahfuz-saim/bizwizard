import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AuditLogService } from './auditLog.service';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { JwtPayload } from '../../../interfaces/common';

const getAuditLog = catchAsync(async (req, res) => {
    const filters = pick(req.query, [
        'searchTerm',
        'userRole',
        'operationType',
    ]);
    const options = pick(req.query, paginationFields);

    const result = await AuditLogService.getAuditLog(
        filters,
        options,
        req.user as JwtPayload,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Audit log is fetched successfully',
        data: result,
    });
});

export const AuditLogController = {
    getAuditLog,
};
