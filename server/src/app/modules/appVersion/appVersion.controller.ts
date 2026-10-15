import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { appVersionService } from './appVersion.service';
import { AppType } from '@prisma/client';

const getAppVersion = catchAsync(async (req, res) => {
    const { appType } = req.params;
    const result = await appVersionService.getAppVersion(appType as AppType);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'Latest App Version fetched successfully',
        data: result,
    });
});

const createAppVersion = catchAsync(async (req, res) => {
    const result = await appVersionService.createAppVersion(req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: 'App Version Created successfully',
        data: result,
    });
});

export const appVersionController = {
    getAppVersion,
    createAppVersion,
};
