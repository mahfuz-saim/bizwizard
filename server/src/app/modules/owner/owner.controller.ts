import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { IUploadFile } from '../../../interfaces/file';
import { ownerService } from './owner.service';
import { JwtPayload } from '../../../interfaces/common';
import { createAuditLogInfo } from '../../../helpers/browserData';

const getAllOwner = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, ['name', 'number', 'searchTerm']);
    const options = pick(req.query, paginationFields);

    const result = await ownerService.getAllOwner(filters, options);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Owner retrieval successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getOwnerByID = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await ownerService.getOwnerByID(id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Owner is found successfully',
        data: result,
    });
});

const deleteOwner = catchAsync(async (req, res) => {
    const { id } = req.params;
    const auditLogInfo = createAuditLogInfo(req);
    const result = await ownerService.deleteOwner(id, auditLogInfo);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Owner is deleted successfully',
        data: result,
    });
});

const updateOwner = catchAsync(async (req, res) => {
    const { id } = req.params;
    const file = req.file as IUploadFile;
    const auditLogInfo = createAuditLogInfo(req);
    const result = await ownerService.updateOwner(
        id,
        req.body,
        file,
        auditLogInfo,
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Owner is created successfully',
        data: result,
    });
});

export const ownerController = {
    getAllOwner,
    getOwnerByID,
    deleteOwner,
    updateOwner,
};
