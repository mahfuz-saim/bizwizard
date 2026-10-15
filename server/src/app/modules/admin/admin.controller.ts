import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { adminService } from './admin.service';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { IUploadFile } from '../../../interfaces/file';
import { JwtPayload } from '../../../interfaces/common';
import { createAuditLogInfo } from '../../../helpers/browserData';

const getAllAdmin = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, ['name', 'number', 'searchTerm']);
    const options = pick(req.query, paginationFields);

    const result = await adminService.getAllAdmin(filters, options);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin retrieval successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getAdminByID = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await adminService.getAdminByID(id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin is found successfully',
        data: result,
    });
});

const deleteAdmin = catchAsync(async (req, res) => {
    const { id } = req.params;
    const auditLogData = createAuditLogInfo(req);

    const result = await adminService.deleteAdmin(id, auditLogData);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin is deleted successfully',
        data: result,
    });
});

const updateAdmin = catchAsync(async (req, res) => {
    const { id } = req.params;
    const file = req.file as IUploadFile;
    const auditLogData = createAuditLogInfo(req);

    const result = await adminService.updateAdmin(
        id,
        req.body,
        file,
        auditLogData,
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Admin is created successfully',
        data: result,
    });
});

export const adminController = {
    getAllAdmin,
    getAdminByID,
    deleteAdmin,
    updateAdmin,
};
