import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../../interfaces/common';
import pick from '../../../../shared/pick';
import { tagService } from './tag.service';

const test = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = null;

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'test',
            data: result,
        });
    },
);

const createTag = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await tagService.createTag(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Created tag successfully',
            data: result,
        });
    },
);

const updateTag = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await tagService.updateTag(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Tag Updated successfully',
            data: result,
        });
    },
);

const getTagsByShopId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { shopId } = req.params;
        const result = await tagService.getTagsByShopId(shopId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'All Tag/s Retrieved successfully',
            data: result,
        });
    },
);

const deleteTag = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const { tagId } = req.params;
        const result = await tagService.deleteTag(tagId, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Tag Deleted successfully',
            data: result,
        });
    },
);

const assignTagToCustomer = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await tagService.assignTagToCustomer(req.body, tenantId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Tag Deleted successfully',
            data: result,
        });
    },
);

const removeTagFromCustomer = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId as string;
        const result = await tagService.removeTagFromCustomer(
            req.body,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.CREATED,
            message: 'Tag Deleted successfully',
            data: result,
        });
    },
);

export const tagController = {
    test,
    createTag,
    updateTag,
    getTagsByShopId,
    deleteTag,
    assignTagToCustomer,
    removeTagFromCustomer,
};
