import { Request, Response, NextFunction } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { noteService } from './note.service';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';

const createNote = catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.tenantId as string;
    const result = await noteService.createNote(req.body, tenantId);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Note created successfully',
        data: result,
    });
});

const getNotesByShopId = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { date } = req.query;
    const tenantId = req.tenantId as string;
    const result = await noteService.getNotesByShopId(id, date, tenantId);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Notes fetched successfully',
        data: result,
    });
});

const updateNote = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = req.tenantId as string;
    const result = await noteService.updateNote(
        id,
        req.body,
        req.user as JwtPayload,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Note updated successfully',
        data: result,
    });
});

const deleteNote = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = req.tenantId as string;
    const result = await noteService.deleteNote(
        id,
        req.user as JwtPayload,
        tenantId,
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Note deleted successfully',
        data: result,
    });
});

export const noteController = {
    createNote,
    getNotesByShopId,
    updateNote,
    deleteNote,
};
